const postcss = require('postcss');
const { equal, deepEqual } = require('node:assert');
const plugin = require('../index.js');
const opts = { modifierAttr: 'data-breakpoint-preview-mode' };

describe('postcss-viewport-to-container-toggle', () => {
  it('should map `vh` values to `cqh` in a rule that applies only on breakpoint preview ', async () => {
    const input = '.hello { width: 100vh; }';
    const output = '.hello { width: 100vh; }\n:where(body[data-breakpoint-preview-mode]) .hello { width: 100cqh; }';

    await run(plugin, input, output, opts);
  });

  it('should map `vw` values to `cqw` in a rule that applies only on breakpoint preview ', async () => {
    const input = '.hello { width: 100vw; }';
    const output = '.hello { width: 100vw; }\n:where(body[data-breakpoint-preview-mode]) .hello { width: 100cqw; }';

    await run(plugin, input, output, opts);
  });

  it('should map `vh` and `vw` values used in `calc` to `cqh` and `cqw` in a rule that applies only on breakpoint preview', async () => {
    const input = `
.hello { height: calc(100vh - 50px); width: calc(100vw - 10px); }`;
    const output = `
.hello { height: calc(100vh - 50px); width: calc(100vw - 10px); }
:where(body[data-breakpoint-preview-mode]) .hello { height: calc(100cqh - 50px); width: calc(100cqw - 10px); }`;

    await run(plugin, input, output, opts);
  });

  it('should add only declarations containing `vh` and `vw` values in a rule that applies only on breakpoint preview', async () => {
    const input = `
.hello {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: calc(100vh - 50px);
}`;

    const output = `
.hello {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: calc(100vh - 50px);
}
:where(body[data-breakpoint-preview-mode]) .hello {
  width: 100cqw;
  height: calc(100cqh - 50px);
}`;

    await run(plugin, input, output, opts);
  });

  it('should work properly inside media queries', async () => {
    const input = `
.hey {
  display: flex;
  justify-content: center;
}
.coucou {
  display: flex;
  height: 70vh;
}

@media only screen and (width > 600px) and (max-width: 1000px) {
  .hello {
    top: 0;
    width: 100vw;
    height: calc(100vh - 50px);
  }
  .goodbye {
    width: 100%;
    color: #fff;
    transform: translateX(20vw);
  }
}

.toto {
  width: 100vh;
  color: white;
}
`;

    const output = `
.hey {
  display: flex;
  justify-content: center;
}
.coucou {
  display: flex;
  height: 70vh;
}
:where(body[data-breakpoint-preview-mode]) .coucou {
  height: 70cqh;
}

@media only screen and (width > 600px) and (max-width: 1000px) {
  :where(body:not([data-breakpoint-preview-mode])) .hello {
    top: 0;
    width: 100vw;
    height: calc(100vh - 50px);
  }
  :where(body:not([data-breakpoint-preview-mode])) .goodbye {
    width: 100%;
    color: #fff;
    transform: translateX(20vw);
  }
}

@container (width > 600px) and (max-width: 1000px) {
  .hello {
    top: 0;
    width: 100cqw;
    height: calc(100cqh - 50px);
  }
  .goodbye {
    width: 100%;
    color: #fff;
    transform: translateX(20cqw);
  }
}

.toto {
  width: 100vh;
  color: white;
}

:where(body[data-breakpoint-preview-mode]) .toto {
  width: 100cqh;
}
`;

    await run(plugin, input, output, opts);
  });
});

// From https://github.com/postcss/postcss-plugin-boilerplate/blob/main/template/index.test.t.js
async function run(plugin, input, output, opts = {}) {
  const result = await postcss([ plugin(opts) ]).process(input, { from: undefined });

  console.log(result.css);
  equal(result.css, output);
  deepEqual(result.warnings(), []);
}
