// Agents secrets : 400 mots courants rangés en 50 thèmes de 8 mots.
// Chaque ligne : indices du thème | les 8 mots | associations « indice:mots couverts » (pour les robots chefs).
export const GROUPS = [
  "océan,marée|bateau vague plage sable requin phare port coquillage|navigation:bateau port phare;dune:sable plage;surf:vague plage;mâchoire:requin;nacre:coquillage",
  "ferme,campagne|vache cochon poule tracteur foin grange mouton coq|lait:vache;oeuf:poule coq;laine:mouton;botte:foin grange;jambon:cochon;labour:tracteur",
  "espace,cosmos|fusée étoile planète lune soleil comète astronaute satellite|orbite:satellite lune planète;nuit:étoile lune;décollage:fusée astronaute;météore:comète;chaleur:soleil",
  "cuisine,recette|four casserole couteau fourchette poêle louche assiette tablier|couverts:couteau fourchette assiette;cuisson:four casserole poêle;bouillon:louche casserole;chef:tablier",
  "musique,orchestre|piano guitare violon tambour trompette flûte harpe micro|cordes:guitare violon harpe;souffle:trompette flûte;touches:piano;rythme:tambour;chanteur:micro",
  "football,stade|ballon but arbitre maillot sifflet terrain coupe équipe|pelouse:terrain ballon but;trophée:coupe;carton:arbitre sifflet;numéro:maillot équipe",
  "école,classe|cahier stylo tableau craie cartable règle gomme maîtresse|écrire:stylo cahier craie;trousse:gomme règle stylo;sac:cartable;leçon:tableau maîtresse",
  "jardin,potager|pelle râteau arrosoir fleur graine tondeuse haie brouette|outils:pelle râteau brouette;pousse:graine fleur;jardinier:arrosoir haie tondeuse",
  "hôpital,santé|médecin infirmière seringue pansement ambulance fièvre vaccin plâtre|piqûre:seringue vaccin;blessure:pansement plâtre;urgence:ambulance;thermomètre:fièvre;blouse:médecin infirmière",
  "forêt,bois|arbre chêne sapin écureuil champignon renard hibou feuille|automne:feuille champignon;noisette:écureuil;nocturne:hibou renard;résineux:sapin;gland:chêne;branche:arbre feuille",
  "ville,urbain|rue immeuble métro trottoir feu bus taxi pont|trajet:métro bus taxi;piéton:trottoir rue feu;traverser:pont;étage:immeuble",
  "château,médiéval|roi reine chevalier dragon princesse épée donjon armure|couronne:roi reine princesse;combat:épée armure chevalier;tour:donjon;flamme:dragon",
  "pirate,trésor|coffre perroquet canon carte île crochet drapeau sabre|butin:coffre;bavard:perroquet;boulet:canon;boussole:carte;naufrage:île;capitaine:crochet sabre;pavillon:drapeau",
  "météo,climat|pluie neige orage nuage vent tempête grêle brouillard|parapluie:pluie;glacial:neige grêle;éclair:orage tempête;ciel:nuage;rafale:vent tempête;gris:brouillard nuage",
  "savane,safari|lion girafe zèbre éléphant hippopotame gazelle crocodile rhinocéros|rayures:zèbre;crinière:lion;trompe:éléphant;cou:girafe;corne:rhinocéros gazelle;fleuve:hippopotame crocodile",
  "cinéma,film|acteur écran caméra scénario réalisateur affiche festival vedette|tournage:caméra réalisateur scénario acteur;projection:écran;placard:affiche;cannes:festival;célébrité:vedette acteur",
  "voyage,vacances|valise passeport avion hôtel billet aéroport bagage touriste|frontière:passeport;vol:avion aéroport billet;chambre:hôtel;visite:touriste;soute:valise bagage",
  "corps,anatomie|main pied genou épaule coude oreille nez coeur|jambe:pied genou;bras:épaule coude main;visage:nez oreille;amour:coeur",
  "habits,mode|chemise pantalon robe chaussette manteau écharpe chapeau ceinture|froid:manteau écharpe;tête:chapeau;pointure:chaussette;boucle:ceinture;bouton:chemise;mariée:robe;jean:pantalon",
  "fruits,verger|pomme poire banane cerise fraise citron orange ananas|rouge:cerise fraise pomme;jaune:banane citron ananas;agrume:citron orange;compote:pomme poire",
  "légumes,potage|carotte tomate salade poireau oignon courgette haricot radis|larmes:oignon;crudités:carotte radis tomate;vinaigrette:salade tomate;vert:haricot courgette poireau",
  "compagnie,animalerie|chien chat lapin hamster tortue canari cheval poney|aboyer:chien;ronronner:chat;carapace:tortue;cage:hamster canari lapin;équitation:cheval poney",
  "bureau,travail|ordinateur clavier souris imprimante agenda réunion patron dossier|informatique:ordinateur clavier souris imprimante;calendrier:agenda;directeur:patron;classeur:dossier;collègue:réunion",
  "boulangerie,pâtisserie|pain croissant baguette gâteau brioche farine levure beurre|matin:croissant brioche pain;anniversaire:gâteau;blé:farine pain;pâte:levure farine;tartine:beurre baguette",
  "fête,soirée|guirlande bougie cadeau invité danse costume confetti masque|carnaval:masque costume confetti;décoration:guirlande;paquet:cadeau;souffler:bougie;piste:danse;hôte:invité",
  "métier,profession|pompier policier boulanger facteur coiffeur dentiste pilote cuisinier|uniforme:pompier policier pilote;lettre:facteur;ciseaux:coiffeur;carie:dentiste;pétrin:boulanger;toque:cuisinier",
  "véhicule,circulation|voiture train vélo moto camion tramway trottinette hélicoptère|rails:train tramway;pédale:vélo trottinette;casque:moto vélo;livraison:camion;hélice:hélicoptère;volant:voiture",
  "maison,mobilier|lit table chaise canapé armoire lampe tapis fauteuil|dormir:lit;assis:chaise fauteuil canapé;lumière:lampe;sol:tapis;rangement:armoire;repas:table",
  "toilette,hygiène|savon brosse dentifrice serviette douche baignoire miroir peigne|mousse:savon;cheveux:brosse peigne;sourire:dentifrice;sécher:serviette;eau:douche baignoire;reflet:miroir",
  "jouet,jeu|poupée toupie puzzle dé bille peluche domino robot|tourner:toupie;morceaux:puzzle;hasard:dé domino;doudou:peluche;câlin:poupée peluche;mécanique:robot;agate:bille",
  "bijou,joaillerie|bague collier diamant perle argent bracelet montre rubis|alliance:bague;huître:perle;pendentif:collier;poignet:bracelet montre;pierre:diamant rubis;monnaie:argent;heure:montre",
  "montagne,alpes|sommet rocher glacier chalet randonnée grotte volcan cascade|escalade:rocher sommet;glace:glacier;refuge:chalet;marche:randonnée;caverne:grotte;lave:volcan;chute:cascade",
  "insecte,bestiole|abeille fourmi papillon araignée moustique coccinelle mouche escargot|miel:abeille;dard:abeille moustique;ailes:papillon mouche;toile:araignée;points:coccinelle;colonie:fourmi;coquille:escargot",
  "peinture,artiste|pinceau palette chevalet crayon peintre musée sculpture portrait|dessin:crayon portrait;atelier:chevalet peintre pinceau;louvre:musée;statue:sculpture;couleurs:palette",
  "cirque,chapiteau|clown jongleur acrobate magicien trapèze dompteur funambule cerceau|rire:clown;illusion:magicien;fauve:dompteur;équilibre:funambule acrobate;voltige:trapèze acrobate;lancer:jongleur cerceau",
  "enquête,détective|loupe empreinte suspect témoin prison menottes alibi voleur|crime:suspect voleur;cellule:prison;poignets:menottes;doigt:empreinte;grossir:loupe;tribunal:témoin alibi",
  "technologie,numérique|téléphone tablette internet batterie câble console wifi photo|appel:téléphone;charge:batterie câble;réseau:internet wifi;manette:console;selfie:photo;tactile:tablette téléphone",
  "magie,sorcellerie|sorcière fantôme vampire balai citrouille chaudron potion zombie|halloween:citrouille;drap:fantôme;sang:vampire;voler:balai sorcière;marmite:chaudron potion;mort:zombie fantôme",
  "aquarium,abysses|poisson dauphin baleine pieuvre méduse crabe phoque hippocampe|tentacule:pieuvre méduse;pince:crabe;nageoire:poisson dauphin phoque;géant:baleine;corail:hippocampe poisson",
  "horloge,temps|minute seconde réveil sablier semaine mois année siècle|durée:minute seconde;sonnerie:réveil;écoulement:sablier;date:semaine mois année;histoire:siècle",
  "olympique,sportif|tennis golf rugby natation judo boxe escrime basket|balle:tennis golf;ovale:rugby;piscine:natation;kimono:judo;gants:boxe;fleuret:escrime;panier:basket",
  "restaurant,menu|serveur addition pourboire entrée dessert plat réservation nappe|payer:addition pourboire;sucré:dessert;principal:plat;début:entrée;plateau:serveur;complet:réservation;tissu:nappe",
  "famille,parenté|mère père frère soeur bébé cousin oncle tante|parents:mère père;fratrie:frère soeur;couche:bébé;neveu:oncle tante cousin",
  "oiseau,volatile|aigle pigeon corbeau mouette cygne pingouin moineau autruche|rapace:aigle;noir:corbeau;voyageur:pigeon;côte:mouette;lac:cygne;banquise:pingouin;piaf:moineau;plume:autruche cygne",
  "désert,égypte|pyramide chameau oasis momie pharaon scorpion cactus sphinx|bosse:chameau;épines:cactus;venin:scorpion;tombeau:momie pharaon pyramide;énigme:sphinx;palmier:oasis",
  "chantier,bricolage|marteau tournevis clou scie perceuse vis échelle brique|planche:scie clou;taper:marteau clou;trou:perceuse;boulon:vis tournevis;mur:brique;grimper:échelle",
  "boisson,soif|café thé chocolat jus limonade sirop tasse verre|chaud:café thé chocolat;bulles:limonade;pressé:jus;grenadine:sirop;anse:tasse;transparent:verre",
  "bouquet,fleuriste|rose tulipe marguerite tournesol muguet orchidée coquelicot lavande|pétale:rose marguerite coquelicot;mai:muguet;hollande:tulipe;huile:tournesol;violet:lavande orchidée;champ:coquelicot lavande tournesol",
  "légende,mythologie|licorne sirène fée elfe lutin ogre centaure troll|paillettes:licorne;nageuse:sirène;voeu:fée;pointu:elfe lutin;monstre:ogre troll;sagittaire:centaure",
  "noël,réveillon|traîneau renne cheminée hotte bûche dinde crèche houx|attelage:traîneau renne;fumée:cheminée;porter:hotte;rondin:bûche;volaille:dinde;nativité:crèche;piquant:houx",
];

// tables construites une fois : mots, thème de chaque mot, associations indice -> mots
export const WORDS = [];
export const THEME = {};
export const ASSOC = []; // { clue, words: [...], theme: true|false }
GROUPS.forEach((line, g) => {
  const [themes, words, subs] = line.split("|");
  const ws = words.split(" ");
  for (const w of ws) { WORDS.push(w); THEME[w] = g; }
  for (const c of themes.split(",")) ASSOC.push({ clue: c, words: ws, theme: true });
  for (const part of subs.split(";")) {
    const [c, list] = part.split(":");
    ASSOC.push({ clue: c, words: list.split(" "), theme: false });
  }
});
