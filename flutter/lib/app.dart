import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'connection/connection_controller.dart';
import 'connection/connection_screen.dart';
import 'device/device_preferences_controller.dart';
import 'l10n/generated/app_localizations.dart';
import 'presentation/gitpulse_theme.dart';
import 'presentation/gitpulse_state_views.dart';
import 'session/session_controller.dart';
import 'session/session_notice.dart';
import 'settings/account_panel.dart';
import 'settings/settings_screen.dart';
import 'timeline/timeline_screen.dart';
import 'timeline/timeline_cache_lifecycle.dart';
import 'follows/release_follows_screen.dart';
import 'releases/repository_releases_screen.dart';
import 'repositories/repository_screen.dart';

/// The shell destinations, in bottom-bar order.
const _destinationPaths = ['/timeline', '/follows', '/settings'];
const _settingsDestination = 2;

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
      for (final (index, path) in _destinationPaths.indexed)
        GoRoute(
          path: path,
          builder: (context, state) => _AppShell(index: index),
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
Widget _destination(int index, {required bool signedIn}) => switch (index) {
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

class _AppShell extends ConsumerWidget {
  const _AppShell({required this.index});

  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final backend = ref.watch(connectionControllerProvider).value?.backend;
    final session = ref.watch(sessionControllerProvider);
    if (backend == null) return const SizedBox.shrink();
    final labels = [l10n.timeline, l10n.follows, l10n.settings];
    const icons = [
      Icons.view_timeline_outlined,
      Icons.bookmarks_outlined,
      Icons.settings_outlined,
    ];
    void navigate(int index) => context.go(_destinationPaths[index]);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: _destination(
          index,
          signedIn: session.phase == SessionPhase.signedIn,
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: navigate,
        destinations: [
          for (var i = 0; i < labels.length; i++)
            NavigationDestination(icon: Icon(icons[i]), label: labels[i]),
        ],
      ),
    );
  }
}
