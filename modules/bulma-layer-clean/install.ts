import type { Plugin } from 'postcss';

import { stripBulmaLayerImportant } from './plugin';

/** The slice of Nuxt this install touches, so a test can call it without Nuxt. */
type NuxtLike = { options: { vite?: unknown } };

/**
 * Installs the `@layer bulma` `!important` stripper (ADR 0057) on the build.
 */
export function installBulmaLayerClean(nuxt: NuxtLike): void {
  const vite = (nuxt.options.vite ??= {}) as Record<string, unknown>;
  const css = (vite.css ??= {}) as Record<string, unknown>;
  const postcss =
    typeof css.postcss === 'object' && css.postcss !== null
      ? (css.postcss as { plugins?: Plugin[] })
      : ((css.postcss = { plugins: [] }) as { plugins?: Plugin[] });

  postcss.plugins ??= [];
  postcss.plugins.push(stripBulmaLayerImportant());
}
