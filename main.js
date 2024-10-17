const { JSDOM } = require("jsdom");
const { render } = require("mustache");

exports.renderComponent = async function renderComponent(
  context,
  componentUri,
  dataAsJson
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
          context,
          importDir,
          attributes
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
