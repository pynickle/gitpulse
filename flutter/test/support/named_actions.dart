import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';

/// Finds the app's controls by the name a reader is told for them.
///
/// A mark shows no hint: nothing pops up when a finger rests on it or a pointer
/// hovers over it (ADR 0032), so a control's name is not a tooltip the platform
/// draws. It is what the control hands the accessibility tree, and that is what
/// a test names it by — an icon action's own label, or the whole name a
/// shortened label stands for. Those are the two faces that carry a name of
/// their own; a control that names itself some other way is not findable here,
/// and a test that needs one reads the semantics node instead.
Finder findNamedAction(String name) => find.byWidgetPredicate(
  (widget) => switch (widget) {
    GitPulseIconButton(:final label) => label == name,
    GitPulseButton(:final semanticsLabel) => semanticsLabel == name,
    _ => false,
  },
  description: 'a control named "$name"',
);
