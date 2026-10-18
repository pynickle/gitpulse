import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../session_flow_test.dart' as auth;
import '../timeline/timeline_test_support.dart';
import 'follows_test_support.dart';

void main() {
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
      expect(find.text('new/project'), findsOneWidget);
      expect(find.text('Renamed from old/project'), findsOneWidget);
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
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsOneWidget);
      server.saveStatus = 500;
      final remove = find.descendant(
        of: find.byKey(const ValueKey('followed-R_alpha')),
        matching: find.text('Unfollow'),
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
