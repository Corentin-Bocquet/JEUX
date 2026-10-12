import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { PRODUITS, RAYONS, current, priceOf, euros, PM_TRIES, MAX_CENTS } from "../games/bonprix.js";

export const scoreOf = (s, id) => s.scores[id];
export const scoreLabel = (sc) => `${sc} pts`;

// saisie : "12,5" -> 1250 centimes
export function toCents(txt) {
  if (!txt) return null;
  const [e, d = ""] = txt.split(",");
  const c = Number(e || "0") * 100 + Number((d + "00").slice(0, 2));
  return Number.isFinite(c) && c >= 1 ? c : null;
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-bonprix" });
  root.append(el);
  let typed = "", round = 0, phase = "", nTries = 0, cardKey = "", cardEl = null;

  function update(ctx) {
    const s = ctx.state;
    const mine = s.g[ctx.me] || [];
    if (s.roundNo !== round || s.phase !== phase) {
      if (s.phase === "reveal") (s.win.includes(ctx.me) ? ctx.sfx.win() : ctx.sfx.card());
      else ctx.sfx.card();
      typed = "";
    } else if (mine.length !== nTries && mine.length) {
      const last = mine[mine.length - 1];
      last[1] === 0 ? ctx.sfx.ok() : ctx.sfx.tap();
      typed = "";
    }
    round = s.roundNo; phase = s.phase; nTries = mine.length;
    draw(ctx);
  }

  function draw(ctx) {
    const s = ctx.state;
    const p = PRODUITS[current(s)];
    const reveal = s.phase === "reveal";
    const head = h("div", { class: "g-bonprix-head" },
      h("span", { class: "chip" }, `Produit ${s.roundNo} / ${s.rounds}`),
      h("span", { class: "chip" }, s.jeu === "plusmoins" ? "↕️ Plus ou moins" : s.regle === "dessous" ? "⬇️ Sans dépasser" : "🎯 Au plus près"),
      h("span", { class: "chip" }, "⭐ ", h("b", null, s.scores[ctx.me] ?? 0)));
    const ck = s.roundNo + "|" + s.phase;
    const card = ck === cardKey && cardEl ? cardEl : h("div", { class: "g-bonprix-card" },
      h("div", { class: "g-bonprix-emo" }, p[1]),
      h("div", { class: "g-bonprix-name" }, p[0]),
      h("div", { class: "g-bonprix-desc" }, p[2]),
      h("div", { class: "g-bonprix-tag" }, RAYONS[p[4]]),
      reveal ? h("div", { class: "g-bonprix-price" }, euros(p[3])) : null);
    cardKey = ck; cardEl = card;
    el.replaceChildren(head, card, reveal ? revealZone(ctx) : playZone(ctx));
  }

  function revealZone(ctx) {
    const s = ctx.state;
    const price = priceOf(s);
    const rows = s.ids.map((id) => {
      if (s.jeu === "offre") {
        const b = s.bids[id];
        const over = b != null && b > price;
        const ecart = b == null ? null : Math.round(((b - price) / price) * 100);
        return { id, sort: b == null ? 1e12 : s.regle === "dessous" && over ? 1e9 + b - price : Math.abs(b - price),
          main: b == null ? "pas d'offre" : euros(b),
          sub: b == null ? "" : over && s.regle === "dessous" ? "Trop cher !" : ecart === 0 ? "Pile !" : `${ecart > 0 ? "+" : ""}${ecart} %` };
      }
      const g = s.g[id];
      return { id, sort: s.st[id] === "found" ? g.length : 1e6, main: s.st[id] === "found" ? `trouvé en ${g.length}` : "pas trouvé", sub: g.length ? euros(g[g.length - 1][0]) : "" };
    }).sort((a, b) => a.sort - b.sort);
    const ready = s.ready.includes(ctx.me);
    const msg = s.win.includes(ctx.me) ? `Bravo, +${s.pts[ctx.me]} points !` : s.win.length ? `Manche pour ${s.win.map((id) => nameOf(ctx, id)).join(" et ")}` : "Personne ne remporte la manche.";
    return h("div", { class: "g-bonprix-zone" },
      h("div", { class: "turnmsg " + (s.win.includes(ctx.me) ? "me" : "") }, msg),
      h("div", { class: "g-bonprix-list" }, rows.map((r) => h("div", { class: "g-bonprix-row" + (s.win.includes(r.id) ? " win" : "") + (r.id === ctx.me ? " me" : "") },
        h("span", { class: "g-bonprix-who" }, s.win.includes(r.id) ? "🏆 " : "", nameOf(ctx, r.id)),
        h("b", null, r.main), h("small", null, r.sub), h("i", null, s.pts[r.id] ? `+${s.pts[r.id]}` : "")))),
      ready ? h("div", { class: "small dim center" }, "On attend les autres…")
        : h("button", { class: "btn green block", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "next" }); } }, s.roundNo >= s.rounds ? "Voir le classement" : "Produit suivant"));
  }

  function playZone(ctx) {
    const s = ctx.state;
    const st = s.st[ctx.me];
    const z = h("div", { class: "g-bonprix-zone" });
    const mine = s.g[ctx.me] || [];
    if (s.jeu === "plusmoins" && mine.length) {
      z.append(h("div", { class: "g-bonprix-tries" }, mine.map(([c, d]) => h("span", { class: "g-bonprix-try " + (d === 1 ? "up" : d === -1 ? "down" : "ok") },
        euros(c), " ", d === 1 ? "⬆️ plus" : d === -1 ? "⬇️ moins" : "✅"))));
    }
    if (st !== "playing") {
      const txt = s.jeu === "offre" ? (s.bids[ctx.me] != null ? `Ton offre : ${euros(s.bids[ctx.me])}. On attend les autres…` : "Tu as passé. On attend les autres…")
        : st === "found" ? `Trouvé ! +${s.pts[ctx.me]} points. On attend les autres…` : "Plus d'essai. On attend les autres…";
      z.append(h("div", { class: "turnmsg " + (st === "found" || s.bids[ctx.me] != null ? "me" : "") }, txt));
    } else {
      const last = mine[mine.length - 1];
      z.append(h("div", { class: "turnmsg me" }, s.jeu === "offre" ? "Combien ça coûte ?"
        : last ? (last[1] === 1 ? "C'est plus ! ⬆️" : "C'est moins ! ⬇️") : "Combien ça coûte ?"),
        s.jeu === "plusmoins" ? h("div", { class: "small dim center" }, `${PM_TRIES - mine.length} essai${PM_TRIES - mine.length > 1 ? "s" : ""} restant${PM_TRIES - mine.length > 1 ? "s" : ""}`) : null,
        h("div", { class: "g-bonprix-screen" + (typed ? "" : " empty") }, typed ? typed + " €" : "0 €"),
        pad(ctx));
    }
    z.append(h("div", { class: "g-bonprix-others" }, s.ids.filter((id) => id !== ctx.me).map((id) => h("span", { class: "g-bonprix-pl " + s.st[id] },
      nameOf(ctx, id), " ", s.st[id] === "playing" ? (s.jeu === "plusmoins" && s.g[id].length ? `· ${s.g[id].length} essai${s.g[id].length > 1 ? "s" : ""}` : "💭") : s.st[id] === "out" ? "❌" : "✅"))));
    return z;
  }

  function pad(ctx) {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];
    const cents = toCents(typed);
    return h("div", { class: "g-bonprix-padwrap" },
      h("div", { class: "g-bonprix-pad" }, keys.map((k) => h("button", { class: "g-bonprix-key" + (k === "⌫" ? " del" : ""), "aria-label": k === "⌫" ? "Effacer" : k, onclick: () => press(ctx, k) }, k))),
      h("div", { class: "row gap" },
        h("button", { class: "btn ghost small", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "pass" }); } }, "Je passe"),
        h("button", { class: "btn green grow", disabled: !cents, onclick: () => send(ctx) }, cents ? `Valider ${euros(cents)}` : "Valider")));
  }

  function press(ctx, k) {
    if (ctx.state.phase !== "play" || ctx.state.st[ctx.me] !== "playing") return;
    if (k === "⌫") typed = typed.slice(0, -1);
    else if (k === ",") { if (!typed.includes(",")) typed = (typed || "0") + ","; }
    else {
      const dec = typed.split(",")[1];
      if (dec != null && dec.length >= 2) return;
      if (!typed.includes(",") && typed.replace(",", "").length >= 6) return;
      typed = typed === "0" ? k : typed + k;
    }
    ctx.sfx.tap();
    draw(ctx);
  }
  function send(ctx) {
    const c = toCents(typed);
    if (!c || c > MAX_CENTS) { ctx.toast("Indique un prix", "err"); return; }
    ctx.act({ type: "bid", cents: c });
  }

  const key = (e) => {
    const c = el._ctx;
    if (!c || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".sheet-wrap")) return;
    if (/^[0-9]$/.test(e.key)) press(c, e.key);
    else if (e.key === "," || e.key === ".") press(c, ",");
    else if (e.key === "Backspace") press(c, "⌫");
    else if (e.key === "Enter" && c.state.phase === "play" && c.state.st[c.me] === "playing") send(c);
  };
  window.addEventListener("keydown", key);
  const up = (ctx) => { el._ctx = ctx; update(ctx); };
  up(ctx0);
  return { update: up, destroy() { window.removeEventListener("keydown", key); } };
}
