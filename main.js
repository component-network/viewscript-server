const { randomUUID } = require("crypto");
const { readFile } = require("fs/promises");
const { resolve } = require("path");
const { JSDOM } = require("jsdom");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");
const { minify } = require("terser");
const typescript = require("typescript");
const YAML = require("yaml");

const getComponentFromFsCache = new Map();
const renderComponentCache = new Map();

const tailwindCssAtRules =
  "@tailwind base; @tailwind components; @tailwind utilities;";

function applyDataToDomElement(domElement, data, renderingOptions) {
  // Repeat elements with a use-for attribute
  const repeaters = domElement.querySelectorAll("[use-for]");

  for (const repeater of repeaters) {
    const [itemName, collectionName] = repeater
      .getAttribute("use-for")
      .split(" in ");

    const collectionData = getNestedValue(data, collectionName);

    repeater.removeAttribute("use-for");

    for (const item of collectionData) {
      const clonedElement = repeater.cloneNode(true);

      const clonedElementData = {
        ...data,
        [itemName]: item,
      };

      applyDataToDomElement(clonedElement, clonedElementData, renderingOptions);
      repeater.insertAdjacentElement("beforebegin", clonedElement);
    }

    repeater.remove();
  }

  // Remove elements with a use-if attribute that evaluates to false
  const conditionals = domElement.querySelectorAll("[use-if]");

  for (const conditional of conditionals) {
    const conditionalName = conditional.getAttribute("use-if");
    const inverted = conditionalName.startsWith("!");

    const boundConditionalName = inverted
      ? conditionalName.slice(1)
      : conditionalName;

    const conditionalValue = getNestedValue(data, boundConditionalName);

    if ((conditionalValue && !inverted) || (!conditionalValue && inverted)) {
      conditional.removeAttribute("use-if");
    } else {
      conditional.remove();
    }
  }

  // Replace slot elements using the given data
  const slots = domElement.querySelectorAll("slot");

  for (const slot of slots) {
    const slotName = slot.getAttribute("name");

    if (slotName) {
      const slotData = getNestedValue(data, slotName);

      if (slotData) {
        slot.replaceWith(slotData);
      }
    }
  }

  // Replace colon-prefixed attributes using the given data
  applyDataToDomElementAttributes(domElement, data, renderingOptions);
}

function applyDataToDomElementAttributes(domElement, data, renderingOptions) {
  const linkElements = Array.from(
    domElement.querySelectorAll("link[rel=element]")
  );

  const isImportedElement = linkElements.some(
    (linkElement) =>
      linkElement.getAttribute("as").toUpperCase() === domElement.tagName
  );

  const attributes = Array.from(domElement.attributes || []);

  for (const attribute of attributes) {
    if (attribute.name.startsWith(":")) {
      const targetAttributeName = attribute.name.slice(1);
      const inverted = attribute.value.startsWith("!");

      let attributeValue =
        (inverted ? attribute.value.slice(1) : attribute.value) ||
        targetAttributeName;

      const targetAttributeValue = inverted
        ? !getNestedValue(data, attributeValue)
        : getNestedValue(data, attributeValue);

      const targetAttributeValueSerialized = isImportedElement
        ? JSON.stringify(targetAttributeValue)
        : targetAttributeValue;

      if (targetAttributeValueSerialized) {
        domElement.setAttribute(
          targetAttributeName,
          targetAttributeValueSerialized
        );
      }

      domElement.removeAttribute(attribute.name);
    } else if (isImportedElement) {
      const attributeValueSerialized = JSON.stringify(attribute.value);
      domElement.setAttribute(attribute.name, attributeValueSerialized);
    }
  }

  for (const child of domElement.children) {
    applyDataToDomElementAttributes(child, data, renderingOptions);
  }
}

function getNestedValue(obj, path) {
  return path?.split(".").reduce((acc, key) => acc?.[key], obj);
}

async function applyImportsToDom(dom, data, renderingOptions) {
  const linkElements = Array.from(
    dom.window.document.querySelectorAll("link[rel=element]")
  );

  for (const linkElement of linkElements) {
    const importedElements = dom.window.document.querySelectorAll(
      linkElement.getAttribute("as").toLowerCase()
    );

    linkElement.remove();

    for (const importedElement of importedElements) {
      const importAttributes = Array.from(importedElement.attributes).reduce(
        (result, attribute) => {
          // result[attribute.name] = JSON.parse(attribute.value);
          result[attribute.name] = attribute.value;
          return result;
        },
        {}
      );

      let importUri = linkElement.getAttribute("href");

      if (importUri.endsWith(".html")) {
        importUri = importUri.slice(0, -5);
      }

      const importRendering = await renderingOptions.renderComponent(
        importUri,
        { ...data, ...importAttributes },
        { ...renderingOptions, descendant: true }
      );

      const importDom = new JSDOM(importRendering);

      const namedSlots =
        importDom.window.document.querySelectorAll("slot[name]");

      for (const namedSlot of namedSlots) {
        const importedChild = Array.from(importedElement.children).find(
          (child) =>
            child.getAttribute("slot") === namedSlot.getAttribute("name")
        );

        if (importedChild) {
          namedSlot.replaceWith(importedChild);
        }
      }

      const childrenSlots =
        importDom.window.document.querySelectorAll("slot:not([name])");

      for (const childrenSlot of childrenSlots) {
        childrenSlot.replaceWith(...importedElement.childNodes);
      }

      Array.from(importDom.window.document.head.children).forEach((child) => {
        if (child.tagName === "LINK") {
          if (
            !Array.from(dom.window.document.head.querySelectorAll("link")).some(
              (link) => link.href && link.href === child.href
            )
          ) {
            dom.window.document.head.appendChild(child);
          }
        } else if (child.tagName === "SCRIPT") {
          if (
            !Array.from(
              dom.window.document.head.querySelectorAll("script")
            ).some(
              (script) =>
                (script.id && script.id === child.id) ||
                (script.src && script.src === child.src)
            )
          ) {
            dom.window.document.head.appendChild(child);
          }
        } else if (child.tagName === "STYLE") {
          if (
            !Array.from(
              dom.window.document.head.querySelectorAll("style")
            ).some((style) => style.textContent === child.textContent)
          ) {
            dom.window.document.head.appendChild(child);
          }
        } else {
          dom.window.document.head.appendChild(child);
        }
      });

      importedElement.replaceWith(...importDom.window.document.body.childNodes);
      await applyImportsToDom(importDom, data, renderingOptions);
    }
  }
}

async function applyGlobalsToDom(dom, data, renderingOptions) {
  const globalRendering = await renderingOptions.renderComponent(
    "/global",
    data,
    { ...renderingOptions, descendant: true }
  );

  const globalDom = new JSDOM(globalRendering);

  const childrenSlots =
    globalDom.window.document.querySelectorAll("slot:not([name])");

  for (const childrenSlot of childrenSlots) {
    childrenSlot.replaceWith(...dom.window.document.body.childNodes);
  }

  globalDom.window.document.head.append(...dom.window.document.head.children);

  dom.window.document.body.innerHTML = globalDom.window.document.body.innerHTML;
  dom.window.document.head.innerHTML = globalDom.window.document.head.innerHTML;
}

async function applyPluginsToDom(dom) {
  const metaTailwind = dom.window.document.querySelector(
    "meta[itemprop=tailwind]"
  );

  if (!metaTailwind || metaTailwind.getAttribute("content") === "true") {
    const metaTailwindPreflight = dom.window.document.querySelector(
      "meta[itemprop=tailwind-preflight]"
    );

    const preset =
      !metaTailwindPreflight ||
      metaTailwindPreflight.getAttribute("content") === "true"
        ? {}
        : {
            corePlugins: {
              preflight: false,
            },
          };

    const css = await postcss([
      tailwindcss({
        presets: [preset],
        content: [{ raw: dom.serialize() }],
      }),
    ]).process(tailwindCssAtRules);

    const style = dom.window.document.createElement("style");
    style.textContent = css;
    dom.window.document.head.appendChild(style);

    if (metaTailwindPreflight) {
      metaTailwindPreflight.remove();
    }
  }

  if (metaTailwind) {
    metaTailwind.remove();
  }
}

async function applyScriptToDom(dom, enhancements, componentId, componentData) {
  if (!dom.window[componentId]) {
    const compiledScript = typescript.transpileModule(enhancements, {
      compilerOptions: { module: typescript.ModuleKind.None },
    });

    if (compiledScript.outputText) {
      const scriptElement = dom.window.document.createElement("script");

      scriptElement.id = componentId;

      const minifiedScript = await minify(`
globalThis.ViewScript = globalThis.ViewScript || { components: {} };
globalThis.ViewScript.components["${componentId}"] = {};
(function (exports) { ${compiledScript.outputText} })(
globalThis.ViewScript.components["${componentId}"]
);`);

      scriptElement.textContent = minifiedScript.code;
      dom.window.document.head.appendChild(scriptElement);
    }
  }

  const scriptElement = dom.window.document.createElement("script");
  const scriptData = JSON.stringify(componentData);

  const minifiedScript = await minify(`
addEventListener("load", function () {
new (globalThis.ViewScript.components["${componentId}"].default)(${scriptData});
});`);

  scriptElement.textContent = minifiedScript.code;
  scriptElement.className = componentId;
  dom.window.document.head.appendChild(scriptElement);
}

exports.getComponentFromFs = async function getComponentFromFs(
  componentPath,
  options = {}
) {
  const { basePath = "", currentPath = "", cacheOptions = {} } = options;

  if (!cacheOptions.disabled) {
    const cachedComponent = getComponentFromFsCache.get(componentPath);

    if (cachedComponent) {
      console.log(
        `[viewscript-server] getComponentFromFs ${componentPath} from cache`
      );

      return cachedComponent;
    }
  }

  const relativePath = componentPath.startsWith("/") ? basePath : currentPath;

  const settledComponentPath = componentPath.startsWith("/")
    ? componentPath.slice(1)
    : componentPath;

  const templateFilePath = resolve(
    relativePath,
    `${settledComponentPath}.html`
  );

  const scriptFilePath = resolve(relativePath, `${settledComponentPath}.ts`);
  const settingsFilePath = resolve(
    relativePath,
    `${settledComponentPath}.yaml`
  );

  const [componentTemplate, componentScript, componentSettingsRaw] =
    await Promise.all([
      readFile(templateFilePath, "utf8"),
      readFile(scriptFilePath, "utf8").catch(() => undefined),
      readFile(settingsFilePath, "utf8").catch(() => undefined),
    ]);

  const componentSettings =
    componentSettingsRaw && YAML.parse(componentSettingsRaw);

  const component = {
    componentTemplate,
    componentScript,
    componentSettings,
  };

  if (!cacheOptions.disabled) {
    getComponentFromFsCache.set(componentPath, component);
  }

  console.log(
    `[viewscript-server] getComponentFromFs ${componentPath} from disk`
  );

  return component;
};

exports.renderComponent = async function renderComponent(
  componentUri,
  customContext,
  renderingOptions
) {
  let componentMetadata = renderComponentCache.get(componentUri);

  if (!componentMetadata) {
    componentMetadata = {
      componentId: randomUUID(),
    };

    renderComponentCache.set(componentUri, componentMetadata);
  }

  const {
    componentTemplate,
    componentSettings = { context: {} },
    componentScript,
  } = await renderingOptions.getComponent(
    componentUri,
    renderingOptions.getComponentOptions // TODO Pass in currentPath here
  );

  const componentDom = new JSDOM(componentTemplate);

  const componentDataWithId = {
    id: randomUUID(),
    ...structuredClone(componentSettings.context),
    ...customContext,
  };

  const componentContext = {
    ...renderingOptions,
    componentSettings,
    renderComponent,
  };

  applyDataToDomElement(
    componentDom.window.document,
    componentDataWithId,
    componentContext
  );

  await applyImportsToDom(componentDom, componentDataWithId, componentContext);

  if (!renderingOptions.descendant) {
    await applyGlobalsToDom(
      componentDom,
      componentDataWithId,
      componentContext
    );

    await applyPluginsToDom(componentDom);

    if (!componentDom.window.document.querySelector("meta[charset]")) {
      const metaCharset = componentDom.window.document.createElement("meta");
      metaCharset.setAttribute("charset", "utf-8");
      componentDom.window.document.head.appendChild(metaCharset);
    }

    if (!componentDom.window.document.querySelector("meta[name=viewport]")) {
      const metaViewport = componentDom.window.document.createElement("meta");
      metaViewport.setAttribute("name", "viewport");
      metaViewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1"
      );
      componentDom.window.document.head.appendChild(metaViewport);
    }
  }

  if (componentScript) {
    await applyScriptToDom(
      componentDom,
      componentScript,
      componentMetadata.componentId,
      componentDataWithId
    );
  }

  const serializedDom = componentDom.serialize();

  console.log(
    `[viewscript-server] renderComponent    ${componentUri} with`,
    customContext
  );

  return serializedDom;
};
