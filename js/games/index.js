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
  { id: "yams", name: "Yams", icon: "yams", color: "#9B51E0", cat: "Casino", min: 1, max: 6, def: 3 },
  { id: "puissance4", name: "Puissance 4", icon: "puissance4", color: "#2C64D8", cat: "Plateau", min: 2, max: 2, def: 2 },
  { id: "dames", name: "Dames", icon: "dames", color: "#B97A45", cat: "Plateau", min: 2, max: 2, def: 2 },
  { id: "bataille", name: "Bataille navale", icon: "bataille", color: "#1C8FE0", cat: "Plateau", min: 2, max: 2, def: 2 },
  // ---- nouveaux jeux (fichiers js/games/<id>.js, js/views/<id>.js et css/g/<id>.css)
  { id: "morpion", name: "Morpion", icon: "jouer", color: "#14B8A6", cat: "Plateau", min: 2, max: 2, def: 2, css: true },
  { id: "reversi", name: "Reversi", icon: "jouer", color: "#16A34A", cat: "Plateau", min: 2, max: 2, def: 2, css: true },
  { id: "echecs", name: "Échecs", icon: "jouer", color: "#4F46E5", cat: "Plateau", min: 2, max: 2, def: 2, css: true },
  { id: "backgammon", name: "Backgammon", icon: "jouer", color: "#A16207", cat: "Plateau", min: 2, max: 2, def: 2, css: true },
  { id: "serpents", name: "Serpents et échelles", icon: "jouer", color: "#65A30D", cat: "Plateau", min: 2, max: 6, def: 4, css: true },
  { id: "oie", name: "Jeu de l'oie", icon: "jouer", color: "#EAB308", cat: "Plateau", min: 2, max: 6, def: 4, css: true },
  { id: "petitschevaux", name: "Petits chevaux", icon: "jouer", color: "#0EA5E9", cat: "Plateau", min: 2, max: 4, def: 4, css: true },
  { id: "dominos", name: "Dominos", icon: "jouer", color: "#92400E", cat: "Plateau", min: 2, max: 4, def: 2, css: true },
  { id: "empire", name: "Empire immobilier", icon: "jouer", color: "#10B981", cat: "Plateau", min: 2, max: 6, def: 4, css: true },
  { id: "belote", name: "Belote", icon: "jouer", color: "#9F1239", cat: "Cartes", min: 4, max: 4, def: 4, css: true },
  { id: "tarot", name: "Tarot", icon: "jouer", color: "#7C3AED", cat: "Cartes", min: 3, max: 5, def: 4, css: true },
  { id: "rami", name: "Rami", icon: "jouer", color: "#0F766E", cat: "Cartes", min: 2, max: 4, def: 2, css: true },
  { id: "derniere", name: "Dernière carte", icon: "jouer", color: "#EF4444", cat: "Cartes", min: 2, max: 8, def: 4, css: true },
  { id: "president", name: "Président", icon: "jouer", color: "#2563EB", cat: "Cartes", min: 3, max: 7, def: 4, css: true },
  { id: "menteur", name: "Menteur", icon: "jouer", color: "#EA580C", cat: "Cartes", min: 2, max: 6, def: 4, css: true },
  { id: "nainjaune", name: "Nain jaune", icon: "jouer", color: "#CA8A04", cat: "Cartes", min: 3, max: 8, def: 4, css: true },
  { id: "manille", name: "Manille", icon: "jouer", color: "#4D7C0F", cat: "Cartes", min: 4, max: 4, def: 4, css: true },
  { id: "bridge", name: "Bridge", icon: "jouer", color: "#1E3A8A", cat: "Cartes", min: 4, max: 4, def: 4, css: true },
  { id: "pouilleux", name: "Pouilleux", icon: "jouer", color: "#D97706", cat: "Cartes", min: 2, max: 6, def: 4, css: true },
  { id: "solitaire", name: "Solitaire", icon: "jouer", color: "#15803D", cat: "Cartes", min: 1, max: 8, def: 2, css: true },
  { id: "taureaux", name: "Taureaux 104", icon: "jouer", color: "#DC2626", cat: "Cartes", min: 2, max: 8, def: 4, css: true },
  { id: "pendu", name: "Pendu", icon: "jouer", color: "#F97316", cat: "Mots", min: 2, max: 6, def: 3, css: true },
  { id: "motsor", name: "Mots en or", icon: "jouer", color: "#B45309", cat: "Mots", min: 2, max: 4, def: 2, css: true },
  { id: "motscroises", name: "Mots croisés", icon: "jouer", color: "#64748B", cat: "Mots", min: 1, max: 6, def: 2, css: true },
  { id: "roue", name: "La roue des mots", icon: "jouer", color: "#F59E0B", cat: "Mots", min: 2, max: 4, def: 3, css: true },
  { id: "bombe", name: "Bombe à mots", icon: "jouer", color: "#1F2937", cat: "Mots", min: 2, max: 8, def: 4, css: true },
  { id: "petitbac", name: "Petit bac", icon: "jouer", color: "#F59E0B", cat: "Mots", min: 2, max: 8, def: 4, css: true },
  { id: "compte", name: "Le compte est bon", icon: "jouer", color: "#06B6D4", cat: "Réflexion", min: 1, max: 8, def: 2, css: true },
  { id: "nombre", name: "Nombre mystère", icon: "jouer", color: "#8B5CF6", cat: "Réflexion", min: 1, max: 8, def: 2, css: true },
  { id: "quiz", name: "Quiz culture générale", icon: "jouer", color: "#7C3AED", cat: "Quiz", min: 1, max: 8, def: 3, css: true },
  { id: "camembert", name: "Quiz camembert", icon: "jouer", color: "#0D9488", cat: "Quiz", min: 2, max: 6, def: 3, css: true },
  { id: "million", name: "Le Million", icon: "jouer", color: "#CA8A04", cat: "Quiz", min: 1, max: 8, def: 2, css: true },
  { id: "vraifaux", name: "Vrai ou faux", icon: "jouer", color: "#16A34A", cat: "Quiz", min: 1, max: 8, def: 3, css: true },
  { id: "intrus", name: "Cherche l'intrus", icon: "jouer", color: "#0EA5E9", cat: "Quiz", min: 1, max: 8, def: 3, css: true },
  { id: "geo", name: "Capitales et pays", icon: "jouer", color: "#2563EB", cat: "Quiz", min: 1, max: 8, def: 3, css: true },
  { id: "emojifilm", name: "Films en émojis", icon: "jouer", color: "#DC2626", cat: "Quiz", min: 1, max: 8, def: 3, css: true },
  { id: "bonprix", name: "Le bon prix", icon: "jouer", color: "#EA580C", cat: "Quiz", min: 1, max: 8, def: 3, css: true },
  { id: "devinequi", name: "Devine qui", icon: "jouer", color: "#3B82F6", cat: "Quiz", min: 2, max: 2, def: 2, css: true },
  { id: "loupgarou", name: "Loup-garou", icon: "jouer", color: "#1E293B", cat: "Soirée", min: 5, max: 8, def: 7, css: true },
  { id: "imposteur", name: "Imposteur", icon: "jouer", color: "#7E22CE", cat: "Soirée", min: 3, max: 8, def: 5, css: true },
  { id: "espion", name: "Espion", icon: "jouer", color: "#0F766E", cat: "Soirée", min: 3, max: 8, def: 5, css: true },
  { id: "agents", name: "Agents secrets", icon: "jouer", color: "#475569", cat: "Soirée", min: 4, max: 8, def: 4, css: true },
  { id: "celebrites", name: "Célébrités", icon: "jouer", color: "#DB2777", cat: "Soirée", min: 4, max: 8, def: 4, css: true },
  { id: "interdits", name: "Mots interdits", icon: "jouer", color: "#DC2626", cat: "Soirée", min: 3, max: 8, def: 4, css: true },
  { id: "dessine", name: "Dessine et devine", icon: "jouer", color: "#2563EB", cat: "Soirée", min: 2, max: 8, def: 4, css: true },
  { id: "mimes", name: "Mimes", icon: "jouer", color: "#BE123C", cat: "Soirée", min: 3, max: 8, def: 4, css: true },
  { id: "charades", name: "Charades et énigmes", icon: "jouer", color: "#92400E", cat: "Soirée", min: 1, max: 8, def: 3, css: true },
  { id: "actionverite", name: "Action ou vérité", icon: "jouer", color: "#E11D48", cat: "Soirée", min: 2, max: 8, def: 4, css: true },
  { id: "jamais", name: "Je n'ai jamais", icon: "jouer", color: "#EA580C", cat: "Soirée", min: 2, max: 8, def: 4, css: true },
  { id: "susceptible", name: "Qui est le plus…", icon: "jouer", color: "#9333EA", cat: "Soirée", min: 3, max: 8, def: 4, css: true },
  { id: "tupreferes", name: "Tu préfères", icon: "jouer", color: "#16A34A", cat: "Soirée", min: 2, max: 8, def: 4, css: true },
  { id: "deuxverites", name: "Deux vérités, un mensonge", icon: "jouer", color: "#4F46E5", cat: "Soirée", min: 3, max: 8, def: 4, css: true },
  { id: "roulette", name: "Roulette", icon: "jouer", color: "#991B1B", cat: "Casino", min: 1, max: 8, def: 3, css: true },
  { id: "slots", name: "Machine à sous", icon: "jouer", color: "#7E22CE", cat: "Casino", min: 1, max: 8, def: 3, css: true },
  { id: "courses", name: "Course de chevaux", icon: "jouer", color: "#15803D", cat: "Casino", min: 1, max: 8, def: 3, css: true },
  { id: "bingo", name: "Loto", icon: "jouer", color: "#DB2777", cat: "Casino", min: 2, max: 8, def: 4, css: true },
  { id: "pfc", name: "Pierre feuille ciseaux", icon: "jouer", color: "#2563EB", cat: "Casino", min: 2, max: 8, def: 2, css: true },
  { id: "g2048", name: "2048", icon: "jouer", color: "#EA580C", cat: "Arcade", min: 1, max: 8, def: 2, css: true },
  { id: "demineur", name: "Démineur", icon: "jouer", color: "#475569", cat: "Arcade", min: 1, max: 8, def: 2, css: true },
  { id: "blocs", name: "Blocs", icon: "jouer", color: "#7C3AED", cat: "Arcade", min: 1, max: 8, def: 2, css: true },
  { id: "snake", name: "Snake", icon: "jouer", color: "#16A34A", cat: "Arcade", min: 1, max: 8, def: 2, css: true },
  { id: "labyrinthe", name: "Labyrinthe", icon: "jouer", color: "#65A30D", cat: "Arcade", min: 1, max: 8, def: 2, css: true },
  { id: "memoire", name: "Mémoire des couleurs", icon: "jouer", color: "#111827", cat: "Arcade", min: 1, max: 8, def: 2, css: true },
  { id: "puzzle", name: "Puzzle", icon: "jouer", color: "#0EA5E9", cat: "Arcade", min: 1, max: 8, def: 2, css: true },
  { id: "flechettes", name: "Fléchettes", icon: "jouer", color: "#7C2D12", cat: "Adresse", min: 1, max: 6, def: 2, css: true },
  { id: "minigolf", name: "Mini-golf", icon: "jouer", color: "#16A34A", cat: "Adresse", min: 1, max: 6, def: 2, css: true },
  { id: "petanque", name: "Pétanque", icon: "jouer", color: "#A16207", cat: "Adresse", min: 2, max: 6, def: 2, css: true },
  { id: "billard", name: "Billard", icon: "jouer", color: "#166534", cat: "Adresse", min: 2, max: 2, def: 2, css: true },
  { id: "footpichenette", name: "Foot pichenette", icon: "jouer", color: "#15803D", cat: "Adresse", min: 2, max: 2, def: 2, css: true },
  { id: "airhockey", name: "Air hockey", icon: "jouer", color: "#0284C7", cat: "Adresse", min: 2, max: 2, def: 2, css: true },
  { id: "babyfoot", name: "Baby-foot", icon: "jouer", color: "#EA580C", cat: "Adresse", min: 2, max: 2, def: 2, css: true },
  { id: "pingpong", name: "Ping-pong", icon: "jouer", color: "#1D4ED8", cat: "Adresse", min: 2, max: 2, def: 2, css: true },
  { id: "totem", name: "Totem rapide", icon: "jouer", color: "#65A30D", cat: "Cartes", min: 2, max: 8, def: 4, css: true },
];
export const CATS = ["Tous", "Cartes", "Plateau", "Mots", "Quiz", "Soirée", "Arcade", "Adresse", "Casino", "Réflexion"];
export const gameInfo = (id) => GAMES.find((g) => g.id === id);
// nouveaux jeux visibles dans l'app une fois intégrés et vérifiés (les autres restent cachés)
export const PUBLISHED = new Set(["morpion", "reversi", "echecs", "backgammon", "serpents", "oie", "dominos", "empire", "belote", "derniere", "president", "menteur", "nainjaune", "manille", "pouilleux", "taureaux", "nombre", "vraifaux", "intrus", "geo", "pfc"]);
export const isVisible = (g) => !g.css || PUBLISHED.has(g.id);
export const VISIBLE = GAMES.filter(isVisible);

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

// chargement à la demande : js/games/<id>.js (logique) et js/views/<id>.js (affichage)
export const loadGame = (id) => import(`./${id}.js`);
export function loadView(id) {
  const g = gameInfo(id);
  // feuille de style propre au jeu (css/g/<id>.css), ajoutée une seule fois
  if (g && g.css && typeof document !== "undefined" && !document.querySelector(`link[data-g="${id}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = `css/g/${id}.css`; l.dataset.g = id;
    document.head.append(l);
  }
  return import(`../views/${id}.js`);
}

export const BOT_NAMES = ["Robo Max", "Bip Bop", "Zéphyr", "Pixel", "Nova", "Turbo", "Gizmo", "Luna", "Kiwi", "Rocket", "Mochi", "Volt"];
