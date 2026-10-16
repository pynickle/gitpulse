<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    ariaLabel?: string;
    disabled?: boolean;
  }>(),
  {
    ariaLabel: undefined,
    disabled: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const handleChange = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).checked);
};
</script>

<template>
  <span class="toggle-switch" :class="{ 'toggle-switch--checked': modelValue }">
    <input
      class="toggle-switch__input"
      type="checkbox"
      role="switch"
      :checked="modelValue"
      :aria-checked="modelValue"
      :aria-label="ariaLabel"
      :disabled="disabled"
      @change="handleChange"
    />
    <span class="toggle-switch__track" aria-hidden="true">
      <span class="toggle-switch__knob" />
    </span>
  </span>
</template>

<style scoped lang="scss">
.toggle-switch {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

/* Visually hidden but focusable; the label wrapper makes the whole row clickable. */
.toggle-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.toggle-switch__track {
  position: relative;
  width: 2.5rem;
  height: 1.4rem;
  border-radius: 999px;
  background: var(--gitpulse-border);
  transition: background-color 0.15s ease;
}

.toggle-switch__knob {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  background: var(--gitpulse-surface);
  box-shadow: 0 1px 2px rgb(15 23 42 / 18%);
  transition: transform 0.15s ease;
}

.toggle-switch--checked .toggle-switch__track {
  background: var(--gitpulse-accent);
}

.toggle-switch--checked .toggle-switch__knob {
  transform: translateX(1.1rem);
}

.toggle-switch__input:focus-visible + .toggle-switch__track {
  box-shadow: 0 0 0 3px var(--gitpulse-accent-soft);
}

.toggle-switch__input:disabled + .toggle-switch__track {
  opacity: 0.5;
}
</style>
