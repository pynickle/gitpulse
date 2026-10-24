import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

/// Real Nitro routes and account storage; only external GitHub reads are supplied.
/// Each suite owns its process. Callers sharing it must use distinct account logins.
class TimelineHttpServer {
  TimelineHttpServer._(this.address, this._process, this._directory);

  final Uri address;
  final Process _process;
  final Directory _directory;

  static Future<TimelineHttpServer> start() async {
    final directory = await Directory.systemTemp.createTemp(
      'gitpulse-timeline-http-',
    );
    Process? process;
    try {
      // Use a committed alias map so a clean checkout needs no Nuxt generation.
      process = await Process.start('bun', [
        '--tsconfig-override',
        p.absolute('..', 'tests', 'fixtures', 'flutter-http.tsconfig.json'),
        p.absolute('..', 'tests', 'fixtures', 'release-timeline-server.ts'),
        directory.path,
      ]);
      final output = StringBuffer();
      final errors = StringBuffer();
      final address = Completer<String>();
      process.stdout
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen((line) {
            output.writeln(line);
            if (!address.isCompleted && line.startsWith('http')) {
              address.complete(line);
            }
          });
      process.stderr.transform(utf8.decoder).listen(errors.write);
      final ready =
          await Future.any<String>([
            address.future,
            process.exitCode.then(
              (code) =>
                  throw StateError('Fixture exited with $code: $output$errors'),
            ),
          ]).timeout(
            const Duration(seconds: 20),
            onTimeout: () =>
                throw StateError('Fixture did not start: $output$errors'),
          );
      return TimelineHttpServer._(Uri.parse(ready), process, directory);
    } catch (_) {
      if (process != null) {
        process.kill();
        await process.exitCode.timeout(const Duration(seconds: 10));
      }
      await directory.delete(recursive: true);
      rethrow;
    }
  }

  Future<void> close() async {
    try {
      _process.kill();
      await _process.exitCode.timeout(const Duration(seconds: 10));
    } finally {
      await _directory.delete(recursive: true);
    }
  }
}

Map<String, Object?> fixtureRelease(
  int id,
  String tag,
  String publishedAt, {
  String? description,
}) => {
  'id': id,
  'tagName': tag,
  'name': null,
  'description': description,
  'publishedAt': publishedAt,
  'isDraft': false,
  'isPrerelease': false,
  'assetCount': 0,
  'htmlUrl': 'https://github.test/octo/alpha/releases/tag/$tag',
  'reactions': const <Object?>[],
};

Map<String, Object?> fixturePage(
  String owner,
  String name,
  List<Map<String, Object?>> releases,
) => {
  'status': 'available',
  'owner': owner,
  'name': name,
  'hasOlderReleases': false,
  'endCursor': null,
  'incomplete': false,
  'releases': releases,
};
