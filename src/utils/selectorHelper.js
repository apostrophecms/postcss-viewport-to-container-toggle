
const createSelectorHelper = ({ conditionalNotSelector, modifierAttr }) => {
  const containerSelector = '[data-apos-refreshable]';
  const bodyRegex = /^body|^html\s+body|^html\s*>\s*body/;
  const bodyRegexFull = /(^body|^html\s+body|^html\s*>\s*body)[.#\w\d[\]"-=:]*/;

  const addConditionalToSelectors = (selector, conditionalNotSelector) => {
    const conditionalSelector = selector
      .split(',')
      .filter(part => !part.trim() || !part.trim().match(bodyRegex))
      .map(part => `${conditionalNotSelector} ${part.trim()}`);

    const bodyLevelSelector = addBodyLevelSelector(selector);
    if (bodyLevelSelector) {
      conditionalSelector.push(bodyLevelSelector);
    }

    return conditionalSelector.join(',\n  ');
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
    containerSelector,
    bodyRegex,
    bodyRegexFull,
    addConditionalToSelectors,
    bodySelectorToContainer
  };
};

module.exports = createSelectorHelper;
