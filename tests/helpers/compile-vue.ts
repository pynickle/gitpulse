import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';

// Compile the real SFC (including its template) for the mounted host. Imports are
// supplied explicitly so tests can isolate child presentation and external data.
export async function compileVue(path: string, modules: Record<string, unknown> = {}) {
  const { descriptor } = parse(await Bun.file(path).text(), { filename: path });
  const script = compileScript(descriptor, {
    id: path,
    inlineTemplate: true,
    genDefaultAs: '__component',
    templateOptions: { compilerOptions: { hoistStatic: false } },
  });
  const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(script.content);
  const executable = code.replace(
    /import\s+({[^}]+}|[\w$]+)\s+from\s+['"]([^'"]+)['"];?/g,
    (_, binding: string, name: string) => {
      const source = `modules[${JSON.stringify(name)}]`;
      return binding.startsWith('{')
        ? `const ${binding.replace(/\s+as\s+/g, ': ')} = ${source};`
        : `const ${binding} = ${source}.default;`;
    }
  );
  return new Function('modules', `${executable}\nreturn __component;`)({
    vue: Vue,
    ...modules,
  }) as Vue.Component;
}
