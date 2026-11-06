import { readonly, shallowRef, type Ref } from 'vue';

/** The capability query the pointer contract pins for hover (`app/assets/scss/_pointer.scss`). */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * One listener and one ref per query for the whole client: a media query is not owned by
 * a component, and every reader of the same query wants the same answer. Module scope is
 * also why this lives outside the components that ask it.
 */
const queryMatches = new Map<string, Ref<boolean>>();

function useMediaQuery(query: string) {
  const existing = queryMatches.get(query);
  if (existing) {
    return readonly(existing);
  }

  const matches = shallowRef(false);
  queryMatches.set(query, matches);

  if (import.meta.client) {
    const media = window.matchMedia(query);
    const sync = () => {
      matches.value = media.matches;
    };

    sync();
    media.addEventListener('change', sync);
  }

  return readonly(matches);
}

/** Whether the reader's primary pointer can hover and aim — capability, never a width. */
export function useFinePointer() {
  return useMediaQuery(FINE_POINTER_QUERY);
}

/** Whether the reader asked for motion not to be played at them. */
export function usePrefersReducedMotion() {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
