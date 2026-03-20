-- Keyword-based auto-categorization dictionary
-- Maps transaction label patterns to budget series
CREATE TABLE IF NOT EXISTS category_keywords (
    id INTEGER PRIMARY KEY,
    pattern TEXT NOT NULL,
    series_id INTEGER NOT NULL REFERENCES budget_series(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 5,
    is_user_defined INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pattern, series_id)
);

CREATE INDEX IF NOT EXISTS idx_category_keywords_pattern ON category_keywords(pattern);

-- Seed with default French keywords
-- Revenus (series_id = 1: Salaire, 2: Autres revenus)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('SALAIRE', 1, 10), ('REMUNERATION', 1, 10), ('PAYE ', 1, 8),
('POLE EMPLOI', 2, 10), ('FRANCE TRAVAIL', 2, 10), ('CAF ', 2, 10), ('CPAM', 2, 8);

-- Loyer (3)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('LOYER', 3, 10), ('CREDIT IMMOBILIER', 3, 10), ('PRET HABITAT', 3, 10);

-- Électricité / Gaz (4)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('EDF', 4, 10), ('ENGIE', 4, 10), ('TOTALENERGIES', 4, 9),
('DIRECT ENERGIE', 4, 10), ('EKWATEUR', 4, 10), ('MINT ENERGIE', 4, 10);

-- Eau (5)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('VEOLIA', 5, 10), ('SUEZ', 5, 8), ('SAUR', 5, 8);

-- Internet / Téléphone (6)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('FREE MOBILE', 6, 10), ('FREE TELECOM', 6, 10), ('FREE HAUTDEBIT', 6, 10),
('BOUYGUES TEL', 6, 10), ('SFR', 6, 8), ('RED BY SFR', 6, 10),
('SOSH', 6, 10), ('ORANGE', 6, 7), ('PRIXTEL', 6, 10), ('B&YOU', 6, 10);

-- Assurances (7)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('MAIF', 7, 10), ('MACIF', 7, 10), ('AXA', 7, 8), ('ALLIANZ', 7, 10),
('MATMUT', 7, 10), ('MAAF', 7, 10), ('GENERALI', 7, 10), ('GROUPAMA', 7, 10),
('GMF', 7, 9), ('MMA ', 7, 9), ('MUTUELLE', 7, 7);

-- Impôts / Taxes (8)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('DGFIP', 8, 10), ('TRESOR PUBLIC', 8, 10), ('TAXE FONCIERE', 8, 10), ('TAXE HABITATION', 8, 10);

-- Abonnements (9)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('NETFLIX', 9, 10), ('SPOTIFY', 9, 10), ('DISNEY+', 9, 10), ('DISNEY PLUS', 9, 10),
('AMAZON PRIME', 9, 10), ('CANAL+', 9, 10), ('CANAL PLUS', 9, 10),
('DEEZER', 9, 10), ('APPLE.COM', 9, 8), ('YOUTUBE PREMIUM', 9, 10),
('MOLOTOV', 9, 10), ('BASIC FIT', 9, 10), ('FITNESS PARK', 9, 10);

-- Transport en commun (10)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('NAVIGO', 10, 10), ('RATP', 10, 10), ('SNCF', 10, 9), ('OUIGO', 10, 10),
('TRAINLINE', 10, 10), ('FLIXBUS', 10, 10), ('BLABLACAR', 10, 10),
('UBER ', 10, 8), ('BOLT ', 10, 7);

-- Courses alimentaires (11)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('CARREFOUR', 11, 9), ('LECLERC', 11, 9), ('AUCHAN', 11, 9),
('INTERMARCHE', 11, 9), ('LIDL', 11, 9), ('ALDI', 11, 9),
('MONOPRIX', 11, 9), ('FRANPRIX', 11, 9), ('CASINO', 11, 7),
('SUPER U', 11, 9), ('SYSTEME U', 11, 9), ('PICARD', 11, 9),
('BIOCOOP', 11, 9), ('GRAND FRAIS', 11, 9), ('CORA ', 11, 8),
('NETTO', 11, 8), ('BOULANGERIE', 11, 8), ('BOUCHERIE', 11, 8);

-- Restaurants (12)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('MCDONALDS', 12, 10), ('MCDONALD', 12, 10), ('BURGER KING', 12, 10),
('KFC', 12, 9), ('SUBWAY', 12, 10), ('DOMINOS', 12, 10), ('PIZZA HUT', 12, 10),
('RESTAURANT', 12, 8), ('BRASSERIE', 12, 8), ('PIZZERIA', 12, 9),
('DELIVEROO', 12, 10), ('UBER EATS', 12, 10), ('UBEREATS', 12, 10),
('JUST EAT', 12, 10), ('STARBUCKS', 12, 10), ('FIVE GUYS', 12, 10),
('FLUNCH', 12, 10), ('BUFFALO GRILL', 12, 10), ('KEBAB', 12, 8),
('SUSHI', 12, 7);

-- Carburant (13)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('TOTAL STATION', 13, 10), ('TOTALENERGIES ST', 13, 10), ('SHELL', 13, 8),
('BP STATION', 13, 10), ('ESSO', 13, 9), ('CARBURANT', 13, 10),
('STATION SERVICE', 13, 10), ('STATION LECLERC', 13, 10), ('STATION CARREF', 13, 10),
('AVIA ', 13, 8), ('IONITY', 13, 10), ('TESLA CHARGE', 13, 10);

-- Entretien voiture (14)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('NORAUTO', 14, 10), ('FEU VERT', 14, 10), ('MIDAS', 14, 10),
('SPEEDY', 14, 9), ('EUROMASTER', 14, 10), ('CONTROLE TECHNIQUE', 14, 10),
('DEKRA', 14, 10), ('POINT S', 14, 9),
('PEAGE', 14, 8), ('VINCI AUTOROUTE', 14, 10), ('SANEF', 14, 10), ('APRR', 14, 10),
('PARKING', 14, 6), ('STATIONNEMENT', 14, 7);

-- Santé (15)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('PHARMACIE', 15, 10), ('MEDECIN', 15, 9), ('DENTISTE', 15, 10),
('OPTICIEN', 15, 10), ('OPTIQUE', 15, 8), ('KINE', 15, 8),
('HOPITAL', 15, 9), ('CLINIQUE', 15, 8), ('AFFLELOU', 15, 10), ('KRYS', 15, 9);

-- Vêtements (16)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('ZARA', 16, 9), ('H&M', 16, 9), ('PRIMARK', 16, 10), ('KIABI', 16, 10),
('UNIQLO', 16, 10), ('CELIO', 16, 10), ('LA HALLE', 16, 9),
('PROMOD', 16, 10), ('BERSHKA', 16, 10), ('PULL AND BEAR', 16, 10);

-- Hygiène / Beauté (17)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('SEPHORA', 17, 10), ('YVES ROCHER', 17, 10), ('NOCIBE', 17, 10),
('MARIONNAUD', 17, 10), ('COIFFEUR', 17, 9), ('COIFFURE', 17, 9);

-- Loisirs / Sorties (18)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('CINEMA', 18, 9), ('UGC', 18, 9), ('GAUMONT', 18, 10), ('PATHE', 18, 10),
('TICKETMASTER', 18, 10), ('FNAC SPECTACLE', 18, 10), ('BOWLING', 18, 9);

-- Sport (19)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('DECATHLON', 19, 8), ('GO SPORT', 19, 10), ('INTERSPORT', 19, 10);

-- Cadeaux (21)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('FLEURISTE', 21, 8), ('INTERFLORA', 21, 10);

-- Vacances / Voyages (22)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('BOOKING', 22, 10), ('AIRBNB', 22, 10), ('HOTEL', 22, 7),
('AIR FRANCE', 22, 10), ('EASYJET', 22, 10), ('RYANAIR', 22, 10), ('TRANSAVIA', 22, 10);

-- Équipement maison (23)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('IKEA', 23, 10), ('LEROY MERLIN', 23, 10), ('CASTORAMA', 23, 10),
('BRICOMARCHE', 23, 10), ('BRICO DEPOT', 23, 10), ('CONFORAMA', 23, 10),
('MAISONS DU MONDE', 23, 10), ('BOULANGER', 23, 9), ('DARTY', 23, 9);

-- High-tech (24)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('APPLE STORE', 24, 10), ('LDLC', 24, 10), ('MATERIEL.NET', 24, 10),
('AMAZON', 24, 4), ('CDISCOUNT', 24, 5), ('FNAC', 24, 5);

-- Animaux (25)
INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority) VALUES
('ANIMALIS', 25, 10), ('VETERINAIRE', 25, 10), ('JARDILAND', 25, 7), ('TRUFFAUT', 25, 7);
