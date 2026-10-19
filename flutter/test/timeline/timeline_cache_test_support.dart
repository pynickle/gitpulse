import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:path/path.dart' as p;

import 'timeline_test_support.dart';

typedef Harness = ({
  ProviderContainer container,
  FakeSessionController session,
});

void configure(
  Harness h, {
  required List<Map<String, Object?>> releases,
  int? days = 30,
  String owner = 'octo',
}) {
  h.session.handlers['GET api/settings'] = () => BackendResult(
    statusCode: 200,
    data: {
      ...settingsJson([followJson('R_a', owner, 'alpha')]),
      if (days != null) 'releaseTimeline': {'retentionDays': days},
    },
  );
  h.session.handlers['POST api/release-timeline/refresh'] = () => BackendResult(
    statusCode: 200,
    data: roundJson(pages: {'R_a': pageJson(owner, 'alpha', releases)}),
  );
}

class DiskTimeline {
  DiskTimeline(this.directory);
  final Directory directory;
  final now = DateTime.utc(2026, 10, 19, 12);
  TimelineCache? get cache => container?.read(timelineCacheProvider);
  ProviderContainer? container;

  static Future<DiskTimeline> create() async {
    final disk = DiskTimeline(
      await Directory.systemTemp.createTemp('gitpulse-cache-'),
    );
    addTearDown(() async {
      await disk.close();
      await disk.directory.delete(recursive: true);
    });
    return disk;
  }

  Harness open({
    String login = 'octocat',
    AuthenticatedIdentity? identity,
    DateTime Function()? now,
    String Function(DateTime)? localDateKey,
    Future<File> Function()? cacheFileLookup,
  }) {
    final h = createHarness(
      cacheFile: File(p.join(directory.path, 'timeline.sqlite')),
      cacheFileLookup: cacheFileLookup,
      now: now ?? () => this.now,
      identity: identity,
      login: login,
      localDateKey: localDateKey,
    );
    container = h.container;
    return h;
  }

  Future<void> close() async {
    final history = cache;
    container?.dispose();
    container = null;
    await history?.close();
  }
}

Future<void> settle(ProviderContainer container) async {
  for (var i = 0; i < 100; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 5));
    if (!readState(container).loading && readState(container).active) return;
  }
  fail('timeline did not settle');
}

List<String> keys(ProviderContainer container) =>
    readState(container).groups
        .expand((group) => group.items)
        .map((release) => release.key)
        .toList();
