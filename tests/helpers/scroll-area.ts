import SimpleBar from 'simplebar-vue';

import { compileVue } from './compile-vue';

export const ScrollArea = await compileVue('app/components/ui/ScrollArea.vue', {
  'simplebar-vue': { default: SimpleBar },
});
