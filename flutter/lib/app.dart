import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'connection/connection_controller.dart';
import 'connection/connection_screen.dart';
import 'l10n/generated/app_localizations.dart';

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
      for (final (index, path) in [
        '/timeline',
        '/follows',
        '/settings',
      ].indexed)
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
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'GitPulse',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff238636)),
    ),
    darkTheme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xff238636),
        brightness: Brightness.dark,
      ),
    ),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    routerConfig: ref.watch(_routerProvider),
  );
}

class _AppShell extends ConsumerWidget {
  const _AppShell({required this.index});

  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final connection = ref.watch(connectionControllerProvider).value;
    final backend = connection?.backend;
    if (backend == null) return const SizedBox.shrink();
    final providers = backend.capabilities.providers;
    final labels = [l10n.timeline, l10n.follows, l10n.settings];
    const icons = [
      Icons.view_timeline_outlined,
      Icons.bookmarks_outlined,
      Icons.settings_outlined,
    ];
    void navigate(int index) =>
        context.go(['/timeline', '/follows', '/settings'][index]);

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 720;
        return Scaffold(
          appBar: AppBar(title: Text('GitPulse · ${labels[index]}')),
          body: Row(
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
                child: ListView(
                  padding: const EdgeInsets.all(24),
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
                        if (providers.oauthEnabled)
                          Chip(label: Text(l10n.githubOAuth)),
                      ],
                    ),
                    Text(l10n.signInPending),
                    const SizedBox(height: 24),
                    if (index == 0) Text(l10n.timelinePending),
                    if (index == 1) Text(l10n.followsPending),
                    if (index == 2)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: OutlinedButton(
                          onPressed: () => ref
                              .read(connectionControllerProvider.notifier)
                              .changeBackend(),
                          child: Text(l10n.changeBackend),
                        ),
                      ),
                  ],
                ),
              ),
            ],
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
