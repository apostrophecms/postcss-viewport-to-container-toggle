/**
 * Creates debug utilities for logging and tracking the processing of CSS rules.
 *
 * @param {Object} options - Configuration options for the debug utilities.
 * @param {boolean} options.debug - Enables or disables debug logging.
 * @param {string} [options.debugFilter] - A string to filter debug logs by file source.
 * @returns {Object} An object containing debug utilities and processing stats.
 */
const createDebugUtils = ({ debug, debugFilter }) => {
  /**
   * Tracks statistics about the processing of CSS rules.
   *
   * @type {Object}
   * @property {number} rulesProcessed - The total number of CSS rules processed.
   * @property {number} mediaQueriesProcessed - The total number of
   * media queries processed.
   * @property {number} fixedPositionsConverted - The total number of
   * fixed positions converted.
   * @property {Set<string>} viewportUnitsConverted - A set of viewport units converted.
   * @property {Set<string>} sourceFiles - A set of source files processed.
   */
  const stats = {
    rulesProcessed: 0,
    mediaQueriesProcessed: 0,
    fixedPositionsConverted: 0,
    viewportUnitsConverted: new Set(),
    sourceFiles: new Set()
  };

  /**
   * Logs a debug message to the console, including the source file if applicable.
   *
   * @param {string} message - The debug message to log.
   * @param {Object} node - The PostCSS node associated with the message.
   */
  const log = (message, node) => {
    if (!debug) {
      return;
    }

    const source = node.source?.input?.file || 'unknown source';
    if (debugFilter && !source.includes(debugFilter)) {
      return;
    }

    stats.sourceFiles.add(source);
    console.log(`[PostCSS Viewport to Container Toggle Plugin] ${message} (${source})`);
  };

  const printSummary = () => {
    if (!debug) {
      return;
    }

    console.log('\n[PostCSS Viewport to Container Toggle Plugin] Processing Summary:');
    console.log('----------------------------------------');
    console.log('Rules processed:', stats.rulesProcessed);
    console.log('Media queries processed:', stats.mediaQueriesProcessed);
    console.log('Fixed positions converted:', stats.fixedPositionsConverted);
    console.log('\nViewport unit conversions:',
      Array.from(stats.viewportUnitsConverted).join('\n  '));
    console.log('\nProcessed files:',
      Array.from(stats.sourceFiles).join('\n  '));
  };

  return {
    stats,
    log,
    printSummary
  };
};

module.exports = createDebugUtils;
