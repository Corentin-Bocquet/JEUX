// Boutique : aperçu de la mascotte, objets par emplacement, achat et équipement.
import { h, gem, toast, sfx, confetti, fmt, confirmBox } from "../ui.js";
import { mascotSVG } from "../avatar.js";
import { ITEMS, SLOTS, RARITY, equipOf, itemById } from "../catalog.js";
import { cardBackHTML, feltStyle } from "../views/common.js";

let slot = "color";

export function render(A, main) {
  const wrap = h("div", { class: "wrap-w" });
  const preview = h("div", { class: "preview glass" });
  const tabs = h("div", { class: "cats" });
  const grid = h("div", { class: "shop-grid" });
  wrap.append(h("div", { class: "section" }, h("div", { class: "h1" }, "Boutique"), h("div", { class: "pill gems glass" }, gem(22), h("span", { id: "shop-gems" }, fmt(A.profile.gems)))),
    preview, h("div", { style: { height: "12px" } }), tabs, grid,
    h("p", { class: "small dim center", style: { marginTop: "16px" } }, "Gagne des gemmes en jouant : victoires, parties entre amis et coffre du jour."));
  main.append(wrap);
  let trying = null; // objet essayé sans être acheté

  function draw() {
    const p = A.profile;
    const eq = equipOf(p.equipped);
    const look = trying ? { ...eq, [trying.slot]: trying.id } : eq;
    preview.replaceChildren(h("div", { html: mascotSVG(look, 170) }),
      slot === "deck" || slot === "table" ? h("div", { class: "row gap", style: { position: "absolute", right: "14px", bottom: "14px" } },
        h("div", { html: cardBackHTML(look.deck, 46) }), h("div", { style: `${feltStyle(look.table)};width:64px;height:46px;border-radius:12px;border:2px solid rgba(255,255,255,.3)` })) : null);
    document.getElementById("shop-gems").textContent = fmt(p.gems);
    tabs.replaceChildren(...SLOTS.map((s) => h("button", { class: "chip" + (s.id === slot ? " on" : ""), onclick: () => { slot = s.id; trying = null; sfx.tap(); draw(); } }, s.name)));
    grid.replaceChildren(...ITEMS.filter((i) => i.slot === slot).map((it) => {
      const owned = it.price === 0 || p.owned.includes(it.id);
      const on = eq[it.slot] === it.id;
      return h("button", { class: "sitem" + (on ? " on" : ""), onclick: () => choose(it) },
        h("span", { class: "rar", style: { background: RARITY[it.r].c }, title: RARITY[it.r].name }),
        h("div", { class: "swatch", html: swatch(it, eq) }),
        h("div", { class: "nm" }, it.name),
        on ? h("span", { class: "owned" }, "Équipé") : owned ? h("span", { class: "owned" }, "Possédé")
          : h("span", { class: "price" }, gem(16), fmt(it.price)));
    }));
  }
  async function choose(it) {
    const p = A.profile;
    const owned = it.price === 0 || p.owned.includes(it.id);
    sfx.tap();
    if (owned) {
      try { A.setProfile(await A.api.equip(it.slot, it.id)); trying = null; sfx.ok(); draw(); } catch (e) { toast(e.message, "err"); }
      return;
    }
    trying = it; draw();
    if (p.gems < it.price) { toast(`Il te manque ${fmt(it.price - p.gems)} gemmes pour « ${it.name} ».`, "err"); return; }
    if (!(await confirmBox(`Acheter « ${it.name} » pour ${fmt(it.price)} gemmes ?`, { ok: "Acheter" }))) { trying = null; draw(); return; }
    try {
      let np = await A.api.buy(it.id);
      np = await A.api.equip(it.slot, it.id);
      A.setProfile(np, { gained: false });
      trying = null; confetti(70); sfx.coin();
      toast(`« ${it.name} » est à toi !`, "ok");
      draw();
    } catch (e) { toast(e.message, "err"); }
  }
  draw();
}

function swatch(it, eq) {
  if (it.slot === "deck") return cardBackHTML(it.id, 44);
  if (it.slot === "table") return `<div style="${feltStyle(it.id)};width:62px;height:62px;border-radius:16px"></div>`;
  if (it.slot === "bg") return mascotSVG({ ...eq, bg: it.id }, 66);
  return mascotSVG({ ...eq, [it.slot]: it.id }, 66, { bg: it.slot !== "color" ? true : true });
}
export { itemById };
