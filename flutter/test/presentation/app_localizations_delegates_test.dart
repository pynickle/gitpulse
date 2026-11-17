import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/app_localizations_delegates.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:material_ui/material_ui.dart';

/// Flutter 3.50 deprecated the design libraries inside the SDK, and the generated
/// `AppLocalizations.localizationsDelegates` still names the deprecated
/// `flutter_localizations` delegates. Those provide no `MaterialLocalizations` to a
/// `package:material_ui` app at all, so passing the generated list leaves every
/// Material-facing string missing — silently, because `MaterialApp` falls back to
/// English defaults rather than throwing. This asserts the app's own list answers a
/// non-English locale through the migrated library.
void main() {
  testWidgets('the app delegate list localizes Material through material_ui', (
    tester,
  ) async {
    late MaterialLocalizations material;
    late AppLocalizations strings;
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: appLocalizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) {
            material = MaterialLocalizations.of(context);
            strings = AppLocalizations.of(context);
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    expect(material.modalBarrierDismissLabel, '关闭');
    expect(strings.timeline, '时间线');
  });

  test('every global design delegate comes from the standalone package', () {
    // The generated list is what a future gen-l10n release should emit itself
    // (flutter/flutter#194500). Until then the app's list must not contain a
    // delegate that leaves MaterialLocalizations unresolved.
    expect(appLocalizationsDelegates, contains(AppLocalizations.delegate));
    expect(
      appLocalizationsDelegates.length,
      AppLocalizations.localizationsDelegates.length,
      reason: 'the app replaces the generated global delegates one for one',
    );
  });
}
