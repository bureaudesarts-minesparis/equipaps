// États de paiement d'une inscription (vue bureau/trésorerie). Moteur pur :
// constants + validation + attachement aux listes d'inscrits, réutilisable par
// les routes ET testé isolément (paiements.test.mjs). Aucune requête ici.

// Le statut vit en base ; l'ABSENCE de rangée vaut ATTENTE (défaut, aucune
// migration des inscriptions existantes). Deux états, pas de demi-mesure.
export const STATUT_ATTENTE = "attente";
export const STATUT_PAYE = "paye";
export const STATUTS_PAIEMENT = [STATUT_ATTENTE, STATUT_PAYE];
export const NOTE_MAX = 500;

export function statutPaiementValide(statut) {
  return STATUTS_PAIEMENT.includes(statut);
}

// Description optionnelle : trim, vide -> null (nullable en base), bornée.
export function normalizeNotePaiement(note) {
  const n = String(note ?? "").trim();
  if (!n) return null;
  return n.slice(0, NOTE_MAX);
}

// Attache l'état de paiement aux inscrits d'un événement : chaque user
// reçoit `paiement { statut, note, majAt }`, ATTENTE par défaut quand le
// bureau n'a encore rien déclaré (ou `defaultStatut` passé en contexte, ex.
// STATUT_PAYE pour les événements du mandat précédent). Pur et total :
// `rows` sont les rangées `paiements` de l'événement, `users` la liste triée.
export function avecPaiements(users, rows, defaultStatut = STATUT_ATTENTE) {
  const byPxx = new Map(rows.map(r => [r.pxx, r]));
  return users.map(u => {
    const r = byPxx.get(u.pxx);
    return {
      ...u,
      paiement: r
        ? { statut: r.statut, note: r.note, majAt: r.maj_at }
        : { statut: defaultStatut, note: null, majAt: null },
    };
  });
}

// Résumé trésorerie d'un événement : payés et dus parmi les RETENUS (top-N
// provisoire avant clôture, gel après). `users` est la liste triée avec
// `paiement` attaché ; `closed` et `participants` viennent de l'événement.
export function resumePaiements(users, participants, closed) {
  const retenus = closed
    ? users.filter(u => !!u.gagne)
    : users.slice(0, Math.max(0, participants || 0));
  return {
    dus: retenus.length,
    payes: retenus.filter(u => u.paiement?.statut === STATUT_PAYE).length,
  };
}
