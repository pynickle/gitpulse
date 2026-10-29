import 'package:flutter/material.dart';

import '../presentation/gitpulse_pull_to_refresh.dart';
import 'release_follows_dto.dart';
import 'release_follows_widgets.dart';
import 'repository_discovery_session.dart';

/// A bounded discovery page restores the repository and place within its row.
class RepositoryDiscoveryList extends StatefulWidget {
  const RepositoryDiscoveryList({
    super.key,
    required this.items,
    required this.position,
    required this.itemBuilder,
    required this.empty,
    required this.onRefresh,
  });

  final List<RepositoryCandidateDto> items;
  final RepositoryReadingPosition position;
  final Widget Function(RepositoryCandidateDto) itemBuilder;
  final Widget empty;
  final Future<void> Function() onRefresh;

  @override
  State<RepositoryDiscoveryList> createState() =>
      _RepositoryDiscoveryListState();
}

class _RepositoryDiscoveryListState extends State<RepositoryDiscoveryList> {
  final _scroll = ScrollController(keepScrollOffset: false);
  final _rows = <String, GlobalKey>{};
  bool _restoring = true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_schedulePosition);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      final saved = widget.position.anchor;
      final row = _rows[saved?.repositoryId]?.currentContext
          ?.findRenderObject();
      final viewport = context.findRenderObject();
      if (saved != null && row is RenderBox && viewport is RenderBox) {
        final inset = saved.inset < row.size.height ? saved.inset : 0.0;
        final distance = row.localToGlobal(Offset.zero, ancestor: viewport).dy;
        _scroll.jumpTo(
          (distance + inset).clamp(0.0, _scroll.position.maxScrollExtent),
        );
      }
      _restoring = false;
      _schedulePosition();
    });
  }

  void _schedulePosition() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_restoring) _rememberPosition();
    });
  }

  void _rememberPosition() {
    final viewport = context.findRenderObject();
    if (viewport is! RenderBox || !viewport.hasSize) return;
    for (final item in widget.items) {
      final row = _rows[item.nodeId]?.currentContext?.findRenderObject();
      if (row is! RenderBox || !row.attached || !row.hasSize) continue;
      final top = row.localToGlobal(Offset.zero, ancestor: viewport).dy;
      if (top + row.size.height <= 0 || top >= viewport.size.height) continue;
      widget.position.anchor = (repositoryId: item.nodeId, inset: -top);
      return;
    }
    widget.position.anchor = null;
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => GitPulsePullToRefresh(
    onRefresh: widget.onRefresh,
    child: CustomScrollView(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        if (widget.items.isEmpty)
          SliverFillRemaining(hasScrollBody: false, child: widget.empty)
        else
          // Discovery pages contain at most 30 rows. Laying out this bounded
          // page makes every saved anchor available after text or width reflow,
          // without estimating the height of preceding rows or fetching history.
          SliverToBoxAdapter(
            child: Column(
              children: [
                for (final item in widget.items) ...[
                  KeyedSubtree(
                    key: _rows.putIfAbsent(item.nodeId, GlobalKey.new),
                    child: widget.itemBuilder(item),
                  ),
                  if (!identical(item, widget.items.last))
                    const FollowRowDivider(),
                ],
              ],
            ),
          ),
      ],
    ),
  );
}
