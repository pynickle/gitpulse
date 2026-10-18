import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:gitpulse/releases/native_code_highlighter.dart';
import 'package:gitpulse/releases/release_document.dart';
import 'package:shiki_flutter/shiki_flutter.dart';

Future<void> showDocument(
  WidgetTester tester,
  String source, {
  Brightness brightness = Brightness.light,
  NativeCodeHighlighter? highlighter,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        if (highlighter != null)
          nativeCodeHighlighterProvider.overrideWithValue(highlighter),
      ],
      child: MaterialApp(
        theme: ThemeData(brightness: brightness),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            child: ReleaseDocument(
              source: source,
              document: const RepositoryDocumentContext(
                owner: 'octo',
                repository: 'app',
                ref: 'v2',
              ),
              onTapUrl: (_) async => true,
            ),
          ),
        ),
      ),
    ),
  );
}

TextSpan codeSpan(WidgetTester tester, String code) =>
    tester
            .widgetList<Text>(find.byType(Text))
            .singleWhere((text) => text.textSpan?.toPlainText() == code)
            .textSpan!
        as TextSpan;

Set<Color> spanColors(InlineSpan span) {
  final colors = <Color>{};
  span.visitChildren((child) {
    if (child.style?.color case final color?) colors.add(color);
    return true;
  });
  return colors;
}

Future<void> waitForHighlight(WidgetTester tester, String code) async {
  for (var attempt = 0; attempt < 1500; attempt++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 20)),
    );
    await tester.pump();
    if (spanColors(codeSpan(tester, code)).length > 1) return;
  }
  fail('Code did not receive multiple syntax colors');
}

void main() {
  String? clipboard;
  setUp(() {
    clipboard = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.setData') {
            clipboard = (call.arguments as Map)['text'] as String;
          }
          return null;
        });
  });
  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });
  testWidgets('fenced Shell keeps its language and copies original newlines', (
    tester,
  ) async {
    const code = 'echo "Hello"\n\nprintf "%s\\n" "world"\n';
    await showDocument(tester, '```sh\n$code```');
    expect(find.text('sh'), findsOneWidget);
    expect(find.text(code, findRichText: true), findsOneWidget);
    await tester.tap(find.byTooltip('Copy code'));
    await tester.pump();
    expect(clipboard, code);
    await waitForHighlight(tester, code);
    expect(codeSpan(tester, code).toPlainText(), code);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a failing Shiki engine keeps readable and copyable source', (
    tester,
  ) async {
    final highlighter = NativeCodeHighlighter(highlighter: _FailingShiki());
    addTearDown(highlighter.dispose);
    const code = 'const version: string = "v2";\n';
    await showDocument(tester, '```ts\n$code```', highlighter: highlighter);
    await tester.pumpAndSettle();
    expect(codeSpan(tester, code).toPlainText(), code);
    expect(spanColors(codeSpan(tester, code)), isEmpty);
    await tester.tap(find.byTooltip('Copy code'));
    await tester.pump();
    expect(clipboard, code);
    expect(tester.takeException(), isNull);
  });

  testWidgets('unlabelled and HTML preformatted blocks keep whitespace', (
    tester,
  ) async {
    const code = '  plain <example> & text\n\n';
    await showDocument(tester, '```\n$code```');
    await tester.pumpAndSettle();
    expect(find.text('Plain text'), findsOneWidget);
    await tester.tap(find.byTooltip('Copy code'));
    await tester.pump();
    expect(clipboard, code);
    await showDocument(
      tester,
      '<pre><code class="other language-TS" onclick="unsafe()">'
      'const n = 2;\n</code></pre>',
    );
    await waitForHighlight(tester, 'const n = 2;\n');
    expect(find.text('TS'), findsOneWidget);
    await tester.tap(find.byTooltip('Copy code'));
    await tester.pump();
    expect(clipboard, 'const n = 2;\n');
  });

  for (final sample in [
    ('pwsh', '\$name = "GitPulse"\nWrite-Host \$name\n'),
    ('ts', 'const version: string = "v2";\nconsole.log(version);\n'),
    ('c++', '#include <iostream>\nint main() { std::cout << "Hi"; }\n'),
    ('c', '#include <stdio.h>\nint main(void) { return 0; }\n'),
    (
      'html',
      '<script>alert("text only")</script>\n<p>hello &amp; goodbye</p>\n',
    ),
  ]) {
    testWidgets('${sample.$1} renders highlighted, source-accurate text', (
      tester,
    ) async {
      await showDocument(tester, '```${sample.$1}\n${sample.$2}```');
      await waitForHighlight(tester, sample.$2);
      expect(find.text(sample.$1), findsOneWidget);
      expect(codeSpan(tester, sample.$2).toPlainText(), sample.$2);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('theme changes recolor highlighted code and keep its source', (
    tester,
  ) async {
    const code = 'const version: string = "v2";\n';
    const source = '```typescript\n$code```';
    await showDocument(tester, source);
    await waitForHighlight(tester, code);
    final light = spanColors(codeSpan(tester, code));
    await showDocument(tester, source, brightness: Brightness.dark);
    await tester.pumpAndSettle();
    await waitForHighlight(tester, code);
    expect(spanColors(codeSpan(tester, code)), isNot(light));
    expect(codeSpan(tester, code).toPlainText(), code);
  });

  testWidgets('unknown languages remain selectable and scroll horizontally', (
    tester,
  ) async {
    final code = 'unknown ${'long example ' * 50}\n\n  last line\n';
    await showDocument(tester, '```future-lang\n$code```');
    await tester.pumpAndSettle();
    expect(codeSpan(tester, code).toPlainText(), code);
    expect(spanColors(codeSpan(tester, code)), isEmpty);
    final horizontal = find.byWidgetPredicate(
      (widget) => widget is Scrollable && widget.axis == Axis.horizontal,
    );
    final scroll = tester.state<ScrollableState>(horizontal);
    expect(scroll.position.maxScrollExtent, greaterThan(0));
    await tester.drag(horizontal, const Offset(-300, 0));
    await tester.pumpAndSettle();
    expect(scroll.position.pixels, greaterThan(0));
    // Select/copy through Flutter's actual selection shortcuts. The header is
    // excluded, so it cannot contaminate the original code on the clipboard.
    scroll.position.jumpTo(0);
    await tester.pump();
    final text = find.text(code, findRichText: true);
    await tester.tapAt(tester.getTopLeft(text) + const Offset(10, 10));
    await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
    await tester.sendKeyEvent(LogicalKeyboardKey.keyA);
    await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
    await tester.pump();
    await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
    await tester.sendKeyEvent(LogicalKeyboardKey.keyC);
    await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
    await tester.pump();
    expect(clipboard, code);
    expect(tester.takeException(), isNull);
  });
}

class _FailingShiki extends ShikiHighlighter {
  @override
  Future<List<List<ThemedToken>>> codeToTokensAsync(
    String code,
    TokenizeOptions options,
  ) async => throw StateError('Tokenization failed');
}
