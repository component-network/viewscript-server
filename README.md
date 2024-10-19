# ViewScript SSR

ViewScript Server-Side Rendering

## How to Use

### Installation

```bash
npm i viewscript-ssr
```

### Example Usage

Rendering HTML in a Node.js app:

`components/Pages/Index/template.html`

```html
<Heading>
  <slot name="name">
    (Name Goes Here)
  </slot>
</Heading>
```

`components/Pages/Index/settings.yaml`

```yaml
data:
  name: A Custom Default Name
imports:
  Heading: Atoms/Heading
plugins:
  tailwindcss: {}
```

`components/Atoms/Heading/template.html`

```html
<p class="font-mono text-lg">
  Hello, <slot>
    (Children Go Here)
  </slot>!
</p>
```

`components/Atoms/Heading/settings.yaml`

```yaml
data: {}
imports: {}
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
    name: request.query.name,
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
