// Empire immobilier : achat de rues, loyers, maisons et hôtels, hypothèques, prison, faillite.
// Logique pure, sans DOM.
import { fail, rankByScore, rng as mkRng } from "../engine.js";
import { BOARD, GROUPS, GROUP_CELLS, SURPRISE, SORT, SALARY, JAIL_FEE, STATIONS } from "../data/empire_plateau.js";

export { BOARD, GROUPS, GROUP_CELLS, SURPRISE, SORT };

export const meta = {
  id: "empire", name: "Empire immobilier", cat: "Plateau", min: 2, max: 6, turnTime: 40,
  color: "#10B981", desc: "Achète des rues, bâtis maisons et hôtels, et deviens le plus riche.",
  rules: [
    "Lance les deux dés et avance. Une rue libre ? Achète-la ou laisse-la (aux enchères si l'option est active).",
    "Sur la rue d'un adversaire, tu paies un loyer. Possède tout un groupe de couleur : le loyer double et tu peux bâtir.",
    "Maisons et hôtel (5e niveau) se construisent de façon équilibrée sur le groupe. Revente à moitié prix.",
    "Hypothèque une rue sans maison pour toucher la moitié de son prix ; lève l'hypothèque pour 10 % de plus.",
    "Un double : tu rejoues. Trois doubles de suite ou la case « Au poste ! » : direction la prison.",
    "En prison : tente un double, paie 50 € ou utilise une carte « Libéré de prison ». Au 3e essai raté, tu paies 50 €.",
    "Tu ne peux pas payer, même en vendant et en hypothéquant ? Faillite : tes biens vont à ton créancier.",
    "Échange : pendant ton tour, propose à un joueur de lui vendre ou de lui acheter une rue contre de l'argent.",
    "Fin : dernier joueur solvable, ou le plus riche (argent + rues + bâtiments) après le nombre de tours choisi.",
  ],
};

// ------------------------------------------------ réglages
export const options = [
  { key: "cash", label: "Argent", icon: "💶", values: [[1000, "1 000 €", "Serré"], [1500, "1 500 €", "Classique"], [2000, "2 000 €", "Confort"]], def: 1500 },
  { key: "turns", label: "Durée", icon: "⏱️", values: [[15, "15 tours", "Express"], [20, "20 tours", "Rapide"], [30, "30 tours", "Standard"], [45, "45 tours", "Longue"]], def: 30 },
  { key: "parc", label: "Cagnotte", icon: "🌳", values: [[0, "Non"], [1, "Oui", "Taxes au parc"]], def: 0 },
  { key: "auction", label: "Enchères", icon: "🔨", values: [[1, "Oui", "Si refus d'achat"], [0, "Non"]], def: 1 },
  { key: "deal", label: "Rues cadeau", icon: "🎁", values: [[0, "Aucun"], [2, "2", "Départ lancé"], [3, "3", "Départ en trombe"]], def: 0 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🏙️", desc: "1 500 € au départ, enchères, 30 tours maximum.",
    set: { cash: 1500, turns: 30, parc: 0, auction: 1, deal: 0 } },
  { id: "rapide", name: "Partie rapide", emoji: "⚡", desc: "20 tours, 2 rues offertes à chacun dès le départ.",
    set: { cash: 1500, turns: 20, parc: 0, auction: 0, deal: 2 } },
  { id: "cagnotte", name: "Cagnotte", emoji: "🌳", desc: "Taxes et amendes vont au parc : qui s'y arrête rafle tout.",
    set: { cash: 1500, turns: 30, parc: 1, auction: 1, deal: 0 } },
  { id: "magnat", name: "Grand magnat", emoji: "🏰", desc: "2 000 € et 45 tours pour bâtir un vrai empire.",
    set: { cash: 2000, turns: 45, parc: 1, auction: 1, deal: 0 } },
];
export function opt(settings, key) {
  const o = options.find((x) => x.key === key);
  const v = settings ? settings[key] : undefined;
  const hit = o.values.find((x) => String(x[0]) === String(v));
  return hit ? hit[0] : o.def;
}

// ------------------------------------------------ aides
const BUYABLE = BOARD.map((c, i) => (c.p ? i : -1)).filter((i) => i >= 0);
const STREETS = BOARD.map((c, i) => (c.k === "prop" ? i : -1)).filter((i) => i >= 0);
export const curId = (s) => s.order[s.cur];
export const active = (s) => s.order.filter((id) => !s.P[id].out);
export const houseCost = (i) => (BOARD[i].g ? GROUPS[BOARD[i].g].house : 0);
export const mortVal = (i) => Math.floor(BOARD[i].p / 2);
export const unmortCost = (i) => Math.round(BOARD[i].p * 0.55);
export const ownsAll = (s, pid, g) => GROUP_CELLS[g].every((c) => s.own[c] === pid);
export const groupHouses = (s, g) => GROUP_CELLS[g].reduce((n, c) => n + s.hs[c], 0);
export const propsOf = (s, pid) => BUYABLE.filter((i) => s.own[i] === pid);

export function rentOf(s, i, diceSum) {
  const c = BOARD[i], o = s.own[i];
  if (!o || s.mg[i]) return 0;
  if (c.k === "prop") {
    if (s.hs[i] > 0) return c.r[s.hs[i]];
    return ownsAll(s, o, c.g) ? c.r[0] * 2 : c.r[0];
  }
  if (c.k === "station") {
    const n = STATIONS.filter((x) => s.own[x] === o).length;
    return 25 * 2 ** (n - 1);
  }
  if (c.k === "util") {
    const both = GROUP_CELLS.util.every((x) => s.own[x] === o);
    return (diceSum || 7) * (both ? 10 : 4);
  }
  return 0;
}

// fortune : argent + valeur des rues (moitié si hypothéquée) + bâtiments au prix coûtant
export function worth(s, pid) {
  const p = s.P[pid];
  if (p.out) return 0;
  let w = p.cash;
  for (const i of BUYABLE) if (s.own[i] === pid) w += (s.mg[i] ? mortVal(i) : BOARD[i].p) + s.hs[i] * houseCost(i);
  return w;
}
// argent qu'on peut réunir en vendant tout
export function liquid(s, pid) {
  let w = s.P[pid].cash;
  for (const i of BUYABLE) if (s.own[i] === pid) w += (s.hs[i] * houseCost(i)) / 2 + (s.mg[i] ? 0 : mortVal(i));
  return Math.floor(w);
}

function log(s, p, m, q) {
  s.log.push(q ? { p, m, q } : { p, m });
  if (s.log.length > 8) s.log.shift();
}

// ------------------------------------------------ mise en place
export function setup(players, settings, rng) {
  const order = rng.shuffle(players.map((p) => p.id));
  const cash = opt(settings, "cash");
  const P = {};
  order.forEach((id) => (P[id] = { cash, pos: 0, jail: 0, cards: [], out: 0 }));
  const lvl = [1, 2, 3].includes(Number(settings && settings.level)) ? Number(settings.level) : 2;
  const s = {
    order, cur: 0, P,
    own: Array(40).fill(""), hs: Array(40).fill(0), mg: Array(40).fill(0),
    phase: "roll", dice: [0, 0], again: false, dbl: 0, tour: 1,
    maxT: opt(settings, "turns"), parc: opt(settings, "parc"), auc: opt(settings, "auction"), pot: 0,
    decks: { s: rng.shuffle(SURPRISE.map((_, i) => i)), c: rng.shuffle(SORT.map((_, i) => i)) },
    card: null, auction: null, debt: null, trade: null, tradeN: 0, nope: [], log: [], outN: 0, lvl, over: false, moves: 0,
  };
  const deal = opt(settings, "deal");
  if (deal) {
    const pool = rng.shuffle(STREETS);
    for (const id of order) {
      let got = 0;
      for (let k = 0; k < pool.length && got < deal; k++) {
        const i = pool[k];
        if (s.own[i]) continue;
        s.own[i] = id;
        if (ownsAll(s, id, BOARD[i].g)) { s.own[i] = ""; continue; }
        got++;
      }
    }
  }
  return s;
}

export function toAct(s) {
  if (s.over) return [];
  if (s.phase === "auction") return active(s).filter((id) => !(id in s.auction.bids));
  if (s.phase === "trade") return [s.trade.to];
  return [curId(s)];
}

// ------------------------------------------------ argent
function credit(s, to, amt) {
  if (to === "pot") { if (s.parc) s.pot += amt; return; }
  if (to === "bank") return;
  if (to === "each") {
    const others = active(s).filter((id) => id !== curId(s));
    const part = others.length ? Math.floor(amt / others.length) : 0;
    others.forEach((id) => (s.P[id].cash += part));
    return;
  }
  if (s.P[to] && !s.P[to].out) s.P[to].cash += amt;
}
// renvoie true si payé tout de suite, sinon passe en phase de dette
function charge(s, pid, amt, to, then = null) {
  if (amt <= 0) return true;
  const p = s.P[pid];
  if (p.cash >= amt) { p.cash -= amt; credit(s, to, amt); return true; }
  s.debt = { amt, to, then };
  s.phase = "debt";
  return false;
}

// ------------------------------------------------ déplacements
function sendJail(s, pid) {
  const p = s.P[pid];
  p.pos = 10; p.jail = 1;
  s.again = false; s.dbl = 0;
  log(s, pid, "file en prison 🚔");
}
function moveTo(s, pid, target, salary = true) {
  const p = s.P[pid];
  if (salary && (target < p.pos || target === 0)) { p.cash += SALARY; log(s, pid, `passe par Départ : +${SALARY} €`); }
  p.pos = target;
  s.moves++;
  land(s, pid);
}
function moveBy(s, pid, n) {
  s.phase = "move";
  moveTo(s, pid, (s.P[pid].pos + n) % 40);
}

function land(s, pid) {
  const p = s.P[pid], i = p.pos, c = BOARD[i];
  switch (c.k) {
    case "prop": case "station": case "util": {
      const o = s.own[i];
      if (!o) { s.phase = "buy"; return; }
      if (o === pid) return;
      if (s.mg[i]) { log(s, pid, `ne paie rien : ${c.n} est hypothéquée`); return; }
      const rent = rentOf(s, i, s.dice[0] + s.dice[1]);
      log(s, pid, `paie ${rent} € de loyer à @`, o);
      charge(s, pid, rent, o);
      return;
    }
    case "tax":
      log(s, pid, `paie ${c.v} € (${c.n.toLowerCase()})`);
      charge(s, pid, c.v, "pot");
      return;
    case "surprise": case "sort":
      draw(s, pid, c.k === "surprise" ? "s" : "c");
      return;
    case "police":
      sendJail(s, pid);
      return;
    case "parc":
      if (s.parc && s.pot > 0) { log(s, pid, `rafle la cagnotte : +${s.pot} €`); p.cash += s.pot; s.pot = 0; }
      return;
  }
}

function draw(s, pid, d) {
  const deck = s.decks[d];
  const idx = deck.shift();
  const card = (d === "s" ? SURPRISE : SORT)[idx];
  const p = s.P[pid];
  s.card = { d, i: idx, p: pid };
  if (card.k !== "free") deck.push(idx);
  log(s, pid, `tire une carte ${d === "s" ? "Surprise" : "Coup du sort"}`);
  switch (card.k) {
    case "money":
      if (card.v > 0) p.cash += card.v;
      else charge(s, pid, -card.v, "pot");
      return;
    case "goto": moveTo(s, pid, card.v, true); return;
    case "to": moveTo(s, pid, card.v, false); return;
    case "back": moveTo(s, pid, (p.pos - card.v + 40) % 40, false); return;
    case "station": moveTo(s, pid, STATIONS.find((x) => x > p.pos) ?? STATIONS[0], true); return;
    case "jail": sendJail(s, pid); return;
    case "free": p.cards.push(d); return;
    case "repairs": {
      let cost = 0;
      for (const i of STREETS) if (s.own[i] === pid && s.hs[i]) cost += s.hs[i] === 5 ? card.v[1] : s.hs[i] * card.v[0];
      charge(s, pid, cost, "pot");
      return;
    }
    case "payEach": {
      const n = active(s).length - 1;
      charge(s, pid, card.v * n, "each");
      return;
    }
    case "getEach":
      for (const id of active(s)) {
        if (id === pid) continue;
        const x = Math.min(s.P[id].cash, card.v);
        s.P[id].cash -= x; p.cash += x;
      }
      return;
  }
}

// après la résolution d'une case : rejouer (double), ou finir son tour
function finish(s) {
  const pid = curId(s), p = s.P[pid];
  if (p.out || active(s).length <= 1) return nextPlayer(s);
  s.phase = s.again && p.jail === 0 ? "roll" : "end";
}
function nextPlayer(s) {
  s.dbl = 0; s.again = false; s.tradeN = 0; s.debt = null; s.auction = null; s.trade = null;
  if (active(s).length <= 1) { s.over = true; s.phase = "over"; return; }
  let i = s.cur;
  do {
    i = (i + 1) % s.order.length;
    if (i === 0) s.tour++;
  } while (s.P[s.order[i]].out);
  s.cur = i;
  if (s.tour > s.maxT) { s.over = true; s.phase = "over"; s.tour = s.maxT; return; }
  s.phase = "roll";
}

// faillite : biens au créancier (joueur) ou à la banque
function bankrupt(s, pid, to) {
  const p = s.P[pid];
  const toPlayer = to && s.P[to] && !s.P[to].out && to !== pid;
  let cash = p.cash;
  for (const i of BUYABLE) {
    if (s.own[i] !== pid) continue;
    cash += (s.hs[i] * houseCost(i)) / 2;
    s.hs[i] = 0;
    if (toPlayer) s.own[i] = to;
    else { s.own[i] = ""; s.mg[i] = 0; }
  }
  if (toPlayer) {
    s.P[to].cash += Math.floor(cash);
    s.P[to].cards.push(...p.cards);
    log(s, pid, "fait faillite : tout revient à @", to);
  } else {
    for (const d of p.cards) s.decks[d].push((d === "s" ? SURPRISE : SORT).findIndex((c) => c.k === "free"));
    log(s, pid, "fait faillite : ses biens retournent à la banque");
  }
  p.cash = 0; p.cards = []; p.jail = 0;
  p.out = ++s.outN;
}

// vend et hypothèque le strict nécessaire, renvoie true si la dette est couvrable
function liquidate(s, pid, need) {
  const p = s.P[pid];
  let guard = 0;
  while (p.cash < need && guard++ < 200) {
    // d'abord hypothéquer les rues d'un groupe sans maison (hors groupes complets), les moins chères d'abord
    const free = BUYABLE.filter((i) => s.own[i] === pid && !s.mg[i] && groupHouses(s, BOARD[i].g) === 0)
      .sort((a, b) => (ownsAll(s, pid, BOARD[a].g) - ownsAll(s, pid, BOARD[b].g)) || BOARD[a].p - BOARD[b].p);
    if (free.length) { doMortgage(s, pid, free[0]); continue; }
    const built = STREETS.filter((i) => s.own[i] === pid && s.hs[i] > 0).sort((a, b) => s.hs[b] - s.hs[a]);
    if (built.length) { doSell(s, pid, built[0]); continue; }
    break;
  }
  return p.cash >= need;
}

// ------------------------------------------------ gestion des biens
function canManage(s, pid, sellOnly) {
  if (curId(s) !== pid) fail("Ce n'est pas ton tour");
  if (s.phase === "debt") { if (!sellOnly) fail("Règle d'abord ta dette"); return; }
  if (s.phase !== "roll" && s.phase !== "end") fail("Pas maintenant");
}
function checkCell(s, pid, i) {
  if (!Number.isInteger(i) || i < 0 || i >= 40 || !BOARD[i].p) fail("Case invalide");
  if (s.own[i] !== pid) fail("Cette rue n'est pas à toi");
}
function doMortgage(s, pid, i) {
  s.mg[i] = 1; s.P[pid].cash += mortVal(i);
}
function doSell(s, pid, i) {
  s.hs[i]--; s.P[pid].cash += houseCost(i) / 2;
}
export function canBuild(s, pid, i) {
  const c = BOARD[i];
  if (c.k !== "prop" || s.own[i] !== pid || !ownsAll(s, pid, c.g)) return false;
  const cells = GROUP_CELLS[c.g];
  if (cells.some((x) => s.mg[x])) return false;
  if (s.hs[i] >= 5 || s.hs[i] > Math.min(...cells.map((x) => s.hs[x]))) return false;
  return s.P[pid].cash >= houseCost(i);
}
export function canSell(s, pid, i) {
  const c = BOARD[i];
  if (c.k !== "prop" || s.own[i] !== pid || !s.hs[i]) return false;
  return s.hs[i] >= Math.max(...GROUP_CELLS[c.g].map((x) => s.hs[x]));
}
export const canMortgage = (s, pid, i) => BOARD[i].p && s.own[i] === pid && !s.mg[i] && groupHouses(s, BOARD[i].g) === 0;
export const canUnmortgage = (s, pid, i) => BOARD[i].p && s.own[i] === pid && s.mg[i] && s.P[pid].cash >= unmortCost(i);
// une rue s'échange si personne n'a bâti sur son groupe
export const tradable = (s, i) => !!BOARD[i].p && !!s.own[i] && groupHouses(s, BOARD[i].g) === 0;

// ------------------------------------------------ actions
export function reduce(s, pid, a) {
  if (s.over) fail("La partie est terminée");
  if (!toAct(s).includes(pid)) fail("Ce n'est pas ton tour");
  const p = s.P[pid];
  const r = mkRng(a.seed || 1);
  switch (a.type) {
    case "roll": {
      if (s.phase !== "roll") fail("Ce n'est pas le moment de lancer");
      const d = [1 + r.int(6), 1 + r.int(6)];
      s.dice = d; s.card = null;
      const sum = d[0] + d[1], dbl = d[0] === d[1];
      if (p.jail > 0) {
        s.again = false;
        if (dbl) { p.jail = 0; log(s, pid, `sort de prison avec un double (${d[0]}+${d[1]})`); moveBy(s, pid, sum); }
        else if (p.jail >= 3) {
          p.jail = 0;
          log(s, pid, `paie ${JAIL_FEE} € de caution et sort`);
          if (!charge(s, pid, JAIL_FEE, "pot", { move: sum })) return s;
          moveBy(s, pid, sum);
        } else { p.jail++; log(s, pid, `rate son double (${d[0]}+${d[1]}) et reste en prison`); s.phase = "end"; return s; }
      } else {
        if (dbl) {
          s.dbl++;
          if (s.dbl >= 3) { log(s, pid, "fait 3 doubles de suite"); sendJail(s, pid); s.phase = "end"; return s; }
          s.again = true;
        } else s.again = false;
        moveBy(s, pid, sum);
      }
      if (s.phase === "move") finish(s);
      return s;
    }
    case "payJail": {
      if (s.phase !== "roll" || !p.jail) fail("Tu n'es pas en prison");
      if (p.cash < JAIL_FEE) fail("Pas assez d'argent");
      p.cash -= JAIL_FEE; credit(s, "pot", JAIL_FEE); p.jail = 0;
      log(s, pid, `paie ${JAIL_FEE} € et sort de prison`);
      return s;
    }
    case "useCard": {
      if (s.phase !== "roll" || !p.jail) fail("Tu n'es pas en prison");
      if (!p.cards.length) fail("Tu n'as pas de carte « Libéré de prison »");
      const d = p.cards.shift();
      s.decks[d].push((d === "s" ? SURPRISE : SORT).findIndex((c) => c.k === "free"));
      p.jail = 0;
      log(s, pid, "utilise sa carte « Libéré de prison »");
      return s;
    }
    case "buy": {
      if (s.phase !== "buy") fail("Rien à acheter");
      const i = p.pos, c = BOARD[i];
      if (p.cash < c.p) fail("Pas assez d'argent");
      p.cash -= c.p; s.own[i] = pid;
      log(s, pid, `achète ${c.n} pour ${c.p} €`);
      s.phase = "move"; finish(s);
      return s;
    }
    case "pass": {
      if (s.phase !== "buy") fail("Rien à refuser");
      const i = p.pos;
      if (s.auc) { s.auction = { cell: i, bids: {} }; s.phase = "auction"; log(s, pid, `laisse ${BOARD[i].n} aux enchères`); }
      else { log(s, pid, `n'achète pas ${BOARD[i].n}`); s.phase = "move"; finish(s); }
      return s;
    }
    case "bid": {
      if (s.phase !== "auction") fail("Pas d'enchère en cours");
      const amt = Math.floor(Number(a.amount));
      if (!Number.isFinite(amt) || amt < 0) fail("Mise invalide");
      if (amt > p.cash) fail("Tu n'as pas assez d'argent");
      s.auction.bids[pid] = amt;
      if (toAct(s).length) return s;
      // tout le monde a misé : la plus haute mise gagne (à égalité, le plus proche dans l'ordre du tour)
      const n = s.order.length;
      let best = null, bestV = 0;
      for (let k = 0; k < n; k++) {
        const id = s.order[(s.cur + k) % n];
        const v = s.auction.bids[id];
        if (v != null && v > bestV) { best = id; bestV = v; }
      }
      const i = s.auction.cell;
      if (best) { s.P[best].cash -= bestV; s.own[i] = best; log(s, best, `remporte ${BOARD[i].n} aux enchères pour ${bestV} €`); }
      else log(s, curId(s), `personne ne veut de ${BOARD[i].n}`);
      s.auction = null; s.phase = "move"; finish(s);
      return s;
    }
    case "build": {
      canManage(s, pid, false);
      checkCell(s, pid, a.cell);
      if (!canBuild(s, pid, a.cell)) fail("Construction impossible ici (groupe complet, équilibre et argent requis)");
      p.cash -= houseCost(a.cell); s.hs[a.cell]++;
      log(s, pid, s.hs[a.cell] === 5 ? `bâtit un hôtel sur ${BOARD[a.cell].n}` : `bâtit une maison sur ${BOARD[a.cell].n}`);
      return s;
    }
    case "sell": {
      canManage(s, pid, true);
      checkCell(s, pid, a.cell);
      if (!canSell(s, pid, a.cell)) fail("Vente impossible (vends d'abord sur les rues les plus bâties)");
      doSell(s, pid, a.cell);
      log(s, pid, `revend un bâtiment sur ${BOARD[a.cell].n}`);
      return s;
    }
    case "mortgage": {
      canManage(s, pid, true);
      checkCell(s, pid, a.cell);
      if (!canMortgage(s, pid, a.cell)) fail("Hypothèque impossible (vends d'abord les maisons du groupe)");
      doMortgage(s, pid, a.cell);
      log(s, pid, `hypothèque ${BOARD[a.cell].n} (+${mortVal(a.cell)} €)`);
      return s;
    }
    case "unmortgage": {
      canManage(s, pid, false);
      checkCell(s, pid, a.cell);
      if (!s.mg[a.cell]) fail("Cette rue n'est pas hypothéquée");
      if (!canUnmortgage(s, pid, a.cell)) fail("Pas assez d'argent");
      p.cash -= unmortCost(a.cell); s.mg[a.cell] = 0;
      log(s, pid, `lève l'hypothèque de ${BOARD[a.cell].n}`);
      return s;
    }
    case "offer": {
      canManage(s, pid, false);
      if (s.tradeN >= 3) fail("Trois propositions par tour, pas plus");
      const to = a.to, i = a.cell, cash = Math.floor(Number(a.cash));
      if (!s.P[to] || s.P[to].out || to === pid) fail("Joueur invalide");
      if (!Number.isInteger(i) || i < 0 || i >= 40 || !BOARD[i].p) fail("Case invalide");
      if (s.own[i] !== pid && s.own[i] !== to) fail("Cette rue n'est ni à toi ni à ce joueur");
      if (!tradable(s, i)) fail("On n'échange pas une rue dont le groupe est bâti");
      if (!Number.isFinite(cash) || cash < 0) fail("Montant invalide");
      const payer = s.own[i] === pid ? to : pid;
      if (s.P[payer].cash < cash) fail(payer === pid ? "Tu n'as pas assez d'argent" : "Ce joueur n'a pas assez d'argent");
      s.trade = { from: pid, to, cell: i, cash, back: s.phase };
      s.phase = "trade"; s.tradeN++;
      log(s, pid, s.own[i] === pid ? `propose ${BOARD[i].n} à @ pour ${cash} €` : `propose ${cash} € à @ pour ${BOARD[i].n}`, to);
      return s;
    }
    case "accept": case "refuse": {
      if (s.phase !== "trade") fail("Aucun échange en cours");
      const t = s.trade;
      if (a.type === "accept") {
        const seller = s.own[t.cell], buyer = seller === t.from ? t.to : t.from;
        if (s.P[buyer].cash < t.cash) fail("Plus assez d'argent pour cet échange");
        s.P[buyer].cash -= t.cash; s.P[seller].cash += t.cash; s.own[t.cell] = buyer;
        log(s, pid, `accepte : ${BOARD[t.cell].n} passe à @ pour ${t.cash} €`, buyer);
      } else {
        log(s, pid, "refuse la proposition de @", t.from);
        const key = t.from + ">" + t.cell;
        if (!s.nope.includes(key)) { s.nope.push(key); if (s.nope.length > 30) s.nope.shift(); }
      }
      s.phase = t.back; s.trade = null;
      return s;
    }
    case "pay": {
      if (s.phase !== "debt") fail("Aucune dette");
      if (p.cash < s.debt.amt) fail("Pas assez d'argent : vends ou hypothèque");
      return payDebt(s, pid);
    }
    case "settle": {
      if (s.phase !== "debt") fail("Aucune dette");
      if (liquidate(s, pid, s.debt.amt)) return payDebt(s, pid);
      bankrupt(s, pid, s.debt.to);
      s.debt = null; s.phase = "move"; finish(s);
      return s;
    }
    case "bankrupt": {
      if (s.phase !== "debt") fail("Aucune dette");
      if (liquid(s, pid) >= s.debt.amt) fail("Tu peux encore payer en vendant ou en hypothéquant");
      bankrupt(s, pid, s.debt.to);
      s.debt = null; s.phase = "move"; finish(s);
      return s;
    }
    case "end": {
      if (s.phase !== "end") fail("Termine d'abord ton action");
      nextPlayer(s);
      return s;
    }
  }
  fail("Action inconnue");
}

function payDebt(s, pid) {
  const d = s.debt;
  s.P[pid].cash -= d.amt; credit(s, d.to, d.amt);
  s.debt = null; s.phase = "move";
  if (d.then && d.then.move) moveBy(s, pid, d.then.move);
  if (s.phase === "move") finish(s);
  return s;
}

export function result(s) {
  if (!s.over) return null;
  const alive = s.order.filter((id) => !s.P[id].out);
  const ranking = rankByScore(alive.map((id) => ({ id, score: worth(s, id) })));
  const dead = s.order.filter((id) => s.P[id].out).sort((a, b) => s.P[b].out - s.P[a].out);
  dead.forEach((id, k) => ranking.push({ id, rank: alive.length + k + 1, score: 0 }));
  return { ranking };
}

// ------------------------------------------------ robots
function reserve(s, pid) {
  if (s.lvl === 1) return 60;
  let maxRent = 0;
  for (const i of BUYABLE) {
    const o = s.own[i];
    if (o && o !== pid && !s.P[o].out) maxRent = Math.max(maxRent, rentOf(s, i, 7));
  }
  return s.lvl === 3 ? 120 + Math.min(350, Math.floor(maxRent * 0.6)) : 150 + Math.min(250, Math.floor(maxRent * 0.4));
}
// la rue i compléterait le groupe de who ?
const completes = (s, who, i) => GROUP_CELLS[BOARD[i].g].every((c) => c === i || s.own[c] === who);
// un même adversaire possède déjà tout le reste du groupe (sauf i) ?
const blocks = (s, who, i) => {
  const others = GROUP_CELLS[BOARD[i].g].filter((c) => c !== i).map((c) => s.own[c]);
  return others.length > 0 && others[0] && others[0] !== who && others.every((o) => o === others[0]);
};
const freeCount = (s) => BUYABLE.filter((i) => !s.own[i]).length;
const round10 = (x) => Math.max(0, Math.floor(x / 10) * 10);

function wantBuy(s, pid, r) {
  const p = s.P[pid], i = p.pos, price = BOARD[i].p;
  if (p.cash < price) return false;
  if (s.lvl === 1) return r.next() < 0.85;
  const left = p.cash - price, res = reserve(s, pid);
  if (completes(s, pid, i)) return left >= 0;
  if (blocks(s, pid, i)) return left >= res / 2;
  return left >= res * (freeCount(s) > 14 ? 0.6 : 1);
}
function bidFor(s, pid, r) {
  const p = s.P[pid], i = s.auction.cell, price = BOARD[i].p;
  if (p.cash <= 0) return 0;
  let v;
  if (s.lvl === 1) v = price * (0.4 + 0.6 * r.next());
  else v = price * (completes(s, pid, i) ? 1.7 : blocks(s, pid, i) ? 1.3 : s.lvl === 3 ? 1.05 : 0.9);
  const cap = p.cash - (s.lvl === 1 ? 0 : reserve(s, pid) / 2);
  return round10(Math.min(v, cap));
}
function tradeOk(s, pid) {
  const t = s.trade, i = t.cell, price = BOARD[i].p;
  const seller = s.own[i];
  if (seller === pid) {
    // on me demande ma rue
    const other = seller === t.from ? t.to : t.from;
    let need = price * (completes(s, other, i) ? 2.2 : 1.25);
    if (GROUP_CELLS[BOARD[i].g].some((c) => c !== i && s.own[c] === pid)) need *= 1.6;
    if (s.mg[i]) need -= mortVal(i);
    return t.cash >= need;
  }
  // on me propose d'acheter
  let val = price * (completes(s, pid, i) ? 2 : 1.1);
  if (s.mg[i]) val -= unmortCost(i);
  return t.cash <= val && s.P[pid].cash - t.cash >= reserve(s, pid);
}
const GROUP_PRIO = ["orange", "rouge", "jaune", "rose", "ciel", "vert", "bleu", "brun"];
function manage(s, pid) {
  const p = s.P[pid], res = reserve(s, pid);
  const mine = propsOf(s, pid);
  // lever les hypothèques, d'abord dans les groupes complets
  const mort = mine.filter((i) => s.mg[i]).sort((a, b) => ownsAll(s, pid, BOARD[b].g) - ownsAll(s, pid, BOARD[a].g));
  for (const i of mort) if (p.cash - unmortCost(i) >= res + 100) return { type: "unmortgage", cell: i };
  // bâtir, de façon équilibrée
  for (const g of GROUP_PRIO) {
    if (!ownsAll(s, pid, g)) continue;
    const cells = GROUP_CELLS[g].filter((i) => canBuild(s, pid, i)).sort((a, b) => s.hs[a] - s.hs[b]);
    if (cells.length && p.cash - houseCost(cells[0]) >= res) return { type: "build", cell: cells[0] };
  }
  return null;
}
function proposeTrade(s, pid) {
  if (s.lvl < 2 || s.tradeN > 0) return null;
  const p = s.P[pid], res = reserve(s, pid);
  for (const g of GROUP_PRIO) {
    const cells = GROUP_CELLS[g];
    const missing = cells.filter((c) => s.own[c] !== pid);
    if (missing.length !== 1) continue;
    const i = missing[0], o = s.own[i];
    if (!o || s.P[o].out || !tradable(s, i) || s.nope.includes(pid + ">" + i)) continue;
    const offer = Math.ceil((BOARD[i].p * 2.4) / 10) * 10;
    if (p.cash - offer >= res) return { type: "offer", to: o, cell: i, cash: offer };
  }
  return null;
}

export function bot(s, pid, r) {
  const p = s.P[pid];
  switch (s.phase) {
    case "auction": return { type: "bid", amount: bidFor(s, pid, r) };
    case "trade": return { type: tradeOk(s, pid) ? "accept" : "refuse" };
    case "debt": return { type: "settle" };
    case "buy": return { type: wantBuy(s, pid, r) ? "buy" : "pass" };
    case "roll": {
      const m = manage(s, pid);
      if (m) return m;
      if (p.jail > 0) {
        const early = freeCount(s) > 8;
        if (s.lvl === 1) { if (p.cards.length) return { type: "useCard" }; return r.next() < 0.5 && p.cash >= JAIL_FEE ? { type: "payJail" } : { type: "roll" }; }
        if (early && p.cards.length) return { type: "useCard" };
        if (early && p.cash >= JAIL_FEE + reserve(s, pid)) return { type: "payJail" };
      }
      return { type: "roll" };
    }
    case "end": return manage(s, pid) || proposeTrade(s, pid) || { type: "end" };
  }
  return null;
}

// joueur absent : action prudente
export function auto(s, pid) {
  switch (s.phase) {
    case "auction": return { type: "bid", amount: 0 };
    case "trade": return { type: "refuse" };
    case "debt": return { type: "settle" };
    case "buy": return { type: "pass" };
    case "roll": return { type: "roll" };
    case "end": return { type: "end" };
  }
  return null;
}

export function botDelay(s, pid, rng) {
  const base = s.phase === "end" || s.phase === "auction" ? 500 : 800;
  return base + Math.floor((rng ? rng.next() : 0.5) * 500);
}
