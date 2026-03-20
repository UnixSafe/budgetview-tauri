import { describe, it, expect } from 'vitest';
import { matchCategory, CATEGORY_DICTIONARY } from './category-dictionary';

describe('Category dictionary', () => {
	describe('matchCategory', () => {
		// Courses alimentaires
		it('matches CARREFOUR as Courses alimentaires', () => {
			expect(matchCategory('CB CARREFOUR PARIS')).toBe('Courses alimentaires');
		});
		it('matches LIDL as Courses alimentaires', () => {
			expect(matchCategory('CB LIDL 2345')).toBe('Courses alimentaires');
		});
		it('matches LECLERC as Courses alimentaires', () => {
			expect(matchCategory('PAIEMENT CB LECLERC DRIVE')).toBe('Courses alimentaires');
		});

		// Restaurants
		it('matches MCDONALDS as Restaurants', () => {
			expect(matchCategory('CB MCDONALDS PARIS 15')).toBe('Restaurants');
		});
		it('matches DELIVEROO as Restaurants', () => {
			expect(matchCategory('DELIVEROO PARIS')).toBe('Restaurants');
		});
		it('matches UBER EATS as Restaurants', () => {
			expect(matchCategory('UBER EATS 12345')).toBe('Restaurants');
		});

		// Carburant
		it('matches TOTAL STATION as Carburant', () => {
			expect(matchCategory('CB TOTAL STATION AUTOROUTE')).toBe('Carburant');
		});
		it('matches SHELL as Carburant', () => {
			expect(matchCategory('SHELL MARSEILLE')).toBe('Carburant');
		});

		// Entretien voiture
		it('matches NORAUTO as Entretien voiture', () => {
			expect(matchCategory('CB NORAUTO REVISION')).toBe('Entretien voiture');
		});
		it('matches PEAGE as Entretien voiture', () => {
			expect(matchCategory('PEAGE AUTOROUTE A6')).toBe('Entretien voiture');
		});

		// Énergie
		it('matches EDF as Électricité / Gaz', () => {
			expect(matchCategory('PRLV SEPA EDF')).toBe('Électricité / Gaz');
		});

		// Télécom
		it('matches FREE MOBILE as Internet / Téléphone', () => {
			expect(matchCategory('PRLV FREE MOBILE')).toBe('Internet / Téléphone');
		});

		// Abonnements
		it('matches NETFLIX as Abonnements', () => {
			expect(matchCategory('NETFLIX.COM')).toBe('Abonnements');
		});
		it('matches SPOTIFY as Abonnements', () => {
			expect(matchCategory('SPOTIFY AB')).toBe('Abonnements');
		});

		// Salaire
		it('matches SALAIRE as Salaire', () => {
			expect(matchCategory('VIR SEPA SALAIRE MARS 2026')).toBe('Salaire');
		});

		// Santé
		it('matches PHARMACIE as Santé', () => {
			expect(matchCategory('CB PHARMACIE LAFAYETTE')).toBe('Santé');
		});

		// Assurances
		it('matches MAIF as Assurances', () => {
			expect(matchCategory('PRLV SEPA MAIF COTISATION')).toBe('Assurances');
		});

		// Vacances
		it('matches AIRBNB as Vacances / Voyages', () => {
			expect(matchCategory('AIRBNB PAIEMENT')).toBe('Vacances / Voyages');
		});

		// Équipement maison
		it('matches IKEA as Équipement maison', () => {
			expect(matchCategory('CB IKEA PARIS')).toBe('Équipement maison');
		});
		it('matches LEROY MERLIN as Équipement maison', () => {
			expect(matchCategory('LEROY MERLIN BRICO')).toBe('Équipement maison');
		});

		// No match
		it('returns null for unknown labels', () => {
			expect(matchCategory('VIR JEAN DUPONT')).toBeNull();
		});
		it('returns null for empty string', () => {
			expect(matchCategory('')).toBeNull();
		});

		// Priority handling
		it('prefers higher priority matches', () => {
			// STATION LECLERC should match Carburant (priority 10) over Courses (priority 9)
			expect(matchCategory('CB STATION LECLERC')).toBe('Carburant');
		});

		// Case insensitive
		it('matches case-insensitively', () => {
			expect(matchCategory('cb carrefour paris')).toBe('Courses alimentaires');
		});
	});

	describe('dictionary integrity', () => {
		it('has no duplicate patterns', () => {
			const seen = new Set<string>();
			const duplicates: string[] = [];
			for (const entry of CATEGORY_DICTIONARY) {
				const key = `${entry.pattern}|${entry.category}`;
				if (seen.has(key)) duplicates.push(key);
				seen.add(key);
			}
			expect(duplicates).toEqual([]);
		});

		it('all priorities are between 1 and 10', () => {
			for (const entry of CATEGORY_DICTIONARY) {
				expect(entry.priority).toBeGreaterThanOrEqual(1);
				expect(entry.priority).toBeLessThanOrEqual(10);
			}
		});

		it('has at least 150 entries', () => {
			expect(CATEGORY_DICTIONARY.length).toBeGreaterThanOrEqual(150);
		});
	});
});
