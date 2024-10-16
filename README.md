# viewscript-ssr

ViewScript Server-Side Rendering package

## Purpose

This package uses a provided `getComponent` resolver function to render a ViewScript component, using the provided JSON data.

A ViewScript component consists of two parts, a string `componentTemplate`, and a JSON object `componentSettings` with optional default data and component imports.

## Prerequisites

### Install NPM Dependencies

First, install Node.js 20 or higher. Then, install NPM dependencies:

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
