import type { Plugin, Root } from 'postcss';

/**
 * Strips `!important` flags inside `@layer bulma` blocks (ADR 0057).
 *
 * CSS Cascade Level 5 reverses layer priority for `!important` declarations:
 * an `!important` inside `@layer bulma` would outrank unlayered app styles.
 * Four active Bulma component modules still ship five upstream `!important`
 * flags (`.button.is-loading`, `.control.is-loading::after`,
 * `.columns.is-gapless`, `.tabs.is-boxed`); clearing them at build time keeps
 * `@layer bulma` strictly non-`!important` until Bulma is uninstalled.
 */
export function stripBulmaLayerImportant(): Plugin {
  return {
    postcssPlugin: 'gitpulse-strip-bulma-layer-important',

    Once(root: Root) {
      root.walkAtRules('layer', (atRule) => {
        if (atRule.params.trim() !== 'bulma') {
          return;
        }
        atRule.walkDecls((decl) => {
          if (decl.important) {
            decl.important = false;
          }
        });
      });
    },
  };
}
