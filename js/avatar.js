// Mascotte « Jojo » : une petite bulle personnalisable (couleur, tenue, chapeau, lunettes, fond).
import { itemById, equipOf } from "./catalog.js";

let uid = 0;

export function mascotSVG(equipped, size = 96, { bg = true, mood = "happy" } = {}) {
  const e = equipOf(equipped);
  const id = "m" + ++uid;
  const col = itemById(e.color), bgi = itemById(e.bg);
  const [c1, c2] = col.v;
  const rainbow = col.fx === "rainbow";
  const defs = `<defs>
    <radialGradient id="${id}b" cx=".35" cy=".3" r=".85">
      ${rainbow ? `<stop offset="0" stop-color="#FFE66B"/><stop offset=".35" stop-color="#FF6B9A"/><stop offset=".7" stop-color="#7B6BFF"/><stop offset="1" stop-color="#2FC4FF"/>`
      : `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>`}
    </radialGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bgi.v[0]}"/><stop offset="1" stop-color="${bgi.v[1]}"/></linearGradient>
    <clipPath id="${id}c"><path d="${BODY}"/></clipPath>
  </defs>`;
  const back = bg ? `<circle cx="60" cy="60" r="60" fill="url(#${id}g)"/>${bgi.fx === "stars" ? STARS : ""}<ellipse cx="60" cy="112" rx="34" ry="6" fill="#000" opacity=".18"/>` : "";
  const cape = e.outfit === "outfit_hero" ? `<path d="M34 80 Q26 104 20 114 L100 114 Q94 104 86 80 Z" fill="#E5484D"/><path d="M34 80 Q30 100 26 112" stroke="#B3263A" stroke-width="2" fill="none"/>` : "";
  const body = `
    <ellipse cx="46" cy="107" rx="9" ry="5" fill="${c2}"/><ellipse cx="74" cy="107" rx="9" ry="5" fill="${c2}"/>
    <ellipse cx="25" cy="80" rx="6" ry="9" fill="${c2}" transform="rotate(25 25 80)"/><ellipse cx="95" cy="80" rx="6" ry="9" fill="${c2}" transform="rotate(-25 95 80)"/>
    <path d="${BODY}" fill="url(#${id}b)"/>
    ${col.fx === "stars" ? `<g clip-path="url(#${id}c)" fill="#fff">${[[44, 48], [72, 40], [80, 70], [38, 84], [64, 92], [86, 54], [54, 38]].map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 2 ? 0.9 : 1.4}" opacity=".85"/>`).join("")}</g>` : ""}
    <g clip-path="url(#${id}c)">${OUTFITS[e.outfit] || ""}</g>
    <ellipse cx="45" cy="44" rx="11" ry="6" fill="#fff" opacity=".38" transform="rotate(-28 45 44)"/>`;
  const face = faceSVG(mood) + (GLASSES[e.glasses] || "");
  const hat = HATS[e.hat] || "";
  return `<svg class="mascot" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="Avatar">${defs}${back}${cape}${body}${face}${hat}</svg>`;
}

const BODY = "M60 30C84 30 96 50 96 72C96 94 82 106 60 106C38 106 24 94 24 72C24 50 36 30 60 30Z";
const STARS = `<g fill="#fff">${[[18, 22, 1.2], [96, 18, 1], [104, 46, 1.4], [14, 60, 1], [24, 94, .9], [100, 92, 1.2], [70, 12, .8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity=".8"/>`).join("")}</g>`;

function faceSVG(mood) {
  const mouth = mood === "sad" ? `<path d="M53 82Q60 76 67 82" stroke="#1B1B3A" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    : mood === "wow" ? `<ellipse cx="60" cy="80" rx="4" ry="5" fill="#1B1B3A"/>`
    : `<path d="M52 77Q60 86 68 77" stroke="#1B1B3A" stroke-width="2.6" fill="#7A1E3A" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<ellipse cx="49" cy="64" rx="7.5" ry="8.5" fill="#fff"/><ellipse cx="71" cy="64" rx="7.5" ry="8.5" fill="#fff"/>
    <circle cx="50" cy="65.5" r="4.2" fill="#1B1B3A"/><circle cx="72" cy="65.5" r="4.2" fill="#1B1B3A"/>
    <circle cx="51.6" cy="63.4" r="1.5" fill="#fff"/><circle cx="73.6" cy="63.4" r="1.5" fill="#fff"/>
    <ellipse cx="38.5" cy="75" rx="5" ry="3" fill="#FF6B9A" opacity=".45"/><ellipse cx="81.5" cy="75" rx="5" ry="3" fill="#FF6B9A" opacity=".45"/>${mouth}`;
}

const OUTFITS = {
  outfit_tshirt: `<rect x="0" y="88" width="120" height="30" fill="#F7F7FF"/><path d="M52 88 L60 95 L68 88" fill="none" stroke="#C9CBE6" stroke-width="2"/><path d="m60 99 1.6 3.2 3.5.5-2.5 2.4.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.4 3.5-.5z" fill="#FFC800"/>`,
  outfit_sweat: `<rect x="0" y="86" width="120" height="30" fill="#6C5CE7"/><path d="M46 86 Q60 96 74 86" fill="#5546C8"/><path d="M55 90v9M65 90v9" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><rect x="47" y="99" width="26" height="8" rx="3" fill="#5546C8"/>`,
  outfit_foot: `<rect x="0" y="87" width="120" height="30" fill="#1C8FE0"/><rect x="44" y="87" width="8" height="30" fill="#fff"/><rect x="68" y="87" width="8" height="30" fill="#fff"/><text x="60" y="104" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="12" fill="#FFC800">10</text>`,
  outfit_kimono: `<rect x="0" y="86" width="120" height="30" fill="#FAFAFF"/><path d="M48 86 L64 104 M72 86 L56 104" stroke="#C2324A" stroke-width="5"/><rect x="0" y="100" width="120" height="6" fill="#1B1B3A"/>`,
  outfit_costume: `<rect x="0" y="86" width="120" height="30" fill="#24305E"/><path d="M50 86 L60 104 L70 86Z" fill="#fff"/><path d="M58 90h4l1 8-3 4-3-4z" fill="#E5484D"/><path d="M50 86 L56 100 M70 86 L64 100" stroke="#1A2347" stroke-width="2"/>`,
  outfit_hero: `<rect x="0" y="86" width="120" height="30" fill="#2856B8"/><circle cx="60" cy="98" r="7" fill="#FFC800"/><text x="60" y="102" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="10" fill="#E5484D">J</text><rect x="0" y="105" width="120" height="3" fill="#E5484D"/>`,
  outfit_smoking: `<rect x="0" y="86" width="120" height="30" fill="#14141C"/><path d="M50 86 L60 106 L70 86Z" fill="#fff"/><path d="M54 90 L60 93 L66 90 L66 96 L60 93 L54 96Z" fill="#14141C"/><circle cx="60" cy="100" r="1" fill="#14141C"/>`,
  outfit_spatial: `<rect x="0" y="86" width="120" height="30" fill="#ECEEF6"/><rect x="40" y="94" width="12" height="9" rx="2" fill="#1C8FE0"/><rect x="66" y="94" width="14" height="5" rx="2" fill="#E5484D"/><path d="M30 88 Q60 82 90 88" stroke="#B8BCD0" stroke-width="3" fill="none"/>`,
};

const HATS = {
  hat_casquette: `<path d="M34 40 Q36 18 60 18 Q84 18 86 40 Z" fill="#E5484D"/><path d="M60 18v22" stroke="#B3263A" stroke-width="1.5"/><path d="M82 38 Q102 38 106 44 Q96 47 80 44Z" fill="#B3263A"/><circle cx="60" cy="18" r="2.4" fill="#B3263A"/>`,
  hat_bonnet: `<path d="M33 42 Q34 14 60 14 Q86 14 87 42Z" fill="#1CB0F6"/><path d="M38 22v18M46 17v23M54 15v25M62 15v25M70 16v24M78 19v21" stroke="#1592CE" stroke-width="1.6"/><rect x="30" y="37" width="60" height="9" rx="4.5" fill="#FFFFFF"/><circle cx="60" cy="11" r="6" fill="#FFFFFF"/>`,
  hat_toque: `<rect x="40" y="30" width="40" height="12" rx="2" fill="#fff" stroke="#DADCEB" stroke-width="1.2"/><circle cx="46" cy="22" r="10" fill="#fff"/><circle cx="60" cy="16" r="12" fill="#fff"/><circle cx="74" cy="22" r="10" fill="#fff"/><path d="M48 30v10M60 30v10M72 30v10" stroke="#E8E9F3" stroke-width="1.4"/>`,
  hat_cowboy: `<ellipse cx="60" cy="38" rx="44" ry="8" fill="#8B5A2B"/><path d="M40 37 Q40 14 52 16 Q60 22 68 16 Q80 14 80 37Z" fill="#A86A33"/><rect x="40" y="31" width="40" height="5" fill="#5E3B1A"/>`,
  hat_gamer: `<path d="M27 64 Q27 22 60 22 Q93 22 93 64" stroke="#1B1B3A" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="18" y="56" width="14" height="22" rx="6" fill="#2B2B5C"/><rect x="88" y="56" width="14" height="22" rx="6" fill="#2B2B5C"/><rect x="20" y="60" width="4" height="14" rx="2" fill="#58CC02"/><path d="M96 76 Q94 88 74 88" stroke="#1B1B3A" stroke-width="2.5" fill="none"/><circle cx="73" cy="88" r="3" fill="#58CC02"/>`,
  hat_magicien: `<ellipse cx="60" cy="38" rx="32" ry="6" fill="#3A2D8C"/><path d="M38 37 L60 -2 L82 37Z" fill="#5B47D6"/><path d="m56 16 1.4 2.8 3.1.5-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.5z" fill="#FFC800"/><circle cx="68" cy="28" r="1.8" fill="#FFC800"/><circle cx="51" cy="29" r="1.2" fill="#fff"/>`,
  hat_viking: `<path d="M34 42 Q34 18 60 18 Q86 18 86 42Z" fill="#9AA3B8"/><rect x="32" y="38" width="56" height="7" rx="3" fill="#6F7787"/><path d="M36 30 Q20 26 18 8 Q30 16 40 22Z" fill="#F3E9D2"/><path d="M84 30 Q100 26 102 8 Q90 16 80 22Z" fill="#F3E9D2"/><circle cx="48" cy="41.5" r="1.6" fill="#C7CCD6"/><circle cx="60" cy="41.5" r="1.6" fill="#C7CCD6"/><circle cx="72" cy="41.5" r="1.6" fill="#C7CCD6"/>`,
  hat_aureole: `<ellipse cx="60" cy="18" rx="22" ry="6" fill="none" stroke="#FFE680" stroke-width="5" opacity=".95"/><ellipse cx="60" cy="18" rx="22" ry="6" fill="none" stroke="#FFC800" stroke-width="2"/>`,
  hat_couronne: `<path d="M38 40 L36 16 L48 28 L60 10 L72 28 L84 16 L82 40Z" fill="#FFC800" stroke="#D6A500" stroke-width="1.5" stroke-linejoin="round"/><rect x="38" y="36" width="44" height="6" rx="2" fill="#D6A500"/><circle cx="60" cy="31" r="3" fill="#E5484D"/><circle cx="47" cy="33" r="2" fill="#1CB0F6"/><circle cx="73" cy="33" r="2" fill="#58CC02"/>`,
};

const GLASSES = {
  glasses_soleil: `<rect x="38" y="57" width="20" height="14" rx="6" fill="#1B1B3A"/><rect x="62" y="57" width="20" height="14" rx="6" fill="#1B1B3A"/><path d="M58 62h4" stroke="#1B1B3A" stroke-width="2.5"/><path d="M42 60l5 0" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>`,
  glasses_coeur: `<path d="M48 72c-7-5-11-8-11-12a5 5 0 0 1 11-2 5 5 0 0 1 11 2c0 4-4 7-11 12z" fill="#FF4FA0" opacity=".92"/><path d="M72 72c-7-5-11-8-11-12a5 5 0 0 1 11-2 5 5 0 0 1 11 2c0 4-4 7-11 12z" fill="#FF4FA0" opacity=".92"/><path d="M59 61h2" stroke="#C2185B" stroke-width="2"/>`,
  glasses_monocle: `<circle cx="72" cy="64" r="9.5" fill="#fff" fill-opacity=".18" stroke="#D6A500" stroke-width="2.4"/><path d="M80 70 Q88 86 82 98" stroke="#D6A500" stroke-width="1.4" fill="none"/>`,
  glasses_pixel: `<path d="M36 58h48v5h-4v5h-4v4h-8v-4h-4v-5h-4v5h-4v4h-8v-4h-4v-5h-4z" fill="#111"/><rect x="42" y="61" width="4" height="3" fill="#fff"/><rect x="66" y="61" width="4" height="3" fill="#fff"/>`,
  glasses_ski: `<path d="M26 64h68" stroke="#1B1B3A" stroke-width="4"/><rect x="36" y="55" width="48" height="18" rx="9" fill="url(#skiGrad)" stroke="#fff" stroke-width="2"/><defs><linearGradient id="skiGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB36B"/><stop offset=".5" stop-color="#FF4FD8"/><stop offset="1" stop-color="#3FD0FF"/></linearGradient></defs><path d="M42 59l8 0" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`,
};

// avatar affiché dans les listes : la photo si elle existe, sinon la mascotte
export function avatarHTML(p, size = 40) {
  if (p && p.photo) return `<img class="avimg" src="${String(p.photo).replace(/"/g, "")}" width="${size}" height="${size}" alt="" loading="lazy">`;
  return mascotSVG(p && (p.avatar || p.equipped), size);
}
