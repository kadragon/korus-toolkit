export function compactDate(year: string, month: string, day: string): string | undefined {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y >= 1000 && y <= 9999 && date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 && date.getUTCDate() === d) {
    return year + month.padStart(2, '0') + day.padStart(2, '0');
  }
  return undefined;
}
