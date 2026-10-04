// Banque de La roue des mots : [catégorie, texte]. Pas de « œ » (une case = une lettre).
const E = "Expression", P = "Proverbe", F = "Film", L = "Livre", W = "Lieu célèbre", C = "Cuisine", H = "Personnage";
const list = (cat, s) => s.split("\n").map((x) => x.trim()).filter(Boolean).map((t) => [cat, t]);

export const PHRASES = [
  ...list(E, `
Avoir le cafard
Poser un lapin
Coûter les yeux de la tête
Avoir la tête dans les nuages
Tomber dans les pommes
Mettre les pieds dans le plat
Avoir un poil dans la main
Prendre la mouche
Faire la grasse matinée
Avoir le coup de foudre
Donner sa langue au chat
Être dans la lune
Mettre la main à la pâte
Avoir la main verte
Raconter des salades
Tirer les vers du nez
Avoir les yeux plus gros que le ventre
Faire la sourde oreille
Être myope comme une taupe
Se lever du pied gauche
Avoir une faim de loup
Être têtu comme une mule
Avoir la chair de poule
Tourner autour du pot
Mettre son grain de sel
Couper la poire en deux
Avoir du pain sur la planche
Être sur son trente et un
Prendre ses jambes à son cou
Il pleut des cordes
Passer l'éponge
Mener quelqu'un en bateau
Faire d'une pierre deux coups
Jeter l'argent par les fenêtres
Avoir le bras long
Mettre la puce à l'oreille
Avoir un chat dans la gorge
Être comme un poisson dans l'eau
Chercher une aiguille dans une botte de foin
Avoir la grosse tête
Monter sur ses grands chevaux
Être aux anges
Avoir des fourmis dans les jambes
Faire un froid de canard
Dormir sur ses deux oreilles
Avoir la langue bien pendue
Tomber des nues
Rire jaune
Voir la vie en rose
Broyer du noir
Être blanc comme neige
Rouge comme une tomate
Faire chou blanc
Les carottes sont cuites
Ce n'est pas la mer à boire
Avoir le vent en poupe
Être dans le même bateau
Se noyer dans un verre d'eau
Garder la tête froide
Avoir les dents longues
Ne pas y aller par quatre chemins
Prendre le taureau par les cornes
Appeler un chat un chat
Être né sous une bonne étoile
Avoir plusieurs cordes à son arc
Tenir la chandelle
Faire la pluie et le beau temps
Payer rubis sur l'ongle
Avoir le nez creux
Mettre les bouchées doubles
Être sur la paille
Avoir un coup de barre
Changer son fusil d'épaule
Avoir l'estomac dans les talons
Mettre de l'eau dans son vin
Être à côté de la plaque
Faire un tabac
Sauter du coq à l'âne
Avoir une mémoire d'éléphant
Avoir d'autres chats à fouetter
Quand les poules auront des dents
Être le dindon de la farce
Revenir à ses moutons
Avoir une peur bleue
Il y a anguille sous roche
Verser des larmes de crocodile
Ménager la chèvre et le chou
Mettre les voiles
Avoir la pêche
Tomber à pic
Être au bout du rouleau
En faire tout un fromage
Ce n'est pas du gâteau
Mettre du beurre dans les épinards
Pédaler dans la semoule
Rouler sur l'or
Couper les cheveux en quatre
Se serrer les coudes
Mettre les points sur les i
Tirer son épingle du jeu
Avoir le dernier mot
Remuer ciel et terre
Avoir la tête sur les épaules
Jouer cartes sur table
Montrer patte blanche
Donner le feu vert
Tomber à l'eau
Avoir le moral dans les chaussettes
Se faire un sang d'encre
Prendre la poudre d'escampette
Mettre la clé sous la porte
Vendre la mèche
Ne pas être sorti de l'auberge
Être tiré à quatre épingles
Faire fausse route
Avoir un trou de mémoire
Jeter un froid
Avoir la puce à l'oreille
Prendre son courage à deux mains
Être sur les nerfs
`),
  ...list(P, `
Petit à petit, l'oiseau fait son nid
L'habit ne fait pas le moine
Pierre qui roule n'amasse pas mousse
Tel est pris qui croyait prendre
Qui se ressemble s'assemble
Les chiens aboient, la caravane passe
Rien ne sert de courir, il faut partir à point
La nuit porte conseil
Chat échaudé craint l'eau froide
Une hirondelle ne fait pas le printemps
Mieux vaut tard que jamais
Qui ne tente rien n'a rien
L'union fait la force
Après la pluie, le beau temps
Il n'y a pas de fumée sans feu
Quand le chat n'est pas là, les souris dansent
Tout vient à point à qui sait attendre
L'appétit vient en mangeant
Qui sème le vent récolte la tempête
Les bons comptes font les bons amis
À cheval donné, on ne regarde pas les dents
Paris ne s'est pas fait en un jour
La parole est d'argent, le silence est d'or
Qui va à la chasse perd sa place
Un tiens vaut mieux que deux tu l'auras
Ce sont les cordonniers les plus mal chaussés
Il ne faut jamais dire jamais
Qui aime bien châtie bien
Tous les chemins mènent à Rome
Les murs ont des oreilles
Il faut battre le fer pendant qu'il est chaud
Le temps, c'est de l'argent
Qui dort dîne
L'occasion fait le larron
Plus on est de fous, plus on rit
Les absents ont toujours tort
Chose promise, chose due
Mieux vaut prévenir que guérir
À chaque jour suffit sa peine
Comme on fait son lit, on se couche
Qui peut le plus peut le moins
Bien mal acquis ne profite jamais
Vouloir, c'est pouvoir
Il n'y a pas de rose sans épines
Il faut que jeunesse se passe
Les petits ruisseaux font les grandes rivières
Après l'effort, le réconfort
Rira bien qui rira le dernier
L'erreur est humaine
Noël au balcon, Pâques au tison
En avril, ne te découvre pas d'un fil
Il ne faut pas réveiller le chat qui dort
Charité bien ordonnée commence par soi-même
À l'impossible nul n'est tenu
Qui trop embrasse mal étreint
Pas de nouvelles, bonnes nouvelles
Un malheur n'arrive jamais seul
La vérité sort de la bouche des enfants
Il faut de tout pour faire un monde
Petite pluie abat grand vent
Le jeu n'en vaut pas la chandelle
C'est en forgeant qu'on devient forgeron
Impossible n'est pas français
Les grands esprits se rencontrent
Aide-toi, le ciel t'aidera
Abondance de biens ne nuit pas
Quand on parle du loup, on en voit la queue
À bon chat, bon rat
Ventre affamé n'a point d'oreilles
L'avenir appartient à ceux qui se lèvent tôt
Mauvaise herbe croît toujours
Les conseilleurs ne sont pas les payeurs
Il ne faut pas vendre la peau de l'ours avant de l'avoir tué
Il n'est pire sourd que celui qui ne veut pas entendre
`),
  ...list(F, `
Le Fabuleux Destin d'Amélie Poulain
Les Visiteurs
Intouchables
Bienvenue chez les Ch'tis
La Grande Vadrouille
Les Bronzés font du ski
La Cité de la peur
Le Grand Bleu
Les Choristes
Le Seigneur des anneaux
La Guerre des étoiles
Le Roi lion
La Belle et la Bête
Blanche-Neige et les Sept Nains
Le Livre de la jungle
Les Aristochats
La Reine des neiges
Retour vers le futur
Les Dents de la mer
Le Parrain
Autant en emporte le vent
La vie est belle
Le Magicien d'Oz
Les Tontons flingueurs
Le Corniaud
La Soupe aux choux
Le Gendarme de Saint-Tropez
Trois Hommes et un couffin
Les Demoiselles de Rochefort
Les Parapluies de Cherbourg
Le Monde de Nemo
Les Indestructibles
Ratatouille
Le Cinquième Élément
La Folie des grandeurs
Les Quatre Cents Coups
Le Grand Restaurant
La Chèvre
`),
  ...list(L, `
Les Misérables
Le Petit Prince
Le Comte de Monte-Cristo
Les Trois Mousquetaires
Madame Bovary
Le Rouge et le Noir
Germinal
Vingt Mille Lieues sous les mers
Le Tour du monde en quatre-vingts jours
Notre-Dame de Paris
L'Étranger
La Peste
Candide
Les Fleurs du mal
Le Père Goriot
Bel-Ami
Le Horla
Cyrano de Bergerac
Le Bourgeois gentilhomme
L'Avare
Le Malade imaginaire
Le Cid
Voyage au centre de la Terre
De la Terre à la Lune
L'Île mystérieuse
Les Liaisons dangereuses
Le Grand Meaulnes
Alice au pays des merveilles
Le Petit Chaperon rouge
Cendrillon
Le Chat botté
La Belle au bois dormant
Le Vilain Petit Canard
Harry Potter à l'école des sorciers
Les Aventures de Tom Sawyer
L'Assommoir
Au Bonheur des Dames
Le Mariage de Figaro
Le Barbier de Séville
Le Lys dans la vallée
La Princesse de Clèves
Les Contemplations
Le Petit Poucet
Le Vieil Homme et la Mer
La Ferme des animaux
Robinson Crusoé
L'Île au trésor
Sans famille
Orgueil et Préjugés
Les Hauts de Hurlevent
`),
  ...list(W, `
La tour Eiffel
L'Arc de triomphe
Le Mont-Saint-Michel
Le château de Versailles
Le musée du Louvre
La Côte d'Azur
Les Champs-Élysées
La place de la Concorde
Le pont du Gard
La dune du Pilat
Les gorges du Verdon
Le viaduc de Millau
Le cirque de Gavarnie
Le lac Léman
La Grande Muraille de Chine
La statue de la Liberté
Le Colisée
La tour de Pise
Les pyramides de Gizeh
Le Taj Mahal
Le Machu Picchu
Les chutes du Niagara
Le Grand Canyon
La Sagrada Família
L'Acropole d'Athènes
Le mont Blanc
Le pic du Midi
La cité de Carcassonne
Les châteaux de la Loire
Le château de Chambord
La baie d'Along
L'opéra de Sydney
Le canal de Suez
La mer Morte
Le désert du Sahara
La forêt amazonienne
Le Kilimandjaro
La place Saint-Marc
Le palais des Papes
Le pont Neuf
`),
  ...list(C, `
La blanquette de veau
Le pot-au-feu
La ratatouille niçoise
La tarte Tatin
La crème brûlée
La mousse au chocolat
Le gratin dauphinois
La quiche lorraine
La bouillabaisse
Le cassoulet
La choucroute garnie
Les crêpes Suzette
Le hachis parmentier
Les moules-frites
Le croque-monsieur
La salade niçoise
Le clafoutis aux cerises
Les profiteroles
L'île flottante
Le paris-brest
La tartiflette
La raclette
La fondue savoyarde
Le millefeuille
Le far breton
Le kouign-amann
La galette des rois
La soupe à l'oignon
Les escargots de Bourgogne
Le canard à l'orange
Le pain perdu
La sole meunière
La tarte au citron meringuée
Le pain au chocolat
Le flan pâtissier
`),
  ...list(H, `
Astérix le Gaulois
Tintin et Milou
Le capitaine Haddock
Lucky Luke
Gaston Lagaffe
Spirou et Fantasio
Les Schtroumpfs
Mickey Mouse
Peter Pan
Robin des Bois
Le capitaine Crochet
Arsène Lupin
Sherlock Holmes
Le commissaire Maigret
D'Artagnan
Jean Valjean
Le père Noël
La fée Clochette
Le professeur Tournesol
Les Dupond et Dupont
Bécassine
Le Marsupilami
Iznogoud
Boule et Bill
Titeuf
Kirikou
Cosette
Quasimodo
Le Fantôme de l'Opéra
Zorro
Winnie l'ourson
Barbe-Bleue
Merlin l'enchanteur
Le roi Arthur
Obélix et Idéfix
Le Petit Nicolas
`),
];
