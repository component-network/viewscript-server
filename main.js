const { readFile } = require("fs/promises");
const { resolve } = require("path");
const { JSDOM } = require("jsdom");
const YAML = require("yaml");

const componentFsCache = new Map();

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

      if (slotData != null) {
        slot.replaceWith(slotData);
      }
    }
  }

  // Replace colon-prefixed attributes using the given data
  applyDataToDomElementAttributes(domElement, data, context);
}

function applyDataToDomElementAttributes(domElement, data, context) {
  const attributes = Array.from(domElement.attributes || []);

  for (const attribute of attributes) {
    if (attribute.name.startsWith(":")) {
      const targetAttributeName = attribute.name.slice(1);
      const targetAttributeValue = getNestedValue(data, attribute.value);

      const targetAttributeValueSerialized = Object.keys(
        context.componentSettings.imports
      ).some((importKey) => importKey.toUpperCase() === domElement.tagName)
        ? JSON.stringify(targetAttributeValue)
        : targetAttributeValue;

      if (targetAttributeValueSerialized != null) {
        domElement.setAttribute(
          targetAttributeName,
          targetAttributeValueSerialized
        );
      }

      domElement.removeAttribute(attribute.name);
    }
  }

  for (const child of domElement.children) {
    applyDataToDomElementAttributes(child, data, context);
  }
}

function getNestedValue(obj, path) {
  return path?.split(".").reduce((acc, key) => acc?.[key], obj);
}

async function applyImportsToDomChildren(children, context) {
  for (const child of children) {
    await applyImportsToDomChildren(child.children, context);

    const matchingImportKey = Object.keys(
      context.componentSettings.imports
    ).find((importKey) => importKey.toUpperCase() === child.tagName);

    if (matchingImportKey) {
      const attributes = Array.from(child.attributes).reduce(
        (result, attribute) => {
          result[attribute.name] = JSON.parse(attribute.value);
          return result;
        },
        {}
      );

      const importDir =
        typeof context.componentSettings.imports[matchingImportKey] === "string"
          ? context.componentSettings.imports[matchingImportKey]
          : String(context.componentSettings.imports[matchingImportKey]);

      const importRendering = await context.renderComponent(
        importDir,
        attributes,
        context
      );

      const importDom = new JSDOM(importRendering);
      const slots = importDom.window.document.querySelectorAll("slot");

      for (const slot of slots) {
        if (slot.hasAttribute("name")) {
          const matchingChild = Array.from(child.children).find(
            (child) => child.getAttribute("slot") === slot.getAttribute("name")
          );

          if (matchingChild) {
            slot.replaceWith(matchingChild);
          }
        } else {
          slot.replaceWith(...child.childNodes);
        }
      }

      await applyImportsToDomChildren(
        importDom.window.document.body.children,
        context
      );

      child.replaceWith(...importDom.window.document.body.childNodes);
    }
  }
}

exports.getComponentFromFs = async function getComponentFromFs(
  componentDir,
  options = {}
) {
  const { baseDir = "", cacheOptions = {} } = options;

  if (cacheOptions.enabled) {
    const cachedComponent = componentFsCache.get(componentDir);

    if (cachedComponent) {
      console.log(
        "[viewscript-ssr] getComponentFromFs cache hit  for",
        componentDir
      );

      return cachedComponent;
    }

    console.log(
      "[viewscript-ssr] getComponentFromFs cache miss for",
      componentDir
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
    componentFsCache.set(componentDir, component);
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

  const componentDom = new JSDOM(componentTemplate);

  const componentDomData = {
    ...componentSettings.data,
    ...customData,
  };

  const componentContext = {
    ...context,
    renderComponent,
    componentSettings,
  };

  applyDataToDomElement(
    componentDom.window.document,
    componentDomData,
    componentContext
  );

  await applyImportsToDomChildren(
    componentDom.window.document.documentElement.children,
    componentContext
  );

  // TODO Each imported component should render in a template with a shadow root
  // TODO Refactor component imports to use document.querySelectorAll instead of DFS

  // TODO Apply Tailwind CSS using PostCSS, if the tailwindcss plugin is enabled
  // TODO Support dot class name syntax

  const serializedDom = componentDom.serialize();

  return serializedDom;
};
