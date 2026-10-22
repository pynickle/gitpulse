import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'connection/connection_controller.dart';
import 'connection/connection_screen.dart';
import 'l10n/generated/app_localizations.dart';
import 'presentation/gitpulse_theme.dart';
import 'presentation/presentation_preferences_controller.dart';
import 'presentation/presentation_settings.dart';
import 'session/session_controller.dart';
import 'session/sign_in_panel.dart';
import 'timeline/timeline_screen.dart';
import 'timeline/timeline_cache_lifecycle.dart';
import 'follows/release_follows_screen.dart';
import 'releases/repository_releases_screen.dart';
import 'repositories/repository_screen.dart';
import 'settings/timeline_cache_settings.dart';

/// The shell destinations, in navigation-rail and bottom-bar order.
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
    ref.listen(sessionControllerProvider, (_, _) {});
    ref.watch(timelineCacheLifecycleProvider);
    // Language and appearance are device-local: they apply to every surface,
    // including the connection screen, before any backend or session exists.
    final presentation = ref.watch(presentationPreferencesStateProvider);
    return MaterialApp.router(
      title: 'GitPulse',
      debugShowCheckedModeBanner: false,
      theme: gitPulseTheme(Brightness.light),
      darkTheme: gitPulseTheme(Brightness.dark),
      themeMode: presentation.preferences.themeMode,
      locale: presentation.preferences.locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) {
        // Typography follows the resolved app language, so an explicit
        // language choice also chooses the Chinese or Latin typeface.
        return Theme(
          data: gitPulseTypography(
            Theme.of(context),
            locale: Localizations.localeOf(context),
          ),
          child: child!,
        );
      },
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

class _AppShell extends ConsumerWidget {
  const _AppShell({required this.index});

  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final connection = ref.watch(connectionControllerProvider).value;
    final session = ref.watch(sessionControllerProvider);
    final backend = connection?.backend;
    if (backend == null) return const SizedBox.shrink();
    final providers = backend.capabilities.providers;
    final labels = [l10n.timeline, l10n.follows, l10n.settings];
    const icons = [
      Icons.view_timeline_outlined,
      Icons.bookmarks_outlined,
      Icons.settings_outlined,
    ];
    void navigate(int index) => context.go(_destinationPaths[index]);

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 720;
        return Scaffold(
          body: SafeArea(
            bottom: false,
            child: Row(
              children: [
                if (wide)
                  NavigationRail(
                    selectedIndex: index,
                    onDestinationSelected: navigate,
                    labelType: NavigationRailLabelType.all,
                    destinations: [
                      for (var i = 0; i < labels.length; i++)
                        NavigationRailDestination(
                          icon: Icon(icons[i]),
                          label: Text(labels[i]),
                        ),
                    ],
                  ),
                Expanded(
                  child: index < 2 && session.phase == SessionPhase.signedIn
                      ? _SignedInTab(
                          child: index == 0
                              ? const TimelineScreen()
                              : const ReleaseFollowsScreen(),
                        )
                      : SingleChildScrollView(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                l10n.compatibleBackend,
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              SelectableText(backend.address.toString()),
                              if (connection?.problem case final problem?)
                                Text(connectionProblemLabel(l10n, problem)),
                              const SizedBox(height: 24),
                              Text(
                                l10n.availableProviders,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                children: [
                                  if (providers.personalMode)
                                    Chip(label: Text(l10n.personalPassword)),
                                  if (providers.patEnabled)
                                    Chip(label: Text(l10n.personalAccessToken)),
                                  if (backend.capabilities.supportsNativeLogin)
                                    Chip(label: Text(l10n.githubOAuth)),
                                ],
                              ),
                              const SignInPanel(),
                              const SizedBox(height: 24),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: OutlinedButton(
                                  onPressed: session.busy
                                      ? null
                                      : () async {
                                          final address =
                                              await showBackendAddressEditor(
                                                context,
                                                backend.address.toString(),
                                              );
                                          if (address == null ||
                                              !context.mounted ||
                                              Uri.parse(address) ==
                                                  backend.address) {
                                            return;
                                          }
                                          await ref
                                              .read(
                                                sessionControllerProvider
                                                    .notifier,
                                              )
                                              .leaveBackend(address: address);
                                        },
                                  child: Text(l10n.changeBackend),
                                ),
                              ),
                              // Presentation choices follow the account section
                              // in Settings and stay available while signed out.
                              if (index == _settingsDestination) ...[
                                const Divider(height: 32),
                                const PresentationSettingsPanel(),
                              ],
                              if (session.phase == SessionPhase.signedIn) ...[
                                const SizedBox(height: 24),
                                TimelineCacheSettingsPanel(
                                  key: ValueKey(session.identity),
                                ),
                              ],
                            ],
                          ),
                        ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: wide
              ? null
              : NavigationBar(
                  selectedIndex: index,
                  onDestinationSelected: navigate,
                  destinations: [
                    for (var i = 0; i < labels.length; i++)
                      NavigationDestination(
                        icon: Icon(icons[i]),
                        label: labels[i],
                      ),
                  ],
                ),
        );
      },
    );
  }
}
