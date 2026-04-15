<template>
  <a
    v-if="canNavigate"
    href="#"
    @click.prevent="handleClick"
    class="tags has-addons is-inline ml-1"
  >
    <span class="tag is-activity is-danger is-light">
      <span v-if="crossRepository && refSubject?.repository?.nameWithOwner" class="mr-1">
        {{ refSubject.repository.nameWithOwner }}
      </span>
      {{ formatReferenceType(resolvedResourceType) }}
      #{{ refSubject?.number ?? '?' }}
    </span>

    <span class="tag is-activity is-link is-light">
      {{ refSubject?.title || 'Unavailable reference' }}
    </span>
  </a>

  <span v-else class="tags has-addons is-inline ml-1">
    <span class="tag is-activity is-danger is-light">
      {{ formatReferenceType(resolvedResourceType) }} #{{ refSubject?.number ?? '?' }}
    </span>
    <span class="tag is-activity is-link is-light">
      {{ refSubject?.title || 'Reference unavailable' }}
    </span>
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    refSubject: any;
    crossRepository?: boolean;
    resourceType?: string;
  }>(),
  {
    crossRepository: false,
  }
);

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const resolvedResourceType = computed(() => props.resourceType ?? props.refSubject?.resourceType);
const canNavigate = computed(() => {
  const repository = props.refSubject?.repository;
  return Boolean(repository?.owner?.login && repository?.name && props.refSubject?.number);
});

const handleClick = () => {
  if (!canNavigate.value) return;

  const { repository, number } = props.refSubject;
  const owner = repository.owner.login;
  const repo = repository.name;

  if (resolvedResourceType.value === 'pull-request') {
    switchToPullRequest(owner, repo, number);
  } else {
    switchToIssue(owner, repo, number);
  }
};

const formatReferenceType = (resourceType?: string) => {
  return resourceType === 'pull-request' ? 'PR' : 'Issue';
};

const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};
</script>

<style scoped lang="scss">
.tag.is-activity {
  font-size: 0.62rem;
  font-weight: bold;
}
</style>
