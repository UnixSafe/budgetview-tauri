<script lang="ts">
	interface Props {
		message?: string;
		skeleton?: boolean;
		lines?: number;
	}

	let { message = 'Chargement...', skeleton = false, lines = 3 }: Props = $props();
</script>

{#if skeleton}
	<!-- Skeleton loader variant -->
	<div class="flex flex-col gap-4 py-8 animate-fade-in">
		{#each Array(lines) as _, i}
			<div class="flex items-center gap-4" style="animation-delay: {i * 80}ms">
				<div class="skeleton skeleton-circle h-10 w-10 shrink-0"></div>
				<div class="flex flex-1 flex-col gap-2.5">
					<div class="skeleton skeleton-text" style="width: {70 - i * 10}%"></div>
					<div class="skeleton skeleton-text-sm" style="width: {45 - i * 5}%"></div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<!-- Apple-style spinner -->
	<div class="flex flex-col items-center justify-center gap-5 py-16 animate-fade-in" role="status" aria-live="polite">
		<div class="relative flex items-center justify-center">
			<!-- Outer glow ring -->
			<div class="absolute h-14 w-14 rounded-full animate-pulse-glow"></div>

			<!-- Spinner segments -->
			<div class="spinner-apple relative h-10 w-10">
				{#each Array(8) as _, i}
					<div
						class="spinner-blade"
						style="
							transform: rotate({i * 45}deg);
							animation-delay: {-1.2 + i * 0.15}s;
						"
					></div>
				{/each}
			</div>
		</div>

		{#if message}
			<span class="text-[13px] font-medium tracking-tight text-text-muted">{message}</span>
		{/if}
	</div>
{/if}

<style>
	.spinner-apple {
		position: relative;
	}

	.spinner-blade {
		position: absolute;
		top: 2px;
		left: 50%;
		width: 2.5px;
		height: 9px;
		margin-left: -1.25px;
		border-radius: 2px;
		background-color: var(--color-text-muted);
		transform-origin: center 18px;
		animation: spinner-fade 1.2s linear infinite;
	}

	@keyframes spinner-fade {
		0% { opacity: 1; }
		100% { opacity: 0.12; }
	}
</style>
