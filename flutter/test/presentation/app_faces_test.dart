import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/follows/release_follows_screen.dart';
import 'package:gitpulse/follows/release_follows_state.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_navigation_bar.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/settings/settings_screen.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';

import '../support/presentation_harness.dart';
import '../timeline/timeline_filter_controls_test.dart' show pumpTimeline;
import '../timeline/timeline_test_support.dart';

/// The whole client, on the app's own control layer (ADR 0032).
///
/// The per-screen tests each guard their own surface; this one is the client's
/// own statement of the settlement — the shell's three destinations and the
/// connection page a reader meets first, mounted as the real app through the
/// presentation harness, and read for the Material faces this work replaced.
/// Nothing here reads source text: every assertion is about what rendered.
void main() {
  /// The Material faces the Control Layer replaced, by the widget type a screen
  /// would mount to draw one.
  const replacedFaces = <Type>[
    FilledButton,
    ElevatedButton,
    OutlinedButton,
    TextButton,
    IconButton,
    NavigationBar,
    NavigationDestination,
    Checkbox,
    Switch,
    AlertDialog,
    Dialog,
    LinearProgressIndicator,
  ];

  /// The faces a registered Platform Dialect Exception (ADR 0032) still draws
  /// with Material's own children. They are the exception's drawing rather than
  /// a screen's control, so an occurrence underneath one is not a violation —
  /// but the list may not grow silently, and each entry here is named in that
  /// record.
  final exceptionHosts = <bool Function(Widget)>[
    // The repository pages' bar: its back affordance stays the platform's.
    (widget) => widget is AppBar,
    // The Follows sort control: a segmented choice is the platform's grammar,
    // and Material builds its segments out of `TextButton`s.
    (widget) => widget is SegmentedButton,
  ];

  bool insideRegisteredException(Element element) {
    var inside = false;
    element.visitAncestorElements((ancestor) {
      if (exceptionHosts.any((host) => host(ancestor.widget))) {
        inside = true;
        return false;
      }
      return true;
    });
    return inside;
  }

  /// Asserts that [scope] draws none of the replaced faces, and no Material
  /// progress at all.
  ///
  /// The progress assertion is by subtype rather than by type on purpose: the
  /// pull-to-refresh indicator, a registered exception, is a
  /// `CircularProgressIndicator`, so a pull in flight legitimately draws one.
  /// Every call below runs on a settled tree with no pull in flight, which is
  /// where the assertion is deterministic.
  void expectNoReplacedFaces(Finder scope) {
    for (final face in replacedFaces) {
      final strays = find
          .descendant(of: scope, matching: find.byType(face))
          .evaluate()
          .where((element) => !insideRegisteredException(element))
          .toList();
      expect(strays, isEmpty, reason: '$face is not GitPulse’s any more');
    }
    expect(
      find.descendant(
        of: scope,
        matching: find.byWidgetPredicate(
          (widget) => widget is CircularProgressIndicator,
        ),
      ),
      findsNothing,
      reason: 'progress is the app’s own indicator',
    );
  }

  /// One signed-in installation, with the three destinations' first reads
  /// answered so each destination renders its own content.
  Future<void> openApp(WidgetTester tester, {bool signedIn = true}) async {
    final harness = harnessFor(
      tester,
      connection: signedIn
          ? connectedConnection
          : () => const BackendConnectionState(),
      session: signedIn
          ? SessionState(
              phase: SessionPhase.signedIn,
              identity: signedInIdentity(),
            )
          : null,
      handlers: {
        'GET api/settings': () =>
            BackendResult(statusCode: 200, data: settingsJson(const [])),
        'GET api/starred': () => BackendResult(
          statusCode: 200,
          data: {
            'items': const <Object?>[],
            'pagination': {
              'page': 1,
              'perPage': 30,
              'hasPrev': false,
              'hasNext': false,
            },
          },
        ),
        'POST api/release-timeline/refresh': () => BackendResult(
          statusCode: 200,
          data: roundJson(
            refresh: const {
              'previousBaseline': '2026-10-01T00:00:00.000Z',
              'startedAt': '2026-10-05T00:00:00.000Z',
            },
          ),
        ),
      },
    );
    await tester.runAsync(harness.open);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: harness.container,
        child: const GitPulseApp(),
      ),
    );
    await tester.pumpAndSettle();
  }

  void useWindow(WidgetTester tester, Size size) {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.localesTestValue = [const Locale('en')];
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearAllTestValues);
  }

  Future<void> openDestination(WidgetTester tester, String label) async {
    await tester.tap(
      find.descendant(
        of: find.byType(GitPulseNavigationBar),
        matching: find.text(label),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// The one Material face a screen still mounts is the Follows sort control,
  /// and it is a registered Platform Dialect Exception rather than a gap: a
  /// segmented choice is the platform's grammar (ADR 0032).
  ///
  /// It is also why [expectNoReplacedFaces] lets an occurrence under a
  /// `SegmentedButton` through — Material builds its segments out of
  /// `TextButton`s — and it shows that the exception does not cost the reader the
  /// app's ink: the control is handed it at its call site, because the
  /// `TextButtonTheme` it wraps its segments in would shadow the theme's entry.
  void expectFollowsSortControl(WidgetTester tester) {
    final segments = find.descendant(
      of: find.byType(SegmentedButton<StarredRepositorySort>),
      matching: find.byType(TextButton),
    );
    expect(segments, findsNWidgets(2));
    final ink = tester.widget<InkWell>(
      find.descendant(of: segments.first, matching: find.byType(InkWell)).first,
    );
    expect(
      ink.overlayColor!.resolve({WidgetState.pressed}),
      Colors.transparent,
    );
    expect(
      ink.overlayColor!.resolve({WidgetState.hovered}),
      Theme.of(tester.element(segments.first)).hoverColor,
    );
  }

  testWidgets('the shell and each of its three destinations render on the '
      'app’s own faces', (tester) async {
    useWindow(tester, const Size(390, 844));
    await openApp(tester);

    for (final (label, screen) in [
      ('Timeline', TimelineScreen),
      ('Follows', ReleaseFollowsScreen),
      ('Settings', SettingsScreen),
    ]) {
      await openDestination(tester, label);
      expect(find.byType(GitPulseNavigationBar), findsOneWidget, reason: label);
      // The destination is really the one on screen, so the faces read below
      // are that destination's and not the one before it.
      expect(find.byType(screen), findsOneWidget, reason: label);
      expectNoReplacedFaces(find.byType(GitPulseApp));
      expect(tester.takeException(), isNull, reason: label);
      if (screen == ReleaseFollowsScreen) expectFollowsSortControl(tester);
    }
  });

  testWidgets('the connection page’s bar is the app’s chrome, not Material’s', (
    tester,
  ) async {
    useWindow(tester, const Size(390, 844));
    await openApp(tester, signedIn: false);

    // The bar itself stays the platform's: its behaviour is the operating
    // system's contract with the reader (ADR 0032). What it is *drawn* with is
    // the app's, and that is what these read — the `Material` the bar renders
    // and the paragraph its title renders, not the arguments it was handed.
    final context = tester.element(find.byType(AppBar));
    final theme = Theme.of(context);
    final surface = tester.widget<Material>(
      find
          .descendant(of: find.byType(AppBar), matching: find.byType(Material))
          .first,
    );

    expect(surface.color, toneSurface(context));
    expect(surface.elevation, 0);
    // No Material 3 scroll tint: a page that scrolls under the bar does not
    // wash it in the Accent.
    expect(surface.surfaceTintColor?.a, 0);
    expect(surface.shape, isNot(isNull));

    // One hairline, the way the app separates its chrome from the page it
    // stands on — the rule the navigation bar already draws.
    expect(
      (surface.shape! as Border).bottom,
      BorderSide(color: toneBorder(context), width: GitPulseStroke.hairline),
    );
    // The elevation the bar keeps while a page scrolls under it, which is the
    // whole of what stops Material raising and tinting it.
    expect(theme.appBarTheme.scrolledUnderElevation, 0);

    // The title is the type table's, at the role a surface's title takes.
    final title = tester.renderObject<RenderParagraph>(find.text('GitPulse'));
    expect(
      title.text.style?.fontSize,
      gitPulseTypeSurfaceTitle(context)?.fontSize,
    );
    expect(title.text.style?.color, toneTextStrong(context));

    expectNoReplacedFaces(find.byType(GitPulseApp));
    expect(tester.takeException(), isNull);
  });

  testWidgets('the date picker keeps the platform’s calendar and the app’s '
      'ink', (tester) async {
    // The picker is the one surface where a reader still operates Material's
    // own buttons, so it is also the reason the theme keeps two of its button
    // entries. This reads the picker as it renders: its calendar and its
    // behaviour stay the platform's, its tone and its ink are the app's.
    await pumpTimeline(
      tester,
      size: const Size(390, 844),
      handlers: {
        'GET api/settings': () => BackendResult(
          statusCode: 200,
          data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
        ),
        'POST api/release-timeline/refresh': () => BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(1, 'v1.0', '2026-10-12T10:00:00Z', name: 'A'),
              ]),
            },
            refresh: {
              'previousBaseline': '2026-10-10T00:00:00.000Z',
              'startedAt': '2026-10-20T00:00:00.000Z',
            },
          ),
        ),
      },
    );
    final l10n = AppLocalizations.of(
      tester.element(find.byType(TimelineScreen)),
    );
    await tester.tap(find.byTooltip(l10n.timelineFilters));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byTooltip(l10n.timelineFilterFrom(l10n.timelineFilterAnyDate)),
    );
    await tester.pumpAndSettle();

    final picker = find.byType(DatePickerDialog);
    expect(picker, findsOneWidget);
    final context = tester.element(picker);

    // Its surface is the app's overlay tone, not a Material component's own.
    final surface = tester.widget<Material>(
      find.descendant(of: picker, matching: find.byType(Material)).first,
    );
    expect(surface.color, toneSurface(context));

    // Its own buttons are the two Material families the theme still inks.
    final actions = find.descendant(
      of: picker,
      matching: find.byType(TextButton),
    );
    expect(actions, findsWidgets);
    final toggle = find.descendant(
      of: picker,
      matching: find.byType(IconButton),
    );
    expect(toggle, findsWidgets);
    final ink = tester.widget<InkWell>(
      find.descendant(of: actions.first, matching: find.byType(InkWell)).first,
    );
    expect(
      ink.overlayColor!.resolve({WidgetState.pressed}),
      Colors.transparent,
      reason: 'the app’s press rule reaches the picker’s own actions',
    );
    expect(
      ink.overlayColor!.resolve({WidgetState.hovered}),
      Theme.of(context).hoverColor,
    );

    // Nothing else of Material's button or dialog families is left anywhere in
    // the client while the picker is open.
    for (final face in [
      FilledButton,
      ElevatedButton,
      OutlinedButton,
      AlertDialog,
      NavigationBar,
      Checkbox,
      Switch,
    ]) {
      expect(find.byType(face), findsNothing, reason: '$face');
    }
  });
}
