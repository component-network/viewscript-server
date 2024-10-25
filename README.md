# ViewScript Server

**ViewScript Server** is a Node.js module that renders components written in HTML, with a little extra magic.

Each ViewScript component has an URN, a Unique Resource Name, which may be
- its file system path, relative to the base path, with path separators replaced by underscores
- its database UUID
- its database namespaced name

Each ViewScript component may have a companion Settings YAML document, with a schema, imports, and plugins.

For example:

```yaml
schema:
  favicon:
    href: string
  auth:
    href: string
    username?: string
  search: string
  components:
    - href: string
      hrefRender: string
      scopedName: string
  page:
    current:
      caption: string
    next?:
      caption: string
      href: string
    previous?:
      caption: string
      href: string
imports:
  custom-button: reusable/custom-button
  custom-details: reusable/custom-details
  route-layout: reusable/route-layout
plugins:
  tailwindcss:
    corePlugins:
      preflight: false
```
