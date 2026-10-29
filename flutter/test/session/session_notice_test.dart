import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/session/session_notice.dart';

import '../support/presentation_harness.dart';

/// The session's own trouble is stated on every surface that carries a session,
/// so it is one line in the app's own tone and type — the danger tone, because a
/// sign-in that did not finish is a fault, and the type table's meta role
/// (ADR 0031).
void main() {
  testWidgets('the session notice is a failure line in the app’s own tone', (
    tester,
  ) async {
    final harness = harnessFor(
      tester,
      session: const SessionState(
        phase: SessionPhase.signedOut,
        failure: SignInFailure.invalidCredentials,
      ),
    );
    await tester.runAsync(harness.open);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: harness.container,
        child: MaterialApp(
          theme: gitPulseTheme(Brightness.light),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: SessionNotice()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(SessionNotice), findsOneWidget);
    final line = tester.widget<Text>(
      find.descendant(
        of: find.byType(SessionNotice),
        matching: find.byType(Text),
      ),
    );
    final context = tester.element(find.byType(SessionNotice));
    expect(line.style?.color, toneDanger(context));
    // The notice is the type table's meta line, not a role read at the call
    // site.
    expect(line.style?.fontSize, gitPulseTypeTableOf(context).bodySmall.size);
    // A line that arrives on its own is announced.
    expect(
      find.descendant(
        of: find.byType(SessionNotice),
        matching: find.byWidgetPredicate(
          (widget) =>
              widget is Semantics && widget.properties.liveRegion == true,
        ),
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
