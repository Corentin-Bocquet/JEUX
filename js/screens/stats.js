// Statistiques personnelles : chiffres clés, séries, activité, jeux, records, rivaux, historique.
import { h, tile, fmt, sfx, gem } from "../ui.js";
import { avatarHTML } from "../avatar.js";
import { GAMES, gameInfo } from "../games/index.js";
import { openGame } from "./home.js";
import { DAYS, SLOTS, toRow, dur, dayKey, pct, ago, compute } from "../statsCalc.js";

const PERIODS = [["7", "7 jours"], ["30", "30 jours"], ["365", "1 an"], ["all", "Tout"]];
let period = "all", only = "";

export async function render(A, main) {
  const wrap = h("div", { class: "wrap-w stack" });
  main.append(wrap);
  wrap.append(h("div", { class: "empty", style: { paddingTop: "20vh" } }, "Calcul de tes stats…"));
  let data;
  try { data = await A.api.myStats(); } catch (e) { wrap.replaceChildren(h("div", { class: "empty" }, e.message)); return; }
  const all = (data.rows || []).map(toRow).sort((a, b) => a.at - b.at);
  const rivals = data.rivals || [];

  const draw = () => {
    const since = period === "all" ? 0 : Date.now() - +period * 864e5;
    const rows = all.filter((r) => r.at >= since && (!only || r.game === only));
    const S = compute(rows);
    const playedIds = [...new Set(all.map((r) => r.game))].filter(gameInfo);
    const g1 = only && gameInfo(only);

    const head = h("div", { class: "stack", style: { gap: "8px" } },
      h("div", { class: "row between" }, h("div", { class: "h1" }, "📊 Mes stats"), h("a", { class: "small link", href: "#/profil" }, "Profil")),
      h("div", { class: "sortbar", style: { margin: 0 } }, PERIODS.map(([k, t]) => h("button", { class: "chip" + (k === period ? " on" : ""), onclick: () => { period = k; sfx.tap(); draw(); } }, t))),
      playedIds.length > 1 ? h("div", { class: "sortbar", style: { margin: 0 } },
        h("button", { class: "chip small" + (!only ? " on" : ""), onclick: () => { only = ""; sfx.tap(); draw(); } }, "Tous les jeux"),
        playedIds.map((id) => h("button", { class: "chip small" + (only === id ? " on" : ""), onclick: () => { only = id; sfx.tap(); draw(); } }, gameInfo(id).name))) : null);

    if (!S.n) {
      wrap.replaceChildren(head, h("div", { class: "card glass center stack", style: { alignItems: "center", padding: "30px 16px" } },
        h("div", { style: { fontSize: "54px" } }, "🎲"), h("div", { class: "h2" }, all.length ? "Rien sur cette période" : "Pas encore de partie"),
        h("p", { class: "lead small" }, all.length ? "Change de période ou de jeu pour voir tes chiffres." : "Joue ta première partie : tes statistiques se rempliront toutes seules."),
        h("button", { class: "btn green", onclick: () => A.go("/") }, "Choisir un jeu")));
      return;
    }

    const kpi = (em, val, label) => h("div", { class: "kpi glass" }, h("span", { class: "em" }, em), h("b", null, val), h("span", null, label));
    const kpis = h("div", { class: "kpis" },
      kpi("🎮", fmt(S.n), S.n > 1 ? "parties jouées" : "partie jouée"), kpi("🏆", fmt(S.win), S.win > 1 ? "victoires" : "victoire"),
      kpi("📈", pct(S.win, S.n) + "%", "de réussite"), kpi("⏳", dur(S.time), "de jeu"),
      kpi("💎", fmt(S.gems), "gemmes gagnées"), kpi("⭐", fmt(S.xp), "XP gagnée"),
      kpi("🔥", S.cur, `victoire${S.cur > 1 ? "s" : ""} d'affilée`), kpi("⚡", S.best, "meilleure série"));

    // anneau victoires / nuls / défaites
    const R = 46, C = 2 * Math.PI * R;
    const segs = [[S.win, "var(--green)", "Victoires"], [S.draw, "var(--gold)", "Égalités"], [S.lose, "var(--red)", "Défaites"]];
    let off = 0;
    const arcs = segs.map(([v, c]) => { const len = (C * v) / S.n; const a = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${c}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; return a; }).join("");
    const donut = h("div", { class: "card glass stack" }, h("div", { class: "h3" }, "Bilan"),
      h("div", { class: "donut-wrap" },
        h("div", { html: `<svg width="130" height="130" viewBox="0 0 120 120" role="img" aria-label="Répartition des résultats"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--card2)" stroke-width="18"/>${arcs}<text x="60" y="58" text-anchor="middle" font-size="22" font-weight="900" fill="currentColor">${pct(S.win, S.n)}%</text><text x="60" y="76" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" opacity=".7">réussite</text></svg>` }),
        h("div", { class: "legend" }, segs.map(([v, c, t]) => h("div", null, h("i", { style: { background: c } }), `${t} : ${fmt(v)} (${pct(v, S.n)}%)`)))));

    // solo / multi / podiums
    const split = h("div", { class: "card glass stack" }, h("div", { class: "h3" }, "Solo ou entre amis"),
      h("div", { class: "vs" }, h("i", { style: { width: pct(S.solo.n, S.n) + "%", background: "var(--purple)" } }), h("i", { style: { width: pct(S.multi.n, S.n) + "%", background: "var(--blue)" } })),
      h("div", { class: "row between small" },
        h("span", null, `🤖 Solo : ${fmt(S.solo.n)} parties, ${pct(S.solo.w, S.solo.n)}% gagnées`),
        h("span", null, `👥 Amis : ${fmt(S.multi.n)}, ${pct(S.multi.w, S.multi.n)}%`)),
      S.multi.n ? h("div", { class: "row gap", style: { justifyContent: "space-around", marginTop: "6px" } },
        [["🥇", S.podium[0]], ["🥈", S.podium[1]], ["🥉", S.podium[2]]].map(([e, v]) => h("div", { class: "center" }, h("div", { style: { fontSize: "28px" } }, e), h("b", null, fmt(v)))),
        h("div", { class: "center" }, h("div", { style: { fontSize: "28px" } }, "🎯"), h("b", null, S.avgPlace ? S.avgPlace.toFixed(1).replace(".", ",") : "-"), h("div", { class: "small dim" }, "place moy."))) : null);

    // activité : 18 semaines
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const startDay = new Date(today); startDay.setDate(startDay.getDate() - ((today.getDay() + 6) % 7) - 17 * 7);
    const cells = [];
    const max = Math.max(1, ...S.days.values());
    for (let d = new Date(startDay); d <= today; d.setDate(d.getDate() + 1)) {
      const v = S.days.get(dayKey(d)) || 0;
      const lvl = v ? Math.min(4, Math.ceil((4 * v) / max)) : 0;
      cells.push(h("i", { class: lvl ? "l" + lvl : "", title: `${d.toLocaleDateString("fr-FR")} : ${v} partie${v > 1 ? "s" : ""}` }));
    }
    const activity = h("div", { class: "card glass stack" },
      h("div", { class: "row between" }, h("div", { class: "h3" }, "Activité"), h("span", { class: "small dim" }, `${S.activeDays} jour${S.activeDays > 1 ? "s" : ""} actif${S.activeDays > 1 ? "s" : ""}`)),
      h("div", { class: "heat" }, cells),
      h("div", { class: "small dim" }, `En moyenne ${(S.n / Math.max(1, S.activeDays)).toFixed(1).replace(".", ",")} parties par jour joué.`));

    const barChart = (vals, labels) => {
      const m = Math.max(1, ...vals), top = vals.indexOf(Math.max(...vals));
      return h("div", { class: "bars" }, vals.map((v, i) => h("div", null, h("small", null, v || ""), h("div", { class: "b" + (i === top && v ? " top" : ""), style: { height: Math.round((100 * v) / m) + "%" } }), h("small", null, labels[i]))));
    };
    const habits = h("div", { class: "card glass stack" }, h("div", { class: "h3" }, "Tes habitudes"),
      h("div", { class: "small dim" }, "Par jour de la semaine"), barChart(S.week, DAYS),
      h("div", { class: "small dim", style: { marginTop: "8px" } }, "Par moment de la journée"), barChart(S.slots, SLOTS.map((x) => x[0])));

    const perGame = h("div", { class: "card glass stack" }, h("div", { class: "h3" }, g1 ? g1.name : "Par jeu"),
      S.games.map((g) => {
        const info = gameInfo(g.id) || { name: g.id, icon: "jouer", color: "#6C5CE7" };
        const l = g.p - g.w - g.d;
        return h("button", { class: "gline", style: { textAlign: "left", width: "100%" }, onclick: () => openGame(A, g.id) },
          tile(info.icon, 40, info.color),
          h("div", null, h("div", { class: "row between" }, h("b", null, info.name), h("span", { class: "small dim" }, `${g.p} partie${g.p > 1 ? "s" : ""}`)),
            h("div", { class: "meter" }, h("i", { style: { width: pct(g.w, g.p) + "%", background: "var(--green)" } }), h("i", { style: { width: pct(g.d, g.p) + "%", background: "var(--gold)" } }), h("i", { style: { width: pct(l, g.p) + "%", background: "var(--red)" } })),
            h("div", { class: "small dim", style: { marginTop: "3px" } }, [`${pct(g.w, g.p)}% gagnées`, g.time ? dur(g.time) : null, g.best != null ? `record ${fmt(g.best)}` : null, ago(g.last)].filter(Boolean).join(" · "))),
          h("span", { class: "small" }, "›"));
      }));

    const rec = (em, val, label) => h("div", { class: "record glass" }, h("span", { class: "em" }, em), h("b", null, val), h("span", null, label));
    const fav = S.games[0] && gameInfo(S.games[0].id);
    const records = h("div", { class: "card glass stack" }, h("div", { class: "h3" }, "Records"),
      h("div", { class: "records" },
        fav ? rec("❤️", fav.name, `jeu préféré (${S.games[0].p} parties)`) : null,
        S.bestDay ? rec("📅", `${S.bestDay.n} parties`, `ton record en un jour (${new Date(S.bestDay.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })})`) : null,
        S.longest ? rec("🐢", dur(S.longest.dur), `plus longue partie (${(gameInfo(S.longest.game) || {}).name || ""})`) : null,
        S.fastestWin ? rec("⚡", dur(S.fastestWin.dur), `victoire la plus rapide (${(gameInfo(S.fastestWin.game) || {}).name || ""})`) : null,
        S.bigGain && S.bigGain.gems ? rec("💰", `+${S.bigGain.gems} gemmes`, "plus gros gain en une partie") : null,
        rec("🎲", `${S.games.length} / ${GAMES.length}`, "jeux essayés"),
        S.first ? rec("🐣", new Date(S.first.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }), "première partie") : null,
        rec("📆", fmt(S.activeDays), "jours où tu as joué")));

    const rivalsCard = rivals.length && !only && period === "all" ? h("div", { class: "card glass stack" }, h("div", { class: "h3" }, "Face à tes adversaires"),
      rivals.map((r) => h("div", { class: "row gap" },
        h("div", { class: "av", html: avatarHTML({ photo: r.avatar_url, avatar: r.equipped }, 42), style: { width: "42px", height: "42px", borderRadius: "50%", overflow: "hidden", flex: "0 0 42px" } }),
        h("div", { class: "grow" },
          h("div", { class: "row between" }, h("b", null, r.display_name), h("span", { class: "small dim" }, `${r.games} partie${r.games > 1 ? "s" : ""} ensemble`)),
          h("div", { class: "vs" }, h("i", { style: { width: pct(r.ahead, r.games) + "%", background: "var(--green)" } }), h("i", { style: { width: pct(r.games - r.ahead - r.behind, r.games) + "%", background: "var(--gold)" } }), h("i", { style: { width: pct(r.behind, r.games) + "%", background: "var(--red)" } })),
          h("div", { class: "small dim", style: { marginTop: "3px" } }, r.ahead > r.behind ? `Tu mènes ${r.ahead} à ${r.behind} 😎` : r.ahead < r.behind ? `${r.display_name} mène ${r.behind} à ${r.ahead} 😤` : `Égalité parfaite ${r.ahead} à ${r.behind} 🤝`))))) : null;

    const OUT = { win: ["🏆", "Victoire"], draw: ["🤝", "Égalité"], lose: ["💥", "Défaite"] };
    const history = h("div", { class: "card glass stack" }, h("div", { class: "h3" }, "Dernières parties"),
      rows.slice(-15).reverse().map((r) => {
        const info = gameInfo(r.game) || { name: r.game, icon: "jouer", color: "#6C5CE7" };
        return h("div", { class: "row gap" }, tile(info.icon, 34, info.color),
          h("div", { class: "grow" }, h("div", null, `${OUT[r.outcome][0]} ${info.name}`),
            h("div", { class: "small dim" }, [r.humans >= 2 ? (r.place ? `${r.place}e place entre amis` : "entre amis") : "solo", r.dur ? dur(r.dur) : null, ago(r.at)].filter(Boolean).join(" · "))),
          r.gems ? h("span", { class: "row", style: { gap: "3px", fontWeight: 800 } }, "+" + r.gems, gem(16)) : null);
      }));

    wrap.replaceChildren(head, kpis, donut, split, activity, habits, perGame, records, rivalsCard, history, h("div", { style: { height: "16px" } }));
  };
  draw();
}
