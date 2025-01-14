const postcss = require('postcss');
const { equal, deepEqual } = require('node:assert');
const plugin = require('../index.js');
const opts = { modifierAttr: 'data-breakpoint-preview-mode' };

// Enhanced run helper with detailed output on failure
async function run(plugin, input, output, opts = {}) {
  const result = await postcss([ plugin(opts) ]).process(input, { from: undefined });
  try {
    // Normalize whitespace before comparison (helps avoid newline mismatches)
    const normalizedResult = result.css.trim().replace(/\n\s*\n/g, '\n');
    const normalizedOutput = output.trim().replace(/\n\s*\n/g, '\n');
    equal(normalizedResult, normalizedOutput);
    deepEqual(result.warnings(), []);
  } catch (error) {
    console.log('\n=== Test Failed ===');
    console.log('Input:');
    console.log(input);
    console.log('\nExpected Output:');
    console.log(output);
    console.log('\nActual Output:');
    console.log(result.css);
    console.log('\nDifference Visualization:');
    const expectedLines = output.trim().split('\n');
    const actualLines = result.css.trim().split('\n');
    const maxLines = Math.max(expectedLines.length, actualLines.length);
    for (let i = 0; i < maxLines; i++) {
      const expected = expectedLines[i] || '';
      const actual = actualLines[i] || '';
      if (expected !== actual) {
        console.log(`Line ${i + 1}:`);
        console.log(`  Expected: "${expected}"`);
        console.log(`  Actual:   "${actual}"`);
      }
    }
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
:where(body[data-breakpoint-preview-mode]) .text {
  font-size: calc(16px + 2cqw);
  line-height: calc(1.5 + 1cqh);
  letter-spacing: 0.5cqi;
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) .fluid-text {
  font-size: clamp(1rem, 1rem + 2cqw, 3rem);
  line-height: clamp(1.2, calc(1 + 2cqh), 1.8);
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) .foo {
  color: red;
  font-size: 2cqw;
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) .decimals {
  font-size: 2.75cqw;
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) .zero-test {
  font-size: 0cqw;
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) .nested-calc {
  font-size: clamp(1rem, calc(50cqw - 2rem), calc(100cqh - 4rem));
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) {
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
:where(body[data-breakpoint-preview-mode]) .fixed-header {
  position: sticky;
  --container-top: 0;
  top: var(--container-top);
  --container-left: 0;
  left: var(--container-left);
  width: 100cqw;
  height: 60px;
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) {
  position: relative;
  contain: layout;
}
@media (min-width: 768px) {
  :where(body:not([data-breakpoint-preview-mode])) .fixed-in-media {
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
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) .dynamic {
  height: 100cqh;
  width: 100cqw;
  min-height: 100cqh;
  max-width: 100cqw;
}`.trim();

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
:where(body[data-breakpoint-preview-mode]) .complex {
  margin: calc(10px + 2cqw - 1cqh);
  padding: calc((100cqw - 20px) / 2 + 1cqmin);
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .single-operator {
    width: 100vw;
  }
}
@container (max-width: 1024px) {
  .single-operator {
    width: 100cqw;
  }
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .single-operator {
    width: 100vw;
  }
}
@container (min-width: 240px) {
  .single-operator {
    width: 100cqw;
  }
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .poorly-formatted {
    width: 100vw;
  }
}
@container (max-width: 1024px) {
  .poorly-formatted {
    width: 100cqw;
  }
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .combined-operator {
    width: 90vw;
    margin: 0 5vw;
  }
}
@container (min-width: 500px) and (max-width: 1024px) {
  .combined-operator {
    width: 90cqw;
    margin: 0 5cqw;
  }
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .range {
    width: 90vw;
    margin: 0 5vw;
  }
}
@container (min-width: 240px) and (max-width: 1024px) {
  .range {
    width: 90cqw;
    margin: 0 5cqw;
  }
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .mixed {
    width: 80vw;
  }
}
@container (min-width: 768px) {
  .mixed {
    width: 80cqw;
  }
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .landscape {
    height: 100vh;
    width: 100vw;
  }
}
@container (orientation: landscape) and (min-width: 768px) {
  .landscape {
    height: 100cqh;
    width: 100cqw;
  }
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .mobile { width: 90vw; }
}
@container (min-width: 320px) {
  .mobile { width: 90cqw; }
}
@media (min-width: 768px) {
  :where(body:not([data-breakpoint-preview-mode])) .tablet { width: 80vw; }
}
@container (min-width: 768px) {
  .tablet { width: 80cqw; }
}`.trim();

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
    :where(body:not([data-breakpoint-preview-mode])) .nested {
      width: 80vw;
    }
  }
}
@container (min-width: 768px) {
  .nested {
    width: 80cqw;
  }
}`.trim();

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
}`.trim();

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
  :where(body:not([data-breakpoint-preview-mode])) .transformed {
    width: 50vw;
  }
}
@container (min-width: 500px) and (orientation: landscape) {
  .transformed {
    width: 50cqw;
  }
}`.trim();

      await run(plugin, input, output, {
        ...opts,
        transform: customTransform
      });
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
:where(body[data-breakpoint-preview-mode]) .debug { width: 100cqw; }`.trim();

      await run(plugin, input, output, debugOpts);
    });
  });
});
