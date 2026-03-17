# Auto-Catégorisation — Analyse du code Java original

## Algorithme (extrait de `AutoCategorizationFunctor.java`)

### Principe
Quand une nouvelle transaction arrive (import), le système cherche dans l'historique des transactions **déjà catégorisées** une correspondance par label. Il applique 4 niveaux de matching, du plus strict au plus lâche :

### Les 4 passes de matching

1. **Strict + même signe** : Label exact + même signe (débit/crédit) + même compte + série valide pour le mois
2. **Strict** : Label exact + même compte + série valide (ignore le signe)
3. **Lâche + même signe** : Label normalisé (`LABEL_FOR_CATEGORISATION`) + même signe + même compte
4. **Lâche** : Label normalisé seul + même compte

### Validation d'un match
Pour qu'un match soit accepté, il faut que les transactions historiques pointent **toutes vers la même série** (catégorie). Si deux transactions historiques avec le même label sont dans des séries différentes → pas d'auto-catégorisation.

### Règle des 3 occurrences
Le système parcourt l'historique en remontant dans le temps. S'il trouve **≥ 3 transactions** qui matchent et pointent vers la même série, il arrête de chercher au-delà de 1 mois d'écart. Cela évite de remonter trop loin dans l'historique.

### Exclusions
- Chèques (`CHECK`), retraits (`WITHDRAWAL`), dépôts (`DEPOSIT`) → jamais auto-catégorisés
- Transactions planifiées → ignorées
- Série "non catégorisé" → ignorée dans les references

### Label normalisé (`LABEL_FOR_CATEGORISATION`)
BudgetView a un index `LABEL_FOR_CATEGORISATION` qui est une version normalisée du label :
- Probablement : uppercase, sans espaces multiples, sans caractères spéciaux
- Permet de matcher "CARREFOUR CITY 1234" avec "CARREFOUR CITY 5678"

## Implémentation pour notre version Tauri

### Table à ajouter
```sql
CREATE TABLE categorization_rules (
    id INTEGER PRIMARY KEY,
    label_pattern TEXT NOT NULL,        -- Label normalisé
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    sub_series_id INTEGER REFERENCES sub_series(id),
    match_count INTEGER DEFAULT 1,       -- Nombre de fois que ce pattern a été catégorisé
    last_used DATE,
    account_id INTEGER REFERENCES accounts(id),
    UNIQUE(label_pattern, account_id)
);
```

### Logique TypeScript
1. **Quand l'utilisateur catégorise** : créer/updater une règle dans `categorization_rules`
2. **À l'import** : pour chaque transaction non catégorisée, chercher dans `categorization_rules` par `normalize(label)`
3. **Normalisation** : `label.toUpperCase().replace(/\s+/g, ' ').replace(/\d{4,}/g, '').trim()`
4. **Confiance** : si `match_count >= 3` → auto-catégoriser silencieusement. Sinon → suggérer.

### Différence vs l'original
L'original cherche dans les transactions passées directement. Notre approche avec une table de règles est plus performante (pas besoin de scanner toutes les transactions) et plus explicite (l'utilisateur peut voir/éditer ses règles).
