import 'dart:async';

import 'package:gitpulse/session/gitpulse_http.dart';

import '../timeline/timeline_test_support.dart';
import '../releases/release_detail_service_test.dart' show releaseDetailJson;
import '../releases/repository_releases_service_test.dart'
    show listReleaseJson, releaseListJson;

/// The responses a test needs to follow one release from the Timeline into its
/// page and on into the repository's release list.
///
/// The fixtures are the release surfaces' own — one followed repository, one
/// release in the timeline round, its details, and that repository's list — so a
/// test that is about something else (the app's faces, a repository page's
/// bands) does not have to rebuild them to reach a release.
Map<String, FutureOr<BackendResult> Function()> releaseBrowsingHandlers() => {
  'GET api/settings': () => BackendResult(
    statusCode: 200,
    data: settingsJson([followJson('R_app', 'octo', 'app')]),
  ),
  'POST api/release-timeline/refresh': () => BackendResult(
    statusCode: 200,
    data: roundJson(
      pages: {
        'R_app': pageJson('octo', 'app', [
          releaseJson(42, 'v2', '2026-10-17T12:00:00Z'),
        ]),
      },
    ),
  ),
  'GET api/releases/octo/app/42': () => BackendResult(
    statusCode: 200,
    data: {...releaseDetailJson(), 'name': 'Release notes'},
  ),
  'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
    statusCode: 200,
    data: releaseListJson([listReleaseJson(42, 'v2')]),
  ),
};
