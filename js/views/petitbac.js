import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { catLabel, catIcon, deadline, filled, judge, VOTE_SECS } from "../games/petitbac.js";

export const scoreOf = (s, id) => s.scores[id];
export const scoreLabel = (n) => `${n} pt${n > 1 ? "s" : ""}`;

const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));

export function mount(root, ctx0) {
  const el = h("div", { class: "g-petitbac" });
  root.append(el);
  let ctx = ctx0, roundKey = "", inputs = [], sent = [], timers = {}, votes = [], voteKey = "", closing = "", lastPhase = "", doneRound = 0;
  const head = h("div", { class: "g-petitbac-head" });
  const body = h("div", { class: "g-petitbac-body" });
  const foot = h("div", { class: "g-petitbac-foot" });
  el.append(head, body, foot);

  const mine = () => ctx.state.ans[ctx.me] || [];
  const iPlay = () => ctx.state.phase === "play" && ctx.state.sub[ctx.me] === false;

  function save(i) {
    clearTimeout(timers[i]);
    if (!iPlay()) return;
    const v = inputs[i].value.trim();
    if (v === (sent[i] ?? mine()[i] ?? "")) return;
    sent[i] = v;
    ctx.act({ type: "fill", cat: i, word: v });
  }
  function answers() { return inputs.map((x) => x.value.trim()); }
  function submit() {
    if (!iPlay() || doneRound === ctx.state.roundNo) return;
    doneRound = ctx.state.roundNo;
    Object.values(timers).forEach(clearTimeout);
    ctx.sfx.ok();
    ctx.act({ type: "done", answers: answers() });
  }

  // grille de saisie, construite une fois par manche pour garder le focus
  function buildPlay() {
    const s = ctx.state;
    inputs = []; sent = [];
    const list = h("div", { class: "g-petitbac-grid" });
    s.cats.forEach((k, i) => {
      const inp = h("input", { class: "g-petitbac-in", type: "text", autocomplete: "off", autocapitalize: "words", spellcheck: "false", maxlength: "40",
        placeholder: `${s.letter}…`, "aria-label": catLabel(k), value: mine()[i] || "" });
      inp.addEventListener("input", () => { mark(i); clearTimeout(timers[i]); timers[i] = setTimeout(() => save(i), 1200); refreshFoot(); });
      inp.addEventListener("change", () => save(i));
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(i); (inputs[i + 1] || inp).focus(); if (!inputs[i + 1]) inp.blur(); } });
      inputs.push(inp);
      list.append(h("label", { class: "g-petitbac-cell", dataset: { i } }, h("span", { class: "g-petitbac-cat" }, h("i", null, catIcon(k)), catLabel(k)), inp));
    });
    body.replaceChildren(list);
    inputs.forEach((_, i) => mark(i));
  }
  function mark(i) {
    const s = ctx.state, v = inputs[i].value.trim(), cell = inputs[i].parentNode;
    if (!cell) return;
    const j = v ? judge(s.cats[i], s.letter, v) : { code: "e" };
    cell.classList.toggle("bad", j.code === "x");
    cell.classList.toggle("ok", j.code === "v" || j.code === "d");
  }

  function drawHead() {
    const s = ctx.state;
    const now = Date.now();
    let clock = "";
    if (s.phase === "play") clock = s.stopAt ? `Stop ! ${secs(s.stopAt - now)} s` : `${secs(deadline(s) - now)} s`;
    if (s.phase === "vote") clock = `Vote ${secs(s.voteAt + VOTE_SECS * 1000 - now)} s`;
    head.replaceChildren(
      h("div", { class: "g-petitbac-letter" + (s.phase === "play" ? " pop" : "") }, s.letter),
      h("div", { class: "g-petitbac-info" },
        h("div", { class: "small dim" }, `Manche ${s.roundNo} / ${s.rounds}`),
        h("div", { class: "g-petitbac-clock" + (s.stopAt && s.phase === "play" ? " stop" : "") }, clock),
        h("div", { class: "small" }, "Score ", h("b", null, s.scores[ctx.me] ?? 0))),
      h("div", { class: "g-petitbac-others" }, s.ids.filter((id) => id !== ctx.me).map((id) => h("span", { class: "chip g-petitbac-chip" + (s.sub[id] ? " done" : "") },
        nameOf(ctx, id), " ", h("b", null, s.phase === "play" ? `${filled(s, id)}/${s.cats.length}` : `${s.scores[id]}`)))));
  }

  function refreshFoot() {
    const s = ctx.state;
    if (s.phase !== "play") return;
    if (!iPlay()) {
      foot.replaceChildren(h("div", { class: "turnmsg" }, s.stopBy === ctx.me ? "Tu as crié Stop ! Les autres finissent…" : "Grille rendue, on attend les autres…"));
      return;
    }
    const all = answers().every((x) => x);
    const msg = s.stopAt ? `${nameOf(ctx, s.stopBy)} a crié Stop ! Vite, termine !` : `Des mots en ${s.letter} partout, puis Stop !`;
    foot.replaceChildren(
      h("div", { class: "turnmsg me" + (s.stopAt ? " g-petitbac-alert" : "") }, msg),
      h("button", { class: "btn block " + (all ? "red g-petitbac-stop" : s.stopAt ? "gold" : "ghost"), disabled: !all && !s.stopAt, onclick: submit },
        all ? "✋ Stop !" : s.stopAt ? "Rendre ma grille" : `Encore ${answers().filter((x) => !x).length} case(s)`));
  }

  function drawVote() {
    const s = ctx.state;
    const key = s.roundNo + ":" + s.doubts.length;
    if (voteKey !== key) { voteKey = key; votes = s.doubts.map(() => null); }
    const todo = s.doubts.map((d, i) => [d, i]).filter(([d]) => !d.by.includes(ctx.me));
    const can = !!(todo.length && !s.votes[ctx.me]);
    body.replaceChildren(h("div", { class: "g-petitbac-votes" },
      h("div", { class: "h3 center" }, "Ces mots sont-ils valables ?"),
      h("div", { class: "small dim center" }, `Lettre ${s.letter}. Ils ne sont pas dans nos listes : à vous de juger.`),
      s.doubts.map((d, i) => h("div", { class: "g-petitbac-vrow card" },
        h("div", { class: "grow" }, h("div", { class: "small dim" }, catIcon(s.cats[d.c]), " ", catLabel(s.cats[d.c])), h("b", { class: "g-petitbac-word" }, d.w)),
        d.by.includes(ctx.me) ? h("span", { class: "small dim" }, "ton mot") :
          h("div", { class: "row gap" },
            h("button", { class: "btn small " + (votes[i] === 1 ? "green" : "ghost"), disabled: !can, onclick: () => { votes[i] = 1; ctx.sfx.tap(); drawVote(); } }, "👍 Oui"),
            h("button", { class: "btn small " + (votes[i] === 0 ? "red" : "ghost"), disabled: !can, onclick: () => { votes[i] = 0; ctx.sfx.tap(); drawVote(); } }, "👎 Non"))))));
    foot.replaceChildren(can
      ? h("button", { class: "btn block purple", onclick: () => { ctx.sfx.ok(); ctx.act({ type: "vote", ok: votes }); } }, "Valider mes votes")
      : h("div", { class: "turnmsg" }, "On attend les votes des autres…"));
  }

  function drawRecap() {
    const s = ctx.state;
    const order = s.ids.slice().sort((a, b) => (s.pts[b] || 0) - (s.pts[a] || 0));
    const cls = { v: "ok", a: "ok", r: "no", x: "no", e: "empty", d: "no" };
    body.replaceChildren(h("div", { class: "g-petitbac-recap" },
      h("div", { class: "g-petitbac-podium" }, order.map((id) => h("div", { class: "g-petitbac-pp" + (id === ctx.me ? " me" : "") },
        h("span", null, nameOf(ctx, id)), h("b", null, `+${s.pts[id] || 0}`)))),
      s.cats.map((k, i) => h("div", { class: "g-petitbac-rc card" },
        h("div", { class: "g-petitbac-cat" }, h("i", null, catIcon(k)), catLabel(k)),
        h("div", { class: "g-petitbac-ans" }, s.ids.map((id) => {
          const r = s.res[id][i], w = s.ans[id][i] || "";
          return h("span", { class: "g-petitbac-a " + cls[r.c] + (id === ctx.me ? " me" : "") },
            h("small", null, nameOf(ctx, id)), w || "…", r.p ? h("b", null, `+${r.p}`) : null);
        }))))));
    foot.replaceChildren(s.done ? h("div", { class: "turnmsg" }, "Partie terminée !")
      : s.ready[ctx.me] ? h("div", { class: "turnmsg" }, "On attend les autres…")
        : h("button", { class: "btn block green", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "ready" }); } }, s.roundNo >= s.rounds ? "Voir le classement" : "Manche suivante ▶"));
  }

  function update(c) {
    ctx = c;
    const s = ctx.state;
    const key = s.roundNo + ":" + s.phase;
    if (key !== roundKey) {
      roundKey = key;
      if (s.phase === "play") { buildPlay(); ctx.sfx.card(); }
      if (s.phase === "recap" && lastPhase && lastPhase !== "recap") ((s.pts[ctx.me] || 0) > 0 ? ctx.sfx.coin : ctx.sfx.bad)();
    }
    if (s.phase === "play") {
      const lock = !iPlay();
      inputs.forEach((inp, i) => { inp.disabled = lock; if (lock) inp.value = mine()[i] || ""; });
      if (s.stopAt && lastStop !== s.stopAt) { lastStop = s.stopAt; if (s.stopBy !== ctx.me) { ctx.sfx.bad(); ctx.buzz(60); } }
      refreshFoot();
    } else if (s.phase === "vote") drawVote();
    else drawRecap();
    lastPhase = s.phase;
    drawHead();
  }
  let lastStop = 0;

  // horloge : affichage, rendu automatique à la fin et clôture de secours
  const tick = setInterval(() => {
    const s = ctx.state;
    if (!s || s.done) return;
    drawHead();
    const now = Date.now();
    if (s.phase === "play") {
      const dl = deadline(s);
      if (iPlay() && now > dl - 400) submit();
      const k = s.roundNo + ":p";
      if (now > dl + (ctx.isHost ? 1500 : 6000) && closing !== k && s.ids.some((id) => !s.sub[id])) { closing = k; ctx.act({ type: "close" }); }
    } else if (s.phase === "vote") {
      const k = s.roundNo + ":v";
      if (now > s.voteAt + VOTE_SECS * 1000 + (ctx.isHost ? 1000 : 6000) && closing !== k) { closing = k; ctx.act({ type: "close" }); }
    }
  }, 250);

  update(ctx0);
  return { update, destroy() { clearInterval(tick); Object.values(timers).forEach(clearTimeout); } };
}
