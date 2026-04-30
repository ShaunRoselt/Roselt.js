# Roselt.js

Roselt.js is a vanilla JavaScript framework for building routed web apps with real HTML, persistent shell sections, and file-based organization.

- **File-based pages:** Map routes directly to `pages/` files, with optional same-name JavaScript and CSS sidecars.
- **Persistent shell:** Keep headers, sidebars, footers, and shared UI mounted with `roselt section="..."`.
- **Platform-first runtime:** Use HTML, CSS, custom elements, and the browser Navigation API instead of a heavyweight client runtime.

Learn more at [www.roseltjs.org](https://www.roseltjs.org/).

## Installation

Roselt.js is designed for gradual adoption, so you can start with the workflow that matches your project:

- Scaffold a new app with `npm create roselt-js@latest my-app`
- Install the package into an existing setup with `npm install roselt-js`
- Use the prebuilt browser global from `dist/roselt.js`

The recommended way to start a new project is:

```bash
npm create roselt-js@latest my-app
cd my-app
npm install
npm run dev
```

If you want the CLI directly, this works too:

```bash
npx roselt-js create my-app
```

Generated apps include a starter shell, a `home` route, a `404` route, and a local development server powered by `roselt serve`.

## Documentation

You can find the Roselt.js documentation [on the website](https://www.roseltjs.org/).

Start with [Getting Started](https://www.roseltjs.org/?page=docs/getting-started) for a quick overview.

The documentation is divided into several sections:

- [Getting Started](https://www.roseltjs.org/?page=docs/getting-started)
- [Installation](https://www.roseltjs.org/?page=docs/installation)
- [Project Structure](https://www.roseltjs.org/?page=docs/project-structure)
- [Routing and Navigation](https://www.roseltjs.org/?page=docs/routing)
- [Pages](https://www.roseltjs.org/?page=docs/pages)
- [Sections](https://www.roseltjs.org/?page=docs/sections)
- [Components](https://www.roseltjs.org/?page=docs/components)
- [Metadata and SEO](https://www.roseltjs.org/?page=docs/metadata-seo)
- [API Reference](https://www.roseltjs.org/?page=docs/api-reference)
- [FAQ](https://www.roseltjs.org/?page=docs/faq)

## Example

Here is the smallest Roselt.js app shape:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Roselt App</title>
  </head>
  <body>
    <roselt page="home" navigate></roselt>

    <script src="https://cdn.jsdelivr.net/gh/ShaunRoselt/Roselt.js@main/dist/roselt.js"></script>
    <script>
      window.Roselt.start();
    </script>
  </body>
</html>
```

Then create the first routed page:

```html
<!-- pages/home.html -->
<section>
  <h1>Home</h1>
  <p>Roselt.js rendered this page from pages/home.html.</p>
  <a href="?page=about">About</a>
</section>
```

Then add the page it links to:

```html
<!-- pages/about.html -->
<section>
  <h1>About</h1>
  <p>This page was rendered from pages/about.html.</p>
  <a href="?page=home">Back home</a>
</section>
```

For the default query router, a normal anchor such as `<a href="?page=about">About</a>` is enough to move between pages.

If you want to trigger navigation from JavaScript instead, Roselt also exposes:

```js
Roselt.navigate("about");
```


## Project layout

Most Roselt.js apps follow this structure:

```text
index.html
pages/
  home.html
  home.js
  home.css
  docs/getting-started.html
sections/
  site-header.html
  site-header.js
  site-header.css
  site-footer.html
components/
  ui-button.js
```

The default start path requires a `roselt[page]` element marked with `navigate`. If a document contains multiple `roselt[page]` elements, Roselt uses the one marked with `navigate` as the routed page root.

## Examples

This repository includes working examples you can inspect directly:

- `examples/starter-app/` is the official starter template used by `npm create roselt-js`
- `packages/create-roselt-js/` contains the `npm create` entry point

## Contributing

The main purpose of this repository is to keep evolving Roselt.js as a small, platform-first app framework for modern browsers.

To work on the repository locally:

```bash
npm install
npm run build
npm run check
npm run serve
```

Then open `/docs/` locally for the public documentation site, or inspect the example apps under `/examples/`.

Roselt ships ES2022 output and currently targets the latest browsers with Navigation API support.

## License

Roselt.js is [MIT licensed](./LICENSE).
