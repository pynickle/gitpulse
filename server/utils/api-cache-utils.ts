import { createHash } from 'node:crypto';

import type { H3Event } from 'h3';
import { defineEventHandler, getRequestHeader, setHeader } from 'h3';

const PRIVATE_API_CACHE_CONTROL = 'private, max-age=0, must-revalidate';
const PRIVATE_API_COALESCING_MAX_AGE_MS = 30_000;

type PrivateApiHandler<T> = (event: H3Event) => T | Promise<T>;
type PendingPrivateApiResponse = {
  promise: Promise<unknown>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
};

const pendingPrivateApiResponses = new Map<string, PendingPrivateApiResponse>();

interface PrivateApiCoalescingOptions {
  pendingMaxAgeMs?: number;
}

function createPrivateApiCacheKey(event: H3Event) {
  const url = event.node.req.originalUrl ?? event.node.req.url ?? event.path;
  const cookie = getRequestHeader(event, 'cookie') ?? '';
  const authorization = getRequestHeader(event, 'authorization') ?? '';

  return createHash('sha256')
    .update(JSON.stringify([event.method, url, cookie, authorization]))
    .digest('hex');
}

export function setPrivateApiCacheControl(event: H3Event) {
  setHeader(event, 'cache-control', PRIVATE_API_CACHE_CONTROL);
}

function clearPendingPrivateApiResponse(cacheKey: string, pending: PendingPrivateApiResponse) {
  if (pendingPrivateApiResponses.get(cacheKey) !== pending) {
    return;
  }

  if (pending.cleanupTimer) {
    clearTimeout(pending.cleanupTimer);
  }
  pendingPrivateApiResponses.delete(cacheKey);
}

export function definePrivateApiCoalescedEventHandler<T>(
  handler: PrivateApiHandler<T>,
  options: PrivateApiCoalescingOptions = {}
) {
  return defineEventHandler(async (event) => {
    setPrivateApiCacheControl(event);

    if (event.method !== 'GET') {
      return handler(event);
    }

    const cacheKey = createPrivateApiCacheKey(event);
    const pendingResponse = pendingPrivateApiResponses.get(cacheKey);

    if (pendingResponse) {
      return pendingResponse.promise as Promise<T>;
    }

    const pendingMaxAgeMs = Math.max(
      options.pendingMaxAgeMs ?? PRIVATE_API_COALESCING_MAX_AGE_MS,
      1
    );
    const pending: PendingPrivateApiResponse = {
      promise: Promise.resolve(),
      cleanupTimer: null,
    };

    pending.promise = (async () => handler(event))().finally(() => {
      clearPendingPrivateApiResponse(cacheKey, pending);
    });
    pending.cleanupTimer = setTimeout(() => {
      clearPendingPrivateApiResponse(cacheKey, pending);
    }, pendingMaxAgeMs);
    pending.cleanupTimer.unref?.();

    pendingPrivateApiResponses.set(cacheKey, pending);

    return pending.promise;
  });
}
