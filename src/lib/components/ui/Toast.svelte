<script lang="ts">
	import { getToasts, removeToast } from '$lib/stores/toast.svelte';

	let toastState = getToasts();
</script>

{#if toastState.list.length > 0}
	<div class="toast-container">
		{#each toastState.list as toast (toast.id)}
			<div class="toast toast-{toast.type}">
				<span class="toast-icon">
					{#if toast.type === 'success'}
						<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" /></svg>
					{:else if toast.type === 'error'}
						<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" /></svg>
					{:else}
						<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" /></svg>
					{/if}
				</span>
				<span class="toast-message">{toast.message}</span>
				<button class="toast-close" aria-label="Dismiss" onclick={() => removeToast(toast.id)}>
					<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		bottom: var(--spacing-xl);
		right: var(--spacing-xl);
		display: flex;
		flex-direction: column-reverse;
		gap: var(--spacing-sm);
		z-index: 1000;
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--border-radius-md);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		color: var(--text-primary);
		font-size: 0.875rem;
		pointer-events: auto;
		animation: toast-in 0.25s ease-out;
		max-width: 400px;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.toast-success {
		border-left: 3px solid var(--success);
	}

	.toast-success .toast-icon {
		color: var(--success);
	}

	.toast-error {
		border-left: 3px solid var(--error);
	}

	.toast-error .toast-icon {
		color: var(--error);
	}

	.toast-info {
		border-left: 3px solid var(--accent-primary);
	}

	.toast-info .toast-icon {
		color: var(--accent-primary);
	}

	.toast-icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.toast-message {
		flex: 1;
		line-height: 1.4;
	}

	.toast-close {
		display: flex;
		align-items: center;
		padding: 2px;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
	}

	.toast-close:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}

	@media (max-width: 768px) {
		.toast-container {
			left: var(--spacing-md);
			right: var(--spacing-md);
			bottom: var(--spacing-md);
		}

		.toast {
			max-width: none;
		}
	}
</style>
