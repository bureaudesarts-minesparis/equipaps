import { createEffect, createSignal, For, Show } from "solid-js";
import { adminFetch } from "../res/admin";

// Modale de déclaration du paiement d'une inscription (bureau/trésorerie).
// Ouverte par clic sur une ligne d'inscrit de la page événement — session
// bureau uniquement, les données ne sortent jamais des routes admin-gated.
// Deux états + note optionnelle, défaut « en attente de paiement » ; le
// serveur remplace la déclaration précédente (upsert), y compris revenir
// en arrière après un « payé » posé par erreur.
const STATUTS = [
  { statut: "attente", label: "En attente de paiement" },
  { statut: "paye", label: "Payé" },
];

// Puce « payés X/Y » pour la liste des événements : le résumé n'est posé par
// le serveur que pour le bureau (jeton x-admin-token), donc un élève ne
// rend jamais ce composant — la puce vit ici, une seule matière payante
// d'UI pour tout le site.
export function PaiementResumeChip(props) {
  const r = props.resume;
  return (
    <span
      classList={{
        "text-xs rounded-full px-2 py-0.5": true,
        "bg-green-100 text-green-800 font-semibold": r.payes === r.dus && r.dus > 0,
        "bg-yellow-100 text-yellow-800": !(r.payes === r.dus && r.dus > 0),
      }}
      title="Parmi les retenus, payés sur dus"
    >
      payés {r.payes}/{r.dus}
    </span>
  );
}

export function PaiementDialog(props) {
  const [statut, setStatut] = createSignal("attente");
  const [note, setNote] = createSignal("");
  const [enregistrement, setEnregistrement] = createSignal(false);
  const [status, setStatus] = createSignal("");

  // À chaque ouverture : la modale repart de l'état actuel de l'inscription.
  createEffect(() => {
    if (props.user) {
      setStatut(props.user.paiement?.statut || "attente");
      setNote(props.user.paiement?.note || "");
      setStatus("");
    }
  });

  const enregistrer = async (e) => {
    e.preventDefault();
    setEnregistrement(true);
    setStatus("");
    try {
      const res = await adminFetch("/api/admin/paiement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eid: props.eid,
          pxx: props.user.pxx,
          statut: statut(),
          note: note(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setStatus("Session expirée. Reconnecte-toi dans l'espace bureau.");
      } else if (!res.ok || j.success === false) {
        setStatus(j.message || "Erreur lors de l'enregistrement.");
      } else {
        props.onSaved(j.paiement);
        return;
      }
    } catch (_) {
      setStatus("Erreur lors de l'enregistrement.");
    }
    setEnregistrement(false);
  };

  return (
    <Show when={props.user}>
      <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => props.onClose()}>
        <div class="bg-white rounded-md shadow-lg p-4 max-w-md w-full" onClick={e => e.stopPropagation()}>
          <div class="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 class="font-bold text-lg">{props.user.prenom || props.user.nom
                ? `${props.user.prenom || ""} ${props.user.nom || ""}`.trim()
                : props.user.pxx}</h3>
              <div class="text-xs text-gray-500">Paiement de l'inscription · {props.eventName}</div>
            </div>
            <button onClick={() => props.onClose()} class="text-gray-500 font-bold cursor-pointer">×</button>
          </div>
          <form onSubmit={enregistrer} class="flex flex-col gap-3">
            <div class="flex gap-2">
              <For each={STATUTS}>
                {s => (
                  <button
                    type="button"
                    onClick={() => setStatut(s.statut)}
                    classList={{
                      "flex-1 rounded p-2 text-sm font-bold cursor-pointer": true,
                      "bg-vf text-white": statut() === s.statut,
                      "bg-black/5 text-gray-700": statut() !== s.statut,
                    }}
                  >
                    {s.label}
                  </button>
                )}
              </For>
            </div>
            <textarea
              placeholder="Description (facultatif) : virement reçu, espèces, date…"
              value={note()}
              onInput={e => setNote(e.target.value)}
              class="border rounded p-2"
            />
            <button type="submit" disabled={enregistrement()} class="bg-vf text-white rounded p-2 font-bold disabled:opacity-50">
              Enregistrer
            </button>
            {status() && <div class="text-center text-sm">{status()}</div>}
          </form>
        </div>
      </div>
    </Show>
  );
}
