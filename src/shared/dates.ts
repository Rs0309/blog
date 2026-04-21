export function nowIso(): string {
  return new Date().toISOString();
}

export function localDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function compactDateKey(dateKey: string): string {
  return dateKey.replace(/-/g, "");
}
