import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('identical refresh chains share retained provenance without losing continuation', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: []);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [releaseJson(8, 'same', '2026-10-10T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'next',
              ),
            },
          ),
        );
    await settle(h.container);
    for (var i = 0; i < 5; i++) {
      await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
    }
    final history = await disk.cache!.readHistory(
      scope: h.session.state.identity!.account.scope,
      now: disk.now,
    );
    expect(history.repositories['R_a']!.pages, hasLength(1));
    h.session.handlers[pageRequest({'R_a': 'next'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson('octo', 'alpha', [
            releaseJson(7, 'older', '2026-10-09T00:00:00Z'),
          ]),
        },
      ),
    );
    await h.container.read(releaseTimelineSessionProvider.notifier).loadOlder();
    expect(keys(h.container), ['R_a:8', 'R_a:7']);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:8', 'R_a:7']);
  });
}
