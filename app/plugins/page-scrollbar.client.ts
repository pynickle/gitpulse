const ACTIVE_CLASS = 'gp-scrollbar-active';
const HIDE_AFTER_MS = 1000;
const INSTALLED = '__gitpulsePageScrollbar';

export default defineNuxtPlugin(() => {
  if (Reflect.get(window, INSTALLED)) return;
  Reflect.set(window, INSTALLED, true);

  const timers = new WeakMap<HTMLElement, number>();

  document.addEventListener(
    'scroll',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === document.body || target === document.documentElement) return;

      target.classList.add(ACTIVE_CLASS);
      const pending = timers.get(target);
      if (pending !== undefined) window.clearTimeout(pending);
      timers.set(
        target,
        window.setTimeout(() => {
          target.classList.remove(ACTIVE_CLASS);
          timers.delete(target);
        }, HIDE_AFTER_MS)
      );
    },
    { capture: true, passive: true }
  );
});
