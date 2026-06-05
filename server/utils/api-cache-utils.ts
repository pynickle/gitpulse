import { createHash } from 'node:crypto';

import type { H3Event } from 'h3';
import { defineEventHandler, getRequestHeader, setHeader } from 'h3';

const PRIVATE_API_CACHE_CONTROL = 'private, max-age=0, must-revalidate';

type PrivateApiHandler<T> = (event: H3Event) => T | Promise<T>;

const pendingPrivateApiResponses = new Map<string, Promise<unknown>>();

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

export function definePrivateApiCoalescedEventHandler<T>(handler: PrivateApiHandler<T>) {
  return defineEventHandler(async (event) => {
    setPrivateApiCacheControl(event);

    if (event.method !== 'GET') {
      return handler(event);
    }

    const cacheKey = createPrivateApiCacheKey(event);
    const pendingResponse = pendingPrivateApiResponses.get(cacheKey);

    if (pendingResponse) {
      return pendingResponse as Promise<T>;
    }

    const responsePromise = (async () => handler(event))().finally(() => {
      pendingPrivateApiResponses.delete(cacheKey);
    });

    pendingPrivateApiResponses.set(cacheKey, responsePromise);

    return responsePromise;
  });
}
