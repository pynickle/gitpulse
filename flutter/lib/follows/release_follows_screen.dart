import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_progress.dart';
import '../presentation/gitpulse_sheet.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_theme.dart';
import '../presentation/gitpulse_tokens.dart';
import 'followed_repositories_panel.dart';
import 'followed_repository_view.dart';
import 'release_follows_session.dart';
import 'repository_pagination.dart';
import 'repository_discovery_list.dart';
import 'repository_discovery_session.dart';
import 'release_follows_state.dart';
import 'release_follows_widgets.dart';

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
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final TextEditingController _query;
  late final TabController _sourceTabs;
  Timer? _debounce;
  bool _footerFocused = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final state = ref.read(repositoryDiscoverySessionProvider);
    _query = TextEditingController(text: state.query);
    _sourceTabs = TabController(
      length: RepositorySource.values.length,
      initialIndex: state.source.index,
      vsync: this,
    );
    Future<void>.microtask(() {
      if (mounted) {
        unawaited(
          ref.read(repositoryDiscoverySessionProvider.notifier).ensureLoaded(),
        );
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounce?.cancel();
    _sourceTabs.dispose();
    _query.dispose();
    super.dispose();
  }

  @override
  void didChangeMetrics() {
    // The Scaffold removes keyboard insets from this body's MediaQuery, so
    // reading View.viewInsets below also needs its own metrics notification.
    setState(() {});
  }

  void _search({bool submit = false}) {
    _debounce?.cancel();
    if (submit) FocusScope.of(context).unfocus();
    unawaited(
      ref.read(repositoryDiscoverySessionProvider.notifier).search(_query.text),
    );
  }

  void _changeQuery(String value) {
    _debounce?.cancel();
    ref.read(repositoryDiscoverySessionProvider.notifier).updateQuery(value);
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

  @override
  Widget build(BuildContext context) {
    ref.listen(repositoryDiscoverySessionProvider, (previous, next) {
      if (_query.text.trim() != next.query) _query.text = next.query;
      if (_sourceTabs.index != next.source.index) {
        _sourceTabs.index = next.source.index;
      }
    });
    ref.listen(followedRepositoryViewProvider, (previous, next) {
      if (next != FollowedRepositoryView.detailed) return;
      unawaited(
        ref.read(releaseFollowsSessionProvider.notifier).loadMetadata(),
      );
    });
    final state = ref.watch(releaseFollowsSessionProvider);
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final discovery = ref.watch(repositoryDiscoverySessionProvider);
    final discoveryFacade = ref.read(
      repositoryDiscoverySessionProvider.notifier,
    );
    final search = discovery.source == RepositorySource.search;
    final page = discovery.current;
    final loading = page.loading;
    final pagination = page.pagination;
    final problem = page.problem;

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
                      unawaited(
                        discoveryFacade.selectSource(
                          RepositorySource.values[index],
                        ),
                      );
                    },
                  ),
                  if (!search)
                    Padding(
                      padding: const EdgeInsets.only(top: GitPulseSpace.inline),
                      child: _SortControls(
                        sort: discovery.sort,
                        ascending: discovery.ascending,
                        enabled: !loading,
                        onSort: (sort) =>
                            unawaited(discoveryFacade.loadStarred(sort: sort)),
                        onToggleDirection: () => unawaited(
                          discoveryFacade.loadStarred(
                            ascending: !discovery.ascending,
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
            Expanded(child: _discovery(state, discovery)),
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
                                key: ValueKey(discovery.source),
                                page: page.requestedPage,
                                onPage: (target) {
                                  _debounce?.cancel();
                                  unawaited(discoveryFacade.goToPage(target));
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
                          icon: const Icon(Icons.bookmarks_outlined),
                          // A follow set the app could not read or save is reported by
                          // the mark as well as by the line under the page: the one job
                          // where a button's mark is a status rather than a picture.
                          statusMarkTone: state.problem == null
                              ? null
                              : toneDanger(context),
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
    RepositoryDiscoveryState discovery,
  ) {
    final l10n = AppLocalizations.of(context);
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    final discoveryFacade = ref.read(
      repositoryDiscoverySessionProvider.notifier,
    );
    final search = discovery.source == RepositorySource.search;
    final page = discovery.current;
    final problem = page.problem;
    // A first read and a page being turned both replace the list's place: the
    // rows on screen belong to a page the reader has left. Asking for the page
    // already shown keeps it, and the pull that asks for it draws the progress.
    if (page.replacingPage) {
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
          onPressed: page.loading
              ? null
              : () => unawaited(discoveryFacade.retry()),
        ),
      );
    }
    if (search && discovery.query.isEmpty) {
      return GitPulseMessageView(
        icon: Icons.search,
        title: l10n.followsSearchPrompt,
      );
    }
    final ids = state.repositories.map((repo) => repo.id).toSet();
    return RepositoryDiscoveryList(
      key: ObjectKey(page.position),
      items: page.items,
      position: page.position,
      onRefresh: discoveryFacade.refresh,
      empty: GitPulseMessageView(
        icon: search ? Icons.search : Icons.star_border,
        title: search ? l10n.followsNoResults : l10n.followsStarredEmpty,
      ),
      itemBuilder: (item) {
        final followed = ids.contains(item.repository.id);
        return FollowRepositoryCard(
          key: ValueKey('${discovery.source.name}-${item.repository.id}'),
          candidate: item,
          followed: followed,
          onToggle: state.editBlocked
              ? null
              : () => followed
                    ? facade.unfollow(item.repository.id)
                    : facade.follow(item.repository),
        );
      },
    );
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
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(
          child: SegmentedButton<StarredRepositorySort>(
            expandedInsets: EdgeInsets.zero,
            showSelectedIcon: false,
            // The sort control is Material's — a Platform Dialect Exception, because a
            // segmented choice is the platform's grammar (ADR 0032) — and it draws its
            // segments as `TextButton`s inside a `TextButtonTheme` of its own, which
            // shadows the app's. So the app's one ink rule is handed to it the way the
            // TabBar above it takes it: no press wash, the one hover and focus tint.
            style: ButtonStyle(
              overlayColor: gitPulseInkOverlay(theme.colorScheme),
            ),
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
