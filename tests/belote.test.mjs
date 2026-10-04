import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/games/belote.js";
import { RULES } from "../js/games/belote.js";
import { makeRules, deck32, partnerOf, teamOf, isMaster, botCard } from "../js/games/lib/plis32.js";
import { start, apply, rng } from "../js/engine.js";
import { playout, timeoutPlayout } from "./harness.mjs";

const P4 = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
const R0 = { next: () => 0.5, int: () => 0, pick: (l) => l[0] };

test("paquet de 32 cartes et valeurs : 152 points + dix de der", () => {
  const d = deck32();
  assert.equal(d.length, 32);
  assert.equal(new Set(d).size, 32);
  for (const t of ["S", "H", "D", "C"]) assert.equal(RULES.points(d, t), 152);
  assert.equal(RULES.value("JH", "H"), 20);
  assert.equal(RULES.value("9H", "H"), 14);
  assert.equal(RULES.value("JH", "S"), 2);
  assert.equal(RULES.value("9H", "S"), 0);
  assert.equal(RULES.value("10S", "H"), 10);
});

test("ordre des cartes à l'atout et hors atout", () => {
  const tr = "H";
  // atout : V > 9 > A > 10 > R > D > 8 > 7
  const ord = ["JH", "9H", "AH", "10H", "KH", "QH", "8H", "7H"];
  for (let i = 0; i < ord.length - 1; i++) assert.ok(RULES.beats(ord[i], ord[i + 1], tr, "H"), ord[i]);
  // hors atout : A > 10 > R > D > V > 9 > 8 > 7
  const pl = ["AS", "10S", "KS", "QS", "JS", "9S", "8S", "7S"];
  for (let i = 0; i < pl.length - 1; i++) assert.ok(RULES.beats(pl[i], pl[i + 1], tr, "S"), pl[i]);
  // le plus petit atout bat l'as demandé, une autre couleur ne gagne jamais
  assert.equal(RULES.winner([{ p: 0, c: "AS" }, { p: 1, c: "7H" }, { p: 2, c: "10S" }], tr).p, 1);
  assert.equal(RULES.winner([{ p: 0, c: "7S" }, { p: 1, c: "AD" }, { p: 2, c: "8S" }], tr).p, 2);
});

test("obligations : fournir, monter à l'atout, couper, surcouper, partenaire maître", () => {
  const tr = "H";
  // fournir
  assert.deepEqual(RULES.legal(["7S", "AH", "KD"], [{ p: 0, c: "AS" }], tr, 1), ["7S"]);
  // atout demandé : il faut monter
  assert.deepEqual(RULES.legal(["7H", "JH", "8S"], [{ p: 0, c: "AH" }], tr, 1), ["JH"]);
  // atout demandé, impossible de monter : un atout quelconque
  assert.deepEqual(RULES.legal(["7H", "8H", "8S"], [{ p: 0, c: "JH" }], tr, 1).sort(), ["7H", "8H"]);
  // pas la couleur, adversaire maître : couper
  assert.deepEqual(RULES.legal(["7H", "KD", "QC"], [{ p: 0, c: "AS" }], tr, 1), ["7H"]);
  // adversaire a coupé : surcouper
  assert.deepEqual(RULES.legal(["7H", "AH", "KD"], [{ p: 3, c: "AS" }, { p: 0, c: "10H" }], tr, 1), ["AH"]);
  // impossible de surcouper : sous-couper (règle officielle) ou libre (option)
  assert.deepEqual(RULES.legal(["7H", "KD"], [{ p: 3, c: "AS" }, { p: 0, c: "JH" }], tr, 1), ["7H"]);
  const free = makeRules({ ...RULES.cfg, underTrump: false });
  assert.deepEqual(free.legal(["7H", "KD"], [{ p: 3, c: "AS" }, { p: 0, c: "JH" }], tr, 1), ["7H", "KD"]);
  // partenaire maître : on joue ce qu'on veut
  assert.deepEqual(RULES.legal(["7H", "KD"], [{ p: 3, c: "AS" }, { p: 0, c: "7S" }], tr, 1).sort(), ["7H", "KD"]);
  assert.equal(partnerOf(1), 3);
  // la première carte d'un pli est libre
  assert.equal(RULES.legal(["7H", "KD", "AS"], [], tr, 1).length, 3);
});

test("monter sur le partenaire à l'atout demandé", () => {
  // partenaire (place 3) a mis l'As d'atout, place 1 tient le Valet et le 7 : il doit monter
  assert.deepEqual(RULES.legal(["7H", "JH"], [{ p: 3, c: "AH" }], "H", 1), ["JH"]);
});

function fresh(settings = {}) {
  return start(G, P4, settings, 42, 0);
}

test("donne classique : 5 cartes, retourne, prise au 1er tour, 8 cartes ensuite", () => {
  let s = fresh();
  assert.equal(s.phase, "bid1");
  for (const h of s.hands) assert.equal(h.length, 5);
  assert.ok(s.turned);
  assert.equal(s.stock.length, 11);
  const t = s.turned;
  const taker = s.order[s.cur];
  assert.throws(() => apply(G, s, s.order[(s.cur + 1) % 4], { type: "pass" }), /tour/);
  assert.throws(() => apply(G, s, taker, { type: "take", suit: t.slice(-1) === "S" ? "H" : "S" }), /retournée/);
  s = apply(G, s, taker, { type: "take" });
  assert.equal(s.phase, "play");
  assert.equal(s.trump, t.slice(-1));
  for (const h of s.hands) assert.equal(h.length, 8);
  assert.ok(s.hands[s.order.indexOf(taker)].includes(t));
  assert.equal(s.cur, s.first, "le joueur après le donneur entame");
});

test("deuxième tour dans une autre couleur, puis redonne si tout le monde passe", () => {
  let s = fresh();
  for (let k = 0; k < 4; k++) s = apply(G, s, s.order[s.cur], { type: "pass" });
  assert.equal(s.phase, "bid2");
  const ts = s.turned.slice(-1);
  assert.throws(() => apply(G, s, s.order[s.cur], { type: "take", suit: ts }), /autre couleur/);
  const other = ["S", "H", "D", "C"].find((x) => x !== ts);
  const s2 = apply(G, s, s.order[s.cur], { type: "take", suit: other });
  assert.equal(s2.trump, other);
  const dealer = s.dealer;
  for (let k = 0; k < 4; k++) s = apply(G, s, s.order[s.cur], { type: "pass" });
  assert.equal(s.deal, 2);
  assert.equal(s.dealer, (dealer + 1) % 4);
  assert.equal(s.phase, "bid1");
  assert.ok(s.lastDeal.redeal);
});

test("carte illégale refusée avec un message clair", () => {
  let s = fresh();
  s = apply(G, s, s.order[s.cur], { type: "take" });
  const lead = s.order[s.cur];
  s = apply(G, s, lead, { type: "play", card: s.hands[s.cur][0] });
  const seat = s.cur;
  const legal = G.legalCards(s, seat);
  const bad = s.hands[seat].find((c) => !legal.includes(c));
  if (bad) assert.throws(() => apply(G, s, s.order[seat], { type: "play", card: bad }), /fournir|couper|monter/);
  assert.throws(() => apply(G, s, s.order[seat], { type: "play", card: "XX" }), /absente/);
});

// état de fin de donne fabriqué pour tester le calcul des points
function dealState(over) {
  return { variant: "classique", taker: 0, contract: 0, mult: 1, beloteBy: null, belote: 0, tricks: [4, 4], pts: [81, 81], ...over };
}

test("score classique : réussi, dedans, litige, capot, belote", () => {
  let r = G.scoreDeal(dealState({ pts: [100, 62] }));
  assert.equal(r.made, true); assert.deepEqual(r.got, [100, 62]);
  r = G.scoreDeal(dealState({ pts: [70, 92] }));
  assert.equal(r.made, false); assert.deepEqual(r.got, [0, 162]);
  // belote gardée par le preneur même dedans
  r = G.scoreDeal(dealState({ pts: [60, 102], beloteBy: 2, belote: 2 }));
  assert.equal(r.made, false); assert.deepEqual(r.got, [20, 162]);
  // la belote fait passer le contrat
  r = G.scoreDeal(dealState({ pts: [75, 87], beloteBy: 0, belote: 2 }));
  assert.equal(r.made, true); assert.deepEqual(r.got, [95, 87]);
  r = G.scoreDeal(dealState({ pts: [81, 81] }));
  assert.equal(r.made, "litige"); assert.deepEqual(r.got, [0, 81]);
  r = G.scoreDeal(dealState({ pts: [162, 0], tricks: [8, 0], beloteBy: 1, belote: 2 }));
  assert.equal(r.capot, 0); assert.deepEqual(r.got, [250, 20]);
  r = G.scoreDeal(dealState({ pts: [0, 162], tricks: [0, 8] }));
  assert.deepEqual(r.got, [0, 250]);
});

test("score coinché : contrat, coinche, chute", () => {
  const c = (o) => G.scoreDeal(dealState({ variant: "coinche", contract: 100, ...o }));
  assert.deepEqual(c({ pts: [110, 52] }).got, [210, 52]);
  assert.deepEqual(c({ pts: [90, 72] }).got, [0, 260]);
  assert.deepEqual(c({ pts: [110, 52], mult: 2 }).got, [310, 0]);
  assert.deepEqual(c({ pts: [90, 72], mult: 2 }).got, [0, 360]);
  assert.deepEqual(c({ pts: [90, 72], beloteBy: 0, belote: 2 }).got, [100 + 110, 72]);
});

test("enchères coinchées : monter, coincher, surcoincher", () => {
  let s = fresh({ variant: "coinche" });
  assert.equal(s.phase, "auction");
  for (const h of s.hands) assert.equal(h.length, 8);
  const p = () => s.order[s.cur];
  assert.throws(() => apply(G, s, p(), { type: "bid", v: 75, suit: "H" }), /80 à 160/);
  assert.throws(() => apply(G, s, p(), { type: "coinche" }), /Rien/);
  s = apply(G, s, p(), { type: "bid", v: 90, suit: "H" });
  assert.throws(() => apply(G, s, p(), { type: "bid", v: 90, suit: "S" }), /plus haut/);
  s = apply(G, s, p(), { type: "pass" });
  // le partenaire du preneur ne peut pas coincher
  assert.throws(() => apply(G, s, p(), { type: "coinche" }), /équipe/);
  s = apply(G, s, p(), { type: "bid", v: 110, suit: "S" });
  const declarer = s.bid.p;
  s = apply(G, s, p(), { type: "coinche" });
  assert.equal(s.phase, "surco");
  assert.equal(s.cur, declarer);
  s = apply(G, s, p(), { type: "surco" });
  assert.equal(s.phase, "play");
  assert.equal(s.mult, 4);
  assert.equal(s.contract, 110);
  assert.equal(s.trump, "S");
  assert.equal(s.taker, declarer);
});

test("quatre passes en coinche : on redonne", () => {
  let s = fresh({ variant: "coinche" });
  for (let k = 0; k < 4; k++) s = apply(G, s, s.order[s.cur], { type: "pass" });
  assert.equal(s.deal, 2);
  assert.equal(s.phase, "auction");
});

test("belote et rebelote annoncées en jouant Roi et Dame d'atout", () => {
  let found = false;
  for (let seed = 1; seed < 60 && !found; seed++) {
    playout(G, 4, seed, { onStep: (st) => { if (st.lastPlay && st.lastPlay.say === "Rebelote") found = true; } });
  }
  assert.ok(found);
});

test("robots : jouent maître, chargent le partenaire, coupent petit", () => {
  // je suis place 1, le pli vient de l'adversaire avec l'As : je coupe avec le plus petit atout
  const a = botCard(RULES, { hand: ["7H", "JH", "8D"], trick: [{ p: 0, c: "AS" }], trump: "H", me: 1, seen: [], level: 2, rng: R0 });
  assert.equal(a, "7H");
  // partenaire (place 3) maître en dernière position : je charge le 10
  const b = botCard(RULES, { hand: ["10D", "7D"], trick: [{ p: 2, c: "7S" }, { p: 3, c: "AS" }, { p: 0, c: "8S" }], trump: "H", me: 1, seen: [], level: 2, rng: R0 });
  assert.equal(b, "10D");
  // adversaire maître et je ne peux rien : je me défausse petit
  const c = botCard(RULES, { hand: ["10D", "7C"], trick: [{ p: 0, c: "AS" }], trump: "H", me: 1, seen: ["JH", "9H", "AH", "10H", "KH", "QH", "8H", "7H"], level: 2, rng: R0 });
  assert.equal(c, "7C");
  // as maître à l'entame
  assert.ok(isMaster(RULES, "AS", "H", []));
  assert.ok(!isMaster(RULES, "10S", "H", []));
  assert.ok(isMaster(RULES, "10S", "H", ["AS"]));
  const d = botCard(RULES, { hand: ["AS", "7C", "8D"], trick: [], trump: "H", me: 1, seen: [], level: 2, rng: R0 });
  assert.equal(d, "AS");
});

test("robot : prise raisonnable", () => {
  assert.ok(G.handStrength(["JH", "9H", "AH", "AS", "7C", "8D"], "H") >= 58);
  assert.ok(G.handStrength(["7H", "8S", "9C", "QD", "KS", "8C"], "H") < 30);
});

test("table complétée par des robots internes", () => {
  for (const n of [1, 2, 3]) {
    const { st } = playout(G, n, 7 + n);
    assert.equal(st.order.length, 4);
    assert.equal(st.virt.length, 4 - n);
    assert.equal(st.result.ranking.length, n);
  }
});

test("parties complètes pour chaque mode et chaque niveau", () => {
  for (const m of G.modes) for (let seed = 1; seed <= 4; seed++) {
    const { st } = playout(G, 4, seed, { settings: { ...m.set, level: 1 + (seed % 3) } });
    assert.ok(Math.max(...st.scores) >= m.set.target);
    assert.notEqual(st.scores[0], st.scores[1]);
    const w = st.result.ranking.filter((r) => r.rank === 1).map((r) => teamOf(st.order.indexOf(r.id)));
    assert.deepEqual(w, [st.winner, st.winner]);
    assert.ok(JSON.stringify(st).length < 30000);
  }
  timeoutPlayout(G, 4, 3, { turnTime: 10 });
  timeoutPlayout(G, 4, 5, { ...G.modes[2].set, turnTime: 10 });
});

test("options et modes bien formés", () => {
  const defaults = Object.fromEntries(G.options.map((o) => [o.key, o.def]));
  assert.ok(G.options.length >= 2 && G.options.length <= 5);
  for (const o of G.options) {
    assert.ok(o.label.length <= 12);
    assert.ok(o.values.some((v) => v[0] === o.def), o.key);
    for (const v of o.values) { assert.ok(v[1].length <= 12); if (v[2]) assert.ok(v[2].length <= 18, v[2]); }
    assert.ok(!["level", "turnTime", "mode"].includes(o.key));
  }
  assert.ok(G.modes.length >= 3 && G.modes.length <= 4);
  assert.equal(G.modes[0].name, "Classique");
  assert.deepEqual(G.modes[0].set, defaults);
  assert.equal(new Set(G.modes.map((m) => JSON.stringify(m.set))).size, G.modes.length);
  for (const m of G.modes) for (const [k, v] of Object.entries(m.set)) assert.ok(G.options.find((o) => o.key === k).values.some((x) => x[0] === v));
  // valeurs invalides : retour aux défauts
  const s = start(G, P4, { target: 3, variant: "x", under: "z", level: 9 }, 1, 0);
  assert.equal(s.target, 1000); assert.equal(s.variant, "classique"); assert.equal(s.under, true); assert.equal(s.level, 2);
  const txt = JSON.stringify([G.meta, G.options, G.modes]);
  assert.ok(!txt.includes(String.fromCharCode(0x2014)));
});

test("résultat : équipes sans les robots internes", () => {
  for (const n of [4, 3, 2, 1]) {
    const { st } = playout(G, n, 20 + n);
    const { ranking, teams } = st.result;
    const ids = ranking.map((r) => r.id).sort();
    assert.deepEqual(teams.flat().sort(), ids);
    for (const t of teams) {
      assert.ok(t.length >= 1 && t.length <= 2);
      assert.equal(new Set(t.map((id) => teamOf(st.order.indexOf(id)))).size, 1);
      assert.equal(new Set(t.map((id) => ranking.find((r) => r.id === id).rank)).size, 1);
    }
    if (n === 4) assert.equal(teams.length, 2);
    assert.ok(teams.flat().every((id) => !st.virt.includes(id)));
  }
});
