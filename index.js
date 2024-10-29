export default ({
  units = {
    vh: 'cqh',
    vw: 'cqw'
  },
  selector = ''
} = {}) => {
  return {
    postcssPlugin: 'postcss-viewport-to-container-units',
    Once (root, postcss) {
      root.walkRules(rule => {
        const declsToCopy = [];

        rule.walkDecls(decl => {
          let value = decl.value;
          if (Object.keys(units).every(unit => !value.includes(unit))) {
            return;
          }

          for (const [ unitToConvert, newUnit ] of Object.entries(units)) {
            value = value.replaceAll(unitToConvert, newUnit);
          }
          const clonedDeclWithContainerQueryUnits = decl.clone({ value });

          declsToCopy.push(clonedDeclWithContainerQueryUnits);
        });

        if (!declsToCopy.length) {
          return;
        }

        const prefixedRule = new postcss.Rule({
          selector: `${selector} ${rule.selector}`,
          nodes: declsToCopy
        });

        root.insertAfter(rule, prefixedRule);
      });
    }
  };
};
