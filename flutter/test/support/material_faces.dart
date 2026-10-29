import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The Material faces the Control Layer replaced (ADR 0032), by the widget type a screen would
/// mount to draw one.
///
/// A migrated screen draws none of these, and its own widget test says so about its own rendered
/// tree: the rule is executable rather than remembered, so a screen that still mounts a stock
/// Material control fails a test instead of passing review.
const replacedMaterialFaces = <Type>[
  FilledButton,
  ElevatedButton,
  OutlinedButton,
  TextButton,
  IconButton,
  NavigationBar,
  NavigationDestination,
  Checkbox,
  Switch,
  AlertDialog,
  Dialog,
  LinearProgressIndicator,
];

/// The widgets a registered Platform Dialect Exception (ADR 0032) draws Material children of its
/// own inside.
///
/// An occurrence underneath one of these is the exception's drawing rather than a screen's
/// control, so it is not a violation — but the list may not grow silently, and every entry here is
/// named with its reason in that record.
final materialFaceExceptionHosts = <bool Function(Widget)>[
  // The repository pages' and the connection page's bar: its back affordance stays the
  // platform's (`BackButton extends IconButton`), and so do the bar's own transitions.
  (widget) => widget is AppBar,
  // The Follows sort control: a segmented choice is the platform's grammar, and Material builds
  // its segments out of `TextButton`s.
  (widget) => widget is SegmentedButton,
];

/// Whether [element] sits under a registered exception host.
bool insideMaterialFaceException(Element element) {
  var inside = false;
  element.visitAncestorElements((ancestor) {
    if (materialFaceExceptionHosts.any((host) => host(ancestor.widget))) {
      inside = true;
      return false;
    }
    return true;
  });
  return inside;
}

/// Asserts that [scope] draws none of the replaced faces, and no Material progress at all.
///
/// The progress assertion is by subtype rather than by type on purpose: the pull-to-refresh
/// indicator, a registered exception, is a `CircularProgressIndicator`, so a pull in flight
/// legitimately draws one. Call this on a settled tree with no pull in flight, which is where the
/// assertion is deterministic.
void expectNoReplacedMaterialFaces(Finder scope) {
  for (final face in replacedMaterialFaces) {
    final strays = find
        .descendant(of: scope, matching: find.byType(face))
        .evaluate()
        .where((element) => !insideMaterialFaceException(element))
        .toList();
    expect(strays, isEmpty, reason: '$face is not GitPulse’s any more');
  }
  expect(
    find.descendant(
      of: scope,
      matching: find.byWidgetPredicate(
        (widget) => widget is CircularProgressIndicator,
      ),
    ),
    findsNothing,
    reason: 'progress is the app’s own indicator',
  );
}
