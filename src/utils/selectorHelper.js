
const createSelectorHelper = ({ modifierAttr }) => {
  const bodyRegex = /^body|^html.*\s+body|^html.*\s*>\s*body/;

  const addTargetsToSelectors = (
    selector,
    target,
    returnArray = false
  ) => {
    if (Array.isArray(target)) {
      const updatedSelector = target.reduce((acc, cur) => {
        const updated = addTargetsToSelectors(selector, cur, true);
        return [ ...acc, ...updated ];
      }, []);

      return updatedSelector.join(',\n  ');
    }

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

    return returnArray ? updatedSelector : updatedSelector.join(',\n  ');
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
    const noTagSelector = selector.match(/^\.|^#|^\[|^:/);
    if (noTagSelector) {
      return `${target}${selector}`;
    }

    return null;
  };

  return {
    bodyRegex,
    addTargetsToSelectors
  };
};

module.exports = createSelectorHelper;
