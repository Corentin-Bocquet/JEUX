import { h } from "../ui.js";
import { mountFlash, scoreOf, scoreLabel } from "../games/lib/flash_view.js";
import { item } from "../games/vraifaux.js";

export { scoreOf, scoreLabel };
const P = "g-vraifaux";
const word = (v) => (v ? "Vrai" : "Faux");

export function mount(root, ctx) {
  return mountFlash(root, ctx, {
    id: "vraifaux",
    tag: (q) => item(q).c,
    prompt: (c, q) => h("div", { class: `${P}-stmt` }, item(q).s),
    answers: (c, q, send, mine) => h("div", { class: `${P}-btns` },
      [true, false].map((v) => h("button", {
        class: `${P}-b ${v ? "yes" : "no"}${mine && mine.v === v ? " picked" : ""}${mine && mine.v !== v ? " off" : ""}`,
        disabled: !!mine, onclick: () => send(v),
      }, h("span", { class: `${P}-ico` }, v ? "✓" : "✗"), word(v)))),
    reveal: (c, last) => {
      const it = item(last.q);
      return h("div", null,
        h("div", { class: `${P}-stmt small-stmt` }, it.s),
        h("div", { class: `${P}-verdict ${it.t ? "yes" : "no"}` }, it.t ? "✓ C'est VRAI" : "✗ C'est FAUX"),
        h("div", { class: `${P}-expl` }, it.e));
    },
    label: (s, q, v) => word(v),
  });
}
