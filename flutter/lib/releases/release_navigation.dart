import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'release_detail_service.dart';

/// Every release surface answers to one prefix, so "the reader is in a release"
/// is a path test rather than a stack to count (ADR 0039).
const releaseRoutePrefix = '/releases';

const _timelineDestination = '/timeline';

/// The screen one release opens as: its repository, then the release itself —
/// by id when the surface that opened it knew one, and by tag when it did not.
String releaseEntryLocation(ReleaseTarget target) {
  final base =
      '$releaseRoutePrefix/${Uri.encodeComponent(target.owner)}/'
      '${Uri.encodeComponent(target.repository)}/';
  return switch ((target.id, target.tag)) {
    (final id?, _) => '$base$id',
    (null, final tag?) => '$base?${Uri(queryParameters: {'tag': tag}).query}',
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

/// Opens one release above whatever the reader is reading.
Future<void> openRelease(BuildContext context, ReleaseTarget target) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
  return router.push(releaseEntryLocation(target));
}

/// Swaps the release being read for another one, keeping the stack where it is.
///
/// A release reached from a release — a link in the notes, a row in a list —
/// replaces it instead of stacking on it: the reader was already reading a
/// release, and stepping back through four of them would be a stack rather than
/// a way home.
Future<void> showReleaseInPlace(BuildContext context, ReleaseTarget target) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
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
Future<void> openReleaseAssets(
  BuildContext context, {
  required String owner,
  required String repository,
  int? id,
  String? tag,
}) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
  return router.push(
    releaseAssetsLocation((
      owner: owner,
      repository: repository,
      id: id,
      tag: tag,
    )),
  );
}

/// The repository page a release's title leads to.
///
/// It is a route of this feature rather than a separate repository route,
/// because it has to say where the reader came from: leaving a repository that
/// was opened from a release returns to that release, and leaving a release
/// returns to the Timeline. One path carries both facts.
String releaseRepositoryLocation({
  required String owner,
  required String repository,
  int? id,
  String? tag,
}) {
  final release = releaseEntryLocation((
    owner: owner,
    repository: repository,
    id: id,
    tag: tag,
  ));
  return '$release/repository';
}

/// Opens the repository the release belongs to, above the release.
Future<void> openRepositoryFromRelease(
  BuildContext context, {
  required String owner,
  required String repository,
  int? id,
  String? tag,
}) {
  final router = GoRouter.maybeOf(context);
  if (router == null) return Future.value();
  return router.push(
    releaseRepositoryLocation(
      owner: owner,
      repository: repository,
      id: id,
      tag: tag,
    ),
  );
}

/// Leaves every release surface for the Timeline.
///
/// Closing a release is not stepping back through it: a reader who is finished
/// with a release is finished with releases, so the screens this feature pushed
/// are popped together and the shell's own Timeline is what remains.
void closeReleases(BuildContext context) {
  final router = GoRouter.maybeOf(context);
  final navigator = Navigator.maybeOf(context);
  if (navigator != null && navigator.canPop()) {
    navigator.popUntil((route) => route.isFirst);
  }
  router?.go(_timelineDestination);
}
