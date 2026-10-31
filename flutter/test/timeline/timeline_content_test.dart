import 'dart:async';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/repositories/repository_models.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_content.dart';
import 'package:gitpulse/timeline/timeline_dto.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_service.dart';
import 'package:path/path.dart' as p;

import 'timeline_test_support.dart' show pageJson, releaseJson, utcPlusEight;

final _now = DateTime.utc(2026, 10, 31, 12);
const _environment = TimelineEnvironment(localDateKey: utcPlusEight);
const _repo = RepositoryReference(id: 'R_a', owner: 'octo', name: 'alpha');

void main() {
  test(
    'a pending policy read finishes safely after its session is disposed',
    () async {
      final cache = TimelineCache(NativeDatabase.memory());
      addTearDown(cache.close);
      var generation = 0;
      var disposed = false;
      final policy = Completer<int?>();
      final content = TimelineContentController(
        cache: () => cache,
        rebuild: (_) async {},
        clock: () => _now,
        environment: () => _environment,
        scope: () {
          if (disposed) throw StateError('Disposed session');
          return 'account';
        },
        generation: () => generation,
        invalidate: () => ++generation,
        isCurrent: (ticket) => !disposed && ticket == generation,
        resolveRetention: () => policy.future,
      );
      final resolving = content.resolveRetentionWindow();
      disposed = true;
      generation++;
      policy.complete(30);
      await expectLater(resolving, completes);
    },
  );

  test(
    'initialization fallback keeps cache-action admission until it finishes',
    () async {
      final cache = TimelineCache(NativeDatabase.memory());
      addTearDown(cache.close);
      var generation = 0;
      final content = TimelineContentController(
        cache: () => cache,
        rebuild: (_) async {},
        clock: () => _now,
        environment: () => _environment,
        scope: () => 'account',
        generation: () => generation,
        invalidate: () => ++generation,
        isCurrent: (ticket) => ticket == generation,
        resolveRetention: () async => null,
      );
      final started = Completer<void>();
      final release = Completer<void>();
      final retry = content.retrySaving(
        initialize: () async {
          started.complete();
          await release.future;
        },
      );
      await started.future;
      await content.clear();
      expect(generation, 0);
      release.complete();
      await retry;
    },
  );

  test(
    'a later save retains every fetched page after an earlier save fails',
    () async {
      final cache = TimelineCache(NativeDatabase.memory());
      addTearDown(cache.close);
      var generation = 0;
      final content = TimelineContentController(
        cache: () => cache,
        rebuild: (_) async {},
        clock: () => _now,
        environment: () => _environment,
        scope: () => 'account',
        generation: () => generation,
        invalidate: () => ++generation,
        isCurrent: (ticket) => ticket == generation,
        resolveRetention: () async => 30,
      );
      content.confirmFollows([_repo]);
      await content.prepareHistory(0);
      await content.acceptRound(0, _round(1, 'p1'), ['R_a'], refresh: true);
      await cache.customStatement(
        '''CREATE TEMP TRIGGER fail_save
      BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'disk full'); END''',
      );
      await content.acceptRound(
        0,
        _round(2, 'p2'),
        ['R_a'],
        refresh: false,
        cursors: {'R_a': 'p1'},
      );
      expect(content.snapshot.cacheFailed, isTrue);
      expect(_ids(content.snapshot.groups), [1, 2]);
      await cache.customStatement('DROP TRIGGER fail_save');
      await content.acceptRound(
        0,
        _round(3, 'p3'),
        ['R_a'],
        refresh: false,
        cursors: {'R_a': 'p2'},
      );
      expect(content.snapshot.cacheFailed, isFalse);
      final saved = await cache.restore(
        scope: 'account',
        now: _now,
        environment: _environment,
      );
      expect(_ids(saved!.groups), [1, 2, 3]);
    },
  );

  test(
    'rebuild replays multiple fetched pages without the connected cached tail',
    () async {
      final disk = await _ContentDisk.create();
      final content = disk.content;
      content.confirmFollows([_repo]);
      await content.prepareHistory(0);
      await content.acceptRound(0, _round(1, 'p1'), ['R_a'], refresh: true);
      await content.acceptRound(
        0,
        _round(2, 'p2'),
        ['R_a'],
        refresh: false,
        cursors: {'R_a': 'p1'},
      );
      await content.acceptRound(
        0,
        _round(3, 'p3'),
        ['R_a'],
        refresh: false,
        cursors: {'R_a': 'p2'},
      );

      content.beginFreshWindow();
      await content.prepareHistory(0);
      await content.acceptRound(0, _round(0, 'fresh'), ['R_a'], refresh: true);
      await content.acceptRound(
        0,
        _round(2, 'fresh-next'),
        ['R_a'],
        refresh: false,
        cursors: {'R_a': 'fresh'},
      );
      expect(_ids(content.snapshot.groups), [0, 2, 3]);

      await content.rebuild();
      expect(_ids(content.snapshot.groups), [0, 2]);
      await disk.reopen();
      expect(_ids((await disk.restore())!.groups), [0, 2]);
    },
  );

  for (final recovery in ['retry', 'rebuild', 'retention']) {
    test(
      'unfollow and rename keep unsaved peer pages through $recovery and reopening',
      () async {
        final disk = await _ContentDisk.create();
        final content = disk.content;
        content.confirmFollows([_repo, _peer]);
        await content.prepareHistory(0);
        await content.acceptRound(0, _pairRound(1, 'p1'), [
          'R_a',
          'R_b',
        ], refresh: true);
        await disk.cache.customStatement(
          '''CREATE TEMP TRIGGER fail_save
        BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'disk full'); END''',
        );
        await content.acceptRound(
          0,
          _pairRound(2, 'p2'),
          ['R_a', 'R_b'],
          refresh: false,
          cursors: {'R_a': 'p1', 'R_b': 'p1'},
        );
        expect(content.snapshot.cacheFailed, isTrue);
        await content.applyFollows(0, [
          const RepositoryReference(id: 'R_b', owner: 'octo', name: 'renamed'),
        ]);
        await disk.cache.customStatement('DROP TRIGGER fail_save');
        switch (recovery) {
          case 'retry':
            await content.retrySaving();
          case 'rebuild':
            await content.rebuild();
          case 'retention':
            await content.applyRetentionWindow(14, 0);
        }
        expect(content.snapshot.cacheFailed, isFalse);
        expect(_ids(content.snapshot.groups), [101, 102]);
        await disk.reopen();
        final saved = (await disk.restore())!;
        expect(_ids(saved.groups), [101, 102]);
        expect(
          saved.groups
              .expand((group) => group.items)
              .map((item) => item.repository.name),
          everyElement('renamed'),
        );
      },
    );
  }
}

const _peer = RepositoryReference(id: 'R_b', owner: 'octo', name: 'beta');

TimelineResult<TimelineRoundDto> _pairRound(int page, String next) =>
    TimelineResult.data(
      TimelineRoundDto.fromJson({
        'pages': {
          for (final (repo, id) in [(_repo, page), (_peer, 100 + page)])
            repo.id: pageJson(
              repo.owner,
              repo.name,
              [
                releaseJson(
                  id,
                  'v$id',
                  _now.subtract(Duration(minutes: page)).toIso8601String(),
                ),
              ],
              hasOlderReleases: true,
              endCursor: next,
            ),
        },
      }),
    );

class _ContentDisk {
  _ContentDisk(this.directory);
  final Directory directory;
  late TimelineCache cache;
  late final TimelineContentController content;
  var generation = 0;
  File get file => File(p.join(directory.path, 'content.sqlite'));

  static Future<_ContentDisk> create() async {
    final disk = _ContentDisk(
      await Directory.systemTemp.createTemp('gitpulse-content-'),
    );
    disk.cache = TimelineCache(NativeDatabase(disk.file));
    disk.content = TimelineContentController(
      cache: () => disk.cache,
      rebuild: (isCurrent) async {
        await disk.cache.close();
        await disk.file.delete();
        disk.cache = TimelineCache(NativeDatabase(disk.file));
      },
      clock: () => _now,
      environment: () => _environment,
      scope: () => 'account',
      generation: () => disk.generation,
      invalidate: () => ++disk.generation,
      isCurrent: (ticket) => ticket == disk.generation,
      resolveRetention: () async => 30,
    );
    addTearDown(() async {
      await disk.cache.close();
      await disk.directory.delete(recursive: true);
    });
    return disk;
  }

  Future<void> reopen() async {
    await cache.close();
    cache = TimelineCache(NativeDatabase(file));
  }

  Future<SavedTimeline?> restore() =>
      cache.restore(scope: 'account', now: _now, environment: _environment);
}

Iterable<int> _ids(List<TimelineGroup> groups) =>
    groups.expand((group) => group.items).map((item) => item.id);

TimelineResult<TimelineRoundDto> _round(int id, String next) =>
    TimelineResult.data(
      TimelineRoundDto.fromJson({
        'pages': {
          'R_a': pageJson(
            'octo',
            'alpha',
            [
              releaseJson(
                id,
                'v$id',
                _now.subtract(Duration(minutes: id)).toIso8601String(),
              ),
            ],
            hasOlderReleases: true,
            endCursor: next,
          ),
        },
      }),
    );
