/**
 * PostCSS plugin to toggle viewport units into container query units.
 *
 * This plugin processes CSS rules and media queries to add container query versions
 * alongside the existing viewport versions. It includes support for:
 * - Converting `position: fixed` to `position: sticky` in container contexts.
 * - Handling nested media queries.
 * - Adding container query contexts when required.
 *
 * @param {Object} opts - Plugin options.
 * @param {Object} [opts.units] - A mapping of viewport units to container query units.
 * @param {string} [opts.containerEl='html'] - The container element selector.
 * @param {string} [opts.modifierAttr='data-breakpoint'] - The attribute
 * for container queries.
 * @param {boolean} [opts.debug=false] - Enables debug logging.
 * @param {string} [opts.debugFilter] - A filter string for limiting debug
 * logs to specific files.
 * @returns {Object} The PostCSS plugin.
 */
const { DEFAULT_OPTIONS } = require('./src/constants/defaults');
const createUnitConverter = require('./src/utils/unitConverter');
const createMediaProcessor = require('./src/utils/mediaProcessor');
const createRuleProcessor = require('./src/utils/ruleProcessor');
const createDebugUtils = require('./src/utils/debug');

const addConditionalToSelectors = (selector, conditionalNotSelector) => {
  return selector
    .split(',')
    .map(part => `${conditionalNotSelector} ${part.trim()}`)
    .join(',\n  ');
};

const plugin = (opts = {}) => {
  // Merge options with defaults
  const options = {
    ...DEFAULT_OPTIONS,
    ...opts
  };
  const { containerEl, modifierAttr } = options;

  // Create utility instances
  const unitConverter = createUnitConverter({ units: options.units });
  const debugUtils = createDebugUtils(options);
  const mediaProcessor = createMediaProcessor({
    unitConverter,
    ...options
  });
  const ruleProcessor = createRuleProcessor({
    unitConverter,
    ...options
  });

  // Create selectors
  const conditionalSelector = `${containerEl}[${modifierAttr}]`;
  const conditionalNotSelector = `${containerEl}:not([${modifierAttr}])`;

  // Track processed nodes to avoid duplicates
  const processed = Symbol('processed');

  // Flag to track if container context like sticky has been added
  let hasAddedContainerContext = false;

  /**
 * Adds a container context with `position: relative` and `contain: layout` if required.
 *
 * @param {Object} root - The PostCSS root node.
 * @param {Object} helpers - PostCSS helpers, including the `Rule` constructor.
 */
  const addContainerContextIfNeeded = (root, helpers) => {
    if (hasAddedContainerContext) {
      return;
    }

    let needsContainerContext = false;
    root.walkDecls('position', decl => {
      if (decl.value === 'fixed') {
        needsContainerContext = true;
      }
    });

    if (needsContainerContext) {
      debugUtils.stats.fixedPositionsConverted++;
      const contextRule = new helpers.Rule({
        selector: conditionalSelector,
        source: root.source,
        from: helpers.result.opts.from
      });
      contextRule.append({
        prop: 'position',
        value: 'relative',
        source: root.source,
        from: helpers.result.opts.from
      });
      contextRule.append({
        prop: 'contain',
        value: 'layout',
        source: root.source,
        from: helpers.result.opts.from
      });
      root.prepend(contextRule);
      hasAddedContainerContext = true;
    }
  };

  return {
    postcssPlugin: 'postcss-viewport-to-container-toggle',

    Once(root, helpers) {
      addContainerContextIfNeeded(root, helpers);
    },

    Rule(rule, helpers) {
      // Skip already processed rules
      if (rule[processed]) {
        return;
      }

      // Skip rules inside media queries - these will be handled by AtRule
      if (rule.parent?.type === 'atrule' && rule.parent?.name === 'media') {
        return;
      }

      // Process rule if it needs conversion
      if (ruleProcessor.needsProcessing(rule)) {
        debugUtils.stats.rulesProcessed++;
        debugUtils.log(`Processing rule: ${rule.selector}`, rule);

        // Keep original rule for viewport units
        rule[processed] = true;

        // Create container version with converted units
        const containerRule = rule.clone({
          source: rule.source,
          from: helpers.result.opts.from
        });
        containerRule.selector = `${conditionalSelector} ${rule.selector}`;
        ruleProcessor.processDeclarations(containerRule, {
          isContainer: true,
          from: helpers.result.opts.from
        });

        // Add container rule after original
        rule.after('\n' + containerRule);
      }

      rule[processed] = true;
    },

    AtRule: {
      media(atRule, helpers) {
        if (atRule[processed]) {
          return;
        }

        let hasNotSelector = false;
        atRule.walkRules(rule => {
          if (rule.selector.includes(conditionalNotSelector)) {
            hasNotSelector = true;
          }
        });

        if (hasNotSelector) {
          atRule[processed] = true;
          return;
        }

        const conditions = mediaProcessor.getMediaConditions(atRule);
        if (conditions.length > 0) {
          debugUtils.stats.mediaQueriesProcessed++;

          // Create container version first
          const containerConditions =
            mediaProcessor.convertToContainerConditions(conditions);
          if (containerConditions.length > 0) {
            const containerQuery = new helpers.AtRule({
              name: 'container',
              params: containerConditions[0],
              source: atRule.source,
              from: helpers.result.opts.from
            });

            // Clone and process rules for container query - keep selectors clean
            atRule.walkRules(rule => {
              const containerRule = rule.clone({
                source: rule.source,
                from: helpers.result.opts.from
              });

              ruleProcessor.processDeclarations(containerRule, {
                isContainer: true,
                from: helpers.result.opts.from
              });

              containerRule.raws.before = '\n  ';
              containerRule.raws.after = '\n  ';
              containerRule.walkDecls(decl => {
                decl.raws.before = '\n    ';
              });

              containerQuery.append(containerRule);
            });

            // Add container query
            atRule.after(containerQuery);
          }

          // Now handle viewport media query modifications
          // We want the original media query to get the not selector
          atRule.walkRules(rule => {
            // Skip if already modified with not selector
            if (rule.selector.includes(conditionalNotSelector)) {
              return;
            }

            const viewportRule = rule.clone({
              source: rule.source,
              from: helpers.result.opts.from
            });

            viewportRule.selector =
              addConditionalToSelectors(rule.selector, conditionalNotSelector);
            rule.replaceWith(viewportRule);
          });
        }

        // Only mark the atRule as processed after all transformations
        atRule[processed] = true;
      }
    },

    OnceExit() {
      debugUtils.printSummary();
    }
  };
};

plugin.postcss = true;

module.exports = plugin;
