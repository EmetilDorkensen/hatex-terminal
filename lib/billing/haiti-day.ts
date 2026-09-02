const HAITI_TZ = 'America/Port-au-Prince';

/** Dat kalandriye jodi a an Ayiti (YYYY-MM-DD). */
export function haitiToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: HAITI_TZ });
}

/**
 * Kòmansman / fen jounen an nan Ayiti, an UTC ISO.
 * Haiti pa sèvi ak DST kounye a — nou kalkile offset la nan moman an.
 */
export function haitiDayBounds(): { startIso: string; endIso: string; day: string } {
  const day = haitiToday();
  const probe = new Date(`${day}T16:00:00.000Z`);
  const haitiHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: HAITI_TZ,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(probe)
  );
  const offsetHours = haitiHour - 16;
  const start = new Date(`${day}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - offsetHours);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString(), day };
}
