# BudgetView Tauri — Projet de réécriture

## Contexte

On refait **BudgetView** (https://budgetview.fr) — un logiciel de gestion de budget personnel — en **Tauri 2 + Svelte 5 + SQLite**.

Le code source Java original est dans `/home/jeremy/Documents/budgetview-source/` (3266 fichiers Java). C'est ta référence pour comprendre la logique métier, les modèles de données, et les fonctionnalités.

## Stack technique

- **Frontend** : Svelte 5 (runes, mode `$state`/`$derived`), SvelteKit (static adapter)
- **Styling** : TailwindCSS 4
- **Backend** : Rust (Tauri 2)
- **Base de données** : SQLite via `tauri-plugin-sql`
- **Charts** : Chart.js ou Layercake (Svelte-native)
- **Icons** : Lucide Svelte
- **Build** : Vite + Tauri CLI

## Architecture

```
budgetview-tauri/
├── src/                    # Frontend Svelte
│   ├── lib/
│   │   ├── components/     # Composants UI réutilisables
│   │   ├── stores/         # State management Svelte
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helpers (formatage, calculs)
│   └── routes/             # Pages SvelteKit
│       ├── +layout.svelte  # Layout principal avec sidebar
│       ├── dashboard/      # Vue d'ensemble budget
│       ├── accounts/       # Gestion des comptes
│       ├── transactions/   # Liste & catégorisation
│       ├── budget/         # Planification budget par catégorie
│       ├── analysis/       # Graphiques & analyse
│       └── projects/       # Projets & objectifs épargne
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   ├── main.rs
│   │   ├── db.rs           # Migrations & queries SQLite
│   │   ├── commands.rs     # Commandes Tauri (IPC)
│   │   ├── import.rs       # Import OFX/QIF/CSV
│   │   └── export.rs       # Export données
│   └── Cargo.toml
├── CLAUDE.md               # Ce fichier
└── package.json
```

## Modèle de données (basé sur le Java original)

### Tables principales

```sql
-- Comptes bancaires
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    account_number TEXT,
    bank_name TEXT,
    account_type TEXT CHECK(account_type IN ('checking', 'savings', 'credit_card', 'cash')),
    initial_balance REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    date DATE NOT NULL,
    label TEXT NOT NULL,
    original_label TEXT,
    amount REAL NOT NULL,
    note TEXT,
    is_planned BOOLEAN DEFAULT 0,
    series_id INTEGER REFERENCES budget_series(id),
    sub_series_id INTEGER REFERENCES sub_series(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Catégories de budget (comme les "Series" dans BudgetView)
CREATE TABLE budget_series (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    budget_area TEXT CHECK(budget_area IN ('income', 'recurring', 'variable', 'extras', 'savings', 'transfers')),
    target_amount REAL,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT 1,
    profile_type TEXT DEFAULT 'IRREGULAR',
    description TEXT
);

-- Sous-catégories
CREATE TABLE sub_series (
    id INTEGER PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    name TEXT NOT NULL
);

-- Budget mensuel par série
CREATE TABLE monthly_budget (
    id INTEGER PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    planned_amount REAL NOT NULL,
    UNIQUE(series_id, year, month)
);

-- Projets / Objectifs
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount REAL,
    target_date DATE,
    account_id INTEGER REFERENCES accounts(id),
    image_path TEXT,
    is_active BOOLEAN DEFAULT 1
);

-- Items de projet (dépenses prévues dans un projet)
CREATE TABLE project_items (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    label TEXT NOT NULL,
    planned_amount REAL NOT NULL,
    month INTEGER,
    year INTEGER,
    series_id INTEGER REFERENCES budget_series(id)
);
```

## Fonctionnalités (par priorité)

### Phase 1 — MVP (faire ça EN PREMIER)
1. **Dashboard** : solde actuel, graphe trésorerie, résumé budget du mois
2. **Comptes** : CRUD comptes bancaires
3. **Transactions** : liste, tri, recherche, catégorisation manuelle
4. **Import** : fichiers OFX, QIF, CSV (formats bancaires français)
5. **Catégories budget** : créer des séries (loyer, courses, salaire...)
6. **Budget mensuel** : définir un montant planifié par catégorie/mois
7. **Vue budget** : comparaison planifié vs réalisé avec barres de progression

### Phase 2 — Analyse
8. **Graphiques** : évolution des dépenses, camembert par catégorie
9. **Trésorerie prévisionnelle** : projection sur les mois à venir
10. **Récurrence auto** : détecter les transactions récurrentes

### Phase 3 — Avancé
11. **Projets** : planifier des objectifs d'épargne
12. **Multi-comptes** : vues consolidées
13. **Export** : PDF, CSV
14. **Chiffrement** : mot de passe pour protéger les données

## Règles de développement

1. **Français** : toute l'interface en français
2. **Offline-first** : aucune dépendance cloud, tout local
3. **Design moderne** : UI clean, dark mode, animations subtiles
4. **Performance** : SQLite natif via Tauri, pas d'ORM JS lourd
5. **Type-safe** : TypeScript strict côté frontend, Rust côté backend
6. **Responsive** : fonctionne bien en plein écran et en fenêtre réduite
7. **Accessibilité** : labels, contraste, navigation clavier

## Référence Java

Pour comprendre la logique métier, consulte :
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/` — UI & logique desktop
- `budgetview-source/budgetview/bv_shared/src/main/java/com/budgetview/shared/` — modèles partagés
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/model/` — modèles de données
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/budget/` — logique budget
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/transactions/` — transactions
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/analysis/` — analyse & graphiques

## Comment procéder

1. Commence par initialiser le projet Tauri 2 + Svelte 5 + TailwindCSS
2. Crée le schéma SQLite et les migrations
3. Implémente les commandes Tauri (CRUD comptes, transactions, budget)
4. Construis l'UI page par page en commençant par le dashboard
5. Teste chaque fonctionnalité avant de passer à la suivante
6. Fais des commits Git réguliers avec des messages clairs

## Notes

- Le projet original utilise un framework custom "globsFramework" — on n'en a pas besoin, SQLite + Svelte stores suffisent
- Les "Series" dans BudgetView = nos "budget_series" (catégories de budget)
- Les "BudgetArea" = income/recurring/variable/extras/savings/transfers
- L'import OFX est critique car c'est le format standard des banques françaises

## Auto-catégorisation des transactions

### Principe (basé sur AutoCategorizationFunctor.java)
Quand une transaction est importée, on cherche des transactions passées avec le même label. Si l'utilisateur a catégorisé 3+ fois le même label vers la même série, on auto-assigne.

### Table `categorization_rules` (migration 002)
- `label_exact` : label original en majuscules
- `label_normalized` : label nettoyé (sans dates, numéros de carte/chèque, références)
- `account_id`, `sign` (+1/-1) : contexte de la transaction
- `series_id`, `sub_series_id` : catégorie cible
- `match_count` : nombre de fois que l'utilisateur a confirmé cette association
- `last_used` : date de dernière utilisation
- Contrainte UNIQUE sur `(label_exact, account_id, sign)`

### Normalisation des labels (`normalizeLabel()`)
Implémentée en **TypeScript** (`src/lib/utils/format.ts`) et **Rust** (`src-tauri/src/commands.rs`).
Supprime : dates (DD/MM/YYYY), numéros 4+ chiffres (CB, chèques, refs), chiffres isolés 1-3.
Exemple : `'CARREFOUR 15/03 CB1234'` → `'carrefour cb'`

### 4 niveaux de matching (du plus strict au plus lâche)
1. Label exact + même signe + même compte
2. Label exact + même compte (tout signe)
3. Label normalisé + même signe + même compte
4. Label normalisé + même compte (tout signe)

Seuil : `match_count >= 3` requis pour auto-assigner.

### Exclusions
Chèques, retraits DAB/GAB, remises/dépôts d'espèces sont exclus de l'auto-catégorisation.

### Apprentissage (catégorisation manuelle)
- Même série que la règle existante → `match_count + 1`
- Série différente → reset `match_count = 1` avec nouvelle série
- Nouveau label → création de règle avec `match_count = 1`

### Badge "Auto"
Les transactions auto-catégorisées ont `is_auto_categorized = 1` et affichent un badge "Auto" dans la liste.
La catégorisation manuelle remet `is_auto_categorized = 0`.

---

## ⚠️ Leçons apprises (17/03/2026)

### Compilation & Environnement
- **`cargo build` sur Raspberry Pi = ~5G de cache** (`target/`). Toujours utiliser `cargo check` pour vérifier la compilation sans générer les binaires. Réserver `cargo build` pour la CI GitHub Actions.
- **`cargo clean`** si le disque est plein — ça libère tout le dossier `target/`.
- **La CI compile pour 5 cibles** (Linux x64/ARM64, Windows, macOS x64/ARM64). Ne jamais compiler en local sur le Pi pour un release.

### Config Tauri — TOUJOURS VÉRIFIER
- **`plugins.sql.preload` doit être un ARRAY**, pas un objet. Le format correct :
  ```json
  "sql": { "preload": ["sqlite:budgetview.db"] }
  ```
  PAS : `"preload": { "db": "sqlite:budgetview.db" }` ← crash au lancement avec "invalid type: map, expected a sequence"
- **Toujours tester l'app au lancement** (`cargo tauri dev`), pas juste la compilation. `cargo check` passe ≠ l'app démarre.
- **Vérifier `tauri.conf.json`** à chaque review — c'est un point aveugle fréquent des reviewers qui ne regardent que le code source.

### Sécurité & Data
- **Jamais de `REAL` pour les montants financiers** → stocker en centimes `INTEGER` (1234 = 12.34€). Les floats IEEE 754 accumulent des erreurs d'arrondi.
- **Whitelist les noms de colonnes** dans les updates dynamiques. Ne jamais interpoler directement `Object.keys()` dans du SQL, même si les values sont paramétrisées.
- **Wrapper les imports dans une transaction SQL** (`BEGIN TRANSACTION ... COMMIT`). Un crash au milieu d'un import = état incohérent.
- **Activer la CSP** dans `tauri.conf.json` — ne jamais laisser `"csp": null` pour une app qui manipule des données financières.

### Svelte 5 Runes
- **`$derived(() => expr)`** pour les dérivations simples, **`$derived.by(() => { ... return ... })`** pour les blocs multi-lignes. Ne pas confondre.
- **`$state` arrays** : `push()` fonctionne (deep reactivity Svelte 5) mais réassigner est plus explicite. Choisir un style et s'y tenir.
- **Getters dans les classes store** ne sont PAS réactifs en Svelte 5 — utiliser `$derived` ou `$derived.by` à la place.

### HTML / UI
- **`<select>` avec `value={null}`** → la value HTML est toujours un string. `null` devient `"null"`. Utiliser `value=""` pour le choix "aucun filtre".
- **Toujours un `confirm()` avant les suppressions** — un misclick = donnée perdue.
- **Ajouter des loading states et des toasts** dès le début, pas en afterthought.

### Review Process
- **Review de code ≠ test d'exécution**. Le challenger doit aussi vérifier :
  - Les fichiers de config (`tauri.conf.json`, `Cargo.toml`, `package.json`)
  - Que l'app DÉMARRE réellement, pas juste qu'elle compile
  - Les edge cases de désérialisation (formats attendus par les plugins)
- **Inclure la vérification de la CI** dans le process de review.

### Git
- **Ajouter un `.gitignore` DÈS LE DÉBUT** avec au minimum :
  ```
  .ralph/
  node_modules/
  src-tauri/target/
  .svelte-kit/
  ```
- **Ne jamais commiter les logs d'agents** (Ralph, Claude Code sessions, etc.)
