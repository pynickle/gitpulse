import { defineNuxtModule } from '@nuxt/kit';

import { installHoverGate } from './install';

/**
 * Installs the hover gate (ADR 0049) on the build. The transform lives in
 * `plugin.ts` and the wiring in `install.ts`; this file only names the module, so
 * every stylesheet the build emits gets the gate and no surface has to remember.
 */
export default defineNuxtModule({
  meta: { name: 'gitpulse-hover-gate' },
  setup(_options, nuxt) {
    installHoverGate(nuxt);
  },
});
