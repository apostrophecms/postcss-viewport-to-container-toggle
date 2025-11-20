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
 * @param {string} [opts.containerEl='body'] - The container element selector.
 * @param {string} [opts.modifierAttr='data-breakpoint-preview-mode']
 * - The attribute for container queries.
 * @param {Function} [opts.transform] - A custom function to transform
 * media queries when creating container queries.
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
const createSelectorHelper = require('./src/utils/selectorHelper');

const plugin = (opts = {}) => {
  // Merge options with defaults
  const options = {
    ...DEFAULT_OPTIONS,
    ...opts
  };
  const { containerEl, modifierAttr } = options;

  // Create selectors
  const conditionalSelector = `${containerEl}[${modifierAttr}]`;
  const conditionalNotSelector = `${containerEl}:not([${modifierAttr}])`;
  const containerBodySelector = '[data-apos-refreshable-body]';

  // Create utility instances
  const unitConverter = createUnitConverter({ units: options.units });
  const debugUtils = createDebugUtils(options);
  const mediaProcessor = createMediaProcessor({
    ...options
  });
  const ruleProcessor = createRuleProcessor({
    unitConverter,
    ...options
  });
  const selectorHelper = createSelectorHelper({ modifierAttr });

  // Track processed nodes to avoid duplicates
  const processed = Symbol('processed');

  // Flag to track if container context like sticky has been added
  let hasAddedContainerContext = false;

  /**
   * Walks up the parent chain to find the root-level rule (first rule whose parent is root)
   *
   * @param {Object} node - The starting PostCSS node
   * @returns {Object|null} The root-level rule, or null if not found
   */
  const findRootRule = (node) => {
    let current = node;
    let lastRule = null;

    while (current && current.type !== 'root') {
      if (current.type === 'rule') {
        lastRule = current;
      }
      current = current.parent;
    }

    // lastRule should now be the top-level rule whose parent is root
    return lastRule;
  };

  /**
   * Clones an entire nested structure from a root rule down to a target node,
   * preserving all intermediate nesting levels
   *
   * @param {Object} rootRule - The top-level rule to start cloning from
   * @param {Object} targetNode - The node we're trying to reach (e.g., a media query)
   * @param {Object} helpers - PostCSS helpers
   * @returns {Object} The cloned root rule with nested structure
   */
  const cloneNestedStructure = (rootRule, targetNode, helpers) => {
    // Build path from root to target
    const path = [];
    let current = targetNode;

    while (current && current !== rootRule) {
      path.unshift(current);
      current = current.parent;
    }

    // Clone the root rule
    const clonedRoot = rootRule.clone({
      source: rootRule.source,
      from: helpers.result.opts.from
    });

    // Navigate through the cloned structure following the path
    let currentCloned = clonedRoot;
    for (const pathNode of path) {
      if (pathNode.type === 'rule') {
        // Find the corresponding cloned child rule
        const childSelector = pathNode.selector;
        currentCloned = currentCloned.nodes.find(
          node => node.type === 'rule' && node.selector === childSelector
        );
      } else if (pathNode.type === 'atrule') {
        // Find the corresponding cloned at-rule
        const childName = pathNode.name;
        const childParams = pathNode.params;
        currentCloned = currentCloned.nodes.find(
          node => node.type === 'atrule' &&
            node.name === childName &&
            node.params === childParams
        );
      }

      if (!currentCloned) {
        break;
      }
    }

    return {
      clonedRoot,
      targetInClone: currentCloned
    };
  };

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
        return false;
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
      // as well as the ones inside container queries (already processed or from css)
      if (
        rule.parent?.type === 'atrule' &&
        [ 'media', 'container' ].includes(rule.parent?.name)
      ) {
        return;
      }

      // Do not treat cloned rules already handled
      if (
        rule.selector.includes(conditionalNotSelector) ||
        rule.selector.includes(containerBodySelector) ||
        rule.selector.includes(conditionalSelector)
      ) {
        return;
      }

      // Process rule if it needs conversion
      if (ruleProcessor.needsProcessing(rule)) {
        debugUtils.stats.rulesProcessed++;
        debugUtils.log(`Processing rule: ${rule.selector}`, rule);

        // Create container version with converted units
        // should target [data-apos-refreshable-body]
        const containerRule = rule.clone({
          source: rule.source,
          from: helpers.result.opts.from,
          selector: selectorHelper.addTargetToSelectors(
            rule.selector,
            containerBodySelector
          )
        });

        rule.selector = selectorHelper.updateBodySelectors(
          rule.selector,
          [ conditionalNotSelector ]
        );

        ruleProcessor.processDeclarations(containerRule, {
          isContainer: true,
          from: helpers.result.opts.from
        });

        // Add container rule after original
        rule.after('\n' + containerRule);
      } else {
        rule.selector = selectorHelper.updateBodySelectors(
          rule.selector,
          [ conditionalNotSelector, containerBodySelector ]
        );
      }

      rule[processed] = true;
    },

    AtRule: {
      media(atRule, helpers) {
        debugUtils.logMediaQuery(atRule, 'START');

        if (atRule[processed]) {
          debugUtils.log('Skipping already processed media query', atRule);
          return;
        }

        // Check if this media query is nested inside a rule
        const isNested = atRule.parent?.type === 'rule';
        debugUtils.log(`Media query is ${isNested ? 'NESTED' : 'TOP-LEVEL'}`, atRule);

        let hasNotSelector = false;
        atRule.walkRules(rule => {
          if (rule.selector.includes(conditionalNotSelector)) {
            hasNotSelector = true;
          }
        });

        if (hasNotSelector) {
          debugUtils.log('Skipping - already has not selector', atRule);
          atRule[processed] = true;
          return;
        }

        const conditions = mediaProcessor.getMediaConditions(atRule);
        debugUtils.log(`Extracted conditions: ${JSON.stringify(conditions)}`, atRule);

        if (conditions.length > 0) {
          debugUtils.stats.mediaQueriesProcessed++;

          const containerConditions =
            mediaProcessor.convertToContainerConditions(conditions);

          debugUtils.log(`Container conditions: ${containerConditions}`, atRule);

          if (containerConditions) {
            debugUtils.log('Creating container query...', atRule);

            const containerQuery = new helpers.AtRule({
              name: 'container',
              params: containerConditions,
              source: atRule.source,
              from: helpers.result.opts.from
            });

            // For nested media queries
            if (isNested) {
              debugUtils.log('Processing nested media query declarations...', atRule);

              atRule.each(node => {
                if (node.type === 'decl') {
                  debugUtils.log(`  Processing declaration: ${node.prop}: ${node.value}`, atRule);

                  const containerDecl = node.clone({
                    source: node.source,
                    from: helpers.result.opts.from
                  });

                  // Convert viewport units if needed
                  let value = containerDecl.value;
                  if (Object.keys(unitConverter.units)
                    .some(unit => value.includes(unit))) {
                    value = unitConverter.convertUnitsInExpression(value);
                    containerDecl.value = value;
                    debugUtils.log(`  Converted value to: ${value}`, atRule);
                  }

                  containerQuery.append(containerDecl);
                }
              });

              debugUtils.log(`  Total declarations in container query: ${containerQuery.nodes?.length || 0}`, atRule);

              const parentRule = atRule.parent;

              // Find the root-level rule (topmost rule whose parent is root)
              const rootRule = findRootRule(atRule);

              if (rootRule) {
                debugUtils.log(`  Found root rule: ${rootRule.selector}`, atRule);

                // Clone BEFORE adding container query
                const { clonedRoot } = cloneNestedStructure(rootRule, atRule, helpers);

                // Apply the body check selector to the root level only
                clonedRoot.selector = selectorHelper.addTargetToSelectors(
                  clonedRoot.selector,
                  conditionalNotSelector
                );

                // Mark all media queries in the cloned structure as processed
                clonedRoot.walkAtRules('media', (clonedMedia) => {
                  clonedMedia[processed] = true;
                });

                // Insert the cloned structure before the original root rule
                rootRule.before(clonedRoot);

                debugUtils.log('Added conditional wrapper at root level for nested media query', atRule);
              } else {
                // Fallback to old behavior if we can't find root
                debugUtils.log('Could not find root rule, using fallback', atRule);

                const originalSelector = parentRule.selector;

                const conditionalRule = new helpers.Rule({
                  selector: selectorHelper
                    .addTargetToSelectors(
                      originalSelector,
                      conditionalNotSelector
                    ),
                  source: parentRule.source,
                  from: helpers.result.opts.from
                });

                const clonedMedia = atRule.clone();
                clonedMedia[processed] = true;
                conditionalRule.append(clonedMedia);

                parentRule.before(conditionalRule);
              }

              // Remove the media query from the original parent
              atRule.remove();

              // Add container query where the media query was
              parentRule.append(containerQuery);

              debugUtils.log('Added conditional wrapper for nested media query', atRule);
            } else {
              // Original logic for top-level media queries
              atRule.walkRules(rule => {
                const containerRule = rule.clone({
                  source: rule.source,
                  from: helpers.result.opts.from,
                  selector: selectorHelper.updateBodySelectors(
                    rule.selector,
                    [ containerBodySelector ]
                  )
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
          }

          // Now handle viewport media query modifications
          // We want the original media query to get the not selector
          if (!isNested) {
            atRule.walkRules(rule => {
              // Skip if already modified with not selector
              if (rule.selector.includes(conditionalNotSelector)) {
                return;
              }

              const viewportRule = rule.clone({
                source: rule.source,
                from: helpers.result.opts.from
              });

              viewportRule.selector = selectorHelper.addTargetToSelectors(
                rule.selector,
                conditionalNotSelector
              );

              rule.replaceWith(viewportRule);
            });
          }
        } else {
          debugUtils.log('No conditions found - skipping', atRule);
        }

        // Only mark the atRule as processed after all transformations
        atRule[processed] = true;
        debugUtils.logMediaQuery(atRule, 'END');
      }
    },

    OnceExit() {
      debugUtils.printSummary();
    }
  };
};

plugin.postcss = true;

module.exports = plugin;
