import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_state_views.dart';
import 'followed_repositories_panel.dart';
import 'release_follows_session.dart';
import 'release_follows_state.dart';
import 'release_follows_widgets.dart';

enum _RepositorySource { starred, search }

class ReleaseFollowsScreen extends ConsumerStatefulWidget {
  const ReleaseFollowsScreen({super.key});

  @override
  ConsumerState<ReleaseFollowsScreen> createState() =>
      _ReleaseFollowsScreenState();
}

class _ReleaseFollowsScreenState extends ConsumerState<ReleaseFollowsScreen> {
  late final TextEditingController _query;
  final _scroll = ScrollController();
  Timer? _debounce;
  late _RepositorySource _source;
  bool _followedOpen = false;

  @override
  void initState() {
    super.initState();
    final state = ref.read(releaseFollowsSessionProvider);
    _query = TextEditingController(text: state.query);
    _source = state.query.isEmpty
        ? _RepositorySource.starred
        : _RepositorySource.search;
    Future<void>.microtask(() {
      if (!mounted) return;
      final facade = ref.read(releaseFollowsSessionProvider.notifier);
      if (state.loaded) unawaited(facade.reload());
      unawaited(facade.loadStarred());
      if (state.query.isNotEmpty) _search();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToTop() {
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  void _search({bool submit = false}) {
    _debounce?.cancel();
    if (submit) FocusScope.of(context).unfocus();
    _scrollToTop();
    unawaited(
      ref.read(releaseFollowsSessionProvider.notifier).search(_query.text),
    );
  }

  void _changeQuery(String value) {
    _debounce?.cancel();
    _scrollToTop();
    ref.read(releaseFollowsSessionProvider.notifier).updateQuery(value);
    if (value.trim().isNotEmpty) {
      _debounce = Timer(const Duration(milliseconds: 300), _search);
    }
  }

  Future<void> _showFollowed() async {
    FocusScope.of(context).unfocus();
    setState(() => _followedOpen = true);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => FractionallySizedBox(
        heightFactor: 0.85,
        child: FollowedRepositoriesPanel(
          onClose: () => Navigator.of(context).pop(),
        ),
      ),
    );
    if (mounted) setState(() => _followedOpen = false);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(releaseFollowsSessionProvider);
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    final l10n = AppLocalizations.of(context);
    final search = _source == _RepositorySource.search;
    final loading = search ? state.searching : state.starred.loading;
    final hasMore = search ? state.hasMore : state.starred.hasMore;
    final problem = search ? state.searchProblem : state.starred.problem;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1440),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 1100;
            // Scaffold removes the keyboard inset from the body's MediaQuery.
            final keyboardVisible = View.of(context).viewInsets.bottom > 0;
            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SegmentedButton<_RepositorySource>(
                              showSelectedIcon: false,
                              expandedInsets: EdgeInsets.zero,
                              segments: [
                                ButtonSegment(
                                  value: _RepositorySource.starred,
                                  label: Text(l10n.followsStarred),
                                ),
                                ButtonSegment(
                                  value: _RepositorySource.search,
                                  label: Text(l10n.followsSearch),
                                ),
                              ],
                              selected: {_source},
                              onSelectionChanged: (values) {
                                _debounce?.cancel();
                                FocusScope.of(context).unfocus();
                                _scrollToTop();
                                setState(() => _source = values.single);
                                if (_source == _RepositorySource.search &&
                                    state.query.isNotEmpty &&
                                    state.searchPage == 0 &&
                                    !state.searching) {
                                  _search();
                                }
                              },
                            ),
                            const SizedBox(height: 16),
                            if (search)
                              TextField(
                                controller: _query,
                                textInputAction: TextInputAction.search,
                                onSubmitted: (_) => _search(submit: true),
                                onChanged: _changeQuery,
                                decoration: InputDecoration(
                                  labelText: l10n.followsSearchLabel,
                                  border: const OutlineInputBorder(),
                                  suffixIcon: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (_query.text.isNotEmpty)
                                        IconButton(
                                          tooltip: l10n.followsClearSearch,
                                          onPressed: () {
                                            _query.clear();
                                            _changeQuery('');
                                          },
                                          icon: const Icon(Icons.close),
                                        ),
                                      IconButton(
                                        tooltip: l10n.followsSearch,
                                        onPressed: _query.text.trim().isEmpty
                                            ? null
                                            : () => _search(submit: true),
                                        icon: const Icon(Icons.search),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            else
                              Row(
                                children: [
                                  Expanded(
                                    child:
                                        DropdownButtonFormField<
                                          StarredRepositorySort
                                        >(
                                          initialValue: state.starred.sort,
                                          isExpanded: true,
                                          decoration: InputDecoration(
                                            labelText: l10n.followsSortLabel,
                                            border: const OutlineInputBorder(),
                                          ),
                                          items: [
                                            DropdownMenuItem(
                                              value:
                                                  StarredRepositorySort.created,
                                              child: Text(
                                                l10n.followsSortStarred,
                                              ),
                                            ),
                                            DropdownMenuItem(
                                              value:
                                                  StarredRepositorySort.updated,
                                              child: Text(
                                                l10n.followsSortUpdated,
                                              ),
                                            ),
                                          ],
                                          onChanged: loading
                                              ? null
                                              : (sort) {
                                                  _scrollToTop();
                                                  unawaited(
                                                    facade.loadStarred(
                                                      sort: sort,
                                                    ),
                                                  );
                                                },
                                        ),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton.filledTonal(
                                    tooltip: state.starred.ascending
                                        ? l10n.followsAscending
                                        : l10n.followsDescending,
                                    onPressed: loading
                                        ? null
                                        : () {
                                            _scrollToTop();
                                            unawaited(
                                              facade.loadStarred(
                                                ascending:
                                                    !state.starred.ascending,
                                              ),
                                            );
                                          },
                                    icon: Icon(
                                      state.starred.ascending
                                          ? Icons.arrow_upward
                                          : Icons.arrow_downward,
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                      if (state.loading || state.saving)
                        const LinearProgressIndicator(),
                      const Divider(height: 1),
                      Expanded(
                        child: _discovery(
                          state,
                          search,
                          loading,
                          problem,
                          showFollowProblem: !wide && !_followedOpen,
                        ),
                      ),
                      if (!keyboardVisible &&
                          (hasMore || !wide || problem != null))
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              if (hasMore || problem != null)
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: loading
                                        ? null
                                        : () {
                                            if (search) {
                                              unawaited(
                                                facade.search(
                                                  state.query,
                                                  more: hasMore,
                                                ),
                                              );
                                            } else {
                                              unawaited(
                                                facade.loadStarred(
                                                  more: hasMore,
                                                ),
                                              );
                                            }
                                          },
                                    icon: Icon(
                                      problem == null
                                          ? Icons.expand_more
                                          : Icons.refresh,
                                    ),
                                    label: Text(
                                      problem == null
                                          ? l10n.followsMore
                                          : l10n.timelineRetry,
                                    ),
                                  ),
                                ),
                              if (!wide) ...[
                                if (hasMore || problem != null)
                                  const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton.tonalIcon(
                                    key: const ValueKey('manage-follows'),
                                    onPressed: _showFollowed,
                                    icon: const Icon(Icons.bookmarks_outlined),
                                    label: Text(
                                      l10n.followsManage(
                                        state.repositories.length,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                if (wide) ...[
                  const VerticalDivider(width: 1),
                  const SizedBox(
                    width: 360,
                    child: FollowedRepositoriesPanel(),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _discovery(
    ReleaseFollowsState state,
    bool search,
    bool loading,
    FollowProblem? problem, {
    required bool showFollowProblem,
  }) {
    final l10n = AppLocalizations.of(context);
    final items = search ? state.results : state.starred.items;
    final Widget? empty;
    if (items.isNotEmpty) {
      empty = null;
    } else if (loading) {
      empty = GitPulseLoadingView(label: l10n.followsLoading);
    } else {
      empty = GitPulseMessageView(
        icon: problem != null
            ? Icons.cloud_off_outlined
            : search
            ? Icons.search
            : Icons.star_border,
        title: problem != null
            ? followProblemLabel(l10n, problem)
            : search
            ? state.searchPage == 0
                  ? l10n.followsSearchPrompt
                  : l10n.followsNoResults
            : l10n.followsStarredEmpty,
        tone: problem == null
            ? GitPulseMessageTone.neutral
            : GitPulseMessageTone.error,
        liveRegion: problem != null,
      );
    }
    final ids = state.repositories.map((repo) => repo.id).toSet();
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    return CustomScrollView(
      controller: _scroll,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        if (showFollowProblem && state.problem != null)
          SliverToBoxAdapter(
            child: FollowProblemNotice(
              text: followProblemLabel(
                l10n,
                state.problem,
                save: state.saveFailed,
              ),
            ),
          ),
        if (loading && items.isNotEmpty)
          const SliverToBoxAdapter(child: LinearProgressIndicator()),
        if (problem != null && items.isNotEmpty)
          SliverToBoxAdapter(
            child: FollowProblemNotice(text: followProblemLabel(l10n, problem)),
          ),
        if (empty != null)
          SliverFillRemaining(hasScrollBody: false, child: empty)
        else
          SliverPadding(
            padding: const EdgeInsets.all(12),
            sliver: SliverList.builder(
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final followed = ids.contains(item.repository.id);
                return FollowRepositoryCard(
                  key: ValueKey(
                    '${search ? 'search' : 'starred'}-${item.repository.id}',
                  ),
                  candidate: item,
                  followed: followed,
                  onToggle: state.loading || state.saving
                      ? null
                      : () => followed
                            ? facade.unfollow(item.repository.id)
                            : facade.follow(item.repository),
                );
              },
            ),
          ),
      ],
    );
  }
}
