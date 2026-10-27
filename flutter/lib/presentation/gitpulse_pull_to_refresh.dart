import 'package:flutter/material.dart';

/// The app's one pull-to-refresh surface.
///
/// It is the standard Material gesture with one look: the search and refresh
/// information keep their place, only the scrolling area moves, and the
/// indicator it draws at the top edge is the single progress a re-read shows.
/// The Release Timeline and both Follows sources share it so a pull reads the
/// same on every page.
class GitPulsePullToRefresh extends StatelessWidget {
  const GitPulsePullToRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: scheme.primary,
      // A tonal surface step, never a shadow.
      backgroundColor: scheme.surfaceContainerHigh,
      elevation: 0,
      child: child,
    );
  }
}
