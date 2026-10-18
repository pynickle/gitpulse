import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../timeline/timeline_models.dart';
import 'release_follows_session.dart';
import 'release_follows_state.dart';

class ReleaseFollowsScreen extends ConsumerStatefulWidget {
  const ReleaseFollowsScreen({super.key});

  @override
  ConsumerState<ReleaseFollowsScreen> createState() =>
      _ReleaseFollowsScreenState();
}

class _ReleaseFollowsScreenState extends ConsumerState<ReleaseFollowsScreen> {
  late final TextEditingController _query;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    final state = ref.read(releaseFollowsSessionProvider);
    _query = TextEditingController(text: state.query);
    if (state.loaded) {
      Future<void>.microtask(() {
        if (mounted) {
          return ref.read(releaseFollowsSessionProvider.notifier).reload();
        }
      });
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _search() {
    _debounce?.cancel();
    unawaited(
      ref.read(releaseFollowsSessionProvider.notifier).search(_query.text),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(releaseFollowsSessionProvider);
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    final l10n = AppLocalizations.of(context);
    final disabled = state.loading || state.saving;
    final ids = state.repositories.map((repo) => repo.id).toSet();

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1000),
        child: CustomScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l10n.followsTitle,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(l10n.followsDescription),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _query,
                      decoration: InputDecoration(
                        labelText: l10n.followsSearchLabel,
                        prefixIcon: const Icon(Icons.search),
                      ),
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => _search(),
                      onChanged: (value) {
                        _debounce?.cancel();
                        facade.updateQuery(value);
                        if (value.trim().isNotEmpty) {
                          _debounce = Timer(
                            const Duration(milliseconds: 300),
                            _search,
                          );
                        }
                      },
                    ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: FilledButton.tonal(
                        onPressed: _search,
                        child: Text(l10n.followsSearch),
                      ),
                    ),
                    if (state.saving || state.loading || state.searching)
                      const LinearProgressIndicator(),
                    if (state.problem case final problem?)
                      _Notice(
                        text: _problemLabel(
                          l10n,
                          problem,
                          save: state.saveFailed,
                        ),
                      ),
                    if (state.metadataProblem != null)
                      _Notice(text: l10n.followsLookupFailed),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            l10n.followsCurrent(state.repositories.length),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        IconButton(
                          tooltip: l10n.followsReload,
                          onPressed: disabled ? null : facade.reload,
                          icon: const Icon(Icons.refresh),
                        ),
                      ],
                    ),
                    if (state.loaded && state.repositories.isEmpty)
                      Text(l10n.followsEmpty),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              sliver: SliverList.builder(
                itemCount: state.repositories.length,
                itemBuilder: (context, index) {
                  final repo = state.repositories[index];
                  final previous = state.previousNames[repo.id];
                  return _RepositoryCard(
                    key: ValueKey('followed-${repo.id}'),
                    repository: repo,
                    description: switch (state.statuses[repo.id]) {
                      RepositoryPageStatus.unavailable =>
                        l10n.followsUnavailable,
                      RepositoryPageStatus.transient => l10n.followsTransient,
                      _ =>
                        previous == null ? null : l10n.followsRenamed(previous),
                    },
                    action: l10n.followsUnfollow,
                    onPressed: disabled ? null : () => facade.unfollow(repo.id),
                  );
                },
              ),
            ),
            if (state.query.isNotEmpty) ...[
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        l10n.followsResults,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (state.searchProblem case final problem?) ...[
                        _Notice(text: _problemLabel(l10n, problem)),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: OutlinedButton(
                            onPressed: state.searching ? null : _search,
                            child: Text(l10n.timelineRetry),
                          ),
                        ),
                      ] else if (!state.searching && state.results.isEmpty)
                        Text(l10n.followsNoResults),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                sliver: SliverList.builder(
                  itemCount: state.results.length,
                  itemBuilder: (context, index) {
                    final item = state.results[index];
                    final followed = ids.contains(item.repository.id);
                    return _RepositoryCard(
                      key: ValueKey('search-${item.repository.id}'),
                      repository: item.repository,
                      description: item.description,
                      action: followed
                          ? l10n.followsFollowed
                          : l10n.followsFollow,
                      onPressed: disabled || followed
                          ? null
                          : () => facade.follow(item.repository),
                    );
                  },
                ),
              ),
              if (state.hasMore)
                SliverToBoxAdapter(
                  child: Center(
                    child: OutlinedButton(
                      onPressed: state.searching
                          ? null
                          : () => facade.search(state.query, more: true),
                      child: Text(l10n.followsMore),
                    ),
                  ),
                ),
            ],
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}

class _RepositoryCard extends StatelessWidget {
  const _RepositoryCard({
    super.key,
    required this.repository,
    required this.action,
    this.description,
    this.onPressed,
  });

  final TimelineRepository repository;
  final String? description;
  final String action;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            repository.fullName,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          if (description case final text?) Text(text),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(onPressed: onPressed, child: Text(action)),
          ),
        ],
      ),
    ),
  );
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        text,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
    ),
  );
}

String _problemLabel(
  AppLocalizations l10n,
  FollowProblem problem, {
  bool save = false,
}) => switch (problem) {
  FollowProblem.invalidRepository => l10n.followsInvalid,
  FollowProblem.notFound => l10n.followsNotFound,
  FollowProblem.duplicate => l10n.followsDuplicate,
  FollowProblem.validLimit => l10n.followsValidLimit,
  FollowProblem.storedLimit => l10n.followsStoredLimit,
  FollowProblem.network => l10n.followsNetwork,
  FollowProblem.rateLimited => l10n.timelineErrorRateLimited,
  _ => save ? l10n.followsSaveFailed : l10n.followsLoadFailed,
};
