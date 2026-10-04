# Cahier des charges : créer un jeu dans JEUX

Repo : /home/user/JEUX (vanilla JS, modules ES, sans build, GitHub Pages). Tout le texte visible est en
français, au tutoiement, naturel. **Interdit d'écrire le caractère « — » (tiret cadratin), même en commentaire.**
Pas de commit, pas de push : l'orchestrateur s'en charge.

## 1. Fichiers que tu crées (et SEULEMENT ceux-là)

Pour chaque jeu `<id>` (l'identifiant est imposé, déjà déclaré dans `js/games/index.js`) :
- `js/games/<id>.js` : la logique pure (aucun DOM, testable sous Node).
- `js/views/<id>.js` : l'affichage et les interactions.
- `css/g/<id>.css` : le style propre au jeu (chargé automatiquement). Préfixe toutes tes classes par `g-<id>`.
- `tests/<id>.test.mjs` : les tests (node --test).
- Données éventuelles : `js/data/<id>_*.js` (questions, mots, lieux...). Aides partagées entre TES jeux :
  `js/games/lib/<nom>.js` (nom unique, préfixé par un de tes ids).

NE MODIFIE PAS : js/games/index.js, js/engine.js, js/rooms.js, js/ui.js, js/screens/*, js/views/common.js,
js/games/cards.js, css/app.css, css/games.css, les jeux existants. Tu peux les IMPORTER. Si un changement
partagé te semble nécessaire, explique-le dans ton rapport au lieu de le faire.

Ressources partagées utiles :
- `js/data/dico.js` : dictionnaire français complet (311 000 mots, sans accents) :
  `isWord(w)`, `normWord(w)`, `randomWord(rng, len)`, `wordsOf(len)`, `wordsFromLetters(letters, opts)`,
  `wordsContaining(sub, opts)`. Il pèse 3 Mo : ne l'importe que dans les jeux qui en ont vraiment besoin.
- `js/games/cards.js` : jeu de 52 cartes (cartes en chaînes "10H", "QS"...), `deck()`, `rv()`, `label()`.
- `js/views/common.js` : `cardHTML(c, opts)`, `cardBackHTML(deckId)`, `feltStyle(tableId)`, `dieHTML(v)`,
  `turnLine(ctx, who, texte)`, `nameOf(ctx, id)`.
- `js/ui.js` : `h(tag, attrs, ...enfants)` (créateur d'éléments), `icon`, `tile`, `toast`, `sfx`, `buzz`, `sheet`.
- Classes CSS globales réutilisables : `btn` (+ `green`, `gold`, `red`, `purple`, `ghost`, `small`, `block`),
  `card glass`, `felt` (tapis), `pcard` (carte à jouer), `cards-row`, `hand`, `hcard`, `turnmsg` (+ `me`),
  `row`, `gap`, `center`, `grow`, `small`, `dim`, `lead`, `h1`/`h2`/`h3`, `input`, `chip`, `badge`, `seg`.
  Variables : `--green`, `--blue`, `--gold`, `--red`, `--purple`, `--card`, `--card2`, `--line`, `--txt`, `--dim`.
  Le thème clair et sombre doivent rester lisibles tous les deux.

Exemples à lire avant de commencer (ils marchent et sont testés) :
- tour par tour + robot : `js/games/puissance4.js`, `js/games/dames.js` + leurs vues ;
- cartes avec infos cachées : `js/games/poker.js`, `js/games/huit.js` + vues ;
- course simultanée (tout le monde joue en même temps) : `js/games/sudoku.js`, `js/games/motus.js` + vues ;
- physique déterministe animée (lancer, rebonds) : `js/games/bowling.js` + `js/views/bowling.js` ;
- dés : `js/games/yams.js` ; réglages `options`/`modes` : n'importe lequel des 12 jeux ;
- tests : `tests/puissance4.test.mjs`, `tests/harness.mjs`.

## 2. Interface de la logique (`js/games/<id>.js`)

```js
import { fail, rankByScore, rng } from "../engine.js";
export const meta = { id, name, cat, min, max, turnTime, race?, color, desc, rules: [...] };
export const options = [...];   // 2 à 5 réglages (voir §4)
export const modes = [...];     // 3 ou 4 modes, le premier = "Classique" = les défauts
export function setup(players, settings, rng) { return state; } // players: [{id, name, bot}]
export function toAct(state) { return [ids qui doivent agir maintenant]; } // [] si fini
export function reduce(state, pid, action) { ...; return state; } // muter state est permis (c'est une copie)
export function result(state) { return null | { ranking: [{ id, rank, score }] }; }
export function bot(state, pid, rng) { return action | null; }  // null = attend (jeux en course)
export function auto(state, pid, rng) { ... }       // facultatif : action jouée quand le temps est écoulé
export function botDelay(state, pid, rng) { ms }    // facultatif : temps de réflexion du robot
```
- `meta.min`, `meta.max`, `meta.name`, `meta.cat` : reprends ceux de `js/games/index.js` (max 8 joueurs).
- `meta.turnTime` : secondes par tour (0 = libre). Le moteur pose le délai et, s'il expire, joue `auto` (ou `bot`)
  à la place du joueur. Les jeux à phases (votes, indices) DOIVENT avoir un délai raisonnable.
- `toAct` peut renvoyer plusieurs joueurs à la fois (votes simultanés, course). Jeu de course : `meta.race = true`.
- `reduce` lève une erreur avec `fail("message en français")` si l'action est illégale. `action.seed` (entier) et
  `action.now` (ms) sont fournis : pour du hasard dans reduce, utilise `rng(action.seed)`. JAMAIS Math.random
  ni Date.now dans la logique. L'état doit être 100 % JSON (pas de Set, Map, undefined dans les tableaux).
- Champs réservés de l'état : round, startedAt, seq, _dl, _who, result.
- `settings.level` (1 facile, 2 moyen, 3 fort) règle la force des robots. Une valeur absente ou invalide
  de n'importe quel réglage retombe sur le défaut.
- L'état est réécrit en entier à chaque coup sur Supabase : garde-le compact (idéalement < 30 Ko).
- Classement : `rankByScore(entries, lowWins)` ; donne un `score` parlant (points, jetons...).
- Jeux en ÉQUIPE : `result()` renvoie `{ ranking, teams: [[id1, id3], [id2, id4]] }`. Des partenaires classés 1ers
  ensemble comptent comme vainqueurs (et non à égalité), à l'écran comme pour les gemmes.

## 3. MULTIJOUEUR OBLIGATOIRE

Chaque jeu se joue à plusieurs (amis en ligne et/ou robots qui complètent). Les jeux « solo par nature »
(2048, démineur, solitaire...) deviennent des COURSES : même graine, même grille pour tous, chacun joue de son
côté, le meilleur score ou le plus rapide gagne, et on voit la progression des autres en direct.
Les robots doivent savoir jouer à TOUT (y compris jeux de soirée : votes, indices, réponses plausibles).
Infos cachées (main, rôle, mot secret) : l'état est partagé par tous les appareils, donc la VUE ne doit
afficher à chacun que ce qu'il a le droit de voir (`ctx.me`).

## 4. Réglages

```js
export const options = [
  { key: "rounds", label: "Manches", icon: "🔁", values: [[3, "3", "Rapide"], [5, "5", "Standard"]], def: 5 },
];
export const modes = [
  { id: "classique", name: "Classique", emoji: "🎯", desc: "Une phrase courte.", set: { rounds: 5 } },
];
```
Libellé ≤ 12 caractères, indication ≤ 18. Interdit dans options : `level`, `turnTime`, `mode`.
Chaque mode doit correspondre à une combinaison distincte. Les options doivent CHANGER le jeu.

## 5. Vue (`js/views/<id>.js`)

```js
export function mount(root, ctx) { /* construit dans root */ return { update(ctx) {...}, destroy() {...} }; }
export const scoreOf = (state, id) => ...;   // facultatif : score affiché dans la bande des joueurs
export const scoreLabel = (score, state, id) => "...";  // facultatif : texte du score dans les résultats
```
ctx = `{ state, me, players (id -> {name, bot, avatar}), order, room, settings, act(action), skin, sfx, toast, buzz, isHost }`.
`ctx.act(action)` envoie l'action (le moteur ajoute seed et now). `update` est appelé à chaque changement d'état.
Design « jeu mobile premium » : grand, coloré, lisible au pouce (cibles ≥ 44 px), animations courtes
(CSS transitions/keyframes), largeur 360 à 430 px d'abord, puis tablette. Indique toujours clairement à qui
c'est le tour et ce qu'il faut faire. Sons : `ctx.sfx.tap()`, `.ok()`, `.bad()`, `.card()`, `.coin()`, `.win()`.

## 6. Tests (`tests/<id>.test.mjs`) : obligatoires et verts

- partie complète jouée par les robots (`playout` de tests/harness.mjs) pour CHAQUE mode, avec min et max joueurs ;
- `timeoutPlayout` : les délais seuls finissent la partie (si turnTime > 0) ;
- règles précises : coups illégaux refusés, cas limites, calcul des scores ;
- options et modes bien formés ; les infos de données (questions, mots) sont valides (pas de doublons, réponse
  présente dans les choix, etc.).
Lance `node --test tests/<id>.test.mjs` puis `npm test` (tout doit rester vert).

Vérifie ENSUITE dans le navigateur (le serveur tourne sur http://localhost:8765 ; sinon lance-le en arrière-plan
avec `npx http-server -p 8765 -s -c-1 .` depuis le repo) :
`node tests/e2e/allgames.cjs /tmp/claude-0/-home-user-JEUX/0974fc9d-ac6e-5fa9-81cd-b07b2135ef2c/scratchpad/shots_<id> <id>`
Ce script se connecte, lance ta partie contre des robots, fait jouer le joueur humain avec ton `bot`, et
prend des captures `g-<id>-1.png` (en cours) et `g-<id>-2.png` (fin). REGARDE ces captures (outil Read) et
corrige tout ce qui est moche, illisible, qui déborde ou qui est vide. Il doit afficher « aucune erreur ».

## 7. Contenu (questions, mots, lieux, défis...)

Écris un contenu riche (des centaines d'éléments quand c'est un quiz) et SURTOUT exact : uniquement des faits
connus et vérifiables, pas d'approximation. En cas de doute sur un fait, ne le mets pas. Pas de contenu
choquant (jeux de soirée : drôle mais tous publics, pas d'alcool obligatoire, rien d'humiliant).

## 8. Rapport final (court)

Pour chaque jeu : règles retenues, options et modes, ce que font les robots, résultat des tests (pass/fail),
résultat du test navigateur, limites connues, et tout changement partagé que tu recommandes.
