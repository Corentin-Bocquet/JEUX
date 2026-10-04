import { h, fmt } from "../ui.js";
import { turnLine, nameOf, dieHTML } from "./common.js";
import { BOARD, GROUPS, GROUP_CELLS, SURPRISE, SORT, PAWNS } from "../data/empire_plateau.js";
import {
  toAct, curId, worth, liquid, rentOf, houseCost, mortVal, unmortCost, propsOf, ownsAll,
  canBuild, canSell, canMortgage, canUnmortgage, tradable, active,
} from "../games/empire.js";

export const scoreOf = (s, id) => worth(s, id);
export const scoreLabel = (v) => fmt(v) + " €";

const eur = (v) => fmt(v) + " €";
const ICON = { go: "➜", sort: "📜", surprise: "❓", tax: "💰", station: "🚂", jail: "🔒", parc: "🌳", police: "👮" };
// coordonnées sur une grille 11 x 11 (case 0 en bas à droite, sens horaire inverse)
function pos(i) {
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [11 - (i - 10), 1];
  if (i <= 30) return [1, 1 + (i - 20)];
  return [1 + (i - 30), 11];
}
const side = (i) => (i % 10 === 0 ? "corner" : i < 10 ? "b" : i < 20 ? "l" : i < 30 ? "t" : "r");

export function mount(root, ctx0) {
  const el = h("div", { class: "g-empire" });
  root.append(el);
  let focus = null, focusKey = "", view = null, trade = null, bid = 0, bidKey = "", lastDice = "", lastCash = null;
  let ctx = ctx0;

  function update(c) {
    ctx = c;
    const s = ctx.state;
    const key = `${curId(s)}:${s.P[curId(s)].pos}:${s.phase}`;
    if (key !== focusKey) { focus = null; focusKey = key; }
    const dk = s.dice.join("") + ":" + s.log.length + ":" + (s.log.length ? s.log[s.log.length - 1].m : "");
    if (s.dice[0] && dk !== lastDice && lastDice) ctx.sfx.dice();
    lastDice = dk;
    const me = s.P[ctx.me];
    if (me && lastCash != null && me.cash > lastCash) ctx.sfx.coin();
    lastCash = me ? me.cash : null;
    if (s.phase !== "roll" && s.phase !== "end") trade = null;
    draw();
  }

  const colorOf = (s, id) => PAWNS[s.order.indexOf(id) % PAWNS.length];

  function cellEl(s, i, cur) {
    const c = BOARD[i], [r, col] = pos(i);
    const o = s.own[i];
    const cls = ["g-empire-cell", "s-" + side(i)];
    if (i === focus) cls.push("focus");
    if (i === s.P[cur].pos) cls.push("here");
    if (s.mg[i]) cls.push("mort");
    const pawns = s.order.filter((id) => !s.P[id].out && s.P[id].pos === i)
      .map((id) => h("i", { class: "g-empire-pawn" + (id === cur ? " cur" : ""), style: { background: colorOf(s, id) } }));
    const hs = s.hs[i];
    return h("button", {
      class: cls.join(" "), style: { gridRow: r, gridColumn: col, ...(o ? { "--own": colorOf(s, o) } : {}) },
      "aria-label": c.n, onclick: () => { focus = focus === i ? null : i; ctx.sfx.tap(); draw(); },
    },
    c.k === "prop" ? h("span", { class: "g-empire-band", style: { background: GROUPS[c.g].color } },
      hs === 5 ? h("b", { class: "g-empire-hotel" }) : Array.from({ length: hs }, () => h("b", { class: "g-empire-house" }))) : null,
    c.k !== "prop" ? h("span", { class: "g-empire-ico" }, c.ic || ICON[c.k] || "") : null,
    o ? h("span", { class: "g-empire-owner" }) : null,
    pawns.length ? h("span", { class: "g-empire-pawns" }, pawns) : null);
  }

  function rentRows(s, i) {
    const c = BOARD[i];
    if (c.k === "prop") {
      const labels = ["Terrain nu", "1 maison", "2 maisons", "3 maisons", "4 maisons", "Hôtel"];
      return h("div", { class: "g-empire-rents" },
        c.r.map((v, k) => h("div", { class: s.own[i] && s.hs[i] === k && !(k === 0 && ownsAll(s, s.own[i], c.g)) ? "on" : "" }, h("span", null, labels[k]), h("b", null, eur(v)))),
        h("div", { class: s.own[i] && !s.hs[i] && ownsAll(s, s.own[i], c.g) ? "on" : "" }, h("span", null, "Groupe complet"), h("b", null, eur(c.r[0] * 2))),
        h("div", { class: "dim" }, h("span", null, "Maison"), h("b", null, eur(houseCost(i)))));
    }
    if (c.k === "station") return h("div", { class: "g-empire-rents" }, [1, 2, 3, 4].map((n) => h("div", null, h("span", null, `${n} gare${n > 1 ? "s" : ""}`), h("b", null, eur(25 * 2 ** (n - 1))))));
    if (c.k === "util") return h("div", { class: "g-empire-rents" }, h("div", null, h("span", null, "1 compagnie"), h("b", null, "4 × les dés")), h("div", null, h("span", null, "Les 2"), h("b", null, "10 × les dés")));
    return null;
  }
  const SPECIAL = {
    go: "Passe ou t'arrête ici : reçois 200 €.",
    sort: "Tire une carte Coup du sort.",
    surprise: "Tire une carte Surprise.",
    jail: "Simple visite… sauf si tu es enfermé.",
    police: "Direction la prison, sans passer par Départ !",
  };

  function fiche(s, i, big) {
    const c = BOARD[i], o = s.own[i];
    const color = c.g ? GROUPS[c.g].color : "#475569";
    let desc = SPECIAL[c.k] || "";
    if (c.k === "tax") desc = `Paie ${eur(c.v)}${s.parc ? " (à la cagnotte du parc)" : ""}.`;
    if (c.k === "parc") desc = s.parc ? `Cagnotte : ${eur(s.pot)}. Arrête-toi ici pour tout rafler !` : "Repos bien mérité.";
    return h("div", { class: "g-empire-fiche" + (big ? " big" : "") + (s.mg[i] ? " mort" : "") },
      h("div", { class: "g-empire-fhead", style: { background: color } },
        h("span", null, c.ic || ICON[c.k] || ""), h("b", null, c.n)),
      h("div", { class: "g-empire-fbody" },
        c.p ? h("div", { class: "g-empire-fline" }, h("span", null, o ? "À " + nameOf(ctx, o) : "À vendre"), h("b", null, eur(c.p))) : null,
        s.mg[i] ? h("div", { class: "g-empire-tag red" }, "Hypothéquée") : null,
        o && c.k === "prop" && s.hs[i] ? h("div", { class: "g-empire-tag" }, s.hs[i] === 5 ? "🏨 Hôtel" : `🏠 × ${s.hs[i]}`) : null,
        o && !s.mg[i] && c.k !== "util" ? h("div", { class: "g-empire-fline gold" }, h("span", null, "Loyer actuel"), h("b", null, eur(rentOf(s, i, 7)))) : null,
        rentRows(s, i),
        desc ? h("p", { class: "g-empire-desc" }, desc) : null));
  }

  function center(s, cur) {
    const fi = focus != null ? focus : s.P[cur].pos;
    const card = s.card ? (s.card.d === "s" ? SURPRISE : SORT)[s.card.i] : null;
    return h("div", { class: "g-empire-center" },
      h("div", { class: "g-empire-ctop" },
        h("span", { class: "chip" }, `Tour ${s.tour}/${s.maxT}`),
        s.parc ? h("span", { class: "chip" }, "🌳 " + eur(s.pot)) : null),
      fiche(s, fi, false),
      h("div", { class: "g-empire-cbot" },
        s.dice[0] ? h("div", { class: "g-empire-dice", html: dieHTML(s.dice[0]) + dieHTML(s.dice[1]) }) : null,
        card ? h("div", { class: "g-empire-card " + (s.card.d === "s" ? "s" : "c") }, h("b", null, s.card.d === "s" ? "Surprise" : "Coup du sort"), card.t) : null));
  }

  function act(a) { ctx.sfx.tap(); ctx.act(a); }

  function actions(s, cur, mine) {
    const p = s.P[ctx.me];
    const out = [];
    if (s.phase === "auction") {
      const i = s.auction.cell;
      const done = ctx.me in s.auction.bids;
      out.push(h("div", { class: "g-empire-info" }, `🔨 Enchère cachée pour ${BOARD[i].n} (prix ${eur(BOARD[i].p)})`),
        h("div", { class: "g-empire-bidders" }, active(s).map((id) => h("span", { class: "chip" + (id in s.auction.bids ? " on" : "") }, (id in s.auction.bids ? "✓ " : "… ") + nameOf(ctx, id)))));
      if (p && !p.out && !done) {
        const k = s.seq + ":" + i;
        if (k !== bidKey) { bidKey = k; bid = Math.min(p.cash, Math.floor(BOARD[i].p / 20) * 10); }
        const set = (v) => { bid = Math.max(0, Math.min(p.cash, v)); ctx.sfx.tap(); draw(); };
        out.push(h("div", { class: "g-empire-stepper" },
          h("button", { class: "btn small ghost", onclick: () => set(bid - 50) }, "−50"),
          h("button", { class: "btn small ghost", onclick: () => set(bid - 10) }, "−10"),
          h("b", null, eur(bid)),
          h("button", { class: "btn small ghost", onclick: () => set(bid + 10) }, "+10"),
          h("button", { class: "btn small ghost", onclick: () => set(bid + 50) }, "+50")),
        h("div", { class: "g-empire-btns" },
          h("button", { class: "btn gold", disabled: bid <= 0, onclick: () => act({ type: "bid", amount: bid }) }, `Miser ${eur(bid)}`),
          h("button", { class: "btn ghost", onclick: () => act({ type: "bid", amount: 0 }) }, "Passer")));
      } else if (done) out.push(h("p", { class: "small dim center" }, "Mise envoyée, on attend les autres…"));
      return out;
    }
    if (s.phase === "trade") {
      const t = s.trade, sellerIsFrom = s.own[t.cell] === t.from;
      const txt = sellerIsFrom ? `${nameOf(ctx, t.from)} te propose ${BOARD[t.cell].n} pour ${eur(t.cash)}` : `${nameOf(ctx, t.from)} veut t'acheter ${BOARD[t.cell].n} pour ${eur(t.cash)}`;
      if (t.to === ctx.me) {
        out.push(h("div", { class: "g-empire-info" }, "🤝 " + txt), fiche(s, t.cell, true),
          h("div", { class: "g-empire-btns" },
            h("button", { class: "btn green", disabled: sellerIsFrom && p.cash < t.cash, onclick: () => { ctx.sfx.ok(); ctx.act({ type: "accept" }); } }, "Accepter"),
            h("button", { class: "btn red", onclick: () => act({ type: "refuse" }) }, "Refuser")));
      } else out.push(h("div", { class: "g-empire-info" }, `🤝 ${nameOf(ctx, t.from)} propose un échange à ${nameOf(ctx, t.to)}…`));
      return out;
    }
    if (!mine) {
      out.push(h("p", { class: "small dim center" }, `${nameOf(ctx, cur)} joue (${s.P[cur].cash != null ? eur(s.P[cur].cash) : ""})`));
      return out;
    }
    if (s.phase === "debt") {
      const d = s.debt, miss = d.amt - p.cash;
      const to = d.to === "pot" || d.to === "bank" ? "la banque" : d.to === "each" ? "les autres joueurs" : nameOf(ctx, d.to);
      const can = liquid(s, ctx.me) >= d.amt;
      out.push(h("div", { class: "g-empire-info red" }, `💸 Tu dois ${eur(d.amt)} à ${to}.`, miss > 0 ? ` Il te manque ${eur(miss)} : vends ou hypothèque.` : ""),
        h("div", { class: "g-empire-btns" },
          h("button", { class: "btn green", disabled: miss > 0, onclick: () => { ctx.sfx.coin(); ctx.act({ type: "pay" }); } }, "Payer"),
          can ? h("button", { class: "btn gold", onclick: () => act({ type: "settle" }) }, "Vendre auto et payer")
            : h("button", { class: "btn red", onclick: () => act({ type: "bankrupt" }) }, "Faire faillite")));
      return out;
    }
    if (s.phase === "buy") {
      const i = p.pos, c = BOARD[i];
      out.push(h("div", { class: "g-empire-btns" },
        h("button", { class: "btn green", disabled: p.cash < c.p, onclick: () => { ctx.sfx.coin(); ctx.act({ type: "buy" }); } }, `Acheter ${eur(c.p)}`),
        h("button", { class: "btn ghost", onclick: () => act({ type: "pass" }) }, s.auc ? "Aux enchères" : "Ne pas acheter")));
      return out;
    }
    if (s.phase === "roll") {
      if (p.jail) {
        out.push(h("div", { class: "g-empire-info" }, `🔒 En prison (essai ${p.jail}/3)`),
          h("div", { class: "g-empire-btns" },
            h("button", { class: "btn green", onclick: () => act({ type: "roll" }) }, "Tenter un double"),
            h("button", { class: "btn gold", disabled: p.cash < 50, onclick: () => act({ type: "payJail" }) }, "Payer 50 €"),
            p.cards.length ? h("button", { class: "btn purple", onclick: () => act({ type: "useCard" }) }, "Carte libéré") : null));
      } else out.push(h("div", { class: "g-empire-btns" }, h("button", { class: "btn green", onclick: () => act({ type: "roll" }) }, s.again ? "Double ! Relance 🎲" : "Lancer les dés 🎲")));
    }
    if (s.phase === "end") out.push(h("div", { class: "g-empire-btns" }, h("button", { class: "btn green", onclick: () => act({ type: "end" }) }, "Terminer mon tour")));
    if ((s.phase === "roll" || s.phase === "end") && s.tradeN < 3) {
      out.push(trade ? tradePanel(s) : h("button", { class: "btn ghost small block g-empire-tradebtn", onclick: () => { trade = { to: null, cell: null, cash: 0 }; draw(); } }, "🤝 Proposer un échange"));
    }
    return out;
  }

  function tradePanel(s) {
    const others = active(s).filter((id) => id !== ctx.me);
    if (!trade.to || !others.includes(trade.to)) trade.to = others[0];
    const to = trade.to;
    const cells = [...propsOf(s, ctx.me), ...propsOf(s, to)].filter((i) => tradable(s, i));
    if (trade.cell != null && !cells.includes(trade.cell)) trade.cell = null;
    const i = trade.cell;
    const selling = i != null && s.own[i] === ctx.me;
    const payerCash = i == null ? 0 : selling ? s.P[to].cash : s.P[ctx.me].cash;
    const set = (v) => { trade.cash = Math.max(0, Math.min(payerCash, v)); ctx.sfx.tap(); draw(); };
    return h("div", { class: "g-empire-trade glass" },
      h("div", { class: "row gap g-empire-tr-head" }, h("b", null, "Échange avec"),
        others.map((id) => h("button", { class: "chip" + (id === to ? " on" : ""), onclick: () => { trade.to = id; trade.cell = null; draw(); } }, nameOf(ctx, id)))),
      cells.length ? h("div", { class: "g-empire-tr-list" }, cells.map((c) => h("button", {
        class: "g-empire-mini" + (c === i ? " on" : ""), style: { "--gc": GROUPS[BOARD[c].g].color },
        onclick: () => { trade.cell = c; trade.cash = Math.min(s.own[c] === ctx.me ? s.P[to].cash : s.P[ctx.me].cash, BOARD[c].p); draw(); },
      }, h("i", null), h("span", null, BOARD[c].n), h("small", null, s.own[c] === ctx.me ? "Vendre" : "Acheter")))) : h("p", { class: "small dim" }, "Aucune rue échangeable."),
      i != null ? h("div", null,
        h("p", { class: "small center" }, selling ? `Tu vends ${BOARD[i].n} à ${nameOf(ctx, to)} pour :` : `Tu achètes ${BOARD[i].n} à ${nameOf(ctx, to)} pour :`),
        h("div", { class: "g-empire-stepper" },
          h("button", { class: "btn small ghost", onclick: () => set(trade.cash - 50) }, "−50"),
          h("button", { class: "btn small ghost", onclick: () => set(trade.cash - 10) }, "−10"),
          h("b", null, eur(trade.cash)),
          h("button", { class: "btn small ghost", onclick: () => set(trade.cash + 10) }, "+10"),
          h("button", { class: "btn small ghost", onclick: () => set(trade.cash + 50) }, "+50"))) : null,
      h("div", { class: "g-empire-btns" },
        h("button", { class: "btn purple", disabled: i == null, onclick: () => { const a = { type: "offer", to, cell: i, cash: trade.cash }; trade = null; act(a); } }, "Envoyer"),
        h("button", { class: "btn ghost", onclick: () => { trade = null; draw(); } }, "Annuler")));
  }

  function titles(s, who, canAct) {
    const list = propsOf(s, who);
    if (!list.length) return h("p", { class: "small dim center" }, "Aucune propriété pour l'instant.");
    const sellOnly = s.phase === "debt";
    return h("div", { class: "g-empire-titles" }, list.map((i) => {
      const c = BOARD[i];
      const btns = [];
      if (canAct) {
        if (!sellOnly && canBuild(s, who, i)) btns.push(h("button", { class: "btn small green", onclick: () => act({ type: "build", cell: i }) }, `+🏠 ${houseCost(i)}`));
        if (canSell(s, who, i)) btns.push(h("button", { class: "btn small ghost", onclick: () => act({ type: "sell", cell: i }) }, `−🏠 +${houseCost(i) / 2}`));
        if (canMortgage(s, who, i)) btns.push(h("button", { class: "btn small ghost", onclick: () => act({ type: "mortgage", cell: i }) }, `Hypo. +${mortVal(i)}`));
        if (!sellOnly && s.mg[i]) btns.push(h("button", { class: "btn small gold", disabled: !canUnmortgage(s, who, i), onclick: () => act({ type: "unmortgage", cell: i }) }, `Lever ${unmortCost(i)}`));
      }
      return h("div", { class: "g-empire-title" + (s.mg[i] ? " mort" : "") + (c.g && ownsAll(s, who, c.g) ? " full" : ""), style: { "--gc": GROUPS[c.g].color } },
        h("button", { class: "g-empire-tname", onclick: () => { focus = i; ctx.sfx.tap(); draw(); } },
          h("span", null, c.ic || (c.k === "station" ? "🚂" : "")), h("b", null, c.n),
          h("small", null, s.mg[i] ? "Hypothéquée" : s.hs[i] === 5 ? "🏨 Hôtel" : s.hs[i] ? "🏠".repeat(s.hs[i]) : `Loyer ${eur(rentOf(s, i, 7))}`)),
        btns.length ? h("div", { class: "g-empire-tbtns" }, btns) : null);
    }));
  }

  function draw() {
    const s = ctx.state;
    const cur = curId(s);
    const who = toAct(s);
    const mine = cur === ctx.me && who.includes(ctx.me);
    if (!view || !s.P[view]) view = s.P[ctx.me] ? ctx.me : s.order[0];
    const board = h("div", { class: "g-empire-board" }, BOARD.map((_, i) => cellEl(s, i, cur)), center(s, cur));
    const players = h("div", { class: "g-empire-players" }, s.order.map((id) => {
      const p = s.P[id];
      return h("button", {
        class: "g-empire-pl" + (id === cur && !s.over ? " cur" : "") + (p.out ? " out" : "") + (id === view ? " on" : ""),
        style: { "--pc": colorOf(s, id) }, onclick: () => { view = id; ctx.sfx.tap(); draw(); },
      }, h("i", { class: "g-empire-pawn" }), h("span", null, nameOf(ctx, id), p.jail ? " 🔒" : "", p.cards.length ? " 🎟️" : ""),
      h("b", null, p.out ? "Faillite" : eur(p.cash)));
    }));
    let msg = "À toi de jouer !";
    const p = s.P[ctx.me];
    if (p) {
      if (s.phase === "roll") msg = p.jail ? "À toi : sors de prison ou tente un double" : s.again ? "Double ! Relance les dés" : "À toi : lance les dés";
      else if (s.phase === "buy") msg = `À toi : achète ${BOARD[p.pos].n} ?`;
      else if (s.phase === "end") msg = "Bâtis, échange, puis termine ton tour";
      else if (s.phase === "debt") msg = "Règle ta dette";
      else if (s.phase === "auction") msg = "Enchère : fais ta mise cachée";
      else if (s.phase === "trade") msg = "On te propose un échange";
    }
    const canAct = view === ctx.me && mine && ["roll", "end", "debt"].includes(s.phase);
    el.replaceChildren(
      turnLine(ctx, who, msg),
      players,
      board,
      h("div", { class: "g-empire-actions" }, actions(s, cur, mine)),
      h("div", { class: "g-empire-sec" },
        h("h3", { class: "h3" }, view === ctx.me ? "Mes titres" : "Titres de " + nameOf(ctx, view),
          h("small", { class: "dim" }, " · fortune " + eur(worth(s, view)))),
        titles(s, view, canAct)),
      h("div", { class: "g-empire-log" }, s.log.slice().reverse().map((l, k) => h("div", { class: k ? "dim" : "" },
        h("i", { class: "g-empire-dot", style: { background: colorOf(s, l.p) } }), h("b", null, nameOf(ctx, l.p)), " ", l.q ? l.m.replace("@", nameOf(ctx, l.q)) : l.m))));
  }

  update(ctx0);
  return { update, destroy() { el.remove(); } };
}
