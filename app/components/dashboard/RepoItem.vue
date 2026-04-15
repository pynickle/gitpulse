<template>
  <div class="card dashboard-list-card dashboard-list-card--repo">
    <div class="card-content p-3 pl-4">
      <div class="media mb-2">
        <div class="media-content dashboard-list-card__content">
          <div class="is-flex is-justify-content-space-between is-align-items-center">
            <p class="title is-6 mb-0 dashboard-list-card__title">{{ repo.name }}</p>
            <div class="is-flex is-align-items-center">
              <span v-if="repo.language" class="tag mr-2 is-info is-light">
                {{ repo.language }}
              </span>
              <span v-if="repo.private" class="tag is-dark">Private</span>
            </div>
          </div>
          <p
            v-if="repo.description"
            class="subtitle is-7 has-text-grey mt-1 dashboard-list-card__description"
          >
            {{ repo.description }}
          </p>
        </div>
      </div>

      <div class="is-flex is-align-items-center">
        <div class="is-flex is-align-items-center mr-4">
          <StarIcon :size="14" class="mr-1 has-text-grey" />
          <span class="is-size-7 has-text-grey">{{ repo.stargazers_count }}</span>
        </div>
        <div class="is-flex is-align-items-center mr-4">
          <GitForkIcon :size="14" class="mr-1 has-text-grey" />
          <span class="is-size-7 has-text-grey">{{ repo.forks_count }}</span>
        </div>
        <div class="is-flex is-align-items-center">
          <EyeIcon :size="14" class="mr-1 has-text-grey" />
          <span class="is-size-7 has-text-grey">{{ repo.watchers_count || 0 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { StarIcon, GitForkIcon, EyeIcon } from 'lucide-vue-next';

defineProps<{
  repo: any;
}>();
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
