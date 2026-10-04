// Empire immobilier : plateau de 40 cases et cartes « Surprise » et « Coup du sort ».
// Noms de rues génériques inventés, aucune marque.
// k : go | prop | station | util | tax | surprise | sort | jail | parc | police

export const GROUPS = {
  brun: { name: "Brun", color: "#9A6440", house: 50 },
  ciel: { name: "Ciel", color: "#5BC0EB", house: 50 },
  rose: { name: "Rose", color: "#E0559B", house: 100 },
  orange: { name: "Orange", color: "#F28C28", house: 100 },
  rouge: { name: "Rouge", color: "#E03E3E", house: 150 },
  jaune: { name: "Jaune", color: "#F2C511", house: 150 },
  vert: { name: "Vert", color: "#1FA35C", house: 200 },
  bleu: { name: "Bleu", color: "#2E5BD8", house: 200 },
  gare: { name: "Gares", color: "#3F4458", house: 0 },
  util: { name: "Compagnies", color: "#7C8597", house: 0 },
};

const P = (n, g, p, r) => ({ n, k: "prop", g, p, r });
const ST = (n) => ({ n, k: "station", g: "gare", p: 200 });
const UT = (n, ic) => ({ n, k: "util", g: "util", p: 150, ic });

export const BOARD = [
  { n: "Départ", k: "go" },
  P("Impasse des Lilas", "brun", 60, [2, 10, 30, 90, 160, 250]),
  { n: "Coup du sort", k: "sort" },
  P("Rue du Moulin", "brun", 60, [4, 20, 60, 180, 320, 450]),
  { n: "Impôt sur le revenu", k: "tax", v: 200 },
  ST("Gare du Port"),
  P("Rue des Écoles", "ciel", 100, [6, 30, 90, 270, 400, 550]),
  { n: "Surprise", k: "surprise" },
  P("Allée des Tilleuls", "ciel", 100, [6, 30, 90, 270, 400, 550]),
  P("Rue de la Fontaine", "ciel", 120, [8, 40, 100, 300, 450, 600]),
  { n: "Prison", k: "jail" },
  P("Rue de la Poste", "rose", 140, [10, 50, 150, 450, 625, 750]),
  UT("Centrale électrique", "⚡"),
  P("Rue des Artisans", "rose", 140, [10, 50, 150, 450, 625, 750]),
  P("Place du Marché", "rose", 160, [12, 60, 180, 500, 700, 900]),
  ST("Gare des Plaines"),
  P("Rue des Vignes", "orange", 180, [14, 70, 200, 550, 750, 950]),
  { n: "Coup du sort", k: "sort" },
  P("Quai des Pêcheurs", "orange", 180, [14, 70, 200, 550, 750, 950]),
  P("Avenue des Cerisiers", "orange", 200, [16, 80, 220, 600, 800, 1000]),
  { n: "Parc municipal", k: "parc" },
  P("Avenue des Roses", "rouge", 220, [18, 90, 250, 700, 875, 1050]),
  { n: "Surprise", k: "surprise" },
  P("Boulevard du Lac", "rouge", 220, [18, 90, 250, 700, 875, 1050]),
  P("Place de la Mairie", "rouge", 240, [20, 100, 300, 750, 925, 1100]),
  ST("Gare Centrale"),
  P("Rue du Château", "jaune", 260, [22, 110, 330, 800, 975, 1150]),
  P("Avenue du Parc", "jaune", 260, [22, 110, 330, 800, 975, 1150]),
  UT("Société des eaux", "💧"),
  P("Promenade des Remparts", "jaune", 280, [24, 120, 360, 850, 1025, 1200]),
  { n: "Au poste !", k: "police" },
  P("Boulevard des Arts", "vert", 300, [26, 130, 390, 900, 1100, 1275]),
  P("Avenue de l'Observatoire", "vert", 300, [26, 130, 390, 900, 1100, 1275]),
  { n: "Coup du sort", k: "sort" },
  P("Cours des Marronniers", "vert", 320, [28, 150, 450, 1000, 1200, 1400]),
  ST("Gare de la Vallée"),
  { n: "Surprise", k: "surprise" },
  P("Boulevard du Panorama", "bleu", 350, [35, 175, 500, 1100, 1300, 1500]),
  { n: "Taxe de luxe", k: "tax", v: 100 },
  P("Avenue des Sommets", "bleu", 400, [50, 200, 600, 1400, 1700, 2000]),
];

export const SALARY = 200;
export const JAIL_FEE = 50;
export const STATIONS = [5, 15, 25, 35];

// cases de chaque groupe
export const GROUP_CELLS = {};
BOARD.forEach((c, i) => { if (c.g) (GROUP_CELLS[c.g] = GROUP_CELLS[c.g] || []).push(i); });

// effets : money (+ reçoit, - paie), goto (avance jusqu'à), back (recule de), to (recule jusqu'à, sans salaire),
// jail, free (libéré de prison), repairs [par maison, par hôtel], payEach, getEach, station (gare la plus proche)
export const SURPRISE = [
  { t: "Ton vélo file comme le vent : avance jusqu'à la case Départ.", k: "goto", v: 0 },
  { t: "Dîner chic au sommet : avance jusqu'à l'Avenue des Sommets.", k: "goto", v: 39 },
  { t: "Réunion de quartier : avance jusqu'à la Place de la Mairie.", k: "goto", v: 24 },
  { t: "Tu sautes dans un train : avance jusqu'à la gare la plus proche.", k: "station" },
  { t: "Tu as oublié tes clés : recule de 3 cases.", k: "back", v: 3 },
  { t: "Contrôle surprise : va directement en prison, sans passer par Départ.", k: "jail" },
  { t: "Carte « Libéré de prison » : garde-la pour plus tard.", k: "free" },
  { t: "Ton placement rapporte : reçois 150 €.", k: "money", v: 150 },
  { t: "Excès de vitesse : paie 15 € d'amende.", k: "money", v: -15 },
  { t: "Ravalement de façades : paie 25 € par maison et 100 € par hôtel.", k: "repairs", v: [25, 100] },
  { t: "Te voilà délégué du quartier : verse 50 € à chaque joueur.", k: "payEach", v: 50 },
  { t: "Balade en bord de mer : avance jusqu'à la Gare du Port.", k: "goto", v: 5 },
  { t: "Tes actions versent un dividende : reçois 50 €.", k: "money", v: 50 },
  { t: "Un colis t'attend : avance jusqu'à la Rue de la Poste.", k: "goto", v: 11 },
  { t: "Cours de cuisine hors de prix : paie 150 €.", k: "money", v: -150 },
  { t: "Tu gagnes un concours de mots croisés : reçois 100 €.", k: "money", v: 100 },
];

export const SORT = [
  { t: "Un raccourci génial : avance jusqu'à la case Départ.", k: "goto", v: 0 },
  { t: "Le guichet s'est trompé à ton avantage : reçois 200 €.", k: "money", v: 200 },
  { t: "Ton chat chez le vétérinaire : paie 50 €.", k: "money", v: -50 },
  { t: "Tu vends ta collection de timbres : reçois 50 €.", k: "money", v: 50 },
  { t: "Carte « Libéré de prison » : garde-la pour plus tard.", k: "free" },
  { t: "Tu t'es garé n'importe où : va directement en prison.", k: "jail" },
  { t: "C'est ton anniversaire : chaque joueur te donne 10 €.", k: "getEach", v: 10 },
  { t: "Remboursement d'impôts : reçois 20 €.", k: "money", v: 20 },
  { t: "Fuite d'eau chez toi : paie 100 € au plombier.", k: "money", v: -100 },
  { t: "Héritage d'une tante éloignée : reçois 100 €.", k: "money", v: 100 },
  { t: "Gros travaux : paie 40 € par maison et 115 € par hôtel.", k: "repairs", v: [40, 115] },
  { t: "Prime de fin d'année : reçois 100 €.", k: "money", v: 100 },
  { t: "Rendez-vous chez le dentiste : paie 50 €.", k: "money", v: -50 },
  { t: "Deuxième prix au concours de pâtisserie : reçois 10 €.", k: "money", v: 10 },
  { t: "Prime de bénévolat : reçois 25 €.", k: "money", v: 25 },
  { t: "Tu as égaré ton portefeuille : retourne à l'Impasse des Lilas.", k: "to", v: 1 },
];

export const PAWNS = ["#EF4444", "#3B82F6", "#22C55E", "#F59E0B", "#A855F7", "#EC4899"];
