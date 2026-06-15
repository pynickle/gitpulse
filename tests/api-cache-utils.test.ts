import { describe, expect, test } from 'bun:test';

import type { H3Event } from 'h3';

import { definePrivateApiCoalescedEventHandler } from '../server/utils/api-cache-utils';

interface MockEventOptions {
  method?: string;
  url?: string;
}

function createMockEvent(options: MockEventOptions = {}): H3Event {
  const url = options.url ?? '/api/example';
  const method = options.method ?? 'GET';

  return {
    method,
    path: url,
    node: {
      req: {
        originalUrl: url,
        url,
        headers: {},
      },
      res: {
        setHeader: () => undefined,
      },
    },
  } as unknown as H3Event;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('definePrivateApiCoalescedEventHandler', () => {
  test('coalesces concurrent identical private GET requests', async () => {
    let resolveRequest!: (value: string) => void;
    const pendingRequest = new Promise<string>((resolve) => {
      resolveRequest = resolve;
    });
    let calls = 0;
    const handler = definePrivateApiCoalescedEventHandler(
      () => {
        calls += 1;
        return pendingRequest;
      },
      { pendingMaxAgeMs: 1000 }
    );

    const first = handler(createMockEvent());
    const second = handler(createMockEvent());

    expect(calls).toBe(1);

    resolveRequest('ok');
    expect(await first).toBe('ok');
    expect(await second).toBe('ok');
  });

  test('clears settled GET responses before later identical requests', async () => {
    let calls = 0;
    const handler = definePrivateApiCoalescedEventHandler(() => {
      calls += 1;
      return calls;
    });

    expect(await handler(createMockEvent())).toBe(1);
    expect(await handler(createMockEvent())).toBe(2);
  });

  test('expires hung pending GET responses from the coalescing map', async () => {
    let calls = 0;
    const handler = definePrivateApiCoalescedEventHandler(
      () => {
        calls += 1;
        return new Promise(() => undefined);
      },
      { pendingMaxAgeMs: 5 }
    );

    void handler(createMockEvent());
    await delay(20);
    void handler(createMockEvent());
    await delay(20);

    expect(calls).toBe(2);
  });
});
