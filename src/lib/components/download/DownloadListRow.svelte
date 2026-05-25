<script lang="ts">
	import { formatBytes, formatDuration } from '$lib/utils/format';

	interface Props {
		download: any;
		onclick: () => void;
	}

	let { download, onclick }: Props = $props();

	let statusColor = $derived(getStatusColor(download.status));
	let statusLabel = $derived(getStatusLabel(download.status));
	let thumbnailFailed = $state(false);

	let formattedSize = $derived(download.filesize ? formatBytes(download.filesize) : null);
	let formattedDuration = $derived(download.duration ? formatDuration(download.duration) : null);

	let formattedDate = $derived.by(() => {
		const date = download.completedAt || download.createdAt;
		if (!date) return null;
		const d = new Date(date);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	});

	function getStatusColor(status: string) {
		const colors: Record<string, string> = {
			PENDING: 'var(--text-tertiary)',
			FETCHING_INFO: 'var(--info)',
			DOWNLOADING: 'var(--accent-primary)',
			PROCESSING: 'var(--warning)',
			COMPLETED: 'var(--success)',
			FAILED: 'var(--error)',
			CANCELLED: 'var(--text-tertiary)',
		};
		return colors[status] || 'var(--text-secondary)';
	}

	function getStatusLabel(status: string) {
		const labels: Record<string, string> = {
			PENDING: 'Pending',
			FETCHING_INFO: 'Fetching',
			DOWNLOADING: 'Downloading',
			PROCESSING: 'Processing',
			COMPLETED: 'Completed',
			FAILED: 'Failed',
			CANCELLED: 'Cancelled',
		};
		return labels[status] || status;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="list-row" {onclick}>
	<div class="thumbnail">
		{#if download.thumbnail && !thumbnailFailed}
			<img
				src={download.thumbnail}
				alt=""
				onerror={() => (thumbnailFailed = true)}
			/>
		{:else}
			<div class="thumbnail-placeholder"></div>
		{/if}
	</div>

	<div class="title-col">
		<span class="title">{download.title || download.url}</span>
		{#if download.uploader}
			<span class="uploader">{download.uploader}</span>
		{/if}
	</div>

	{#if formattedDuration}
		<span class="meta duration">{formattedDuration}</span>
	{/if}

	<span class="status-badge" style="--status-color: {statusColor}">
		{statusLabel}
	</span>

	{#if formattedSize}
		<span class="meta size">{formattedSize}</span>
	{/if}

	{#if formattedDate}
		<span class="meta date">{formattedDate}</span>
	{/if}
</div>

<style>
	.list-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.list-row:hover {
		border-color: var(--border-light);
		background: var(--bg-hover, rgba(255, 255, 255, 0.03));
	}

	.thumbnail {
		width: 80px;
		height: 45px;
		border-radius: var(--radius-sm, 4px);
		overflow: hidden;
		flex-shrink: 0;
		background: var(--bg-tertiary);
	}

	.thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumbnail-placeholder {
		width: 100%;
		height: 100%;
	}

	.title-col {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.uploader {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.duration {
		font-family: monospace;
		font-size: 0.6875rem;
	}

	.size {
		font-family: monospace;
		font-size: 0.6875rem;
		min-width: 60px;
		text-align: right;
	}

	.date {
		min-width: 80px;
		text-align: right;
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.status-badge {
		font-size: 0.625rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: var(--radius-sm, 4px);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--status-color);
		background: color-mix(in srgb, var(--status-color) 15%, transparent);
		flex-shrink: 0;
	}

	@media (max-width: 768px) {
		.duration,
		.size,
		.date {
			display: none;
		}

		.list-row {
			padding: var(--spacing-xs) var(--spacing-sm);
		}

		.thumbnail {
			width: 60px;
			height: 34px;
		}
	}
</style>
