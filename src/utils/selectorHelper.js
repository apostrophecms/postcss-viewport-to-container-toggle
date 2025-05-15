const containerSelector = '[data-apos-refreshable]';

const createSelectorHelper = ({ conditionalNotSelector, modifierAttr }) => {
  const bodyRegex = /^body|^html\s+body|^html\s*>\s*body/;
  const bodyRegexFull = /(^body|^html\s+body|^html\s*>\s*body)[.#\w\d[\]"-=:]*/;

  const addConditionalToSelectors = (selector, conditionalNotSelector) => {
    let conditionalSelector = selector
      .split(',')
      .map(part => `${conditionalNotSelector} ${part.trim()}`)
      .join(',\n  ');

    const bodyLevelSelector = addBodyLevelSelector(selector);
    if (bodyLevelSelector) {
      conditionalSelector += `, ${bodyLevelSelector}`;
    }

    return conditionalSelector;
  };

  const bodySelectorToContainer = (selector) => {
    const trimmed = selector.trim();
    if (!trimmed.match(bodyRegex)) {
      return trimmed;
    }
    return trimmed.replace(bodyRegex, containerSelector);
  };

  const addBodyLevelSelector = (selector) => {
    selector = selector.trim();
    if (selector.match(bodyRegex)) {
      selector = selector.replace(bodyRegex, '');

      if (!selector) {
        return conditionalNotSelector;
      }
    }

    const noTagSelector = selector.match(/^\.|^#|^\[|^:/);
    if (noTagSelector) {
      return `${conditionalNotSelector}${selector}`;
    }
  };

  return {
    bodyRegex,
    bodyRegexFull,
    addConditionalToSelectors,
    bodySelectorToContainer
  };
};

module.exports = createSelectorHelper;
