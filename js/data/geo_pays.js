// Pays souverains : les 193 États membres de l'ONU et le Vatican.
// Format : "Nom|Capitale|code ISO|continent|autres noms acceptés|autres capitales acceptées|drapeaux"
// drapeaux : nc = pas de question sur la capitale (capitale contestée ou absente),
//            amb = continent discutable (pas de question « quel continent »),
//            nf = drapeau presque identique à un autre (pas de question drapeau).
// Continents : Europe, Asie, Afrique, Amérique, Océanie (les 5 continents habités).
const RAW = `
Afrique du Sud|Pretoria|ZA|Afrique||Le Cap;Bloemfontein|
Algérie|Alger|DZ|Afrique|||
Angola|Luanda|AO|Afrique|||
Bénin|Porto-Novo|BJ|Afrique|||
Botswana|Gaborone|BW|Afrique|||
Burkina Faso|Ouagadougou|BF|Afrique|Burkina||
Burundi|Gitega|BI|Afrique||Bujumbura|
Cameroun|Yaoundé|CM|Afrique|||
Cap-Vert|Praia|CV|Afrique|Cabo Verde||
Centrafrique|Bangui|CF|Afrique|République centrafricaine||
Comores|Moroni|KM|Afrique|||
Congo|Brazzaville|CG|Afrique|République du Congo;Congo-Brazzaville||
République démocratique du Congo|Kinshasa|CD|Afrique|RDC;RD Congo;Congo-Kinshasa||
Côte d'Ivoire|Yamoussoukro|CI|Afrique|||
Djibouti|Djibouti|DJ|Afrique|||
Égypte|Le Caire|EG|Afrique|||
Érythrée|Asmara|ER|Afrique|||
Eswatini|Mbabane|SZ|Afrique|Swaziland|Lobamba|
Éthiopie|Addis-Abeba|ET|Afrique||Addis Ababa|
Gabon|Libreville|GA|Afrique|||
Gambie|Banjul|GM|Afrique|||
Ghana|Accra|GH|Afrique|||
Guinée|Conakry|GN|Afrique|||
Guinée-Bissau|Bissau|GW|Afrique|||
Guinée équatoriale|Malabo|GQ|Afrique|||nc
Kenya|Nairobi|KE|Afrique|||
Lesotho|Maseru|LS|Afrique|||
Liberia|Monrovia|LR|Afrique|||
Libye|Tripoli|LY|Afrique|||
Madagascar|Antananarivo|MG|Afrique||Tananarive|
Malawi|Lilongwe|MW|Afrique|||
Mali|Bamako|ML|Afrique|||
Maroc|Rabat|MA|Afrique|||
Maurice|Port-Louis|MU|Afrique|Île Maurice||
Mauritanie|Nouakchott|MR|Afrique|||
Mozambique|Maputo|MZ|Afrique|||
Namibie|Windhoek|NA|Afrique|||
Niger|Niamey|NE|Afrique|||
Nigeria|Abuja|NG|Afrique|Nigéria||
Ouganda|Kampala|UG|Afrique|||
Rwanda|Kigali|RW|Afrique|||
Sao Tomé-et-Principe|São Tomé|ST|Afrique|||
Sénégal|Dakar|SN|Afrique|||
Seychelles|Victoria|SC|Afrique|||
Sierra Leone|Freetown|SL|Afrique|||
Somalie|Mogadiscio|SO|Afrique||Mogadishu|
Soudan|Khartoum|SD|Afrique|||
Soudan du Sud|Djouba|SS|Afrique||Juba|
Tanzanie|Dodoma|TZ|Afrique|||
Tchad|N'Djaména|TD|Afrique|||nf
Togo|Lomé|TG|Afrique|||
Tunisie|Tunis|TN|Afrique|||
Zambie|Lusaka|ZM|Afrique|||
Zimbabwe|Harare|ZW|Afrique|||
Antigua-et-Barbuda|Saint John's|AG|Amérique|||
Argentine|Buenos Aires|AR|Amérique|||
Bahamas|Nassau|BS|Amérique|||
Barbade|Bridgetown|BB|Amérique|||
Belize|Belmopan|BZ|Amérique|||
Bolivie|Sucre|BO|Amérique||La Paz|
Brésil|Brasilia|BR|Amérique|||
Canada|Ottawa|CA|Amérique|||
Chili|Santiago|CL|Amérique||Santiago du Chili|
Colombie|Bogota|CO|Amérique|||
Costa Rica|San José|CR|Amérique|||
Cuba|La Havane|CU|Amérique|||
Dominique|Roseau|DM|Amérique|||
République dominicaine|Saint-Domingue|DO|Amérique|||
Équateur|Quito|EC|Amérique|||
États-Unis|Washington|US|Amérique|USA;États-Unis d'Amérique||
Grenade|Saint-Georges|GD|Amérique|||
Guatemala|Guatemala|GT|Amérique||Guatemala City|
Guyana|Georgetown|GY|Amérique|||
Haïti|Port-au-Prince|HT|Amérique|||
Honduras|Tegucigalpa|HN|Amérique|||
Jamaïque|Kingston|JM|Amérique|||
Mexique|Mexico|MX|Amérique|||
Nicaragua|Managua|NI|Amérique|||
Panama|Panama|PA|Amérique|||
Paraguay|Asuncion|PY|Amérique|||
Pérou|Lima|PE|Amérique|||
Saint-Christophe-et-Niévès|Basseterre|KN|Amérique|Saint-Kitts-et-Nevis||
Sainte-Lucie|Castries|LC|Amérique|||
Saint-Vincent-et-les-Grenadines|Kingstown|VC|Amérique|||
Salvador|San Salvador|SV|Amérique|El Salvador||
Suriname|Paramaribo|SR|Amérique|||
Trinité-et-Tobago|Port-d'Espagne|TT|Amérique||Port of Spain|
Uruguay|Montevideo|UY|Amérique|||
Venezuela|Caracas|VE|Amérique|||
Afghanistan|Kaboul|AF|Asie|||
Arabie saoudite|Riyad|SA|Asie|||
Arménie|Erevan|AM|Asie|||amb
Azerbaïdjan|Bakou|AZ|Asie|||amb
Bahreïn|Manama|BH|Asie|||
Bangladesh|Dacca|BD|Asie||Dhaka|
Bhoutan|Thimphou|BT|Asie||Thimphu|
Birmanie|Naypyidaw|MM|Asie|Myanmar|Naypyitaw|
Brunei|Bandar Seri Begawan|BN|Asie|||
Cambodge|Phnom Penh|KH|Asie|||
Chine|Pékin|CN|Asie||Beijing|
Chypre|Nicosie|CY|Europe|||amb
Corée du Nord|Pyongyang|KP|Asie|||
Corée du Sud|Séoul|KR|Asie|||
Émirats arabes unis|Abou Dabi|AE|Asie|EAU|Abu Dhabi|
Géorgie|Tbilissi|GE|Asie|||amb
Inde|New Delhi|IN|Asie|||
Indonésie|Jakarta|ID|Asie|||nc,nf
Irak|Bagdad|IQ|Asie|||
Iran|Téhéran|IR|Asie|||
Israël|Jérusalem|IL|Asie|||nc
Japon|Tokyo|JP|Asie|||
Jordanie|Amman|JO|Asie|||
Kazakhstan|Astana|KZ|Asie|||amb
Kirghizistan|Bichkek|KG|Asie|Kirghizstan||
Koweït|Koweït|KW|Asie|||
Laos|Vientiane|LA|Asie|||
Liban|Beyrouth|LB|Asie|||
Malaisie|Kuala Lumpur|MY|Asie|||
Maldives|Malé|MV|Asie|||
Mongolie|Oulan-Bator|MN|Asie||Oulan Bator|
Népal|Katmandou|NP|Asie|||
Oman|Mascate|OM|Asie|||
Ouzbékistan|Tachkent|UZ|Asie|||
Pakistan|Islamabad|PK|Asie|||
Philippines|Manille|PH|Asie|||
Qatar|Doha|QA|Asie|||
Singapour|Singapour|SG|Asie|||
Sri Lanka|Sri Jayawardenepura Kotte|LK|Asie||Kotte;Colombo|
Syrie|Damas|SY|Asie|||
Tadjikistan|Douchanbé|TJ|Asie|||
Thaïlande|Bangkok|TH|Asie|||
Timor oriental|Dili|TL|Asie|Timor-Leste||
Turkménistan|Achgabat|TM|Asie|||
Turquie|Ankara|TR|Asie|||amb
Viêt Nam|Hanoï|VN|Asie|Vietnam||
Yémen|Sanaa|YE|Asie|||
Albanie|Tirana|AL|Europe|||
Allemagne|Berlin|DE|Europe|||
Andorre|Andorre-la-Vieille|AD|Europe|||
Autriche|Vienne|AT|Europe|||
Belgique|Bruxelles|BE|Europe|||
Biélorussie|Minsk|BY|Europe|Bélarus||
Bosnie-Herzégovine|Sarajevo|BA|Europe|Bosnie||
Bulgarie|Sofia|BG|Europe|||
Croatie|Zagreb|HR|Europe|||
Danemark|Copenhague|DK|Europe|||
Espagne|Madrid|ES|Europe|||
Estonie|Tallinn|EE|Europe|||
Finlande|Helsinki|FI|Europe|||
France|Paris|FR|Europe|||
Grèce|Athènes|GR|Europe|||
Hongrie|Budapest|HU|Europe|||
Irlande|Dublin|IE|Europe|||
Islande|Reykjavik|IS|Europe|||
Italie|Rome|IT|Europe|||
Lettonie|Riga|LV|Europe|||
Liechtenstein|Vaduz|LI|Europe|||
Lituanie|Vilnius|LT|Europe|||
Luxembourg|Luxembourg|LU|Europe|||
Macédoine du Nord|Skopje|MK|Europe|Macédoine||
Malte|La Valette|MT|Europe||Valletta|
Moldavie|Chisinau|MD|Europe|||
Monaco|Monaco|MC|Europe|||nf
Monténégro|Podgorica|ME|Europe|||
Norvège|Oslo|NO|Europe|||
Pays-Bas|Amsterdam|NL|Europe|Hollande||
Pologne|Varsovie|PL|Europe|||
Portugal|Lisbonne|PT|Europe|||
Roumanie|Bucarest|RO|Europe|||nf
Royaume-Uni|Londres|GB|Europe|Grande-Bretagne;Angleterre||
Russie|Moscou|RU|Europe|||amb
Saint-Marin|Saint-Marin|SM|Europe|||
Serbie|Belgrade|RS|Europe|||
Slovaquie|Bratislava|SK|Europe|||
Slovénie|Ljubljana|SI|Europe|||
Suède|Stockholm|SE|Europe|||
Suisse|Berne|CH|Europe|||
Tchéquie|Prague|CZ|Europe|République tchèque||
Ukraine|Kiev|UA|Europe||Kyiv|
Vatican|Vatican|VA|Europe|Cité du Vatican;Saint-Siège||
Australie|Canberra|AU|Océanie|||
Fidji|Suva|FJ|Océanie|Îles Fidji||
Kiribati|Tarawa|KI|Océanie||Tarawa-Sud|
Îles Marshall|Majuro|MH|Océanie|Marshall||
Micronésie|Palikir|FM|Océanie|||
Nauru|Yaren|NR|Océanie|||nc
Nouvelle-Zélande|Wellington|NZ|Océanie|||
Palaos|Ngerulmud|PW|Océanie|Palau||
Papouasie-Nouvelle-Guinée|Port Moresby|PG|Océanie|||
Îles Salomon|Honiara|SB|Océanie|Salomon||
Samoa|Apia|WS|Océanie|||
Tonga|Nuku'alofa|TO|Océanie|||
Tuvalu|Funafuti|TV|Océanie|||
Vanuatu|Port-Vila|VU|Océanie|||
`;

export const CONTINENTS = ["Europe", "Asie", "Afrique", "Amérique", "Océanie"];

// drapeau en émoji à partir du code ISO (deux lettres « régionales »)
export const flagOf = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

export const COUNTRIES = RAW.trim().split("\n").map((line) => {
  const [n, c, iso, k, alt, calt, fl] = line.split("|");
  const f = (fl || "").split(",").filter(Boolean);
  return {
    n, c, iso, k,
    alt: alt ? alt.split(";") : [], calt: calt ? calt.split(";") : [],
    nc: f.includes("nc"), amb: f.includes("amb"), nf: f.includes("nf"),
  };
});
