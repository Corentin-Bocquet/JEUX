// Lieux de l'Espion : nom, émoji, rôles, et réponses types (indices sans nommer le lieu)
// utilisées par les robots. Format : Nom|émoji|rôle,rôle,...|réponse;réponse;...
const RAW = `
Hôpital|🏥|Chirurgien,Infirmière,Patient,Ambulancier,Visiteur,Interne,Anesthésiste|On attend souvent très longtemps.;L'odeur de désinfectant me suit partout.;Je croise beaucoup de blouses blanches.;Ici, on espère surtout de bonnes nouvelles.;Les couloirs sont interminables.;On y vient rarement par plaisir.
Plage|🏖️|Maître-nageur,Vendeur de glaces,Touriste,Surfeur,Enfant,Photographe,Sauveteur|J'ai du sable jusque dans les chaussures.;La crème solaire est obligatoire.;Le bruit des vagues me détend.;Il faut surveiller la marée.;Les serviettes sont serrées les unes contre les autres.;Je cherche un coin d'ombre.
École|🏫|Professeur,Élève,Directeur,Surveillant,Cuisinier de cantine,Parent,Infirmière scolaire|La sonnerie rythme ma journée.;Il y a beaucoup de cahiers et de cartables.;La récréation est le meilleur moment.;On apprend quelque chose chaque jour.;Le tableau est couvert de craie.;Les devoirs n'attendent pas.
Avion|✈️|Pilote,Hôtesse de l'air,Passager,Copilote,Steward,Enfant,Mécanicien|Mes oreilles se bouchent au décollage.;La ceinture doit rester attachée.;Le hublot offre une vue incroyable.;Le plateau-repas n'est pas terrible.;On est un peu serré dans les sièges.;Les turbulences me font peur.
Restaurant|🍽️|Chef,Serveur,Client,Plongeur,Sommelier,Critique culinaire,Maître d'hôtel|On consulte la carte longtemps.;L'addition arrive toujours trop vite.;Ça sent bon depuis la cuisine.;Il faut réserver le samedi soir.;On laisse parfois un pourboire.;Les assiettes sont joliment dressées.
Banque|🏦|Guichetier,Directeur,Client,Agent de sécurité,Conseiller,Braqueur,Convoyeur de fonds|Tout tourne autour de l'argent.;Le coffre-fort est bien gardé.;On fait la queue au guichet.;Il faut signer beaucoup de papiers.;Les caméras sont partout.;On parle de prêts et d'intérêts.
Cinéma|🎬|Projectionniste,Spectateur,Vendeur de pop-corn,Ouvreuse,Critique,Agent d'entretien,Caissier|Il faut éteindre son téléphone.;Le pop-corn craque sous la dent.;Il fait noir pendant tout le spectacle.;L'écran est immense.;On chuchote pour ne gêner personne.;Les bandes-annonces sont trop longues.
Supermarché|🛒|Caissier,Client,Manutentionnaire,Boucher,Vigile,Chef de rayon,Enfant|Mon chariot a une roue qui grince.;Je compare les prix des produits.;La file d'attente avance lentement.;Il y a des promotions partout.;J'ai oublié ma liste de courses.;Les rayons sont bien rangés.
Commissariat|🚓|Commissaire,Policier,Suspect,Avocat,Témoin,Journaliste,Secrétaire|On y dépose souvent une plainte.;Il y a des menottes sur le bureau.;Les interrogatoires durent longtemps.;On remplit des procès-verbaux.;Les uniformes sont partout.;Certains passent la nuit en cellule.
Cirque|🎪|Clown,Acrobate,Dompteur,Jongleur,Spectateur,Magicien,Monsieur Loyal|On est assis autour d'une piste ronde.;Il y a des numéros impressionnants.;Les enfants rient beaucoup.;Les costumes brillent de partout.;Ça sent un peu la sciure.;On applaudit très fort à la fin.
Station spatiale|🛰️|Astronaute,Commandant,Ingénieur,Médecin,Scientifique,Touriste de l'espace,Mécanicien|Tout flotte autour de moi.;La vue sur la Terre est magique.;On boit avec une paille spéciale.;Dormir attaché, c'est bizarre.;L'entraînement a duré des années.;Sortir sans combinaison est impossible.
Sous-marin|🚢|Commandant,Opérateur sonar,Mécanicien,Cuisinier,Marin,Radio,Médecin|On ne voit jamais la lumière du jour.;L'espace est très étroit.;Le périscope sert à observer.;On reste des semaines sous l'eau.;Le sonar fait des bips réguliers.;Il faut économiser l'air.
Bateau de croisière|🛳️|Capitaine,Serveur,Touriste,Animateur,Barman,Musicien,Cuisinier|On visite plusieurs escales.;Il y a des buffets à volonté.;Le pont est plein de transats.;Le mal de mer me guette.;Les soirées dansantes s'enchaînent.;La cabine a un petit hublot.
Musée|🖼️|Guide,Gardien,Visiteur,Conservateur,Restaurateur,Artiste,Écolier|Il est interdit de toucher.;On parle à voix basse.;Les œuvres ont parfois des siècles.;Le guide raconte des anecdotes.;Il faut parfois un audioguide.;La boutique de souvenirs est à la sortie.
Zoo|🦁|Soigneur,Vétérinaire,Visiteur,Enfant,Guide,Vendeur de glaces,Photographe|Les animaux viennent du monde entier.;On évite de nourrir les pensionnaires.;Les enclos sont nombreux.;Le repas des otaries est très attendu.;Ça sent un peu fort par endroits.;On marche beaucoup toute la journée.
Ferme|🐄|Fermier,Vétérinaire,Tractoriste,Enfant,Vendeur,Saisonnier,Fromager|On se lève à l'aube.;Les bottes sont indispensables.;Les animaux ont faim tous les matins.;La récolte dépend de la météo.;Le tracteur ne s'arrête jamais.;Ça sent le foin.
Casino|🎰|Croupier,Joueur,Agent de sécurité,Serveur,Directeur,Tricheur,Touriste|On peut tout perdre en une soirée.;Les jetons s'empilent sur le tapis vert.;Les machines clignotent sans arrêt.;Il n'y a aucune horloge.;La chance tourne vite.;On mise et on croise les doigts.
Hôtel|🏨|Réceptionniste,Femme de chambre,Client,Bagagiste,Directeur,Concierge,Cuisinier|On rend la clé en partant.;Le petit-déjeuner est servi jusqu'à dix heures.;Les draps sont changés chaque jour.;Il y a un panneau ne pas déranger.;Le service d'étage est pratique.;On y reste quelques nuits.
Théâtre|🎭|Comédien,Metteur en scène,Spectateur,Souffleur,Costumière,Machiniste,Ouvreuse|Le rideau rouge se lève.;On applaudit à la fin de chaque acte.;Les répétitions durent des semaines.;Le trac est terrible avant d'entrer.;Les décors changent entre les scènes.;On réserve souvent un balcon.
Église|⛪|Prêtre,Fidèle,Organiste,Touriste,Sacristain,Choriste,Mariée|Les cloches sonnent à l'heure.;Les vitraux colorent la lumière.;On parle tout bas.;L'orgue résonne très fort.;On y célèbre des mariages.;Les bancs sont en bois.
Gare|🚉|Contrôleur,Voyageur,Chef de gare,Vendeur de journaux,Conducteur,Agent de nettoyage,Porteur|Le panneau des départs affiche du retard.;Il faut composter ou scanner son billet.;Les annonces résonnent partout.;On court souvent pour ne pas rater le départ.;Les quais sont bondés le vendredi.;Les valises roulent dans tous les sens.
Aéroport|🛫|Douanier,Pilote,Voyageur,Agent de sécurité,Hôtesse,Bagagiste,Contrôleur aérien|Il faut enlever sa ceinture au contrôle.;Les liquides sont interdits en cabine.;On attend la porte d'embarquement.;Les valises tournent sur le tapis.;Les écrans annoncent les vols.;On arrive deux heures en avance.
Base militaire|🪖|Soldat,Général,Cuisinier,Médecin,Pilote,Recrue,Sentinelle|Le réveil sonne très tôt.;On marche au pas.;Les grades comptent beaucoup.;L'uniforme est obligatoire.;Les exercices sont épuisants.;On salue ses supérieurs.
Station de ski|⛷️|Moniteur,Skieur,Perchman,Secouriste,Loueur de skis,Snowboardeur,Cuisinier de chalet|Les remontées ouvrent à neuf heures.;Il fait froid mais le soleil tape.;Les pistes rouges sont mes préférées.;La raclette du soir est sacrée.;Les chaussures font mal aux pieds.;Le forfait coûte cher.
Plateau de télévision|📺|Présentateur,Caméraman,Invité,Maquilleuse,Réalisateur,Public,Chauffeur de salle|Les projecteurs chauffent beaucoup.;On applaudit quand le panneau s'allume.;Le direct ne pardonne rien.;Le maquillage est obligatoire.;Les caméras bougent sans arrêt.;Il y a une coupure pub.
Pizzeria|🍕|Pizzaïolo,Livreur,Client,Serveur,Caissier,Patron,Plongeur|Le four à bois chauffe fort.;La pâte tourne dans les airs.;On livre beaucoup le soir.;La mozzarella file.;Les commandes arrivent par téléphone.;On partage souvent en parts.
Salle de sport|🏋️|Coach,Sportif,Réceptionniste,Culturiste,Débutant,Agent d'entretien,Nutritionniste|Les haltères pèsent lourd.;On transpire à grosses gouttes.;Le tapis de course est pris.;Les miroirs sont partout.;Le coach crie des encouragements.;Je reviens après les fêtes.
Bibliothèque|📚|Bibliothécaire,Lecteur,Étudiant,Écrivain,Enfant,Archiviste,Agent d'accueil|Le silence est de rigueur.;On emprunte pour trois semaines.;Les rayons sont classés par thèmes.;On rend avec un peu de retard.;Il y a des fauteuils pour lire.;Les étudiants révisent ici.
Parc d'attractions|🎢|Opérateur de manège,Visiteur,Mascotte,Vendeur de barbe à papa,Enfant,Agent de sécurité,Photographe|Les files d'attente sont interminables.;Les montagnes russes me donnent des frissons.;Il faut une taille minimum.;Les mascottes posent pour des photos.;On crie beaucoup dans les descentes.;Le billet coûte cher mais c'est pour la journée.
Camping|⛺|Campeur,Gérant,Animateur,Enfant,Maître-nageur,Vacancier,Agent d'entretien|Les sanitaires sont un peu loin.;Planter les piquets n'est pas facile.;On dort au son des grillons.;La soirée karaoké est incontournable.;Les moustiques adorent ce coin.;On cuisine sur un petit réchaud.
Mariage|💍|Marié,Mariée,Témoin,Photographe,Traiteur,Invité,Musicien|Tout le monde est très élégant.;On jette du riz ou des pétales.;Le discours fait pleurer.;La pièce montée est énorme.;On danse jusqu'au bout de la nuit.;Les alliances brillent.
Château fort|🏰|Seigneur,Chevalier,Garde,Cuisinier,Bouffon,Paysan,Archer|Les remparts sont très épais.;Le pont-levis grince.;On défend la tour contre les assauts.;Les banquets durent des heures.;Les armures pèsent lourd.;La herse se baisse la nuit.
Bateau pirate|🏴‍☠️|Capitaine,Second,Moussaillon,Cuisinier,Vigie,Canonnier,Prisonnier|Le drapeau noir flotte au vent.;On cherche un trésor caché.;Le perroquet répète tout.;Les abordages sont fréquents.;La carte est pleine de croix.;On boit de l'eau croupie.
Laboratoire|🔬|Chercheur,Technicien,Stagiaire,Directeur,Agent d'entretien,Inspecteur,Cobaye|Les blouses et les lunettes sont obligatoires.;Les éprouvettes sont partout.;Les expériences ratent souvent.;Le microscope révèle tout.;On note tous les résultats.;Certains produits sont dangereux.
Prison|⛓️|Gardien,Détenu,Directeur,Avocat,Visiteur,Aumônier,Cuisinier|Les portes claquent bruyamment.;On compte les jours.;La promenade est trop courte.;Les parloirs sont surveillés.;Les barreaux sont solides.;Certains rêvent d'évasion.
Salon de coiffure|💇|Coiffeur,Client,Apprenti,Coloriste,Barbier,Manucure,Patron|Les ciseaux claquent sans arrêt.;On feuillette des magazines en attendant.;Le séchoir fait beaucoup de bruit.;On parle de tout et de rien.;Le miroir est grand.;Les mèches tombent par terre.
Boulangerie|🥖|Boulanger,Vendeuse,Client,Apprenti,Pâtissier,Livreur,Enfant|Ça sent bon dès le matin.;La baguette est encore chaude.;Le pétrin tourne la nuit.;Les croissants partent vite.;On fait la queue le dimanche.;La farine est partout.
Concert de rock|🎸|Chanteur,Guitariste,Batteur,Fan,Ingénieur du son,Agent de sécurité,Technicien lumière|La musique est très forte.;Les bouchons d'oreilles sont utiles.;La foule saute en rythme.;Les lumières flashent partout.;On réclame un rappel.;Le merchandising coûte cher.
Piscine municipale|🏊|Maître-nageur,Nageur,Enfant,Professeur de natation,Caissier,Plongeur,Agent d'entretien|Le bonnet est obligatoire.;Ça sent le chlore.;Le plongeoir fait peur.;Les lignes d'eau sont prises.;Il faut passer par le pédiluve.;Les vestiaires sont humides.
Désert|🏜️|Explorateur,Guide,Chamelier,Touriste,Photographe,Géologue,Nomade|Il fait brûlant le jour et froid la nuit.;Le sable s'infiltre partout.;On rêve d'une oasis.;Les dunes changent de forme.;L'eau est précieuse.;Les étoiles sont incroyables la nuit.
`;

export const PLACES = RAW.trim().split("\n").map((line) => {
  const [name, emoji, roles, answers] = line.split("|");
  return { name, emoji, roles: roles.split(","), answers: answers.split(";") };
});

// questions génériques (valables pour tous les lieux)
export const QUESTIONS = [
  "Qu'est-ce que tu portes ici ?", "Tu viens souvent ici ?", "Qu'est-ce qu'on entend autour de toi ?",
  "C'est cher, ici ?", "Tu y viens seul ou accompagné ?", "Qu'est-ce qui te plaît le plus ici ?",
  "À quelle heure est-ce le plus animé ?", "Il fait quel temps, là où on est ?", "Qu'est-ce qui sent le plus fort ?",
  "Tu pourrais y emmener des enfants ?", "Combien de temps on y reste en général ?", "Qu'est-ce qu'il ne faut surtout pas faire ici ?",
  "Il y a beaucoup de monde ?", "Tu as un objet indispensable ici ?", "Comment tu es arrivé ici ?",
  "Qu'est-ce qui te stresse ici ?", "On y mange bien ?", "Tu recommanderais l'endroit ?",
  "Qui est le plus important ici ?", "Qu'est-ce qu'on y fait le plus ?",
];
// réponses vagues (l'espion et les robots prudents)
export const VAGUE = [
  "Ça dépend vraiment des jours.", "Je dirais que c'est assez variable.", "Franchement, je n'y fais pas attention.",
  "Comme partout, j'imagine.", "Plutôt souvent, oui.", "Je préfère garder ça pour moi.",
  "Bonne question… je dirais oui.", "Pas tant que ça, en fait.", "Ça change selon les gens.",
  "Je ne suis pas le mieux placé pour répondre.", "Disons que ça me convient.", "C'est une question piège, ça !",
];
