<script lang="ts">
	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	interface Props {
		items: BreadcrumbItem[];
	}

	let { items }: Props = $props();
</script>

<nav class="breadcrumb" aria-label="Breadcrumb">
	<ol>
		{#each items as item, i}
			<li>
				{#if i < items.length - 1 && item.href}
					<a href={item.href}>{item.label}</a>
				{:else}
					<span class="current">{item.label}</span>
				{/if}
			</li>
			{#if i < items.length - 1}
				<li class="separator" aria-hidden="true">/</li>
			{/if}
		{/each}
	</ol>
</nav>

<style>
	.breadcrumb {
		margin-bottom: 1.5rem;
	}

	ol {
		list-style: none;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 0;
		font-size: 0.875rem;
	}

	a {
		color: var(--text-secondary);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	a:hover {
		color: var(--text-primary);
	}

	.current {
		color: var(--text-primary);
		font-weight: 500;
	}

	.separator {
		color: var(--text-tertiary);
		user-select: none;
	}
</style>
