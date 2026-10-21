// Tests purs du chargement annuaire PDM + dérivation de pxx.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePxx, searchKeyOf, annuaireToStudent, buildRosterUpsert } from "./students.js";

test("derivePxx : base promo+nom, suffixe initiale, unicité, filet id", () => {
  const used = new Set();
  const a = derivePxx({ promo: "25", nnom: "durand", nprenom: "marie" }, used);
  assert.equal(a, "25durand");
  used.add(a);
  const b = derivePxx({ promo: "25", nnom: "durand", nprenom: "marc" }, used);
  assert.equal(b, "25durandm");
  used.add(b);
  const c = derivePxx({ promo: "25", nnom: "durand", nprenom: "marie" }, used); // collision -> suffixe
  assert.notEqual(c, a);
  assert.ok(c.startsWith("25"));
  assert.ok(c.length <= 10);
});

test("searchKeyOf : normalisation recherche", () => {
  assert.equal(searchKeyOf("Jean-Baptiste", "D'Artagnan"), "jean baptiste d artagnan");
  assert.equal(searchKeyOf(null, ""), "");
});

// --- Brique portail (sync automatique) ---

test("annuaireToStudent : mapping champ strict du portail vers student", () => {
  const s = annuaireToStudent({
    id: 42, nom_utilisateur: "23imbert", prenom: "Jules", nom: "Imbert",
    email: "jules@mail.com", promotion: "23", cycle: "ic", photo: "utilisateurs/p.jpg",
  }, "https://eleves.rezal-mdm.com/upload");
  assert.equal(s.id, "42");
  assert.equal(s.promo, "23");
  assert.equal(s.photo_url, "https://eleves.rezal-mdm.com/upload/utilisateurs/p.jpg");
  assert.equal(s.nnom, "imbert");
  assert.equal(s.nprenom, "jules");
  assert.equal(s.login, "23imbert");
  const sansPhoto = annuaireToStudent({ id: 1, prenom: "A", nom: "B", promotion: "24", photo: null }, "x");
  assert.equal(sansPhoto.photo_url, null);
  assert.equal(sansPhoto.login, null);
});

test("buildRosterUpsert : maj préservée (pxx + cotisant intacts), insertion neuve (login officiel portail prioritaire), sans-nom écarté", () => {
  const existing = [
    { pxx: "23imbert", prenom: "Jules", nom: "Imbert", email: "old@mail", promo: "23", source_id: "42", cotisant: 1 },
    { pxx: "legacy", prenom: null, nom: null, email: null, promo: null, source_id: null, cotisant: 0 },
  ];
  const { updates, inserts } = buildRosterUpsert([
    { id: "42", prenom: "Jules", nom: "Imbert", email: "new@mail", promo: "23", nnom: "imbert", nprenom: "jules", login: "23imbert" },
    { id: "43", prenom: "Anna", nom: "Neuve", email: null, promo: "24", nnom: "neuve", nprenom: "anna", login: "24aneuve" },
    { id: "44", prenom: "SansNom", nom: "", email: null, promo: "24", nnom: "", nprenom: "sansnom", login: "24sansnom" },
    { id: "45", prenom: "Léo", nom: "de Bourdoncle de Saint Salvy", email: null, promo: "25", nnom: "debourdoncledesaintsalvy", nprenom: "leo", login: "25dbdss" },
  ], existing);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].pxx, "23imbert");       // même pxx, juste les champs rafraîchis
  assert.equal(updates[0].email, "new@mail");
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].source_id, "43");
  assert.equal(inserts[0].pxx, "24aneuve");      // login officiel retenu
  assert.equal(inserts[1].source_id, "45");
  assert.equal(inserts[1].pxx, "25dbdss");       // login officiel retenu au lieu du dérivé
});
