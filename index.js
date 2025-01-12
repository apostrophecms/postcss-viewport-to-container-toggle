const DEFAULT_UNITS = {
  vh: 'cqh',
  vw: 'cqw',
  vmin: 'cqmin',
  vmax: 'cqmax',
  dvh: 'cqh',
  dvw: 'cqw',
  lvh: 'cqh',
  lvw: 'cqw',
  svh: 'cqh',
  svw: 'cqw'
};

function parseClampExpression(value) {
  const clampRegex = /clamp\(((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*)\)/g;
  return value.replace(clampRegex, (match, expression) => {
    const parts = expression.split(',').map(part => {
      // Convert each part of the clamp expression
      part = part.trim();
      if (part.includes('calc(')) {
        part = parseCalcExpression(part);
      }
      return convertUnitsInExpression(part);
    });
    return `clamp(${parts.join(', ')})`;
  });
}

function parseCalcExpression(value) {
  const calcRegex = /calc\(((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*)\)/g;
  return value.replace(calcRegex, (match, expression) => {
    return `calc(${convertUnitsInExpression(expression)})`;
  });
}

function convertUnitsInExpression(expression) {
  // Enhanced unit conversion for typography
  const TYPOGRAPHY_UNITS = {
    ...DEFAULT_UNITS,
    // Add relative container query units for typography
    'vmin': 'cqi',  // Use container query inline size for more accurate typography scaling
    'vmax': 'cqb',  // Use container query block size for vertical scaling
  };

  // Convert fluid typography patterns
  expression = expression.replace(
    /(\d*\.?\d+)vw\s*\+\s*(\d*\.?\d+)rem/g,
    (match, vw, rem) => `${rem}rem + ${vw}cqw`
  );

  // Convert standard units
  return Object.entries(TYPOGRAPHY_UNITS).reduce((acc, [unit, containerUnit]) => {
    const unitRegex = new RegExp(`(\\d*\\.?\\d+)${unit}`, 'g');
    return acc.replace(unitRegex, `$1${containerUnit}`);
  }, expression);
}

function processTypographyValue(value) {
  let processed = value;

  // Handle clamp() expressions
  if (value.includes('clamp(')) {
    processed = parseClampExpression(processed);
  }

  // Handle calc() expressions
  if (processed.includes('calc(')) {
    processed = parseCalcExpression(processed);
  }

  // Handle direct unit conversions
  processed = convertUnitsInExpression(processed);

  return processed;
}

function isTypographyProperty(prop) {
  return [
    'font-size',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'text-indent',
    'margin-top',
    'margin-bottom',
    'padding-top',
    'padding-bottom'
  ].includes(prop);
}

function convertMediaFeature(feature) {
  // Clean up any extra spaces
  feature = feature.trim();

  // Handle range syntax like (240px <= width <= 1024px)
  const rangeMatch = feature.match(/(\d+[a-z%]*)\s*<=\s*([a-z-]+)\s*<=\s*(\d+[a-z%]*)/);
  if (rangeMatch) {
    const [, min, property, max] = rangeMatch;
    return `min-${property}: ${min}) and (max-${property}: ${max}`;
  }

  // Handle standard media feature formats
  if (feature.includes(':')) {
    return feature; // Keep as is, it's already in the right format
  }

  return feature;
}

const plugin = ({
  units = DEFAULT_UNITS,
  containerEl = 'body',
  modifierAttr = 'data-breakpoint-preview-mode',
  debug = false,
  transform = null,
  debugFilter = null
} = {}) => {
  const conditionalSelector = `:where(${containerEl}[${modifierAttr}])`;
  const conditionalNotSelector = `:where(${containerEl}:not([${modifierAttr}]))`;
  const processed = Symbol('processed');

  // Track statistics for debugging
  const stats = {
    rulesProcessed: 0,
    mediaQueriesProcessed: 0,
    fixedPositionsConverted: 0,
    viewportUnitsConverted: new Set(),
    sourceFiles: new Set()
  };

  function debugLog(message, rule) {
    if (!debug) return;

    const source = rule.source?.input?.file || 'unknown source';
    if (debugFilter && !source.includes(debugFilter)) return;

    stats.sourceFiles.add(source);
    console.log(`[PostCSS Container Plugin] ${message} (${source})`);
  }

  const processRule = (rule, { Rule }) => {
    if (rule[processed]) return;

    const declsToCopy = [];
    let hasFixedPosition = false;

    // First pass: check for position: fixed and typography properties
    rule.walkDecls(decl => {
      if (decl.prop === 'position' && decl.value === 'fixed') {
        hasFixedPosition = true;
      }
    });

    // Second pass: handle all declarations
    rule.walkDecls(decl => {
      if (decl[processed]) return;

      let value = decl.value;

      // Handle typography-related properties
      if (isTypographyProperty(decl.prop)) {
        value = processTypographyValue(value);
        if (value !== decl.value) {
          const clonedDecl = decl.clone({ value });
          declsToCopy.push(clonedDecl);
          decl[processed] = true;
          debugLog(`Converting typography in ${decl.prop}: ${rule.selector}`, rule);
          return;
        }
      }

      // Handle position: fixed
      if (hasFixedPosition) {
        debugLog(`Converting fixed position in rule: ${rule.selector}`, rule);
        stats.fixedPositionsConverted++;
        if (decl.prop === 'position') {
          const stickyDecl = decl.clone({ value: 'sticky' });
          declsToCopy.push(stickyDecl);
          decl[processed] = true;
          return;
        }

        if (['top', 'right', 'bottom', 'left'].includes(decl.prop)) {
          const varName = `--container-${decl.prop}`;
          const varDecl = decl.clone({
            prop: varName,
            value: decl.value
          });
          declsToCopy.push(varDecl);

          const calcDecl = decl.clone({
            value: `var(${varName})`
          });
          declsToCopy.push(calcDecl);

          decl[processed] = true;
          return;
        }
      }

      // Handle calc expressions
      if (value.includes('calc(')) {
        value = parseCalcExpression(value);
      }

      // Convert viewport units
      if (Object.keys(units).some(unit => value.includes(unit))) {
        value = convertUnitsInExpression(value);
        const clonedDecl = decl.clone({ value });
        declsToCopy.push(clonedDecl);
        decl[processed] = true;

        // Track which units were converted
        Object.keys(units).forEach(unit => {
          if (decl.value.includes(unit)) {
            stats.viewportUnitsConverted.add(`${unit} in ${decl.prop}`);
            debugLog(`Converting ${unit} units in ${decl.prop}: ${rule.selector}`, rule);
          }
        });
      }
    });

    if (declsToCopy.length) {
      stats.rulesProcessed++;
      debugLog(`Processing rule: ${rule.selector}`, rule);
      // Add container context rule if we have fixed positioning
      if (hasFixedPosition) {
        const containerContextRule = new Rule({
          selector: conditionalSelector,
          nodes: [
            {
              prop: 'position',
              value: 'relative',
              source: rule.source
            },
            {
              prop: 'contain',
              value: 'layout',
              source: rule.source
            }
          ],
          source: rule.source
        });
        rule.parent.insertBefore(rule, containerContextRule);
      }

      const prefixedRule = new Rule({
        selector: `${conditionalSelector} ${rule.selector}`,
        nodes: declsToCopy,
        source: rule.source
      });
      rule.parent.insertAfter(rule, prefixedRule);
    }

    rule[processed] = true;
  };

  const processMediaAtRule = (atRule, { AtRule, Rule }) => {
    if (atRule[processed]) return;

    // Skip print-only media queries
    if (atRule.params.includes('print') &&
      !atRule.params.includes('all') &&
      !atRule.params.includes('screen')) {
      atRule[processed] = true;
      return;
    }

    // Convert to container query
    let containerQuery = typeof transform === 'function'
      ? transform(atRule.params)
      : atRule.params.trim();

    // Remove media type if present
    containerQuery = containerQuery.replace(/(only\s*)?(all|screen|print)(,)?(\s)*(and\s*)?/g, '').trim();

    // Convert using convertMediaFeature
    containerQuery = convertMediaFeature(containerQuery);

    // Ensure proper container query syntax
    if (!containerQuery.startsWith('(')) {
      containerQuery = `(${containerQuery}`;
    }
    if (!containerQuery.endsWith(')')) {
      containerQuery = `${containerQuery})`;
    }

    const containerAtRule = atRule.clone({
      name: 'container',
      params: containerQuery
    });

    // Ensure container rules have the correct selector prefix
    containerAtRule.walkRules(rule => {
      if (!rule.selector.includes(conditionalSelector)) {
        rule.selector = `${conditionalSelector} ${rule.selector}`;
      }
    });

    // Process declarations within container query
    containerAtRule.walkDecls(decl => {
      if (decl[processed]) return;

      let value = decl.value;

      if (value.includes('calc(')) {
        value = parseCalcExpression(value);
      }

      if (Object.keys(units).some(unit => value.includes(unit))) {
        decl.value = convertUnitsInExpression(value);
      }

      decl[processed] = true;
    });

    // Handle original media query for non-container elements
    atRule.walkRules(rule => {
      if (rule[processed]) return;

      const newRule = rule.clone({
        selectors: rule.selectors.map(selector => {
          if (selector.startsWith(containerEl)) {
            return selector.replace(containerEl, conditionalNotSelector);
          }
          return `${conditionalNotSelector} ${selector}`;
        })
      });

      rule.replaceWith(newRule);
      rule[processed] = true;
      newRule[processed] = true;
    });

    atRule.parent.insertAfter(atRule, containerAtRule);
    atRule[processed] = true;
    stats.mediaQueriesProcessed++;
    debugLog(`Converting media query: ${atRule.params}`, atRule);
  };

  return {
    postcssPlugin: 'postcss-viewport-to-container-toggle',
    Rule(rule, helpers) {
      return processRule(rule, helpers);
    },
    AtRule: {
      media(atRule, helpers) {
        return processMediaAtRule(atRule, helpers);
      }
    },
    OnceExit() {
      if (debug) {
        console.log('\n[PostCSS Container Plugin] Processing Summary:');
        console.log('----------------------------------------');
        console.log('Rules processed:', stats.rulesProcessed);
        console.log('Media queries processed:', stats.mediaQueriesProcessed);
        console.log('Fixed positions converted:', stats.fixedPositionsConverted);
        console.log('\nViewport unit conversions:',
          Array.from(stats.viewportUnitsConverted).join('\n  '));
        console.log('\nProcessed files:',
          Array.from(stats.sourceFiles).join('\n  '));
      }
    }
  };
};

plugin.postcss = true;

module.exports = plugin;