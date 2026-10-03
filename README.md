# JEUX

12 jeux à plusieurs entre amis, en solo contre des robots, avec comptes, amis, gemmes, boutique et classement.
Design inspiré de la direction « Arcade » de Learno (Learno n'est pas modifié), en verre liquide, thème sombre, clair ou système.

## Les jeux

| Jeu | Joueurs | Ce qui est vérifié par les tests |
|---|---|---|
| Poker Texas Hold'em | 2 à 8 | blinds, ordre de parole en tête à tête, relance minimale, relance incomplète, tapis, pots annexes, jetons conservés |
| Blackjack | 1 à 5 | mises, tirer, rester, doubler, banque à 17, blackjack payé 3 pour 2 |
| Huit américain | 2 à 6 | 8 joker, 2, Valet, As, pioche et passe, classement aux points |
| Bowling | 1 à 6 | physique déterministe (même résultat sur tous les téléphones), strikes, spares, 10e frame |
| Sudoku | 1 à 4 | grilles à solution unique, 3 niveaux, course sur une grille commune |
| Mots fléchés | 1 à 6 | grilles générées avec définitions, aucun mot parasite |
| Motus | 1 à 6 | couleurs avec lettres doublées, dictionnaire de 45 000 mots, manches |
| Mots mêlés | 1 à 6 | 8 thèmes, 8 directions |
| Yams | 1 à 6 | 13 cases, bonus 63, 3 lancers |
| Puissance 4 | 2 | alignements, robot minimax |
| Dames internationales | 2 | prise obligatoire et majoritaire, dames volantes, promotion en fin de coup |
| Bataille navale | 2 | placement, touché, coulé |

Chaque jeu a des robots (3 niveaux) pour le mode solo et pour compléter une table.

## Lancer en local

```bash
npm install
npm run serve          # http://localhost:8765
```

`http://localhost:8765/?mock=1` utilise un serveur simulé (dans le navigateur) : pratique pour tester sans compte.

## Tests

```bash
npm test               # logique des 12 jeux (47 tests)
npm run e2e            # parties complètes dans Chromium + partie à deux joueurs (serveur lancé)
```

Les fonctions serveur se testent avec `tests/sql_test.sql` (tout est annulé à la fin, le bloc finit par `TESTS_OK`).

## Serveur (Supabase)

Projet Supabase partagé avec Learno, tables préfixées `jeux_` (rien de Learno n'est touché).
Schéma : `supabase/schema.sql`, prix de la boutique : `supabase/items.sql` (générés par `node tools/gen-items-sql.mjs`).
Les gemmes et l'XP ne se modifient que par des fonctions serveur (achat, coffre du jour, gains de fin de partie avec garde-fous).

## Mise en ligne

Le workflow `.github/workflows/pages.yml` publie le site sur GitHub Pages à chaque fusion dans `main`.
Il faut activer Pages (Settings > Pages > Source : GitHub Actions). Le dépôt étant privé, Pages demande un compte GitHub payant ou de passer le dépôt en public.

## Illustrations

Les cartes de jeux affichent un dégradé et une icône en verre. Pour ajouter une illustration : déposer `assets/covers/<id>.webp`
et ajouter l'identifiant dans `COVERS` (`js/screens/home.js`).
