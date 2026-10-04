import { h } from "../ui.js";
import { mountFlash, scoreOf, scoreLabel } from "../games/lib/flash_view.js";
import { serie, labelOf } from "../games/intrus.js";

export { scoreOf, scoreLabel };
const P = "g-intrus";

export function mount(root, ctx) {
  return mountFlash(root, ctx, {
    id: "intrus",
    tag: (q) => serie(q).c,
    prompt: () => h("div", { class: `${P}-q` }, "🔍 Trouve l'intrus !"),
    answers: (c, q, send, mine) => h("div", { class: `${P}-grid n${q.o.length}` },
      q.o.map((k, i) => h("button", {
        class: `${P}-it${mine && mine.v === k ? " picked" : ""}${mine && mine.v !== k ? " off" : ""}`,
        style: { animationDelay: `${i * 60}ms` },
        disabled: !!mine, onclick: () => send(k),
      }, labelOf(q, k)))),
    reveal: (c, last) => {
      const q = last.q;
      return h("div", null,
        h("div", { class: `${P}-chips` }, q.o.map((k) => h("span", { class: `${P}-chip${k === 0 ? " odd" : ""}` }, k === 0 ? "🎯 " : "", labelOf(q, k)))),
        h("div", { class: `${P}-expl-main` }, serie(q).e));
    },
    label: (s, q, v) => labelOf(q, v),
  });
}
