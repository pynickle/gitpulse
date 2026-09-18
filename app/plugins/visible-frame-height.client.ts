export default defineNuxtPlugin(() => {
  const root = document.documentElement;
  let appliedHeight = '';

  const sync = () => {
    const height = resolveVisibleFrameHeight({
      visualViewportHeight: window.visualViewport?.height ?? null,
      visualViewportScale: window.visualViewport?.scale ?? null,
      innerHeight: window.innerHeight,
    });
    const next = `${height}px`;
    if (next === appliedHeight) return;
    appliedHeight = next;
    root.style.setProperty('--gitpulse-frame-height', next);
  };

  sync();
  window.visualViewport?.addEventListener('resize', sync);
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
});
