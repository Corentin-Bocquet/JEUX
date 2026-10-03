// Calculs des statistiques personnelles (sans DOM, testables).
export const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const SLOTS = [["Nuit", 0, 6], ["Matin", 6, 12], ["Midi", 12, 14], ["Aprèm", 14, 18], ["Soir", 18, 22], ["Tard", 22, 24]];

// rangée brute -> objet
export const toRow = (x) => ({ game: x[0], outcome: x[1], place: x[2], gems: +x[3] || 0, xp: +x[4] || 0, score: x[5] == null ? null : +x[5],
  dur: x[6] == null ? null : +x[6], at: +x[7], humans: +x[8] || 1, mode: x[9] });

export function dur(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${sec} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh} h ${String(mm).padStart(2, "0")}` : `${hh} h`;
}
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
export const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  if (s < 7 * 86400) return `il y a ${Math.round(s / 86400)} j`;
  return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

// tous les calculs, exportés pour les tests
export function compute(rows) {
  const n = rows.length;
  const win = rows.filter((r) => r.outcome === "win").length, draw = rows.filter((r) => r.outcome === "draw").length;
  const lose = n - win - draw;
  const time = rows.reduce((t, r) => t + (r.dur || 0), 0);
  let cur = 0, best = 0;
  for (const r of rows) { if (r.outcome === "win") { cur++; best = Math.max(best, cur); } else cur = 0; }
  const multi = rows.filter((r) => r.humans >= 2), solo = rows.filter((r) => r.humans < 2);
  const days = new Map();
  for (const r of rows) days.set(dayKey(r.at), (days.get(dayKey(r.at)) || 0) + 1);
  const week = Array(7).fill(0), slots = Array(SLOTS.length).fill(0);
  for (const r of rows) {
    const d = new Date(r.at);
    week[(d.getDay() + 6) % 7]++;
    slots[SLOTS.findIndex(([, a, b]) => d.getHours() >= a && d.getHours() < b)]++;
  }
  const per = {};
  for (const r of rows) {
    const g = per[r.game] || (per[r.game] = { id: r.game, p: 0, w: 0, d: 0, time: 0, best: null, last: 0, gems: 0 });
    g.p++; if (r.outcome === "win") g.w++; if (r.outcome === "draw") g.d++;
    g.time += r.dur || 0; g.gems += r.gems; g.last = Math.max(g.last, r.at);
    if (r.score != null && (g.best == null || r.score > g.best)) g.best = r.score;
  }
  const games = Object.values(per).sort((a, b) => b.p - a.p);
  const podium = [1, 2, 3].map((k) => multi.filter((r) => r.place === k).length);
  const places = multi.filter((r) => r.place);
  const withDur = rows.filter((r) => r.dur);
  const longest = withDur.reduce((m, r) => (!m || r.dur > m.dur ? r : m), null);
  const fastestWin = withDur.filter((r) => r.outcome === "win").reduce((m, r) => (!m || r.dur < m.dur ? r : m), null);
  let bestDay = null;
  for (const [k, v] of days) if (!bestDay || v > bestDay.n) bestDay = { k, n: v, at: rows.find((r) => dayKey(r.at) === k).at };
  const modes = {};
  for (const r of rows) if (r.mode) modes[r.mode] = (modes[r.mode] || 0) + 1;
  return {
    n, win, draw, lose, time, cur, best, gems: rows.reduce((t, r) => t + r.gems, 0), xp: rows.reduce((t, r) => t + r.xp, 0),
    solo: { n: solo.length, w: solo.filter((r) => r.outcome === "win").length },
    multi: { n: multi.length, w: multi.filter((r) => r.outcome === "win").length },
    days, activeDays: days.size, week, slots, games, podium,
    avgPlace: places.length ? places.reduce((t, r) => t + r.place, 0) / places.length : null,
    longest, fastestWin, bestDay, first: rows[0] || null, modes,
    bigGain: rows.reduce((m, r) => (!m || r.gems > m.gems ? r : m), null),
  };
}
