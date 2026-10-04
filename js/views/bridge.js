import { h } from "../ui.js";
import { cardHTML, feltStyle } from "./common.js";
import { SUIT_SYM, suitOf, label } from "../games/cards.js";
import {
  toAct, controller, legal, legalCalls, lastBid, isBid, callLabel, contractLabel, vulOf, sortHand,
  SEAT_NAME, SEAT_SHORT, STRAINS, STRAIN_SYM, TEAM_NAME, teamOf, partnerOf,
} from "../games/bridge.js";
import { isVirtual } from "../games/lib/plis_tb.js";

const teamIdx = (s, id) => teamOf(Math.max(0, s.seats.indexOf(id)));
export const scoreOf = (s, id) => String(s.team[teamIdx(s, id)]);
export const scoreLabel = (v) => `${v} pts`;
const nm = (ctx, s, seat) => {
  const id = s.seats[seat];
  if (id === ctx.me) return "Toi";
  return isVirtual(id) ? "Robot " + SEAT_NAME[seat] : ctx.players[id] ? ctx.players[id].name : SEAT_NAME[seat];
};
const red = (su) => su === "H" || su === "D";

export function mount(root, ctx0) {
  const el = h("div", { class: "g-bridge" });
  root.append(el);
  let level = 0, seenBoard = ctx0.state.last ? ctx0.state.last.board : 0, banner = null, bannerT = null, lastN = -1;
  function update(ctx) {
    const s = ctx.state;
    const who = toAct(s);
    const mine = who.includes(ctx.me);
    const me = Math.max(0, s.seats.indexOf(ctx.me));
    const k = s.contract;
    const dummy = k ? partnerOf(k.decl) : -1;
    const n = s.played * 4 + s.trick.length;
    if (n !== lastN && s.phase === "play" && s.trick.length) ctx.sfx.card();
    lastN = n;
    if (s.last && s.last.board !== seenBoard) {
      seenBoard = s.last.board;
      banner = s.last;
      level = 0;
      banner.pts[teamOf(me)] > 0 ? ctx.sfx.coin() : ctx.sfx.tap();
      clearTimeout(bannerT);
      if (!s.over) bannerT = setTimeout(() => { banner = null; update(ctx); }, 5500);
    }
    const vul = vulOf(s, s.board);
    const myTeam = teamOf(me);

    // ---- tableau de marque
    const score = h("div", { class: "g-bridge-score" },
      [myTeam, 1 - myTeam].map((t) => h("div", { class: "g-bridge-team" + (t === myTeam ? " mine" : "") },
        h("span", null, TEAM_NAME[t], vul[t] ? h("i", { class: "g-bridge-vul" }, "vuln.") : null),
        h("b", null, s.team[t]),
        s.phase === "play" ? h("small", null, `${s.tricks[t]} levée${s.tricks[t] > 1 ? "s" : ""}`) : null)),
      h("div", { class: "g-bridge-board" }, h("small", null, `Donne ${s.board}/${s.total}`),
        k ? h("b", { class: red(k.strain) ? "red" : "" }, contractLabel(k)) : h("b", null, "Enchères"),
        k ? h("small", null, `par ${nm(ctx, s, k.decl)}`) : null));

    // ---- table : moi en bas, partenaire en haut
    const pos = ["bottom", "left", "top", "right"];
    const showTrick = s.trick.length ? s.trick : s.lastTrick && s.phase === "play" ? s.lastTrick.cards : [];
    const win = s.trick.length ? null : s.lastTrick ? s.lastTrick.win : null;
    const table = h("div", { class: "felt g-bridge-table", style: feltStyle(ctx.skin.table) });
    for (let r = 0; r < 4; r++) {
      const seat = (me + r) % 4;
      const turn = !s.over && s.cur === seat;
      table.append(h("div", { class: `g-bridge-seat ${pos[r]}` + (turn ? " turn" : "") },
        h("b", null, nm(ctx, s, seat)),
        h("small", null, SEAT_NAME[seat], s.dealer === seat && s.phase === "bid" ? " · donne" : "",
          k && seat === k.decl ? " · déclarant" : "", k && seat === dummy ? " · mort" : "")));
      const t = showTrick.find((x) => x.p === seat);
      if (t) table.append(h("div", { class: `g-bridge-played ${pos[r]}` + (win === seat ? " win" : ""), html: cardHTML(t.c) }));
    }
    if (banner) table.append(bannerView(ctx, s, banner));
    else if (s.phase === "bid") table.append(auctionView(ctx, s));

    // ---- le mort
    let dummyBox = null;
    if (k && s.phase === "play" && s.dummyShown && dummy !== me) {
      const iPlay = mine && s.cur === dummy;
      const ok = iPlay ? legal(s, dummy) : [];
      dummyBox = h("div", { class: "g-bridge-dummy card glass" },
        h("div", { class: "small dim" }, `Le mort : ${nm(ctx, s, dummy)}`, iPlay ? h("b", { class: "g-bridge-go" }, " · joue pour lui") : ""),
        ["S", "H", "C", "D"].map((su) => h("div", { class: "g-bridge-suit" },
          h("span", { class: "g-bridge-sym" + (red(su) ? " red" : "") }, SUIT_SYM[su]),
          s.hands[dummy].filter((c) => suitOf(c) === su).map((c) => h("button", { class: "g-bridge-chip" + (red(su) ? " red" : "") + (ok.includes(c) ? " ok" : ""),
            disabled: !ok.includes(c), "aria-label": label(c), onclick: () => ctx.act({ type: "play", card: c }) }, label(c).slice(0, -1))))));
    }

    // ---- boîte d'enchères
    let box = null, hint = "À toi de jouer : choisis une carte";
    if (mine && s.phase === "bid") {
      hint = "À toi d'annoncer";
      const L = legalCalls(s, me);
      const lb = lastBid(s);
      const minLvl = lb ? +lb.bid[0] + (lb.bid[1] === "N" ? 1 : 0) : 1;
      if (level && level < minLvl) level = 0;
      box = h("div", { class: "g-bridge-box" },
        h("div", { class: "g-bridge-levels" }, [1, 2, 3, 4, 5, 6, 7].map((l) => h("button", { class: "g-bridge-lvl" + (level === l ? " on" : ""), disabled: l < minLvl,
          onclick: () => { level = level === l ? 0 : l; ctx.sfx.tap(); update(ctx); } }, l))),
        h("div", { class: "g-bridge-strains" }, STRAINS.map((st) => h("button", { class: "g-bridge-str" + (red(st) ? " red" : ""), disabled: !level || !L.includes(level + st),
          onclick: () => { ctx.sfx.ok(); ctx.act({ type: "call", call: level + st }); level = 0; } }, level ? `${level} ${STRAIN_SYM[st]}` : STRAIN_SYM[st]))),
        h("div", { class: "g-bridge-calls" },
          h("button", { class: "btn green", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "call", call: "P" }); level = 0; } }, "Passe"),
          s.contre ? h("button", { class: "btn red", disabled: !L.includes("X"), onclick: () => ctx.act({ type: "call", call: "X" }) }, "Contre") : null,
          s.contre ? h("button", { class: "btn purple", disabled: !L.includes("XX"), onclick: () => ctx.act({ type: "call", call: "XX" }) }, "Surcontre") : null));
    } else if (mine && k && s.cur === dummy) hint = "Joue une carte du mort";

    // ---- ma main
    const hand = sortHand(s.hands[me] || []);
    const iPlayMine = mine && s.phase === "play" && s.cur === me;
    const ok = iPlayMine ? legal(s, me) : [];
    const myHand = h("div", { class: "g-bridge-hand" }, hand.map((c) => h("button", { class: "hcard", disabled: !ok.includes(c), "aria-label": label(c),
      html: cardHTML(c, { playable: ok.includes(c), dim: iPlayMine && !ok.includes(c) }), onclick: () => ctx.act({ type: "play", card: c }) })));
    let line;
    if (mine) line = h("div", { class: "turnmsg me" }, hint);
    else if (s.over) line = h("div", { class: "turnmsg" }, "Partie terminée");
    else if (k && me === dummy) line = h("div", { class: "turnmsg" }, `Tu es le mort : ${nm(ctx, s, k.decl)} joue tes cartes`);
    else line = h("div", { class: "turnmsg" }, `${nm(ctx, s, controller(s))} réfléchit…`);
    el.replaceChildren(score, table, line, box, dummyBox, myHand);
  }
  update(ctx0);
  return { update, destroy() { clearTimeout(bannerT); } };
}

function auctionView(ctx, s) {
  const cells = [];
  for (let i = 0; i < s.dealer; i++) cells.push(h("span", { class: "g-bridge-cell" }, ""));
  s.auction.forEach((c) => cells.push(h("span", { class: "g-bridge-cell" + (isBid(c) && red(c[1]) ? " red" : "") + (c === "P" ? " dim" : "") }, c === "P" ? "Passe" : c === "X" ? "X" : c === "XX" ? "XX" : `${c[0]}${STRAIN_SYM[c[1]]}`)));
  cells.push(h("span", { class: "g-bridge-cell next" }, "?"));
  return h("div", { class: "g-bridge-auction" },
    SEAT_SHORT.map((x, i) => h("span", { class: "g-bridge-head" }, x === "N" ? "Nord" : SEAT_NAME[i])),
    cells.slice(Math.max(0, Math.floor((cells.length - 1) / 4) * 4 - 12)));
}

function bannerView(ctx, s, b) {
  const k = b.contract;
  return h("div", { class: "g-bridge-banner" },
    k ? h("b", { class: b.made >= 0 ? "ok" : "ko" }, `${contractLabel(k)} ${b.made > 0 ? "+" + b.made : b.made === 0 ? "=" : b.made}`) : h("b", null, "Donne passée"),
    k ? h("div", { class: "small" }, `${nm(ctx, s, k.decl)} (${SEAT_NAME[k.decl]}) : ${b.tricks} levées`) : null,
    h("div", { class: "small" }, b.pts[0] ? `+${b.pts[0]} ${TEAM_NAME[0]}` : b.pts[1] ? `+${b.pts[1]} ${TEAM_NAME[1]}` : "0 point"));
}
