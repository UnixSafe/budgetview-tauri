# Auto-Catégorisation — Spec (reverse-engineered from Java)

Source: `AutoCategorizationFunctor.java`

## Algorithme

L'auto-catégorisation se fait à l'import. Pour chaque transaction non catégorisée :

### 1. Exclusions
- Les chèques (`CHECK`), retraits (`WITHDRAWAL`), dépôts (`DEPOSIT`) sont ignorés
- Les transactions planifiées (`PLANNED`) sont ignorées
- Les transactions déjà catégorisées sont ignorées

### 2. Index de recherche
- BudgetView utilise un **index sur `LABEL_FOR_CATEGORISATION`** — un label normalisé (nettoyé des numéros, dates, etc.)
- Il cherche dans les **transactions passées** (référence) toutes celles avec le même label normalisé

### 3. Cascade de matching (4 niveaux, du plus strict au plus souple)

**Niveau 1 — Strict exact + même signe :**
- Même `LABEL` exact (pas juste label_for_categorisation)
- Même signe (positif/négatif)
- Même compte
- Série valide pour le mois

**Niveau 2 — Strict exact, signe ignoré :**
- Même `LABEL` exact
- Même compte
- Série valide pour le mois

**Niveau 3 — Label normalisé + même signe :**
- Label normalisé identique (via l'index)
- Même signe
- Même compte
- Série valide pour le mois

**Niveau 4 — Label normalisé, tout accepté :**
- Label normalisé identique
- Même compte
- Série valide pour le mois

### 4. Validation de la correspondance
- On parcourt les transactions passées **de la plus récente à la plus ancienne**
- On vérifie que **toutes les correspondances pointent vers la même série** (et sous-série)
- Si on trouve ≥ 3 correspondances sur les 1-2 derniers mois → on valide
- Si une correspondance pointe vers une série différente → **on refuse** (ambiguïté)

### 5. Application
- Si validé : on assigne la `SERIES` et `SUB_SERIES` à la nouvelle transaction

## Label normalisé (`LABEL_FOR_CATEGORISATION`)

À trouver : comment BudgetView normalise le label. Probablement :
- Suppression des dates
- Suppression des numéros de carte
- Mise en majuscules
- Suppression de la ponctuation superflue

## Implémentation pour notre version Tauri

### Table SQL à ajouter
```sql
CREATE TABLE categorization_rules (
    id INTEGER PRIMARY KEY,
    normalized_label TEXT NOT NULL,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    sub_series_id INTEGER REFERENCES sub_series(id),
    account_id INTEGER REFERENCES accounts(id),
    match_count INTEGER DEFAULT 1,
    last_used DATE,
    UNIQUE(normalized_label, account_id)
);
```

### Logique TypeScript
1. Quand l'utilisateur catégorise une transaction → mettre à jour `categorization_rules`
2. À l'import → pour chaque transaction non catégorisée :
   a. Normaliser le label
   b. Chercher dans `categorization_rules`
   c. Si trouvé et `match_count >= 3` → auto-catégoriser
   d. Sinon, proposer la suggestion (UI)

### Normalisation du label
```typescript
function normalizeLabel(label: string): string {
  return label
    .toUpperCase()
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, '') // dates
    .replace(/\bCB\s*\*?\d{4}/g, '')           // numéros CB
    .replace(/\b\d{6,}\b/g, '')                // longs numéros
    .replace(/\s+/g, ' ')
    .trim();
}
```
