import { defineNuxtModule } from '@nuxt/kit';

import { installBulmaLayerClean } from './install';

/**
 * Keeps `@layer bulma` free of `!important` declarations (ADR 0057) so unlayered
 * application and scoped styles win by normal cascade order.
 */
export default defineNuxtModule({
  meta: { name: 'gitpulse-bulma-layer-clean' },
  setup(_options, nuxt) {
    installBulmaLayerClean(nuxt);
  },
});
