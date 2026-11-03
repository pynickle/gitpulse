import { discoveryDocumentsForEvent } from '../utils/discovery-response';

export default defineEventHandler((event) => {
  const documents = discoveryDocumentsForEvent(event);
  if (!documents) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  return documents.sitemapXml;
});
