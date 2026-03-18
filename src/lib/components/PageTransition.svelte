<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();
	let currentPath = $state(page.url.pathname);
	let transitionKey = $state(0);

	$effect(() => {
		if (page.url.pathname !== currentPath) {
			currentPath = page.url.pathname;
			transitionKey++;
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
		animation: page-enter 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes page-enter {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
