<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		align?: 'left' | 'right';
		position?: 'bottom' | 'top';
		minWidth?: string;
		onClose?: () => void;
		class?: string;
		children?: Snippet;
	}

	let {
		open,
		align = 'right',
		position = 'bottom',
		minWidth = '220px',
		onClose,
		class: extraClass = '',
		children,
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose?.();
	}
</script>

{#if open}
	<div
		class="animated-dropdown {extraClass}"
		class:align-left={align === 'left'}
		class:align-right={align === 'right'}
		class:pos-top={position === 'top'}
		class:pos-bottom={position === 'bottom'}
		style="min-width: {minWidth}"
		role="menu"
		tabindex="-1"
		onkeydown={handleKeydown}
	>
		{#if children}
			{@render children()}
		{/if}
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="animated-dropdown-backdrop" onclick={() => onClose?.()}></div>
{/if}

<style>
	.animated-dropdown {
		position: absolute;
		background: var(--color-bg-tertiary, var(--color-bg-tertiary));
		border: 1px solid var(--color-border-translucent, var(--color-border-default));
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 100;
		overflow: hidden;
		transform-origin: top right;
		animation: dropdown-in 160ms cubic-bezier(0.2, 0.8, 0.3, 1.1) both;
	}

	.animated-dropdown.align-left {
		left: 0;
		right: auto;
		transform-origin: top left;
	}

	.animated-dropdown.align-right {
		right: 0;
		left: auto;
	}

	.animated-dropdown.pos-bottom {
		top: calc(100% + 4px);
	}

	.animated-dropdown.pos-top {
		bottom: calc(100% + 4px);
		transform-origin: bottom right;
	}

	.animated-dropdown.pos-top.align-left {
		transform-origin: bottom left;
	}

	.animated-dropdown-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	@keyframes dropdown-in {
		from {
			opacity: 0;
			transform: translateY(-6px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.animated-dropdown {
			animation: none;
		}
	}
</style>
