// Classement : semaine, depuis toujours, entre amis. Podium avec trophées.
import { h, fmt, sfx } from "../ui.js";
import { avatarHTML } from "../avatar.js";
import { levelOf } from "../catalog.js";

let tab = "week";
const TABS = [["week", "Semaine"], ["all", "Toujours"], ["friends", "Amis"]];

export function render(A, main) {
  const wrap = h("div", { class: "wrap-w" });
  const seg = h("div", { class: "seg" });
  const box = h("div");
  wrap.append(h("div", { class: "section" }, h("div", { class: "h1" }, "Classement")), seg, box);
  main.append(wrap);
  let alive = true;

  async function load() {
    seg.replaceChildren(...TABS.map(([k, t]) => h("button", { class: tab === k ? "on" : "", onclick: () => { tab = k; sfx.tap(); load(); } }, t)));
    box.replaceChildren(h("div", { class: "empty" }, "Chargement…"));
    let rows = [];
    try { rows = await A.api.leaderboard(tab === "friends" ? "friends" : "global", tab === "all" ? "all" : "week"); }
    catch (e) { box.replaceChildren(h("div", { class: "empty" }, e.message)); return; }
    if (!alive) return;
    const me = A.api.uid;
    const unit = tab === "all" ? "XP au total" : "XP cette semaine";
    const top3 = rows.slice(0, 3);
    const pod = (r, i) => r ? h("div", { class: `pl s${i + 1}` },
      h("div", { html: trophy(i, i === 0 ? 46 : 38) }),
      h("div", { html: avatarHTML({ photo: r.avatar_url, avatar: r.equipped }, i === 0 ? 70 : 56), style: { borderRadius: "50%", overflow: "hidden" } }),
      h("div", { class: "nm" }, r.display_name), h("div", { class: "small dim" }, fmt(r.value) + " XP"),
      h("div", { class: "step" }, i + 1)) : h("div");
    box.replaceChildren(
      rows.length ? h("div", { class: "podium" }, pod(top3[1], 1), pod(top3[0], 0), pod(top3[2], 2)) : null,
      h("p", { class: "small dim center", style: { margin: "6px 0 10px" } }, tab === "week" ? "Remis à zéro chaque lundi. Gagne des parties pour grimper !" : unit),
      rows.length ? h("div", { class: "list" }, rows.map((r, i) => h("div", { class: "item glass" + (r.id === me ? " me" : "") },
        h("span", { class: "rank-n" }, i + 1),
        h("div", { class: "av", html: avatarHTML({ photo: r.avatar_url, avatar: r.equipped }, 46) }),
        h("div", { class: "grow" }, h("div", null, r.display_name), h("div", { class: "small dim" }, `@${r.username} · ${fmt(r.wins)} victoire${r.wins > 1 ? "s" : ""}`)),
        h("b", null, fmt(r.value)))))
        : h("div", { class: "empty card glass" }, "Personne pour l'instant. Sois le premier !"));
  }
  load();
  return () => { alive = false; };
}

const METAL = [["#FFF3A6", "#FFC800", "#A06C00"], ["#FFFFFF", "#C7CCD6", "#6F7787"], ["#F7C08F", "#CD7F32", "#6E3C12"]];
function trophy(i, s) {
  const [a, b, c] = METAL[i];
  return `<svg viewBox="0 0 64 64" width="${s}" height="${s}" aria-hidden="true"><defs><linearGradient id="tr${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    <path d="M19 15h-5a7 7 0 0 0 7 11M45 15h5a7 7 0 0 1-7 11" fill="none" stroke="url(#tr${i})" stroke-width="4" stroke-linecap="round"/>
    <path d="M18 12h28v12c0 9-6 16-14 16s-14-7-14-16z" fill="url(#tr${i})" stroke="${c}" stroke-width="1.2"/>
    <path d="M22 14v9c0 4 1.5 7.5 4 10" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <rect x="29" y="39" width="6" height="7" fill="url(#tr${i})"/><path d="M21 46h22a3 3 0 0 1 3 3v8H18v-8a3 3 0 0 1 3-3z" fill="url(#tr${i})" stroke="${c}" stroke-width="1.2"/>
    <path d="m32 18.5 2 4.1 4.5.6-3.3 3.1.8 4.5-4-2.1-4 2.1.8-4.5-3.3-3.1 4.5-.6z" fill="#fff" stroke="${c}" stroke-width="1"/></svg>`;
}
export { levelOf };
