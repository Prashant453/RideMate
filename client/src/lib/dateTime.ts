/**
 * Returns the current local date in YYYY-MM-DD format.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the local time in HH:MM format (24-hour).
 */
export function getLocalTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Returns a recommended default departure time (e.g. current time rounded up to next 15-minute slot).
 */
export function getDefaultDepartureTime(date: Date = new Date()): string {
  const d = new Date(date.getTime() + 15 * 60 * 1000);
  const remainder = d.getMinutes() % 15;
  if (remainder !== 0) {
    d.setMinutes(d.getMinutes() + (15 - remainder));
  }
  return getLocalTimeString(d);
}

/**
 * Accurately parses a local date (YYYY-MM-DD) and time (HH:MM) into a JavaScript Date object.
 */
export function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
}

/**
 * Checks if a given date string (YYYY-MM-DD) is in the past relative to the current local date.
 */
export function isPastDate(dateStr: string, now: Date = new Date()): boolean {
  const todayStr = getLocalDateString(now);
  return dateStr < todayStr;
}

/**
 * Checks if a given date and time have already passed in the local timezone.
 * Allows an optional grace period in minutes (default: 1 minute) to account for form fill time.
 */
export function isPastDateTime(dateStr: string, timeStr: string, now: Date = new Date(), graceMinutes: number = 1): boolean {
  if (isPastDate(dateStr, now)) return true;

  const parsed = parseLocalDateTime(dateStr, timeStr);
  const nowWithGrace = new Date(now.getTime() - graceMinutes * 60 * 1000);
  return parsed.getTime() < nowWithGrace.getTime();
}
