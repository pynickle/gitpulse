import type { Plugin } from 'postcss';

import { hoverGate } from './plugin';

/** The slice of Nuxt this install touches, so a test can call it without Nuxt. */
type NuxtLike = { options: { vite?: unknown } };

/**
 * Installs the hover gate (ADR 0049) on the build.
 *
 * Registered on the option rather than the resolved Vite config: Nuxt merges this
 * object afterwards, so the plugin runs after its own PostCSS defaults instead of
 * replacing them.
 */
export function installHoverGate(nuxt: NuxtLike): void {
  const vite = (nuxt.options.vite ??= {}) as Record<string, unknown>;
  const css = (vite.css ??= {}) as Record<string, unknown>;
  const postcss =
    typeof css.postcss === 'object' && css.postcss !== null
      ? (css.postcss as { plugins?: Plugin[] })
      : ((css.postcss = { plugins: [] }) as { plugins?: Plugin[] });

  postcss.plugins ??= [];
  postcss.plugins.push(hoverGate());
}
