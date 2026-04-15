import 'simplebar-vue/dist/simplebar.min.css';
import simplebar from 'simplebar-vue';

import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('SimpleBar', simplebar);
});
