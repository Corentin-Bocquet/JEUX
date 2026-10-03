// Catalogue de la boutique. Source unique : le SQL des prix est généré
// depuis ce fichier (node tools/gen-items-sql.mjs), le serveur fait foi.

export const SLOTS = [
  { id: "color", name: "Couleur" },
  { id: "outfit", name: "Tenue" },
  { id: "hat", name: "Chapeau" },
  { id: "glasses", name: "Lunettes" },
  { id: "bg", name: "Fond" },
  { id: "deck", name: "Dos de cartes" },
  { id: "table", name: "Tapis de jeu" },
];

// rarete : 0 commun, 1 rare, 2 epique, 3 legendaire
export const ITEMS = [
  // couleurs de la mascotte
  { id: "color_bleu", slot: "color", name: "Bleu lagon", price: 0, r: 0, v: ["#4FC3FF", "#1C8FE0"] },
  { id: "color_vert", slot: "color", name: "Vert pomme", price: 0, r: 0, v: ["#8EE34B", "#4BAE14"] },
  { id: "color_rose", slot: "color", name: "Rose bonbon", price: 100, r: 0, v: ["#FF9AD5", "#E0529F"] },
  { id: "color_orange", slot: "color", name: "Orange soleil", price: 100, r: 0, v: ["#FFC15A", "#F07F12"] },
  { id: "color_violet", slot: "color", name: "Violet royal", price: 150, r: 1, v: ["#C89BFF", "#8048E0"] },
  { id: "color_rouge", slot: "color", name: "Rouge piment", price: 150, r: 1, v: ["#FF8A80", "#D93636"] },
  { id: "color_or", slot: "color", name: "Or massif", price: 600, r: 2, v: ["#FFE680", "#D9A400"] },
  { id: "color_galaxie", slot: "color", name: "Galaxie", price: 1200, r: 3, v: ["#7F6BFF", "#1B1464"], fx: "stars" },
  { id: "color_arcenciel", slot: "color", name: "Arc-en-ciel", price: 1500, r: 3, v: ["#FF6B6B", "#4D96FF"], fx: "rainbow" },

  // tenues
  { id: "outfit_tshirt", slot: "outfit", name: "T-shirt", price: 0, r: 0 },
  { id: "outfit_sweat", slot: "outfit", name: "Sweat à capuche", price: 150, r: 0 },
  { id: "outfit_foot", slot: "outfit", name: "Maillot de foot", price: 250, r: 1 },
  { id: "outfit_kimono", slot: "outfit", name: "Kimono", price: 400, r: 1 },
  { id: "outfit_costume", slot: "outfit", name: "Costume", price: 500, r: 2 },
  { id: "outfit_hero", slot: "outfit", name: "Super-héros", price: 750, r: 2 },
  { id: "outfit_smoking", slot: "outfit", name: "Smoking de casino", price: 900, r: 3 },
  { id: "outfit_spatial", slot: "outfit", name: "Combinaison spatiale", price: 1100, r: 3 },

  // chapeaux
  { id: "hat_none", slot: "hat", name: "Aucun", price: 0, r: 0 },
  { id: "hat_casquette", slot: "hat", name: "Casquette", price: 120, r: 0 },
  { id: "hat_bonnet", slot: "hat", name: "Bonnet", price: 120, r: 0 },
  { id: "hat_toque", slot: "hat", name: "Toque de chef", price: 250, r: 1 },
  { id: "hat_cowboy", slot: "hat", name: "Chapeau de cowboy", price: 300, r: 1 },
  { id: "hat_gamer", slot: "hat", name: "Casque gamer", price: 350, r: 1 },
  { id: "hat_magicien", slot: "hat", name: "Chapeau de magicien", price: 450, r: 2 },
  { id: "hat_viking", slot: "hat", name: "Casque viking", price: 550, r: 2 },
  { id: "hat_aureole", slot: "hat", name: "Auréole", price: 700, r: 3 },
  { id: "hat_couronne", slot: "hat", name: "Couronne", price: 1000, r: 3 },

  // lunettes
  { id: "glasses_none", slot: "glasses", name: "Aucune", price: 0, r: 0 },
  { id: "glasses_soleil", slot: "glasses", name: "Lunettes de soleil", price: 150, r: 0 },
  { id: "glasses_coeur", slot: "glasses", name: "Lunettes cœur", price: 200, r: 1 },
  { id: "glasses_monocle", slot: "glasses", name: "Monocle", price: 250, r: 1 },
  { id: "glasses_pixel", slot: "glasses", name: "Lunettes pixel", price: 350, r: 2 },
  { id: "glasses_ski", slot: "glasses", name: "Masque de ski", price: 400, r: 2 },

  // fonds
  { id: "bg_nuit", slot: "bg", name: "Nuit violette", price: 0, r: 0, v: ["#2B2B5C", "#141432"] },
  { id: "bg_menthe", slot: "bg", name: "Menthe", price: 100, r: 0, v: ["#7EF0C9", "#18A57A"] },
  { id: "bg_sunset", slot: "bg", name: "Coucher de soleil", price: 200, r: 1, v: ["#FFB36B", "#E0457B"] },
  { id: "bg_ocean", slot: "bg", name: "Océan", price: 250, r: 1, v: ["#5CE1FF", "#1347B8"] },
  { id: "bg_neon", slot: "bg", name: "Néon", price: 350, r: 2, v: ["#FF4FD8", "#3A0CA3"] },
  { id: "bg_espace", slot: "bg", name: "Espace", price: 500, r: 3, v: ["#24245E", "#05051A"], fx: "stars" },

  // dos de cartes
  { id: "deck_classique", slot: "deck", name: "Classique", price: 0, r: 0, v: ["#2C64D8", "#173A8A"] },
  { id: "deck_rubis", slot: "deck", name: "Rubis", price: 200, r: 1, v: ["#E5484D", "#8E1626"] },
  { id: "deck_neon", slot: "deck", name: "Néon", price: 300, r: 1, v: ["#FF4FD8", "#3A0CA3"] },
  { id: "deck_or", slot: "deck", name: "Or", price: 600, r: 2, v: ["#FFE680", "#B98900"] },
  { id: "deck_dragon", slot: "deck", name: "Dragon", price: 900, r: 3, v: ["#3DDC97", "#0B4D3A"], fx: "dragon" },

  // tapis de jeu
  { id: "table_vert", slot: "table", name: "Feutrine verte", price: 0, r: 0, v: ["#1F8F55", "#0E5A33"] },
  { id: "table_bleu", slot: "table", name: "Bleu nuit", price: 250, r: 1, v: ["#2856B8", "#0F2766"] },
  { id: "table_bois", slot: "table", name: "Bois verni", price: 300, r: 1, v: ["#B97A45", "#6B3E1C"] },
  { id: "table_velours", slot: "table", name: "Velours rouge", price: 450, r: 2, v: ["#C2324A", "#5E0E1E"] },
  { id: "table_marbre", slot: "table", name: "Marbre noir", price: 800, r: 3, v: ["#3A3A48", "#0E0E14"] },
];

export const RARITY = [
  { name: "Commun", c: "#9AA6C8" },
  { name: "Rare", c: "#1CB0F6" },
  { name: "Épique", c: "#CE82FF" },
  { name: "Légendaire", c: "#FFC800" },
];

export const DEFAULT_EQUIP = {
  color: "color_bleu", outfit: "outfit_tshirt", hat: "hat_none", glasses: "glasses_none",
  bg: "bg_nuit", deck: "deck_classique", table: "table_vert",
};

export const itemById = (id) => ITEMS.find((i) => i.id === id);

// equipement effectif : tout objet inconnu retombe sur l objet gratuit du slot
export function equipOf(equipped) {
  const out = { ...DEFAULT_EQUIP };
  if (equipped && typeof equipped === "object") {
    for (const s of Object.keys(DEFAULT_EQUIP)) {
      const it = itemById(equipped[s]);
      if (it && it.slot === s) out[s] = it.id;
    }
  }
  return out;
}

// Recompenses (miroir des valeurs du SQL : le serveur fait foi)
export const REWARDS = {
  multi: [ // selon la place finale, pour 2 joueurs et plus
    { gems: 30, xp: 120 }, { gems: 15, xp: 70 }, { gems: 8, xp: 45 }, { gems: 5, xp: 30 },
  ],
  solo: { win: { gems: 12, xp: 60 }, draw: { gems: 6, xp: 35 }, lose: { gems: 3, xp: 20 } },
  daily: [40, 50, 60, 70, 80, 100, 150], // coffre du jour selon la serie (jour 1 a 7+)
  start: 200,
};

// niveau a partir de l XP : chaque niveau demande un peu plus
export function levelOf(xp) {
  let lvl = 1, need = 100, rest = Math.max(0, xp | 0);
  while (rest >= need) { rest -= need; lvl++; need = 100 + (lvl - 1) * 40; }
  return { lvl, cur: rest, need };
}
