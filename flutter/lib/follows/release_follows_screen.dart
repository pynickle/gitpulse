import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_progress.dart';
import '../presentation/gitpulse_pull_to_refresh.dart';
import '../presentation/gitpulse_sheet.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_theme.dart';
import '../presentation/gitpulse_tokens.dart';
import 'followed_repositories_panel.dart';
import 'followed_repository_view.dart';
import 'release_follows_session.dart';
import 'repository_pagination.dart';
import 'release_follows_state.dart';
import 'release_follows_widgets.dart';

enum _RepositorySource { starred, search }

/// The search field's shape: the soft radius the Timeline toolbar already uses,
/// so the two search surfaces read as the same control.
const _searchBorder = OutlineInputBorder(
  borderRadius: BorderRadius.all(Radius.circular(GitPulseRadius.row)),
);

/// The width the discovery list stops growing at: a list wider than this spreads
/// a repository's name and its star count too far apart to read as one row. It is
/// the width the list kept beside the Followed Repositories sidebar the page no
/// longer has, so the rows read the same on a wide window as they always did.
const _maximumContentWidth = 1080.0;

class ReleaseFollowsScreen extends ConsumerStatefulWidget {
  const ReleaseFollowsScreen({super.key});

  @override
  ConsumerState<ReleaseFollowsScreen> createState() =>
      _ReleaseFollowsScreenState();
}

class _ReleaseFollowsScreenState extends ConsumerState<ReleaseFollowsScreen>
    with SingleTickerProviderStateMixin {
  late final TextEditingController _query;
  late final TabController _sourceTabs;
  final _scroll = ScrollController();
  Timer? _debounce;
  late _RepositorySource _source;
  bool _footerFocused = false;

  @override
  void initState() {
    super.initState();
    final state = ref.read(releaseFollowsSessionProvider);
    _query = TextEditingController(text: state.query);
    _source = state.query.isEmpty
        ? _RepositorySource.starred
        : _RepositorySource.search;
    _sourceTabs = TabController(
      length: _RepositorySource.values.length,
      initialIndex: _source.index,
      vsync: this,
    );
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
    _sourceTabs.dispose();
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
    // The app's own sheet, like every other sheet in the client (ADR 0029 /
    // ADR 0032): the route, the surface and the Escape key are decided by
    // `showGitPulseSheet`, and the panel decides only its content and height.
    await showGitPulseSheet(
      context,
      barrierLabel: AppLocalizations.of(context).followsClose,
      builder: (context) => SafeArea(
        top: false,
        child: FractionallySizedBox(
          heightFactor: 0.85,
          child: FollowedRepositoriesPanel(
            onClose: () => Navigator.of(context).pop(),
          ),
        ),
      ),
    );
  }

  /// Re-reads the page on screen: a pull is about this page, not about the
  /// first one of either source.
  Future<void> _refreshCurrentPage() {
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    return _source == _RepositorySource.search
        ? facade.refreshSearchPage()
        : facade.refreshStarredPage();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(releaseFollowsSessionProvider, (previous, next) {
      final success = _source == _RepositorySource.search
          ? previous?.searching == true &&
                !next.searching &&
                next.searchProblem == null
          : previous?.starred.loading == true &&
                !next.starred.loading &&
                next.starred.problem == null;
      if (success) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _scrollToTop();
        });
      }
    });
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
    final pagination = search
        ? state.searchPagination
        : state.starred.pagination;
    final problem = search ? state.searchProblem : state.starred.problem;

    // Scaffold removes the keyboard inset from the body's MediaQuery.
    final keyboardVisible = View.of(context).viewInsets.bottom > 0;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _maximumContentWidth),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TabBar(
                    controller: _sourceTabs,
                    indicatorSize: TabBarIndicatorSize.tab,
                    indicator: UnderlineTabIndicator(
                      borderSide: BorderSide(
                        color: toneAccent(context),
                        width: GitPulseStroke.hairline,
                      ),
                    ),
                    dividerColor: toneRule(theme.colorScheme),
                    dividerHeight: GitPulseStroke.hairline,
                    overlayColor: gitPulseInkOverlay(theme.colorScheme),
                    tabs: [
                      Tab(
                        text: l10n.followsStarred,
                        height: GitPulseHeight.standard,
                      ),
                      Tab(
                        text: l10n.followsSearch,
                        height: GitPulseHeight.standard,
                      ),
                    ],
                    onTap: (index) {
                      _debounce?.cancel();
                      FocusScope.of(context).unfocus();
                      _scrollToTop();
                      setState(() => _source = _RepositorySource.values[index]);
                      if (_source == _RepositorySource.search &&
                          state.query.isNotEmpty &&
                          state.searchPage == 0 &&
                          !state.searching) {
                        _search();
                      }
                    },
                  ),
                  if (!search)
                    Padding(
                      padding: const EdgeInsets.only(top: GitPulseSpace.inline),
                      child: _SortControls(
                        sort: state.starred.sort,
                        ascending: state.starred.ascending,
                        enabled: !loading,
                        onSort: (sort) =>
                            unawaited(facade.loadStarred(sort: sort)),
                        onToggleDirection: () => unawaited(
                          facade.loadStarred(
                            ascending: !state.starred.ascending,
                          ),
                        ),
                      ),
                    ),
                  if (search) ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: _query,
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => _search(submit: true),
                      onChanged: _changeQuery,
                      style: gitPulseTypeFieldText(context),
                      decoration: InputDecoration(
                        labelText: l10n.followsSearchLabel,
                        isDense: true,
                        // The label is a label, not a heading: the
                        // field keeps body-sized type whether the
                        // label rests inside it or floats.
                        labelStyle: gitPulseTypeFieldText(context),
                        floatingLabelStyle: gitPulseTypeMeta(context),
                        border: _searchBorder,
                        enabledBorder: _searchBorder,
                        focusedBorder: _searchBorder.copyWith(
                          borderSide: BorderSide(color: toneAccent(context)),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        suffixIcon: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_query.text.isNotEmpty)
                              GitPulseIconButton(
                                tooltip: l10n.followsClearSearch,
                                size: GitPulseIconSize.inControl,
                                onPressed: () {
                                  _query.clear();
                                  _changeQuery('');
                                },
                                icon: const Icon(Icons.close),
                              ),
                            GitPulseIconButton(
                              tooltip: l10n.followsSearch,
                              size: GitPulseIconSize.inControl,
                              onPressed: _query.text.trim().isEmpty
                                  ? null
                                  : () => _search(submit: true),
                              icon: const Icon(Icons.search),
                            ),
                          ],
                        ),
                        suffixIconConstraints: const BoxConstraints(
                          minWidth: 44,
                          minHeight: GitPulseHeight.rowMin,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // Only an edit is reported here. A read reports itself
            // where it can be undone: a page turn fills the list's
            // place, and the page already on screen is re-read by the
            // pull that asked for it.
            if (state.saving) const Center(child: GitPulseProgressInline()),
            Divider(
              height: GitPulseStroke.hairline,
              thickness: GitPulseStroke.hairline,
              color: toneRule(Theme.of(context).colorScheme),
            ),
            Expanded(child: _discovery(state, search, loading, problem)),
            if (!keyboardVisible || _footerFocused)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: GitPulseSpace.gutter,
                  vertical: GitPulseSpace.inline,
                ),
                child: Focus(
                  onFocusChange: (focused) {
                    if (mounted) {
                      setState(() => _footerFocused = focused);
                    }
                  },
                  child: Row(
                    children: [
                      Expanded(
                        // A page that failed has no page to name:
                        // the error states the one thing left to do
                        // with it, and the footer keeps the way into
                        // Followed Repositories.
                        child: pagination == null || problem != null
                            ? const SizedBox.shrink()
                            : RepositoryPagination(
                                pagination: pagination,
                                loading: loading,
                                // A page that is on its way is
                                // already the page being read: the
                                // number changes as the request
                                // starts, not when it lands.
                                page: search
                                    ? state.searchRequestedPage
                                    : state.starred.requestedPage,
                                onPage: (page) {
                                  _debounce?.cancel();
                                  if (search) {
                                    unawaited(
                                      facade.search(state.query, page: page),
                                    );
                                  } else {
                                    unawaited(facade.loadStarred(page: page));
                                  }
                                },
                              ),
                      ),
                      const SizedBox(width: GitPulseSpace.inline),
                      Tooltip(
                        message: l10n.followsManage(state.repositories.length),
                        child: GitPulseButton(
                          key: const ValueKey('manage-follows'),
                          label: MaterialLocalizations.of(context)
                              .formatDecimal(state.repositories.length),
                          variant: GitPulseButtonVariant.tonal,
                          onPressed: _showFollowed,
                          icon: Icon(
                            Icons.bookmarks_outlined,
                            // A follow set the app could not read or save is
                            // reported by the mark as well as by the line
                            // under the page.
                            color: state.problem == null
                                ? null
                                : toneDanger(context),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
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
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    final items = search ? state.results : state.starred.items;
    final shownPage = search ? state.searchPage : state.starred.page;
    final requestedPage = search
        ? state.searchRequestedPage
        : state.starred.requestedPage;
    void retry() {
      if (search) {
        unawaited(facade.search(state.query, page: requestedPage));
      } else {
        unawaited(facade.loadStarred(page: requestedPage));
      }
    }

    // A first read and a page being turned both replace the list's place: the
    // rows on screen belong to a page the reader has left. Asking for the page
    // already shown keeps it, and the pull that asks for it draws the progress.
    if (loading && requestedPage != shownPage) {
      return GitPulseLoadingView(label: l10n.followsLoading);
    }
    // A read that failed replaces what it could not load, with the one action
    // that asks for it again. Nothing is kept behind it: a page that failed to
    // arrive leaves no list the reader is standing on.
    if (problem != null) {
      return GitPulseMessageView(
        icon: problem == FollowProblem.network
            ? Icons.cloud_off_outlined
            : Icons.error_outline,
        title: followProblemLabel(l10n, problem),
        // Losing the network is ordinary, so it is stated in the neutral tone;
        // permission, rate-limit, session and unavailable-repository problems
        // keep the error tone so a real fault still reads as one.
        tone: followProblemTone(problem),
        liveRegion: true,
        action: GitPulseButton(
          label: l10n.timelineRetry,
          variant: GitPulseButtonVariant.tonal,
          onPressed: loading ? null : retry,
        ),
      );
    }
    if (search && state.query.isEmpty) {
      return GitPulseMessageView(
        icon: Icons.search,
        title: l10n.followsSearchPrompt,
      );
    }
    final ids = state.repositories.map((repo) => repo.id).toSet();
    final list = CustomScrollView(
      controller: _scroll,
      // A page shorter than the window is still pullable: the gesture is how
      // the page on screen is asked for again without leaving it.
      physics: const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        if (items.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: GitPulseMessageView(
              icon: search ? Icons.search : Icons.star_border,
              title: search ? l10n.followsNoResults : l10n.followsStarredEmpty,
            ),
          )
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
                    onToggle: state.editBlocked
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
    return GitPulsePullToRefresh(onRefresh: _refreshCurrentPage, child: list);
  }
}

class _SortControls extends StatelessWidget {
  const _SortControls({
    required this.sort,
    required this.ascending,
    required this.enabled,
    required this.onSort,
    required this.onToggleDirection,
  });

  final StarredRepositorySort sort;
  final bool ascending;
  final bool enabled;
  final ValueChanged<StarredRepositorySort> onSort;
  final VoidCallback onToggleDirection;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        Expanded(
          child: SegmentedButton<StarredRepositorySort>(
            expandedInsets: EdgeInsets.zero,
            showSelectedIcon: false,
            segments: [
              ButtonSegment(
                value: StarredRepositorySort.created,
                label: Text(l10n.followsSortStarred),
              ),
              ButtonSegment(
                value: StarredRepositorySort.updated,
                label: Text(l10n.followsSortUpdated),
              ),
            ],
            selected: {sort},
            onSelectionChanged: enabled
                ? (values) => onSort(values.single)
                : null,
          ),
        ),
        GitPulseIconButton(
          tooltip: ascending ? l10n.followsAscending : l10n.followsDescending,
          onPressed: enabled ? onToggleDirection : null,
          icon: Icon(ascending ? Icons.arrow_upward : Icons.arrow_downward),
        ),
      ],
    );
  }
}
