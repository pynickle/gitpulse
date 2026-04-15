<script setup lang="ts">
import { parseMarkdown } from '@nuxtjs/mdc/runtime';

const props = defineProps<{
  value: string;
}>();

const ast = ref<any>(null);

watch(
  () => props.value,
  async (v) => {
    if (!v) {
      ast.value = null;
      return;
    }
    ast.value = await parseMarkdown(v);
  },
  { immediate: true }
);
</script>

<template>
  <MDCRenderer class="markdown-body" v-if="ast" :body="ast.body" :data="ast.data" />
</template>

<style lang="scss" src="@primer/css/color-modes/themes/light.scss" />
<style lang="scss" src="@primer/css/primitives/index.scss" />
<style lang="scss" src="@primer/css/markdown/index.scss" />
<style lang="scss">
.markdown-body {
  font-size: 14px;
  hr {
    display: revert;
  }
  h3:not(:first-child) {
    margin-top: revert;
  }
  code {
    color: revert;
    font-weight: revert;
  }
  blockquote:not(:last-child) {
    margin-bottom: revert;
  }
  blockquote {
    background-color: revert;
  }
  a {
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  ul {
    list-style: none;
    margin-inline-start: revert;
    padding-left: 1em;
  }
}
</style>
