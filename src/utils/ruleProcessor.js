/**
 * Creates a rule processor for handling CSS rules, including viewport unit conversions
 * and fixed position handling.
 *
 * @param {Object} options - Configuration options for the rule processor.
 * @param {Object} options.unitConverter - Handles unit conversions for
 * viewport and typography units.
 * @param {Object} options.debug - Debug utilities for logging and tracking processing.
 * @returns {Object} An object containing methods to process and check CSS rules.
 */
const createRuleProcessor = ({ unitConverter, debug }) => {

  const { units } = unitConverter;
  /**
   * Checks if a CSS rule requires processing.
   *
   * A rule requires processing if:
   * - It contains a `position: fixed` declaration.
   * - It includes any declarations using viewport units (e.g., `vw`, `vh`).
   *
   * @param {Object} rule - The PostCSS rule to check.
   * @returns {boolean} Returns true if the rule needs processing, otherwise false.
   */
  const needsProcessing = (rule) => {
    let needsConversion = false;

    // Check for fixed position
    rule.walkDecls('position', decl => {
      if (decl.value === 'fixed') {
        needsConversion = true;
      }
    });

    // Check for viewport units
    if (!needsConversion) {
      rule.walkDecls(decl => {
        if (Object.keys(units).some(unit => decl.value.includes(unit))) {
          needsConversion = true;
        }
      });
    }

    return needsConversion;
  };

  /**
   * Processes the declarations within a CSS rule.
   *
   * - Converts `position: fixed` to `position: sticky` for container queries.
   * - Rewrites position-related properties (e.g., `top`, `left`) to use CSS variables
   *   when `isContainer` is true.
   * - Converts viewport units to container-relative units where applicable.
   *
   * @param {Object} rule - The PostCSS rule to process.
   * @param {Object} [options={}] - Additional processing options.
   * @param {boolean} [options.isContainer=false] - Indicates if the rule is
   * being processed as part of a container query.
   * @returns {Object} An object containing a flag indicating if the rule
   * had a fixed position.
   */
  const processDeclarations = (rule, { isContainer = false } = {}) => {
    let hasFixedPosition = false;

    // First pass: check for fixed position
    rule.walkDecls('position', decl => {
      if (decl.value === 'fixed') {
        hasFixedPosition = true;
        if (isContainer) {
          decl.value = 'sticky';
        }
      }
    });

    // Second pass: process all declarations
    if (isContainer && hasFixedPosition) {
      // For fixed position elements, we need to handle position-related props first
      [ 'top', 'right', 'bottom', 'left' ].forEach(prop => {
        rule.walkDecls(prop, decl => {
          // Add the CSS custom property declaration
          const varName = `--container-${prop}`;
          rule.insertBefore(decl, {
            prop: varName,
            value: decl.value
          });
          // Update the original declaration to use the variable
          decl.value = `var(${varName})`;
        });
      });
    }

    rule.walkDecls(decl => {
      // Skip position-related props we've already handled
      if (hasFixedPosition && [ 'position', 'top', 'right', 'bottom', 'left' ].includes(decl.prop)) {
        return;
      }

      let value = decl.value;
      let needsConversion = false;

      // Handle typography properties
      if (unitConverter.isTypographyProperty(decl.prop)) {
        const newValue = unitConverter.processTypographyValue(value);
        if (newValue !== value) {
          value = newValue;
          needsConversion = true;
        }
      }

      // Handle viewport units
      if (Object.keys(units).some(unit => value.includes(unit))) {
        value = unitConverter.convertUnitsInExpression(value);
        needsConversion = true;
      }

      if (needsConversion) {
        decl.value = value;
      }
    });

    return { hasFixedPosition };
  };

  return {
    needsProcessing,
    processDeclarations
  };
};

module.exports = createRuleProcessor;
