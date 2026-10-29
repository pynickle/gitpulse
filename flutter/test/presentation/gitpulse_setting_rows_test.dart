import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_setting_rows.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// The Settings card, its row and its note are read by the Settings screens, the
/// Repository page and the session notice, so the tones they paint are stated
/// once — through the presentation layer's own readers, never through Material's
/// role names (ADR 0031).
void main() {
  Future<ThemeData> pumpThemed(WidgetTester tester, Widget child) async {
    late ThemeData theme;
    await tester.pumpWidget(
      MaterialApp(
        theme: gitPulseTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) {
              theme = Theme.of(context);
              return Center(child: child);
            },
          ),
        ),
      ),
    );
    return theme;
  }

  BoxDecoration surfaceOf(WidgetTester tester) =>
      tester
              .widget<DecoratedBox>(
                find
                    .descendant(
                      of: find.byType(GitPulseSettingSurface),
                      matching: find.byType(DecoratedBox),
                    )
                    .first,
              )
              .decoration
          as BoxDecoration;

  testWidgets('a Settings card is the muted block inside the page', (
    tester,
  ) async {
    await pumpThemed(
      tester,
      const GitPulseSettingSurface(child: SizedBox(height: 40, width: 200)),
    );
    final context = tester.element(find.byType(GitPulseSettingSurface));
    final decoration = surfaceOf(tester);

    // A block within the page: the muted surface step, closed by the app's own
    // edge and nothing else.
    expect(decoration.color, toneSurfaceMuted(context));
    expect(decoration.border, isNotNull);
    expect(
      decoration.border!.top.color,
      toneEdge(Theme.of(context).colorScheme),
    );
    expect(decoration.border!.top.width, GitPulseStroke.hairline);
  });

  testWidgets('a setting’s note reports its state in the app’s tones', (
    tester,
  ) async {
    await pumpThemed(
      tester,
      const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GitPulseSettingNote('Saved'),
          GitPulseSettingNote(
            'Could not save',
            tone: GitPulseSettingNoteTone.error,
          ),
        ],
      ),
    );
    final context = tester.element(find.byType(GitPulseSettingNote).first);
    final notes = find.byType(GitPulseSettingNote);
    final muted = tester.widget<Text>(
      find.descendant(of: notes.at(0), matching: find.byType(Text)),
    );
    final failure = tester.widget<Text>(
      find.descendant(of: notes.at(1), matching: find.byType(Text)),
    );

    expect(muted.style?.color, toneTextMuted(context));
    // A failure is the danger tone and never the Accent: the Accent means the
    // app is acting, not that something went wrong (ADR 0031).
    expect(failure.style?.color, toneDanger(context));
    expect(failure.style?.color, isNot(toneAccent(context)));
    // Both are the type table's meta role, so a note under a control reads as
    // the same kind of line on every screen that has one.
    final meta = gitPulseTypeTableOf(context).bodySmall;
    for (final style in [muted.style!, failure.style!]) {
      expect(style.fontSize, meta.size);
      expect(style.fontWeight, meta.weight);
      expect(style.letterSpacing, meta.letterSpacing);
    }
  });

  testWidgets('a setting row’s legend is the muted ink of the row it names', (
    tester,
  ) async {
    await pumpThemed(
      tester,
      GitPulseSettingRow(
        icon: Icons.language,
        label: 'Language',
        control: const SizedBox(width: 80),
      ),
    );
    final context = tester.element(find.byType(GitPulseSettingRow));

    expect(
      tester.widget<Icon>(find.byIcon(Icons.language)).color,
      toneTextMuted(context),
    );
    // The name is the app's row-label role, shared with a Follows row.
    expect(
      tester
          .widget<Text>(
            find.descendant(
              of: find.byType(GitPulseSettingRow),
              matching: find.text('Language'),
            ),
          )
          .style
          ?.fontSize,
      gitPulseTypeTableOf(context).titleSmall.size,
    );
  });

  testWidgets('the rule inside a Settings surface is the app’s own', (
    tester,
  ) async {
    await pumpThemed(tester, const GitPulseSettingsDivider(indent: 0));
    final context = tester.element(find.byType(GitPulseSettingsDivider));

    expect(
      tester.widget<Divider>(find.byType(Divider)).color,
      toneRule(Theme.of(context).colorScheme),
    );
  });
}
