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
  debug = false, transform = null, selector = ''
} = {}) => {
  return {
    postcssPlugin: 'postcss-media-to-container-queries',
    Once (root, postcss) {
      root.walkAtRules('media', atRule => {
        if (
          atRule.params.includes('print') &&
        (!atRule.params.includes('all') || !atRule.params.includes('screen'))
        ) {
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

        // Media query
        // Only apply when data-breakpoint-preview-mode is not set
        atRule.walkRules(rule => {
          const newRule = rule.clone({
            selectors: rule.selectors.map(selector => {
              if (selector.startsWith('body')) {
                return selector.replace('body', ':where(body:not([data-breakpoint-preview-mode]))');
              }

              return `:where(body:not([data-breakpoint-preview-mode])) ${selector}`;
            })
          });

          rule.replaceWith(newRule);
        });

        root.append(containerAtRule);
      });
    }
  };
};

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
