const { readFile } = require("fs/promises");
const { resolve } = require("path");
const { JSDOM } = require("jsdom");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");
const YAML = require("yaml");

const getComponentFromFsCache = new Map();

const tailwindCssAtRules =
  "@tailwind base; @tailwind components; @tailwind utilities;";

function setupComponentData(data, when) {
  if (data.style && typeof data.style === "string") {
    data.style = data.style.split(";").reduce((acc, style) => {
      const [key, value] = style.split(":").map((s) => s.trim());
      acc[key] = value;
      return acc;
    }, {});
  }

  if (when) {
    Object.entries(when).forEach(([conditionalKey, conditionalValue]) => {
      Object.entries(conditionalValue).forEach(([dataKey, dataValue]) => {
        const condition = getNestedValue(data, conditionalKey);
        if (condition) {
          if (dataKey === "style") {
            Object.entries(dataValue).forEach(([styleKey, styleValue]) => {
              data.style[styleKey] = styleValue;
            });
          } else {
            data[dataKey] = dataValue;
          }
        }
      });
    });
  }

  if (data.style && typeof data.style === "object") {
    data.style = Object.entries(data.style)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; ");
  }

  return data;
}

function applyDataToDomElement(domElement, data, context) {
  // Rubber-stamp elements with a use-for attribute
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

      applyDataToDomElement(clonedElement, clonedElementData, context);
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
  applyDataToDomElementAttributes(domElement, data, context);
}

function applyDataToDomElementAttributes(domElement, data, context) {
  const isImportedElement = Object.keys(context.componentSettings.imports).some(
    (importKey) => importKey.toUpperCase() === domElement.tagName
  );

  const attributes = Array.from(domElement.attributes || []);

  for (const attribute of attributes) {
    if (attribute.name.startsWith(":")) {
      const targetAttributeName = attribute.name.slice(1);

      const targetAttributeValue = attribute.value.startsWith("!")
        ? !getNestedValue(data, attribute.value.slice(1))
        : getNestedValue(data, attribute.value);

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
    applyDataToDomElementAttributes(child, data, context);
  }
}

function getNestedValue(obj, path) {
  return path?.split(".").reduce((acc, key) => acc?.[key], obj);
}

async function applyImportsToDomElement(domElement, context) {
  for (const importKey in context.componentSettings.imports) {
    const importUri = context.componentSettings.imports[importKey];

    const importedElements = domElement.querySelectorAll(
      importKey.toLowerCase()
    );

    for (const importedElement of importedElements) {
      const importAttributes = Array.from(importedElement.attributes).reduce(
        (result, attribute) => {
          result[attribute.name] = JSON.parse(attribute.value);
          return result;
        },
        {}
      );

      const importRendering = await context.renderComponent(
        importUri,
        importAttributes,
        context
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

      domElement.head.append(...importDom.window.document.head.childNodes);
      importedElement.replaceWith(...importDom.window.document.body.childNodes);
      await applyImportsToDomElement(importDom.window.document.body, context);
    }
  }
}

exports.getComponentFromFs = async function getComponentFromFs(
  componentDir,
  options = {}
) {
  const { baseDir = "", cacheOptions = {} } = options;

  if (cacheOptions.enabled) {
    const cachedComponent = getComponentFromFsCache.get(componentDir);

    if (cachedComponent) {
      console.log(
        `[viewscript-server] getComponentFromFs ${componentDir} from cache`
      );

      return cachedComponent;
    }

    console.log(
      `[viewscript-server] getComponentFromFs ${componentDir} from disk`
    );
  }

  const templateFilePath = resolve(baseDir, componentDir, "template.html");
  const settingsFilePath = resolve(baseDir, componentDir, "settings.yaml");

  const [componentTemplate, componentSettingsSource] = await Promise.all([
    readFile(templateFilePath, "utf8"),
    readFile(settingsFilePath, "utf8"),
  ]);

  const componentSettings = YAML.parse(componentSettingsSource);
  const component = { componentSettings, componentTemplate };

  if (cacheOptions.enabled) {
    getComponentFromFsCache.set(componentDir, component);
  }

  return component;
};

exports.renderComponent = async function renderComponent(
  componentUri,
  customData,
  context
) {
  const { componentSettings, componentTemplate } = await context.getComponent(
    componentUri,
    context.getComponentOptions
  );

  console.log(
    `[viewscript-server] renderComponent    ${componentUri} with`,
    customData
  );

  const componentDom = new JSDOM(componentTemplate);

  const baseData = {
    ...structuredClone(componentSettings.data),
    ...customData,
  };

  const componentData = setupComponentData(baseData, componentSettings.when);

  const componentContext = {
    ...context,
    renderComponent,
    componentSettings,
  };

  applyDataToDomElement(
    componentDom.window.document,
    componentData,
    componentContext
  );

  await applyImportsToDomElement(
    componentDom.window.document,
    componentContext
  );

  if (componentSettings.plugins.tailwindcss) {
    const css = await postcss([
      tailwindcss({
        presets: [componentSettings.plugins.tailwindcss],
        content: [{ raw: componentDom.serialize() }],
      }),
    ]).process(tailwindCssAtRules);

    const style = componentDom.window.document.createElement("style");
    style.textContent = css;

    componentDom.window.document.head.appendChild(style);
  }

  const serializedDom = componentDom.serialize();

  return serializedDom;
};

// TODO When loading scripts (main.ts in each component folder)...
// TODO Generate an id, and pass it to the template and this class' constructor.
// TODO Wrap the class instantiation in document.addEventListener("DOMContentLoaded", () => { ... })
