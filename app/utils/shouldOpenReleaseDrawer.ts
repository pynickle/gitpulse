export const RELEASE_DRAWER_IGNORE_SELECTOR = '[data-release-drawer-ignore], a[href]';

type ClosestHost = {
  closest: (selector: string) => unknown;
};

type ClickTarget = ClosestHost & {
  parentElement?: ClosestHost | null;
};

const asClosestHost = (target: EventTarget | ClickTarget | null): ClosestHost | null => {
  if (!target || typeof target !== 'object') return null;

  if (typeof (target as ClosestHost).closest === 'function') {
    return target as ClosestHost;
  }

  const parent = 'parentElement' in target ? target.parentElement : null;
  if (parent && typeof parent.closest === 'function') {
    return parent;
  }

  return null;
};

export default function shouldOpenReleaseDrawer(target: EventTarget | ClickTarget | null): boolean {
  const host = asClosestHost(target);
  if (!host) return false;
  return !host.closest(RELEASE_DRAWER_IGNORE_SELECTOR);
}
