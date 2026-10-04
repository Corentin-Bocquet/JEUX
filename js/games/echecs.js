import { fail } from "../engine.js";

export const meta = {
  id: "echecs", name: "Échecs", cat: "Plateau", min: 2, max: 2, turnTime: 90,
  color: "#4F46E5", desc: "Le grand classique : mets le roi adverse échec et mat.",
  rules: ["Les Blancs commencent. Touche une de tes pièces puis sa case d'arrivée.",
    "Tu gagnes en mettant le roi adverse échec et mat : il est attaqué et n'a aucun moyen d'y échapper.",
    "Roque, prise en passant et promotion (tu choisis la pièce) sont permis. Pour roquer, touche ton roi puis sa case d'arrivée ou ta tour.",
    "Partie nulle : pat (aucun coup légal sans être en échec), même position trois fois, 50 coups de chaque côté sans prise ni mouvement de pion, ou matériel insuffisant pour mater.",
    "Variantes : Fischer 960 (pièces du fond mélangées), Roi de la colline (amène ton roi sur une des 4 cases centrales), Trois échecs (donne 3 échecs pour gagner).",
    "Les jokers « Retour » permettent d'annuler ton dernier coup (et la réponse de l'adversaire)."],
};

export const options = [
  { key: "variant", label: "Variante", icon: "♟️",
    values: [["classique", "Classique", "Règles officielles"], ["960", "Fischer 960", "Fond mélangé"], ["colline", "Colline", "Roi au centre"], ["3echecs", "3 échecs", "3 échecs gagnent"]], def: "classique" },
  { key: "hints", label: "Aide", icon: "💡",
    values: [[true, "Oui", "Coups affichés"], [false, "Non", "À toi de voir"]], def: true },
  { key: "undo", label: "Retours", icon: "↩️",
    values: [[0, "0", "Aucun"], [1, "1", "Un joker"], [3, "3", "Trois jokers"]], def: 0 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "♞", desc: "Les règles officielles, coups possibles affichés.", set: { variant: "classique", hints: true, undo: 0 } },
  { id: "fischer", name: "Fischer 960", emoji: "🎲", desc: "Pièces du fond tirées au sort : fini la théorie des ouvertures.", set: { variant: "960", hints: true, undo: 0 } },
  { id: "colline", name: "Roi de la colline", emoji: "⛰️", desc: "Mat, ou roi sur une des 4 cases du centre : tu gagnes.", set: { variant: "colline", hints: true, undo: 0 } },
  { id: "apprenti", name: "Apprenti", emoji: "🎓", desc: "Règles classiques avec 3 retours pour corriger tes erreurs.", set: { variant: "classique", hints: true, undo: 3 } },
];
const optVal = (key, v) => {
  const o = options.find((x) => x.key === key);
  return o.values.some((x) => x[0] === v) ? v : o.def;
};

// ------------------------------------------------------------------ plateau
// case = rangée * 8 + colonne ; rangée 0 = 8e rangée (côté noir), colonne 0 = colonne a
// pièces : 0 vide, blanc 1..6 (P C F T D R), noir 9..14 ; couleur = p >> 3, type = p & 7
export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const CH = ".PNBRQK";
export const HILL = [27, 28, 35, 36]; // d5 e5 d4 e4
export const sqName = (i) => "abcdefgh"[i & 7] + (8 - (i >> 3));
export const sqIndex = (n) => (8 - Number(n[1])) * 8 + "abcdefgh".indexOf(n[0]);
const colorOf = (p) => p >> 3;
const typeOf = (p) => p & 7;

export function boardToStr(b) {
  let s = "";
  for (const p of b) s += p ? (p >> 3 ? CH[p & 7].toLowerCase() : CH[p]) : ".";
  return s;
}
export function strToBoard(s) {
  const b = new Array(64);
  for (let i = 0; i < 64; i++) {
    const c = s[i];
    if (c === ".") { b[i] = 0; continue; }
    const t = CH.indexOf(c.toUpperCase());
    b[i] = c === c.toUpperCase() ? t : t | 8;
  }
  return b;
}

// tables de déplacements précalculées
const KN = [], KG = [], RAYS = [], PATT = [[], []];
const DIRS = [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
for (let i = 0; i < 64; i++) {
  const r = i >> 3, c = i & 7;
  const ok = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;
  KN[i] = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].filter(([a, b]) => ok(r + a, c + b)).map(([a, b]) => (r + a) * 8 + c + b);
  KG[i] = DIRS.filter(([a, b]) => ok(r + a, c + b)).map(([a, b]) => (r + a) * 8 + c + b);
  RAYS[i] = DIRS.map(([a, b]) => { const out = []; let rr = r + a, cc = c + b; while (ok(rr, cc)) { out.push(rr * 8 + cc); rr += a; cc += b; } return out; });
  // PATT[camp][case] : cases d'où un pion de ce camp attaque cette case
  PATT[0][i] = [[1, -1], [1, 1]].filter(([a, b]) => ok(r + a, c + b)).map(([a, b]) => (r + a) * 8 + c + b);
  PATT[1][i] = [[-1, -1], [-1, 1]].filter(([a, b]) => ok(r + a, c + b)).map(([a, b]) => (r + a) * 8 + c + b);
}

export function attacked(b, sq, by) {
  const o = by << 3;
  for (const f of PATT[by][sq]) if (b[f] === (o | P)) return true;
  for (const f of KN[sq]) if (b[f] === (o | N)) return true;
  for (const f of KG[sq]) if (b[f] === (o | K)) return true;
  const rays = RAYS[sq];
  for (let d = 0; d < 8; d++) {
    const ray = rays[d];
    const a = d < 4 ? R : B;
    for (let j = 0; j < ray.length; j++) {
      const p = b[ray[j]];
      if (!p) continue;
      if (p === (o | a) || p === (o | Q)) return true;
      break;
    }
  }
  return false;
}

// coup = from | to << 6 | drapeau << 12 | promotion << 15
// drapeaux : 0 normal, 1 double pas, 2 en passant, 3 roque (to = case de la tour)
export const mFrom = (m) => m & 63, mTo = (m) => (m >> 6) & 63, mFlag = (m) => (m >> 12) & 7, mPromo = (m) => (m >> 15) & 7;
const mk = (f, t, fl = 0, pr = 0) => f | (t << 6) | (fl << 12) | (pr << 15);
// case d'arrivée du roi (utile pour le roque)
export const kingDest = (m) => (mFlag(m) === 3 ? (mFrom(m) & 56) + (mTo(m) > mFrom(m) ? 6 : 2) : mTo(m));

// position interne : { b, side, cr: [roque blanc côté roi, côté dame, noir côté roi, côté dame] (case de la tour ou -1), ep, half, kp, chk, v }
export const inCheck = (pos) => attacked(pos.b, pos.kp[pos.side], 1 - pos.side);

export function pseudoMoves(pos, capsOnly = false) {
  const { b, side } = pos;
  const out = [];
  const me = side << 3;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || colorOf(p) !== side) continue;
    const t = typeOf(p);
    if (t === P) {
      const dir = side ? 8 : -8, row = i >> 3, last = side ? 7 : 0, startRow = side ? 1 : 6;
      const one = i + dir;
      const promo = (one >> 3) === last;
      if (!b[one] && (!capsOnly || promo)) {
        if (promo) for (const pr of [Q, N, R, B]) out.push(mk(i, one, 0, pr));
        else {
          out.push(mk(i, one));
          if (row === startRow && !b[one + dir]) out.push(mk(i, one + dir, 1));
        }
      }
      for (const dc of [-1, 1]) {
        const c = (i & 7) + dc;
        if (c < 0 || c > 7) continue;
        const to = one + dc;
        const q = b[to];
        if (q && colorOf(q) !== side) {
          if (promo) for (const pr of [Q, N, R, B]) out.push(mk(i, to, 0, pr));
          else out.push(mk(i, to));
        } else if (to === pos.ep) out.push(mk(i, to, 2));
      }
    } else if (t === N || t === K) {
      for (const to of (t === N ? KN : KG)[i]) {
        const q = b[to];
        if (q ? colorOf(q) !== side : !capsOnly) out.push(mk(i, to));
      }
    } else {
      const d0 = t === B ? 4 : 0, d1 = t === R ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        for (const to of RAYS[i][d]) {
          const q = b[to];
          if (!q) { if (!capsOnly) out.push(mk(i, to)); continue; }
          if (colorOf(q) !== side) out.push(mk(i, to));
          break;
        }
      }
    }
  }
  if (!capsOnly) castleMoves(pos, out, me);
  return out;
}

function castleMoves(pos, out) {
  const { b, side, cr } = pos;
  const ksq = pos.kp[side];
  if (cr[side * 2] < 0 && cr[side * 2 + 1] < 0) return;
  if (attacked(b, ksq, 1 - side)) return;
  const home = side ? 0 : 56;
  for (let w = 0; w < 2; w++) {
    const rsq = cr[side * 2 + w];
    if (rsq < 0 || b[rsq] !== ((side << 3) | R)) continue;
    const kTo = home + (w === 0 ? 6 : 2), rTo = home + (w === 0 ? 5 : 3);
    const lo = Math.min(ksq, rsq, kTo, rTo), hi = Math.max(ksq, rsq, kTo, rTo);
    let clear = true;
    for (let s = lo; s <= hi; s++) if (s !== ksq && s !== rsq && b[s]) { clear = false; break; }
    if (!clear) continue;
    // le roi ne doit traverser aucune case attaquée (on retire roi et tour pour le test)
    const tb = b.slice(); tb[ksq] = 0; tb[rsq] = 0;
    const step = kTo > ksq ? 1 : -1;
    let safe = true;
    for (let s = ksq; ; s += step) {
      if (s !== ksq && attacked(tb, s, 1 - side)) { safe = false; break; }
      if (s === kTo) break;
    }
    if (safe) out.push(mk(ksq, rsq, 3));
  }
}

export function makeMove(pos, m) {
  const from = mFrom(m), to = mTo(m), fl = mFlag(m), pr = mPromo(m);
  const b = pos.b.slice();
  const s = pos.side;
  const p = b[from];
  const np = { b, side: 1 - s, cr: pos.cr.slice(), ep: -1, half: pos.half + 1, kp: pos.kp.slice(), chk: pos.chk, v: pos.v, cap: 0 };
  if (fl === 3) {
    const home = from & 56, kTo = home + (to > from ? 6 : 2), rTo = home + (to > from ? 5 : 3);
    const rook = b[to];
    b[from] = 0; b[to] = 0; b[kTo] = p; b[rTo] = rook;
    np.kp[s] = kTo;
    np.cr[s * 2] = np.cr[s * 2 + 1] = -1;
  } else {
    let cap = b[to];
    if (fl === 2) { const cs = to + (s ? -8 : 8); cap = b[cs]; b[cs] = 0; }
    b[to] = pr ? ((s << 3) | pr) : p;
    b[from] = 0;
    np.cap = cap;
    const t = typeOf(p);
    if (t === P || cap) np.half = 0;
    if (fl === 1) {
      // case de prise en passant seulement si un pion adverse peut vraiment la prendre
      const c = to & 7, ep = (from + to) >> 1, op = ((1 - s) << 3) | P;
      if ((c > 0 && b[to - 1] === op) || (c < 7 && b[to + 1] === op)) np.ep = ep;
    }
    if (t === K) { np.kp[s] = to; np.cr[s * 2] = np.cr[s * 2 + 1] = -1; }
    for (let i = 0; i < 4; i++) if (np.cr[i] === from || np.cr[i] === to) np.cr[i] = -1;
  }
  if (pos.v === "3echecs" && attacked(b, np.kp[1 - s], s)) { np.chk = pos.chk.slice(); np.chk[s]++; }
  return np;
}

export function legalMoves(pos) {
  const out = [];
  for (const m of pseudoMoves(pos)) {
    const np = makeMove(pos, m);
    if (!attacked(np.b, np.kp[pos.side], np.side)) out.push(m);
  }
  return out;
}

export function perft(pos, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of pseudoMoves(pos)) {
    const np = makeMove(pos, m);
    if (attacked(np.b, np.kp[pos.side], np.side)) continue;
    n += depth === 1 ? 1 : perft(np, depth - 1);
  }
  return n;
}

// lecture d'une position FEN (pour les tests et les positions de départ)
export function fromFEN(fen, v = "classique") {
  const [pl, side, cas, ep, half] = fen.split(" ");
  const b = [];
  for (const ch of pl.replace(/\//g, "")) {
    if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) b.push(0);
    else { const t = CH.indexOf(ch.toUpperCase()); b.push(ch === ch.toUpperCase() ? t : t | 8); }
  }
  const kp = [b.indexOf(K), b.indexOf(K | 8)];
  const cr = [-1, -1, -1, -1];
  if (cas && cas !== "-") {
    if (cas.includes("K")) cr[0] = 63;
    if (cas.includes("Q")) cr[1] = 56;
    if (cas.includes("k")) cr[2] = 7;
    if (cas.includes("q")) cr[3] = 0;
  }
  return { b, side: side === "b" ? 1 : 0, cr, ep: ep && ep !== "-" ? sqIndex(ep) : -1, half: +half || 0, kp, chk: [0, 0], v, cap: 0 };
}

// ------------------------------------------------------------------ notation (française : R D T F C)
const FR = ".PCFTDR";
export function sanOf(pos, m, legal) {
  const from = mFrom(m), to = mTo(m), fl = mFlag(m), pr = mPromo(m);
  const t = typeOf(pos.b[from]);
  let s;
  if (fl === 3) s = to > from ? "O-O" : "O-O-O";
  else {
    const cap = pos.b[to] || fl === 2;
    if (t === P) s = (cap ? "abcdefgh"[from & 7] + "x" : "") + sqName(to) + (pr ? "=" + FR[pr] : "");
    else {
      const twins = legal.filter((x) => x !== m && mFlag(x) !== 3 && mTo(x) === to && pos.b[mFrom(x)] === pos.b[from]);
      let dis = "";
      if (twins.length) {
        if (!twins.some((x) => (mFrom(x) & 7) === (from & 7))) dis = "abcdefgh"[from & 7];
        else if (!twins.some((x) => (mFrom(x) >> 3) === (from >> 3))) dis = String(8 - (from >> 3));
        else dis = sqName(from);
      }
      s = FR[t] + dis + (cap ? "x" : "") + sqName(to);
    }
  }
  const np = makeMove(pos, m);
  if (inCheck(np)) s += legalMoves(np).length ? "+" : "#";
  return s;
}

// ------------------------------------------------------------------ partie
function start960(rng) {
  const row = Array(8).fill(0);
  row[2 * rng.int(4)] = B;
  row[2 * rng.int(4) + 1] = B;
  const free = () => row.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  let f = free(); row[f[rng.int(f.length)]] = Q;
  f = free(); row[f[rng.int(f.length)]] = N;
  f = free(); row[f[rng.int(f.length)]] = N;
  f = free(); row[f[0]] = R; row[f[1]] = K; row[f[2]] = R;
  return row;
}

function startPos(v, rng) {
  const back = v === "960" ? start960(rng) : [R, N, B, Q, K, B, N, R];
  const b = Array(64).fill(0);
  for (let c = 0; c < 8; c++) {
    b[c] = back[c] | 8; b[8 + c] = P | 8;
    b[48 + c] = P; b[56 + c] = back[c];
  }
  const rooks = back.map((p, i) => (p === R ? i : -1)).filter((i) => i >= 0);
  const k = back.indexOf(K);
  const kr = rooks.find((i) => i > k), qr = rooks.find((i) => i < k);
  return { b, side: 0, cr: [56 + kr, 56 + qr, kr, qr], ep: -1, half: 0, kp: [56 + k, k], chk: [0, 0], v, cap: 0 };
}

export function posOf(s) {
  const b = strToBoard(s.b);
  return { b, side: s.side, cr: s.cr.slice(), ep: s.ep, half: s.half, kp: [b.indexOf(K), b.indexOf(K | 8)], chk: s.chk.slice(), v: s.v, cap: 0 };
}
// empreinte courte d'une position (pour la répétition)
function keyOf(pos) {
  const str = boardToStr(pos.b) + pos.side + pos.cr.join(",") + pos.ep;
  let h1 = 0x811c9dc5, h2 = 0x12345;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 + c, 2654435761) ^ (h2 >>> 13); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36).slice(0, 3);
}
const storePos = (s, pos) => { s.b = boardToStr(pos.b); s.side = pos.side; s.cr = pos.cr; s.ep = pos.ep; s.half = pos.half; s.chk = pos.chk.slice(); };

// matériel insuffisant pour mater (roi seul, roi + fou ou cavalier, fous tous de même couleur)
export function insufficient(b) {
  const minors = [];
  for (let i = 0; i < 64; i++) {
    const t = typeOf(b[i]);
    if (!b[i] || t === K) continue;
    if (t === P || t === R || t === Q) return false;
    minors.push([t, i]);
  }
  if (minors.length <= 1) return true;
  if (minors.every(([t]) => t === B)) {
    const sq = minors.map(([, i]) => ((i >> 3) + (i & 7)) % 2);
    return sq.every((x) => x === sq[0]);
  }
  return false;
}

export const MAX_PLIES = 800;
const END_TXT = { mat: "Échec et mat", pat: "Pat", repetition: "Répétition de la position", cinquante: "Règle des 50 coups",
  materiel: "Matériel insuffisant", colline: "Roi sur la colline", troisechecs: "Troisième échec", abandon: "Abandon", longue: "Partie trop longue" };
export const endText = (why) => END_TXT[why] || "";

// joue un coup légal dans l'état (le coup a déjà été validé)
function playInState(s, m) {
  const pos = posOf(s);
  const legal = legalMoves(pos);
  s.san.push(sanOf(pos, m, legal));
  s.mv.push(m);
  const np = makeMove(pos, m);
  const mover = pos.side;
  storePos(s, np);
  s.last = [mFrom(m), kingDest(m), mFlag(m) === 3 ? mTo(m) : -1];
  if (np.cap) s.lost[1 - mover] += CH[typeOf(np.cap)];
  // répétition : on repart de zéro après un coup irréversible
  if (np.half === 0 || pos.cr.join() !== np.cr.join()) s.reps = [];
  s.reps.push(keyOf(np));
  const id = s.order[mover];
  const replies = legalMoves(np);
  const check = inCheck(np);
  if (s.v === "colline" && HILL.includes(np.kp[mover])) s.end = { winner: id, why: "colline" };
  else if (s.v === "3echecs" && np.chk[mover] >= 3) s.end = { winner: id, why: "troisechecs" };
  else if (!replies.length) s.end = check ? { winner: id, why: "mat" } : { winner: null, why: "pat" };
  else if (s.v !== "colline" && insufficient(np.b)) s.end = { winner: null, why: "materiel" };
  else if (np.half >= 100) s.end = { winner: null, why: "cinquante" };
  else if (s.reps.filter((k) => k === s.reps[s.reps.length - 1]).length >= 3) s.end = { winner: null, why: "repetition" };
  else if (s.mv.length >= MAX_PLIES) s.end = { winner: null, why: "longue" };
}

function freshState(s) {
  s.b = s.start.b; s.side = 0; s.cr = s.start.cr.slice(); s.ep = -1; s.half = 0; s.chk = [0, 0];
  s.mv = []; s.san = []; s.reps = []; s.last = null; s.end = null; s.lost = ["", ""];
}

export function setup(players, settings, rng) {
  const order = rng.next() < 0.5 ? [players[0].id, players[1].id] : [players[1].id, players[0].id]; // order[0] a les Blancs
  const v = optVal("variant", settings.variant);
  const undo = optVal("undo", settings.undo);
  const pos = startPos(v, rng);
  const s = { order, v, hints: optVal("hints", settings.hints), undo, jok: { [order[0]]: undo, [order[1]]: undo },
    level: [1, 2, 3].includes(settings.level) ? settings.level : 2, start: { b: boardToStr(pos.b), cr: pos.cr.slice() } };
  freshState(s);
  s.reps = [keyOf(pos)];
  return s;
}

export function toAct(s) { return s.end ? [] : [s.order[s.side]]; }

// retrouve le coup légal correspondant à une action { from, to, promo }
export function findMove(s, from, to, promo) {
  const pos = posOf(s);
  const legal = legalMoves(pos);
  const norm = legal.filter((m) => mFlag(m) !== 3 && mFrom(m) === from && mTo(m) === to);
  if (norm.length) {
    if (norm.length === 1) return norm[0];
    const pr = [Q, N, R, B].includes(promo) ? promo : Q;
    return norm.find((m) => mPromo(m) === pr) || null;
  }
  // roque : case de la tour, ou case d'arrivée du roi (si ce n'est pas déjà un coup normal)
  return legal.find((m) => mFlag(m) === 3 && mFrom(m) === from && (mTo(m) === to || kingDest(m) === to)) || null;
}

export function reduce(s, pid, a) {
  if (!s.order.includes(pid)) fail("Tu ne joues pas cette partie");
  if (s.end) fail("La partie est terminée");
  if (a.type === "resign") { s.end = { winner: s.order.find((x) => x !== pid), why: "abandon" }; return s; }
  if (toAct(s)[0] !== pid) fail("Ce n'est pas ton tour");
  if (a.type === "undo") {
    if (!(s.jok[pid] > 0)) fail("Plus de retour disponible");
    if (s.mv.length < 2) fail("Rien à annuler");
    const moves = s.mv.slice(0, -2);
    const jok = s.jok;
    freshState(s);
    s.reps = [keyOf(posOf(s))];
    for (const m of moves) playInState(s, m);
    s.jok = jok;
    s.jok[pid]--;
    s.undone = (s.undone || 0) + 1;
    return s;
  }
  if (a.type !== "move") fail("Action inconnue");
  const from = Number(a.from), to = Number(a.to);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 63 || to < 0 || to > 63) fail("Case invalide");
  const m = findMove(s, from, to, Number(a.promo));
  if (m == null) fail("Coup illégal");
  playInState(s, m);
  return s;
}

export function result(s) {
  if (!s.end) return null;
  const w = s.end.winner;
  if (!w) return { ranking: s.order.map((id) => ({ id, rank: 1, score: 0.5 })) };
  return { ranking: [{ id: w, rank: 1, score: 1 }, { id: s.order.find((x) => x !== w), rank: 2, score: 0 }] };
}

// ------------------------------------------------------------------ robot
export const VAL = [0, 100, 320, 330, 500, 900, 0];
// tables de position (vue des Blancs, case 0 = a8)
const PST = [
  [],
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
];
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
const hillDist = (sq) => Math.max(Math.abs((sq >> 3) - 3.5), Math.abs((sq & 7) - 3.5)) - 0.5; // 0 sur la colline

// évaluation du point de vue du camp au trait
export function evaluate(pos) {
  const b = pos.b;
  let sc = 0, heavy = 0;
  for (let i = 0; i < 64; i++) { const p = b[i]; if (p && typeOf(p) !== P && typeOf(p) !== K) heavy += VAL[typeOf(p)]; }
  const endgame = heavy <= 1600;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const t = typeOf(p), c = colorOf(p);
    const sq = c ? i ^ 56 : i;
    const v = VAL[t] + (t === K && endgame ? KING_END[sq] : PST[t][sq]);
    sc += c ? -v : v;
  }
  if (pos.v === "colline") sc += 45 * (hillDist(pos.kp[1]) - hillDist(pos.kp[0]));
  if (pos.v === "3echecs") sc += 140 * (pos.chk[0] - pos.chk[1]);
  return pos.side ? -sc : sc;
}

const MATE = 100000;
// victoire immédiate d'une variante pour le camp qui vient de jouer
function variantWin(np, mover) {
  if (np.v === "colline") return HILL.includes(np.kp[mover]);
  if (np.v === "3echecs") return np.chk[mover] >= 3;
  return false;
}
const orderScore = (pos, m) => {
  const cap = pos.b[mTo(m)];
  let s = 0;
  if (cap && mFlag(m) !== 3) s += 10 * VAL[typeOf(cap)] - VAL[typeOf(pos.b[mFrom(m)])];
  if (mFlag(m) === 2) s += 900;
  if (mPromo(m)) s += VAL[mPromo(m)] * 10;
  return s;
};
function sortMoves(pos, moves, first) {
  const sc = moves.map((m) => (m === first ? 1e9 : orderScore(pos, m)));
  const idx = moves.map((_, i) => i).sort((a, c) => sc[c] - sc[a]);
  return idx.map((i) => moves[i]);
}

function quiesce(g, pos, alpha, beta, qd) {
  g.nodes++;
  const stand = evaluate(pos);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qd <= 0 || g.nodes > g.budget) return stand;
  for (const m of sortMoves(pos, pseudoMoves(pos, true))) {
    const np = makeMove(pos, m); g.nodes++;
    if (attacked(np.b, np.kp[pos.side], np.side)) continue;
    const v = variantWin(np, pos.side) ? MATE : -quiesce(g, np, -beta, -alpha, qd - 1);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(g, pos, depth, alpha, beta, ply) {
  if (depth <= 0) return quiesce(g, pos, alpha, beta, 4);
  g.nodes++;
  let any = false, best = -Infinity;
  for (const m of sortMoves(pos, pseudoMoves(pos))) {
    const np = makeMove(pos, m); g.nodes++;
    if (attacked(np.b, np.kp[pos.side], np.side)) continue;
    any = true;
    const v = variantWin(np, pos.side) ? MATE - ply : -negamax(g, np, depth - 1, -beta, -alpha, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta || g.nodes > g.budget) break;
  }
  if (!any) return inCheck(pos) ? -MATE + ply : 0;
  return best;
}

// recherche à la racine : approfondissement progressif borné par un nombre de positions
export function think(pos, maxDepth, budget, rng, noise = 0) {
  const legal = legalMoves(pos);
  if (!legal.length) return null;
  const g = { nodes: 0, budget };
  let bestMove = legal[0], order = legal;
  const jitter = new Map(legal.map((m) => [m, noise ? Math.floor((rng.next() - 0.5) * 2 * noise) : 0]));
  for (let d = 1; d <= maxDepth; d++) {
    let best = -Infinity, bm = null, alpha = -Infinity;
    const scores = new Map();
    for (const m of sortMoves(pos, order, bestMove)) {
      const np = makeMove(pos, m);
      let v = variantWin(np, pos.side) ? MATE : -negamax(g, np, d - 1, -Infinity, -alpha + 60, 1);
      if (Math.abs(v) < MATE / 2) v += jitter.get(m);
      scores.set(m, v);
      if (v > best) { best = v; bm = m; }
      if (v > alpha) alpha = v;
      if (g.nodes > g.budget && d > 1) break;
    }
    if (g.nodes > g.budget && d > 1) break; // profondeur inachevée : on garde la précédente
    bestMove = bm;
    order = legal.slice().sort((a, c) => (scores.get(c) ?? -1e9) - (scores.get(a) ?? -1e9));
    if (best >= MATE / 2) break;
    if (g.nodes > g.budget) break;
  }
  return bestMove;
}

const LVL = { 1: [1, 2000, 160], 2: [2, 10000, 25], 3: [4, 30000, 8] };
export function botMove(s, rng, level = s.level) {
  const pos = posOf(s);
  const legal = legalMoves(pos);
  if (!legal.length) return null;
  if (level <= 1) {
    // débutant : un coup légal, souvent au hasard, sinon le plus tentant à un coup
    if (rng.next() < 0.35) return rng.pick(legal);
    let best = -Infinity, bm = legal[0];
    for (const m of legal) {
      const np = makeMove(pos, m);
      let v = variantWin(np, pos.side) ? MATE : -evaluate(np);
      if (inCheck(np) && !legalMoves(np).length) v = MATE;
      v += (rng.next() - 0.5) * 2 * LVL[1][2];
      if (v > best) { best = v; bm = m; }
    }
    return bm;
  }
  const [d, budget, noise] = LVL[level] || LVL[2];
  return think(pos, d, budget, rng, noise);
}

export function bot(s, pid, rng) {
  if (s.end || toAct(s)[0] !== pid) return null;
  const m = botMove(s, rng);
  if (m == null) return null;
  const a = { type: "move", from: mFrom(m), to: mTo(m) };
  if (mPromo(m)) a.promo = mPromo(m);
  return a;
}
// temps écoulé : un coup sûr et rapide
export function auto(s, pid, rng) {
  if (s.end || toAct(s)[0] !== pid) return null;
  const m = botMove(s, rng, 2);
  if (m == null) return null;
  const a = { type: "move", from: mFrom(m), to: mTo(m) };
  if (mPromo(m)) a.promo = mPromo(m);
  return a;
}
export const botDelay = (s, pid, rng) => 500 + Math.floor((rng ? rng.next() : 0.5) * 700);
