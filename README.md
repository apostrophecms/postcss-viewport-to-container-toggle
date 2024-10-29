# postcss-copy-viewport-to-container-units

A plugin for [PostCSS](https://github.com/postcss/postcss) that copies viewport units like `vw` and `vh` to container units like `cqw` and `cqh` in a specific selector.

## Demo

This css:

```css
.hello {
    width: 100vw;
    height: 100vh;
}
``````

If you set the selector to `body[data-breakpoint-preview-mode]`, it'll be converted this way:

```css
.hello {
    width: 100vw;
    height: 100vh;
}

:where(body[data-breakpoint-preview-mode]) .hello {
    width: 100cqw;
    height: 100cqh;
}
```

The purpose being here to keep the existing behavior but to make the code work when body is in container mode.

## Installation

```bash
npm install -D postcss-viewport-to-container-units
```

## Getting started

TODO: Explain how to configure with webpack and vite.
