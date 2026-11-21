const GROUPED_TIMELINE_EVENT_TYPES = new Set([
  'cross-referenced',
  'sub_issue_added',
  'blocked_by_added',
]);

export function groupAdjacentTimelineItems<
  T extends { kind: string; eventType?: string; actor?: { login?: string } },
>(items: T[]): Array<T & { groupedEvents?: T[] }> {
  const grouped: Array<T & { groupedEvents?: T[] }> = [];

  for (let index = 0; index < items.length;) {
    const item = items[index]!;
    if (item.kind !== 'event' || !GROUPED_TIMELINE_EVENT_TYPES.has(item.eventType ?? '')) {
      grouped.push(item);
      index += 1;
      continue;
    }

    const login = item.actor?.login?.trim().toLowerCase();
    const events = [item];
    while (
      login &&
      items[index + 1]?.kind === 'event' &&
      items[index + 1]?.eventType === item.eventType &&
      items[index + 1]?.actor?.login?.trim().toLowerCase() === login
    ) {
      events.push(items[++index]!);
    }

    grouped.push(events.length > 1 ? { ...item, groupedEvents: events } : item);
    index += 1;
  }

  return grouped;
}
