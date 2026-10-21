import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STATUT_ATTENTE,
  STATUT_PAYE,
  statutPaiementValide,
  normalizeNotePaiement,
  avecPaiements,
  resumePaiements,
} from "./paiements.js";

test("statutPaiementValide : uniquement les deux états déclarés", () => {
  assert.ok(statutPaiementValide(STATUT_ATTENTE));
  assert.ok(statutPaiementValide(STATUT_PAYE));
  assert.ok(!statutPaiementValide("Payé"));      // accent : refusé, pas d'homonymes en base
  assert.ok(!statutPaiementValide("paid"));
  assert.ok(!statutPaiementValide(""));
  assert.ok(!statutPaiementValide(undefined));
});

test("normalizeNotePaiement : trim, vide -> null, bornée", () => {
  assert.equal(normalizeNotePaiement("  virement reçu  "), "virement reçu");
  assert.equal(normalizeNotePaiement("   "), null);
  assert.equal(normalizeNotePaiement(null), null);
  assert.equal(normalizeNotePaiement(undefined), null);
  assert.equal(normalizeNotePaiement("x".repeat(600)).length, 500);
});

test("avecPaiements : absence de rangée = ATTENTE, rangée = état déclaré", () => {
  const users = [
    { pxx: "a", prenom: "Alice" },
    { pxx: "b", prenom: "Bob" },
  ];
  const rows = [
    { pxx: "b", statut: STATUT_PAYE, note: "espèces", maj_at: "2026-10-13" },
  ];
  const out = avecPaiements(users, rows);
  assert.deepEqual(out[0].paiement, { statut: STATUT_ATTENTE, note: null, majAt: null });
  assert.deepEqual(out[1].paiement, { statut: STATUT_PAYE, note: "espèces", majAt: "2026-10-13" });
  // la source n'est pas mutée
  assert.equal(users[0].paiement, undefined);

  // defaultStatut personnalisé (ex: mandat précédent)
  const outPrecedent = avecPaiements(users, rows, STATUT_PAYE);
  assert.deepEqual(outPrecedent[0].paiement, { statut: STATUT_PAYE, note: null, majAt: null });
  assert.deepEqual(outPrecedent[1].paiement, { statut: STATUT_PAYE, note: "espèces", majAt: "2026-10-13" });
});

test("resumePaiements : payés comptés parmi les retenus, avant et après gel", () => {
  const users = [
    { pxx: "a", paiement: { statut: STATUT_PAYE } },
    { pxx: "b", paiement: { statut: STATUT_ATTENTE } },
    { pxx: "c", paiement: { statut: STATUT_PAYE } },
    { pxx: "d", paiement: { statut: STATUT_ATTENTE } },
  ];
  // Ouvert : top-2 provisoire -> 1 payé sur 2 dus.
  assert.deepEqual(resumePaiements(users, 2, false), { dus: 2, payes: 1 });
  // Clos : le gel fait foi (2 gagnants dont 1 hors top-2 initial).
  const gels = users.map(u => ({ ...u, gagne: u.pxx === "b" || u.pxx === "c" }));
  assert.deepEqual(resumePaiements(gels, 2, true), { dus: 2, payes: 1 });
  // Personne de retenu : zéro dû.
  assert.deepEqual(resumePaiements(users, 0, false), { dus: 0, payes: 0 });
});
