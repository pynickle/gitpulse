const issueTypeColors: Record<string, string> = {
  gray: '#6e7781',
  blue: '#0969da',
  green: '#1a7f37',
  yellow: '#bf8700',
  orange: '#bc4c00',
  red: '#cf222e',
  pink: '#bf3989',
  purple: '#8250df',
};

export default function resolveIssueTypeColor(color?: string | null): string {
  const normalizedColor = color?.trim().toLowerCase() ?? '';

  if (/^#[\da-f]{6}$/i.test(normalizedColor)) return normalizedColor;
  if (/^[\da-f]{6}$/i.test(normalizedColor)) return `#${normalizedColor}`;

  return issueTypeColors[normalizedColor] ?? issueTypeColors.gray!;
}
