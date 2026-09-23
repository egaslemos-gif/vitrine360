/**
 * Daily schedule clock helpers — always compare as HH:mm minutes.
 *
 * Window semantics (half-open): start <= now < end
 * Overnight (start > end): now >= start OR now < end
 */

const HH_MM_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/** Normalize `HH:mm`, `HH:mm:ss`, or trim → `HH:mm`. Returns null if invalid. */
export function normalizeTimeToHHmm(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const m = HH_MM_RE.exec(raw);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Half-open daily window: start inclusive, end exclusive.
 * Overnight windows (start > end) wrap past midnight.
 * Missing bounds = open on that side.
 * Identical start/end = empty window (never matches).
 */
export function isWithinDailyWindow(
  hhmmNow: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): boolean {
  const now = normalizeTimeToHHmm(hhmmNow);
  if (!now) return false;
  const start = normalizeTimeToHHmm(startTime ?? undefined);
  const end = normalizeTimeToHHmm(endTime ?? undefined);
  const nowM = timeToMinutes(now);

  if (start && end) {
    const s = timeToMinutes(start);
    const e = timeToMinutes(end);
    if (s === e) return false;
    if (s < e) return nowM >= s && nowM < e;
    // overnight: e.g. 22:00 → 02:00
    return nowM >= s || nowM < e;
  }
  if (start) return nowM >= timeToMinutes(start);
  if (end) return nowM < timeToMinutes(end);
  return true;
}
