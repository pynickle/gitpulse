import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'connection/connection_controller.dart';
import 'connection/connection_screen.dart';
import 'l10n/generated/app_localizations.dart';
import 'session/session_controller.dart';
import 'session/sign_in_panel.dart';
import 'timeline/timeline_screen.dart';

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
  Widget build(BuildContext context, WidgetRef ref) {
    // Keep the session lifecycle alive across the connection screen so logout
    // and backend changes finish after the shell route is gone.
    ref.listen(sessionControllerProvider, (_, _) {});
    return MaterialApp.router(
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
      builder: (context, child) {
        final theme = Theme.of(context);
        final chinese = Localizations.localeOf(context).languageCode == 'zh';
        // Choose desktop system fonts after the app locale has resolved so
        // headings, body text and buttons share the same Chinese typeface.
        final (fontFamily, fallbacks) = switch (theme.platform) {
          TargetPlatform.windows => (
            chinese ? 'Microsoft YaHei UI' : 'Segoe UI',
            const ['Microsoft YaHei UI', 'Microsoft JhengHei UI'],
          ),
          TargetPlatform.linux => (
            chinese ? 'Noto Sans CJK SC' : 'Noto Sans',
            const ['Noto Sans CJK SC', 'Noto Sans CJK TC'],
          ),
          _ => (null, const <String>[]),
        };
        if (fontFamily == null) return child!;
        return Theme(
          data: theme.copyWith(
            textTheme: theme.textTheme.apply(
              fontFamily: fontFamily,
              fontFamilyFallback: fallbacks,
            ),
            primaryTextTheme: theme.primaryTextTheme.apply(
              fontFamily: fontFamily,
              fontFamilyFallback: fallbacks,
            ),
          ),
          child: child!,
        );
      },
      routerConfig: ref.watch(_routerProvider),
    );
  }
}

/// The Timeline destination. The signed-in session state (identity, offline or
/// rejected notices, sign-out) stays visible above the Release Timeline, as it
/// is on the other destinations.
class _TimelineTab extends StatelessWidget {
  const _TimelineTab();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: SignInPanel(),
        ),
        Expanded(child: TimelineScreen()),
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
                child: index == 0 && session.phase == SessionPhase.signedIn
                    ? const _TimelineTab()
                    : ListView(
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
                              if (backend.capabilities.supportsNativeLogin)
                                Chip(label: Text(l10n.githubOAuth)),
                            ],
                          ),
                          const SignInPanel(),
                          const SizedBox(height: 24),
                          if (index == 1) Text(l10n.followsPending),
                          if (index == 2)
                            Align(
                              alignment: Alignment.centerLeft,
                              child: OutlinedButton(
                                onPressed: () => ref
                                    .read(sessionControllerProvider.notifier)
                                    .leaveBackend(),
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
