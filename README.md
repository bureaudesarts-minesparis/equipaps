# equipaps

Site du BDA Mines Paris — équi-PAPS : tirage équitable des sorties et
ateliers (fenêtre prioritaire aux moins servis), base élèves, cotisants
HelloAsso, et vue trésorerie (état de paiement par inscription, bureau
seul).

## Où ça tourne

En ligne sur le Coolify du Rézal : app **`equipaps`** (projet Coolify
`BDA`), domaine **`bda.apps.rezal-mdm.com`**. Source : ce dépôt, branche
`main`.

## Déployer / mettre à jour

- **Après un push sur `main`** : relancer **Deploy** sur l'app dans
  <https://deploy.rezal-mdm.com> (l'auto-déploiement par webhook sera
  branché avec la GitHub App de l'org).
- Le build : `npm run build` (Vite → `dist/`), le run : `npm start`
  (l'API Express sert aussi le front, un seul port).
- Variables d'environnement : voir `.env.example` — tout passe par les
  Environment Variables de l'app, aucun secret dans le dépôt.
- Base : ressource MySQL du projet Coolify, avec sauvegarde planifiée
  (onglet Backups). Migrations de schéma : scripts `api/scripts/migrate-*.js`
  (idempotents, re-jouables, jamais destructifs).

## Dev local

```sh
npm install
cp .env.example .env        # renseigner DB, JWT_SECRET, EVENT_PASSWORD
npm run start:web           # front Vite
npm run start:api           # API Express
npm test                    # tests unitaires (api/lib)
npm run build               # build production
```

## Structure

- `web/` : front SolidJS + Tailwind (`web/pages`, `web/components`).
- `api/` : serveur Express (`api/index.js`), schéma drizzle (`api/db`),
  logique pure testée (`api/lib`), migrations et scripts (`api/scripts`).
- La vue trésorerie (paiements) n'est exposée que sur session bureau :
  jamais dans les réponses publiques de l'API.

Hébergement : Coolify du Rézal (runbooks `rezal-deploy/docs/`, dépôt
`admins/rezal-deploy` sur la forge GitLab du Rézal).
