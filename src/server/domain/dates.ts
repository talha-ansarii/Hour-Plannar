const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DateKey = string;

export function assertDateKey(dateKey: string): asserts dateKey is DateKey {
  if (!DATE_KEY_RE.test(dateKey)) {
    throw new Error(`Invalid date key (expected YYYY-MM-DD): ${dateKey}`);
  }
}

export function parseDateKeyToUtcDate(dateKey: DateKey): Date {
  const [yStr, mStr, dStr] = dateKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

export function formatUtcDateToDateKey(date: Date): DateKey {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateKey: DateKey, days: number): DateKey {
  const dt = parseDateKeyToUtcDate(dateKey);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUtcDateToDateKey(dt);
}

export function compareDateKeys(a: DateKey, b: DateKey) {
  return a.localeCompare(b);
}

export function isBefore(a: DateKey, b: DateKey) {
  return compareDateKeys(a, b) < 0;
}

export function isAfter(a: DateKey, b: DateKey) {
  return compareDateKeys(a, b) > 0;
}

export function isSame(a: DateKey, b: DateKey) {
  return compareDateKeys(a, b) === 0;
}

export function getTodayKeyInTimeZone(timeZone: string, now = new Date()): DateKey {
  // en-CA yields YYYY-MM-DD reliably.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateKey = fmt.format(now);
  assertDateKey(dateKey);
  return dateKey;
}

export function getIsoWeekStartMonday(dateKey: DateKey): DateKey {
  // DateKey is a calendar date; weekday math is timezone-independent for that date.
  const dt = parseDateKeyToUtcDate(dateKey);
  const day = dt.getUTCDay(); // 0=Sun .. 6=Sat
  const iso = day === 0 ? 7 : day; // 1=Mon .. 7=Sun
  return addDays(dateKey, -(iso - 1));
}

export function getIsoWeekEndSunday(dateKey: DateKey): DateKey {
  return addDays(getIsoWeekStartMonday(dateKey), 6);
}

export function listDateKeysInclusive(start: DateKey, end: DateKey): DateKey[] {
  if (compareDateKeys(start, end) > 0) return [];
  const out: DateKey[] = [];
  let cur = start;
  while (compareDateKeys(cur, end) <= 0) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}


