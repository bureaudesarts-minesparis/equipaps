// Migration : table `paiements` (état de paiement des inscriptions, vue
// bureau/trésorerie). Idempotent et re-jouable :
//   node --env-file=.env api/scripts/migrate-paiements.js
//
// Purement ADDITIVE : aucune donnée existante n'est touchée. La table naît
// vide — l'absence de rangée vaut « en attente de paiement » (défaut côté
// serveur), donc les inscriptions déjà en place n'ont rien à migrer.

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config(); // lit l'environnement serveur si présent, sans rien exiger

const pool = await mysql.createPool({
  host: process.env.DB_MYSQL_HOST,
  user: process.env.DB_MYSQL_USER,
  database: process.env.DB_MYSQL_DATABASE,
  password: process.env.DB_MYSQL_PASSWORD,
});

await pool.query(`CREATE TABLE IF NOT EXISTS paiements (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  eid VARCHAR(16) NOT NULL,
  pxx VARCHAR(10) NOT NULL,
  statut VARCHAR(16) NOT NULL DEFAULT 'attente',
  note TEXT NULL,
  maj_at DATETIME NOT NULL,
  CONSTRAINT fk_paiements_eid FOREIGN KEY (eid) REFERENCES events (id),
  CONSTRAINT uniq_paiements_eid_pxx UNIQUE (eid, pxx)
)`);

const [tables] = await pool.query("SHOW TABLES LIKE 'paiements'");
const [[{ pa }]] = await pool.query("SELECT COUNT(*) pa FROM paiements");
console.log(`[migrate] paiements : table ${tables.length ? "présente" : "ABSENTE (échec)"}, ${pa} rangée(s) déclarée(s).`);
await pool.end();
