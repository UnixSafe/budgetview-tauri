/**
 * Dictionnaire de mots-clés pour l'auto-catégorisation des transactions françaises.
 *
 * Inspiré de :
 * - cozy/cozy-banks (taxonomie fr.json)
 * - AlexandreSajus/AutoBudget (mapping regex Société Générale)
 * - Faouzizi/categorization-engine (transactions françaises réelles)
 *
 * Chaque entrée mappe un pattern (mot-clé ou regex) vers un nom de catégorie budget.
 * Le matching est case-insensitive sur le label de la transaction.
 */

export interface CategoryKeyword {
	/** Pattern to match (case-insensitive substring) */
	pattern: string;
	/** Target budget_series name */
	category: string;
	/** Higher = more specific, matched first */
	priority: number;
}

export const CATEGORY_DICTIONARY: CategoryKeyword[] = [
	// ── Salaire / Revenus ────────────────────────────────
	{ pattern: 'SALAIRE', category: 'Salaire', priority: 10 },
	{ pattern: 'VIR SEPA RECU', category: 'Salaire', priority: 5 },
	{ pattern: 'REMUNERATION', category: 'Salaire', priority: 10 },
	{ pattern: 'PAYE ', category: 'Salaire', priority: 8 },
	{ pattern: 'POLE EMPLOI', category: 'Autres revenus', priority: 10 },
	{ pattern: 'FRANCE TRAVAIL', category: 'Autres revenus', priority: 10 },
	{ pattern: 'CAF ', category: 'Autres revenus', priority: 10 },
	{ pattern: 'CPAM', category: 'Autres revenus', priority: 8 },
	{ pattern: 'REMBOURSEMENT', category: 'Autres revenus', priority: 3 },

	// ── Loyer / Crédit immobilier ─────────────────────────
	{ pattern: 'LOYER', category: 'Loyer / Crédit immobilier', priority: 10 },
	{ pattern: 'CREDIT IMMOBILIER', category: 'Loyer / Crédit immobilier', priority: 10 },
	{ pattern: 'PRET HABITAT', category: 'Loyer / Crédit immobilier', priority: 10 },

	// ── Électricité / Gaz ────────────────────────────────
	{ pattern: 'EDF', category: 'Électricité / Gaz', priority: 10 },
	{ pattern: 'ENGIE', category: 'Électricité / Gaz', priority: 10 },
	{ pattern: 'TOTAL ENERGIES', category: 'Électricité / Gaz', priority: 9 },
	{ pattern: 'TOTALENERGIES', category: 'Électricité / Gaz', priority: 9 },
	{ pattern: 'ELECTRICITE', category: 'Électricité / Gaz', priority: 8 },
	{ pattern: 'DIRECT ENERGIE', category: 'Électricité / Gaz', priority: 10 },
	{ pattern: 'ENI ', category: 'Électricité / Gaz', priority: 8 },
	{ pattern: 'EKWATEUR', category: 'Électricité / Gaz', priority: 10 },
	{ pattern: 'MINT ENERGIE', category: 'Électricité / Gaz', priority: 10 },

	// ── Eau ──────────────────────────────────────────────
	{ pattern: 'VEOLIA', category: 'Eau', priority: 10 },
	{ pattern: 'SUEZ', category: 'Eau', priority: 8 },
	{ pattern: 'EAU DU ', category: 'Eau', priority: 9 },
	{ pattern: 'SAUR', category: 'Eau', priority: 8 },

	// ── Internet / Téléphone ─────────────────────────────
	{ pattern: 'FREE MOBILE', category: 'Internet / Téléphone', priority: 10 },
	{ pattern: 'FREE HAUTDEBIT', category: 'Internet / Téléphone', priority: 10 },
	{ pattern: 'FREE TELECOM', category: 'Internet / Téléphone', priority: 10 },
	{ pattern: 'ORANGE', category: 'Internet / Téléphone', priority: 7 },
	{ pattern: 'BOUYGUES TEL', category: 'Internet / Téléphone', priority: 10 },
	{ pattern: 'SFR', category: 'Internet / Téléphone', priority: 8 },
	{ pattern: 'RED BY SFR', category: 'Internet / Téléphone', priority: 10 },
	{ pattern: 'SOSH', category: 'Internet / Téléphone', priority: 10 },
	{ pattern: 'B&YOU', category: 'Internet / Téléphone', priority: 10 },
	{ pattern: 'PRIXTEL', category: 'Internet / Téléphone', priority: 10 },

	// ── Assurances ───────────────────────────────────────
	{ pattern: 'MAIF', category: 'Assurances', priority: 10 },
	{ pattern: 'MACIF', category: 'Assurances', priority: 10 },
	{ pattern: 'AXA', category: 'Assurances', priority: 8 },
	{ pattern: 'ALLIANZ', category: 'Assurances', priority: 10 },
	{ pattern: 'MATMUT', category: 'Assurances', priority: 10 },
	{ pattern: 'MAAF', category: 'Assurances', priority: 10 },
	{ pattern: 'GENERALI', category: 'Assurances', priority: 10 },
	{ pattern: 'GROUPAMA', category: 'Assurances', priority: 10 },
	{ pattern: 'GMF', category: 'Assurances', priority: 9 },
	{ pattern: 'MMA ', category: 'Assurances', priority: 9 },
	{ pattern: 'MUTUELLE', category: 'Assurances', priority: 7 },
	{ pattern: 'ASSURANCE', category: 'Assurances', priority: 5 },

	// ── Impôts / Taxes ───────────────────────────────────
	{ pattern: 'DGFIP', category: 'Impôts / Taxes', priority: 10 },
	{ pattern: 'IMPOT', category: 'Impôts / Taxes', priority: 9 },
	{ pattern: 'TRESOR PUBLIC', category: 'Impôts / Taxes', priority: 10 },
	{ pattern: 'TAXE FONCIERE', category: 'Impôts / Taxes', priority: 10 },
	{ pattern: 'TAXE HABITATION', category: 'Impôts / Taxes', priority: 10 },

	// ── Abonnements ──────────────────────────────────────
	{ pattern: 'NETFLIX', category: 'Abonnements', priority: 10 },
	{ pattern: 'SPOTIFY', category: 'Abonnements', priority: 10 },
	{ pattern: 'DISNEY+', category: 'Abonnements', priority: 10 },
	{ pattern: 'DISNEY PLUS', category: 'Abonnements', priority: 10 },
	{ pattern: 'AMAZON PRIME', category: 'Abonnements', priority: 10 },
	{ pattern: 'CANAL+', category: 'Abonnements', priority: 10 },
	{ pattern: 'CANAL PLUS', category: 'Abonnements', priority: 10 },
	{ pattern: 'DEEZER', category: 'Abonnements', priority: 10 },
	{ pattern: 'APPLE.COM', category: 'Abonnements', priority: 8 },
	{ pattern: 'GOOGLE STORAGE', category: 'Abonnements', priority: 10 },
	{ pattern: 'YOUTUBE PREMIUM', category: 'Abonnements', priority: 10 },
	{ pattern: 'HBO', category: 'Abonnements', priority: 8 },
	{ pattern: 'MOLOTOV', category: 'Abonnements', priority: 10 },
	{ pattern: 'OCS ', category: 'Abonnements', priority: 8 },
	{ pattern: 'BASIC FIT', category: 'Abonnements', priority: 10 },
	{ pattern: 'FITNESS PARK', category: 'Abonnements', priority: 10 },
	{ pattern: 'GYMLIB', category: 'Abonnements', priority: 10 },

	// ── Transport en commun ──────────────────────────────
	{ pattern: 'NAVIGO', category: 'Transport en commun', priority: 10 },
	{ pattern: 'RATP', category: 'Transport en commun', priority: 10 },
	{ pattern: 'SNCF', category: 'Transport en commun', priority: 9 },
	{ pattern: 'OUIGO', category: 'Transport en commun', priority: 10 },
	{ pattern: 'TGV ', category: 'Transport en commun', priority: 9 },
	{ pattern: 'TRAINLINE', category: 'Transport en commun', priority: 10 },
	{ pattern: 'FLIXBUS', category: 'Transport en commun', priority: 10 },
	{ pattern: 'BLABLACAR', category: 'Transport en commun', priority: 10 },
	{ pattern: 'UBER ', category: 'Transport en commun', priority: 8 },
	{ pattern: 'BOLT ', category: 'Transport en commun', priority: 7 },
	{ pattern: 'LIME ', category: 'Transport en commun', priority: 7 },
	{ pattern: 'TIER ', category: 'Transport en commun', priority: 6 },

	// ── Courses alimentaires ─────────────────────────────
	{ pattern: 'CARREFOUR', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'LECLERC', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'AUCHAN', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'INTERMARCHE', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'LIDL', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'ALDI', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'MONOPRIX', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'FRANPRIX', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'CASINO', category: 'Courses alimentaires', priority: 7 },
	{ pattern: 'SUPER U', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'SYSTEME U', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'PICARD', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'BIOCOOP', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'NATURALIA', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'GRAND FRAIS', category: 'Courses alimentaires', priority: 9 },
	{ pattern: 'PRIMEUR', category: 'Courses alimentaires', priority: 7 },
	{ pattern: 'BOULANGERIE', category: 'Courses alimentaires', priority: 8 },
	{ pattern: 'BOUCHERIE', category: 'Courses alimentaires', priority: 8 },
	{ pattern: 'EPICERIE', category: 'Courses alimentaires', priority: 7 },
	{ pattern: 'MARCHE ', category: 'Courses alimentaires', priority: 5 },
	{ pattern: 'CORA ', category: 'Courses alimentaires', priority: 8 },
	{ pattern: 'NETTO', category: 'Courses alimentaires', priority: 8 },
	{ pattern: 'MATCH ', category: 'Courses alimentaires', priority: 6 },

	// ── Restaurants ──────────────────────────────────────
	{ pattern: 'MCDONALDS', category: 'Restaurants', priority: 10 },
	{ pattern: 'MCDONALD', category: 'Restaurants', priority: 10 },
	{ pattern: 'BURGER KING', category: 'Restaurants', priority: 10 },
	{ pattern: 'KFC', category: 'Restaurants', priority: 9 },
	{ pattern: 'SUBWAY', category: 'Restaurants', priority: 10 },
	{ pattern: 'DOMINOS', category: 'Restaurants', priority: 10 },
	{ pattern: 'PIZZA HUT', category: 'Restaurants', priority: 10 },
	{ pattern: 'SUSHI', category: 'Restaurants', priority: 7 },
	{ pattern: 'KEBAB', category: 'Restaurants', priority: 8 },
	{ pattern: 'RESTAURANT', category: 'Restaurants', priority: 8 },
	{ pattern: 'BRASSERIE', category: 'Restaurants', priority: 8 },
	{ pattern: 'PIZZERIA', category: 'Restaurants', priority: 9 },
	{ pattern: 'DELIVEROO', category: 'Restaurants', priority: 10 },
	{ pattern: 'UBER EATS', category: 'Restaurants', priority: 10 },
	{ pattern: 'UBEREATS', category: 'Restaurants', priority: 10 },
	{ pattern: 'JUST EAT', category: 'Restaurants', priority: 10 },
	{ pattern: 'FRICHTI', category: 'Restaurants', priority: 10 },
	{ pattern: 'STARBUCKS', category: 'Restaurants', priority: 10 },
	{ pattern: 'PAUL ', category: 'Restaurants', priority: 6 },
	{ pattern: 'FIVE GUYS', category: 'Restaurants', priority: 10 },
	{ pattern: 'QUICK ', category: 'Restaurants', priority: 7 },
	{ pattern: 'FLUNCH', category: 'Restaurants', priority: 10 },
	{ pattern: 'BUFFALO GRILL', category: 'Restaurants', priority: 10 },
	{ pattern: 'HIPPOPOTAMUS', category: 'Restaurants', priority: 10 },
	{ pattern: 'LEON DE BRUXEL', category: 'Restaurants', priority: 10 },
	{ pattern: 'COURTEPAILLE', category: 'Restaurants', priority: 10 },

	// ── Carburant ────────────────────────────────────────
	{ pattern: 'TOTAL STATION', category: 'Carburant', priority: 10 },
	{ pattern: 'TOTALENERGIES ST', category: 'Carburant', priority: 10 },
	{ pattern: 'SHELL', category: 'Carburant', priority: 8 },
	{ pattern: 'BP STATION', category: 'Carburant', priority: 10 },
	{ pattern: 'ESSO', category: 'Carburant', priority: 9 },
	{ pattern: 'CARBURANT', category: 'Carburant', priority: 10 },
	{ pattern: 'ESSENCE', category: 'Carburant', priority: 7 },
	{ pattern: 'STATION SERVICE', category: 'Carburant', priority: 10 },
	{ pattern: 'STATION LECLERC', category: 'Carburant', priority: 10 },
	{ pattern: 'STATION CARREF', category: 'Carburant', priority: 10 },
	{ pattern: 'STATION INTER', category: 'Carburant', priority: 10 },
	{ pattern: 'AVIA ', category: 'Carburant', priority: 8 },
	{ pattern: 'IONITY', category: 'Carburant', priority: 10 },
	{ pattern: 'TESLA CHARGE', category: 'Carburant', priority: 10 },
	{ pattern: 'CHARGE ELECTR', category: 'Carburant', priority: 9 },

	// ── Entretien voiture ────────────────────────────────
	{ pattern: 'NORAUTO', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'FEU VERT', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'MIDAS', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'SPEEDY', category: 'Entretien voiture', priority: 9 },
	{ pattern: 'EUROMASTER', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'CONTROLE TECHNIQUE', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'DEKRA', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'GARAGE', category: 'Entretien voiture', priority: 5 },
	{ pattern: 'PNEU', category: 'Entretien voiture', priority: 7 },
	{ pattern: 'POINT S', category: 'Entretien voiture', priority: 9 },
	{ pattern: 'PEAGE', category: 'Entretien voiture', priority: 8 },
	{ pattern: 'AUTOROUTE', category: 'Entretien voiture', priority: 8 },
	{ pattern: 'VINCI AUTOROUTE', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'SANEF', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'APRR', category: 'Entretien voiture', priority: 10 },
	{ pattern: 'PARKING', category: 'Entretien voiture', priority: 6 },
	{ pattern: 'STATIONNEMENT', category: 'Entretien voiture', priority: 7 },

	// ── Santé ────────────────────────────────────────────
	{ pattern: 'PHARMACIE', category: 'Santé', priority: 10 },
	{ pattern: 'MEDECIN', category: 'Santé', priority: 9 },
	{ pattern: 'DOCTEUR', category: 'Santé', priority: 8 },
	{ pattern: 'DENTISTE', category: 'Santé', priority: 10 },
	{ pattern: 'OPTICIEN', category: 'Santé', priority: 10 },
	{ pattern: 'OPTIQUE', category: 'Santé', priority: 8 },
	{ pattern: 'KINE', category: 'Santé', priority: 8 },
	{ pattern: 'LABORATOIRE', category: 'Santé', priority: 7 },
	{ pattern: 'LABO ', category: 'Santé', priority: 6 },
	{ pattern: 'HOPITAL', category: 'Santé', priority: 9 },
	{ pattern: 'CLINIQUE', category: 'Santé', priority: 8 },
	{ pattern: 'AFFLELOU', category: 'Santé', priority: 10 },
	{ pattern: 'KRYS', category: 'Santé', priority: 9 },

	// ── Vêtements ────────────────────────────────────────
	{ pattern: 'ZARA', category: 'Vêtements', priority: 9 },
	{ pattern: 'H&M', category: 'Vêtements', priority: 9 },
	{ pattern: 'PRIMARK', category: 'Vêtements', priority: 10 },
	{ pattern: 'KIABI', category: 'Vêtements', priority: 10 },
	{ pattern: 'DECATHLON', category: 'Vêtements', priority: 8 },
	{ pattern: 'UNIQLO', category: 'Vêtements', priority: 10 },
	{ pattern: 'CELIO', category: 'Vêtements', priority: 10 },
	{ pattern: 'JULES', category: 'Vêtements', priority: 7 },
	{ pattern: 'CAMAIEU', category: 'Vêtements', priority: 10 },
	{ pattern: 'LA HALLE', category: 'Vêtements', priority: 9 },
	{ pattern: 'PROMOD', category: 'Vêtements', priority: 10 },
	{ pattern: 'MANGO', category: 'Vêtements', priority: 8 },
	{ pattern: 'PULL AND BEAR', category: 'Vêtements', priority: 10 },
	{ pattern: 'BERSHKA', category: 'Vêtements', priority: 10 },
	{ pattern: 'NIKE', category: 'Vêtements', priority: 7 },
	{ pattern: 'ADIDAS', category: 'Vêtements', priority: 7 },
	{ pattern: 'CHAUSSURE', category: 'Vêtements', priority: 7 },

	// ── Hygiène / Beauté ─────────────────────────────────
	{ pattern: 'SEPHORA', category: 'Hygiène / Beauté', priority: 10 },
	{ pattern: 'YVES ROCHER', category: 'Hygiène / Beauté', priority: 10 },
	{ pattern: 'NOCIBE', category: 'Hygiène / Beauté', priority: 10 },
	{ pattern: 'MARIONNAUD', category: 'Hygiène / Beauté', priority: 10 },
	{ pattern: 'COIFFEUR', category: 'Hygiène / Beauté', priority: 9 },
	{ pattern: 'COIFFURE', category: 'Hygiène / Beauté', priority: 9 },
	{ pattern: 'SALON DE', category: 'Hygiène / Beauté', priority: 6 },

	// ── Loisirs / Sorties ────────────────────────────────
	{ pattern: 'CINEMA', category: 'Loisirs / Sorties', priority: 9 },
	{ pattern: 'UGC', category: 'Loisirs / Sorties', priority: 9 },
	{ pattern: 'GAUMONT', category: 'Loisirs / Sorties', priority: 10 },
	{ pattern: 'PATHE', category: 'Loisirs / Sorties', priority: 10 },
	{ pattern: 'CGR ', category: 'Loisirs / Sorties', priority: 8 },
	{ pattern: 'THEATRE', category: 'Loisirs / Sorties', priority: 8 },
	{ pattern: 'CONCERT', category: 'Loisirs / Sorties', priority: 8 },
	{ pattern: 'TICKETMASTER', category: 'Loisirs / Sorties', priority: 10 },
	{ pattern: 'FNAC SPECTACLE', category: 'Loisirs / Sorties', priority: 10 },
	{ pattern: 'MUSEE', category: 'Loisirs / Sorties', priority: 8 },
	{ pattern: 'BOWLING', category: 'Loisirs / Sorties', priority: 9 },
	{ pattern: 'ESCAPE GAME', category: 'Loisirs / Sorties', priority: 10 },
	{ pattern: 'BAR ', category: 'Loisirs / Sorties', priority: 4 },
	{ pattern: 'PUB ', category: 'Loisirs / Sorties', priority: 4 },

	// ── Sport ────────────────────────────────────────────
	{ pattern: 'DECATHLON', category: 'Sport', priority: 7 },
	{ pattern: 'GO SPORT', category: 'Sport', priority: 10 },
	{ pattern: 'INTERSPORT', category: 'Sport', priority: 10 },
	{ pattern: 'SPORT 2000', category: 'Sport', priority: 10 },

	// ── Éducation / Formation ────────────────────────────
	{ pattern: 'FNAC', category: 'Éducation / Formation', priority: 6 },
	{ pattern: 'GIBERT', category: 'Éducation / Formation', priority: 9 },
	{ pattern: 'CULTURA', category: 'Éducation / Formation', priority: 8 },
	{ pattern: 'LIBRAIRIE', category: 'Éducation / Formation', priority: 8 },
	{ pattern: 'PAPETERIE', category: 'Éducation / Formation', priority: 7 },

	// ── Cadeaux ──────────────────────────────────────────
	{ pattern: 'FLEURISTE', category: 'Cadeaux', priority: 8 },
	{ pattern: 'INTERFLORA', category: 'Cadeaux', priority: 10 },
	{ pattern: 'AQUARELLE', category: 'Cadeaux', priority: 9 },

	// ── Vacances / Voyages ───────────────────────────────
	{ pattern: 'BOOKING', category: 'Vacances / Voyages', priority: 10 },
	{ pattern: 'AIRBNB', category: 'Vacances / Voyages', priority: 10 },
	{ pattern: 'HOTEL', category: 'Vacances / Voyages', priority: 7 },
	{ pattern: 'IBIS', category: 'Vacances / Voyages', priority: 8 },
	{ pattern: 'ACCOR', category: 'Vacances / Voyages', priority: 9 },
	{ pattern: 'AIR FRANCE', category: 'Vacances / Voyages', priority: 10 },
	{ pattern: 'EASYJET', category: 'Vacances / Voyages', priority: 10 },
	{ pattern: 'RYANAIR', category: 'Vacances / Voyages', priority: 10 },
	{ pattern: 'TRANSAVIA', category: 'Vacances / Voyages', priority: 10 },
	{ pattern: 'CAMPING', category: 'Vacances / Voyages', priority: 7 },
	{ pattern: 'EUROCAMP', category: 'Vacances / Voyages', priority: 10 },

	// ── Équipement maison ────────────────────────────────
	{ pattern: 'IKEA', category: 'Équipement maison', priority: 10 },
	{ pattern: 'LEROY MERLIN', category: 'Équipement maison', priority: 10 },
	{ pattern: 'CASTORAMA', category: 'Équipement maison', priority: 10 },
	{ pattern: 'BRICOMARCHE', category: 'Équipement maison', priority: 10 },
	{ pattern: 'BRICO DEPOT', category: 'Équipement maison', priority: 10 },
	{ pattern: 'MR BRICOLAGE', category: 'Équipement maison', priority: 10 },
	{ pattern: 'CONFORAMA', category: 'Équipement maison', priority: 10 },
	{ pattern: 'BUT ', category: 'Équipement maison', priority: 6 },
	{ pattern: 'MAISONS DU MONDE', category: 'Équipement maison', priority: 10 },
	{ pattern: 'BOULANGER', category: 'Équipement maison', priority: 9 },
	{ pattern: 'DARTY', category: 'Équipement maison', priority: 9 },

	// ── High-tech ────────────────────────────────────────
	{ pattern: 'APPLE STORE', category: 'High-tech', priority: 10 },
	{ pattern: 'SAMSUNG', category: 'High-tech', priority: 8 },
	{ pattern: 'FNAC', category: 'High-tech', priority: 5 },
	{ pattern: 'LDLC', category: 'High-tech', priority: 10 },
	{ pattern: 'MATERIEL.NET', category: 'High-tech', priority: 10 },
	{ pattern: 'AMAZON', category: 'High-tech', priority: 4 },
	{ pattern: 'CDISCOUNT', category: 'High-tech', priority: 5 },

	// ── Animaux ──────────────────────────────────────────
	{ pattern: 'ANIMALIS', category: 'Animaux', priority: 10 },
	{ pattern: 'JARDILAND', category: 'Animaux', priority: 7 },
	{ pattern: 'TRUFFAUT', category: 'Animaux', priority: 7 },
	{ pattern: 'VETERINAIRE', category: 'Animaux', priority: 10 },
	{ pattern: 'GAMM VERT', category: 'Animaux', priority: 6 },
];

/**
 * Find the best matching category for a transaction label.
 * Returns the category name or null if no match found.
 */
export function matchCategory(label: string): string | null {
	const upper = label.toUpperCase();
	let bestMatch: { category: string; priority: number } | null = null;

	for (const entry of CATEGORY_DICTIONARY) {
		if (upper.includes(entry.pattern.toUpperCase())) {
			if (!bestMatch || entry.priority > bestMatch.priority) {
				bestMatch = { category: entry.category, priority: entry.priority };
			}
		}
	}

	return bestMatch?.category ?? null;
}
