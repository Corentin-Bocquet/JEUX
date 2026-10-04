import { h } from "../ui.js";
import { nameOf } from "./common.js";
import { letters, wordCells, doneWords } from "../games/motscroises.js";
import { normWord } from "../data/dico.js";

export const scoreOf = (s, id) => s.scores[id];
export const scoreLabel = (n) => `${n} pts`;

export function mount(root, ctx0) {
  const el = h("div", { class: "g-motscroises" });
  root.append(el);
  let ctx = ctx0, sel = -1, typed = "", lastKey = "";
  function update(c) {
    ctx = c;
    const s = c.state;
    if (s.last) {
      const k = JSON.stringify([s.last, s.scores[c.me]]);
      if (lastKey && k !== lastKey && s.last.id === c.me) {
        if (s.last.ok) { c.sfx.ok(); typed = ""; } else if (s.last.ok === false) { c.sfx.bad(); c.buzz(40); }
      }
      lastKey = k;
    }
    const done = doneWords(s, c.me);
    if (sel < 0 || done.includes(sel)) { sel = s.words.findIndex((_, i) => !done.includes(i)); typed = ""; }
    draw();
  }
  function draw() {
    const s = ctx.state, me = ctx.me;
    const vis = letters(s, me), done = doneWords(s, me);
    const playing = s.status[me] === "playing";
    const act = sel >= 0 ? s.words[sel] : null;
    const actCells = act ? wordCells(s, act) : [];
    const nums = {};
    for (const x of s.words) nums[x.at] = x.n;
    const grid = h("div", { class: "g-motscroises-grid", style: { gridTemplateColumns: `repeat(${s.w}, 1fr)`, maxWidth: `${s.w * 40}px` } });
    for (let i = 0; i < s.w * s.h; i++) {
      if (s.cells[i] === "#") { grid.append(h("span", { class: "g-motscroises-black" })); continue; }
      const k = actCells.indexOf(i);
      let ch = vis[i] || "", cls = "g-motscroises-cell";
      if (k >= 0) { cls += " act"; if (typed[k]) { ch = typed[k]; cls += " typed"; } }
      if (vis[i] && s.words.some((x, wi) => done.includes(wi) && wordCells(s, x).includes(i))) cls += " ok";
      grid.append(h("button", { class: cls, onclick: () => tapCell(i) }, nums[i] ? h("small", null, nums[i]) : null, ch));
    }
    const input = act && playing ? h("form", { class: "g-motscroises-input glass", onsubmit: (e) => { e.preventDefault(); send(); } },
      h("div", { class: "small dim" }, `${act.n} ${act.dir === "a" ? "horizontal" : "vertical"} · ${act.w.length} lettres`),
      h("div", { class: "h3" }, act.d),
      h("div", { class: "row gap" },
        h("input", { class: "input grow", id: "mc-in", value: typed, maxlength: act.w.length, autocomplete: "off", autocapitalize: "characters", spellcheck: "false",
          placeholder: actCells.map((c) => vis[c] || "_").join(" "), oninput: (e) => { typed = normWord(e.target.value).slice(0, act.w.length); e.target.value = typed; paint(); } }),
        h("button", { class: "btn green", type: "submit" }, "OK"))) : null;
    const others = h("div", { class: "g-motscroises-others" }, s.ids.map((id) => {
      const n = doneWords(s, id).length;
      return h("div", { class: "g-motscroises-prog" + (id === me ? " me" : "") },
        h("span", { class: "small" }, nameOf(ctx, id), s.status[id] === "done" ? " ✓" : ""),
        h("i", null, h("b", { style: { width: `${Math.round((100 * n) / s.words.length)}%` } })),
        h("span", { class: "small dim" }, `${n}/${s.words.length}`));
    }));
    const list = (dir, title) => h("div", { class: "g-motscroises-list" }, h("div", { class: "h3" }, title),
      s.words.map((x, i) => [x, i]).filter(([x]) => x.dir === dir).map(([x, i]) =>
        h("button", { class: "g-motscroises-clue" + (i === sel ? " on" : "") + (done.includes(i) ? " done" : ""), onclick: () => pick(i) },
          h("b", null, x.n), " ", x.d, h("span", { class: "dim" }, ` (${x.w.length})`))));
    const status = playing ? null : h("div", { class: "turnmsg me" }, "Grille finie ! On attend les autres…");
    const hadFocus = document.activeElement && document.activeElement.id === "mc-in";
    el.replaceChildren(others, status, grid, input,
      h("div", { class: "g-motscroises-lists" }, list("a", "Horizontalement"), list("d", "Verticalement")),
      playing ? h("div", { class: "row center" }, h("button", { class: "btn ghost small", onclick: () => ctx.act({ type: "giveup" }) }, "J'arrête là")) : null,
      h("p", { class: "tiny dim center" }, `Mot juste : 1 point par lettre${s.bonus ? `, +${s.bonus} au premier` : ""}. Erreur : ${s.penalty ? "-" + s.penalty : "gratuite"}.`));
    if (hadFocus) { const i = document.getElementById("mc-in"); if (i) { i.focus({ preventScroll: true }); i.setSelectionRange(typed.length, typed.length); } }
    function paint() {
      const cells = grid.children;
      actCells.forEach((ci, k) => { if (!vis[ci]) { const b = cells[ci]; b.lastChild && b.lastChild.nodeType === 3 ? (b.lastChild.textContent = typed[k] || "") : b.append(typed[k] || ""); } });
    }
  }
  function pick(i) {
    if (doneWords(ctx.state, ctx.me).includes(i)) return;
    sel = i; typed = ""; ctx.sfx.tap(); draw();
    setTimeout(() => document.getElementById("mc-in")?.focus({ preventScroll: true }), 30);
  }
  function tapCell(c) {
    const s = ctx.state, done = doneWords(s, ctx.me);
    const ws = s.words.map((x, i) => i).filter((i) => !done.includes(i) && wordCells(s, s.words[i]).includes(c));
    if (!ws.length) return;
    pick(ws.length > 1 && ws[0] === sel ? ws[1] : ws[0]);
  }
  function send() {
    const s = ctx.state, x = s.words[sel];
    if (!x) return;
    const vis = letters(s, ctx.me);
    const ans = wordCells(s, x).map((c, k) => typed[k] || vis[c] || "").join("");
    if (ans.length !== x.w.length) { ctx.toast(`Il faut ${x.w.length} lettres`, "err"); return; }
    ctx.act({ type: "answer", word: sel, text: ans });
  }
  update(ctx0);
  return { update };
}
