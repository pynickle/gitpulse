import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/releases/release_detail_dto.dart';
import 'package:gitpulse/releases/release_detail_service.dart';
import 'package:gitpulse/releases/release_details_view.dart';

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
}) async {
  final launched = <Uri>[];
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: Align(
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: width,
              child: SingleChildScrollView(
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
}
