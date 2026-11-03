import { withDiscoverySitemap } from '#shared/utils/discovery-documents';

import { discoveryDocumentsForEvent } from '../utils/discovery-response';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('robots:robots-txt', (ctx) => {
    const documents = discoveryDocumentsForEvent(ctx.e);
    ctx.robotsTxt = withDiscoverySitemap(
      ctx.robotsTxt,
      documents ? `${documents.origin}/sitemap.xml` : null
    );
  });
});
