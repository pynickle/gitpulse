import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/releases/release_detail_dto.dart';
import 'package:gitpulse/releases/release_detail_service.dart';
import 'package:gitpulse/releases/release_details_view.dart';

ReleaseDetail releaseWith({String? name, String tag = 'v2.0.0'}) =>
    ReleaseDetail(
      ReleaseDetailDto(
        id: 1,
        tagName: tag,
        name: name,
        htmlUrl: 'https://github.com/octo/app/releases/tag/$tag',
        body: 'Release notes body',
        assets: const [],
        draft: false,
        prerelease: false,
      ),
      'octo',
      'app',
    );

Future<void> pumpDetails(WidgetTester tester, ReleaseDetail release) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            child: ReleaseDetailsView(
              release: release,
              onTapUrl: (_) async => true,
              onOpenExternal: (_) async => true,
            ),
          ),
        ),
      ),
    ),
  );
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
}
