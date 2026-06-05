export default defineEventHandler((event) => {
  if (event.method !== 'GET' || !event.path.startsWith('/api/')) {
    return;
  }

  setPrivateApiCacheControl(event);
});
