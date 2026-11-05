<template>
  <section class="public-card card">
    <div class="public-card__copy">
      <div class="public-card__logo">
        <RoundImg src="/icon.png" :alt="logoAlt" width="72" height="72" />
      </div>
      <p class="public-card__eyebrow">{{ eyebrow }}</p>
      <h1 class="public-card__title">{{ title }}</h1>
      <p v-for="paragraph in paragraphs" :key="paragraph" class="public-card__text">
        {{ paragraph }}
      </p>
    </div>

    <div class="public-card__panel">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import RoundImg from '~/components/ui/RoundImg.vue';

/*
 * The signed-out card, shared by the landing pages and the native approval page
 * so those surfaces cannot drift apart. It owns the frame, the copy column's
 * typography, and the responsive switch from two columns to one; callers supply
 * only what differs between them (the copy and the interactive panel).
 */
const {
  eyebrow,
  title,
  paragraphs = [],
  logoAlt = 'GitPulse',
} = defineProps<{
  eyebrow: string;
  title: string;
  paragraphs?: readonly string[];
  logoAlt?: string;
}>();
</script>

<style scoped lang="scss">
@use '~/assets/scss/variables' as *;

.public-card {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 0.95fr);
  width: min(100%, 1040px);
  overflow: hidden;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-card);
  text-align: left;
}

.public-card__copy,
.public-card__panel {
  padding: 2.5rem;
}

.public-card__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  background: var(--gitpulse-surface-muted);
  border-right: 1px solid var(--gitpulse-border);
}

.public-card__panel {
  display: grid;
  align-content: center;
  gap: 1rem;
  min-width: 0;
}

.public-card__logo {
  margin-bottom: 1rem;
}

.public-card__eyebrow {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: $brand-primary;
}

.public-card__title {
  margin: 0 0 0.85rem;
  /* One type scale for every signed-out surface, and small enough that the
     longest locale title still fits a 320px card. */
  font-size: clamp(1.6rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  color: var(--gitpulse-text-strong);
  overflow-wrap: break-word;
}

.public-card__text {
  margin: 0;
  max-width: 32rem;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--gitpulse-text-muted);
  overflow-wrap: break-word;
}

.public-card__text + .public-card__text {
  margin-top: 0.7rem;
}

@media (max-width: 1023px) {
  .public-card {
    grid-template-columns: 1fr;
  }

  .public-card__copy,
  .public-card__panel {
    padding: 1.75rem;
  }

  .public-card__copy {
    border-right: 0;
    border-bottom: 1px solid var(--gitpulse-border);
  }
}

@media (max-width: 480px) {
  .public-card__copy,
  .public-card__panel {
    padding: 1.25rem;
  }

  .public-card__logo {
    margin-bottom: 0.75rem;
  }
}
</style>
