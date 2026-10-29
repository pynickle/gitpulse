import 'package:flutter/material.dart';

import 'gitpulse_theme.dart';
import 'gitpulse_tokens.dart';

/// One of the places a [GitPulseNavigationBar] offers.
///
/// The bar owns the destination's mark and type: a destination is a place in the
/// app, not an action a screen composes, so it names its glyph and its word and
/// nothing about how either is drawn.
@immutable
class GitPulseNavigationDestination {
  const GitPulseNavigationDestination({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;
}

/// The app's bottom bar.
///
/// It is GitPulse's own face (ADR 0032): a surface standing on the page, told
/// apart from it by one hairline rather than by a shadow, with one destination
/// per third of its width. The selected destination is the only one painted in
/// the active step, and its mark and label are the Accent — the same pairing the
/// scheme states for a selected row and a chosen chip — so "where I am" reads in
/// both presentations without a second colour.
///
/// A destination carries the app's one ink contract, and a screen reader hears
/// exactly what a Material bar told it: the label, and whether this is the
/// destination it is on.
class GitPulseNavigationBar extends StatelessWidget {
  const GitPulseNavigationBar({
    super.key,
    required this.destinations,
    required this.selectedIndex,
    required this.onDestinationSelected,
  });

  final List<GitPulseNavigationDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) {
    return Material(
      type: MaterialType.canvas,
      color: toneSurface(context),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(
              color: toneBorder(context),
              width: GitPulseStroke.hairline,
            ),
          ),
        ),
        // The bar sits above the phone's own gesture area, so it pads for it
        // the way the page above it already does — and keeps that padding while
        // a field has the keyboard. The platform reports no bottom padding once
        // the IME covers it, and a bar that answered that would lose its
        // gesture inset for as long as a reader types: the shell sizes the page
        // against this bar's height, so every tap into a search field would move
        // the page by that inset and back. The inset is the device's, not the
        // keyboard's, so it is read as the view's own padding rather than as
        // what is left of it.
        child: SafeArea(
          top: false,
          maintainBottomViewPadding: true,
          child: Row(
            children: [
              for (var index = 0; index < destinations.length; index++)
                Expanded(
                  child: _GitPulseDestination(
                    destination: destinations[index],
                    selected: index == selectedIndex,
                    onTap: () => onDestinationSelected(index),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One third of the bar: the mark above its word, and the fill that says the
/// reader is here.
class _GitPulseDestination extends StatelessWidget {
  const _GitPulseDestination({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final GitPulseNavigationDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ink = selected ? toneAccent(context) : toneTextMuted(context);
    return Semantics(
      button: true,
      selected: selected,
      // One of a set: a screen reader counts the destinations and says which
      // one this is, as the platform's own bar does.
      inMutuallyExclusiveGroup: true,
      label: destination.label,
      onTap: onTap,
      excludeSemantics: true,
      child: Material(
        type: selected ? MaterialType.canvas : MaterialType.transparency,
        // The fill is the label and the mark's own ground, painted by this
        // surface rather than over it: ink is drawn below a Material's child, so
        // a fill above it would swallow the hover and focus tint.
        color: selected ? toneSurfaceActive(context) : null,
        child: InkWell(
          onTap: onTap,
          overlayColor: gitPulseInkOverlay(Theme.of(context).colorScheme),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GitPulseSpace.inline,
              vertical: GitPulseSpace.rowInsetV,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconTheme(
                  data: IconThemeData(
                    color: ink,
                    size: GitPulseIconSize.action,
                  ),
                  child: Icon(destination.icon),
                ),
                const SizedBox(height: GitPulseSpace.glyphGap),
                Text(
                  destination.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: gitPulseTypeControlLabel(context, ink),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
