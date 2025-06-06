const postcss = require('postcss');
const cssnano = require('cssnano');
const { equal, deepEqual } = require('node:assert');
const plugin = require('../index.js');
const opts = { modifierAttr: 'data-breakpoint-preview-mode' };

let currentFileName = '';

// Hook into Mocha's test context
beforeEach(function() {
  currentFileName = this.currentTest.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
});

async function formatCSS(css) {
  const result = await postcss([ cssnano({ preset: 'default' }) ])
    .process(css, {
      from: `${currentFileName}_formatted.css`
    });
  return result.css.trim();
}

// Enhanced run helper with detailed output on failure
async function run(plugin, input, output, opts = {}) {
  const result = await postcss([ plugin(opts) ])
    .process(input, {
      from: `${currentFileName}.css`
    });

  try {
    // Normalize both expected and actual CSS before comparison
    const formattedResult = await formatCSS(result.css);
    const formattedOutput = await formatCSS(output);

    equal(formattedResult, formattedOutput);
    deepEqual(result.warnings(), []);
  } catch (error) {
    console.log('\n=== Test Failed ===');
    console.log('Input:');
    console.log(input);
    console.log('\nExpected Output (Formatted):');
    console.log(output);
    console.log('\nActual Output:');
    console.log(result.css);

    throw error;
  }
}

describe('postcss-viewport-to-container-toggle additional features', () => {
  // Typography-related tests
  describe('typography features', () => {
    it('should convert viewport units in typography-related properties', async () => {
      const input = `
.text {
  font-size: calc(16px + 2vw);
  line-height: calc(1.5 + 1vh);
  letter-spacing: 0.5vmin;
}`;
      const output = `
.text {
  font-size: calc(16px + 2vw);
  line-height: calc(1.5 + 1vh);
  letter-spacing: 0.5vmin;
}
[data-apos-refreshable-body] .text,
[data-apos-refreshable-body].text {
  font-size: calc(16px + 2cqw);
  line-height: calc(1.5 + 1cqh);
  letter-spacing: 0.5cqi;
}
`;

      await run(plugin, input, output, opts);
    });

    it('should handle clamp expressions in typography', async () => {
      const input = `
.fluid-text {
  font-size: clamp(1rem, 2vw + 1rem, 3rem);
  line-height: clamp(1.2, calc(1 + 2vh), 1.8);
}`;
      const output = `
.fluid-text {
  font-size: clamp(1rem, 2vw + 1rem, 3rem);
  line-height: clamp(1.2, calc(1 + 2vh), 1.8);
}
[data-apos-refreshable-body] .fluid-text,
[data-apos-refreshable-body].fluid-text {
  font-size: clamp(1rem, 1rem + 2cqw, 3rem);
  line-height: clamp(1.2, calc(1 + 2cqh), 1.8);
}`;

      await run(plugin, input, output, opts);
    });

    it('should ignore non-typography properties', async () => {
      const input = `
.foo {
  color: red;
  font-size: 2vw;
}`;
      const output = `
.foo {
  color: red;
  font-size: 2vw;
}
[data-apos-refreshable-body] .foo,
[data-apos-refreshable-body].foo {
  color: red;
  font-size: 2cqw;
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle decimal viewport values in typography', async () => {
      const input = `
.decimals {
  font-size: 2.75vw;
}`;
      const output = `
.decimals {
  font-size: 2.75vw;
}
[data-apos-refreshable-body] .decimals,
[data-apos-refreshable-body].decimals {
  font-size: 2.75cqw;
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle zero values in typography (should remain zero)', async () => {
      const input = `
.zero-test {
  font-size: 0vw;
}`;
      const output = `
.zero-test {
  font-size: 0vw;
}
[data-apos-refreshable-body] .zero-test,
[data-apos-refreshable-body].zero-test{
  font-size: 0cqw;
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle clamp with multiple arguments including nested calc', async () => {
      const input = `
.nested-calc {
  font-size: clamp(1rem, calc(50vw - 2rem), calc(100vh - 4rem));
}`;
      const output = `
.nested-calc {
  font-size: clamp(1rem, calc(50vw - 2rem), calc(100vh - 4rem));
}
[data-apos-refreshable-body] .nested-calc,
[data-apos-refreshable-body].nested-calc {
  font-size: clamp(1rem, calc(50cqw - 2rem), calc(100cqh - 4rem));
}`;

      await run(plugin, input, output, opts);
    });
  });

  // Fixed position tests
  describe('fixed position handling', () => {
    it('should convert fixed position elements to use container queries', async () => {
      const input = `
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 60px;
}`;
      const output = `
body[data-breakpoint-preview-mode] {
  position: relative;
  contain: layout;
}
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 60px;
}
[data-apos-refreshable-body] .fixed-header,
[data-apos-refreshable-body].fixed-header {
  position: sticky;
  --container-top: 0;
  top: var(--container-top);
  --container-left: 0;
  left: var(--container-left);
  width: 100cqw;
  height: 60px;
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle fixed positioning within media queries', async () => {
      const input = `
@media (min-width: 768px) {
  .fixed-in-media {
    position: fixed;
    top: 0;
    width: 100vw;
  }
}`;
      const output = `
body[data-breakpoint-preview-mode] {
  position: relative;
  contain: layout;
}
@media (min-width: 768px) {
  body:not([data-breakpoint-preview-mode]) .fixed-in-media,
  body:not([data-breakpoint-preview-mode]).fixed-in-media {
    position: fixed;
    top: 0;
    width: 100vw;
  }
}
@container (min-width: 768px) {
  .fixed-in-media {
    position: sticky;
    --container-top: 0;
    top: var(--container-top);
    width: 100cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });
  });

  // Dynamic viewport units
  describe('dynamic viewport units', () => {
    it('should convert dynamic viewport units to container units', async () => {
      const input = `
.dynamic {
  height: 100dvh;
  width: 100dvw;
  min-height: 100svh;
  max-width: 100lvw;
}`;
      const output = `
.dynamic {
  height: 100dvh;
  width: 100dvw;
  min-height: 100svh;
  max-width: 100lvw;
}
[data-apos-refreshable-body] .dynamic,
[data-apos-refreshable-body].dynamic {
  height: 100cqh;
  width: 100cqw;
  min-height: 100cqh;
  max-width: 100cqw;
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle complex calc expressions with multiple viewport units', async () => {
      const input = `
.complex {
  margin: calc(10px + 2vw - 1vh);
  padding: calc((100vw - 20px) / 2 + 1vmin);
}`;
      const output = `
.complex {
  margin: calc(10px + 2vw - 1vh);
  padding: calc((100vw - 20px) / 2 + 1vmin);
}
[data-apos-refreshable-body] .complex,
[data-apos-refreshable-body].complex {
  margin: calc(10px + 2cqw - 1cqh);
  padding: calc((100cqw - 20px) / 2 + 1cqmin);
}`;

      await run(plugin, input, output, opts);
    });
  });

  // Simple media queries
  describe('simple media query conversions', () => {
    it('should handle `<=` operator media queries', async () => {
      const input = `
@media (width <= 1024px) {
  .single-operator {
    width: 100vw;
  }
}`;
      const output = `
@media (width <= 1024px) {
  body:not([data-breakpoint-preview-mode]) .single-operator,
  body:not([data-breakpoint-preview-mode]).single-operator {
    width: 100vw;
  }
}
@container (max-width: 1024px) {
  .single-operator {
    width: 100cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle `>=` operator media queries', async () => {
      const input = `
@media (width >= 240px) {
  .single-operator {
    width: 100vw;
  }
}`;
      const output = `
@media (width >= 240px) {
  body:not([data-breakpoint-preview-mode]) .single-operator,
  body:not([data-breakpoint-preview-mode]).single-operator {
    width: 100vw;
  }
}
@container (min-width: 240px) {
  .single-operator {
    width: 100cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle poorly formatted media queries', async () => {
      const input = `
@media (width<=1024px) {
  .poorly-formatted {
    width: 100vw;
  }
}`;
      const output = `
@media (width<=1024px) {
  body:not([data-breakpoint-preview-mode]) .poorly-formatted,
  body:not([data-breakpoint-preview-mode]).poorly-formatted {
    width: 100vw;
  }
}
@container (max-width: 1024px) {
  .poorly-formatted {
    width: 100cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle media queries with combined range and logical operators', async () => {
      const input = `
@media (min-width: 500px) and (width<=1024px) {
  .combined-operator {
    width: 90vw;
    margin: 0 5vw;
  }
}`;
      const output = `
@media (min-width: 500px) and (width<=1024px) {
  body:not([data-breakpoint-preview-mode]) .combined-operator,
  body:not([data-breakpoint-preview-mode]).combined-operator {
    width: 90vw;
    margin: 0 5vw;
  }
}
@container (min-width: 500px) and (max-width: 1024px) {
  .combined-operator {
    width: 90cqw;
    margin: 0 5cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });
  });

  // Complex media queries
  describe('complex media query conversions', () => {
    it('should handle range syntax in media queries', async () => {
      const input = `
@media (240px <= width <= 1024px) {
  .range {
    width: 90vw;
    margin: 0 5vw;
  }
}`;
      const output = `
@media (240px <= width <= 1024px) {
  body:not([data-breakpoint-preview-mode]) .range,
  body:not([data-breakpoint-preview-mode]).range {
    width: 90vw;
    margin: 0 5vw;
  }
}
@container (min-width: 240px) and (max-width: 1024px) {
  .range {
    width: 90cqw;
    margin: 0 5cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle mixed media queries with screen and print', async () => {
      const input = `
@media screen and (min-width: 768px), print {
  .mixed {
    width: 80vw;
  }
}`;
      const output = `
@media screen and (min-width: 768px), print {
  body:not([data-breakpoint-preview-mode]) .mixed,
  body:not([data-breakpoint-preview-mode]).mixed {
    width: 80vw;
  }
}
@container (min-width: 768px) {
  .mixed {
    width: 80cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle orientation in media queries', async () => {
      const input = `
@media (orientation: landscape) and (min-width: 768px) {
  .landscape {
    height: 100vh;
    width: 100vw;
  }
}`;
      const output = `
@media (orientation: landscape) and (min-width: 768px) {
  body:not([data-breakpoint-preview-mode]) .landscape,
  body:not([data-breakpoint-preview-mode]).landscape {
    height: 100vh;
    width: 100vw;
  }
}
@container (orientation: landscape) and (min-width: 768px) {
  .landscape {
    height: 100cqh;
    width: 100cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle orientation alone in media queries', async () => {
      const input = `
@media (orientation: landscape) {
  .landscape {
    height: 100vh;
    width: 100vw;
  }
}`;
      const output = `
@media (orientation: landscape) {
  body:not([data-breakpoint-preview-mode]) .landscape,
  body:not([data-breakpoint-preview-mode]).landscape {
    height: 100vh;
    width: 100vw;
  }
}
@container (orientation: landscape) {
  .landscape {
    height: 100cqh;
    width: 100cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });

    it('should handle multiple consecutive media queries', async () => {
      const input = `
@media (min-width: 320px) {
  .mobile { width: 90vw; }
}
@media (min-width: 768px) {
  .tablet { width: 80vw; }
}`;
      const output = `
@media (min-width: 320px) {
  body:not([data-breakpoint-preview-mode]) .mobile, 
  body:not([data-breakpoint-preview-mode]).mobile { 
    width: 90vw; 
  }
}
@container (min-width: 320px) {
  .mobile {
    width: 90cqw;
  }
}
@media (min-width: 768px) {
  body:not([data-breakpoint-preview-mode]) .tablet,
  body:not([data-breakpoint-preview-mode]).tablet {
    width: 80vw; 
  }
}
@container (min-width: 768px) {
  .tablet {
    width: 80cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });
  });

  // Nested media queries
  describe('nested media query handling', () => {
    it('should handle nested media queries correctly', async () => {
      const input = `
@media screen {
  @media (min-width: 768px) {
    .nested {
      width: 80vw;
    }
  }
}`;
      const output = `
@media screen {
  @media (min-width: 768px) {
    body:not([data-breakpoint-preview-mode]) .nested, 
    body:not([data-breakpoint-preview-mode]).nested {
      width: 80vw;
    }
  }
}
@container (min-width: 768px) {
  .nested {
    width: 80cqw;
  }
}`;

      await run(plugin, input, output, opts);
    });
  });

  // Print-only queries
  describe('print-only media queries', () => {
    it('should skip print-only queries', async () => {
      const input = `
@media print {
  .print-only {
    width: 50vw;
  }
}`;
      // Should remain unchanged
      const output = `
@media print {
  .print-only {
    width: 50vw;
  }
}`;

      await run(plugin, input, output, opts);
    });
  });

  // Custom transform function
  describe('custom transform function', () => {
    it('should allow modifying media query params', async () => {
      const customTransform = (params) => {
        // Example: forcibly append "(orientation: landscape)" to any media query
        return `${params} and (orientation: landscape)`;
      };

      const input = `
@media (min-width: 500px) {
  .transformed {
    width: 50vw;
  }
}`;
      const output = `
@media (min-width: 500px) {
  body:not([data-breakpoint-preview-mode]) .transformed,
  body:not([data-breakpoint-preview-mode]).transformed {
    width: 50vw;
  }
}
@container (min-width: 500px) and (orientation: landscape) {
  .transformed {
    width: 50cqw;
  }
}`;

      await run(plugin, input, output, {
        ...opts,
        transform: customTransform
      });
    });
  });

  describe('Body level style to container compatibility', () => {
    it('should conserve body level styles when breakpoint preview is off (in media queries)', async () => {
      const input = `
@media (min-width: 768px) {
  body {
    font-size: 14px;
  }
  .toto, html body {
    font-size: 16px;
  }
  html.toto body.my-body {
    font-size: 16px;
  }
  html#foo body.my-body {
    font-size: 16px;
  }
  html>body#my-body.my-body {
    font-size: 16px;
  }
  #my-body {
    font-size: 16px;
  }
  .my-body {
    font-size: 16px;
  }
  body.my-body p {
    color: green;
  }
  body#my-body.my-body p {
    color: green;
  }
  #my-body p {
    color: green;
  }
  .my-body p {
    color: green;
  }
}
`;

      const output = `
@media (min-width: 768px) {
  body:not([data-breakpoint-preview-mode]) {
    font-size: 14px;
  }
  body:not([data-breakpoint-preview-mode]) .toto,
  body:not([data-breakpoint-preview-mode]).toto,
  body:not([data-breakpoint-preview-mode]) {
    font-size: 16px;
  }
  body:not([data-breakpoint-preview-mode]).my-body {
    font-size: 16px;
  }
  body:not([data-breakpoint-preview-mode]).my-body {
    font-size: 16px;
  }
  body:not([data-breakpoint-preview-mode])#my-body.my-body {
    font-size: 16px;
  }
  body:not([data-breakpoint-preview-mode]) #my-body,
  body:not([data-breakpoint-preview-mode])#my-body {
    font-size: 16px;
  }
  body:not([data-breakpoint-preview-mode]) .my-body,
  body:not([data-breakpoint-preview-mode]).my-body {
    font-size: 16px;
  }
  body:not([data-breakpoint-preview-mode]).my-body p {
    color: green;
  }
  body:not([data-breakpoint-preview-mode])#my-body.my-body p {
    color: green;
  }
  body:not([data-breakpoint-preview-mode]) #my-body p,
  body:not([data-breakpoint-preview-mode])#my-body p {
    color: green;
  }
  body:not([data-breakpoint-preview-mode]) .my-body p,
  body:not([data-breakpoint-preview-mode]).my-body p {
    color: green;
  }
}
@container (min-width: 768px) {
  [data-apos-refreshable-body] {
    font-size: 14px;
  }
  .toto,
  [data-apos-refreshable-body] {
    font-size: 16px;
  }
  [data-apos-refreshable-body].my-body {
    font-size: 16px;
  }
  [data-apos-refreshable-body].my-body {
    font-size: 16px;
  }
  [data-apos-refreshable-body]#my-body.my-body {
    font-size: 16px;
  }
  #my-body {
    font-size: 16px;
  }
  .my-body {
    font-size: 16px;
  }
  [data-apos-refreshable-body].my-body p {
    color: green;
  }
  [data-apos-refreshable-body]#my-body.my-body p {
    color: green;
  }
  #my-body p {
    color: green;
  }
  .my-body p {
    color: green;
  }
}`;

      await run(plugin, input, output, opts);
    });

    it('should move style from body to container fake body out of media queries', async () => {
      const input = `
.toto div {
  font-size: 16px;
}
.toto, body {
  background-color: green;
}
body.my-body .container {
  width: 50vw;
}
.my-body .container p {
  width: 50vw;
}
.toto {
  font-size: 16px;
  width: 50vw;
}
`;

      const output = `
.toto div {
  font-size: 16px;
}
.toto,
body:not([data-breakpoint-preview-mode]),
[data-apos-refreshable-body] {
  background-color: green;
}
body:not([data-breakpoint-preview-mode]).my-body .container {
  width: 50vw;
}
[data-apos-refreshable-body].my-body .container {
  width: 50cqw;
}
.my-body .container p {
  width: 50vw;
}
[data-apos-refreshable-body] .my-body .container p,
  [data-apos-refreshable-body].my-body .container p {
  width: 50cqw;
}
.toto {
  font-size: 16px;
  width: 50vw;
}
[data-apos-refreshable-body] .toto,
  [data-apos-refreshable-body].toto {
  font-size: 16px;
  width: 50cqw;
}
`;

      await run(plugin, input, output, opts);
    });

    it('should transform body selectors to work with and without mobile preview without specific units', async () => {
      const input = `
body {
  color: purple;
}
.foo .bar, body .apos-area p {
  color: lightblue;
}
html body.my-body {
  background-color: red;
}
html>body#my-body.my-body {
  color: green;
}
html.toto#tutu >   body#foo.bar {
  color: green;
}
`;
      const output = `
body:not([data-breakpoint-preview-mode]),
[data-apos-refreshable-body] {
  color: purple;
}
.foo .bar,
body:not([data-breakpoint-preview-mode]) .apos-area p,
[data-apos-refreshable-body] .apos-area p {
  color: lightblue;
}
body:not([data-breakpoint-preview-mode]).my-body,
[data-apos-refreshable-body].my-body {
  background-color: red;
}
body:not([data-breakpoint-preview-mode])#my-body.my-body,
[data-apos-refreshable-body]#my-body.my-body {
  color: green;
}
body:not([data-breakpoint-preview-mode])#foo.bar,
[data-apos-refreshable-body]#foo.bar {
  color: green;
}
`;

      await run(plugin, input, output, opts);
    });
  });

  // Debug mode
  describe('debug mode', () => {
    it('should not affect output when debug is enabled', async () => {
      const debugOpts = {
        ...opts,
        debug: true
      };
      const input = '.debug { width: 100vw; }';
      const output = `
.debug { width: 100vw; }
[data-apos-refreshable-body] .debug,
[data-apos-refreshable-body].debug { width: 100cqw; }`;

      await run(plugin, input, output, debugOpts);
    });
  });
});
