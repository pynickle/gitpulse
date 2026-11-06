import { describe, expect, test } from 'bun:test';

import { resolveNotificationTodoSwipeAction } from '../app/utils/resolveNotificationTodoSwipeAction';

describe('resolveNotificationTodoSwipeAction', () => {
  test('offers the add action with a plus and the shortest wording', () => {
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'add', armed: false, feedback: null })
    ).toEqual({
      tone: 'add',
      glyph: 'plus',
      labelKey: 'dashboard.todos.swipeAddLabel',
      settled: false,
    });
  });

  test('offers the remove action on a row that is already saved', () => {
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'remove', armed: false, feedback: null })
    ).toEqual({
      tone: 'remove',
      glyph: 'minus',
      labelKey: 'dashboard.todos.swipeRemoveLabel',
      settled: false,
    });
  });

  test('asks the reader to let go once the action is armed', () => {
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'add', armed: true, feedback: null })
    ).toEqual({
      tone: 'add',
      glyph: 'check',
      labelKey: 'dashboard.todos.swipeAddRelease',
      settled: false,
    });
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'remove', armed: true, feedback: null })
    ).toMatchObject({
      tone: 'remove',
      glyph: 'check',
      labelKey: 'dashboard.todos.swipeRemoveRelease',
    });
  });

  test('a completed add settles on the green plate and is announced', () => {
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'add', armed: true, feedback: 'added' })
    ).toEqual({
      tone: 'done',
      glyph: 'check',
      labelKey: 'dashboard.todos.swipeAdded',
      settled: true,
    });
  });

  test('a completed removal settles on its own red plate and is announced', () => {
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'remove', armed: true, feedback: 'removed' })
    ).toEqual({
      tone: 'removed',
      glyph: 'check',
      labelKey: 'dashboard.todos.swipeRemoved',
      settled: true,
    });
  });

  test('reports a refusal against the action that was attempted', () => {
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'add', armed: true, feedback: 'failed' })
    ).toEqual({
      tone: 'failed',
      glyph: 'warning',
      labelKey: 'dashboard.todos.swipeAddFailed',
      settled: true,
    });
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'remove', armed: true, feedback: 'failed' })
    ).toMatchObject({
      tone: 'failed',
      glyph: 'warning',
      labelKey: 'dashboard.todos.swipeRemoveFailed',
    });
  });

  test('a settled outcome outranks the armed state that produced it', () => {
    expect(
      resolveNotificationTodoSwipeAction({ offered: 'add', armed: false, feedback: 'added' })
    ).toMatchObject({ tone: 'done', labelKey: 'dashboard.todos.swipeAdded' });
  });
});
