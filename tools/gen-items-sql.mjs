// Génère supabase/items.sql depuis js/catalog.js (prix côté serveur).
import { writeFileSync } from "node:fs";
import { ITEMS } from "../js/catalog.js";

const rows = ITEMS.map((i) => `  ('${i.id}', '${i.slot}', ${i.price})`).join(",\n");
const sql = `-- Généré par node tools/gen-items-sql.mjs : ne pas éditer à la main.
insert into public.jeux_items (id, slot, price) values
${rows}
on conflict (id) do update set slot = excluded.slot, price = excluded.price;
delete from public.jeux_items where id not in (${ITEMS.map((i) => `'${i.id}'`).join(", ")});
`;
writeFileSync(new URL("../supabase/items.sql", import.meta.url), sql);
console.log(`items.sql : ${ITEMS.length} objets`);
