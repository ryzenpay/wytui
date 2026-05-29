<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		actionLabel?: string;
		onAction?: () => void;
		variant?: 'default' | 'subtle';
		size?: 'sm' | 'md' | 'lg';
		icon?: Snippet;
	}

	let {
		title,
		description,
		actionLabel,
		onAction,
		variant = 'default',
		size = 'md',
		icon,
	}: Props = $props();
</script>

<div class="empty-state" class:subtle={variant === 'subtle'} data-size={size}>
	{#if icon}
		<div class="empty-state-icon">
			{@render icon()}
		</div>
	{/if}
	<p class="empty-state-title">{title}</p>
	{#if description}
		<p class="empty-state-description">{description}</p>
	{/if}
	{#if actionLabel && onAction}
		<button type="button" class="btn btn-primary empty-state-action" onclick={onAction}>
			{actionLabel}
		</button>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-2xl) var(--spacing-xl);
		background: var(--color-bg-secondary);
		border: 1px dashed var(--color-border-default);
		border-radius: var(--radius-lg);
		color: var(--color-text-secondary);
	}

	.empty-state.subtle {
		background: transparent;
		border: none;
		padding: var(--spacing-xl) var(--spacing-lg);
	}

	.empty-state[data-size='sm'] {
		padding: var(--spacing-xl) var(--spacing-lg);
		gap: var(--spacing-xs);
	}

	.empty-state[data-size='lg'] {
		padding: calc(var(--spacing-2xl) * 1.5) var(--spacing-xl);
		gap: var(--spacing-md);
	}

	.empty-state-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.04));
		color: var(--color-text-tertiary);
		margin-bottom: var(--spacing-xs);
	}

	.empty-state[data-size='sm'] .empty-state-icon {
		width: 40px;
		height: 40px;
	}

	.empty-state[data-size='lg'] .empty-state-icon {
		width: 72px;
		height: 72px;
	}

	.empty-state-title {
		margin: 0;
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.empty-state[data-size='lg'] .empty-state-title {
		font-size: var(--font-size-lg);
	}

	.empty-state-description {
		margin: 0;
		max-width: 42ch;
		color: var(--color-text-tertiary);
		font-size: var(--font-size-sm);
		line-height: var(--line-height-base);
	}

	.empty-state-action {
		margin-top: var(--spacing-sm);
	}

	.empty-state-action:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--color-focus-ring);
	}
</style>
