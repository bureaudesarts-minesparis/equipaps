// Migration / rattachement : normalisation de l'identite de Leo de Bourdoncle
// de Saint-Salvy sous son identifiant officiel portail 25dbdss avec statut
// cotisant actif.
//
// Idempotent et transactionnel. Gere les contraintes uniques (eid, pxx)
// sur paps, resultats et paiements en dedoublonnant proprement avant l'update.

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const TARGET_PXX = "25dbdss";
const SOURCE_PXXS = ["25salvy", "25debourdo"];
const ALL_PXXS = [TARGET_PXX, ...SOURCE_PXXS];

const pool = await mysql.createPool({
  host: process.env.DB_MYSQL_HOST,
  user: process.env.DB_MYSQL_USER,
  database: process.env.DB_MYSQL_DATABASE,
  password: process.env.DB_MYSQL_PASSWORD,
});

const conn = await pool.getConnection();

try {
  await conn.beginTransaction();

  console.log(`[migration-leo] Debut du rattachement de Leo de Bourdoncle vers ${TARGET_PXX}...`);

  // 1. Dedoublonnage sur paps (uniq_paps_eid_pxx)
  // Si plusieurs inscriptions existent sur le meme evenement sous TARGET ou SOURCE,
  // on conserve l'inscription la plus ancienne et on supprime les autres.
  const [papsRows] = await conn.query(
    "SELECT id, eid, pxx, date FROM paps WHERE pxx IN (?) ORDER BY eid, date ASC, id ASC",
    [ALL_PXXS]
  );
  const papsSeen = new Map();
  const papsToDelete = [];
  for (const r of papsRows) {
    if (papsSeen.has(r.eid)) {
      papsToDelete.push(r.id);
    } else {
      papsSeen.set(r.eid, r.id);
    }
  }
  if (papsToDelete.length > 0) {
    await conn.query("DELETE FROM paps WHERE id IN (?)", [papsToDelete]);
    console.log(`[migration-leo] ${papsToDelete.length} inscription(s) paps en doublon supprimee(s).`);
  }

  // 2. Dedoublonnage sur resultats (uniq_resultats_eid_pxx)
  const [resRows] = await conn.query(
    "SELECT id, eid, pxx FROM resultats WHERE pxx IN (?) ORDER BY eid, id ASC",
    [ALL_PXXS]
  );
  const resSeen = new Map();
  const resToDelete = [];
  for (const r of resRows) {
    if (resSeen.has(r.eid)) {
      resToDelete.push(r.id);
    } else {
      resSeen.set(r.eid, r.id);
    }
  }
  if (resToDelete.length > 0) {
    await conn.query("DELETE FROM resultats WHERE id IN (?)", [resToDelete]);
    console.log(`[migration-leo] ${resToDelete.length} resultat(s) en doublon supprime(s).`);
  }

  // 3. Dedoublonnage sur paiements (uniq_paiements_eid_pxx)
  // Conserver prioritairement 'paye', sinon la maj_at la plus recente
  const [paiementRows] = await conn.query(
    "SELECT id, eid, pxx, statut, note, maj_at FROM paiements WHERE pxx IN (?) ORDER BY eid, (statut = 'paye') DESC, maj_at DESC",
    [ALL_PXXS]
  );
  const paiementsSeen = new Map();
  const paiementsToDelete = [];
  for (const r of paiementRows) {
    if (paiementsSeen.has(r.eid)) {
      paiementsToDelete.push(r.id);
    } else {
      paiementsSeen.set(r.eid, r.id);
    }
  }
  if (paiementsToDelete.length > 0) {
    await conn.query("DELETE FROM paiements WHERE id IN (?)", [paiementsToDelete]);
    console.log(`[migration-leo] ${paiementsToDelete.length} declaration(s) paiement en doublon supprimee(s).`);
  }

  // 4. Mises a jour des cles vers TARGET_PXX
  const [upPaps] = await conn.query(
    "UPDATE paps SET pxx = ? WHERE pxx IN (?)",
    [TARGET_PXX, SOURCE_PXXS]
  );
  const [upHpaps] = await conn.query(
    "UPDATE hpaps SET pxx = ? WHERE pxx IN (?)",
    [TARGET_PXX, SOURCE_PXXS]
  );
  const [upRes] = await conn.query(
    "UPDATE resultats SET pxx = ? WHERE pxx IN (?)",
    [TARGET_PXX, SOURCE_PXXS]
  );
  const [upPaiements] = await conn.query(
    "UPDATE paiements SET pxx = ? WHERE pxx IN (?)",
    [TARGET_PXX, SOURCE_PXXS]
  );
  const [upUsers] = await conn.query(
    "UPDATE users SET pxx = ? WHERE pxx IN (?)",
    [TARGET_PXX, SOURCE_PXXS]
  );

  console.log(`[migration-leo] Historique rattache : paps=${upPaps.affectedRows}, hpaps=${upHpaps.affectedRows}, resultats=${upRes.affectedRows}, paiements=${upPaiements.affectedRows}, users=${upUsers.affectedRows}`);

  // 5. Roster : insertion / mise a jour propre de 25dbdss
  const now = new Date();
  await conn.query(
    `INSERT INTO roster (pxx, prenom, nom, email, promo, photo_url, search_key, cotisant, source_id, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       prenom=VALUES(prenom), nom=VALUES(nom), email=VALUES(email), promo=VALUES(promo),
       photo_url=VALUES(photo_url), search_key=VALUES(search_key), cotisant=1,
       source_id=VALUES(source_id), synced_at=VALUES(synced_at)`,
    [
      TARGET_PXX,
      "Léo",
      "de Bourdoncle de Saint Salvy",
      "leo.de_bourdoncle_de_saint_salvy@etu.minesparis.psl.eu",
      "25",
      "https://eleves.rezal-mdm.com/upload/utilisateurs/25salvy.jpg",
      "leo de bourdoncle de saint salvy",
      1,
      "3749",
      now,
    ]
  );

  // 6. Nettoyage des anciennes rangees du roster
  const [delRoster] = await conn.query(
    "DELETE FROM roster WHERE pxx IN (?)",
    [SOURCE_PXXS]
  );
  console.log(`[migration-leo] Roster nettoye : ${delRoster.affectedRows} ancienne(s) rangee(s) supprimee(s).`);

  await conn.commit();
  console.log(`[migration-leo] SUCCES : Leo de Bourdoncle est rattache proprement sous ${TARGET_PXX} (cotisant actif).`);
} catch (err) {
  await conn.rollback();
  console.error("[migration-leo] ERREUR (transaction annulee) :", err);
  process.exit(1);
} finally {
  conn.release();
  await pool.end();
}
