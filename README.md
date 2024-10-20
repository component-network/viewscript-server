# ViewScript Server

**ViewScript Server** is a package you can use to build a web app with Node.js and ViewScript code.

## What is ViewScript?

**ViewScript** is a superset of HTML for building web apps with components. It can be used for content management, static site generation, and server-side rendering.

ViewScript is inspired by ideas from web components and Vue.js.

It uses [`jsdom`](https://github.com/jsdom/jsdom) to parse and serialize ViewScript HTML templates. JSDOM provides a simulated DOM API that runs in Node.js.

It uses [`yaml`](https://github.com/eemeli/yaml) to parse ViewScript YAML settings. YAML is a superset of JSON that many people prefer to use for configuration files.

It uses [`postcss`](https://github.com/postcss/postcss) and [`tailwindcss`](https://github.com/tailwindlabs/tailwindcss) to support Tailwind CSS as an optional plugin.

## How to Use

### Installation

```bash
npm i viewscript-server
```

### Example Usage

Rendering HTML in a Node.js app:

`components/parts/details/settings.yaml`

```yaml
data: {}
imports: {}
plugins:
  tailwindcss: {}
```

`components/parts/details/template.html`

```html
<details
  open
  class="bg-white border border-gray-500 border-solid h-auto p-2 rounded-lg shadow-md"
>
  <summary
    class="cursor-pointer font-bold overflow-hidden select-none text-ellipsis whitespace-nowrap"
  >
    <slot name="summary">{ Summary }</slot>
  </summary>
  <slot>{ Children }</slot>
</details>
```

The "curly braces" in a slot's content have no special meaning in ViewScript. They are just stylized placeholder text for these examples. Whatever value is provided for a slot's content will be shown only if no value is provided to the component via its settings, attributes, or child nodes.

`components/pages/index/settings.yaml`

```yaml
data:
  custom-content: As a content manager, I want this content to take precedence, and it does!
imports:
  custom-details: parts/details
plugins:
  tailwindcss: {}
```

`components/pages/index/template.html`

```html
<custom-details summary="This is a summary of the content">
  This is the content being summarized:
  <slot name="custom-content">{ Custom Content }</slot>
</custom-details>
```

`main.ts`

```ts
import { getComponentFromFs, renderComponent } from "viewscript-server";

const renderingContext = {
  getComponent: getComponentFromFs,
  getComponentOptions: {
    baseDir: "components",
    cacheOptions: {
      enabled: true,
    },
  },
};

export function getIndexPage(request) {
  const customData = {
    "custom-content":
      "As a API developer, I want this content to take precedence, and it does!",
  };

  return renderComponent("pages/index", customData, renderingContext);
}
```

## How to Develop

### Install NPM Dependencies

First, install Node.js 20 or higher. Then, clone this repository, and install NPM dependencies:

```bash
npm ci
```

### Linking for Local Development

Link this package locally, so you can install it in another local package for development purposes.

First, in the root of this repository:

```bash
npm link
```

Then, in the root of another repository:

```bash
npm link viewscript-server
```

## Publishing to NPM

First, manually update the version in package.json to an appropriate value.

Then, manually publish the package to NPM:

```bash
npm publish
```
