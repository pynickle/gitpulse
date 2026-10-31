import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../repositories/repository_navigation.dart';
import '../session/native_login_handoff.dart';
import 'document_content.dart';
import 'release_navigation.dart';

/// What a tap on a link inside a release does.
///
/// A release's notes are the author's markdown, and the links in them are the
/// author's: another release of the same repository, another repository, or the
/// web at large. The first two are the client's own screens, so they stay in the
/// app — a release replacing the release being read rather than stacking another
/// one above it — and everything else is handed to the platform's browser.
///
/// The notes never perform a navigation themselves. They report the link, and
/// this decides what it means, so a release read as a page, as an offline record
/// or through a document's link all resolve one way (ADR 0028).
Future<bool> openReleaseLink(
  BuildContext context,
  WidgetRef ref,
  String value, {
  bool external = false,
}) async {
  final uri = safeContentUri(value);
  if (uri == null) return true;
  if (!external) {
    final release = releaseTargetFromUri(uri);
    if (release != null) {
      // The navigation is started, not awaited: a push returns a future that
      // completes when the pushed screen is popped, and a document's link
      // handler must report what it did now, not when the reader leaves.
      unawaited(showReleaseInPlace(context, ref, release));
      return true;
    }
    final repository = repositoryTargetFromUri(uri);
    if (repository != null) {
      if (repository.releases) {
        unawaited(
          openRepositoryReleases(
            context,
            owner: repository.owner,
            repository: repository.repository,
          ),
        );
      } else {
        unawaited(openRepositoryPage(context, repository));
      }
      return true;
    }
  }
  try {
    if (await ref.read(browserLauncherProvider)(uri)) return true;
  } catch (_) {
    // A launch that failed stays local to the release the reader is on.
  }
  if (context.mounted) {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(AppLocalizations.of(context).releaseLinkFailed)),
    );
  }
  return true;
}
