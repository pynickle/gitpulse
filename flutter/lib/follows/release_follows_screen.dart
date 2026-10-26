import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_tokens.dart';
import 'followed_repositories_panel.dart';
import 'followed_repository_view.dart';
import 'release_follows_session.dart';
import 'release_follows_state.dart';
import 'release_follows_widgets.dart';

enum _RepositorySource { starred, search }

/// The search field's shape: the soft radius the Timeline toolbar already uses,
/// so the two search surfaces read as the same control.
const _searchBorder = OutlineInputBorder(
  borderRadius: BorderRadius.all(Radius.circular(GitPulseRadius.row)),
);

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
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(followedRepositoryViewProvider, (previous, next) {
      if (next != FollowedRepositoryView.detailed) return;
      unawaited(
        ref.read(releaseFollowsSessionProvider.notifier).loadMetadata(),
      );
    });
    final state = ref.watch(releaseFollowsSessionProvider);
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
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
                        padding: const EdgeInsets.fromLTRB(
                          releaseFollowsPadding,
                          8,
                          releaseFollowsPadding,
                          8,
                        ),
                        // The mode switch keeps its own width and shares its
                        // line with the sort controls whenever both fit. A
                        // full-width strip above a second row of controls spent
                        // the top of the page on two bands with one button each.
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Wrap(
                              alignment: WrapAlignment.spaceBetween,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                SegmentedButton<_RepositorySource>(
                                  showSelectedIcon: false,
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
                                if (!search)
                                  _SortControls(
                                    label:
                                        state.starred.sort ==
                                            StarredRepositorySort.created
                                        ? l10n.followsSortStarred
                                        : l10n.followsSortUpdated,
                                    starredLabel: l10n.followsSortStarred,
                                    updatedLabel: l10n.followsSortUpdated,
                                    ascending: state.starred.ascending,
                                    ascendingLabel: l10n.followsAscending,
                                    descendingLabel: l10n.followsDescending,
                                    enabled: !loading,
                                    onSort: (sort) {
                                      _scrollToTop();
                                      unawaited(facade.loadStarred(sort: sort));
                                    },
                                    onToggleDirection: () {
                                      _scrollToTop();
                                      unawaited(
                                        facade.loadStarred(
                                          ascending: !state.starred.ascending,
                                        ),
                                      );
                                    },
                                  ),
                              ],
                            ),
                            if (search) ...[
                              const SizedBox(height: 8),
                              Align(
                                alignment: AlignmentDirectional.centerStart,
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(
                                    maxWidth: 520,
                                  ),
                                  child: TextField(
                                    controller: _query,
                                    textInputAction: TextInputAction.search,
                                    onSubmitted: (_) => _search(submit: true),
                                    onChanged: _changeQuery,
                                    style: theme.textTheme.bodyMedium,
                                    decoration: InputDecoration(
                                      labelText: l10n.followsSearchLabel,
                                      isDense: true,
                                      // The label is a label, not a heading: the
                                      // field keeps body-sized type whether the
                                      // label rests inside it or floats.
                                      labelStyle: theme.textTheme.bodyMedium,
                                      floatingLabelStyle:
                                          theme.textTheme.bodySmall,
                                      border: _searchBorder,
                                      enabledBorder: _searchBorder,
                                      focusedBorder: _searchBorder.copyWith(
                                        borderSide: BorderSide(
                                          color: theme.colorScheme.primary,
                                        ),
                                      ),
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 10,
                                          ),
                                      suffixIcon: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          if (_query.text.isNotEmpty)
                                            IconButton(
                                              tooltip: l10n.followsClearSearch,
                                              style: IconButton.styleFrom(
                                                tapTargetSize:
                                                    MaterialTapTargetSize
                                                        .shrinkWrap,
                                              ),
                                              onPressed: () {
                                                _query.clear();
                                                _changeQuery('');
                                              },
                                              iconSize:
                                                  GitPulseIconSize.inControl,
                                              icon: const Icon(Icons.close),
                                            ),
                                          IconButton(
                                            tooltip: l10n.followsSearch,
                                            style: IconButton.styleFrom(
                                              tapTargetSize:
                                                  MaterialTapTargetSize
                                                      .shrinkWrap,
                                            ),
                                            onPressed:
                                                _query.text.trim().isEmpty
                                                ? null
                                                : () => _search(submit: true),
                                            iconSize:
                                                GitPulseIconSize.inControl,
                                            icon: const Icon(Icons.search),
                                          ),
                                        ],
                                      ),
                                      suffixIconConstraints:
                                          const BoxConstraints(
                                            minWidth: 44,
                                            minHeight: GitPulseHeight.rowMin,
                                          ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      if (state.loading || state.saving)
                        const LinearProgressIndicator(),
                      Divider(
                        height: GitPulseStroke.hairline,
                        thickness: GitPulseStroke.hairline,
                        color: toneRule(Theme.of(context).colorScheme),
                      ),
                      Expanded(
                        child: _discovery(state, search, loading, problem),
                      ),
                      if (!keyboardVisible &&
                          (hasMore || !wide || problem != null))
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            releaseFollowsPadding,
                            8,
                            releaseFollowsPadding,
                            12,
                          ),
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
                                    icon: Icon(
                                      Icons.bookmarks_outlined,
                                      color: state.problem == null
                                          ? null
                                          : Theme.of(context).colorScheme.error,
                                    ),
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
                  VerticalDivider(
                    width: GitPulseStroke.hairline,
                    thickness: GitPulseStroke.hairline,
                    color: toneRule(Theme.of(context).colorScheme),
                  ),
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
    FollowProblem? problem,
  ) {
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
        // Losing the network is ordinary, so it is stated in the neutral tone;
        // permission, rate-limit, session and unavailable-repository problems
        // keep the error tone so a real fault still reads as one.
        tone: followProblemTone(problem),
        liveRegion: problem != null,
      );
    }
    final ids = state.repositories.map((repo) => repo.id).toSet();
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    return CustomScrollView(
      controller: _scroll,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        if (loading && items.isNotEmpty)
          const SliverToBoxAdapter(child: LinearProgressIndicator()),
        if (problem != null && items.isNotEmpty)
          SliverToBoxAdapter(
            child: FollowProblemNotice(
              text: followProblemLabel(l10n, problem),
              tone: followProblemTone(problem),
            ),
          ),
        if (empty != null)
          SliverFillRemaining(hasScrollBody: false, child: empty)
        else
          SliverList.builder(
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              final followed = ids.contains(item.repository.id);
              return Column(
                children: [
                  FollowRepositoryCard(
                    key: ValueKey(
                      '${search ? 'search' : 'starred'}-${item.repository.id}',
                    ),
                    candidate: item,
                    followed: followed,
                    onToggle: state.saving || (!state.loaded && state.loading)
                        ? null
                        : () => followed
                              ? facade.unfollow(item.repository.id)
                              : facade.follow(item.repository),
                  ),
                  if (index < items.length - 1) const FollowRowDivider(),
                ],
              );
            },
          ),
      ],
    );
  }
}

class _SortControls extends StatelessWidget {
  const _SortControls({
    required this.label,
    required this.starredLabel,
    required this.updatedLabel,
    required this.ascending,
    required this.ascendingLabel,
    required this.descendingLabel,
    required this.enabled,
    required this.onSort,
    required this.onToggleDirection,
  });

  final String label;
  final String starredLabel;
  final String updatedLabel;
  final bool ascending;
  final String ascendingLabel;
  final String descendingLabel;
  final bool enabled;
  final ValueChanged<StarredRepositorySort> onSort;
  final VoidCallback onToggleDirection;

  @override
  Widget build(BuildContext context) {
    // This cluster shares a [Wrap] run with the mode switch, so its label has
    // to be able to give way: a run that cannot fit its children would overflow
    // instead of moving the cluster to the next line.
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: _SortMenuButton(
            label: label,
            starredLabel: starredLabel,
            updatedLabel: updatedLabel,
            enabled: enabled,
            onSort: onSort,
          ),
        ),
        IconButton(
          tooltip: ascending ? ascendingLabel : descendingLabel,
          onPressed: enabled ? onToggleDirection : null,
          visualDensity: VisualDensity.compact,
          iconSize: GitPulseIconSize.action,
          icon: Icon(ascending ? Icons.arrow_upward : Icons.arrow_downward),
        ),
      ],
    );
  }
}

/// The current order is the button label. The menu is shifted to stay inside
/// the window, including when a long label is scaled up on a phone.
class _SortMenuButton extends StatelessWidget {
  const _SortMenuButton({
    required this.label,
    required this.starredLabel,
    required this.updatedLabel,
    required this.enabled,
    required this.onSort,
  });

  final String label;
  final String starredLabel;
  final String updatedLabel;
  final bool enabled;
  final ValueChanged<StarredRepositorySort> onSort;

  Future<void> _open(BuildContext context) async {
    final box = context.findRenderObject()! as RenderBox;
    final overlay =
        Overlay.of(context).context.findRenderObject()! as RenderBox;
    final origin = box.localToGlobal(Offset.zero, ancestor: overlay);
    final button = origin & box.size;
    final selected = await showMenu<StarredRepositorySort>(
      context: context,
      position: RelativeRect.fromRect(button, Offset.zero & overlay.size),
      items: [
        PopupMenuItem(
          value: StarredRepositorySort.created,
          child: Text(
            starredLabel,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        PopupMenuItem(
          value: StarredRepositorySort.updated,
          child: Text(
            updatedLabel,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
    if (selected != null) onSort(selected);
  }

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: enabled ? () => _open(context) : null,
      child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}
