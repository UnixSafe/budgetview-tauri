<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';

	interface Props {
		value: number;
		duration?: number;
		class?: string;
	}

	let { value, duration = 600, class: className = '' }: Props = $props();

	let displayed = $state(0);
	let animationFrame: number;

	$effect(() => {
		const target = value;
		const start = displayed;
		const startTime = performance.now();

		function step(now: number) {
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / duration, 1);
			// ease-out cubic
			const eased = 1 - Math.pow(1 - progress, 3);
			displayed = start + (target - start) * eased;
			if (progress < 1) {
				animationFrame = requestAnimationFrame(step);
			} else {
				displayed = target;
			}
		}

		cancelAnimationFrame(animationFrame);
		animationFrame = requestAnimationFrame(step);

		return () => cancelAnimationFrame(animationFrame);
	});
</script>

<span class="tabular-nums {className}">
	{confidentialStore.format(displayed)}
</span>
