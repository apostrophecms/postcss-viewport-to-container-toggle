// NOTE: media queries does not work with the combo
// - min-width, max-width, min-height, max-height
// - lower than equal, greater than equal
const DESCRIPTORS = [
  'min-width',
  'max-width',
  'min-height',
  'max-height'
];
const OPERATORS = [
  '>=',
  '<='
];

module.exports = ({
  units = {
    vh: 'cqh',
    vw: 'cqw'
  },
  containerEl = 'body',
  modifierAttr = '',
  debug = false,
  transform = null
} = {}) => {
  const conditionalSelector = `:where(${containerEl}[${modifierAttr}])`;
  const conditionalNotSelector = `:where(${containerEl}:not([${modifierAttr}]))`;
  const processed = Symbol('processed');
  const UnitConvertIgnoredRules = [ 'media', 'container' ];

  return {
    postcssPlugin: 'postcss-viewport-to-container-toggle',
    Rule(rule, { Rule }) {
      const declsToCopy = [];
      if (rule[processed]) {
        return;
      }
      if (
        UnitConvertIgnoredRules.includes(rule.name) ||
        UnitConvertIgnoredRules.includes(rule.parent.name)
      ) {
        rule[processed] = true;
        return;
      }

      rule.walkDecls(decl => {
        if (decl[processed]) {
          return;
        }
        let value = decl.value;
        if (Object.keys(units).every(unit => !value.includes(unit))) {
          return;
        }

        for (const [ unitToConvert, newUnit ] of Object.entries(units)) {
          value = value.replaceAll(unitToConvert, newUnit);
        }
        const clonedDeclWithContainerQueryUnits = decl.clone({ value });

        declsToCopy.push(clonedDeclWithContainerQueryUnits);
        decl[processed] = true;
      });

      if (!declsToCopy.length) {
        return;
      }

      // TODO: Think about source
      const prefixedRule = new Rule({
        selector: `${conditionalSelector} ${rule.selector}`,
        nodes: declsToCopy,
        source: rule.source
      });

      rule.parent.insertAfter(rule, prefixedRule);
      rule[processed] = true;
    },
    AtRule: {
      media(atRule, { Rule }) {
        if (atRule[processed]) {
          return;
        }
        if (
          atRule.params.includes('print') &&
          !atRule.params.includes('all') &&
          !atRule.params.includes('screen')
        ) {
          atRule[processed] = true;
          return;
        }

        // Container query
        const containerAtRule = atRule.clone({
          name: 'container',
          params: convertToContainerQuery(atRule.params, {
            debug,
            transform
          })
            .replaceAll(/(only\s*)?(all|screen|print)(,)?(\s)*(and\s*)?/g, '')
        });

        containerAtRule.walkDecls(decl => {
          if (decl[processed]) {
            return;
          }
          if (Object.keys(units).every(unit => !decl.value.includes(unit))) {
            return;
          }
          for (const [ unitToConvert, newUnit ] of Object.entries(units)) {
            decl.value = decl.value.replaceAll(unitToConvert, newUnit);
          }
        });

        // Media query
        // Only apply when data-breakpoint-preview-mode is not set
        atRule.walkRules(rule => {
          if (rule[processed]) {
            return;
          }
          const newRule = rule.clone({
            selectors: rule.selectors.map(selector => {
              if (selector.startsWith('body')) {
                return selector.replace('body', conditionalNotSelector);
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
      }
    }
  };
};

module.exports.postcss = true;

function convertToContainerQuery (mediaFeature, { debug, transform }) {
  const containerFeature = typeof transform === 'function'
    ? transform(mediaFeature)
    : mediaFeature;

  if (
    debug &&
    DESCRIPTORS.some(descriptor => containerFeature.includes(descriptor)) &&
    OPERATORS.some(operator => containerFeature.includes(operator))
  ) {
    console.warn('[postcssMediaToContainerQueries] Unsupported media query', containerFeature);
  }

  return containerFeature;
};
