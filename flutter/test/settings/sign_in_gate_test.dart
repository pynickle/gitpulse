import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/backend_service.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/connection/native_capabilities.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_setting_rows.dart';
import 'package:gitpulse/settings/account_gate.dart';

import '../support/material_faces.dart';
import '../support/presentation_harness.dart';

/// A backend that offers both kinds of sign-in, which is the only shape that
/// draws the page's two cards and the word between them.
const _hybrid = NativeCapabilities(
  protocolVersion: 1,
  capabilities: [
    'provider-discovery',
    'release-timeline',
    'native-login-handoff',
  ],
  providers: SignInProviders(
    personalMode: false,
    patEnabled: true,
    oauthEnabled: true,
    mode: 'hybrid',
  ),
);

BackendConnectionState _hybridConnection() => BackendConnectionState(
  rememberedAddress: 'https://gitpulse.example/',
  backend: ConnectedBackend(Uri.parse('https://gitpulse.example/'), _hybrid),
);

/// A backend that takes one secret, so the page has one way in and no divider.
BackendConnectionState _tokenConnection() => BackendConnectionState(
  rememberedAddress: 'https://gitpulse.example/',
  backend: ConnectedBackend(
    Uri.parse('https://gitpulse.example/'),
    const NativeCapabilities(
      protocolVersion: 1,
      capabilities: ['provider-discovery', 'release-timeline'],
      providers: SignInProviders(
        personalMode: false,
        patEnabled: true,
        oauthEnabled: false,
        mode: 'pat',
      ),
    ),
  ),
);

/// Mounts the app signed out on a backend reached before any sign-in, which is
/// where the gate is the whole page.
Future<void> _openGate(
  WidgetTester tester, {
  BackendConnectionState Function() connection = _hybridConnection,
  double textScale = 1,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.localesTestValue = [const Locale('en')];
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.platformDispatcher.clearAllTestValues);
  final harness = harnessFor(tester, connection: connection);
  await tester.runAsync(harness.open);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: harness.container,
      child: const GitPulseApp(),
    ),
  );
  await tester.pumpAndSettle();
}

/// The one card a method is drawn on.
Finder _cardOf(String method) => find.ancestor(
  of: find.text(method),
  matching: find.byType(GitPulseSettingSurface),
);

void main() {
  testWidgets('every way in is its own card, with the word for "or" between '
      'them', (tester) async {
    await _openGate(tester);
    expect(find.byType(AccountGate), findsOneWidget);

    // The backend opens the page instead of framing it: its own header, its
    // address, and the action that leaves it, none of them inside a card.
    expect(find.text('Backend'), findsOneWidget);
    expect(find.text('Connected'), findsOneWidget);
    expect(find.text('https://gitpulse.example/'), findsOneWidget);
    expect(
      find.ancestor(
        of: find.text('Backend'),
        matching: find.byType(GitPulseSettingSurface),
      ),
      findsNothing,
    );
    expect(
      find.widgetWithText(GitPulseButton, 'Change backend'),
      findsOneWidget,
    );
    // The header is centred on the page rather than pinned to a leading edge.
    final change = tester.getRect(
      find.widgetWithText(GitPulseButton, 'Change backend'),
    );
    expect(change.center.dx, closeTo(390 / 2, 1));

    // Two cards, one per method, each carrying its own mark and the line that
    // says what it will ask for…
    final tokenCard = _cardOf('Sign in with a token');
    expect(tokenCard, findsOneWidget);
    expect(
      find.descendant(
        of: tokenCard,
        matching: find.byIcon(Icons.vpn_key_outlined),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: tokenCard,
        matching: find.text(
          'A token that can read the repositories you follow.',
        ),
      ),
      findsOneWidget,
    );
    final gitPulseCard = _cardOf('Sign in with GitPulse');
    expect(gitPulseCard, findsOneWidget);
    expect(
      find.descendant(
        of: gitPulseCard,
        matching: find.byIcon(Icons.open_in_browser),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: gitPulseCard,
        matching: find.text(
          'Approve the sign-in in your browser; this app finishes it.',
        ),
      ),
      findsOneWidget,
    );

    // …and both cards hold their own control, so nothing above them is a
    // selection the reader makes first.
    expect(
      find.descendant(
        of: tokenCard,
        matching: find.widgetWithText(GitPulseButton, 'Continue'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: gitPulseCard,
        matching: find.widgetWithText(GitPulseButton, 'Continue with GitPulse'),
      ),
      findsOneWidget,
    );
    // …and the whole surface is drawn on the app's own faces, by the one list
    // every screen's test shares (ADR 0032).
    expectNoReplacedMaterialFaces(find.byType(AccountGate));

    // The divider sits between the two cards rather than beside either.
    final token = tester.getRect(find.text('Sign in with a token'));
    final divider = tester.getRect(find.text('Or'));
    final gitPulse = tester.getRect(find.text('Sign in with GitPulse'));
    expect(token.bottom, lessThan(divider.top));
    expect(divider.bottom, lessThan(gitPulse.top));
    expect(tester.takeException(), isNull);
  });

  testWidgets('one method draws one card and no divider', (tester) async {
    await _openGate(tester, connection: _tokenConnection);

    expect(_cardOf('Sign in with a token'), findsOneWidget);
    expect(find.text('Sign in with GitPulse'), findsNothing);
    expect(find.text('Or'), findsNothing);
    // The address is still the page's header, above the card.
    expect(
      tester.getRect(find.text('Backend')).bottom,
      lessThan(tester.getRect(find.text('Sign in with a token')).top),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('large text wraps each card instead of clipping it', (
    tester,
  ) async {
    await _openGate(tester, textScale: 2);

    // Both cards stay inside the window and keep their order, one above the
    // other: the page grows and scrolls rather than clipping a card.
    final token = tester.getRect(_cardOf('Sign in with a token'));
    final gitPulse = tester.getRect(_cardOf('Sign in with GitPulse'));
    for (final card in [token, gitPulse]) {
      expect(card.left, greaterThanOrEqualTo(0));
      expect(card.right, lessThanOrEqualTo(390));
    }
    expect(token.bottom, lessThanOrEqualTo(gitPulse.top));
    expect(find.text('Sign in with a token'), findsOneWidget);
    expect(find.text('Sign in with GitPulse'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
