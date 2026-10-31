import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'release_detail_service.dart';

/// Every release surface answers to one prefix, so "the reader is in a release"
/// is a path test rather than a stack to count (ADR 0039).
const releaseRoutePrefix = '/releases';

const _timelineDestination = '/timeline';

/// One opening of a release: the step the reader took into release surfaces, and
/// the release they were reading when they did.
///
/// Every surface this feature opens from here asks the same two questions — is
/// this still the release I started from, and if not, where does one step back
/// lead — and neither can be answered from a route alone. A link in the notes,
/// a row in the list and a release opened from another release all push onto the
/// same stack, so the entry release is whatever the first of them was.
class ReleaseOpening {
  ReleaseOpening(this.entry, {this.entryId, ReleaseTarget? current})
    : current = current ?? entry;

  /// The release the reader entered release surfaces through.
  final ReleaseTarget entry;

  /// The release on screen right now, as this opening last saw it.
  final ReleaseTarget current;

  /// The id the entry release resolved to, when the screen has loaded it. A tag
  /// and an id can name the same release, and the release the reader is on is
  /// the same one either way.
  final int? entryId;

  /// The same opening, with [target] standing on screen.
  ReleaseOpening replaced(ReleaseTarget target) =>
      ReleaseOpening(entry, entryId: entryId, current: target);

  /// The same opening, knowing the identity the entry release resolved to.
  ReleaseOpening resolved(int releaseId) =>
      ReleaseOpening(entry, entryId: releaseId, current: current);

  /// Whether [target] is the release the reader entered through.
  ///
  /// Only the entry release is compared, never "the release on screen": a
  /// release reached from another one is still another release while it is
  /// open, and asking whether the reader is *somewhere in this opening* would
  /// answer yes and hide the step back exactly when it is needed.
  bool isEntry(ReleaseTarget target) {
    if (sameReleaseAddress(target, entry)) return true;
    if (entryId != null && target.id != null) return entryId == target.id;
    return false;
  }

  /// Whether two addresses name the same release.
  bool isSameAddress(ReleaseTarget right) => sameReleaseAddress(entry, right);
}

/// Whether two addresses name the same release.
///
/// A release named by its tag and the same release named by its id are one
/// release, and a screen must not offer a step back to where the reader is.
bool sameReleaseAddress(ReleaseTarget left, ReleaseTarget right) {
  if (left.owner.toLowerCase() != right.owner.toLowerCase()) return false;
  if (left.repository.toLowerCase() != right.repository.toLowerCase()) {
    return false;
  }
  return left.id != null ? left.id == right.id : left.tag == right.tag;
}

/// The opening a release screen belongs to, or null when no release is open.
///
/// It outlives a screen on purpose: the list and another release are pushed
/// *above* the entry release, so the entry release's widget is not rebuilt while
/// the reader is on them, and the step back has to know a release it is not
/// currently showing.
final releaseOpeningProvider =
    NotifierProvider<ReleaseOpeningController, ReleaseOpening?>(
      ReleaseOpeningController.new,
    );

class ReleaseOpeningController extends Notifier<ReleaseOpening?> {
  @override
  ReleaseOpening? build() => null;

  void start(ReleaseTarget entry) => state = ReleaseOpening(entry);

  /// Records the release being replaced, keeping the entry release it belongs to.
  void show(ReleaseTarget target) {
    final opening = state;
    state = opening == null ? ReleaseOpening(target) : opening.replaced(target);
  }

  /// Notes that the screen on view is this release.
  void viewing(ReleaseTarget target) => state = state?.replaced(target);

  /// The identity the entry release resolved to, once a screen has loaded it.
  void resolveEntry(ReleaseTarget target, int releaseId) {
    final opening = state;
    if (opening == null || !opening.isEntry(target)) return;
    if (opening.entryId != null) return;
    state = opening.resolved(releaseId);
  }

  void clear() => state = null;
}

/// The screen one release opens as: its repository, then the release itself —
/// by id when the surface that opened it knew one, and by tag when it did not.
///
/// A release named by its tag still takes a segment of its own. The list route
/// owns `/releases/:owner/:repository`, so a tag carried only in the query would
/// be read as the list — the address says which release it is, and the query
/// repeats it for anything that reads it back.
String releaseEntryLocation(ReleaseTarget target) {
  final base =
      '$releaseRoutePrefix/${Uri.encodeComponent(target.owner)}/'
      '${Uri.encodeComponent(target.repository)}/';
  return switch ((target.id, target.tag)) {
    (final id?, _) => '$base$id',
    (null, final tag?) =>
      '$base${Uri.encodeComponent(tag)}?'
          '${Uri(queryParameters: {'tag': tag}).query}',
    (null, null) => base,
  };
}

/// A repository's releases, as a page of its own.
String repositoryReleasesLocation(String owner, String repository) =>
    '$releaseRoutePrefix/${Uri.encodeComponent(owner)}/'
    '${Uri.encodeComponent(repository)}';

/// One release's Release Assets, as a page of its own.
///
/// The assets are addressed exactly as the release they belong to, with one more
/// segment: a reader who is looking at a release's files is looking at that
/// release, and the two addresses say so.
String releaseAssetsLocation(ReleaseTarget target) =>
    '${releaseEntryLocation(target)}/assets';

/// The repository page a release's title leads to.
///
/// It is a route of this feature rather than a separate repository route,
/// because it has to say where the reader came from: leaving a repository that
/// was opened from a release returns to that release, and leaving a release
/// returns to the Timeline. One path carries both facts.
String releaseRepositoryLocation(ReleaseTarget target) =>
    '${releaseEntryLocation(target)}/repository';

/// Opens one release, starting an opening when there is not one already.
///
/// The release the reader came in through is remembered, so every screen above
/// it can step back to it rather than all the way home.
Future<void> openRelease(
  BuildContext context,
  WidgetRef ref,
  ReleaseTarget target,
) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
  ref.read(releaseOpeningProvider.notifier).start(target);
  return router.push(releaseEntryLocation(target));
}

/// Swaps the release being read for another one, keeping the stack where it is.
///
/// A release reached from a release — a link in the notes, a row in the list —
/// replaces it instead of stacking on it, so the reader's Back is the entry
/// release rather than a ladder of every release they glanced at.
Future<void> showReleaseInPlace(
  BuildContext context,
  WidgetRef ref,
  ReleaseTarget target,
) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
  ref.read(releaseOpeningProvider.notifier).show(target);
  return router.pushReplacement(releaseEntryLocation(target));
}

/// Opens a repository's releases, replacing the release the reader is on.
Future<void> openRepositoryReleases(
  BuildContext context, {
  required String owner,
  required String repository,
}) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
  return router.pushReplacement(repositoryReleasesLocation(owner, repository));
}

/// Opens one release's Release Assets above the release itself.
///
/// It is pushed rather than swapped: the release's notes stay where they were,
/// and the way back from a release's files is that release.
Future<void> openReleaseAssets(BuildContext context, ReleaseTarget target) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
  return router.push(releaseAssetsLocation(target));
}

/// Opens the repository the release belongs to, above the release.
Future<void> openRepositoryFromRelease(
  BuildContext context,
  ReleaseTarget target,
) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
  return router.push(releaseRepositoryLocation(target));
}

/// Steps back to the entry release from a release the reader reached second-hand.
///
/// The step replaces the screen they are on rather than stacking the entry
/// release above it, so the entry release is where the reader is, exactly as it
/// was, and there is one fewer screen between them and closing.
void backToEntryRelease(
  BuildContext context,
  WidgetRef ref,
  ReleaseTarget entry,
) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return;
  ref.read(releaseOpeningProvider.notifier).start(entry);
  router.pushReplacement(releaseEntryLocation(entry));
}

/// Leaves every release surface for the Timeline.
///
/// Closing is only ever asked for from the entry release (or from the list a
/// swipe opened from it): a reader who is finished with releases is finished
/// with all of them, so the screens this feature pushed are popped together and
/// the shell's own Timeline is what remains.
void closeReleases(BuildContext context, WidgetRef ref) {
  final router = GoRouter.maybeOf(context);
  final navigator = Navigator.maybeOf(context);
  if (navigator != null && navigator.canPop()) {
    navigator.popUntil((route) => route.isFirst);
  }
  ref.read(releaseOpeningProvider.notifier).clear();
  router?.go(_timelineDestination);
}
