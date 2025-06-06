
const createSelectorHelper = ({ modifierAttr }) => {
  const bodyRegex = /^body|^html.*\s+body|^html.*\s*>\s*body/;
  const tagRegex = /^\.|^#|^\[|^:/;

  const addTargetToSelectors = (
    selector,
    target
  ) => {
    const updatedSelector = selector
      .split(',')
      .reduce((acc, part) => {
        const trimmed = part.trim();
        if (!trimmed.match(bodyRegex)) {
          acc.push(`${target} ${trimmed}`);
        }

        const bodyLevelSelector = getBodyLevelSelector(trimmed, target);
        if (bodyLevelSelector) {
          acc.push(bodyLevelSelector);
        }
        return acc;
      }, []);

    return updatedSelector.join(',\n  ');
  };

  const updateBodySelectors = (selector, targets) => {
    const updatedSelector = selector
      .split(',')
      .reduce((acc, part) => {
        const trimmed = part.trim();

        // Should we get body level selector here?
        if (!trimmed.match(bodyRegex)) {
          return [ ...acc, trimmed ];
        }

        const updatedPart = trimmed.replace(bodyRegex, '');

        // We replace each body selector with the target,
        // we keep the rest of the selector
        return [
          ...acc,
          ...targets.reduce((acc, target) => {
            return [
              ...acc,
              `${target}${updatedPart}`.trim()
            ];
          }, [])
        ];
      }, []);

    return updatedSelector.join(',\n  ');
  };

  const getBodyLevelSelector = (selector, target) => {
    if (selector.match(bodyRegex)) {
      selector = selector.replace(bodyRegex, '');

      // Selector is a body without identifiers, we put style in the body directly
      if (!selector) {
        return target;
      }
    }

    // If selector starts by an identifier that is not a tag, we put it next to the body
    // in case the body has this identifier
    const noTagSelector = selector.match(tagRegex);
    if (noTagSelector) {
      return `${target}${selector}`;
    }

    return null;
  };

  return {
    bodyRegex,
    addTargetToSelectors,
    updateBodySelectors
  };
};

module.exports = createSelectorHelper;
