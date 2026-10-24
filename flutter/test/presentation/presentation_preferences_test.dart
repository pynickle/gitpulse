import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/follows/followed_repository_view.dart'
    show followedRepositoryViewProvider;
import 'package:gitpulse/presentation/presentation_preferences.dart';
import 'package:gitpulse/presentation/presentation_preferences_controller.dart';
import 'package:gitpulse/presentation/presentation_preferences_store.dart';
import 'package:path/path.dart' as p;

void main() {
  group('PresentationPreferences', () {
    test('system options defer language and appearance to the platform', () {
      const preferences = PresentationPreferences();

      expect(preferences.locale, isNull);
      expect(preferences.themeMode, ThemeMode.system);
    });

    test('manual options select a supported locale and theme mode', () {
      expect(
        const PresentationPreferences(language: AppLanguage.simplifiedChinese)
            .locale,
        const Locale('zh'),
      );
      expect(
        const PresentationPreferences(language: AppLanguage.english).locale,
        const Locale('en'),
      );
      expect(
        const PresentationPreferences(appearance: AppAppearance.dark).themeMode,
        ThemeMode.dark,
      );
      expect(
        const PresentationPreferences(appearance: AppAppearance.light)
            .themeMode,
        ThemeMode.light,
      );
    });

    test('unusable stored values fall back to the system defaults', () {
      expect(
        PresentationPreferences.fromJson(const {
          'language': 'fr',
          'appearance': 3,
          'followedRepositoryView': 'grid',
        }),
        const PresentationPreferences(),
      );
      expect(
        PresentationPreferences.fromJson(const <String, Object?>{}),
        const PresentationPreferences(),
      );
      expect(
        PresentationPreferences.fromJson('not a preferences map'),
        const PresentationPreferences(),
      );
      expect(
        PresentationPreferences.fromJson(const {
          'language': 'en',
          'followedRepositoryView': false,
        }),
        const PresentationPreferences(language: AppLanguage.english),
      );
    });

    test('round-trips through its stored form', () {
      const preferences = PresentationPreferences(
        language: AppLanguage.simplifiedChinese,
        appearance: AppAppearance.dark,
      );

      expect(
        PresentationPreferences.fromJson(preferences.toJson()),
        preferences,
      );
    });

    test('stores the followed view alongside language and appearance', () {
      final preferences = PresentationPreferences.fromJson(const {
        'language': 'zh',
        'appearance': 'dark',
        'followedRepositoryView': 'detailed',
      });

      expect(preferences.language, AppLanguage.simplifiedChinese);
      expect(preferences.appearance, AppAppearance.dark);
      expect(
        preferences.followedRepositoryView,
        FollowedRepositoryView.detailed,
      );
      expect(preferences.toJson(), {
        'language': 'zh',
        'appearance': 'dark',
        'followedRepositoryView': 'detailed',
      });
      expect(
        preferences.copyWith(
          followedRepositoryView: FollowedRepositoryView.compact,
        ),
        const PresentationPreferences(
          language: AppLanguage.simplifiedChinese,
          appearance: AppAppearance.dark,
        ),
      );
    });
  });

  group('PresentationPreferencesStore', () {
    late Directory directory;
    late File file;
    late PresentationPreferencesStore store;

    setUp(() async {
      directory = await Directory.systemTemp.createTemp(
        'gitpulse-presentation-',
      );
      file = File(p.join(directory.path, 'presentation_preferences.json'));
      store = PresentationPreferencesStore(() async => file);
    });

    tearDown(() => directory.delete(recursive: true));

    test('starts on system defaults before anything is saved', () async {
      expect(await store.read(), const PresentationPreferences());
    });

    test('reopening the installation restores the saved choices', () async {
      const preferences = PresentationPreferences(
        language: AppLanguage.english,
        appearance: AppAppearance.light,
      );
      await store.write(preferences);

      // A later launch reads the same file through a fresh store instance.
      final reopened = PresentationPreferencesStore(() async => file);

      expect(await reopened.read(), preferences);
    });

    test('a damaged file falls back to system defaults', () async {
      await file.writeAsString('{not json');

      expect(await store.read(), const PresentationPreferences());
    });

    test('saving replaces the previous selection', () async {
      await store.write(
        const PresentationPreferences(language: AppLanguage.english),
      );
      await store.write(
        const PresentationPreferences(
          language: AppLanguage.simplifiedChinese,
          appearance: AppAppearance.dark,
        ),
      );

      expect(
        await store.read(),
        const PresentationPreferences(
          language: AppLanguage.simplifiedChinese,
          appearance: AppAppearance.dark,
        ),
      );
    });

    test(
      'ignores the legacy view file when the shared field is absent',
      () async {
        final legacy = File(
          p.join(directory.path, 'followed_repository_view.txt'),
        );
        await legacy.writeAsString('detailed');
        await file.writeAsString('{"language":"en","appearance":"dark"}');

        final preferences = await store.read();

        expect(preferences.language, AppLanguage.english);
        expect(preferences.appearance, AppAppearance.dark);
        expect(
          preferences.followedRepositoryView,
          FollowedRepositoryView.compact,
        );
      },
    );
  });

  group('PresentationPreferencesController', () {
    test('silent view failures preserve existing appearance feedback until a save succeeds', () async {
      final store = _ControlledStore(
        readResult: () async => const PresentationPreferences(),
        writeError: const FileSystemException('read-only device'),
      );
      final container = ProviderContainer(
        overrides: [
          presentationPreferencesStoreProvider.overrideWithValue(store),
        ],
      );
      addTearDown(container.dispose);
      await container.read(presentationPreferencesProvider.future);
      final controller = container.read(
        presentationPreferencesProvider.notifier,
      );

      await controller.selectAppearance(AppAppearance.dark);
      expect(
        container.read(presentationPreferencesStateProvider).rememberFailed,
        isTrue,
      );
      await controller.selectFollowedRepositoryView(
        FollowedRepositoryView.detailed,
      );
      expect(
        container.read(presentationPreferencesStateProvider).rememberFailed,
        isTrue,
      );

      store.writeError = null;
      await controller.selectFollowedRepositoryView(
        FollowedRepositoryView.detailed,
      );
      expect(store.written, isEmpty);
      expect(
        container.read(presentationPreferencesStateProvider).rememberFailed,
        isTrue,
      );

      await controller.selectFollowedRepositoryView(
        FollowedRepositoryView.compact,
      );
      expect(store.written.last.appearance, AppAppearance.dark);
      expect(
        container.read(presentationPreferencesStateProvider).rememberFailed,
        isFalse,
      );
    });

    test(
      'a slow earlier save cannot overwrite later choices after reopening',
      () async {
        final directory = await Directory.systemTemp.createTemp(
          'gitpulse-preferences-queue-',
        );
        addTearDown(() => directory.delete(recursive: true));
        final file = File(
          p.join(directory.path, 'presentation_preferences.json'),
        );
        final store = _DelayedWriteStore(file);
        addTearDown(() {
          if (!store.release.isCompleted) store.release.complete();
        });
        final container = ProviderContainer(
          overrides: [
            presentationPreferencesStoreProvider.overrideWithValue(store),
          ],
        );
        addTearDown(container.dispose);
        await container.read(presentationPreferencesProvider.future);
        final controller = container.read(
          presentationPreferencesProvider.notifier,
        );

        final view = controller.selectFollowedRepositoryView(
          FollowedRepositoryView.detailed,
        );
        await store.entered.future;
        final language = controller.selectLanguage(
          AppLanguage.simplifiedChinese,
        );
        final appearance = controller.selectAppearance(AppAppearance.dark);
        store.release.complete();
        await Future.wait([view, language, appearance]);

        final reopened = PresentationPreferencesStore(() async => file);
        expect(
          await reopened.read(),
          const PresentationPreferences(
            language: AppLanguage.simplifiedChinese,
            appearance: AppAppearance.dark,
            followedRepositoryView: FollowedRepositoryView.detailed,
          ),
        );
      },
    );

    test(
      'the followed view reflects the shared restored and current choices',
      () async {
        final store = _ControlledStore(
          readResult: () async => const PresentationPreferences(
            followedRepositoryView: FollowedRepositoryView.detailed,
          ),
        );
        final container = ProviderContainer(
          overrides: [
            presentationPreferencesStoreProvider.overrideWithValue(store),
          ],
        );
        addTearDown(container.dispose);
        await container.read(presentationPreferencesProvider.future);

        expect(
          container.read(followedRepositoryViewProvider),
          FollowedRepositoryView.detailed,
        );

        await container
            .read(presentationPreferencesProvider.notifier)
            .selectFollowedRepositoryView(FollowedRepositoryView.compact);

        expect(
          container.read(followedRepositoryViewProvider),
          FollowedRepositoryView.compact,
        );
      },
    );

    test(
      'a view save failure stays silent and a later change remembers it',
      () async {
        final store = _ControlledStore(
          readResult: () async => const PresentationPreferences(),
          writeError: const FileSystemException('read-only device'),
        );
        final container = ProviderContainer(
          overrides: [
            presentationPreferencesStoreProvider.overrideWithValue(store),
          ],
        );
        addTearDown(container.dispose);
        await container.read(presentationPreferencesProvider.future);
        final controller = container.read(
          presentationPreferencesProvider.notifier,
        );

        await controller.selectFollowedRepositoryView(
          FollowedRepositoryView.detailed,
        );

        final failed = container.read(presentationPreferencesStateProvider);
        expect(
          failed.preferences.followedRepositoryView,
          FollowedRepositoryView.detailed,
        );
        expect(failed.rememberFailed, isFalse);

        store.writeError = null;
        await controller.selectLanguage(AppLanguage.english);

        expect(
          store.written.last,
          const PresentationPreferences(
            language: AppLanguage.english,
            followedRepositoryView: FollowedRepositoryView.detailed,
          ),
        );
        expect(
          container.read(presentationPreferencesStateProvider).rememberFailed,
          isFalse,
        );
      },
    );

    for (final languageFirst in [true, false]) {
      test('startup choices preserve all three fields and reopen '
          '(${languageFirst ? 'language' : 'appearance'} first)', () async {
        final directory = await Directory.systemTemp.createTemp(
          'gitpulse-presentation-startup-',
        );
        addTearDown(() => directory.delete(recursive: true));
        final file = File(
          p.join(directory.path, 'presentation_preferences.json'),
        );
        final store = PresentationPreferencesStore(() async => file);
        await store.write(
          const PresentationPreferences(
            language: AppLanguage.english,
            appearance: AppAppearance.light,
          ),
        );
        final loaded = Completer<void>();
        final container = ProviderContainer(
          overrides: [
            presentationPreferencesStoreProvider.overrideWithValue(
              _DelayedReadStore(file, loaded.future),
            ),
          ],
        );
        addTearDown(container.dispose);
        container.read(presentationPreferencesProvider);
        final controller = container.read(
          presentationPreferencesProvider.notifier,
        );
        final selections = languageFirst
            ? [
                controller.selectLanguage(AppLanguage.simplifiedChinese),
                controller.selectFollowedRepositoryView(
                  FollowedRepositoryView.detailed,
                ),
                controller.selectAppearance(AppAppearance.dark),
              ]
            : [
                controller.selectAppearance(AppAppearance.dark),
                controller.selectFollowedRepositoryView(
                  FollowedRepositoryView.detailed,
                ),
                controller.selectLanguage(AppLanguage.simplifiedChinese),
              ];

        loaded.complete();
        await Future.wait(selections);

        const expected = PresentationPreferences(
          language: AppLanguage.simplifiedChinese,
          appearance: AppAppearance.dark,
          followedRepositoryView: FollowedRepositoryView.detailed,
        );
        final applied = container
            .read(presentationPreferencesProvider)
            .value!
            .preferences;
        expect(applied.language, expected.language);
        expect(applied.appearance, expected.appearance);
        expect(applied.followedRepositoryView, FollowedRepositoryView.detailed);
        final reopened = PresentationPreferencesStore(() async => file);
        expect(await reopened.read(), expected);
      });
    }

    test(
      'a choice made while the saved file is still loading is kept',
      () async {
        final loaded = Completer<PresentationPreferences>();
        final store = _ControlledStore(readResult: () => loaded.future);
        final container = ProviderContainer(
          overrides: [
            presentationPreferencesStoreProvider.overrideWithValue(store),
          ],
        );
        addTearDown(container.dispose);

        // Start the local read, then choose before it finishes.
        container.read(presentationPreferencesProvider);
        final selection = container
            .read(presentationPreferencesProvider.notifier)
            .selectLanguage(AppLanguage.simplifiedChinese);
        loaded.complete(
          const PresentationPreferences(language: AppLanguage.english),
        );
        await selection;

        final state = container.read(presentationPreferencesProvider).value!;
        expect(state.preferences.language, AppLanguage.simplifiedChinese);
        expect(store.written.last.language, AppLanguage.simplifiedChinese);
      },
    );

    test(
      'a choice is applied even when this device cannot remember it',
      () async {
        final store = _ControlledStore(
          readResult: () async => const PresentationPreferences(),
          writeError: const FileSystemException('read-only device'),
        );
        final container = ProviderContainer(
          overrides: [
            presentationPreferencesStoreProvider.overrideWithValue(store),
          ],
        );
        addTearDown(container.dispose);
        await container.read(presentationPreferencesProvider.future);

        await container
            .read(presentationPreferencesProvider.notifier)
            .selectAppearance(AppAppearance.dark);

        final failed = container.read(presentationPreferencesProvider).value!;
        expect(failed.preferences.appearance, AppAppearance.dark);
        expect(failed.rememberFailed, isTrue);

        // The failure is not sticky: a later save that works clears it.
        store.writeError = null;
        await container
            .read(presentationPreferencesProvider.notifier)
            .selectAppearance(AppAppearance.light);

        final recovered = container
            .read(presentationPreferencesProvider)
            .value!;
        expect(recovered.preferences.appearance, AppAppearance.light);
        expect(recovered.rememberFailed, isFalse);
      },
    );
  });
}

class _DelayedReadStore extends PresentationPreferencesStore {
  _DelayedReadStore(File file, this.loaded) : super(() async => file);

  final Future<void> loaded;

  @override
  Future<PresentationPreferences> read() async {
    await loaded;
    return super.read();
  }
}

class _DelayedWriteStore extends PresentationPreferencesStore {
  _DelayedWriteStore(File file) : super(() async => file);

  final entered = Completer<void>();
  final release = Completer<void>();

  @override
  Future<void> write(PresentationPreferences preferences) async {
    if (!entered.isCompleted) {
      entered.complete();
      await release.future;
    }
    await super.write(preferences);
  }
}

class _ControlledStore extends PresentationPreferencesStore {
  _ControlledStore({required this.readResult, this.writeError})
    : super(() async => File('unused'));

  final Future<PresentationPreferences> Function() readResult;
  Object? writeError;
  final written = <PresentationPreferences>[];

  @override
  Future<PresentationPreferences> read() => readResult();

  @override
  Future<void> write(PresentationPreferences preferences) async {
    if (writeError case final error?) throw error;
    written.add(preferences);
  }
}
