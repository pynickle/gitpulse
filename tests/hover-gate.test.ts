import { expect, test } from 'bun:test';

// The plugin is a build step, so the assertion has to be what it emits: every
// case below feeds CSS through the real PostCSS pipeline with the plugin
// installed and reads the result.
import postcss from 'postcss';
import type { AtRule } from 'postcss';
import { compileString } from 'sass-embedded';

import { installHoverGate } from '../modules/hover-gate/install';
import { hoverGate, HOVER_QUERY } from '../modules/hover-gate/plugin';

async function run(css: string) {
  const result = await postcss([hoverGate()]).process(css, { from: undefined });
  return result.css;
}

test('a hover rule is moved inside the hover-capable query', async () => {
  const css = await run('.row:hover { background: red }');

  expect(css).toContain(`@media ${HOVER_QUERY}`);
  expect(css).toContain('.row:hover');
  // The rule must be inside the block, not before it.
  expect(css.indexOf('@media')).toBeLessThan(css.indexOf('.row:hover'));
});

test('a rule with no hover state is left alone', async () => {
  const css = await run('.title { color: black }');

  expect(css).not.toContain('@media');
  expect(css).toContain('.title');
});

test('an already gated rule is not wrapped twice', async () => {
  const css = await run(`@media ${HOVER_QUERY} { .row:hover { color: blue } }`);

  expect(css.match(/@media/g)).toHaveLength(1);
});

test('a width query keeps its own block and the gate nests inside it', async () => {
  const css = await run('@media (max-width: 700px) { .row:hover { color: blue } }');

  const widthIndex = css.indexOf('(max-width: 700px)');
  const gateIndex = css.indexOf(HOVER_QUERY);
  expect(widthIndex).toBeGreaterThanOrEqual(0);
  expect(gateIndex).toBeGreaterThan(widthIndex);
});

test('a list that mixes hover with focus keeps the focus arm ungated', async () => {
  const css = await run('.row:hover, .row:focus-visible { background: red }');

  // Read the emitted tree rather than the text: a plugin that gated the whole list
  // would still put `.row:focus-visible` after the media query in the string.
  const root = postcss.parse(css);
  const gated: string[] = [];
  const ungated: string[] = [];
  root.walkRules((rule) => {
    const parent = rule.parent;
    const isGated =
      parent?.type === 'atrule' &&
      (parent as AtRule).name === 'media' &&
      String((parent as AtRule).params) === HOVER_QUERY;
    (isGated ? gated : ungated).push(rule.selector);
  });

  expect(gated).toEqual(['.row:hover']);
  expect(ungated).toEqual(['.row:focus-visible']);
});

test('the module installs the gate on the build config', async () => {
  // The wiring is the one piece no other test can see: without it the gate is a
  // module nobody called, and every hover in the app ships ungated.
  const nuxt = { options: {} };
  installHoverGate(nuxt);

  const vite = nuxt.options as {
    vite: { css: { postcss: { plugins: { postcssPlugin?: string }[] } } };
  };
  expect(vite.vite.css.postcss.plugins.map((plugin) => plugin.postcssPlugin)).toEqual([
    'gitpulse-hover-gate',
  ]);
});

test('the gate query is the one the stylesheet mixin emits', () => {
  const { css } = compileString('@use "pointer" as *; a { @include hover-only { color: red } }', {
    loadPaths: ['app/assets/scss'],
  });

  expect(css).toContain(`@media ${HOVER_QUERY}`);
});

test('a hover rule inside @layer stays inside its layer when gated', async () => {
  const css = await run(`
    @layer reset, bulma;
    @layer bulma {
      .button:hover, .button:focus-visible { background: blue; }
      @media ${HOVER_QUERY} { .tag:hover { color: green; } }
    }
  `);

  const root = postcss.parse(css);
  const layerDeclarations: string[] = [];
  const bulmaLayers: AtRule[] = [];

  root.walkAtRules('layer', (atRule) => {
    if (!atRule.nodes || atRule.nodes.length === 0) {
      layerDeclarations.push(atRule.params.trim());
    } else if (atRule.params.trim() === 'bulma') {
      bulmaLayers.push(atRule);
    }
  });

  expect(layerDeclarations).toEqual(['reset, bulma']);
  expect(bulmaLayers).toHaveLength(1);

  const bulmaLayer = bulmaLayers[0]!;
  const gatedInsideLayer: string[] = [];
  const ungatedInsideLayer: string[] = [];
  let mediaCount = 0;

  bulmaLayer.walkAtRules('media', (media) => {
    if (media.params === HOVER_QUERY) {
      mediaCount += 1;
    }
  });

  bulmaLayer.walkRules((rule) => {
    const parent = rule.parent;
    const isGated =
      parent?.type === 'atrule' &&
      (parent as AtRule).name === 'media' &&
      String((parent as AtRule).params) === HOVER_QUERY;
    (isGated ? gatedInsideLayer : ungatedInsideLayer).push(rule.selector);
  });

  expect(gatedInsideLayer).toEqual(['.button:hover', '.tag:hover']);
  expect(ungatedInsideLayer).toEqual(['.button:focus-visible']);
  // One media wrapper for .button:hover and the pre-existing one for .tag:hover (no double-wrap).
  expect(mediaCount).toBe(2);
  expect(css).not.toMatch(/@media[^}]*@media/);
});

test('a nested @layer inside @layer bulma preserves layer membership when gating :hover', async () => {
  const css = await run(`
    @layer bulma {
      @layer components {
        .tabs a:hover { color: red; }
      }
    }
  `);

  const root = postcss.parse(css);
  const hoverAncestors: string[] = [];

  root.walkRules((rule) => {
    if (rule.selector === '.tabs a:hover') {
      let current = rule.parent;
      while (current && current.type !== 'root') {
        if (current.type === 'atrule') {
          const at = current as AtRule;
          hoverAncestors.push(`@${at.name} ${at.params}`);
        }
        current = current.parent;
      }
    }
  });

  expect(hoverAncestors).toEqual([`@media ${HOVER_QUERY}`, '@layer components', '@layer bulma']);
});
