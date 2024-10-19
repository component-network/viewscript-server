# ViewScript Server

**ViewScript** is a superset of HTML for building web apps. It can be used for content management, static site generation, and server-side rendering.

**ViewScript Server** is a package you can use to build a web app with Node.js and ViewScript code.

## How to Use

### Installation

```bash
npm i viewscript-server
```

### Example Usage

Rendering HTML in a Node.js app:

`components/Parts/Details/template.html`

```html
<details open class="bg-white border border-gray-500 border-solid h-auto p-2 rounded-lg shadow-md">
  <summary class="cursor-pointer font-bold overflow-hidden select-none text-ellipsis whitespace-nowrap">
    <slot name="summary">{ Summary }</slot>
  </summary>
  <slot>{ Children }</slot>
</details>
```

Please note, the "curly braces" in a slot's content have no special meaning in ViewScript. They are just stylized placeholder text for these examples.

Whatever value is provided for a slot's content will be shown only if no value is provided to the component via its settings, attributes, or child nodes.

`components/Parts/Details/settings.yaml`

```yaml
data: {}
imports: {}
plugins:
  tailwindcss: {}
```

`components/Pages/Index/template.html`

```html
<Details summary="This is a summary of the content">
  This is the content being summarized:
  <slot name="custom-content">{ Custom Content }</slot>
</Details>
```

`components/Pages/Index/settings.yaml`

```yaml
data:
  custom-content: As a content manager, I want this content to take precedence, and it does!
imports:
  Details: Parts/Details
plugins:
  tailwindcss: {}
```

`main.ts`

```ts
import { getComponentFromFs, renderComponent } from "viewscript-ssr";

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
    "custom-content": "As a API developer, I want this content to take precedence, and it does!"
  };

  return renderComponent("Pages/Index", customData, renderingContext);
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
npm link viewscript-ssr
```

## Publishing to NPM

First, manually update the version in package.json to an appropriate value.

Then, manually publish the package to NPM:

```bash
npm publish
```
