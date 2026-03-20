<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();
	let currentPath = $state(page.url.pathname);
	let transitionKey = $state(0);

	$effect(() => {
		if (page.url.pathname !== currentPath) {
			currentPath = page.url.pathname;
			transitionKey++;
			// Scroll to top on page change
			const main = document.querySelector('main');
			if (main) main.scrollTo({ top: 0, behavior: 'instant' });
		}
	});
</script>

{#key transitionKey}
	<div class="page-transition">
		{@render children()}
	</div>
{/key}

<style>
	.page-transition {
		animation: page-enter 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes page-enter {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.995);
			filter: blur(2px);
		}
		60% {
			filter: blur(0);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
			filter: blur(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.page-transition {
			animation: none;
		}
	}
</style>
