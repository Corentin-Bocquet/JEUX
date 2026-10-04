import { h } from "../ui.js";
import { mountFlash, scoreOf, scoreLabel } from "../games/lib/flash_view.js";
import { COUNTRIES, CONTINENTS, flagOf, answerText } from "../games/geo.js";
import { typo } from "../games/lib/flash.js";

export { scoreOf, scoreLabel };
const P = "g-geo";
const TAG = { cap: "Capitale", pays: "Pays", drap: "Drapeau", cont: "Continent" };
const ASK = { cap: "Quelle est la capitale de ce pays ?", pays: "De quel pays est-ce la capitale ?", drap: "À quel pays appartient ce drapeau ?", cont: "Sur quel continent se trouve ce pays ?" };
const flag = (iso, big) => h("span", { class: `${P}-flag${big ? " big" : ""}`, "aria-hidden": "true" }, flagOf(iso));

function prompt(ctx, q) {
  const p = COUNTRIES[q.c];
  let main;
  if (q.t === "cap") main = h("div", { class: `${P}-big` }, flag(p.iso), " ", p.n);
  else if (q.t === "pays") main = h("div", { class: `${P}-big` }, "🏛️ ", p.c);
  else if (q.t === "drap") main = flag(p.iso, true);
  else main = h("div", { class: `${P}-big` }, p.n);
  return h("div", null, h("div", { class: `${P}-askq` }, typo(ASK[q.t])), main);
}

function answers(ctx, q, send, mine) {
  if (q.t === "cont" || q.ch) {
    const vals = q.t === "cont" ? CONTINENTS : q.ch;
    return h("div", { class: `${P}-grid${q.t === "cont" ? " cont" : ""}` }, vals.map((v, i) => h("button", {
      class: `${P}-opt${mine && mine.v === v ? " picked" : ""}${mine && mine.v !== v ? " off" : ""}`,
      style: { animationDelay: `${i * 50}ms` }, disabled: !!mine, onclick: () => send(v),
    }, answerText(q, v))));
  }
  const input = h("input", { class: `input ${P}-in`, type: "text", placeholder: q.t === "cap" ? "Tape la capitale…" : "Tape le pays…",
    autocomplete: "off", autocapitalize: "words", spellcheck: "false", maxlength: "40", disabled: !!mine, value: mine ? mine.v || "" : "" });
  const go = () => { const v = input.value.trim(); if (v) send(v); };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  if (!mine) setTimeout(() => { try { input.focus({ preventScroll: true }); } catch {} }, 60);
  return h("div", { class: `${P}-type` }, input,
    h("button", { class: "btn green", disabled: !!mine, onclick: go }, mine ? "Envoyé" : "Valider"),
    h("div", { class: "small dim center" }, "Accents et majuscules facultatifs, une faute tolérée."));
}

function reveal(ctx, last) {
  const q = last.q;
  const p = COUNTRIES[q.c];
  const row = (k, label, val) => h("div", { class: `${P}-fact${k ? " hit" : ""}` }, h("span", { class: "dim" }, label), h("b", null, val));
  return h("div", null,
    flag(p.iso, true),
    h("div", { class: `${P}-big` }, p.n),
    h("div", { class: `${P}-facts` },
      p.nc ? null : row(q.t === "cap", "Capitale", p.c),
      row(q.t === "cont", "Continent", p.k)));
}

export function mount(root, ctx) {
  return mountFlash(root, ctx, {
    id: "geo",
    tag: (q) => TAG[q.t],
    prompt, answers, reveal,
    label: (s, q, v) => answerText(q, v),
  });
}
