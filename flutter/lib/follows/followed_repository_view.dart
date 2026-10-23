import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// How this device shows Followed Repositories.
///
/// Compact is identity only. Detailed adds the description, language, and
/// star count from the metadata lookup. The choice is not an account setting.
enum FollowedRepositoryView { compact, detailed }

final followedRepositoryViewFileProvider = Provider<Future<File> Function()>(
  (ref) =>
      () async => File(
        p.join(
          (await getApplicationSupportDirectory()).path,
          'followed_repository_view.txt',
        ),
      ),
);

final followedRepositoryViewStoreProvider = Provider(
  (ref) => FollowedRepositoryViewStore(
    ref.watch(followedRepositoryViewFileProvider),
  ),
);

/// Remembers the Followed Repository View on this device.
class FollowedRepositoryViewStore {
  const FollowedRepositoryViewStore(this._file);

  final Future<File> Function() _file;

  Future<FollowedRepositoryView> read() async {
    final file = await _file();
    if (!await file.exists()) return FollowedRepositoryView.compact;
    final stored = (await file.readAsString()).trim();
    return stored == FollowedRepositoryView.detailed.name
        ? FollowedRepositoryView.detailed
        : FollowedRepositoryView.compact;
  }

  Future<void> write(FollowedRepositoryView view) async {
    final file = await _file();
    await file.parent.create(recursive: true);
    final temporary = File('${file.path}.tmp');
    await temporary.writeAsString(view.name, flush: true);
    await temporary.rename(file.path);
  }
}

final followedRepositoryViewProvider =
    NotifierProvider<FollowedRepositoryViewController, FollowedRepositoryView>(
      FollowedRepositoryViewController.new,
    );

class FollowedRepositoryViewController
    extends Notifier<FollowedRepositoryView> {
  var _choseLocally = false;

  @override
  FollowedRepositoryView build() {
    unawaited(_restore());
    return FollowedRepositoryView.compact;
  }

  Future<void> _restore() async {
    try {
      final stored = await ref.read(followedRepositoryViewStoreProvider).read();
      if (!ref.mounted || _choseLocally || stored == state) return;
      state = stored;
    } catch (_) {
      // A missing device store leaves the in-memory choice, which starts
      // at Compact View.
    }
  }

  Future<void> select(FollowedRepositoryView view) async {
    _choseLocally = true;
    if (state == view) return;
    state = view;
    try {
      await ref.read(followedRepositoryViewStoreProvider).write(view);
    } catch (_) {
      // The choice still applies for this run when the device cannot store it.
    }
  }

  Future<void> toggle() => select(
    state == FollowedRepositoryView.compact
        ? FollowedRepositoryView.detailed
        : FollowedRepositoryView.compact,
  );
}
