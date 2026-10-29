import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'connection/connection_controller.dart';
import 'connection/connection_screen.dart';
import 'device/device_preferences_controller.dart';
import 'l10n/generated/app_localizations.dart';
import 'presentation/gitpulse_navigation_bar.dart';
import 'presentation/gitpulse_theme.dart';
import 'presentation/gitpulse_tokens.dart';
import 'presentation/gitpulse_state_views.dart';
import 'session/session_controller.dart';
import 'session/session_notice.dart';
import 'settings/account_gate.dart';
import 'settings/settings_screen.dart';
import 'timeline/timeline_screen.dart';
import 'timeline/timeline_cache_lifecycle.dart';
import 'follows/release_follows_screen.dart';
import 'releases/repository_releases_screen.dart';
import 'repositories/repository_screen.dart';

/// The shell destinations, in bottom-bar order.
const _destinationPaths = ['/timeline', '/follows', '/settings'];
const _settingsDestination = 2;

/// The destination a location stands on, or the first one for a location the bar
/// does not offer.
int _destinationIndex(String path) {
  final index = _destinationPaths.indexOf(path);
  return index < 0 ? 0 : index;
}

/// One destination's page.
///
/// The shell owns the bar, so a switch never takes the bar off the screen: the
/// bar's active step travels to the destination chosen while this page crosses
/// over the one it replaces, over the same duration and on the same curve. The
/// page is opaque — it stands on the page's own tone rather than showing the
/// screen beneath it — so the two cross from one to the other instead of both
/// showing through each other, and the one being replaced stays drawn until the
/// arrival is complete. Nothing about the page moves: a destination is not a
/// place reached by travelling sideways, it is the same shell showing another
/// place (ADR 0034).
CustomTransitionPage<void> _destinationPage(
  BuildContext context, {
  required LocalKey key,
  required int index,
}) {
  return CustomTransitionPage<void>(
    key: key,
    child: _DestinationContent(index: index),
    // Reduced motion is the tap's own frame: no travel, no crossing, and no
    // route left running behind the reader.
    transitionDuration: gitPulseDestinationTurn(context),
    // A destination page is never popped: the shell replaces it with the next
    // one, which is the transition above.
    reverseTransitionDuration: Duration.zero,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(
        opacity: animation.drive(CurveTween(curve: gitPulseDestinationCurve)),
        child: ColoredBox(color: tonePage(context), child: child),
      );
    },
  );
}

final _routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    redirect: (context, state) {
      final connected =
          ref.read(connectionControllerProvider).value?.backend != null;
      if (!connected && state.uri.path != '/') return '/';
      if (connected && state.uri.path == '/') return '/timeline';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const ConnectionScreen()),
      GoRoute(
        path: '/repositories/:owner/:repository',
        builder: (context, state) => RepositoryScreen(
          owner: state.pathParameters['owner']!,
          repository: state.pathParameters['repository']!,
        ),
      ),
      GoRoute(
        path: '/repositories/:owner/:repository/releases',
        builder: (context, state) => RepositoryReleasesScreen(
          owner: state.pathParameters['owner']!,
          repository: state.pathParameters['repository']!,
        ),
      ),
      // The three places the bar offers are the shell's children rather than
      // pages of their own: the bar belongs to the shell, so it survives the
      // switch and can answer it (ADR 0034).
      ShellRoute(
        builder: (context, state, child) =>
            _AppShell(index: _destinationIndex(state.uri.path), child: child),
        routes: [
          for (final (index, path) in _destinationPaths.indexed)
            GoRoute(
              path: path,
              pageBuilder: (context, state) =>
                  _destinationPage(context, key: state.pageKey, index: index),
            ),
        ],
      ),
    ],
  );
  ref.listen(
    connectionControllerProvider.select((state) => state.value?.backend),
    (_, next) {
      router.refresh();
    },
  );
  ref.onDispose(router.dispose);
  return router;
});

class GitPulseApp extends ConsumerWidget {
  const GitPulseApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Keep the session lifecycle alive across the connection screen so logout
    // and backend changes finish after the shell route is gone.
    final session = ref.watch(sessionControllerProvider);
    final connection = ref.watch(connectionControllerProvider);
    final restoring =
        connection.isLoading ||
        (connection.value?.backend != null &&
            session.phase == SessionPhase.restoring);
    ref.watch(timelineCacheLifecycleProvider);
    // Language, appearance and the retention window are device-local: they
    // apply to every surface, including the connection screen, before any
    // backend or session exists.
    final device = ref.watch(devicePreferencesStateProvider);
    return MaterialApp.router(
      title: 'GitPulse',
      debugShowCheckedModeBanner: false,
      theme: gitPulseTheme(Brightness.light),
      darkTheme: gitPulseTheme(Brightness.dark),
      themeMode: device.preferences.themeMode,
      locale: device.preferences.locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => restoring
          ? Scaffold(
              body: SafeArea(
                child: GitPulseLoadingView(
                  label: AppLocalizations.of(context).connecting,
                ),
              ),
            )
          : child!,
      routerConfig: ref.watch(_routerProvider),
    );
  }
}

/// Keeps transient session notices visible beside the signed-in destination.
class _SignedInTab extends StatelessWidget {
  const _SignedInTab({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SessionNotice(),
        Expanded(child: child),
      ],
    );
  }
}

/// What one destination shows: Settings always, and either the signed-in page or
/// the account gate on the two destinations that need a session.
class _DestinationContent extends ConsumerWidget {
  const _DestinationContent({required this.index});

  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn =
        ref.watch(sessionControllerProvider).phase == SessionPhase.signedIn;
    return switch (index) {
      _settingsDestination => const SettingsScreen(),
      0 =>
        signedIn
            ? const _SignedInTab(child: TimelineScreen())
            : const AccountGate(),
      _ =>
        signedIn
            ? const _SignedInTab(child: ReleaseFollowsScreen())
            : const AccountGate(),
    };
  }
}

/// The frame every destination is shown in: the page the shell is on, and the
/// bar that says which of them it is.
class _AppShell extends ConsumerWidget {
  const _AppShell({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final backend = ref.watch(connectionControllerProvider).value?.backend;
    if (backend == null) return const SizedBox.shrink();
    final labels = [l10n.timeline, l10n.follows, l10n.settings];
    const icons = [
      Icons.view_timeline_outlined,
      Icons.bookmarks_outlined,
      Icons.settings_outlined,
    ];
    void navigate(int index) => context.go(_destinationPaths[index]);

    return Scaffold(
      body: SafeArea(bottom: false, child: child),
      // The shell's three places, in the app's own bar (ADR 0032): one
      // destination per label, and one step that stands over the current one.
      bottomNavigationBar: GitPulseNavigationBar(
        selectedIndex: index,
        onDestinationSelected: navigate,
        destinations: [
          for (var i = 0; i < labels.length; i++)
            GitPulseNavigationDestination(icon: icons[i], label: labels[i]),
        ],
      ),
    );
  }
}
