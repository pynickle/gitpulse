import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/follows/followed_repositories_panel.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/follows/repository_pagination.dart';
import 'package:gitpulse/presentation/gitpulse_pill.dart';
import 'package:gitpulse/presentation/gitpulse_state_views.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/repositories/repository_screen.dart';

import '../session_flow_test.dart' as auth;
import '../timeline/timeline_test_support.dart';
import 'follows_test_support.dart';

int _metadataRequestCount(FollowsServer server) => server.featureRequests
    .where((request) => request.uri.path.contains('release-follows/metadata'))
    .length;

/// A temporary device store for the language choice.
///
/// Created synchronously: a widget test body runs on a fake clock, so awaiting
/// real file I/O there never resumes.
File _preferencesFile() {
  final directory = Directory.systemTemp.createTempSync('gitpulse-follows-');
  addTearDown(() {
    try {
      directory.deleteSync(recursive: true);
    } on FileSystemException {
      // A leftover temporary directory must not fail a finished test.
    }
  });
  return File('${directory.path}/presentation_preferences.json');
}

/// Advances a fixed number of frames, so an indeterminate progress indicator
/// somewhere on the page can never stall the test.
Future<void> _pumpFrames(WidgetTester tester, {int frames = 8}) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// Waits for real device-file and HTTP work while the widget clock advances.
Future<void> _settleUi(WidgetTester tester) async {
  for (var i = 0; i < 30; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 5)),
    );
    await tester.pump(const Duration(milliseconds: 20));
  }
}

Future<void> _openFollows(
  WidgetTester tester,
  FollowsServer server, {
  File? presentationFile,
}) async {
  await auth.mountApp(tester, server, presentationFile: presentationFile);
  await auth.connectTo(tester, 'https://gitpulse.example');
  await auth.submitField(
    tester,
    label: 'Password',
    value: 'correct-horse',
    action: 'Unlock',
  );
  await tester.tap(find.text('Follows'));
  await tester.pumpAndSettle();
}

/// Switches this installation to Simplified Chinese through the Settings
/// language chips, exactly as the presentation settings tests do.
///
/// The page can carry an indeterminate progress indicator, so this waits in
/// bounded frames instead of [WidgetTester.pumpAndSettle].
Future<void> _chooseSimplifiedChinese(WidgetTester tester) async {
  await tester.tap(find.text('Settings').last);
  await _settleUi(tester);
  final chinese = find.text('Simplified Chinese');
  await tester.ensureVisible(chinese);
  await _pumpFrames(tester);
  await tester.tap(chinese);
  await _settleUi(tester);
  expect(find.text('简体中文'), findsWidgets);
}

void _expectInsideView(WidgetTester tester, Finder finder) {
  final rect = tester.getRect(finder);
  final size = tester.view.physicalSize / tester.view.devicePixelRatio;
  expect(rect.left, greaterThanOrEqualTo(0));
  expect(rect.top, greaterThanOrEqualTo(0));
  expect(rect.right, lessThanOrEqualTo(size.width));
  expect(rect.bottom, lessThanOrEqualTo(size.height));
}

void main() {
  testWidgets(
    'page input restores invalid values and commits once on submit or blur',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      final server = FollowsServer()
        ..starredRepositories = [repositoryJson()]
        ..starredHasMore = true
        ..starredTotalPages = 10;
      await _openFollows(tester, server);
      final field = find.byKey(const ValueKey('repository-page'));
      final initialRequests = server.featureRequests.length;
      for (final invalid in ['', '0', '-1', '1.5', 'abc', '11']) {
        await tester.enterText(field, invalid);
        await tester.testTextInput.receiveAction(TextInputAction.done);
        await tester.pumpAndSettle();
        expect(
          find.descendant(of: field, matching: find.text('1')),
          findsOneWidget,
        );
        expect(server.featureRequests.length, initialRequests);
      }
      await tester.enterText(field, '5');
      tester.binding.focusManager.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      expect(server.featureRequests.last.uri.queryParameters['page'], '5');
      expect(server.featureRequests.length, initialRequests + 1);
      expect(
        find.descendant(of: field, matching: find.text('5')),
        findsOneWidget,
      );
      await tester.enterText(field, '6');
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      await tester.pump();
      expect(field.hitTestable(), findsOneWidget);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      tester.view.resetViewInsets();
      await tester.pumpAndSettle();
      expect(server.featureRequests.length, initialRequests + 2);
      expect(server.featureRequests.last.uri.queryParameters['page'], '6');
      await tester.tap(find.byTooltip('Previous page'));
      await tester.pumpAndSettle();
      expect(
        find.descendant(of: field, matching: find.text('5')),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'a failed page turn replaces the list and retries the page it asked for',
    (tester) async {
      final server = FollowsServer()
        ..starredHasMore = true
        ..starredTotalPages = 10
        ..starredRepositories = [
          for (var i = 0; i < 30; i++)
            repositoryJson(id: 'R_$i', name: 'project-$i'),
        ];
      await _openFollows(tester, server);
      final field = find.byKey(const ValueKey('repository-page'));
      expect(field.hitTestable(), findsOneWidget);
      expect(
        find.descendant(of: field, matching: find.text('1')),
        findsOneWidget,
      );
      // Read partway down a page, so a jump has somewhere to come back from and
      // the fixed bars have something to stay level with.
      final results = find.byType(CustomScrollView).first;
      await tester.drag(results, const Offset(0, -900));
      await tester.pumpAndSettle();
      final scroll = tester.widget<CustomScrollView>(results).controller!;
      expect(scroll.offset, greaterThan(0));
      final source = tester.getTopLeft(find.text('Starred'));
      final manage = tester.getTopLeft(
        find.byKey(const ValueKey('manage-follows')),
      );

      server.starredStatus = 500;
      final hold = Completer<void>();
      server.holdStarred = hold.future;
      await tester.enterText(field, '10');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await _pumpFrames(tester);
      // The field names the page being read until the backend confirms a jump.
      expect(
        find.descendant(of: field, matching: find.text('1')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('starred-R_0')), findsNothing);
      // The page that has not arrived fills the list's place on its own: no
      // progress bar is drawn beside it.
      expect(find.byType(GitPulseLoadingView), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      hold.complete();
      server.holdStarred = null;
      await tester.pumpAndSettle();
      // The read failed, so the page it could not load is what the list says,
      // with the one action that asks for it again. The bars stay where they
      // were, and no page number is left naming a list that is not there.
      expect(find.byType(GitPulseLoadingView), findsNothing);
      expect(find.byKey(const ValueKey('starred-R_0')), findsNothing);
      expect(
        find.text(
          'Could not load repositories. Retry the search or reload follows.',
        ),
        findsOneWidget,
      );
      expect(find.text('Retry').hitTestable(), findsOneWidget);
      expect(find.byType(RepositoryPagination), findsNothing);
      expect(tester.getTopLeft(find.text('Starred')), source);
      expect(
        tester.getTopLeft(find.byKey(const ValueKey('manage-follows'))),
        manage,
      );

      server.starredStatus = 200;
      server.starredHasMore = false;
      server.starredRepositories = [repositoryJson(id: 'R_last', name: 'last')];
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(server.featureRequests.last.uri.queryParameters['page'], '10');
      expect(find.text('octo/last').hitTestable(), findsOneWidget);
      expect(find.textContaining('octo/project-'), findsNothing);
      expect(
        find.descendant(of: field, matching: find.text('10')),
        findsOneWidget,
      );
      expect(find.text('/ 10'), findsOneWidget);
      // A page that finally arrives is read from its top.
      expect(
        tester
            .widget<CustomScrollView>(find.byType(CustomScrollView).first)
            .controller!
            .offset,
        0,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('a pull re-reads the page on screen and keeps it while it does', (
    tester,
  ) async {
    final server = FollowsServer()
      ..starredRepositories = [repositoryJson()]
      ..starredHasMore = true
      ..starredTotalPages = 10;
    await _openFollows(tester, server);
    await tester.tap(find.byTooltip('Next page'));
    await tester.pumpAndSettle();
    expect(server.featureRequests.last.uri.queryParameters['page'], '2');
    final requests = server.featureRequests.length;

    final hold = Completer<void>();
    server.holdStarred = hold.future;
    // The response snapshots its payload once the request arrives, so the
    // page it will return is decided before the gesture starts.
    server.starredRepositories = [repositoryJson(id: 'R_new', name: 'new')];
    await tester.fling(
      find.byType(CustomScrollView),
      const Offset(0, 300),
      1000,
    );
    await _pumpFrames(tester);
    expect(server.featureRequests.length, requests + 1);
    expect(server.featureRequests.last.uri.queryParameters['page'], '2');
    // The page being read stays where it is: the gesture draws the progress.
    expect(find.text('octo/alpha'), findsOneWidget);
    expect(find.byType(GitPulseLoadingView), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);

    hold.complete();
    server.holdStarred = null;
    await tester.pumpAndSettle();
    expect(find.text('octo/new'), findsOneWidget);
    expect(find.text('octo/alpha'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a pull repeats the search on the page on screen', (
    tester,
  ) async {
    final server = FollowsServer()..searchHasMore = true;
    await _openFollows(tester, server);
    await tester.tap(find.text('Search'));
    await tester.pumpAndSettle();
    await tester.enterText(
      auth.fieldLabeled('Repository name or GitHub URL'),
      'alpha',
    );
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Next page'));
    await tester.pumpAndSettle();
    final requests = server.featureRequests.length;

    server.repositories = [repositoryJson(id: 'R_beta', name: 'beta')];
    await tester.fling(
      find.byType(CustomScrollView),
      const Offset(0, 300),
      1000,
    );
    await tester.pumpAndSettle();
    expect(server.featureRequests.length, requests + 1);
    expect(server.featureRequests.last.uri.queryParameters, {
      'q': 'alpha',
      'page': '2',
      'per_page': '30',
    });
    expect(find.text('octo/beta'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'sources preserve independent pages and unknown totals never invent a last page',
    (tester) async {
      final server = FollowsServer()
        ..starredRepositories = [repositoryJson(id: 'R_star', name: 'star')]
        ..starredHasMore = true;
      await _openFollows(tester, server);
      expect(find.byKey(const ValueKey('repository-page')), findsOneWidget);
      expect(find.text('/ 1'), findsNothing);
      expect(find.text('…'), findsNothing);
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Search'));
      await tester.pumpAndSettle();
      expect(find.text('Starred date'), findsNothing);
      expect(find.byTooltip('Descending'), findsNothing);
      expect(find.byTooltip('Next page'), findsNothing);
      await tester.enterText(
        auth.fieldLabeled('Repository name or GitHub URL'),
        'alpha',
      );
      server.searchHasMore = true;
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      server.searchStatus = 500;
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      // The page that failed replaces the results it could not load.
      expect(find.text('octo/alpha'), findsNothing);
      expect(find.text('Retry').hitTestable(), findsOneWidget);
      server.searchStatus = 200;
      server.repositories = [repositoryJson(id: 'R_beta', name: 'beta')];
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(server.featureRequests.last.uri.queryParameters, {
        'q': 'alpha',
        'page': '2',
        'per_page': '30',
      });
      expect(find.text('octo/alpha'), findsNothing);
      expect(find.text('octo/beta'), findsOneWidget);
      final requests = server.featureRequests.length;
      await tester.tap(find.text('Starred'));
      await tester.pumpAndSettle();
      expect(find.text('octo/star'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('repository-page')),
          matching: find.text('2'),
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Search'));
      await tester.pumpAndSettle();
      expect(find.text('octo/beta'), findsOneWidget);
      expect(server.featureRequests.length, requests);
      await tester.enterText(
        auth.fieldLabeled('Repository name or GitHub URL'),
        'changed',
      );
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(server.featureRequests.last.uri.queryParameters['page'], '1');
    },
  );

  testWidgets('single pages and repository URL lookups omit pagination', (
    tester,
  ) async {
    final server = FollowsServer()..starredRepositories = [repositoryJson()];
    await _openFollows(tester, server);
    expect(find.byTooltip('Previous page'), findsNothing);
    expect(find.byTooltip('Next page'), findsNothing);
    expect(find.byKey(const ValueKey('repository-page')), findsNothing);
    await tester.tap(find.text('Search'));
    await tester.pumpAndSettle();
    await tester.enterText(
      auth.fieldLabeled('Repository name or GitHub URL'),
      'https://github.com/octo/alpha',
    );
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(find.text('octo/alpha'), findsOneWidget);
    expect(server.featureRequests.last.uri.path, '/api/repos/octo/alpha');
    expect(find.byKey(const ValueKey('repository-page')), findsNothing);
    expect(find.byTooltip('Next page'), findsNothing);
  });

  testWidgets('discovery sorting, pagination and repository navigation work', (
    tester,
  ) async {
    final server = FollowsServer()
      ..starredRepositories = [repositoryJson()]
      ..starredHasMore = true;
    await auth.mountApp(tester, server);
    await auth.connectTo(tester, 'https://gitpulse.example');
    await auth.submitField(
      tester,
      label: 'Password',
      value: 'correct-horse',
      action: 'Unlock',
    );
    await tester.tap(find.text('Follows'));
    await tester.pumpAndSettle();
    server.starredRepositories = [repositoryJson(id: 'R_beta', name: 'beta')];
    server.starredHasMore = false;
    await tester.tap(find.byTooltip('Next page'));
    await tester.pumpAndSettle();
    expect(find.text('octo/alpha'), findsNothing);
    expect(find.text('octo/beta'), findsOneWidget);
    expect(server.featureRequests.last.uri.queryParameters['page'], '2');
    await tester.tap(find.text('Last updated'));
    await tester.pumpAndSettle();
    expect(server.featureRequests.last.uri.queryParameters['sort'], 'updated');
    expect(server.featureRequests.last.uri.queryParameters['page'], '1');
    await tester.tap(find.byTooltip('Descending'));
    await tester.pumpAndSettle();
    expect(server.featureRequests.last.uri.queryParameters['direction'], 'asc');
    await tester.tap(find.text('octo/beta'));
    await tester.pumpAndSettle();
    expect(find.byType(RepositoryScreen), findsOneWidget);
    expect(
      server.featureRequests.any(
        (request) => request.uri.path == '/api/repos/octo/beta',
      ),
      isTrue,
    );
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('octo/beta').hitTestable(), findsOneWidget);
    expect(find.text('Last updated'), findsOneWidget);
    expect(find.byTooltip('Ascending'), findsOneWidget);
  });

  testWidgets(
    'search button, retry, pagination and clearing give visible feedback',
    (tester) async {
      final server = FollowsServer()..searchStatus = 500;
      await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Search'));
      await tester.pumpAndSettle();
      await tester.enterText(
        auth.fieldLabeled('Repository name or GitHub URL'),
        'alpha',
      );
      await tester.pump();
      await tester.tap(find.byTooltip('Search'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Could not load repositories. Retry the search or reload follows.',
        ),
        findsOneWidget,
      );
      server.searchStatus = 200;
      server.searchHasMore = true;
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('search-R_alpha')).hitTestable(),
        findsOneWidget,
      );
      server.repositories = [repositoryJson(id: 'R_beta', name: 'beta')];
      server.searchHasMore = false;
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      expect(find.text('octo/beta'), findsOneWidget);
      expect(server.featureRequests.last.uri.queryParameters['page'], '2');
      final requests = server.featureRequests.length;
      await tester.tap(find.byTooltip('Clear search'));
      await tester.pumpAndSettle();
      expect(find.text('octo/alpha'), findsNothing);
      expect(find.text('octo/beta'), findsNothing);
      expect(find.text('Search repositories'), findsOneWidget);
      expect(server.featureRequests.length, requests);
    },
  );

  testWidgets(
    'phone and desktop layouts keep discovery controls and follows accessible',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final server = FollowsServer()
        ..starredHasMore = true
        ..starredTotalPages = 10
        ..starredRepositories = [
          for (var i = 0; i < 30; i++)
            repositoryJson(id: 'R_$i', name: 'project-$i'),
        ];
      server.settings['followedRepositories'] = [
        followJson('R_followed', 'octo', 'followed'),
      ];
      await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Follow releases independently of GitHub Watch and Star. Changes are shared with this account in the web app.',
        ),
        findsNothing,
      );
      for (final size in [
        const Size(320, 640),
        const Size(700, 900),
        const Size(1500, 900),
      ]) {
        tester.view.physicalSize = size;
        tester.platformDispatcher.textScaleFactorTestValue = 1.8;
        await tester.pumpAndSettle();
        if (size.width < 1100) {
          final manage = find.byKey(const ValueKey('manage-follows'));
          expect(manage.hitTestable(), findsOneWidget);
          final source = tester.getRect(
            find.ancestor(
              of: find.text('Starred'),
              matching: find.byType(TabBar),
            ),
          );
          final sort = tester.getRect(
            find.ancestor(
              of: find.text('Starred date'),
              matching: find.byWidgetPredicate(
                (widget) => widget is SegmentedButton<dynamic>,
              ),
            ),
          );
          expect(source.left, GitPulseSpace.gutter);
          expect(source.right, size.width - GitPulseSpace.gutter);
          expect(sort.left, source.left);
          final direction = tester.getRect(
            find.ancestor(
              of: find.byTooltip('Descending'),
              matching: find.byType(IconButton),
            ),
          );
          expect(direction.right, source.right);
          final pages = tester.getRect(find.byType(RepositoryPagination));
          final followed = tester.getRect(manage);
          final pageField = tester.getRect(
            find.byKey(const ValueKey('repository-page')),
          );
          // The number, both steps and the total are one pill, and the pill is
          // one cell high until the reader's type outgrows that cell.
          final pill = tester.getRect(find.byType(GitPulsePill));
          expect(pill.height, greaterThanOrEqualTo(GitPulseHeight.compact));
          expect(pill.contains(pageField.center), isTrue);
          expect(
            tester.getRect(find.byTooltip('Previous page')).center.dy,
            closeTo(pageField.center.dy, 1),
          );
          expect(
            tester.getRect(find.byTooltip('Next page')).center.dy,
            closeTo(pageField.center.dy, 1),
          );
          expect(followed.left, greaterThanOrEqualTo(pages.right));
          expect(followed.center.dy, closeTo(pages.center.dy, 1));
          expect(followed.width, lessThan(size.width / 2));
          expect(
            tester.getBottomLeft(find.text('Starred')).dy,
            lessThan(tester.getTopLeft(find.text('Starred date')).dy),
          );
          expect(find.byTooltip('Next page').hitTestable(), findsOneWidget);
          await tester.drag(
            find.byType(CustomScrollView).first,
            const Offset(0, -1200),
          );
          await tester.pumpAndSettle();
          expect(find.text('Search').hitTestable(), findsOneWidget);
          expect(find.byTooltip('Next page').hitTestable(), findsOneWidget);
          expect(manage.hitTestable(), findsOneWidget);
          await tester.tap(manage);
          await tester.pumpAndSettle();
          expect(
            find.byKey(const ValueKey('followed-R_followed')).hitTestable(),
            findsOneWidget,
          );
          await tester.tap(find.byTooltip('Close followed repositories'));
          await tester.pumpAndSettle();
          if (size.width == 320) {
            server.saveStatus = 500;
            await tester.ensureVisible(find.byTooltip('Follow releases').first);
            await tester.pumpAndSettle();
            await tester.tap(find.byTooltip('Follow releases').first);
            await tester.pumpAndSettle();
            await tester.tap(find.text('Search'));
            await tester.pumpAndSettle();
            tester.view.viewInsets = const FakeViewPadding(bottom: 360);
            await tester.enterText(
              auth.fieldLabeled('Repository name or GitHub URL'),
              'alpha',
            );
            await tester.pumpAndSettle();
            expect(find.byKey(const ValueKey('manage-follows')), findsNothing);
            expect(
              tester.takeException(),
              isNull,
              reason: 'small phone with keyboard',
            );
            expect(find.byTooltip('Search').hitTestable(), findsOneWidget);
            tester.view.resetViewInsets();
            await tester.pumpAndSettle();
            await tester.tap(find.text('Starred'));
            await tester.pumpAndSettle();
          }
        } else {
          expect(
            find.byKey(const ValueKey('followed-R_followed')).hitTestable(),
            findsOneWidget,
          );
        }
        expect(tester.takeException(), isNull, reason: '$size');
      }
    },
  );

  testWidgets(
    'starred repositories can be followed and refresh when the page reopens',
    (tester) async {
      final server = FollowsServer()
        ..starredRepositories = [repositoryJson(id: 'R_star', name: 'star')];
      await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      expect(find.text('octo/star').hitTestable(), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      expect(find.text('Follow releases'), findsNothing);
      await tester.tap(find.byTooltip('Follow releases'));
      await tester.pumpAndSettle();
      expect(find.byTooltip('Unfollow'), findsOneWidget);
      expect(find.text('Followed'), findsNothing);
      expect(
        (server.settings['followedRepositories'] as List).single,
        followJson('R_star', 'octo', 'star'),
      );
      server.starredRepositories = [repositoryJson(id: 'R_new', name: 'new')];
      await tester.tap(find.text('Settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      expect(find.text('octo/new').hitTestable(), findsOneWidget);
      expect(find.text('octo/star'), findsNothing);
    },
  );

  testWidgets('search results stay visible with many followed repositories', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final server = FollowsServer();
    server.settings['followedRepositories'] = [
      for (var i = 0; i < 25; i++) followJson('R_$i', 'octo', 'project-$i'),
    ];
    await auth.mountApp(tester, server);
    await auth.connectTo(tester, 'https://gitpulse.example');
    await auth.submitField(
      tester,
      label: 'Password',
      value: 'correct-horse',
      action: 'Unlock',
    );
    await tester.tap(find.text('Follows'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Search'));
    await tester.pumpAndSettle();
    await tester.enterText(
      auth.fieldLabeled('Repository name or GitHub URL'),
      'alpha',
    );
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('search-R_alpha')).hitTestable(),
      findsOneWidget,
    );
  });

  testWidgets(
    'a phone user can search, save, recover a failed removal and manage unavailable or renamed follows',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_old', 'old', 'project'),
      ];
      server.metadata['R_old'] = {
        'status': 'available',
        'owner': 'new',
        'name': 'project',
      };
      await auth.mountApp(tester, server, presentationFile: _preferencesFile());
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('manage-follows')));
      await tester.pumpAndSettle();
      expect(find.text('old/project'), findsOneWidget);
      expect(find.text('new/project'), findsNothing);
      expect(find.textContaining('Renamed from'), findsNothing);
      await tester.tap(find.byTooltip('Compact'));
      await _settleUi(tester);
      expect(find.text('new/project'), findsOneWidget);
      expect(find.text('old/project'), findsNothing);
      expect(find.textContaining('Renamed from'), findsNothing);
      await tester.tap(find.byTooltip('Close followed repositories'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Search'));
      await tester.pumpAndSettle();
      await tester.enterText(
        auth.fieldLabeled('Repository name or GitHub URL'),
        'alpha',
      );
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byTooltip('Follow releases'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Follow releases'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('manage-follows')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsOneWidget);
      server.saveStatus = 500;
      final remove = find.descendant(
        of: find.byKey(const ValueKey('followed-R_alpha')),
        matching: find.byTooltip('Unfollow'),
      );
      await tester.ensureVisible(remove);
      await tester.pumpAndSettle();
      await tester.tap(remove);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsOneWidget);
      expect(
        find.text(
          'Could not save Release Follows. Retry the action; your last confirmed list is still shown.',
        ),
        findsOneWidget,
      );
      server.saveStatus = 200;
      await tester.ensureVisible(remove);
      await tester.pumpAndSettle();
      await tester.tap(remove);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsNothing);
      server.metadata['R_old'] = {'status': 'unavailable'};
      await tester.ensureVisible(find.byTooltip('Reload follows'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Reload follows'));
      await tester.pumpAndSettle();
      expect(find.text('Unavailable'), findsOneWidget);
      expect(
        find.text('Unavailable on GitHub. Retry or unfollow this repository.'),
        findsNothing,
      );
      await tester.tap(find.text('new/project'));
      await tester.pumpAndSettle();
      expect(find.byType(RepositoryScreen), findsNothing);
      server.metadata['R_old'] = {'status': 'transient'};
      await tester.tap(find.byTooltip('Reload follows'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Temporarily unavailable. Retry when your connection recovers.',
        ),
        findsNothing,
      );
      final retry = find.byTooltip('Retry details for new/project');
      expect(retry, findsOneWidget);
      final metadataBefore = _metadataRequestCount(server);
      await tester.tap(retry);
      await tester.pumpAndSettle();
      expect(_metadataRequestCount(server), metadataBefore + 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'a failed follows reload replaces the list with the full-screen offline page',
    (tester) async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('manage-follows')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsOneWidget);

      server.offline = true;
      await tester.tap(find.byTooltip('Reload follows'));
      await tester.pumpAndSettle();

      final panel = find.byType(FollowedRepositoriesPanel);
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsNothing);
      expect(
        find.descendant(of: panel, matching: find.byType(GitPulseMessageView)),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: panel,
          matching: find.textContaining('Could not reach the backend'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(of: panel, matching: find.byType(TextButton)),
        findsNothing,
      );
      expect(
        container.read(releaseFollowsSessionProvider).repositories.single.id,
        'R_alpha',
      );

      server.offline = false;
      await tester.tap(
        find.descendant(
          of: panel,
          matching: find.widgetWithText(FilledButton, 'Retry'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsOneWidget);
      expect(
        find.descendant(of: panel, matching: find.byType(GitPulseMessageView)),
        findsNothing,
      );
    },
  );

  testWidgets('sort segments stay inside a narrow window', (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final server = FollowsServer()
      ..starredRepositories = [repositoryJson()]
      ..starredHasMore = true
      ..starredTotalPages = 10;
    final preferences = _preferencesFile();
    await _openFollows(tester, server, presentationFile: preferences);
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    await tester.pumpAndSettle();
    expect(find.text('Starred date'), findsOneWidget);
    expect(find.text('Sort by'), findsNothing);
    expect(tester.takeException(), isNull);
    _expectInsideView(tester, find.text('Last updated'));
    await tester.tap(find.text('Last updated').last);
    await tester.pumpAndSettle();
    expect(server.featureRequests.last.uri.queryParameters['sort'], 'updated');
    expect(server.featureRequests.last.uri.queryParameters['page'], '1');
    await tester.tap(find.byTooltip('Descending'));
    await tester.pumpAndSettle();
    expect(server.featureRequests.last.uri.queryParameters['direction'], 'asc');

    tester.view.physicalSize = const Size(800, 800);
    tester.platformDispatcher.textScaleFactorTestValue = 1;
    await tester.pumpAndSettle();
    await _chooseSimplifiedChinese(tester);
    tester.view.physicalSize = const Size(320, 640);
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    await tester.tap(find.text('关注'));
    await tester.pumpAndSettle();
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await tester.pumpAndSettle();
    expect(
      Theme.of(tester.element(find.text('加星时间'))).brightness,
      Brightness.dark,
    );
    expect(find.byTooltip('下一页').hitTestable(), findsOneWidget);
    _expectInsideView(tester, find.byTooltip('下一页'));
    expect(find.text('排序'), findsNothing);
    expect(tester.takeException(), isNull);
    _expectInsideView(tester, find.text('加星时间'));
    expect(find.byIcon(Icons.arrow_upward), findsOneWidget);
  });

  testWidgets(
    'a discovery card names the repository and follows without opening it',
    (tester) async {
      const description =
          'Keeps release notes close for people who follow a repository from a phone and still want the second line.';
      final server = FollowsServer()
        ..starredRepositories = [
          repositoryJson(
            id: 'R_py',
            name: 'py',
            description: description,
            language: 'python',
            stars: 5600,
          ),
          repositoryJson(
            id: 'R_blank',
            name: 'blank',
            description: '   ',
            language: null,
            stars: 12,
          ),
          repositoryJson(
            id: 'R_unknown',
            name: 'unknown',
            description: null,
            language: 'NotALanguage',
            stars: 3,
          ),
        ];
      await _openFollows(tester, server);
      expect(find.text('octo/py'), findsOneWidget);
      expect(find.text('Follow releases'), findsNothing);
      expect(find.text('Followed'), findsNothing);
      expect(find.byIcon(Icons.book_outlined), findsNothing);
      expect(find.text('5.6K'), findsOneWidget);
      expect(find.text('python'), findsOneWidget);
      final descriptionText = tester.widget<Text>(find.text(description));
      expect(descriptionText.maxLines, 2);
      final pythonSwatch = tester.widget<DecoratedBox>(
        find.descendant(
          of: find.byKey(const ValueKey('starred-R_py')),
          matching: find.byType(DecoratedBox),
        ),
      );
      expect(
        (pythonSwatch.decoration as BoxDecoration).color,
        const Color(0xFF3572A5),
      );
      expect(find.text('   '), findsNothing);
      expect(find.text('12'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('starred-R_blank')),
          matching: find.byType(DecoratedBox),
        ),
        findsNothing,
      );
      final fallbackSwatch = tester.widget<DecoratedBox>(
        find.descendant(
          of: find.byKey(const ValueKey('starred-R_unknown')),
          matching: find.byType(DecoratedBox),
        ),
      );
      expect(
        (fallbackSwatch.decoration as BoxDecoration).color,
        const Color(0xFFCCCCCC),
      );

      await tester.tap(find.text('octo/py'));
      await tester.pumpAndSettle();
      expect(find.byType(RepositoryScreen), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      await tester.tap(
        find.descendant(
          of: find.byKey(const ValueKey('starred-R_py')),
          matching: find.byTooltip('Follow releases'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(RepositoryScreen), findsNothing);
      expect(
        (server.settings['followedRepositories'] as List).single,
        followJson('R_py', 'octo', 'py'),
      );
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('starred-R_py')),
          matching: find.byTooltip('Unfollow'),
        ),
        findsOneWidget,
      );

      await tester.tap(find.text('Search'));
      await tester.pumpAndSettle();
      await tester.enterText(
        auth.fieldLabeled('Repository name or GitHub URL'),
        'alpha',
      );
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(find.text('octo/alpha'), findsOneWidget);
      expect(find.text('A project for release followers'), findsOneWidget);
      expect(find.text('Follow releases'), findsNothing);
      expect(find.byIcon(Icons.book_outlined), findsNothing);
    },
  );

  testWidgets(
    'a glyph inside the search field is smaller than a standalone one',
    (tester) async {
      final server = FollowsServer()..starredRepositories = [repositoryJson()];
      await _openFollows(tester, server);
      // The sort direction stands on its own in the toolbar, so it takes the
      // action size; every glyph the search field carries is a mark inside a
      // control and takes the smaller one. Read from the rendered box, not from
      // the argument that asked for it.
      expect(
        tester.getSize(find.byIcon(Icons.arrow_downward)),
        const Size.square(GitPulseIconSize.action),
      );

      await tester.tap(find.text('Search'));
      await tester.pumpAndSettle();
      await tester.enterText(
        auth.fieldLabeled('Repository name or GitHub URL'),
        'alpha',
      );
      await tester.pumpAndSettle();
      final field = find.byType(TextField);
      for (final glyph in [Icons.close, Icons.search]) {
        expect(
          tester.getSize(
            find.descendant(of: field, matching: find.byIcon(glyph)),
          ),
          const Size.square(GitPulseIconSize.inControl),
          reason: '$glyph',
        );
      }
    },
  );

  testWidgets('every row starts its star count at the same column', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final server = FollowsServer()
      ..starredRepositories = [
        repositoryJson(
          id: 'R_rust',
          name: 'short',
          language: 'Rust',
          stars: 42,
        ),
        repositoryJson(
          id: 'R_ts',
          name: 'long',
          language: 'TypeScript',
          stars: 12345,
        ),
        repositoryJson(id: 'R_none', name: 'none', language: null, stars: 7),
      ];
    await _openFollows(tester, server);
    final stars = find.byIcon(Icons.star_border);
    expect(stars, findsNWidgets(3));
    final lefts = [
      for (var index = 0; index < 3; index++)
        tester.getRect(stars.at(index)).left,
    ];
    expect(lefts.toSet(), hasLength(1), reason: 'star column: $lefts');
    expect(find.text('42'), findsOneWidget);
    expect(find.text('12.3K'), findsOneWidget);
  });

  testWidgets('star counts follow the active locale', (tester) async {
    tester.view.physicalSize = const Size(800, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final server = FollowsServer()
      ..starredRepositories = [
        repositoryJson(id: 'R_k', name: 'kilo', stars: 5600),
        repositoryJson(id: 'R_w', name: 'wan', stars: 12345),
      ];
    final preferences = _preferencesFile();
    await _openFollows(tester, server, presentationFile: preferences);
    expect(find.text('5.6K'), findsOneWidget);
    expect(find.text('12.3K'), findsOneWidget);

    await _chooseSimplifiedChinese(tester);
    await tester.tap(find.text('关注'));
    await _settleUi(tester);
    expect(find.text('5600'), findsOneWidget);
    expect(find.text('1.2万'), findsOneWidget);
    expect(find.text('5.6K'), findsNothing);
    expect(find.text('12.3K'), findsNothing);
  });

  testWidgets(
    'Followed Repositories remember Detailed View on this device only',
    (tester) async {
      tester.view.physicalSize = const Size(1500, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_kept', 'octo', 'kept'),
      ];
      server.metadata['R_kept'] = {
        'status': 'available',
        'owner': 'octo',
        'name': 'kept',
        'description': 'Notes for followers',
        'primaryLanguage': 'Python',
        'starCount': 5600,
      };
      final preferences = _preferencesFile();
      await _openFollows(tester, server, presentationFile: preferences);
      await _settleUi(tester);
      expect(find.byTooltip('Compact'), findsOneWidget);
      expect(find.text('Compact'), findsNothing);
      expect(find.text('Detailed'), findsNothing);
      expect(find.text('Notes for followers'), findsNothing);
      expect(_metadataRequestCount(server), 0);

      await tester.tap(find.byTooltip('Compact'));
      await _settleUi(tester);
      expect(find.byTooltip('Detailed'), findsOneWidget);
      expect(find.text('Detailed'), findsNothing);
      expect(find.text('Notes for followers'), findsOneWidget);
      expect(find.text('Python'), findsOneWidget);
      expect(find.text('5.6K'), findsOneWidget);
      expect(_metadataRequestCount(server), greaterThan(0));
      final swatch = tester.widget<DecoratedBox>(
        find.descendant(
          of: find.byKey(const ValueKey('followed-R_kept')),
          matching: find.byType(DecoratedBox),
        ),
      );
      expect(
        (swatch.decoration as BoxDecoration).color,
        const Color(0xFF3572A5),
      );
      expect(server.settings['releaseFollows'], isNull);
      expect(
        server.featureRequests.any(
          (request) => request.method == 'PUT' && request.body.contains('view'),
        ),
        isFalse,
      );

      await tester.tap(find.text('Settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      expect(find.byTooltip('Detailed'), findsOneWidget);
      expect(find.text('Notes for followers'), findsOneWidget);
      expect(server.settings['releaseFollows'], isNull);

      await _settleUi(tester);
      await tester.pumpWidget(const SizedBox.shrink());
      await _openFollows(tester, server, presentationFile: preferences);
      await _settleUi(tester);
      expect(find.byTooltip('Detailed'), findsOneWidget);
      expect(find.text('Notes for followers'), findsOneWidget);
    },
  );

  testWidgets('a failed follow is told inside Followed Repositories', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    const saveFailed =
        'Could not save Release Follows. Retry the action; your last confirmed list is still shown.';
    final server = FollowsServer()
      ..starredRepositories = [repositoryJson(id: 'R_new', name: 'new')]
      ..saveStatus = 500;
    await _openFollows(tester, server);
    await tester.tap(find.byTooltip('Follow releases'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Follow releases'), findsOneWidget);
    expect(find.text(saveFailed), findsNothing);
    expect((server.settings['followedRepositories'] as List), isEmpty);
    final manage = find.byKey(const ValueKey('manage-follows'));
    final icon = tester.widget<Icon>(
      find.descendant(
        of: manage,
        matching: find.byIcon(Icons.bookmarks_outlined),
      ),
    );
    expect(icon.color, Theme.of(tester.element(manage)).colorScheme.error);
    expect(find.byTooltip('0 followed'), findsOneWidget);
    expect(
      find.descendant(of: manage, matching: find.text('0')),
      findsOneWidget,
    );

    await tester.tap(manage);
    await tester.pumpAndSettle();
    expect(find.text(saveFailed), findsOneWidget);
    await tester.tap(find.byTooltip('Close followed repositories'));
    await tester.pumpAndSettle();
    expect(find.text(saveFailed), findsNothing);

    tester.view.physicalSize = const Size(1500, 900);
    await tester.pumpAndSettle();
    expect(find.text(saveFailed), findsOneWidget);
    expect(manage, findsNothing);
  });
}
