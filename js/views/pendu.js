import { h } from "../ui.js";
import { turnLine, nameOf } from "./common.js";
import { toAct, checkFree } from "../games/pendu.js";
import { normWord } from "../data/dico.js";

export const scoreOf = (s, id) => s.scores[id];
export const scoreLabel = (n) => `${n} pts`;

const ROWS = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
const COLS = ["#F97316", "#FACC15", "#22C55E", "#0EA5E9", "#A855F7", "#EC4899"];

function balloon(s, popped) {
  const left = Math.max(0, s.lives - s.errors);
  const k = popped ? 0 : 0.42 + 0.58 * (left / s.lives);
  const rx = 66 * k, ry = 76 * k, cx = 100, cy = 98 + (1 - k) * 40;
  const n = s.lives, w = (2 * rx) / n;
  let stripes = "";
  for (let i = 0; i < n; i++) {
    const lost = i >= left;
    stripes += `<rect x="${cx - rx + i * w}" y="0" width="${w + 0.5}" height="240" fill="${lost ? "#94A3B8" : COLS[i % COLS.length]}" opacity="${lost ? 0.45 : 1}"/>`;
  }
  const bottom = cy + ry;
  const body = popped
    ? `<g class="g-pendu-pop"><path d="M100 70l10 22 24-8-14 20 22 12-26 2 4 24-20-16-20 16 4-24-26-2 22-12-14-20 24 8z" fill="#F97316"/><text x="100" y="112" text-anchor="middle" font-size="22" font-weight="900" fill="#fff">POP</text></g>`
    : `<defs><clipPath id="pdclip"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath></defs>
       <g clip-path="url(#pdclip)">${stripes}</g>
       <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>
       <ellipse cx="${cx - rx * 0.4}" cy="${cy - ry * 0.45}" rx="${rx * 0.16}" ry="${ry * 0.22}" fill="#fff" opacity=".45"/>
       <path d="M${cx - 8} ${bottom}l8 7 8-7z" fill="#C2410C"/>
       <path d="M${cx} ${bottom + 6} C ${cx - 14} ${bottom + 30}, ${cx + 14} ${bottom + 50}, ${cx} 222" stroke="currentColor" stroke-width="2" fill="none" opacity=".6"/>`;
  return `<svg viewBox="0 0 200 226" class="g-pendu-svg${popped ? "" : left < s.lives ? " wob" : ""}" aria-label="Ballon : ${left} morceaux restants">${body}</svg>`;
}

export function mount(root, ctx0) {
  const el = h("div", { class: "g-pendu" });
  root.append(el);
  let lastKey = "", guessing = false, typed = "", kbd = null, ctx = ctx0;
  function update(c) {
    ctx = c;
    const s = c.state;
    const k = JSON.stringify([s.roundNo, s.last, s.phase]);
    if (lastKey && k !== lastKey) {
      if (s.phase === "end") s.win === c.me ? c.sfx.win() : s.win ? c.sfx.coin() : c.sfx.bad();
      else if (s.last) s.last.n ? c.sfx.ok() : (c.sfx.bad(), s.last.id === c.me && c.buzz(40));
      if (s.phase !== "guess") { guessing = false; typed = ""; }
    }
    lastKey = k;
    draw();
  }
  function draw() {
    const s = ctx.state, me = ctx.me;
    const who = toAct(s), mine = who.includes(me);
    const isMaster = s.masterId === me;
    const head = h("div", { class: "g-pendu-head" },
      h("span", { class: "chip" }, `Manche ${s.roundNo} / ${s.rounds}`),
      s.phase !== "choose" && (s.showCat || s.phase === "end") ? h("span", { class: "chip g-pendu-cat" }, "🏷️ ", s.cat) : null,
      s.masterId ? h("span", { class: "chip" }, "🎩 ", nameOf(ctx, s.masterId)) : null);
    let msg;
    if (s.phase === "choose") msg = isMaster ? h("div", { class: "turnmsg me" }, "Tu es le maître du mot : choisis le mot secret") : h("div", { class: "turnmsg" }, `${nameOf(ctx, s.masterId)} choisit le mot secret…`);
    else if (s.phase === "end") msg = h("div", { class: "turnmsg" + (s.win === me ? " me" : "") }, s.win ? `${nameOf(ctx, s.win)} a trouvé le mot !` : "Pschhh… le ballon est à plat !");
    else if (isMaster) msg = h("div", { class: "turnmsg" }, `Ton mot : ${s.word}. Les autres cherchent…`);
    else msg = turnLine(ctx, who, "À toi : choisis une lettre");
    const last = s.last && s.phase === "guess" ? h("div", { class: "g-pendu-last small" }, nameOf(ctx, s.last.id), " : ",
      h("b", null, s.last.v), s.last.n ? ` ✓ ${s.last.k === "l" ? `+${s.last.n * 10}` : ""}` : " ✗") : null;
    const popped = s.phase === "end" && !s.win;
    const word = s.phase === "choose" ? null : h("div", { class: "g-pendu-word" + (s.phase === "end" ? " done" : "") },
      s.word.split("").map((c) => {
        const show = s.found.includes(c) || isMaster;
        return h("span", { class: "g-pendu-slot" + (show ? " on" : "") }, show ? c : "");
      }));
    const pic = h("div", { class: "g-pendu-pic", html: balloon(s, popped) },
      h("div", { class: "g-pendu-lives" }, s.phase === "choose" ? "" : `${Math.max(0, s.lives - s.errors)} / ${s.lives}`));
    const wrong = s.wrong.length || s.badWords.length ? h("div", { class: "g-pendu-wrong small dim" }, "Raté : ", h("b", null, [...s.wrong, ...s.badWords].join(" · "))) : null;
    let bottom = null;
    if (s.phase === "choose" && isMaster) {
      bottom = h("div", { class: "g-pendu-choose" },
        s.sugg.map((x) => h("button", { class: "btn gold block", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "choose", word: x.w }); } }, x.w, h("span", { class: "small" }, " · " + x.c))),
        h("form", { class: "row gap", onsubmit: (e) => { e.preventDefault(); const v = e.target.querySelector("input").value; const er = checkFree(v); if (er) return ctx.toast(er, "err"); ctx.act({ type: "choose", word: v }); } },
          h("input", { class: "input grow", placeholder: "Ou ton propre mot", autocomplete: "off", spellcheck: "false" }),
          h("button", { class: "btn green", type: "submit" }, "OK")));
    } else if (s.phase === "end") {
      bottom = mine ? h("div", { class: "row center" }, h("button", { class: "btn green", onclick: () => { ctx.sfx.tap(); ctx.act({ type: "next" }); } }, s.roundNo >= s.rounds ? "Voir les résultats" : "Manche suivante"))
        : h("p", { class: "small dim center" }, `${nameOf(ctx, who[0])} lance la suite…`);
    } else if (s.phase === "guess" && !isMaster) {
      const tried = new Set([...s.found, ...s.wrong]);
      const kb = h("div", { class: "g-pendu-kb" }, ROWS.map((r) => h("div", { class: "g-pendu-kr" }, r.split("").map((c) =>
        h("button", { class: "g-pendu-k" + (s.found.includes(c) ? " ok" : s.wrong.includes(c) ? " no" : ""), disabled: !mine || tried.has(c),
          onclick: () => { ctx.sfx.tap(); ctx.act({ type: "letter", letter: c }); } }, c)))));
      const form = guessing && mine ? h("form", { class: "row gap g-pendu-guess", onsubmit: (e) => { e.preventDefault(); sendWord(); } },
        h("input", { class: "input grow", id: "pd-in", value: typed, maxlength: s.word.length, placeholder: `${s.word.length} lettres`, autocomplete: "off", spellcheck: "false",
          oninput: (e) => { typed = normWord(e.target.value).slice(0, s.word.length); e.target.value = typed; } }),
        h("button", { class: "btn green", type: "submit" }, "OK")) : null;
      bottom = h("div", null, kb,
        h("div", { class: "row center", style: { marginTop: "10px" } }, h("button", { class: "btn purple small", disabled: !mine, onclick: () => { guessing = !guessing; draw(); setTimeout(() => document.getElementById("pd-in")?.focus(), 30); } }, guessing ? "Plutôt une lettre" : "💡 Proposer le mot")),
        form);
    }
    el.replaceChildren(head, msg, h("div", { class: "g-pendu-stage" }, pic, h("div", { class: "g-pendu-right" }, word, wrong, last)), bottom);
  }
  function sendWord() {
    const s = ctx.state;
    if (typed.length !== s.word.length) return ctx.toast(`Le mot fait ${s.word.length} lettres`, "err");
    ctx.act({ type: "word", word: typed });
    typed = ""; guessing = false;
  }
  kbd = (e) => {
    const s = ctx.state;
    if (guessing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".sheet-wrap") || e.target.tagName === "INPUT") return;
    if (s.phase !== "guess" || !toAct(s).includes(ctx.me)) return;
    const c = normWord(e.key);
    if (c.length === 1 && e.key.length === 1 && !s.found.includes(c) && !s.wrong.includes(c)) { ctx.sfx.tap(); ctx.act({ type: "letter", letter: c }); }
  };
  window.addEventListener("keydown", kbd);
  update(ctx0);
  return { update, destroy() { window.removeEventListener("keydown", kbd); } };
}
