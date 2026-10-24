import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/generated/app_localizations.dart';
import '../releases/document_content.dart';
import '../releases/release_drawer.dart';
import '../releases/repository_releases_screen.dart';
import '../session/native_login_handoff.dart';
import 'repository_screen.dart';
import 'repository_service.dart';

typedef RepositoryLinkTarget = ({
  String owner,
  String repository,
  bool releases,
});

RepositoryLinkTarget? repositoryTargetFromUri(Uri uri) {
  if (safeContentUri(uri.toString()) == null || uri.host != 'github.com') {
    return null;
  }
  final parts = uri.pathSegments.toList();
  if (parts.isNotEmpty && parts.last.isEmpty) parts.removeLast();
  final target = switch (parts) {
    [final owner, final repository] => (
      owner: owner,
      repository: repository,
      releases: false,
    ),
    [final owner, final repository, 'releases'] => (
      owner: owner,
      repository: repository,
      releases: true,
    ),
    _ => null,
  };
  if (target == null ||
      !validRepositoryIdentity(target.owner, target.repository)) {
    return null;
  }
  return target;
}

Future<void> openRepositoryPage(
  BuildContext context,
  RepositoryLinkTarget target,
) {
  // A pageless route sits above the existing drawer instead of replacing its
  // GoRouter page. Back restores the same Entry Release and timeline scroll.
  return Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) => target.releases
          ? RepositoryReleasesScreen(
              owner: target.owner,
              repository: target.repository,
            )
          : RepositoryScreen(
              owner: target.owner,
              repository: target.repository,
            ),
    ),
  );
}

Future<bool> openNativeContentLink(
  BuildContext context,
  WidgetRef ref,
  String value, {
  bool external = false,
}) async {
  final uri = safeContentUri(value);
  if (uri == null) return true;
  if (!external) {
    final repository = repositoryTargetFromUri(uri);
    if (repository != null) {
      await openRepositoryPage(context, repository);
      return true;
    }
    final release = releaseTargetFromUri(uri);
    if (release != null) {
      await showReleaseDrawer(context, release);
      return true;
    }
  }
  try {
    if (await ref.read(browserLauncherProvider)(uri)) return true;
  } catch (_) {
    // Failed external launches stay local to the content surface.
  }
  if (context.mounted) {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(AppLocalizations.of(context).releaseLinkFailed)),
    );
  }
  return true;
}

/// The navigation bar every Repository page shares: Back to whatever opened the
/// page, and Home to the Timeline.
///
/// [title] stays optional because a page whose own content already names itself
/// — the repository detail, which opens with the repository's identity — must
/// not print that name a second time a few pixels above it.
class RepositoryPageAppBar extends StatelessWidget
    implements PreferredSizeWidget {
  const RepositoryPageAppBar({super.key, this.title});
  final String? title;
  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) => AppBar(
    title: title == null ? null : Text(title!),
    leading: BackButton(
      onPressed: () {
        if (Navigator.of(context).canPop()) {
          Navigator.of(context).pop();
        } else {
          GoRouter.maybeOf(context)?.go('/timeline');
        }
      },
    ),
    actions: [
      IconButton(
        tooltip: AppLocalizations.of(context).navigationHome,
        icon: const Icon(Icons.home_outlined),
        onPressed: () {
          final router = GoRouter.maybeOf(context);
          Navigator.of(context).popUntil((route) => route.isFirst);
          router?.go('/timeline');
        },
      ),
    ],
  );
}
