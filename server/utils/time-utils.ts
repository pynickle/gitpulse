export function getOneYearAgoDate(): string {
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  return oneYearAgo.toISOString().split('T')[0]!;
}
