import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/releases/document_content.dart';

void main() {
  test(
    'only supported GitHub release destinations become native navigation',
    () {
      final release = releaseTargetFromUri(
        Uri.parse('https://github.com/octo/app/releases/tag/release%2F2'),
      );
      expect(release, (
        owner: 'octo',
        repository: 'app',
        id: null,
        tag: 'release/2',
      ));
      for (final url in [
        'https://github.com/octo/app',
        'https://github.com/octo/app/releases',
        'https://github.com/octo/app/issues/1',
        'https://github.com/octo/app/pull/1',
        'https://evil.example/octo/app/releases/tag/v2',
      ]) {
        expect(releaseTargetFromUri(Uri.parse(url)), isNull);
      }
    },
  );

  test(
    'root-relative repository resources remain inside the repository ref',
    () {
      const context = RepositoryDocumentContext(
        owner: 'octo',
        repository: 'app',
        ref: 'v2',
        documentPath: 'docs/README.md',
      );
      expect(
        context.resolve('/images/logo.png', image: true).toString(),
        'https://raw.githubusercontent.com/octo/app/v2/images/logo.png',
      );
      expect(
        context.resolve('/guide.md').toString(),
        'https://github.com/octo/app/blob/v2/guide.md',
      );
    },
  );

  test(
    'converts GitHub blob images to raw resources and rejects active content',
    () {
      const context = RepositoryDocumentContext(
        owner: 'octo',
        repository: 'app',
        ref: 'v2',
      );
      expect(
        context
            .resolve(
              'https://github.com/octo/app/blob/v2/logo.png',
              image: true,
            )
            .toString(),
        'https://raw.githubusercontent.com/octo/app/v2/logo.png',
      );
      for (final blocked in [
        'javascript:secret()',
        'file:///private/secret',
        'data:image/png;base64,secret',
        'https://user:secret@github.com/octo/app',
        '   ',
      ]) {
        expect(context.resolve(blocked), isNull, reason: blocked);
        expect(context.resolve(blocked, image: true), isNull, reason: blocked);
      }
      expect(safeContentUri('https://user:secret@github.com/octo/app'), isNull);
      expect(
        safeContentUri('data:image/png;base64,secret', image: true),
        isNull,
      );
      expect(
        safeContentUri('mailto:team@example.com').toString(),
        'mailto:team@example.com',
      );
      expect(safeContentUri('mailto:team@example.com', image: true), isNull);
    },
  );

  test('links and resources resolve against the document directory and its revision', () {
    const context = RepositoryDocumentContext(
      owner: 'octo',
      repository: 'app',
      ref: 'release/2',
      documentPath: 'docs/README.md',
    );
    expect(
      context.resolve('../guide.md').toString(),
      'https://github.com/octo/app/blob/release%2F2/guide.md',
    );
    expect(
      context.resolve('images/chart.png', image: true).toString(),
      'https://raw.githubusercontent.com/octo/app/release%2F2/docs/images/chart.png',
    );
    expect(context.resolve('#install').toString(), '#install');
    expect(context.resolve('#install', image: true), isNull);
    expect(
      context.resolve('//cdn.example.com/chart.png', image: true).toString(),
      'https://cdn.example.com/chart.png',
    );
    expect(
      context.resolve('mailto:team@example.com').toString(),
      'mailto:team@example.com',
    );
  });
}
