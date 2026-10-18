<script setup lang="ts">
import type { NativeLoginBrowserPage } from '#shared/types/native-login-browser';
import NativeLoginCard from '~/components/native-login/NativeLoginCard.vue';

const route = useRoute();
const event = useRequestEvent();
const { t } = useI18n();
const attemptId = typeof route.query.id === 'string' ? route.query.id : '';
const page = useState<NativeLoginBrowserPage | null>(
  `native-login-browser:${attemptId}`,
  () => event?.context.nativeLoginBrowserPage ?? null
);

if (!page.value) {
  throw createError({ statusCode: 500, statusMessage: 'Sign-in page is unavailable' });
}

usePageMeta(t('nativeLogin.pageTitle'), {
  description: t('nativeLogin.pageDescription'),
});
useSeoMeta({ robots: 'noindex, nofollow' });
</script>

<template>
  <NativeLoginCard v-if="page" :model="page" />
</template>
