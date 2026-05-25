<script lang="ts">
	interface Props {
		count?: number;
		variant?: 'card' | 'row';
	}

	let { count = 6, variant = 'card' }: Props = $props();
</script>

{#if variant === 'card'}
	<div class="skeleton-grid">
		{#each Array(count) as _, i}
			<div class="skeleton-card skeleton-item">
				<div class="skeleton-thumbnail"></div>
				<div class="skeleton-content">
					<div class="skeleton-line skeleton-title"></div>
					<div class="skeleton-line skeleton-subtitle"></div>
					<div class="skeleton-line skeleton-meta"></div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="skeleton-rows">
		{#each Array(count) as _, i}
			<div class="skeleton-row skeleton-item"></div>
		{/each}
	</div>
{/if}

<style>
	@keyframes shimmer {
		0% {
			background-position: -468px 0;
		}
		100% {
			background-position: 468px 0;
		}
	}

	.skeleton-item {
		background: linear-gradient(
			90deg,
			var(--bg-secondary) 25%,
			var(--bg-tertiary, rgba(255, 255, 255, 0.06)) 50%,
			var(--bg-secondary) 75%
		);
		background-size: 936px 100%;
		animation: shimmer 1.5s ease-in-out infinite;
	}

	.skeleton-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--spacing-lg);
	}

	.skeleton-card {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		min-height: 280px;
	}

	.skeleton-thumbnail {
		width: 100%;
		height: 180px;
		background: rgba(255, 255, 255, 0.03);
	}

	.skeleton-content {
		padding: var(--spacing-lg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.skeleton-line {
		border-radius: var(--radius-sm, 4px);
		background: rgba(255, 255, 255, 0.04);
	}

	.skeleton-title {
		height: 16px;
		width: 80%;
	}

	.skeleton-subtitle {
		height: 12px;
		width: 50%;
	}

	.skeleton-meta {
		height: 12px;
		width: 30%;
	}

	.skeleton-rows {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.skeleton-row {
		height: 48px;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}
</style>
