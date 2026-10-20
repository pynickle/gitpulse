import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
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
  });

  group('PresentationPreferencesController', () {
    for (final languageFirst in [true, false]) {
      test('startup choices preserve both fields and reopen '
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
                controller.selectAppearance(AppAppearance.dark),
              ]
            : [
                controller.selectAppearance(AppAppearance.dark),
                controller.selectLanguage(AppLanguage.simplifiedChinese),
              ];

        loaded.complete();
        await Future.wait(selections);

        const expected = PresentationPreferences(
          language: AppLanguage.simplifiedChinese,
          appearance: AppAppearance.dark,
        );
        final applied = container
            .read(presentationPreferencesProvider)
            .value!
            .preferences;
        expect(applied.language, expected.language);
        expect(applied.appearance, expected.appearance);
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
