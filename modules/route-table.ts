import { addTemplate, addTypeTemplate, defineNuxtModule } from '@nuxt/kit';
import type { NuxtPage } from '@nuxt/schema';

import { appLocales, defaultLocaleCode } from '../shared/utils/app-locales';

const localePrefixes = appLocales
  .map((locale) => locale.code)
  .filter((code) => code !== defaultLocaleCode);

/**
 * `pages:resolved` still lists each page once, without a locale prefix.
 * The router then prefixes every non-default locale. Apply that same prefix
 * here so the server sees the routes the browser resolves.
 */
function withLocalePrefixes(paths: readonly string[]): string[] {
  const localized = new Set(paths);
  for (const path of paths) {
    if (localePrefixes.some((code) => path === `/${code}` || path.startsWith(`/${code}/`))) {
      continue;
    }
    for (const code of localePrefixes) {
      localized.add(path === '/' ? `/${code}` : `/${code}${path}`);
    }
  }
  return [...localized].sort();
}

function collectPagePaths(pages: NuxtPage[]): string[] {
  const paths = new Set<string>();

  const visit = (page: NuxtPage, parent: string) => {
    const raw = page.path ?? '';
    const joined = raw.startsWith('/') ? raw : `${parent}/${raw}`.replaceAll(/\/{2,}/g, '/');
    if (joined.startsWith('/')) paths.add(joined);

    const aliases = page.alias == null ? [] : Array.isArray(page.alias) ? page.alias : [page.alias];
    for (const alias of aliases) {
      const aliasPath = alias.startsWith('/')
        ? alias
        : `${parent}/${alias}`.replaceAll(/\/{2,}/g, '/');
      if (aliasPath.startsWith('/')) paths.add(aliasPath);
    }

    for (const child of page.children ?? []) visit(child, joined.startsWith('/') ? joined : parent);
  };

  for (const page of pages) visit(page, '');
  return [...paths].sort();
}

export default defineNuxtModule({
  meta: { name: 'gitpulse-route-table' },
  setup(_options, nuxt) {
    let paths: string[] = [];

    addTemplate({
      filename: 'route-table-paths.mjs',
      write: true,
      getContents: () => `export default ${JSON.stringify(paths)}\n`,
    });
    addTypeTemplate({
      filename: 'types/route-table-paths.d.ts',
      getContents: () =>
        `declare module '#build/route-table-paths.mjs' {\n  const paths: readonly string[];\n  export default paths;\n}\n`,
    });

    // getContents runs after this hook, while templates are being written.
    nuxt.hook('pages:resolved', (pages) => {
      paths = withLocalePrefixes(collectPagePaths(pages));
    });
  },
});
