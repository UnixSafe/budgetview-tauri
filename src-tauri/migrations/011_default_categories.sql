-- Default budget categories for new users
-- Only insert if no series exist yet (fresh install)
INSERT OR IGNORE INTO budget_series (id, name, budget_area, is_active, description) VALUES
-- Revenus
(1, 'Salaire', 'income', 1, 'Salaire mensuel'),
(2, 'Autres revenus', 'income', 1, 'Primes, remboursements, revenus secondaires'),

-- Charges fixes (recurring)
(3, 'Loyer / Crédit immobilier', 'recurring', 1, 'Loyer ou mensualité de prêt'),
(4, 'Électricité / Gaz', 'recurring', 1, 'Factures énergie'),
(5, 'Eau', 'recurring', 1, 'Facture eau'),
(6, 'Internet / Téléphone', 'recurring', 1, 'Abonnements télécom'),
(7, 'Assurances', 'recurring', 1, 'Auto, habitation, santé...'),
(8, 'Impôts / Taxes', 'recurring', 1, 'Impôt sur le revenu, taxe foncière...'),
(9, 'Abonnements', 'recurring', 1, 'Netflix, Spotify, presse, salle de sport...'),
(10, 'Transport en commun', 'recurring', 1, 'Navigo, abonnement bus/tram'),

-- Dépenses variables
(11, 'Courses alimentaires', 'variable', 1, 'Supermarché, épicerie, marché'),
(12, 'Restaurants', 'variable', 1, 'Restaurants, fast-food, livraison'),
(13, 'Carburant', 'variable', 1, 'Essence, diesel, recharge électrique'),
(14, 'Entretien voiture', 'variable', 1, 'Révision, réparations, contrôle technique, pneus'),
(15, 'Santé', 'variable', 1, 'Pharmacie, médecin, dentiste, optique'),
(16, 'Vêtements', 'variable', 1, 'Habillement, chaussures'),
(17, 'Hygiène / Beauté', 'variable', 1, 'Coiffeur, cosmétiques, produits d''hygiène'),
(18, 'Loisirs / Sorties', 'variable', 1, 'Cinéma, spectacles, bars, activités'),
(19, 'Sport', 'variable', 1, 'Équipement, licences, activités sportives'),
(20, 'Éducation / Formation', 'variable', 1, 'Livres, cours, fournitures scolaires'),

-- Extras (dépenses exceptionnelles)
(21, 'Cadeaux', 'extras', 1, 'Anniversaires, Noël, mariages...'),
(22, 'Vacances / Voyages', 'extras', 1, 'Hébergement, transport, activités'),
(23, 'Équipement maison', 'extras', 1, 'Meubles, électroménager, décoration'),
(24, 'High-tech', 'extras', 1, 'Téléphone, ordinateur, accessoires'),
(25, 'Animaux', 'extras', 1, 'Nourriture, vétérinaire, accessoires'),

-- Épargne
(26, 'Épargne mensuelle', 'savings', 1, 'Virement régulier vers livret/assurance-vie'),
(27, 'Épargne projet', 'savings', 1, 'Épargne pour un objectif précis'),

-- Transferts
(28, 'Virements entre comptes', 'transfers', 1, 'Mouvements internes entre vos comptes');
