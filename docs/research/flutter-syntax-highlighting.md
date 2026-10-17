# Flutter syntax-highlighting follow-up

Investigated on 2026-10-17 after the user reopened Q41 and supplied [pd4d10/highlight.dart/flutter_highlight](https://github.com/pd4d10/highlight.dart/tree/master/flutter_highlight). The user subsequently selected shiki_flutter 1.1.0 with its default pure-Dart engine. This investigation distinguishes a published package from newer repository source and preserves the alternatives considered.

## flutter_highlight: two materially different candidates

- [flutter_highlight on pub.dev](https://pub.dev/packages/flutter_highlight) and its [highlight engine](https://pub.dev/packages/highlight) still publish stable 0.7.0, dated 2021-03-07. The Flutter package's published wrapper renders RichText; selection, copy controls, and surrounding code-block behavior require application integration.
- The repository's master is substantially updated. Its observed [HEAD is 696d9a4ccb7b9ce6bd611dbf0ac1179f1cc3f874](https://github.com/pd4d10/highlight.dart/commit/696d9a4ccb7b9ce6bd611dbf0ac1179f1cc3f874), committed 2026-03-30; it is not archived. The [Flutter pubspec](https://github.com/pd4d10/highlight.dart/blob/696d9a4ccb7b9ce6bd611dbf0ac1179f1cc3f874/flutter_highlight/pubspec.yaml) and [engine pubspec](https://github.com/pd4d10/highlight.dart/blob/696d9a4ccb7b9ce6bd611dbf0ac1179f1cc3f874/highlight/pubspec.yaml) declare source version 0.7.1 and Dart ^3.8.0. This version has not been published to pub.dev.
- Current repository source includes SelectableText.rich, horizontal scrolling, optional line numbers, and a public TextSpanBuilder. Its README describes a larger updated grammar/theme catalog; those are not features that can simply be attributed to the 2021 published artifact.
- Old pub dates do not establish current repository inactivity. Conversely, recent master changes do not establish a stable pub release or a working drop-in Git dependency. The unpublished sibling engine and workspace/source constraints need an actual resolution check.

The previous shortlist overstated the significance of the old published release when discussing project maintenance. Current assessment must compare the old published pair, fixed-revision source, and other current candidates separately.

## Expanded candidates

| Candidate                                                           | Relevant benefit                                                                                 | Material cost or open question                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| flutter_highlight/highlight 0.7.0                                   | Small native widget/Dart engine route; broad language/theme support                              | Old released engine and non-selectable default wrapper; verify modern SDK behavior rather than guessing from SDK upper bounds |
| flutter_highlight/highlight master source 0.7.1                     | Updated engine, selectable text, public span builder, line numbers                               | Unpublished source pair; pin a reviewed revision and verify dependency-source resolution before recommending it               |
| [re_highlight 0.0.3](https://pub.dev/packages/re_highlight)         | Pure-Dart broad-language engine, integrates with custom TextSpan UI                              | Old stable release, known reported fixes need evaluation; not automatically better maintained than the revived original       |
| [shiki_flutter 1.1.0](https://pub.dev/packages/shiki_flutter)       | Recent TextMate/Shiki-style candidate with native TextSpan output and a pure-Dart default engine | Younger implementation; validate published source, resource bundling, initialization, and failure behavior before selecting   |
| [syntax_highlight 0.5.0](https://pub.dev/packages/syntax_highlight) | TextMate grammars, usable native spans                                                           | Smaller built-in language set; super_clipboard native dependency                                                              |

The [shiki_flutter project](https://github.com/BirjuVachhani/shiki_flutter) documents bundled Dart grammar/theme libraries and optional engines. Its claimed Shiki parity is project-provided evidence, not an independent guarantee that every GitHub snippet or the web application's exact theme will match. Evaluate the selected published engine and grammar set.

## Published Shiki candidate: verified facts

[shiki_flutter 1.1.0](https://pub.dev/packages/shiki_flutter) was published on 2026-07-26 by birju.dev/Birju Vachhani. It is an independent project, not an official Shikijs release. Its observed [repository release](https://github.com/BirjuVachhani/shiki_flutter/tree/c63c13886ab002b607099f16e5a31b90109ca428) matches the inspected published sources for configuration, tokenization, rendering, language definitions, and metadata.

The default native-platform engine is ShikiHighlighterDartEngine via shiki_flutter_dart_engine and oniguruma_dart. The resolved default chain has no FFI, Rust/native-build, WebView, or JavaScript execution requirement. Faster native engines are optional and are not part of the proposed default. See [default configuration](https://github.com/BirjuVachhani/shiki_flutter/blob/main/packages/shiki_flutter/lib/src/core/config.dart) and [Dart engine dependencies](https://github.com/BirjuVachhani/shiki_flutter/blob/main/packages/shiki_flutter_dart_engine/pubspec.yaml).

Grammar and theme resources are generated const Dart strings in the package, not fetched from a CDN at runtime. The published generator configuration references tm-grammars 1.31.15 and tm-themes 1.12.2; it follows the TextMate/Shiki resource family rather than running the JavaScript Shiki library. The package is MIT and includes [third-party notices](https://github.com/BirjuVachhani/shiki_flutter/blob/main/packages/shiki_flutter/THIRD_PARTY_NOTICES.md) that must be retained as appropriate.

Main trade-offs:

- It has a recent stable pub artifact and includes native span output and asynchronous native-platform tokenization. It requires Dart ^3.12, which the inspected Flutter 3.47.7 SDK satisfies.
- It is a younger independent implementation; recent release date is not evidence of long-term support. Its observed latest main commit is also 2026-07-26.
- Reference only the language/theme set needed by the app; using the all-catalog collections defeats resource tree shaking. The author's package-size measurements are not measurements of this app's size increase.
- Unknown languages throw ShikiError. The app must map unknown Markdown fences to plain text and preserve source text on any highlighting failure.
- The synchronous codeToTextSpan path does not automatically inherit widget-level isolate scheduling. Engine choice, bounded work, warming, and cached token results need deliberate integration.
- Do not conflate limitations of its embedded Oniguruma-subset engine with those of the default oniguruma_dart engine. Project-provided parity tests do not establish correctness for all possible input.

## Headless verification

Source/archive inspection and tiny headless experiments are kept separate from runtime UI verification. Tests used the existing Flutter 3.47.7 / Dart 3.13.5 in temporary directories. No application was created in this repository and no GUI/browser was launched.

- The published flutter_highlight/highlight 0.7.0 pair and re_highlight 0.0.3 resolved and compiled on this SDK. Bash, PowerShell, TypeScript, and C++ samples retained their original text. The HTML renderer custom-widget integration was also exercised. Thus the old package is not categorically unusable on Dart 3 simply because its manifest has an old SDK upper bound.
- Updated highlight.dart master also resolved as its own workspace and passed headless samples. It exposes selectable text and line numbers. Even after ensureInitialized(), a default HighlightView raised Unknown language: javascript because it created a fresh unregistered engine. Explicit highlighter: hljs fixed the tested widget. See [the pinned widget implementation](https://github.com/pd4d10/highlight.dart/blob/696d9a4ccb7b9ce6bd611dbf0ac1179f1cc3f874/flutter_highlight/lib/src/highlight_view.dart).
- Published shiki_flutter 1.1.0 passed headless tests for Shell, PowerShell, TypeScript, and C++. Styled output contained multiple colors and TextSpan.toPlainText preserved the source including trailing newlines. Unknown-language behavior and the actual default engine were checked. Resources exist in the published package, but operating-system-level network disconnection was not performed.
- No five-platform UI certification, app-size benchmark, or comparative performance ranking was performed. Small parse timings must not be generalized to long or adversarial code blocks.

## Other alternatives examined

- [flutter_md 0.2.0](https://pub.dev/packages/flutter_md) exposes a separate MarkdownHighlighter API with PrismJS 1.30.0-derived rules. It can return native spans and has plain-text fallback, but adds another Markdown-package dependency to the already chosen rendering pipeline. Its [generator notes](https://github.com/DoctorinaAI/md/blob/master/tool/highlight_codegen/README.md) describe greedy-tokenization limitations.
- [syntax_highlighter_plus 0.3.1](https://pub.dev/packages/syntax_highlighter_plus) provides TextMate spans but adds flutter_rust_bridge/hooks and a Rust/onig build chain, increasing the platform-maintenance cost for this app.
- The similarly named highlighter/flutter_highlighter, highlighting/flutter_highlighting, and dart_prism packages were also checked. Their published artifacts are from 2022/2023; no evidence was found that they improve the maintenance trade-off over the main candidates. The package named prism is a color library and is unrelated to syntax tokenization.

## Git-source resolution and recommendation

Source version 0.7.1 depends on an unpublished sibling engine ^0.7.1. Three downstream dependency declarations were actually tested:

1. Only flutter_highlight as a fixed Git dependency failed: its hosted highlight ^0.7.1 does not match any published version.
2. Both packages as ordinary fixed-Git dependencies still failed: the wrapper requires a hosted highlight source while the root requires Git.
3. A fixed-Git flutter_highlight plus a same-revision Git dependency_overrides entry for highlight resolved successfully. This is an explicit source substitution, not evidence that every independent latest pub version is compatible.

Thus the updated repository can be used with a reviewed source override and initialization adjustment, but it is not equivalent to adopting a stable pub release. Never follow floating master silently. The app's preference for latest compatible stable artifacts makes this a user-visible trade-off.

The published 0.7.0 pair remains usable in the tested current SDK, with more application-owned code presentation. Its old SDK upper bound is not a hard Dart 3 failure; see [Dart's null-safe compatibility rules](https://dart.dev/resources/dart-3-migration).

The accepted selection is shiki_flutter 1.1.0 with its default Dart engine: a recent stable artifact, bundled offline resources, TextMate/Shiki-style themes, and successful small headless samples. This is a fit assessment, not a performance ranking or long-term maintenance guarantee. The older published pair, pinned updated source, and re_highlight remain alternatives that were considered.

Maintenance observations should remain precise: a pending [text-selection PR](https://github.com/pd4d10/highlight.dart/pull/60) does not mean master lacks selection; an open [C/C++ issue](https://github.com/pd4d10/highlight.dart/issues/61) is not disproven by a tiny passing sample; re_highlight has a pending [JSX EOF callback fix](https://github.com/reqable/re-highlight/pull/5). None of these alone determines the best library.

For any selected engine, retain a replaceable code-block adapter. Copy uses original source text; unknown languages or highlighting errors fall back to selectable plain text. Integrate it with the accepted HTML renderer without adding a full editor, WebView, or unrelated Markdown renderer merely to highlight fenced code.
