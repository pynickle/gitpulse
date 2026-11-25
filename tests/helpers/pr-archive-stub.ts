import { ref, shallowRef } from 'vue';

// A PRActions host that does not exercise archiving still needs the controller:
// the real one reads archived state on mount.
export const archiveStub = () => ({
  isArchived: ref(false),
  loading: ref(false),
  submitting: ref(false),
  error: shallowRef(''),
  load: async () => undefined,
  setArchived: async () => true,
});
