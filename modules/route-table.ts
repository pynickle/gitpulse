import { addTemplate, defineNuxtModule } from '@nuxt/kit';
import type { NuxtPage } from '@nuxt/schema';

import { appLocales, defaultLocaleCode } from '../shared/utils/app-locales';

// Nitro forbids `#build` in the server bundle. The server imports this virtual
// instead. Its types point at the written file, with the `.mjs` kept: Nitro 2
// strips that extension off alias paths, and an extensionless target does not
// resolve.
const SERVER_ROUTE_TABLE = 'gitpulse/route-table-paths';

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
    const source = () => `export default ${JSON.stringify(paths)}\n`;

    const routeTablePaths = ['./route-table-paths.mjs'];
    nuxt.hook('prepare:types', ({ tsConfig, nodeTsConfig, serverTsConfig }) => {
      for (const config of [tsConfig, nodeTsConfig, serverTsConfig]) {
        config.compilerOptions ??= {};
        config.compilerOptions.paths ??= {};
        config.compilerOptions.paths[SERVER_ROUTE_TABLE] = routeTablePaths;
      }
    });
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual ||= {};
      nitroConfig.virtual[SERVER_ROUTE_TABLE] = () => {
        if (paths.length === 0) {
          throw new Error(
            'GitPulse route table is empty. Page paths must be resolved before the server bundle is created.'
          );
        }
        return source();
      };
      nitroConfig.typescript ||= {};
      nitroConfig.typescript.tsConfig ||= {};
      nitroConfig.typescript.tsConfig.compilerOptions ||= {};
      nitroConfig.typescript.tsConfig.compilerOptions.paths ||= {};
      nitroConfig.typescript.tsConfig.compilerOptions.paths[SERVER_ROUTE_TABLE] = routeTablePaths;
    });

    addTemplate({
      filename: 'route-table-paths.mjs',
      write: true,
      getContents: source,
    });

    // getContents runs after this hook, while the template is being written.
    nuxt.hook('pages:resolved', (pages) => {
      paths = withLocalePrefixes(collectPagePaths(pages));
    });
  },
});
