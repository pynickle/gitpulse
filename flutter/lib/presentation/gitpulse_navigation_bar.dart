import 'package:flutter/material.dart';

import 'gitpulse_theme.dart';
import 'gitpulse_tokens.dart';

/// How long a destination switch takes: the step reaching the destination a
/// reader chose, the ink crossing with it, and the page it reveals crossing over
/// the one it replaces.
///
/// One duration for all three, because they are one answer to one tap: the bar
/// cannot have finished saying where the reader is before the page there has
/// arrived. Short enough that the answer arrives with the tap, long enough that
/// the eye can follow the step from one compartment to the next (ADR 0034).
const gitPulseDestinationTransition = Duration(milliseconds: 220);

/// The one curve a destination switch is made of: fast enough to read as an
/// answer, slow enough at the end to settle.
const gitPulseDestinationCurve = Curves.easeOutCubic;

/// How long a switch lasts for this reader.
///
/// A reader whose platform asks for reduced motion gets the destination the tap
/// chose, and none of the movement it took to get there.
Duration gitPulseDestinationTurn(BuildContext context) =>
    MediaQuery.disableAnimationsOf(context)
    ? Duration.zero
    : gitPulseDestinationTransition;

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
/// The active step is the bar's own drawing rather than a destination's fill: one
/// block, inset from the compartment it marks, that travels to the destination a
/// reader chose while that destination's word and mark cross to the Accent. A
/// step that blinked from one third to another would answer the tap with a jump;
/// moving it answers with the distance the reader moved (ADR 0034). A reader who
/// asked for reduced motion gets the destination, not the travel.
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
          child: LayoutBuilder(
            builder: (context, constraints) {
              final compartment = constraints.maxWidth / destinations.length;
              final inset = GitPulseSpace.destinationStepInset;
              final turn = gitPulseDestinationTurn(context);
              return Stack(
                children: [
                  // The active step: drawn below the destinations, so a press,
                  // a hover or the keyboard's focus still reads over it the way
                  // it reads over the bar (ADR 0032).
                  AnimatedPositioned(
                    duration: turn,
                    curve: gitPulseDestinationCurve,
                    left: compartment * selectedIndex + inset,
                    width: compartment - inset * 2,
                    top: inset,
                    bottom: inset,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: toneSurfaceActive(context),
                        borderRadius: BorderRadius.circular(GitPulseRadius.row),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var index = 0; index < destinations.length; index++)
                        Expanded(
                          child: _GitPulseDestination(
                            destination: destinations[index],
                            selected: index == selectedIndex,
                            turn: turn,
                            onTap: () => onDestinationSelected(index),
                          ),
                        ),
                    ],
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

/// One compartment of the bar: the mark above its word, and the ink that says
/// the reader is here.
class _GitPulseDestination extends StatelessWidget {
  const _GitPulseDestination({
    required this.destination,
    required this.selected,
    required this.turn,
    required this.onTap,
  });

  final GitPulseNavigationDestination destination;
  final bool selected;

  /// How long the bar is taking to answer, decided once by the bar.
  final Duration turn;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
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
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          overlayColor: gitPulseInkOverlay(Theme.of(context).colorScheme),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GitPulseSpace.inline,
              vertical: GitPulseSpace.rowInsetV,
            ),
            child: TweenAnimationBuilder<double>(
              tween: Tween<double>(end: selected ? 1 : 0),
              duration: turn,
              curve: gitPulseDestinationCurve,
              builder: (context, chosen, _) {
                // The step arrives from one side and the ink crosses over with
                // it: the word and the mark are the Accent exactly as far as the
                // block beneath them has come.
                final ink = Color.lerp(
                  toneTextMuted(context),
                  toneAccent(context),
                  chosen,
                )!;
                return Column(
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
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
