
const createSelectorHelper = ({ modifierAttr }) => {
  const bodyRegex = /^body|^html.*\s+body|^html.*\s*>\s*body/;
  const bodyRegexFull = /(^body|^html\s+body|^html\s*>\s*body)[.#\w\d[\]"-=:]*/;

  const addConditionalToSelectors = (
    selector,
    conditionalSelector,
    returnArray = false
  ) => {
    if (Array.isArray(conditionalSelector)) {
      const updatedSelector = conditionalSelector.reduce((acc, cur) => {
        const updated = addConditionalToSelectors(selector, cur, true);
        return [ ...acc, ...updated ];
      }, []);

      return updatedSelector.join(',\n  ');
    }

    const updatedSelector = selector
      .split(',')
      .reduce((acc, part) => {
        const trimmed = part.trim();
        if (!trimmed.match(bodyRegex)) {
          acc.push(`${conditionalSelector} ${trimmed}`);
        }
        const bodyLevelSelector = getLevelBodySelector(trimmed, conditionalSelector);
        if (bodyLevelSelector) {
          acc.push(bodyLevelSelector);
        }
        return acc;
      }, []);

    return returnArray ? updatedSelector : updatedSelector.join(',\n  ');
  };

  const getLevelBodySelector = (selector, conditionalSelector) => {
    if (selector.match(bodyRegex)) {
      selector = selector.replace(bodyRegex, '');

      // Selector is a body without identifiers, we put style in the body directly
      if (!selector) {
        return conditionalSelector;
      }
    }

    // If selector starts by an identifier that is not a tag, we put it next to the body
    // in case the body has this identifier
    const noTagSelector = selector.match(/^\.|^#|^\[|^:/);
    if (noTagSelector) {
      return `${conditionalSelector}${selector}`;
    }

    return null;
  };

  return {
    bodyRegex,
    bodyRegexFull,
    addConditionalToSelectors
  };
};

module.exports = createSelectorHelper;
