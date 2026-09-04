export type ReleaseTimelineRowMetric = {
  top: number;
  height: number;
};

const findFirstRowEndingAfter = (metrics: readonly ReleaseTimelineRowMetric[], offset: number) => {
  let low = 0;
  let high = metrics.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const metric = metrics[mid];
    if (!metric) {
      break;
    }

    if (metric.top + metric.height < offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

const findFirstRowStartingAfter = (
  metrics: readonly ReleaseTimelineRowMetric[],
  offset: number
) => {
  let low = 0;
  let high = metrics.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const metric = metrics[mid];
    if (!metric) {
      break;
    }

    if (metric.top <= offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

export default function resolveReleaseTimelineVisibleRange(input: {
  metrics: readonly ReleaseTimelineRowMetric[];
  viewportTop: number;
  viewportBottom: number;
  overscanPx?: number;
  overscanRows?: number;
  minVisibleRows?: number;
}): { start: number; end: number } {
  const metrics = input.metrics;
  if (metrics.length === 0) {
    return { start: 0, end: 0 };
  }

  const last = metrics[metrics.length - 1];
  if (!last) {
    return { start: 0, end: 0 };
  }

  const overscanPx = input.overscanPx ?? 0;
  const overscanRows = input.overscanRows ?? 0;
  const minVisibleRows = input.minVisibleRows ?? 1;
  const viewportTop = input.viewportTop - overscanPx;
  const viewportBottom = input.viewportBottom + overscanPx;
  const totalHeight = last.top + last.height;

  if (viewportBottom <= 0 || viewportTop >= totalHeight) {
    return { start: 0, end: 0 };
  }

  let start = findFirstRowEndingAfter(metrics, viewportTop);
  let end = findFirstRowStartingAfter(metrics, viewportBottom);

  start = Math.max(0, start - overscanRows);
  end = Math.min(metrics.length, Math.max(end + overscanRows, start + minVisibleRows));

  return { start, end };
}
