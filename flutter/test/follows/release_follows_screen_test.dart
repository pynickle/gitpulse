import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/repositories/repository_screen.dart';

import '../session_flow_test.dart' as auth;
import '../timeline/timeline_test_support.dart';
import 'follows_test_support.dart';

void main() {
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
    await tester.tap(find.text('Load more'));
    await tester.pumpAndSettle();
    expect(find.text('octo/alpha'), findsOneWidget);
    expect(find.text('octo/beta'), findsOneWidget);
    expect(server.featureRequests.last.uri.queryParameters['page'], '2');
    await tester.tap(find.text('Starred date'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Last updated').last);
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
      await tester.tap(find.text('Load more'));
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
          await tester.drag(
            find.byType(CustomScrollView).first,
            const Offset(0, -1200),
          );
          await tester.pumpAndSettle();
          expect(find.text('Search').hitTestable(), findsOneWidget);
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
            await tester.ensureVisible(find.text('Follow releases').first);
            await tester.pumpAndSettle();
            await tester.tap(find.text('Follow releases').first);
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
      await tester.tap(find.text('Follow releases'));
      await tester.pumpAndSettle();
      expect(find.text('Followed'), findsOneWidget);
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
      await tester.tap(find.byKey(const ValueKey('manage-follows')));
      await tester.pumpAndSettle();
      expect(find.text('new/project'), findsOneWidget);
      expect(find.text('Renamed from old/project'), findsOneWidget);
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
      await tester.ensureVisible(find.text('Follow releases'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Follow releases'));
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
      expect(
        find.text('Unavailable on GitHub. Retry or unfollow this repository.'),
        findsOneWidget,
      );
      server.metadata['R_old'] = {'status': 'transient'};
      await tester.tap(find.byTooltip('Reload follows'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Temporarily unavailable. Retry when your connection recovers.',
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
