import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/releases/release_detail_dto.dart';
import 'package:gitpulse/releases/release_detail_service.dart';
import 'package:gitpulse/releases/release_details_view.dart';

import '../support/document_viewer.dart';
import '../support/material_faces.dart';
import '../support/named_actions.dart';

ReleaseDetail releaseWith({
  String? name,
  String tag = 'v2.0.0',
  String body = 'Release notes body',
  List<ReleaseAssetDto> assets = const [],
  String? author,
  DateTime? publishedAt,
}) => ReleaseDetail(
  ReleaseDetailDto(
    id: 1,
    tagName: tag,
    name: name,
    htmlUrl: 'https://github.com/octo/app/releases/tag/$tag',
    body: body,
    assets: assets,
    draft: false,
    prerelease: false,
    author: author == null ? null : ReleaseAuthorDto(login: author),
    publishedAt: publishedAt,
  ),
  'octo',
  'app',
);

ReleaseAssetDto asset({
  String name = 'app.zip',
  int size = 2048,
  int downloadCount = 7,
  String? label,
  String? contentType = 'application/zip',
  DateTime? updatedAt,
  String? browserDownloadUrl,
}) => ReleaseAssetDto(
  id: name.hashCode,
  name: name,
  label: label,
  size: size,
  downloadCount: downloadCount,
  browserDownloadUrl:
      browserDownloadUrl ??
      'https://github.com/octo/app/releases/download/v2.0.0/$name',
  contentType: contentType,
  updatedAt: updatedAt ?? DateTime.utc(2026, 10, 20),
);

/// Pumps the reading body, collecting every browser launch it asks for and
/// counting the times its host is asked to open the Release Assets.
Future<List<Uri>> pumpDetails(
  WidgetTester tester,
  ReleaseDetail release, {
  double width = 420,
  ThemeData? theme,
  VoidCallback? onViewAllAssets,
}) async {
  final launched = <Uri>[];
  await tester.pumpWidget(
    ProviderScope(
      overrides: documentViewerOverrides(),
      child: MaterialApp(
        theme: theme,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: Align(
            alignment: Alignment.topLeft,
            // The notes own their own scroll, so the body is given the height a
            // page gives it rather than an unbounded scroll parent.
            child: SizedBox(
              width: width,
              height: 600,
              child: ReleaseDetailsView(
                release: release,
                onTapUrl: (_) async => true,
                onOpenExternal: (url) async {
                  launched.add(Uri.parse(url));
                  return true;
                },
                // The host's scroll view is the release page's; this body is
                // read on its own here, so the header and the Release Assets row
                // stand where the page puts them.
                headerBuilder: (header) => header,
                footerBuilder: (footer) => footer,
                onViewAllAssets: onViewAllAssets ?? () {},
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return launched;
}

void main() {
  testWidgets('the release name is shown even when it repeats the tag', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(name: 'v2.0.0'));
    // The tag line says which version this is and the name says what it is
    // called; a release whose name is its tag says it in both places, the way
    // the web Release Drawer does.
    expect(find.text('v2.0.0'), findsNWidgets(2));
    expect(
      find.textContaining('Release notes body', findRichText: true),
      findsOneWidget,
    );
  });

  testWidgets('a human-written release name is shown as written', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(name: 'The big one'));
    expect(find.text('The big one'), findsOneWidget);
    expect(find.text('v2.0.0'), findsOneWidget);
  });

  testWidgets('the tag line reads as GitHub’s tag glyph and the tag', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(name: 'The big one'));
    expect(find.byIcon(Icons.sell_outlined), findsOneWidget);
    // The tag is a name rather than a word of a sentence: a screen reader hears
    // the whole line from the glyph, and the words are never drawn.
    final tagLine = tester.getSemantics(find.text('v2.0.0'));
    expect(tagLine.label, contains('Tagged v2.0.0'));
  });

  testWidgets('a release is signed with its author and how long ago', (
    tester,
  ) async {
    await pumpDetails(
      tester,
      releaseWith(
        name: 'The big one',
        author: 'octocat',
        publishedAt: DateTime.now().subtract(const Duration(hours: 3)),
      ),
    );
    // One sentence, not a key-value row: the handle and the date share it, and
    // the date is the part that gives way.
    final handle = tester.getCenter(find.text('octocat'));
    final date = tester.getCenter(find.text('3 hours ago'));
    expect(date.dy, closeTo(handle.dy, 1));
    expect(date.dx, greaterThan(handle.dx));
    // The way out to GitHub is the same line's last word.
    expect(findNamedAction('Open on GitHub'), findsOneWidget);
    expect(
      tester.getCenter(findNamedAction('Open on GitHub')).dy,
      closeTo(handle.dy, 4),
    );
  });

  testWidgets('the way out to GitHub opens the release being read', (
    tester,
  ) async {
    final launched = await pumpDetails(
      tester,
      releaseWith(name: 'The big one', author: 'octocat'),
    );
    await tester.tap(findNamedAction('Open on GitHub'));
    await tester.pumpAndSettle();
    expect(
      launched.single.toString(),
      'https://github.com/octo/app/releases/tag/v2.0.0',
    );
  });

  testWidgets('a release with no author still says when it was published', (
    tester,
  ) async {
    await pumpDetails(
      tester,
      releaseWith(
        name: 'The big one',
        publishedAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
    );
    expect(find.text('Published 2 days ago'), findsOneWidget);
    expect(find.byIcon(Icons.calendar_today_outlined), findsOneWidget);
  });

  testWidgets('the assets row states how many there are and their total', (
    tester,
  ) async {
    await pumpDetails(
      tester,
      releaseWith(
        assets: [
          asset(name: 'linux.zip', size: 2048),
          asset(name: 'windows.zip', size: 1572864),
        ],
      ),
    );
    expect(find.text('2 assets · 1.5 MB'), findsOneWidget);
    // The row is a way in, not a list: the files are on the screen it opens.
    expect(find.text('linux.zip'), findsNothing);
    expect(find.text('windows.zip'), findsNothing);
  });

  testWidgets('the assets row opens below a boundary after the notes', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(assets: [asset()]));
    final notes = find.textContaining('Release notes body', findRichText: true);
    final row = find.byKey(const Key('release-assets'));
    // Breathing room, a hairline rule, then more room: the notes have visibly
    // ended rather than the row reading as their last paragraph.
    expect(
      tester.getTopLeft(row).dy - tester.getBottomLeft(notes).dy,
      greaterThan(24),
    );
  });

  testWidgets('the assets row asks its host to open the assets', (
    tester,
  ) async {
    var opened = 0;
    await pumpDetails(
      tester,
      releaseWith(assets: [asset()]),
      onViewAllAssets: () => opened++,
    );
    await tester.tap(find.byKey(const Key('release-assets')));
    await tester.pumpAndSettle();
    expect(opened, 1);
  });

  testWidgets('the assets row is announced by what it shows', (tester) async {
    await pumpDetails(tester, releaseWith(assets: [asset()]));
    // The words on the row are the count and the total; the control's name is
    // what a reader is being offered. Merged, they are one control rather than a
    // number floating beside a button.
    final row = tester.getSemantics(find.byKey(const Key('release-assets')));
    expect(row, isSemantics(isButton: true, hasTapAction: true));
    expect(row.label, contains('View all assets'));
    expect(row.label, contains('1 asset · 2 KB'));
  });

  testWidgets('a release with no assets shows no assets row at all', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith());
    expect(find.byKey(const Key('release-assets')), findsNothing);
    expect(find.textContaining('assets'), findsNothing);
  });
  testWidgets('an offline copy still says when it was saved', (tester) async {
    final savedAt = DateTime(2026, 10, 19, 12, 30);
    final publishedAt = DateTime(2026, 10, 18, 14, 43);
    await pumpDetails(
      tester,
      ReleaseDetail(
        ReleaseDetailDto(
          id: 1,
          tagName: 'v2.0.0',
          name: 'The big one',
          htmlUrl: 'https://github.com/octo/app/releases/tag/v2.0.0',
          body: 'Release notes body',
          assets: const [],
          draft: false,
          prerelease: false,
          publishedAt: publishedAt,
        ),
        'octo',
        'app',
        offline: true,
        savedAt: savedAt,
      ),
    );

    expect(
      find.textContaining('Offline · saved release notes'),
      findsOneWidget,
    );
    expect(find.textContaining('Saved'), findsOneWidget);
    // A saved copy has no author line, so the instant the release landed is
    // stated by the notice rather than lost with the account's session.
    expect(find.textContaining('Published Oct 18, 2026'), findsOneWidget);
  });

  testWidgets('the release body is the app’s surface, not Material’s faces', (
    tester,
  ) async {
    await pumpDetails(
      tester,
      releaseWith(name: 'The big one', assets: [asset()]),
      theme: gitPulseTheme(Brightness.light),
    );

    final view = find.byType(ReleaseDetailsView);
    // The release's name is set at the role a page's title takes, and the
    // assets row's label at a section label's: both are rows of the type table,
    // in the app's own tones.
    final context = tester.element(view);
    final title = tester.widget<SelectableText>(find.byType(SelectableText));
    expect(
      title.style?.fontSize,
      gitPulseTypeTableOf(context).headlineSmall.size,
    );
    expect(title.style?.color, toneTextStrong(context));
    final fold = tester.widget<Text>(find.textContaining('asset'));
    expect(fold.style?.color, toneTextMuted(context));
    expect(fold.style?.fontSize, gitPulseTypeTableOf(context).labelSmall.size);
    // And no Material face this change replaced is left in the body.
    expectNoReplacedMaterialFaces(view);
    expect(tester.takeException(), isNull);
  });
}

/// Whether anything a screen reader is given in the current tree says [text].
///
/// Read from the semantics tree itself rather than from a widget, because what
/// a widget would announce is not what a reader hears: an excluded subtree keeps
/// its own cached node while the platform is told nothing about it.
bool announces(WidgetTester tester, String text) {
  final root = tester
      .binding
      .renderViews
      .single
      .owner!
      .semanticsOwner!
      .rootSemanticsNode!;
  var heard = false;
  void visit(SemanticsNode node) {
    if (node.getSemanticsData().label.contains(text)) heard = true;
    node.visitChildren((SemanticsNode child) {
      visit(child);
      return true;
    });
  }

  visit(root);
  return heard;
}
