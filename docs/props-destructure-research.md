# Reactive props destructure: what the compiler actually guarantees

Research for the `withDefaults(defineProps<T>(), …)` → `const { … } = defineProps<T>()` refactor.
Every claim below is traced to the installed compiler (`@vue/compiler-sfc` 3.5.44, confirmed by
`node_modules/vue/package.json`), to the Vue runtime that consumes its output, or to a page on
`vuejs.org` / `blog.vuejs.org`. Emitted-code samples were produced by calling the repo's own
`compileScript` on synthetic SFCs with `{ id: 'abc', isProd: false }` (no app, no test run).

Paths in citations are relative to the repo root. `compiler-sfc.cjs.js` means
`node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js`.

## A. Minimum version and `<script setup>` requirement — VERIFIED

Reactive props destructure is stable from **Vue 3.5.0**, and it is **on by default** from 3.5.

- `https://blog.vuejs.org/posts/vue-3-5` — "Reactive Props Destructure has been stabilized in 3.5. With the feature now enabled by default, variables destructured from a `defineProps` call in `<script setup>` are now reactive."
- `https://vuejs.org/api/sfc-script-setup.html#reactive-props-destructure` — "In Vue 3.5 and above, variables destructured from the return value of `defineProps` are reactive."
- `https://vuejs.org/guide/components/props.html#reactive-props-destructure` — "In version 3.4 and below, `foo` is an actual constant and will never change. In version 3.5 and above, Vue's compiler automatically prepends `props.` …"

`<script setup>` is required, because `defineProps` is a compiler macro that only exists there
(`https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits` — "`defineProps` and
`defineEmits` are compiler macros only usable inside `<script setup>`"). The transform lives in
`compileScript`, which is the `<script setup>` compiler path.

No repo config disables it: the option is only forwarded when set (`@vitejs/plugin-vue` passes
`propsDestructure: options.features?.propsDestructure ?? options.script?.propsDestructure`,
`node_modules/@vitejs/plugin-vue/dist/index.mjs:312`), and `nuxt.config.ts` sets neither.

The version gate is the installed runtime, not the compiler option: 3.5.44 is installed
(`node_modules/vue/package.json:3`), so the rewrite and the 3.5 runtime are both present.

## B. Exactly what is emitted for each default form — VERIFIED

The decision is made in one function, `genDestructuredDefaultValue`
(`compiler-sfc.cjs.js:25014-25036`), called from `genRuntimePropFromType`
(`compiler-sfc.cjs.js:24957`):

```js
function genDestructuredDefaultValue(ctx, key, inferredType) {
  const destructured = ctx.propsDestructuredBindings[key];
  const defaultVal = destructured && destructured.default;
  if (defaultVal) {
    const value = ctx.getString(defaultVal);
    const unwrapped = CompilerDOM.unwrapTSNode(defaultVal);
    if (inferredType && inferredType.length && !inferredType.includes('null')) {
      const valueType = inferValueType(unwrapped);
      if (valueType && !inferredType.includes(valueType)) {
        ctx.error(`Default value of prop "${key}" does not match declared type.`, unwrapped);
      }
    }
    const needSkipFactory =
      !inferredType && (CompilerDOM.isFunctionType(unwrapped) || unwrapped.type === 'Identifier');
    const needFactoryWrap =
      !needSkipFactory &&
      !isLiteralNode(unwrapped) &&
      !(inferredType == null ? void 0 : inferredType.includes('Function'));
    return {
      valueString: needFactoryWrap ? `() => (${value})` : value,
      needSkipFactory,
    };
  }
}
```

`isLiteralNode` is purely syntactic (`compiler-sfc.cjs.js:20182-20184`):

```js
function isLiteralNode(node) {
  return node.type.endsWith('Literal');
}
```

An `ArrayExpression` and an `ObjectExpression` are **not** `…Literal` nodes, so they take the
factory branch; `NumericLiteral`, `StringLiteral`, `BooleanLiteral` do not.

Emitted declarations, verbatim, for `defineProps<{ … }>()` with each default:

| Source                                                                       | Emitted runtime prop (dev)                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `const { list = [] } = defineProps<{ list?: string[] }>()`                   | `list: { type: Array, required: false, default: () => ([]) }`       |
| `const { n = 1 } = defineProps<{ n?: number }>()`                            | `n: { type: Number, required: false, default: 1 }`                  |
| `const { fn = () => {} } = defineProps<{ fn?: () => void }>()`               | `fn: { type: Function, required: false, default: () => {} }`        |
| `const { x = undefined } = defineProps<{ x?: number }>()`                    | `x: { type: Number, required: false, default: () => (undefined) }`  |
| `const { cfg = { a: 1 } } = defineProps<{ cfg?: Record<string, number> }>()` | `cfg: { type: Object, required: false, default: () => ({ a: 1 }) }` |

So yes: array and object literals **are** wrapped, as `default: () => ([])`. The wrapping is not
"is this a reference type"; it is `!isLiteralNode(node)` and the declared type does not include
`Function`.

The runtime then unwraps the factory (`node_modules/@vue/runtime-core/dist/runtime-core.cjs.js:5160-5176`):

```js
    if (hasDefault && value === void 0) {
      const defaultValue = opt.default;
      if (opt.type !== Function && !opt.skipFactory && shared.isFunction(defaultValue)) {
```

Consequences worth noting for the refactor:

- A function-typed prop's default is **not** invoked: `opt.type === Function` short-circuits, so
  `fn` is the arrow function itself. Identical to `withDefaults`.
- `x = undefined` on a non-`Function` type emits a factory returning `undefined`, whereas
  `withDefaults(…, { x: undefined })` emits `default: undefined`. Both leave `hasDefault` true
  (so the documented `default: undefined` Boolean-casting defeat still holds), and both resolve to
  `undefined`, but the emitted declaration is not textually identical.
- Production output drops the type but keeps the default: `list: { default: () => ([]) }`,
  `n: { default: 1 }`. Type mismatch checks are dev-only in the same sense
  (`compiler-sfc.cjs.js:24982-25007`).
- With a runtime props declaration (`defineProps({ n: Number })`) the defaults go through
  `mergeDefaults` instead (`compiler-sfc.cjs.js:24878-24894`), and `genDestructuredDefaultValue`
  is called **without** `inferredType`, which is the only path where `needSkipFactory` can be true.

## C. `withDefaults()` plus destructuring — VERIFIED (warning, and the feature is switched off)

It is a **compile-time warning**, not an error, and it silently degrades to a non-reactive
destructure. `processWithDefaults` (`compiler-sfc.cjs.js:24859-24866`):

```js
if (declId && declId.type === 'ObjectPattern') {
  ctx.warn(
    `${WITH_DEFAULTS}() is unnecessary when using destructure with ${DEFINE_PROPS}().
Reactive destructure will be disabled when using withDefaults().
Prefer using destructure default values, e.g. const { foo = 1 } = defineProps(...). `,
    node.callee
  );
}
```

The disabling is structural: `processDefineProps` only registers the destructure when it is _not_
inside `withDefaults` (`compiler-sfc.cjs.js:24831-24833`):

```js
if (!isWithDefaults && declId && declId.type === 'ObjectPattern') {
  processPropsDestructure(ctx, declId);
}
```

Compiling `const { n } = withDefaults(defineProps<{ n?: number }>(), { n: 1 })` produces both the
warning above and this output — the destructure survives as a plain, non-reactive one:

```js
  props: {
    n: { type: Number, required: false, default: 1 }
  },
  setup(__props: any, { expose: __expose }) {
  const { n } = __props
```

Because `ctx.propsDestructureDecl` stays unset, `transformDestructuredProps` is never called
(`compiler-sfc.cjs.js:25886-25888`), so `n` is never rewritten to `__props.n`.

## D. The `props` identifier after destructuring — VERIFIED

There is no `props` object unless you declare one. With a destructure and no rest element, the
whole declaration is deleted from the output (`compiler-sfc.cjs.js:25799-25811`):

```js
          if (isDefineProps && !ctx.propsDestructureRestId && ctx.propsDestructureDecl) {
            if (left === 1) {
              ctx.s.remove(node.start + startOffset, node.end + startOffset);
```

and the `defineProps(...)` call is only replaced with `__props` when there is **no** destructure
(`compiler-sfc.cjs.js:26002-26007`):

```js
    } else if (!ctx.propsDestructureDecl) {
      ctx.s.overwrite(
        startOffset + ctx.propsCall.start,
        startOffset + ctx.propsCall.end,
        "__props"
      );
```

So `const { a } = defineProps<{ a?: string }>(); console.log(props.a)` compiles **without any
compiler error** into `console.log(props.a)` inside `setup(__props)`, where `props` is undefined —
a runtime `ReferenceError`. The compiler emits nothing named `props`.

What you can do instead:

- `const props = defineProps<T>(); const { a } = props` — one `defineProps` call, so `props` stays
  live, but `a` is an ordinary JavaScript copy: no compiler rewrite applies (the transform only
  runs when the declaration is an `ObjectPattern` directly on the `defineProps` call), and the
  emitted `const { a } = props` is a one-time read. This is the "plain JS destructure" case, and it
  is the reason the 3.5 feature exists: `https://vuejs.org/guide/components/props.html#reactive-props-destructure`.
- `const { a, ...rest } = defineProps<T>()` — `rest` is a live object for the **non-destructured**
  keys, via `createPropsRestProxy(__props, ["a"])` (`compiler-sfc.cjs.js:25989-26001`).
- Two `defineProps` calls is not an option: `duplicate defineProps() call`
  (`compiler-sfc.cjs.js:24810-24812`).

Difference in kind: reactive props destructure is a **compiler rewrite of every reference** to a
getter on the live props object; a plain JavaScript destructure **copies the value once**.

The only guaranteed way to have both a live `props` object and destructured names in the same
component is therefore `const props = defineProps<T>()` plus `props.x` usages — i.e. not
destructuring at all.

## E. Tracking inside `computed` / `watch` / `watchEffect` — VERIFIED

Every reference to a destructured binding is overwritten with a props access expression
(`compiler-sfc.cjs.js:25194-25224`):

```js
ctx.s.overwrite(
  id.start + ctx.startOffset,
  id.end + ctx.startOffset,
  shared.genPropsAccessExp(propsLocalToPublicMap[id.name])
);
```

and `genPropsAccessExp` (`node_modules/@vue/shared/dist/shared.cjs.js:113-115`):

```js
function genPropsAccessExp(name) {
  return identRE.test(name) ? `__props.${name}` : `__props[${JSON.stringify(name)}]`;
}
```

The rewrite is applied to identifiers in the whole `<script setup>` body, including nested function
bodies (`pushScope(true)` on function nodes, `compiler-sfc.cjs.js:25250-25258`), which is why a
`computed(() => cnt)` getter re-reads `__props.cnt` on every run and tracks exactly like
`props.cnt`. Verified output: `const { list: items = [] } = …; console.log(items.length)` compiles
to `console.log(__props.list.length)`.

Because the rewritten expression is literally `__props.x`, tracking is the same operation as
`props.x` — there is no proxy or intermediate ref. Destructured names also remain usable in the
template: prop keys get `bindingMetadata[key] = "props"` when the runtime declaration is generated
(`compiler-sfc.cjs.js:24917-24919`), and aliased keys get `"props-aliased"` plus an
`__propsAliases` entry (`compiler-sfc.cjs.js:25062-25068`).

Two hard errors accompany the rewrite (`compiler-sfc.cjs.js:25207-25209`, probe-confirmed):

- `Cannot assign to destructured props as they are readonly.` — `n = 2` fails to compile.
- `` `defineModel()` prop options cannot reference destructured props because they are hoisted outside of the setup() function. `` (`compiler-sfc.cjs.js:25200-25205`).

## F. `watch(x, cb)` on a destructured prop — VERIFIED (compile error, not a silent no-op)

`checkUsage` rejects a destructured binding passed directly to `watch` or `toRef`
(`compiler-sfc.cjs.js:25225-25234`, invoked at `compiler-sfc.cjs.js:25248-25249`):

```js
function checkUsage(node, method, alias = method) {
  if (isCallOf(node, alias)) {
    const arg = CompilerDOM.unwrapTSNode(node.arguments[0]);
    if (arg.type === 'Identifier' && currentScope[arg.name]) {
      ctx.error(
        `"${arg.name}" is a destructured prop and should not be passed directly to ${method}(). Pass a getter () => ${arg.name} instead.`,
        arg
      );
    }
  }
}
```

Probe output: `[@vue/compiler-sfc] "n" is a destructured prop and should not be passed directly to watch(). Pass a getter () => n instead.` The same error fires for `toRef(a)`. The 3.5 release post states the intent directly: "`watch(count)` … results in compile-time error" (`https://blog.vuejs.org/posts/vue-3-5`).

If a primitive reaches `watch` anyway (e.g. `watch(props.x, cb)` today, or a value captured through
a helper), the runtime installs a no-op getter and warns —
`node_modules/@vue/reactivity/dist/reactivity.cjs.js:1909-1911`:

```js
  } else {
    getter = shared.NOOP;
    warnInvalidSource(source);
```

with the message at `reactivity.cjs.js:1848-1854`: `Invalid watch source: … A watch source can only
be a getter/effect function, a ref, a reactive object, or an array of these types.` The docs match
(`https://vuejs.org/api/reactivity-core.html#watch` — `WatchSource<T> = Ref<T> | (() => T) | (T extends object ? T : never)`).

Passing a destructured prop into a composable is _not_ diagnosed — it compiles, and reactivity is
lost unless the composable normalises with `toValue()`: "composables should normalize the input
with `toValue()` … `useDynamicCount(() => count)`" (`https://blog.vuejs.org/posts/vue-3-5`).

## G. Type-mismatch diagnostics on destructured defaults — VERIFIED

The message is `Default value of prop "<key>" does not match declared type.`
(`compiler-sfc.cjs.js:25023-25026`), gated by
`if (inferredType && inferredType.length && !inferredType.includes("null"))` and
`if (valueType && !inferredType.includes(valueType))`, where `inferValueType`
(`compiler-sfc.cjs.js:25037-25053`) maps literal/function/array/object AST nodes to
`String`/`Number`/`Boolean`/`Object`/`Array`/`Function`.

So `const { list = () => [] } = defineProps<{ list?: string[] }>()` is a **compile error**, because
the default infers `Function` while the declared type is `Array`. Confirmed by running the installed
compiler: `Default value of prop "list" does not match declared type.` Likewise
`const { n = 'hi' } = defineProps<{ n?: number }>()` errors.

This means a literal transliteration of `withDefaults(…, { list: () => [] })` into
`list = () => []` does not compile: the factory form is the _wrong_ form for destructured defaults.

The check has two escape hatches that matter when auditing a refactor:

- `valueType` is `undefined` for anything that is not a literal/array/object/arrow/function node —
  including `Identifier` and `undefined` itself (`inferValueType` has no `Identifier` case). So
  `x = undefined`, `x = SOME_CONST`, and `x = importedFactory()` are never type-checked.
- Any declared type whose inferred runtime types include `null` skips the check entirely. That
  covers unresolvable/imported types (`type = ["null"]` at `compiler-sfc.cjs.js:24943`) and
  explicit unions such as `list: string[] | null` (probe: `list: { type: [Array, null], required: true, default: () => ([]) }`, no error). So `list = () => []` on `string[] | null` compiles.

## H. Limitations and caveats — VERIFIED except where noted

Diagnostics that exist (`compiler-sfc.cjs.js`), all probe-confirmed:

| Case                                                                                  | Result                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `const { a: { b } } = defineProps<…>()`                                               | `defineProps() destructure does not support nested patterns.` (`:25080-25093`)                                                                                                                              |
| computed key `const { [k]: v } = …`                                                   | `defineProps() destructure cannot use computed key.` (`:25072-25077`)                                                                                                                                       |
| assigning to a destructured name                                                      | `Cannot assign to destructured props as they are readonly.` (`:25207-25209`)                                                                                                                                |
| default referencing setup-scope state (`const x = ref(1); const { a = x.value } = …`) | `defineProps() in <script setup> cannot reference locally declared variables because it will be hoisted outside of the setup() function. …` (`:25589-25599`, called on the destructure pattern at `:25891`) |
| destructured name passed to `watch` / `toRef`                                         | see F                                                                                                                                                                                                       |
| `withDefaults` + destructure                                                          | see C                                                                                                                                                                                                       |

Defaults referencing **other props** are not covered by that guard, and are silently broken:
`const { a = 'x', b = a } = defineProps<{ a?: string; b?: string }>()` compiles to
`b: { type: String, required: false, default: () => (a) }`, where `a` is a bare module-scope
reference — the props object is hoisted out of `setup()`, so the factory resolves an undefined
identifier at instance creation. Only module-scope bindings (imports) are safe:
`const { a = DEFAULT_MSG } = …` emits `default: () => (DEFAULT_MSG)` and is valid.

Imported prop types: the docs state imported types are resolved "provided TypeScript is installed as
a peer dependency", and that AST-based conversion still cannot handle types needing real type
analysis (`https://vuejs.org/api/sfc-script-setup.html#type-only-props-emit-declarations`). For
destructured defaults this shows up as an unchecked prop: `import type { Foo } from './foo'` with
`const { f = undefined } = defineProps<{ f?: Foo }>()` emits `f: { type: null, required: false, default: () => (undefined) }` — no type is emitted, so the G check is skipped for that prop.

Local interface references and "type-only props with no runtime declaration": with a type argument
the compiler always synthesises the runtime declaration (`compiler-sfc.cjs.js:24896-24929`); there is
no mode where a type declaration produces no runtime props. In production the type is dropped and
only `{ default: … }` remains. The 3.2 limitation to type literals or local interfaces was lifted in
3.3; conditional types are supported per-prop but not for the whole props object
(`https://vuejs.org/api/sfc-script-setup.html#type-only-props-emit-declarations`).

Template / slots: `props` is not a binding after a destructure (D), so any template use of `props`
is a type error in vue-tsc (I) and an `undefined` read at runtime. `$props` remains available as an
instance property, which is what vue-tsc suggests instead. Destructured _names_ are fine in the
template (E). **NOT VERIFIED**: neither the docs nor the compiler contain any statement specific to
destructuring together with `defineSlots()`/`useSlots()`; the compiler has no slot-related
destructure handling, and I found no primary source asserting a caveat.

One documented behavioural difference, in destructure's favour:
`https://vuejs.org/api/sfc-script-setup.html#default-props-values-when-using-type-declaration` — "default values for mutable reference types (like arrays or objects) should be wrapped in functions when using `withDefaults` to avoid accidental modification and external side effects. This ensures each component instance gets its own copy of the default value. This is not necessary when using default values with destructure."

## I. vue-tsc / language-tools type checking of template `props` — VERIFIED

Checked with this repo's toolchain: `vue-tsc` 3.3.14 and `@vue/language-core` 3.3.14
(`node_modules/vue-tsc/package.json`, `node_modules/@vue/language-core/package.json`) against
TypeScript 6.0.3, on scratch SFCs outside the repo. Results:

- `const { a } = defineProps<{ a?: string }>()` plus `<template>{{ props.a }}</template>` →
  `error TS2551: Property 'props' does not exist on type '{ a: string | undefined; $props: DefineProps<…>; … }'. Did you mean '$props'?`
- the same SFC's `{{ a }}` produces no error — destructured names type-check in the template.
- `console.log(props.a)` in `<script setup>` after a destructure → `error TS2304: Cannot find name 'props'.`
- `const props = defineProps<{ a?: string }>()` with `<template>{{ props.a }}</template>` → clean.
- `const { a = 1 } = defineProps<{ a?: number }>(); a = 2` → `error TS2588: Cannot assign to 'a' because it is a constant.`

So yes: template expressions are checked against setup bindings, and a `props` left dangling by a
destructure refactor is a type error — but only if the code is type-checked. The SFC compiler itself
does **not** error on a stray `props` reference in `<script setup>` (D), so `bunx nuxi typecheck`
(via vue-tsc) is the gate that catches it, not the build.

## Status against the five assumptions under test

| #   | Assumption                                                                                            | Verdict                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Safe on 3.5.44, needs only `<script setup>`                                                           | Holds. Feature is stable and default-on in 3.5 (A); no config disables it here.                                                                                                                                                                                                                                                                                                                            |
| 2   | `withDefaults(…, { x: 1, list: () => [] })` → `{ x = 1, list = [] }` with identical runtime behaviour | Partly contradicted. `list = () => []` is a compile **error** (G) — the factory must be dropped to `list = []`. For `{}`/array defaults the destructure form is behaviourally _better_ (fresh object per instance), not identical (H). And the two APIs cannot coexist: combining them warns and disables reactivity (C).                                                                                  |
| 3   | Compiler emits `default: () => ([])` for array/object literal defaults                                | Holds, verbatim, via `!isLiteralNode(node)` in `genDestructuredDefaultValue` (B). Note the same rule does **not** wrap literals, and never wraps when the declared type includes `Function`.                                                                                                                                                                                                               |
| 4   | `watch(() => props.x)` → `watch(() => x)` required; bare `watch(x)` fails                             | Holds, and stronger than assumed: bare `watch(x)` is a **compile error** with a prescriptive message, not a silent no-op (F). `toRef(x)` behaves the same.                                                                                                                                                                                                                                                 |
| 5   | Rewriting `props.x` → `x` in script and template is purely mechanical                                 | Contradicted. The `props` object ceases to exist (D), so every surviving `props` reference becomes an undefined read at runtime, caught only by vue-tsc (I). Defaults must lose their factories (G), `withDefaults` must be dissolved rather than translated (C), rest-destructured keys behave differently, and `props` passed into composables silently loses reactivity unless wrapped in a getter (F). |
