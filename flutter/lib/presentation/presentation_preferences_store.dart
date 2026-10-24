import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'presentation_preferences.dart';

/// The file containing this installation's device presentation preferences.
///
/// A small independent file: it lives beside, but never inside, the disposable
/// release timeline database, so clearing that cache cannot erase it.
final presentationPreferencesFileProvider = Provider<Future<File> Function()>(
  (ref) =>
      () async => File(
        p.join(
          (await getApplicationSupportDirectory()).path,
          'presentation_preferences.json',
        ),
      ),
);

final presentationPreferencesStoreProvider = Provider(
  (ref) => PresentationPreferencesStore(
    ref.watch(presentationPreferencesFileProvider),
  ),
);

/// Reads and writes [PresentationPreferences] as one local JSON document.
///
/// Unreadable content is treated as "nothing chosen yet"; only real device
/// storage failures reach the caller.
class PresentationPreferencesStore {
  const PresentationPreferencesStore(this._file);

  final Future<File> Function() _file;

  Future<PresentationPreferences> read() async {
    final file = await _file();
    if (!await file.exists()) return const PresentationPreferences();
    final raw = await file.readAsString();
    try {
      return PresentationPreferences.fromJson(jsonDecode(raw));
    } on FormatException {
      return const PresentationPreferences();
    }
  }

  Future<void> write(PresentationPreferences preferences) async {
    final file = await _file();
    await file.parent.create(recursive: true);
    // Write beside the target, then replace it in one step so an interrupted
    // save cannot leave a truncated preferences document behind.
    final temporary = File('${file.path}.tmp');
    await temporary.writeAsString(
      jsonEncode(preferences.toJson()),
      flush: true,
    );
    await temporary.rename(file.path);
  }
}
