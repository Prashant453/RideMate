export function buildSearchWindow(time: string, flexMinutes: number = 30, now = new Date()) {
  let hour24 = 16;
  let minute = 30;

  const trimmed = time.trim();
  // Format 1: "4:30 PM"
  const match12h = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12h) {
    const h = Number(match12h[1]);
    const m = Number(match12h[2]);
    const p = match12h[3].toUpperCase();
    hour24 = p === "AM" ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    minute = m;
  } else {
    // Format 2: "16:30" (custom HTML5 time input)
    const match24h = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match24h) {
      hour24 = Number(match24h[1]);
      minute = Number(match24h[2]);
    }
  }

  const start = new Date(now);
  start.setHours(hour24, minute, 0, 0);

  const flexMs = Math.max(0, flexMinutes) * 60 * 1000;
  return {
    from: new Date(start.getTime() - flexMs),
    to: new Date(start.getTime() + flexMs),
  };
}

export function formatSearchWindowLabel(time: string, flexMinutes: number = 30): string {
  const window = buildSearchWindow(time, flexMinutes);
  const fromTime = window.from.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const toTime = window.to.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (flexMinutes === 0) return `${time} (Exact)`;
  return `${time} (±${flexMinutes}m → ${fromTime}–${toTime})`;
}
