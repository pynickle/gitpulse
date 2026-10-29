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

ReleaseDetail releaseWith({
  String? name,
  String tag = 'v2.0.0',
  String body = 'Release notes body',
  List<ReleaseAssetDto> assets = const [],
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

/// Pumps the reading body, collecting every browser launch it asks for.
Future<List<Uri>> pumpDetails(
  WidgetTester tester,
  ReleaseDetail release, {
  double width = 420,
  ThemeData? theme,
  bool reduceMotion = false,
}) async {
  final launched = <Uri>[];
  await tester.pumpWidget(
    ProviderScope(
      overrides: documentViewerOverrides(),
      child: MaterialApp(
        theme: theme,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => reduceMotion
            ? MediaQuery(
                data: MediaQuery.of(context).copyWith(disableAnimations: true),
                child: child!,
              )
            : child!,
        home: Scaffold(
          body: Align(
            alignment: Alignment.topLeft,
            // The notes own their own scroll, so the body is given the height a
            // drawer gives it rather than an unbounded scroll parent.
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

Future<void> openAssets(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('release-assets')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the release name is shown even when it repeats the tag', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(name: 'v2.0.0'));
    expect(find.text('v2.0.0'), findsOneWidget);
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
    expect(find.text('v2.0.0'), findsNothing);
  });

  testWidgets('the fold row states how many assets there are and their total', (
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
    // Nothing is listed until the reader opens the module.
    expect(find.text('linux.zip'), findsNothing);
    expect(find.text('windows.zip'), findsNothing);
  });

  testWidgets('the asset section opens below a boundary after the notes', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(assets: [asset()]));
    final notes = find.textContaining('Release notes body', findRichText: true);
    final fold = find.byKey(const Key('release-assets'));
    // Breathing room, a hairline rule, then more room: the notes have visibly
    // ended rather than the fold row reading as their last paragraph.
    expect(
      tester.getTopLeft(fold).dy - tester.getBottomLeft(notes).dy,
      greaterThan(24),
    );
  });

  testWidgets('opening the module reveals one row per Release Asset', (
    tester,
  ) async {
    await pumpDetails(
      tester,
      releaseWith(
        assets: [
          asset(name: 'linux.zip'),
          asset(name: 'windows.zip'),
          asset(name: 'app.zip.minisig', size: 512),
        ],
      ),
    );
    await openAssets(tester);
    expect(find.text('linux.zip'), findsOneWidget);
    expect(find.text('windows.zip'), findsOneWidget);
    expect(find.text('app.zip.minisig'), findsOneWidget);
  });

  testWidgets('the module rises onto the reading area rather than appearing', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(assets: [asset()]));
    await tester.tap(find.byKey(const Key('release-assets')));
    // The first frame after the tap: the module is already mounted and still
    // the registered rise below the place it comes to rest.
    await tester.pump();
    final row = find.text('app.zip');
    expect(row, findsOneWidget);
    final arriving = tester.getTopLeft(row).dy;
    await tester.pumpAndSettle();
    expect(
      arriving - tester.getTopLeft(row).dy,
      moreOrLessEquals(GitPulseMotion.assetsRevealShift),
    );
  });

  testWidgets('the notes stay mounted under the module and come back to it', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(assets: [asset()]));
    final notes = find.textContaining('Release notes body', findRichText: true);
    final document = tester.element(notes);
    await openAssets(tester);
    expect(find.text('app.zip'), findsOneWidget);
    // The notes are covered, not thrown away: the element the renderer lives in
    // is the same one, so folding the module away returns to the page the
    // reader left instead of rendering the document again.
    expect(identical(tester.element(notes), document), isTrue);
    await tester.tap(find.byKey(const Key('release-assets')));
    await tester.pump();
    // Covered on the way out too, so the notes never show through a leaving
    // list.
    expect(find.text('app.zip'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('app.zip'), findsNothing);
    expect(identical(tester.element(notes), document), isTrue);
  });

  testWidgets('the module folds away faster than it arrives', (tester) async {
    await pumpDetails(tester, releaseWith(assets: [asset()]));
    await openAssets(tester);
    await tester.tap(find.byKey(const Key('release-assets')));
    await tester.pump();
    // Still on screen on the frame the tap lands, and still leaving halfway
    // through the fold...
    final row = find.text('app.zip');
    expect(row, findsOneWidget);
    await tester.pump(gitPulseAssetsFold ~/ 2);
    expect(row, findsOneWidget);
    // ...then gone, inside a fold — sooner than the notes took to be covered.
    await tester.pump(gitPulseAssetsFold);
    expect(row, findsNothing);
    expect(gitPulseAssetsFold, lessThan(gitPulseAssetsReveal));
  });

  testWidgets('a row answers a tap only once the module has come to rest', (
    tester,
  ) async {
    final launched = await pumpDetails(tester, releaseWith(assets: [asset()]));
    await tester.tap(find.byKey(const Key('release-assets')));
    await tester.pump();
    final row = find.text('app.zip');
    await tester.pump(gitPulseAssetsReveal ~/ 2);
    // Halfway in the row is already where the reader can see it, but it is
    // still arriving: a tap there must not start a download from a list that
    // has not landed yet.
    await tester.tapAt(tester.getCenter(row));
    await tester.pumpAndSettle();
    expect(launched, isEmpty);
    // At rest, the same row is the download it looks like.
    await tester.tapAt(tester.getCenter(row));
    await tester.pumpAndSettle();
    expect(launched, hasLength(1));
  });
  testWidgets('reduced motion puts the module in place without travelling', (
    tester,
  ) async {
    await pumpDetails(
      tester,
      releaseWith(assets: [asset()]),
      reduceMotion: true,
    );
    await tester.tap(find.byKey(const Key('release-assets')));
    await tester.pump();
    final row = find.text('app.zip');
    final placed = tester.getTopLeft(row).dy;
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(row).dy, placed);
    // And it folds away in the same tap rather than fading out.
    await tester.tap(find.byKey(const Key('release-assets')));
    await tester.pumpAndSettle();
    expect(find.text('app.zip'), findsNothing);
  });

  testWidgets('the module covers the notes for a screen reader too', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await pumpDetails(tester, releaseWith(assets: [asset()]));
    expect(announces(tester, 'Release notes body'), isTrue);
    await openAssets(tester);
    // What the reader cannot see is not read out beside the module.
    expect(announces(tester, 'Release notes body'), isFalse);
    expect(announces(tester, 'app.zip'), isTrue);
    semantics.dispose();
  });

  testWidgets(
    'an asset row carries its size and download count and nothing else',
    (tester) async {
      final launched = await pumpDetails(
        tester,
        releaseWith(
          assets: [
            asset(
              name: 'app.zip',
              size: 22740992,
              downloadCount: 1237,
              label: 'Desktop build',
              contentType: 'application/x-msdownload',
              updatedAt: DateTime.utc(2026, 10, 20),
            ),
          ],
        ),
      );
      await openAssets(tester);
      expect(find.text('21.7 MB · 1,237 downloads'), findsOneWidget);
      // Everything that does not help a reader choose is gone: the MIME type,
      // the per-asset date, the deprecated label and the per-request footnote.
      expect(find.textContaining('application/x-msdownload'), findsNothing);
      expect(find.textContaining('Oct 20, 2026'), findsNothing);
      expect(find.textContaining('Desktop build'), findsNothing);
      expect(find.textContaining('this request'), findsNothing);
      expect(launched, isEmpty);
    },
  );

  testWidgets('an asset of unknown size shows its download count alone', (
    tester,
  ) async {
    await pumpDetails(
      tester,
      releaseWith(assets: [asset(name: 'app.zip', size: 0, downloadCount: 5)]),
    );
    await openAssets(tester);
    expect(find.text('5 downloads'), findsOneWidget);
    expect(find.textContaining('0 B'), findsNothing);
    // A single asset with no known size leaves the fold row its count.
    expect(find.textContaining('1 asset'), findsOneWidget);
  });

  testWidgets('a long filename is shown in full rather than cut short', (
    tester,
  ) async {
    const name = 'gitpulse-0.9.0-x86_64-unknown-linux-gnu.tar.gz.minisig';
    await pumpDetails(tester, releaseWith(assets: [asset(name: name)]));
    await openAssets(tester);
    final filename = find.text(name);
    expect(filename, findsOneWidget);
    // It wraps over more than one line instead of losing its distinguishing
    // suffix to an ellipsis.
    expect(tester.getSize(filename).height, greaterThan(24));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a release with no assets shows no asset section at all', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith());
    expect(find.byKey(const Key('release-assets')), findsNothing);
    expect(find.textContaining('assets'), findsNothing);
  });

  testWidgets('the fold row is announced as a button reporting its state', (
    tester,
  ) async {
    await pumpDetails(tester, releaseWith(assets: [asset()]));
    expect(
      tester.getSemantics(find.byKey(const Key('release-assets'))),
      isSemantics(
        label: '1 asset · 2 KB',
        isButton: true,
        hasExpandedState: true,
        isExpanded: false,
        hasTapAction: true,
      ),
    );
    await openAssets(tester);
    expect(
      tester.getSemantics(find.byKey(const Key('release-assets'))),
      isSemantics(isExpanded: true),
    );
  });

  testWidgets(
    'an asset row is announced with its name and its download action',
    (tester) async {
      await pumpDetails(tester, releaseWith(assets: [asset()]));
      await openAssets(tester);
      final semantics = tester.getSemantics(find.text('app.zip'));
      expect(semantics.label, contains('app.zip'));
      expect(semantics.label, contains('2 KB · 7 downloads'));
      expect(semantics, isSemantics(hasTapAction: true, isButton: true));
      expect(semantics.hint, 'Download in browser');
    },
  );

  testWidgets('an asset with no safe download address offers no action', (
    tester,
  ) async {
    final launched = await pumpDetails(
      tester,
      releaseWith(
        assets: [
          asset(name: 'app.zip', browserDownloadUrl: 'javascript:alert(1)'),
        ],
      ),
    );
    await openAssets(tester);
    expect(find.text('app.zip'), findsOneWidget);
    final semantics = tester.getSemantics(find.text('app.zip'));
    expect(semantics, isSemantics(hasTapAction: false));
    expect(semantics.hint, isEmpty);
    await tester.tap(find.text('app.zip'));
    await tester.pumpAndSettle();
    expect(launched, isEmpty);
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
    expect(find.textContaining('Oct 18, 2026'), findsWidgets);
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
    // The release's name is a surface's title and the assets fold is a section
    // label: both are rows of the type table, in the app's own tones.
    final context = tester.element(view);
    final title = tester.widget<SelectableText>(find.byType(SelectableText));
    expect(
      title.style?.fontSize,
      gitPulseTypeTableOf(context).titleMedium.size,
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
