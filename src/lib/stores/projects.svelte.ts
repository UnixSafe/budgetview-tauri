import { query, execute } from './db';
import type { Project, ProjectItem } from '$lib/types';

export interface ProjectWithProgress extends Project {
	total_saved: number;
	items: ProjectItem[];
}

class ProjectStore {
	projects = $state<ProjectWithProgress[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			const raw = await query<Project>(
				'SELECT * FROM projects WHERE is_active = 1 ORDER BY name'
			);

			const items = await query<ProjectItem>(
				`SELECT pi.* FROM project_items pi
				 JOIN projects p ON pi.project_id = p.id
				 WHERE p.is_active = 1`
			);

			this.projects = raw.map((p) => {
				const projectItems = items.filter((i) => i.project_id === p.id);
				const total_saved = projectItems.reduce((s, i) => s + i.planned_amount, 0);
				return { ...p, items: projectItems, total_saved };
			});
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			this.loading = false;
		}
	}

	async create(data: { name: string; target_amount?: number; target_date?: string; account_id?: number }) {
		await execute(
			'INSERT INTO projects (name, target_amount, target_date, account_id) VALUES ($1, $2, $3, $4)',
			[data.name, data.target_amount ?? null, data.target_date ?? null, data.account_id ?? null]
		);
		await this.load();
	}

	async update(id: number, data: Partial<{ name: string; target_amount: number | null; target_date: string | null; account_id: number | null }>) {
		const fields: string[] = [];
		const values: unknown[] = [];
		let i = 1;

		for (const [key, val] of Object.entries(data)) {
			if (val !== undefined) {
				fields.push(`${key} = $${i++}`);
				values.push(val);
			}
		}

		if (fields.length > 0) {
			values.push(id);
			await execute(`UPDATE projects SET ${fields.join(', ')} WHERE id = $${i}`, values);
			await this.load();
		}
	}

	async remove(id: number) {
		await execute('UPDATE projects SET is_active = 0 WHERE id = $1', [id]);
		await this.load();
	}

	async addItem(projectId: number, data: { label: string; planned_amount: number; month?: number; year?: number }) {
		await execute(
			'INSERT INTO project_items (project_id, label, planned_amount, month, year) VALUES ($1, $2, $3, $4, $5)',
			[projectId, data.label, data.planned_amount, data.month ?? null, data.year ?? null]
		);
		await this.load();
	}

	async removeItem(itemId: number) {
		await execute('DELETE FROM project_items WHERE id = $1', [itemId]);
		await this.load();
	}
}

export const projectStore = new ProjectStore();
