import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:html/parser.dart' as html;

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
      final document = html.parseFragment(
        prepareDocument('''
<script>secret()</script><iframe src="https://bad.test"></iframe>
<p style="background:url(https://bad.test)" onclick="secret()">Safe</p>
<a href="javascript:secret()">Bad link</a>
<img src="file:///private/secret" srcset="https://bad.test 2x">
<img src="https://github.com/octo/app/blob/v2/logo.png" alt="Logo">
''', context),
      );
      expect(document.querySelector('script'), isNull);
      expect(document.querySelector('iframe'), isNull);
      expect(document.querySelector('p')!.attributes, isEmpty);
      expect(document.querySelector('a')!.attributes['href'], isNull);
      final images = document.querySelectorAll('img');
      expect(images.first.attributes, isEmpty);
      expect(
        images.last.attributes['src'],
        'https://raw.githubusercontent.com/octo/app/v2/logo.png',
      );
      expect(safeContentUri('https://user:secret@github.com/octo/app'), isNull);
      expect(
        safeContentUri('data:image/png;base64,secret', image: true),
        isNull,
      );
    },
  );

  test('normalizes links and raw resources using repository, ref and document directory', () {
    const context = RepositoryDocumentContext(
      owner: 'octo',
      repository: 'app',
      ref: 'release/2',
      documentPath: 'docs/README.md',
    );
    final document = html.parseFragment(
      prepareDocument('''
[Guide](../guide.md)
![Chart](images/chart.png)
<details open><summary>Changes</summary><p>Ready</p></details>
<table><tr><td colspan="2">Cell</td></tr></table>
''', context),
    );
    expect(
      document.querySelector('a')!.attributes['href'],
      'https://github.com/octo/app/blob/release%2F2/guide.md',
    );
    expect(
      document.querySelector('img')!.attributes['src'],
      'https://raw.githubusercontent.com/octo/app/release%2F2/docs/images/chart.png',
    );
    expect(
      document.querySelector('details')!.attributes.containsKey('open'),
      isTrue,
    );
    expect(document.querySelector('td')!.attributes['colspan'], '2');
  });
}
