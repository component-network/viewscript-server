const { readFile } = require("fs/promises");
const { resolve } = require("path");
const { JSDOM } = require("jsdom");
const { render } = require("mustache");
const YAML = require("yaml");

const componentFsCache = new Map();

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
  dataAsJson,
  context
) {
  const { componentSettings, componentTemplate } = await context.getComponent(
    componentUri,
    context.getComponentOptions
  );

  const componentData =
    componentSettings.data && typeof componentSettings.data === "object"
      ? componentSettings.data
      : {};

  const componentRendering = render(componentTemplate, {
    ...componentData,
    ...dataAsJson,
  });

  const rootDom = new JSDOM(componentRendering);

  await (async function interpolate(children) {
    for (const child of children) {
      await interpolate(child.children);

      const tagName = child.tagName.toLowerCase();

      const componentImports =
        componentSettings.imports &&
        typeof componentSettings.imports === "object"
          ? componentSettings.imports
          : {};

      const importKeys = Object.keys(componentImports);

      const matchingImportKey = importKeys.find(
        (importKey) => importKey.toLowerCase() === tagName
      );

      if (matchingImportKey) {
        const attributes = Array.from(child.attributes).reduce(
          (result, attribute) => {
            result[attribute.name] = attribute.value;
            return result;
          },
          {}
        );

        const importDir =
          typeof componentImports[matchingImportKey] === "string"
            ? componentImports[matchingImportKey]
            : String(componentImports[matchingImportKey]);

        const importRendering = await renderComponent(
          importDir,
          attributes,
          context
        );

        const importDom = new JSDOM(importRendering);
        const slots = importDom.window.document.querySelectorAll("slot");

        for (const slot of slots) {
          if (slot.getAttribute("name") === "children") {
            slot.replaceWith(...child.childNodes);
          } else {
            const matchingChild = Array.from(child.children).find(
              (child) =>
                child.getAttribute("slot") === slot.getAttribute("name")
            );

            if (matchingChild) {
              slot.replaceWith(matchingChild);
            }
          }
        }

        await interpolate(importDom.window.document.body.children);

        child.replaceWith(...importDom.window.document.body.childNodes);
      }
    }
  })(rootDom.window.document.documentElement.children);

  const serializedDom = rootDom.serialize();

  return serializedDom;
};
