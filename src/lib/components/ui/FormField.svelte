<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		for?: string;
		required?: boolean;
		hint?: string;
		children: Snippet;
	}

	let { label, for: forId, required = false, hint, children }: Props = $props();
</script>

<div class="form-field">
	<label for={forId}>
		{label}
		{#if required}
			<span class="required-asterisk" aria-label="required">*</span>
		{/if}
		{#if hint}
			<span class="hint">{hint}</span>
		{/if}
	</label>
	{@render children()}
</div>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		margin-bottom: var(--spacing-md);
		width: 100%;
	}

	label {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-xs);
		margin-bottom: var(--spacing-xs);
		color: var(--text-primary);
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-sm);
	}

	.required-asterisk {
		color: var(--color-status-error);
		font-weight: var(--font-weight-bold);
	}

	.hint {
		color: var(--text-tertiary);
		font-weight: var(--font-weight-normal);
		font-size: var(--font-size-xs);
		margin-left: auto;
	}
</style>
