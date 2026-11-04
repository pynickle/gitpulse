import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';

// Compile the real SFC (including its template) for the mounted host. Imports are
// supplied explicitly so tests can isolate child presentation and external data.
//
// `autoImports` stands in for what Nuxt's unimport adds: a binding the component uses
// without importing it, because the framework resolves it by name. It is written into the
// SFC source before the template is compiled, since that is the pass that decides whether a
// template identifier is a setup binding or a `_ctx` lookup.
export async function compileVue(
  path: string,
  modules: Record<string, unknown> = {},
  autoImports: Record<string, string> = {}
) {
  const injected = Object.entries(autoImports)
    .map(([name, moduleName]) => `import { ${name} } from '${moduleName}';`)
    .join('\n');
  const source = await Bun.file(path).text();
  const withAutoImports = injected
    ? source.replace(/(<script\b[^>]*>)/, `$1\n${injected}`)
    : source;
  if (injected && withAutoImports === source) {
    throw new Error(`${path} has no <script> block to hold the auto-imports: ${injected}`);
  }

  const { descriptor } = parse(withAutoImports, { filename: path });
  const script = compileScript(descriptor, {
    id: path,
    inlineTemplate: true,
    genDefaultAs: '__component',
    templateOptions: { compilerOptions: { hoistStatic: false } },
  });
  const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(script.content);
  const executable = code
    .replace(
      /import\s+({[^}]+}|[\w$]+)\s+from\s+['"]([^'"]+)['"];?/g,
      (_, binding: string, name: string) => {
        const source = `modules[${JSON.stringify(name)}]`;
        return binding.startsWith('{')
          ? `const ${binding.replace(/\s+as\s+/g, ': ')} = ${source};`
          : `const ${binding} = ${source}.default;`;
      }
    )
    .replace(
      /import\(['"]([^'"]+)['"]\)/g,
      (_, name: string) =>
        `Promise.resolve(modules[${JSON.stringify(name)}]).then(module => ({ __esModule: true, ...module }))`
    )
    .replaceAll('import.meta.client', 'true')
    .replaceAll('import.meta.server', 'false');
  // oxlint-disable-next-line no-implied-eval -- compiles a checked-in fixture; evaluating generated code is the point
  return new Function('modules', `${executable}\nreturn __component;`)({
    vue: Vue,
    ...modules,
  }) as Vue.Component;
}
