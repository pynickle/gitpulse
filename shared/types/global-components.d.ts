import SimpleBar from 'simplebar-vue';

declare module '@vue/runtime-core' {
  interface GlobalComponents {
    SimpleBar: typeof SimpleBar;
  }
}
