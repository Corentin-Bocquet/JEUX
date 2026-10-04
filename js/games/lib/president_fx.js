// Aides d'affichage partagées par Président, Pouilleux et Menteur :
// main en éventail (positions en CSS pur) et cartes qui volent d'un endroit à l'autre.
// Aucune logique de jeu ici ; le DOM n'est touché que dans les fonctions appelées par les vues.

// style inline de la carte i sur n dans un éventail centré
export function fanStyle(i, n, { max = 34, spread = 3.2, lift = 0 } = {}) {
  const mid = (n - 1) / 2;
  const d = i - mid;
  // 100cqw : largeur du conteneur (il doit avoir container-type: inline-size)
  const step = n > 1 ? `min(${max}px, calc((100cqw - 104px) / ${n - 1}))` : "0px";
  const rot = Math.max(-16, Math.min(16, d * Math.min(spread, 30 / Math.max(1, n))));
  const drop = Math.abs(d) * Math.abs(d) * Math.min(1.1, 14 / Math.max(1, n * n / 8));
  return `left:calc(50% + ${d} * ${step});transform:translateX(-50%) translateY(${(drop - lift).toFixed(1)}px) rotate(${rot.toFixed(1)}deg);z-index:${i + 1}`;
}

// anime l'élément « el » comme s'il venait de « from » (technique FLIP)
export function flyFrom(el, from, { dur = 420, scale = 0.45, delay = 0 } = {}) {
  if (!el || !from || !el.animate) return;
  const a = from.getBoundingClientRect(), b = el.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
  el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.4 }, { transform: getComputedStyle(el).transform === "none" ? "none" : getComputedStyle(el).transform, opacity: 1 }],
    { duration: dur, delay, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
}

// une carte (html) traverse l'écran de « from » vers « to » puis disparaît
export function flyCard(html, from, to, { dur = 650, flipAt = null, faceHtml = null, cls = "" } = {}) {
  if (!from || !to || typeof document === "undefined") return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const el = document.createElement("div");
  el.className = cls;
  el.style.cssText = `position:fixed;left:${a.left + a.width / 2}px;top:${a.top + a.height / 2}px;z-index:60;pointer-events:none;transform:translate(-50%,-50%)`;
  el.innerHTML = html;
  document.body.append(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = el.animate([
    { transform: "translate(-50%,-50%) scale(1) rotate(0deg)" },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 40}px)) scale(1.25) rotate(-8deg)`, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.8) rotate(0deg)` },
  ], { duration: dur, easing: "cubic-bezier(.3,.7,.3,1)" });
  if (faceHtml && flipAt != null) setTimeout(() => { el.innerHTML = faceHtml; }, dur * flipAt);
  anim.onfinish = () => el.remove();
  setTimeout(() => el.remove(), dur + 200);
}
