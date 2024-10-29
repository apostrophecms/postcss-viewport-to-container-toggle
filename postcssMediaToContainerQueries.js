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

module.exports = ({ debug = false, selector = '' } = {}) => {
  return {
    postcssPlugin: 'postcss-media-to-container-queries',
    Once (root, postcss) {
      root.walkAtRules('media', atRule => {
        /* console.log('rule', rule.source); */
        /* console.log('rule.params', rule.params); */
        console.log('rule', atRule.nodes);

        if (
          atRule.params.includes('print') &&
        (!atRule.params.includes('all') || !atRule.params.includes('screen'))
        ) {
          return;
        }

        // Container query
        const containerAtRule = atRule.clone({
          name: 'container',
          params: convertToContainerQuery(atRule.params)
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

        /* rule.walkDecls(decl => { */
        /*   /* console.log('decl', decl); */
        /* }); */
      });
    }
  };
};

function convertToContainerQuery (mediaFeature) {
  const containerFeature = typeof options.transform === 'function'
    ? options.transform(mediaFeature)
    : mediaFeature;

  if (
    options.debug &&
      DESCRIPTORS.some(descriptor => containerFeature.includes(descriptor)) &&
      OPERATORS.some(operator => containerFeature.includes(operator))
  ) {
    console.warn('[mediaToContainerQueryLoader] Unsupported media query', containerFeature);
  }

  return containerFeature;
};

function loader() {
  const schema = {
    title: 'Media to Container Queries Loader options',
    type: 'object',
    properties: {
      debug: {
        type: 'boolean'
      },
      transform: {
        anyOf: [
          { type: 'null' },
          { instanceof: 'Function' }
        ]
      }
    }
  };
  const options = this.getOptions(schema);

  const mediaQueryRegex = /@media[^{]*{([\s\S]*?})\s*(\\n)*}/g;

  // Prepend container query to media queries
  const modifiedSource = source.replace(mediaQueryRegex, (match) => {
    const root = postcss.parse(match.replaceAll(/(?<!\\)\\[frntv]/g, ''));
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
        params: convertToContainerQuery(atRule.params)
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

    return root.toString();
  });

  return modifiedSource;
};
