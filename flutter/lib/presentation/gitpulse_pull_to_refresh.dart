import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

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
    return RefreshIndicator(
      onRefresh: onRefresh,
      // The gesture, its physics and how it hangs off the scroll are the
      // platform's — a Platform Dialect Exception (ADR 0032). The two tones it
      // is painted in are the app's: the Accent while it turns, and the page's
      // own tone behind it, the step a surface cuts a well into.
      color: toneAccent(context),
      backgroundColor: toneShell(context),
      elevation: 0,
      child: child,
    );
  }
}
