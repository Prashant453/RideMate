export function buildSearchWindow(time: string, now = new Date()) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const hour = Number(match?.[1] ?? 12);
  const minute = Number(match?.[2] ?? 0);
  const period = (match?.[3] ?? "PM").toUpperCase();
  const hour24 = period === "AM" ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
  const start = new Date(now);
  start.setHours(hour24, minute, 0, 0);
  return { from: new Date(start.getTime() - 30 * 60 * 1000), to: new Date(start.getTime() + 30 * 60 * 1000) };
}
