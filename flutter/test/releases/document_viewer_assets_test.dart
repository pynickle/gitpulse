import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/releases/document_viewer_assets.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('the app ships the renderer it was tested with', () async {
    final assets = await loadDocumentViewerAssets();
    // The page needs both halves: the script that builds the document and the
    // stylesheet that gives it the app's typography.
    expect(assets.script, contains('gitpulseDocument'));
    expect(assets.script.length, greaterThan(50000));
    expect(assets.stylesheet, contains('.markdown-body'));
    expect(assets.stylesheet, contains('--gp-font-size'));
  });
}
