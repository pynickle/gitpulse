import { watch } from 'vue';

export interface DashboardLayoutState {
  isWidgetsPanelVisible: boolean;
  tabSidebarWidth: number;
  widgetsPanelWidth: number;
}

export interface DashboardLayoutInput {
  isWidgetsPanelVisible?: boolean;
  tabSidebarWidth?: number;
  widgetsPanelWidth?: number;
}

const STORAGE_KEY = 'gitpulse:dashboard:layout';

const DEFAULT_LAYOUT: DashboardLayoutState = {
  isWidgetsPanelVisible: true,
  tabSidebarWidth: 240,
  widgetsPanelWidth: 280,
};

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 320;
const WIDGETS_MIN_WIDTH = 250;
const WIDGETS_MAX_WIDTH = 360;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const normalizeLayout = (input: Partial<DashboardLayoutState>): DashboardLayoutState => {
  const isWidgetsPanelVisible =
    typeof input.isWidgetsPanelVisible === 'boolean'
      ? input.isWidgetsPanelVisible
      : DEFAULT_LAYOUT.isWidgetsPanelVisible;

  const tabSidebarWidth =
    typeof input.tabSidebarWidth === 'number' && Number.isFinite(input.tabSidebarWidth)
      ? clamp(input.tabSidebarWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
      : DEFAULT_LAYOUT.tabSidebarWidth;

  const widgetsPanelWidth =
    typeof input.widgetsPanelWidth === 'number' && Number.isFinite(input.widgetsPanelWidth)
      ? clamp(input.widgetsPanelWidth, WIDGETS_MIN_WIDTH, WIDGETS_MAX_WIDTH)
      : DEFAULT_LAYOUT.widgetsPanelWidth;

  return {
    isWidgetsPanelVisible,
    tabSidebarWidth,
    widgetsPanelWidth,
  };
};

const readStoredLayout = (): DashboardLayoutState | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardLayoutState>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return normalizeLayout(parsed);
  } catch {
    return null;
  }
};

const writeStoredLayout = (layout: DashboardLayoutState) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
};

export function useDashboardLayout(initialLayout: DashboardLayoutInput = DEFAULT_LAYOUT) {
  const layout = useState<DashboardLayoutState>('gitpulse-dashboard-layout', () => {
    return normalizeLayout(initialLayout);
  });

  if (typeof window !== 'undefined') {
    const storedLayout = readStoredLayout();
    if (storedLayout) {
      layout.value = storedLayout;
    }
  }

  watch(
    layout,
    (nextLayout) => {
      writeStoredLayout(nextLayout);
    },
    { deep: true }
  );

  const setLayout = (updates: DashboardLayoutInput) => {
    layout.value = normalizeLayout({
      ...layout.value,
      ...updates,
    });

    return layout.value;
  };

  const toggleWidgetsPanel = () => {
    return setLayout({ isWidgetsPanelVisible: !layout.value.isWidgetsPanelVisible });
  };

  const setWidgetsPanelVisible = (visible: boolean) => {
    return setLayout({ isWidgetsPanelVisible: visible });
  };

  const setTabSidebarWidth = (width: number) => {
    return setLayout({ tabSidebarWidth: width });
  };

  const setWidgetsPanelWidth = (width: number) => {
    return setLayout({ widgetsPanelWidth: width });
  };

  const resetLayout = () => {
    layout.value = normalizeLayout(initialLayout);
    return layout.value;
  };

  const isWidgetsPanelVisible = computed(() => layout.value.isWidgetsPanelVisible);
  const tabSidebarWidth = computed(() => layout.value.tabSidebarWidth);
  const widgetsPanelWidth = computed(() => layout.value.widgetsPanelWidth);

  return {
    layout,
    isWidgetsPanelVisible,
    tabSidebarWidth,
    widgetsPanelWidth,
    setLayout,
    toggleWidgetsPanel,
    setWidgetsPanelVisible,
    setTabSidebarWidth,
    setWidgetsPanelWidth,
    resetLayout,
  };
}
