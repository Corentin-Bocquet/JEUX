// Célébrités : palette d'émojis (manche 3) et 300 personnalités très connues, réelles ou fictives.
// Ligne : nom | autres réponses acceptées (;) | description (manche 1) | un mot (manche 2) | émojis (manche 3)
export const PALETTE = ("👑 🤴 👸 🧙 🧛 🧜 🧚 🦸 🦹 🤖 👽 👻 🤡 🥷 👮 💂 🤠 👶 👴 👵 🧔 🎅 " +
  "⚽ 🏀 🎾 🏈 ⚾ 🏐 🥊 🏊 🚴 🏃 🎿 🏆 🥇 🏁 🏄 🤸 🥋 🎯 🏇 🏓 🏒 ⛳ " +
  "🎸 🎹 🎤 🎻 🥁 🎺 🎵 🎬 🎥 📺 📷 🎭 🎪 🎨 📚 📖 📜 🎓 " +
  "🔬 🔭 💡 ⚡ 🧪 🧬 🦠 🩺 💉 🧲 🧭 🚀 🛸 🪐 🌌 🌍 🌙 ⭐ 🌟 ✨ 🌞 🌊 🔥 🌈 🌋 🌵 🍀 🌹 🌳 " +
  "🚗 🚂 🚢 ⛵ ⚓ 🚲 🏰 🗼 🗽 🏠 ⛪ 🎡 " +
  "🍎 🍕 🍔 🧀 🍫 🍪 🍯 🥕 🍌 🥖 🥐 🍝 🍿 🍩 🍭 🍓 🥚 🍵 " +
  "🐭 🐱 🐶 🐻 🐼 🦁 🐯 🐵 🦊 🐰 🐸 🐢 🐍 🐉 🦖 🐘 🦒 🐴 🦄 🐷 🐮 🐔 🐧 🦆 🐝 🦇 🐟 🐳 🦈 🐙 🐞 🦋 🐺 " +
  "💖 💔 💰 💎 💍 🎩 👓 👒 👗 👠 🧢 🧣 🧤 ⌚ 📱 💻 🔑 🏹 🎃 🎄 🧸 🎈 🎁 🎂 💤 💬 ❓ " +
  "😂 😱 😎 🤓 😈 🙈 💪 👀 🧠 🦷 💀 👟 🧹 🔨 ⏰ ⌛ 🔔 🗿 🎮 👾 🧩 🃏 🎲 🧊 💧 💨 " +
  "🇫🇷 🇺🇸 🇬🇧 🇮🇹 🇪🇸 🇩🇪 🇧🇷 🇯🇵 🇦🇷 🇵🇹 🇯🇲 🇨🇭 🇧🇪 🇪🇬 🇬🇷 🇨🇦").split(" ");

const RAW = `
Victor Hugo||Écrivain français, auteur des Misérables et de Notre-Dame de Paris|Misérables|📚 🇫🇷 📜
Molière||Dramaturge français du XVIIe siècle, auteur du Malade imaginaire et de l'Avare|Théâtre|🎭 🇫🇷 😂
Jules Verne||Écrivain nantais qui a imaginé le Nautilus et le tour du monde en 80 jours|Voyages|🚀 🌍 📚
Jean de La Fontaine|La Fontaine|Poète célèbre pour ses fables, comme Le Corbeau et le Renard|Fables|🦊 📜 🐢
Charles Perrault|Perrault|Écrivain qui a mis par écrit Cendrillon, le Petit Poucet et la Belle au bois dormant|Contes|📖 👠 🏰
Antoine de Saint-Exupéry|Saint-Exupéry;Saint-Ex|Aviateur et écrivain, auteur du Petit Prince|Aviateur|🌟 🦊 📖
William Shakespeare|Shakespeare|Dramaturge anglais, auteur de Roméo et Juliette et d'Hamlet|Hamlet|🎭 🇬🇧 💔
Alexandre Dumas|Dumas|Écrivain, auteur des Trois Mousquetaires et du Comte de Monte-Cristo|Mousquetaires|📚 🏰 💰
Émile Zola|Zola|Écrivain naturaliste, auteur de Germinal et de « J'accuse… ! »|Germinal|📜 🇫🇷 🔥
Agatha Christie||Romancière anglaise, reine du roman policier, créatrice d'Hercule Poirot|Policier|📚 🇬🇧 🔍
J. K. Rowling|Rowling;JK Rowling|Romancière britannique qui a créé le jeune sorcier à lunettes de Poudlard|Poudlard|🧙 📚 🇬🇧
Albert Einstein|Einstein|Physicien à la coiffure ébouriffée, père de la relativité, E = mc²|Relativité|🧠 💡 🔬
Marie Curie|Curie|Scientifique, deux prix Nobel, pionnière de l'étude de la radioactivité|Radioactivité|🧪 🏆 🔬
Isaac Newton|Newton|Savant anglais à qui une pomme aurait inspiré la loi de la gravitation|Gravité|🍎 🌍 🇬🇧
Louis Pasteur|Pasteur|Scientifique français qui a mis au point le vaccin contre la rage|Vaccin|💉 🦠 🇫🇷
Galilée||Savant italien qui pointait sa lunette vers le ciel et affirmait que la Terre tourne autour du Soleil|Lunette|🔭 🌞 🇮🇹
Léonard de Vinci|Vinci;Leonard|Génie de la Renaissance, peintre de la Joconde et inventeur de machines|Joconde|🎨 🇮🇹 💡
Charles Darwin|Darwin|Naturaliste anglais, père de la théorie de l'évolution des espèces|Évolution|🐢 🐵 🧬
Thomas Edison|Edison|Inventeur américain associé à l'ampoule électrique et au phonographe|Ampoule|💡 ⚡ 🇺🇸
Nikola Tesla|Tesla|Inventeur génial de l'électricité en courant alternatif|Électricité|⚡ 🔬 💡
Christophe Colomb|Colomb|Navigateur qui a traversé l'Atlantique en 1492 avec trois caravelles|Amérique|⛵ 🌍 🧭
Neil Armstrong|Armstrong|Astronaute américain, premier homme à marcher sur la Lune en 1969|Lune|🌙 🚀 🇺🇸
Youri Gagarine|Gagarine|Cosmonaute soviétique, premier humain à voyager dans l'espace en 1961|Cosmonaute|🚀 🌌 🥇
Thomas Pesquet|Pesquet|Astronaute français qui a séjourné dans la Station spatiale internationale|Station|🚀 🇫🇷 🌍
Jacques-Yves Cousteau|Cousteau;Commandant Cousteau|Commandant au bonnet rouge, explorateur des océans à bord de la Calypso|Calypso|🌊 🐙 ⚓
Gustave Eiffel|Eiffel|Ingénieur dont la tour de fer est devenue le symbole de Paris|Tour|🗼 🇫🇷 🔨
Napoléon Bonaparte|Napoléon;Bonaparte|Empereur des Français au bicorne, vaincu à Waterloo|Empereur|👑 🇫🇷 🎩
Jeanne d'Arc|Jeanne|Jeune héroïne de la guerre de Cent Ans, la Pucelle d'Orléans|Orléans|🇫🇷 🔥 👂
Louis XIV|Louis 14;Roi Soleil|Le Roi-Soleil, qui a fait construire le château de Versailles|Versailles|👑 🌞 🏰
Cléopâtre||Dernière reine d'Égypte antique, célèbre pour sa beauté|Égypte|👸 🇪🇬 🐍
Jules César|César|Général et homme d'État romain qui a conquis la Gaule|Rome|👑 🇮🇹 🏛
Toutânkhamon|Toutankhamon|Jeune pharaon dont le tombeau intact a été découvert en 1922|Pharaon|👑 🇪🇬 💀
Charlemagne||Empereur à la barbe fleurie, couronné en l'an 800|Empereur|👑 🧔 🏰
Vercingétorix||Chef gaulois qui s'est rendu à César après la défaite d'Alésia|Gaulois|🧔 🇫🇷 🏹
Marie-Antoinette||Reine de France, épouse de Louis XVI, célèbre pour son goût du luxe|Reine|👸 🇫🇷 🍰
Nelson Mandela|Mandela|Président sud-africain, prix Nobel de la paix, symbole de la lutte contre l'apartheid|Apartheid|✊ 🏆 🌍
Martin Luther King|Luther King|Pasteur américain du discours « I have a dream »|Rêve|💤 🇺🇸 🎤
Gandhi|Mahatma Gandhi|Figure de l'indépendance de l'Inde, apôtre de la non-violence|Non-violence|🕊 👓 🌍
Mère Teresa|Mere Teresa|Religieuse célèbre pour son aide aux plus pauvres à Calcutta|Calcutta|⛪ 💖 👵
Wolfgang Amadeus Mozart|Mozart|Compositeur autrichien, enfant prodige, auteur de La Flûte enchantée|Flûte|🎹 🎵 👶
Ludwig van Beethoven|Beethoven|Compositeur allemand devenu sourd, auteur de l'Hymne à la joie|Symphonie|🎹 🇩🇪 🎵
Frédéric Chopin|Chopin|Pianiste romantique d'origine polonaise, maître des nocturnes|Nocturne|🎹 🌙 🎵
Jean-Sébastien Bach|Bach|Compositeur allemand baroque, maître de l'orgue et de la fugue|Orgue|🎹 ⛪ 🇩🇪
Vincent van Gogh|Van Gogh|Peintre néerlandais des Tournesols, qui s'est coupé l'oreille|Tournesols|🎨 🌻 👂
Claude Monet|Monet|Peintre impressionniste des Nymphéas, amoureux de son jardin de Giverny|Nymphéas|🎨 🌊 🇫🇷
Auguste Rodin|Rodin|Sculpteur français du Penseur|Penseur|🗿 🧠 🇫🇷
Coco Chanel|Chanel|Créatrice de mode française, inventrice de la petite robe noire|Parfum|👗 🇫🇷 💎
Édith Piaf|Piaf|Chanteuse française de La Vie en rose et de Non, je ne regrette rien|Môme|🎤 🌹 🇫🇷
Charles Aznavour|Aznavour|Chanteur français de La Bohème et d'Emmenez-moi|Bohème|🎤 🇫🇷 💖
Jacques Brel|Brel|Chanteur belge de Ne me quitte pas et d'Amsterdam|Quitte|🎤 🇧🇪 💔
Georges Brassens|Brassens|Chanteur à la pipe et à la guitare, auteur des Copains d'abord|Copains|🎸 🇫🇷 🐱
Johnny Hallyday|Johnny;Hallyday|Idole des jeunes, rockeur français de Que je t'aime|Rockeur|🎸 🇫🇷 🔥
Elvis Presley|Elvis;Presley|Le King du rock'n'roll, aux déhanchés célèbres|King|🎸 👑 🇺🇸
The Beatles|Beatles|Groupe de Liverpool aux quatre garçons dans le vent, Yellow Submarine|Liverpool|🎸 🇬🇧 🥁
Freddie Mercury|Mercury|Chanteur de Queen, voix de We Are the Champions et Bohemian Rhapsody|Queen|🎤 👑 🏆
Bob Marley|Marley|Légende du reggae venue de Jamaïque|Reggae|🎸 🇯🇲 🌈
Louis Armstrong|Satchmo|Trompettiste de jazz américain de What a Wonderful World|Jazz|🎺 🇺🇸 🌍
Madonna||Reine de la pop américaine, Like a Virgin et Material Girl|Pop|🎤 👑 🇺🇸
Céline Dion|Céline;Celine|Chanteuse québécoise de My Heart Will Go On, chanson du film Titanic|Titanic|🎤 🇨🇦 🚢
Stromae||Chanteur belge de Alors on danse et Papaoutai|Papaoutai|🎤 🇧🇪 🕺
Mylène Farmer|Farmer|Chanteuse française aux cheveux roux, Désenchantée|Désenchantée|🎤 🦊 🇫🇷
Beyoncé||Star américaine, ancienne des Destiny's Child, Single Ladies|Queen|🎤 👑 💍
Taylor Swift|Swift|Chanteuse américaine aux records de tournée, Shake It Off|Country|🎤 🎸 🇺🇸
Michael Phelps|Phelps|Nageur américain aux 23 médailles d'or olympiques|Natation|🏊 🥇 🇺🇸
Usain Bolt|Bolt|Sprinteur jamaïcain, l'homme le plus rapide du monde, pose de l'éclair|Sprint|⚡ 🏃 🇯🇲
Zinédine Zidane|Zidane;Zizou|Footballeur français, double buteur en finale de la Coupe du monde 1998|Zizou|⚽ 🏆 🇫🇷
Kylian Mbappé|Mbappé;Mbappe|Attaquant français très rapide, champion du monde à 19 ans en 2018|Vitesse|⚽ 🇫🇷 ⚡
Lionel Messi|Messi|Génie argentin du football, champion du monde 2022, plusieurs Ballons d'or|Argentine|⚽ 🇦🇷 🐐
Cristiano Ronaldo|Ronaldo;CR7|Attaquant portugais, star de Manchester, du Real Madrid et de la Juventus|Portugal|⚽ 🇵🇹 💪
Pelé||Légende brésilienne, triple champion du monde de football|Brésil|⚽ 🇧🇷 👑
Diego Maradona|Maradona|Star argentine, auteur de la « main de Dieu » en 1986|Main|⚽ 🇦🇷 ✋
Roger Federer|Federer|Joueur de tennis suisse, élégance et 20 titres du Grand Chelem|Wimbledon|🎾 🇨🇭 🏆
Rafael Nadal|Nadal|Joueur de tennis espagnol, roi de la terre battue de Roland-Garros|Roland-Garros|🎾 🇪🇸 💪
Serena Williams|Serena|Championne de tennis américaine aux 23 titres du Grand Chelem|Tennis|🎾 🇺🇸 🏆
Teddy Riner|Riner|Judoka français géant, multiple champion du monde et olympique|Judo|🥋 🇫🇷 🥇
Tony Parker|Parker|Meneur français de basket, quatre fois champion NBA avec San Antonio|Basket|🏀 🇫🇷 🏆
Michael Jordan|Jordan|Légende du basket aux Chicago Bulls, numéro 23|Bulls|🏀 🐮 🇺🇸
Muhammad Ali|Ali|Boxeur américain qui « vole comme le papillon et pique comme l'abeille »|Boxe|🥊 🦋 🐝
Antoine Dupont|Dupont|Demi de mêlée français élu meilleur joueur de rugby du monde|Rugby|🏈 🇫🇷 🏆
Léon Marchand|Marchand|Nageur français aux quatre médailles d'or aux Jeux de Paris 2024|Paris|🏊 🥇 🇫🇷
Eddy Merckx|Merckx|Cycliste belge surnommé le Cannibale, cinq Tours de France|Cannibale|🚴 🇧🇪 🏆
Ayrton Senna|Senna|Pilote brésilien de Formule 1, trois fois champion du monde|Formule 1|🏁 🚗 🇧🇷
Lewis Hamilton|Hamilton|Pilote britannique, sept fois champion du monde de Formule 1|Formule 1|🏁 🇬🇧 🏆
Charlie Chaplin|Chaplin;Charlot|Acteur du cinéma muet au chapeau melon, à la canne et à la moustache|Charlot|🎩 🎬 😂
Louis de Funès|De Funès;De Funes|Acteur comique français du Gendarme de Saint-Tropez et de La Grande Vadrouille|Gendarme|😂 👮 🇫🇷
Marilyn Monroe|Marilyn;Monroe|Actrice blonde américaine à la robe blanche soulevée par le vent|Blonde|💋 🎬 💎
Audrey Hepburn|Hepburn|Actrice de Diamants sur canapé, robe noire et chignon|Diamants|💎 🎬 👗
Jean Dujardin|Dujardin|Acteur français oscarisé pour The Artist, aussi OSS 117|Artist|🎬 🏆 🇫🇷
Omar Sy|Omar|Acteur français d'Intouchables et de la série Lupin|Intouchables|🎬 😂 🇫🇷
Leonardo DiCaprio|DiCaprio;Leo|Acteur américain de Titanic et du Loup de Wall Street|Titanic|🚢 🎬 🧊
Tom Cruise|Cruise|Acteur américain de Top Gun et de Mission impossible|Mission|🎬 🛩 😎
Brad Pitt|Pitt|Acteur américain de Fight Club et d'Ocean's Eleven|Hollywood|🎬 😎 🇺🇸
Steven Spielberg|Spielberg|Réalisateur américain des Dents de la mer, d'E.T. et de Jurassic Park|Réalisateur|🎥 🦈 🦖
Walt Disney|Disney|Créateur de Mickey et de célèbres parcs d'attractions|Mickey|🐭 🏰 🎬
Hayao Miyazaki|Miyazaki|Maître japonais de l'animation, auteur du Voyage de Chihiro et de Totoro|Totoro|🇯🇵 🎬 🐉
Charles de Gaulle|De Gaulle|Général, chef de la France libre et premier président de la Ve République|Général|🇫🇷 🎖 📻
Simone Veil|Veil|Femme politique française, rescapée des camps, première présidente du Parlement européen|Europe|🇫🇷 💪 📜
Joséphine Baker|Baker|Artiste de music-hall, résistante, entrée au Panthéon en 2021|Music-hall|🎤 💃 🇫🇷
Mickey Mouse|Mickey|Souris à grandes oreilles rondes et culotte rouge, star de Disney|Souris|🐭 🏰 🎈
Donald Duck|Donald|Canard en costume de marin qui s'énerve en parlant de façon incompréhensible|Canard|🦆 ⚓ 😈
Bugs Bunny|Bugs|Lapin farceur qui croque une carotte : « Quoi de neuf, docteur ? »|Carotte|🐰 🥕 😂
Garfield||Gros chat orange paresseux qui adore les lasagnes et déteste le lundi|Lasagnes|🐱 🍝 💤
Snoopy||Beagle blanc qui dort sur le toit de sa niche rouge|Niche|🐶 💤 🏠
Scooby-Doo|Scooby|Dogue allemand peureux qui résout des mystères avec ses amis|Mystère|🐶 👻 🍪
Pikachu||Pokémon jaune électrique aux joues rouges|Pokémon|⚡ 🐭 🎮
Mario|Super Mario|Plombier moustachu à casquette rouge qui saute sur des champignons|Plombier|🍄 🎮 🧢
Sonic||Hérisson bleu de jeu vidéo qui court à toute vitesse|Hérisson|💨 🎮 💍
Pac-Man|Pacman|Rond jaune de jeu vidéo qui mange des pastilles et fuit des fantômes|Pastilles|👻 🎮 🟡
Lara Croft|Croft|Aventurière de jeu vidéo qui pille des tombeaux|Tombeaux|🎮 🏹 💀
Astérix|Asterix|Petit Gaulois rusé qui boit de la potion magique|Gaulois|🧔 🇫🇷 💪
Obélix|Obelix|Gaulois livreur de menhirs, tombé dans la marmite quand il était petit|Menhir|🗿 🐷 💪
Tintin||Reporter belge à la houppe, toujours accompagné de son chien Milou|Reporter|🐶 🚀 🇧🇪
Capitaine Haddock|Haddock|Marin barbu ami de Tintin, qui crie « Mille sabords ! »|Sabords|⚓ 🧔 😱
Lucky Luke||Cow-boy qui tire plus vite que son ombre|Cow-boy|🤠 🐴 🌵
Gaston Lagaffe|Gaston|Employé de bureau maladroit et inventif du journal Spirou|Gaffe|💤 😂 💡
Les Schtroumpfs|Schtroumpfs;Schtroumpf|Petits êtres bleus qui vivent dans des champignons|Bleu|🍄 🔵 🏠
Titeuf||Garçon à la mèche blonde dressée qui dit « Tchô ! »|Mèche|👶 😂 🏫
Spirou||Groom à la tenue rouge, héros de bande dessinée belge avec Fantasio|Groom|🎩 🐿 🇧🇪
Le Petit Prince|Petit Prince|Garçon venu d'un astéroïde, qui demande qu'on lui dessine un mouton|Astéroïde|🌟 🦊 🌹
Harry Potter|Harry;Potter|Jeune sorcier à lunettes et à la cicatrice en forme d'éclair|Sorcier|🧙 ⚡ 👓
Hermione Granger|Hermione|Sorcière studieuse et brillante, meilleure amie de Ron et Harry|Bibliothèque|🧙 📚 🤓
Dumbledore|Albus Dumbledore|Directeur de Poudlard à la longue barbe blanche|Directeur|🧙 🧔 🏰
Voldemort||Mage noir sans nez, ennemi juré du jeune sorcier à lunettes|Ténèbres|😈 🐍 💀
Gandalf||Magicien à la longue barbe et au bâton : « Vous ne passerez pas ! »|Magicien|🧙 🧔 💍
Frodon Sacquet|Frodon;Frodo|Petit hobbit chargé de détruire l'anneau unique|Anneau|💍 🌋 🦶
Gollum||Créature qui parle de son « précieux » et vit dans une grotte|Précieux|💍 🐟 😈
Dark Vador|Vador;Darth Vader|Seigneur Sith au casque noir qui respire bruyamment : « Je suis ton père »|Sith|😈 🌌 🎬
Luke Skywalker|Skywalker;Luke|Jeune Jedi au sabre laser bleu, fils caché du seigneur Sith|Jedi|🌌 ⚡ 🎬
Yoda|Maître Yoda|Petit maître Jedi vert qui parle à l'envers|Jedi|🐸 🌌 👴
R2-D2|R2D2|Petit robot bleu et blanc qui fait des bips dans une galaxie lointaine|Bip|🤖 🌌 🔵
E.T.|ET;E.T. l'extraterrestre|Extraterrestre au long cou qui veut « téléphone maison »|Maison|👽 🚲 🌙
Superman||Super-héros venu de Krypton, cape rouge et S sur la poitrine|Krypton|🦸 🚀 💪
Batman||Justicier masqué de Gotham City, déguisé en chauve-souris|Gotham|🦇 🦸 🌙
Spider-Man|Spiderman|Super-héros qui grimpe aux murs et lance des toiles|Araignée|🕷 🦸 🗽
Wonder Woman||Super-héroïne amazone au lasso de vérité|Amazone|🦸 👸 ⭐
Hulk||Géant vert et colérique, double d'un savant|Colère|💪 😈 🟢
Iron Man||Milliardaire dans une armure rouge et or, Tony Stark|Armure|🤖 🦸 💰
Captain America||Super-héros au bouclier étoilé bleu, blanc, rouge|Bouclier|🇺🇸 🦸 ⭐
Thor||Dieu nordique du tonnerre armé d'un marteau|Marteau|🔨 ⚡ 🧔
Wolverine||Mutant aux griffes de métal qui sortent de ses poings|Griffes|🐺 💪 🦸
Joker||Ennemi de Batman au sourire peint et au rire inquiétant|Rire|🤡 😈 🃏
James Bond|Bond;007|Agent secret britannique 007, « au shaker, pas à la cuillère »|Espion|🇬🇧 🎩 🔫
Sherlock Holmes|Sherlock;Holmes|Détective anglais à la pipe et à la loupe : « Élémentaire, mon cher Watson »|Détective|🔍 🇬🇧 🎩
Hercule Poirot|Poirot|Détective belge à la fine moustache, héros d'Agatha Christie|Moustache|🇧🇪 🔍 🧔
Arsène Lupin|Lupin|Gentleman cambrioleur au monocle et haut-de-forme|Cambrioleur|🎩 💎 🔑
Zorro||Justicier masqué qui signe d'un Z avec son épée|Masque|🐴 🎩 😎
Robin des Bois|Robin|Archer de la forêt de Sherwood qui vole aux riches pour donner aux pauvres|Sherwood|🏹 🌳 💰
Indiana Jones|Indiana;Indy|Archéologue aventurier au fouet et au chapeau|Fouet|🤠 🐍 💎
Jack Sparrow|Sparrow|Capitaine pirate excentrique de Pirates des Caraïbes|Pirate|⚓ 🏴 💀
Peter Pan||Garçon qui ne veut pas grandir et vole jusqu'au Pays imaginaire|Fée|🧚 ⭐ 👶
Fée Clochette|Clochette|Petite fée qui accompagne le garçon qui ne voulait pas grandir|Poussière|🧚 ✨ 🔔
Capitaine Crochet|Crochet|Pirate qui a perdu une main, mangée par un crocodile|Crocodile|⚓ ⏰ 🐊
Pinocchio||Pantin de bois dont le nez s'allonge quand il ment|Mensonge|🌳 👃 🤥
Blanche-Neige|Blanche Neige|Princesse qui croque une pomme empoisonnée et vit avec sept nains|Nains|🍎 👸 🏰
Cendrillon||Princesse qui perd sa pantoufle de verre au douzième coup de minuit|Pantoufle|👠 🎃 ⏰
La Belle au bois dormant|Aurore;Belle au bois dormant|Princesse endormie pendant cent ans après s'être piquée à un fuseau|Fuseau|💤 👸 🏰
Le Petit Chaperon rouge|Chaperon rouge|Fillette qui apporte une galette à sa mère-grand et rencontre le loup|Galette|🐺 👵 🌳
Raiponce||Princesse enfermée dans une tour, à la chevelure immense|Cheveux|👸 🏰 🌳
Ariel|La Petite Sirène;Petite Sirène|Princesse sirène rousse qui rêve de vivre sur terre|Sirène|🧜 🌊 🐟
Elsa|Reine des neiges|Reine aux pouvoirs glacés qui chante « Libérée, délivrée »|Glace|❄ 👸 🧊
Olaf||Bonhomme de neige qui aime les câlins chauds|Câlins|⛄ 🥕 🌞
Simba||Lionceau qui deviendra roi de la savane, fils de Mufasa|Lionceau|🦁 👑 🌍
Aladdin||Jeune voleur au tapis volant et au génie de la lampe|Lampe|🧞 💎 🐵
Mulan||Jeune femme chinoise qui se déguise en soldat pour sauver son père|Soldat|🏹 🐉 💪
Shrek||Ogre vert qui vit dans un marais avec un âne bavard|Ogre|🟢 🐴 🏰
Woody||Cow-boy jouet à la ficelle, ami de Buzz l'Éclair|Jouet|🤠 🧸 🐴
Buzz l'Éclair|Buzz|Jouet astronaute : « Vers l'infini et au-delà ! »|Infini|🚀 🧸 🌌
Nemo|Némo|Petit poisson-clown à la nageoire atrophiée, cherché par son père|Poisson-clown|🐟 🌊 🐠
Dory||Poisson bleu qui oublie tout et parle baleine|Mémoire|🐟 🔵 🐳
Winnie l'ourson|Winnie|Ourson jaune au t-shirt rouge, gourmand de miel|Miel|🐻 🍯 🐝
Mowgli||Petit d'homme élevé par des loups, ami de Baloo et Bagheera|Jungle|🐺 🐻 🐯
Baloo||Ours insouciant du Livre de la jungle : « Il en faut peu pour être heureux »|Ours|🐻 🎵 🍌
Dumbo||Éléphanteau aux immenses oreilles qui vole|Oreilles|🐘 🎪 🎈
Bambi||Faon de la forêt, ami d'un lapin nommé Panpan|Faon|🦌 🌳 🐰
Le Roi Arthur|Arthur;Roi Arthur|Roi légendaire qui a retiré l'épée Excalibur du rocher|Excalibur|👑 🗡 🏰
Merlin|Merlin l'enchanteur|Enchanteur des légendes de la Table ronde|Enchanteur|🧙 🦉 🏰
Hercule||Demi-dieu grec d'une force prodigieuse, aux douze travaux|Travaux|💪 🦁 🇬🇷
Zeus||Roi des dieux grecs qui lance la foudre depuis l'Olympe|Foudre|⚡ 👑 🇬🇷
Ulysse||Héros grec rusé du cheval de Troie, qui met dix ans à rentrer chez lui|Odyssée|⛵ 🐴 🇬🇷
Méduse||Gorgone aux cheveux de serpents qui change en pierre ceux qui la regardent|Serpents|🐍 🗿 👀
Père Noël|Pere Noel|Vieil homme à la barbe blanche qui distribue des cadeaux en traîneau|Cadeaux|🎅 🎁 🦌
Dracula||Comte vampire de Transylvanie|Vampire|🧛 🦇 🏰
Frankenstein||Savant qui crée un monstre à partir de morceaux de corps|Monstre|⚡ 🧪 💀
King Kong|Kong|Gorille géant qui escalade l'Empire State Building|Gorille|🐵 🗽 💪
Godzilla||Monstre géant japonais qui sort de la mer|Monstre|🦖 🇯🇵 🔥
Bob l'éponge|Bob;Bob l'eponge|Éponge jaune à pantalon carré qui vit dans un ananas sous la mer|Ananas|🍍 🌊 😂
Homer Simpson|Homer|Père de famille jaune, chauve, amateur de donuts : « D'oh ! »|Donuts|🍩 📺 🟡
Bart Simpson|Bart|Garçon jaune farceur en skateboard, fils d'Homer|Skateboard|🛹 📺 😈
Tom et Jerry|Tom;Jerry|Duo de dessin animé : un chat qui court toujours après une souris|Poursuite|🐱 🐭 🧀
Titi et Grosminet|Titi;Grosminet|Petit canari jaune poursuivi par un gros chat noir et blanc|Canari|🐦 🐱 😂
Casper||Gentil petit fantôme blanc de dessin animé|Fantôme|👻 💖 😊
Scrat||Écureuil préhistorique obsédé par son gland dans L'Âge de glace|Gland|🐿 🌰 🧊
Babar||Éléphant roi vêtu d'un costume vert|Éléphant|🐘 👑 🟢
Barbapapa||Personnage rose qui change de forme : « Hulahup ! »|Rose|💖 🎈 🏠
Oui-Oui|Oui Oui|Petit pantin qui conduit un taxi jaune et rouge|Taxi|🚗 🧸 🔔
Peppa Pig|Peppa|Petite cochonne rose qui adore sauter dans les flaques de boue|Flaques|🐷 💧 😂
Petit Ours Brun|Ours Brun|Ourson de livres pour enfants, au pyjama et aux bêtises|Ourson|🐻 👶 📖
T'choupi|Tchoupi|Petit pingouin des livres pour enfants, au bonnet orange|Pingouin|🐧 👶 📖
Rémi sans famille|Rémi|Orphelin qui parcourt la France avec Vitalis et ses animaux|Orphelin|🐶 🐵 🎻
Heidi||Fillette qui vit dans les Alpes avec son grand-père|Alpes|👵 🇨🇭 🐐
Fifi Brindacier|Fifi|Fillette rousse aux nattes, très forte, qui soulève son cheval|Nattes|💪 🐴 🐵
Alice au pays des merveilles|Alice|Fillette qui suit un lapin blanc pressé dans un terrier|Terrier|🐰 ⏰ 🎩
Le Chapelier fou|Chapelier|Personnage excentrique qui prend le thé au pays des merveilles|Thé|🎩 🍵 🤪
Le Chat potté|Chat potté|Chat rusé qui porte des bottes et un chapeau à plume|Bottes|🐱 👢 🎩
Don Quichotte|Quichotte|Chevalier espagnol qui se bat contre des moulins à vent|Moulins|🐴 🇪🇸 💨
Cyrano de Bergerac|Cyrano|Poète et bretteur au très long nez|Nez|👃 📜 🌙
Les Trois Mousquetaires|Mousquetaires|Athos, Porthos et Aramis, « un pour tous, tous pour un »|Un pour tous|🎩 🗡 🇫🇷
D'Artagnan|Artagnan|Jeune Gascon qui rejoint Athos, Porthos et Aramis|Gascon|🎩 🐴 🇫🇷
Quasimodo||Sonneur de cloches bossu de Notre-Dame de Paris|Cloches|🔔 ⛪ 💔
Jean Valjean|Valjean|Ancien forçat au grand cœur dans Les Misérables|Forçat|📚 🇫🇷 🍞
Tarzan||Homme élevé par des singes dans la jungle, qui crie en se balançant aux lianes|Lianes|🐵 🌳 📢
Popeye||Marin qui devient très fort en mangeant des épinards|Épinards|💪 ⚓ 🥬
Barbie||Poupée blonde célèbre depuis 1959, au monde tout rose|Poupée|👸 💖 👗
Ken||Fiancé de la célèbre poupée blonde|Fiancé|💖 😎 🧸
Hello Kitty|Kitty|Petite chatte blanche japonaise au nœud rouge, sans bouche|Nœud|🐱 🎀 🇯🇵
Goku|Son Goku|Héros de Dragon Ball aux cheveux en pétard qui cherche les boules de cristal|Dragon Ball|🐉 💪 🇯🇵
Naruto||Ninja blond au bandeau qui rêve de devenir Hokage|Ninja|🥷 🍜 🇯🇵
Luffy||Pirate au chapeau de paille au corps élastique, héros de One Piece|Chapeau de paille|👒 ⚓ 💪
Doraemon||Chat-robot bleu venu du futur avec une poche magique|Poche|🤖 🐱 🔵
Totoro||Grosse créature grise de la forêt qui attend le bus sous la pluie|Forêt|🌳 🐻 💧
Kirikou||Petit garçon africain courageux qui affronte la sorcière Karaba|Sorcière|👶 🌍 💪
Rantanplan||Chien le plus bête de l'Ouest, compagnon du cow-boy solitaire|Bête|🐶 🤠 😂
Idéfix|Idefix|Petit chien blanc qui pleure quand on coupe un arbre|Arbre|🐶 🌳 😢
Milou||Fox-terrier blanc, compagnon du reporter à la houppe|Chien|🐶 🦴 🇧🇪
Marsupilami||Animal jaune à taches noires et à queue immense : « Houba houba ! »|Houba|🐵 🟡 🌳
Gargamel||Sorcier méchant qui veut capturer les petits êtres bleus|Sorcier|🧙 😈 🐱
Cruella||Méchante au manteau de fourrure qui veut les 101 dalmatiens|Dalmatiens|🐶 😈 🧥
Ursula||Sorcière des mers moitié pieuvre qui vole la voix d'une sirène|Pieuvre|🐙 😈 🌊
Jafar||Vizir maléfique qui veut la lampe merveilleuse|Vizir|🐍 😈 💎
Maléfique||Fée méchante aux cornes noires qui jette un sort à une princesse|Sort|😈 🧚 🐉
Le Grinch|Grinch|Créature verte et grincheuse qui veut voler Noël|Noël|🎄 🟢 😈
Chucky||Poupée tueuse de films d'horreur|Poupée|🧸 😱 🔪
Rocky Balboa|Rocky|Boxeur de Philadelphie qui monte des marches en courant|Boxeur|🥊 🇺🇸 💪
Forrest Gump|Forrest|Homme simple qui court à travers l'Amérique : « Cours, Forrest ! »|Chocolats|🏃 🍫 🇺🇸
Terminator||Robot venu du futur : « I'll be back »|Futur|🤖 😎 🔥
Mary Poppins|Poppins|Nounou magique au parapluie volant et au sac sans fond|Nounou|☂ 🎩 ✨
Willy Wonka|Wonka|Excentrique propriétaire d'une chocolaterie aux tickets d'or|Chocolaterie|🍫 🎩 🎫
Mister Bean|Mr Bean;Bean|Personnage comique anglais presque muet, avec son ours en peluche|Peluche|😂 🧸 🇬🇧
Princesse Leia|Leia|Princesse rebelle aux macarons de cheveux dans une galaxie lointaine|Rebelle|👸 🌌 🔫
Han Solo|Solo|Pilote contrebandier du Faucon Millenium, ami d'un Wookiee|Faucon|🚀 😎 🌌
Chewbacca|Chewie|Wookiee poilu, copilote du Faucon Millenium|Wookiee|🐻 🌌 🚀
Optimus Prime|Optimus|Chef robot des Autobots qui se transforme en camion|Camion|🤖 🚚 💪
Les Minions|Minions;Minion|Petites créatures jaunes à lunettes qui adorent les bananes|Bananes|🍌 🟡 👓
Gru||Méchant chauve au long manteau qui adopte trois fillettes|Méchant|😈 👶 🍌
Shaun le mouton|Shaun|Mouton malin de la ferme, en pâte à modeler|Mouton|🐑 🏠 😂
Wallace et Gromit|Wallace;Gromit|Inventeur amateur de fromage et son chien silencieux|Fromage|🧀 🐶 🔧
Rémy le rat|Rémy;Ratatouille|Rat cuisinier qui rêve d'être chef à Paris|Ratatouille|🐭 🍝 🗼
Flash McQueen|McQueen;Flash|Voiture de course rouge numéro 95 dans Cars|Cars|🚗 🏁 ⚡
Wall-E|Wall E;WallE|Petit robot qui nettoie une Terre couverte de déchets|Déchets|🤖 🌍 💖
Stitch||Petit extraterrestre bleu adopté par une fillette hawaïenne|Hawaï|👽 🔵 🌊
Kung Fu Panda|Po|Panda maladroit qui devient le Guerrier Dragon|Guerrier|🐼 🥋 🥟
Sid le paresseux|Sid|Paresseux maladroit de L'Âge de glace|Paresseux|🦥 🧊 😂
Le Lapin blanc|Lapin blanc|Lapin pressé qui regarde sa montre : « Je suis en retard ! »|Retard|🐰 ⏰ 🎩
Raymond Poulidor|Poulidor;Poupou|Cycliste français, l'éternel second du Tour de France|Second|🚴 🥈 🇫🇷
Bernard Hinault|Hinault|Cycliste breton, cinq fois vainqueur du Tour de France|Blaireau|🚴 🏆 🇫🇷
Michel Platini|Platini|Meneur de jeu français, triple Ballon d'or dans les années 1980|Ballon d'or|⚽ 🥇 🇫🇷
Thierry Henry|Henry;Titi Henry|Attaquant français, meilleur buteur de l'histoire d'Arsenal|Arsenal|⚽ 🇫🇷 🇬🇧
Yannick Noah|Noah|Dernier Français vainqueur de Roland-Garros en 1983, devenu chanteur|Roland-Garros|🎾 🎤 🇫🇷
Marie-José Pérec|Pérec;Perec|Sprinteuse française, triple championne olympique|Gazelle|🏃 🥇 🇫🇷
Sébastien Loeb|Loeb|Pilote alsacien, neuf fois champion du monde des rallyes|Rallye|🚗 🏆 🇫🇷
Laure Manaudou|Manaudou|Nageuse française championne olympique du 400 m nage libre en 2004|Nage|🏊 🥇 🇫🇷
Martin Fourcade|Fourcade|Biathlète français aux multiples titres olympiques|Biathlon|🎿 🎯 🇫🇷
Tiger Woods|Tiger|Golfeur américain aux nombreux tournois majeurs|Golf|⛳ 🐯 🇺🇸
Simone Biles|Biles|Gymnaste américaine aux nombreux titres mondiaux et olympiques|Gymnastique|🤸 🥇 🇺🇸
Nadia Comaneci|Comaneci|Gymnaste roumaine, première note parfaite de 10 aux Jeux de 1976|Dix|🤸 🥇 🔟
Wayne Gretzky|Gretzky|Hockeyeur canadien surnommé la Merveille|Hockey|🏒 🇨🇦 👑
Kelly Slater|Slater|Surfeur américain onze fois champion du monde|Surf|🏄 🌊 🏆
Tony Hawk|Hawk|Skateur américain légendaire, premier « 900 » en compétition|Skate|🛹 🇺🇸 🤸
Picasso|Pablo Picasso|Peintre espagnol de Guernica, fondateur du cubisme|Cubisme|🎨 🇪🇸 🟦
Salvador Dalí|Dali;Dalí|Peintre surréaliste espagnol à la moustache relevée, aux montres molles|Montres molles|🎨 🧔 ⌚
Frida Kahlo|Frida;Kahlo|Peintre mexicaine aux autoportraits et aux sourcils qui se rejoignent|Autoportrait|🎨 🌹 💖
Michel-Ange|Michel Ange|Artiste italien du plafond de la chapelle Sixtine et du David|Sixtine|🎨 ⛪ 🗿
Andy Warhol|Warhol|Artiste du pop art, célèbre pour ses boîtes de soupe et ses portraits colorés|Pop art|🎨 🥫 🌈
Banksy||Artiste de rue anonyme aux pochoirs, dont un tableau s'est autodétruit|Pochoir|🎨 🙈 🇬🇧
Auguste Lumière|Frères Lumière;Lumière|Frères lyonnais inventeurs du cinématographe en 1895|Cinématographe|🎥 💡 🇫🇷
Georges Méliès|Méliès;Melies|Pionnier du cinéma, auteur du Voyage dans la Lune|Voyage dans la Lune|🎥 🌙 🚀
Steve Jobs|Jobs|Cofondateur d'Apple, présentateur de l'iPhone en col roulé noir|iPhone|🍎 📱 💻
Bill Gates|Gates|Cofondateur de Microsoft et de Windows|Windows|💻 💰 🇺🇸
Mark Zuckerberg|Zuckerberg|Créateur de Facebook dans sa chambre d'étudiant|Facebook|💻 📱 👍
Alan Turing|Turing|Mathématicien britannique qui a cassé le code Enigma, père de l'informatique|Enigma|💻 🧠 🇬🇧
Ada Lovelace|Lovelace|Mathématicienne anglaise du XIXe siècle, première programmeuse de l'histoire|Programme|💻 🧠 👸
Stephen Hawking|Hawking|Physicien britannique des trous noirs, en fauteuil roulant|Trous noirs|🌌 🧠 🇬🇧
Sigmund Freud|Freud|Médecin viennois, père de la psychanalyse et du divan|Psychanalyse|🧠 💤 🛋
Archimède|Archimede|Savant grec qui a crié « Eurêka ! » dans son bain|Eurêka|🛁 💡 🇬🇷
Pythagore||Mathématicien grec du célèbre théorème sur le triangle rectangle|Théorème|📐 🧠 🇬🇷
Copernic||Astronome polonais qui a placé le Soleil au centre de l'univers connu|Héliocentrisme|🌞 🌍 🔭
Marco Polo|Polo|Marchand vénitien qui a raconté son voyage jusqu'en Chine|Chine|🧭 🐫 🇮🇹
Magellan|Fernand de Magellan|Navigateur dont l'expédition a fait le premier tour du monde|Tour du monde|⛵ 🌍 🧭
Roald Amundsen|Amundsen|Explorateur norvégien, premier à atteindre le pôle Sud|Pôle Sud|🐧 🧊 🧭
Mike Horn|Horn|Aventurier suisse de l'extrême, explorateur des pôles|Aventurier|🧊 🧭 🇨🇭
Paul-Émile Victor|Paul-Emile Victor|Explorateur français des régions polaires|Polaire|🧊 🐧 🇫🇷
Amelia Earhart|Earhart|Aviatrice américaine, première femme à traverser l'Atlantique seule en avion|Aviatrice|✈ 🇺🇸 💪
Louis Blériot|Blériot;Bleriot|Aviateur français, premier à traverser la Manche en avion en 1909|Manche|🇫🇷 🇬🇧 💨
Les frères Wright|Wright|Frères américains pionniers du premier vol motorisé en 1903|Avion|🇺🇸 💨 🔧
Gutenberg||Inventeur allemand de l'imprimerie à caractères mobiles|Imprimerie|📖 🔨 🇩🇪
Louis Braille|Braille|Français devenu aveugle enfant, inventeur de l'écriture en points en relief|Points|👀 📖 🇫🇷
Alexander Graham Bell|Graham Bell|Inventeur associé au téléphone|Téléphone|📱 🔔 🇺🇸
Alfred Nobel|Nobel|Inventeur de la dynamite qui a créé des prix célèbres|Prix|🏆 💥 💰
Gustave Flaubert|Flaubert|Écrivain français de Madame Bovary|Bovary|📚 🇫🇷 💔
Marcel Proust|Proust|Écrivain de À la recherche du temps perdu et de la madeleine|Madeleine|🍪 ⏰ 📚
Jean-Jacques Goldman|Goldman|Chanteur français discret de Quand la musique est bonne|Enfoirés|🎤 🎸 🇫🇷
Francis Cabrel|Cabrel|Chanteur moustachu de Je l'aime à mourir|Moustache|🎸 🧔 🇫🇷
Renaud||Chanteur au bandana rouge de Mistral gagnant|Bandana|🎤 🍬 🇫🇷
Angèle||Chanteuse belge de Balance ton quoi et Tout oublier|Balance|🎤 🇧🇪 💖
Vianney||Chanteur français à la guitare de Je te déteste et Pas là|Guitare|🎸 🇫🇷 💖
Indila||Chanteuse française de Dernière danse|Danse|🎤 💃 🇫🇷
Zaz||Chanteuse française de Je veux, à la voix éraillée|Je veux|🎤 🇫🇷 🌈
Gims|Maître Gims|Chanteur aux lunettes noires de Bella et Sapés comme jamais|Lunettes|🎤 😎 🇫🇷
Ed Sheeran|Sheeran|Chanteur roux britannique de Shape of You|Roux|🎸 🇬🇧 🦊
Adele||Chanteuse britannique de Rolling in the Deep et Someone Like You|Hello|🎤 🇬🇧 💔
Rihanna||Chanteuse barbadienne de Umbrella et Diamonds|Umbrella|☂ 💎 🎤
Lady Gaga|Gaga|Chanteuse américaine extravagante de Poker Face, robe en viande|Poker|🎤 🃏 🤪
Bruno Mars|Bruno|Chanteur américain de Uptown Funk|Funk|🎤 🕺 🇺🇸
Shakira||Chanteuse colombienne de Waka Waka et Hips Don't Lie|Hanches|💃 🎤 ⚽
Daft Punk||Duo électro français masqué de casques de robots, Get Lucky|Casques|🤖 🎧 🇫🇷
David Guetta|Guetta|DJ français mondialement connu, Titanium|DJ|🎧 🇫🇷 🔥
ABBA|Abba|Groupe suédois de Dancing Queen et Mamma Mia|Mamma Mia|🎤 💃 🇸🇪
Les Rolling Stones|Rolling Stones;Stones|Groupe de rock anglais à la langue tirée, Satisfaction|Langue|🎸 👅 🇬🇧
Queen||Groupe de rock britannique de We Will Rock You et Bohemian Rhapsody|Rhapsody|👑 🎸 🇬🇧
Antonio Vivaldi|Vivaldi|Compositeur vénitien des Quatre Saisons|Saisons|🎻 🍂 🇮🇹
Tchaïkovski|Tchaikovski|Compositeur russe du Lac des cygnes et Casse-Noisette|Casse-Noisette|🩰 🦢 🎻
Maurice Ravel|Ravel|Compositeur français du Boléro|Boléro|🎵 🥁 🇫🇷
`.trim();

export const CELEBS = RAW.split("\n").map((l) => l.split("|")).filter((p) => p.length === 5 && p[1] != null && p[2] && p[3] && p[4])
  .map(([name, alias, desc, word, emo]) => ({ name, alias: alias ? alias.split(";") : [], desc, word, emo: emo.split(" ") }));
