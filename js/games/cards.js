// Cartes : une carte est une chaîne « rang + couleur », ex. "AS", "10H", "QD".
// Couleurs : S pique, H cœur, D carreau, C trèfle.
export const SUITS = ["S", "H", "D", "C"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const SUIT_SYM = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME = { S: "Pique", H: "Cœur", D: "Carreau", C: "Trèfle" };
export const RANK_FR = { J: "V", Q: "D", K: "R", A: "A" };

export const deck = (n = 1) => {
  const d = [];
  for (let k = 0; k < n; k++) for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  return d;
};
export const rankOf = (c) => c.slice(0, -1);
export const suitOf = (c) => c.slice(-1);
export const isRed = (c) => suitOf(c) === "H" || suitOf(c) === "D";
// valeur 2..14 (As haut)
export const rv = (c) => RANKS.indexOf(rankOf(c)) + 2;
export const label = (c) => (RANK_FR[rankOf(c)] || rankOf(c)) + SUIT_SYM[suitOf(c)];
