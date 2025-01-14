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
  const conditionalSelector = `:where(${containerEl}[${modifierAttr}])`;
  const conditionalNotSelector = `:where(${containerEl}:not([${modifierAttr}]))`;

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
  const addContainerContextIfNeeded = (root, { Rule }) => {
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
      root.prepend(new Rule({
        selector: conditionalSelector,
        nodes: [
          {
            prop: 'position',
            value: 'relative'
          },
          {
            prop: 'contain',
            value: 'layout'
          }
        ]
      }));
      hasAddedContainerContext = true;
    }
  };

  return {
    postcssPlugin: 'postcss-viewport-to-container-toggle',

    Once(root, helpers) {
      addContainerContextIfNeeded(root, helpers);
    },

    Rule(rule, { Rule }) {
      if (rule[processed]) {
        return; // Skip already processed rules
      }

      // Skip rules in print-only media queries
      const isInPrintOnly = rule.parent?.type === 'atrule' &&
        rule.parent?.name === 'media' &&
        rule.parent.params.includes('print') &&
        !rule.parent.params.includes('all') &&
        !rule.parent.params.includes('screen');

      if (isInPrintOnly) {
        rule[processed] = true;
        return;
      }

      // Process rule if it needs conversion
      if (ruleProcessor.needsProcessing(rule)) {
        debugUtils.stats.rulesProcessed++;
        debugUtils.log(`Processing rule: ${rule.selector}`, rule);

        // Keep original rule for viewport units
        rule[processed] = true;

        // Create container version with converted units
        const containerRule = rule.clone();
        containerRule.selector = `${conditionalSelector} ${rule.selector}`;
        ruleProcessor.processDeclarations(containerRule, { isContainer: true });

        // Add container rule after original
        rule.after('\n' + containerRule);
      }

      rule[processed] = true;
    },

    AtRule: {
      media(atRule, { AtRule }) {
        if (atRule[processed]) {
          return;
        }

        // Special handling for nested media queries - only update selectors
        if (atRule.parent?.type === 'atrule' && atRule.parent?.name === 'media') {
          atRule.walkRules(rule => {
            if (rule[processed]) {
              return;
            }
            // Only update selector for viewport version
            rule.selector = `${conditionalNotSelector} ${rule.selector}`;
            rule[processed] = true;
          });
          return;
        }

        // Process media query
        const conditions = mediaProcessor.getMediaConditions(atRule);
        if (conditions.length > 0) {
          debugUtils.stats.mediaQueriesProcessed++;
          debugUtils.log(`Converting media query: ${atRule.params}`, atRule);

          // Keep original media query but modify rules inside it
          atRule.walkRules(rule => {
            if (rule[processed]) {
              return;
            }

            // Update selector for viewport version
            rule.selector = `${conditionalNotSelector} ${rule.selector}`;
            rule[processed] = true;
          });

          // Create container query version
          const containerConditions = mediaProcessor.convertToContainerConditions(
            conditions
          );
          if (containerConditions.length > 0) {
            const containerQuery = new AtRule({
              name: 'container',
              params: containerConditions[0]
            });

            // Create container versions of all rules
            atRule.walkRules(rule => {
              const containerRule = rule.clone();
              containerRule.selector = rule.selector.replace(conditionalNotSelector, '').trim();
              ruleProcessor.processDeclarations(containerRule, { isContainer: true });

              if (rule.parent?.parent?.type === 'atrule' && rule.parent?.parent?.name === 'media') {
                containerRule.raws.before = '\n  ';
                containerRule.raws.after = '\n  ';

                // Set the raws.before property for each declaration within the rule
                containerRule.walkDecls(decl => {
                  decl.raws.before = '\n    ';
                });
              }
              containerQuery.append(containerRule);
            });

            // Add container query after the media query
            atRule.after(containerQuery);
          }
        }

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
