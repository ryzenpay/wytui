<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		loading?: boolean;
		disabled?: boolean;
		variant?: 'primary' | 'secondary' | 'danger' | 'accent';
		type?: 'button' | 'submit' | 'reset';
		loadingText?: string;
		onclick?: (e: MouseEvent) => void;
		ariaLabel?: string;
		title?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		loading = false,
		disabled = false,
		variant = 'primary',
		type = 'button',
		loadingText,
		onclick,
		ariaLabel,
		title,
		class: extraClass = '',
		children,
	}: Props = $props();

	let isDisabled = $derived(loading || disabled);
</script>

<button
	{type}
	class="btn btn-{variant} loading-btn {extraClass}"
	class:is-loading={loading}
	disabled={isDisabled}
	aria-busy={loading}
	aria-label={ariaLabel}
	{title}
	{onclick}
>
	{#if loading}
		<span class="spinner" aria-hidden="true"></span>
		<span class="loading-label">
			{#if loadingText}
				{loadingText}
			{:else if children}
				{@render children()}
			{/if}
		</span>
	{:else if children}
		{@render children()}
	{/if}
</button>

<style>
	.loading-btn {
		position: relative;
	}

	.loading-btn.is-loading {
		cursor: progress;
	}

	.spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: loading-btn-spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	.loading-label {
		display: inline-flex;
		align-items: center;
		opacity: 0.85;
	}

	@keyframes loading-btn-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
</style>
