<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'default' | 'primary' | 'danger' | 'ghost';
	type Size = 'sm' | 'md' | 'lg';

	interface Props {
		label: string;
		onclick?: (e: MouseEvent) => void;
		variant?: Variant;
		size?: Size;
		disabled?: boolean;
		title?: string;
		type?: 'button' | 'submit' | 'reset';
		ariaPressed?: boolean;
		ariaExpanded?: boolean;
		ariaControls?: string;
		ariaHasPopup?: boolean | 'menu' | 'listbox' | 'dialog';
		class?: string;
		children: Snippet;
	}

	let {
		label,
		onclick,
		variant = 'default',
		size = 'md',
		disabled = false,
		title,
		type = 'button',
		ariaPressed,
		ariaExpanded,
		ariaControls,
		ariaHasPopup,
		class: className = '',
		children,
	}: Props = $props();
</script>

<button
	{type}
	{disabled}
	{onclick}
	class="icon-button {variant} {size} {className}"
	aria-label={label}
	title={title ?? label}
	aria-pressed={ariaPressed}
	aria-expanded={ariaExpanded}
	aria-controls={ariaControls}
	aria-haspopup={ariaHasPopup}
>
	{@render children()}
</button>

<style>
	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-sm);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
		line-height: 1;
	}

	.icon-button:hover:not(:disabled) {
		color: var(--color-text-primary);
		background: var(--color-overlay-hover);
	}

	.icon-button:focus-visible {
		outline: none;
		border-color: var(--color-accent-primary);
		box-shadow: 0 0 0 3px var(--color-focus-ring);
	}

	.icon-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.icon-button.primary {
		background: var(--color-accent-primary);
		color: var(--color-text-on-accent);
	}

	.icon-button.primary:hover:not(:disabled) {
		background: var(--color-accent-hover);
		color: var(--color-text-on-accent);
	}

	.icon-button.danger {
		color: var(--color-status-error);
	}

	.icon-button.danger:hover:not(:disabled) {
		background: var(--color-status-error-bg);
		color: var(--color-status-error);
	}

	.icon-button.ghost {
		color: var(--color-text-tertiary);
	}

	.icon-button.ghost:hover:not(:disabled) {
		color: var(--color-text-primary);
		background: transparent;
	}

	.icon-button.sm {
		padding: var(--spacing-xs);
		min-width: 32px;
		min-height: 32px;
	}

	.icon-button.md {
		min-width: 36px;
		min-height: 36px;
	}

	.icon-button.lg {
		padding: var(--spacing-md);
		min-width: 44px;
		min-height: 44px;
	}

	.icon-button :global(svg) {
		display: block;
	}

	@media (max-width: 768px) {
		.icon-button {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
