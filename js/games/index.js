// Liste des jeux : métadonnées légères ici, logique et affichage chargés à la demande.
export const GAMES = [
  { id: "poker", name: "Poker", full: "Texas Hold'em", icon: "poker", color: "#0E7C4A", cat: "Cartes", min: 2, max: 8, def: 4 },
  { id: "blackjack", name: "Blackjack", icon: "blackjack", color: "#1F8F55", cat: "Cartes", min: 1, max: 5, def: 3 },
  { id: "huit", name: "Huit américain", icon: "huit", color: "#FF9600", cat: "Cartes", min: 2, max: 6, def: 4 },
  { id: "bowling", name: "Bowling", icon: "bowling", color: "#E5484D", cat: "Adresse", min: 1, max: 6, def: 2 },
  { id: "sudoku", name: "Sudoku", icon: "sudoku", color: "#3F6FD8", cat: "Réflexion", min: 1, max: 4, def: 2 },
  { id: "fleches", name: "Mots fléchés", icon: "fleches", color: "#D9716B", cat: "Mots", min: 1, max: 6, def: 2 },
  { id: "motus", name: "Motus", icon: "motus", color: "#E8A21A", cat: "Mots", min: 1, max: 6, def: 2 },
  { id: "motsmeles", name: "Mots mêlés", icon: "motsmeles", color: "#18A57A", cat: "Mots", min: 1, max: 6, def: 2 },
  { id: "yams", name: "Yams", icon: "yams", color: "#9B51E0", cat: "Dés", min: 1, max: 6, def: 3 },
  { id: "puissance4", name: "Puissance 4", icon: "puissance4", color: "#2C64D8", cat: "Plateau", min: 2, max: 2, def: 2 },
  { id: "dames", name: "Dames", icon: "dames", color: "#B97A45", cat: "Plateau", min: 2, max: 2, def: 2 },
  { id: "bataille", name: "Bataille navale", icon: "bataille", color: "#1C8FE0", cat: "Plateau", min: 2, max: 2, def: 2 },
];
export const CATS = ["Tous", "Cartes", "Mots", "Plateau", "Dés", "Adresse", "Réflexion"];
export const gameInfo = (id) => GAMES.find((g) => g.id === id);

// réglages proposés avant une partie : [clé, libellé, [[valeur, texte]...], défaut]
export const SETTINGS = {
  poker: [["hands", "Nombre de mains", [[10, "10"], [20, "20"], [40, "40"]], 20], ["chips", "Jetons de départ", [[500, "500"], [1000, "1000"], [2000, "2000"]], 1000]],
  blackjack: [["rounds", "Manches", [[5, "5"], [8, "8"], [12, "12"]], 8]],
  huit: [],
  bowling: [["frames", "Partie", [[5, "Rapide (5)"], [10, "Complète (10)"]], 10]],
  sudoku: [["level", "Difficulté", [[1, "Facile"], [2, "Moyen"], [3, "Difficile"]], 2]],
  fleches: [["words", "Taille de grille", [[12, "Petite"], [18, "Normale"], [24, "Grande"]], 18]],
  motus: [["len", "Lettres", [[5, "5"], [6, "6"], [7, "7"]], 6], ["rounds", "Manches", [[3, "3"], [5, "5"], [8, "8"]], 5]],
  motsmeles: [["size", "Grille", [[10, "10 x 10"], [12, "12 x 12"], [14, "14 x 14"]], 12], ["theme", "Thème", [["", "Au hasard"], ["Animaux", "Animaux"], ["Sports", "Sports"], ["Pays", "Pays"], ["Espace", "Espace"], ["Cuisine", "Cuisine"], ["Musique", "Musique"], ["Métiers", "Métiers"], ["Fruits et légumes", "Fruits"]], ""]],
  yams: [],
  puissance4: [],
  dames: [],
  bataille: [],
};
export const BOT_LEVEL = ["level", "Niveau des robots", [[1, "Facile"], [2, "Moyen"], [3, "Fort"]], 2];
export const TURN_TIME = ["turnTime", "Temps par tour", [[0, "Libre"], [20, "20 s"], [40, "40 s"], [60, "60 s"]], null];

const logic = {
  poker: () => import("./poker.js"), blackjack: () => import("./blackjack.js"), huit: () => import("./huit.js"),
  bowling: () => import("./bowling.js"), sudoku: () => import("./sudoku.js"), fleches: () => import("./fleches.js"),
  motus: () => import("./motus.js"), motsmeles: () => import("./motsmeles.js"), yams: () => import("./yams.js"),
  puissance4: () => import("./puissance4.js"), dames: () => import("./dames.js"), bataille: () => import("./bataille.js"),
};
const views = {
  poker: () => import("../views/poker.js"), blackjack: () => import("../views/blackjack.js"), huit: () => import("../views/huit.js"),
  bowling: () => import("../views/bowling.js"), sudoku: () => import("../views/sudoku.js"), fleches: () => import("../views/fleches.js"),
  motus: () => import("../views/motus.js"), motsmeles: () => import("../views/motsmeles.js"), yams: () => import("../views/yams.js"),
  puissance4: () => import("../views/puissance4.js"), dames: () => import("../views/dames.js"), bataille: () => import("../views/bataille.js"),
};
export const loadGame = (id) => logic[id]();
export const loadView = (id) => views[id]();

export const BOT_NAMES = ["Robo Max", "Bip Bop", "Zéphyr", "Pixel", "Nova", "Turbo", "Gizmo", "Luna", "Kiwi", "Rocket", "Mochi", "Volt"];
