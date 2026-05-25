<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatBytes, formatDuration } from '$lib/utils/format';

	let query = $state('');
	let videoType = $state('all');
	let storagePool = $state('all');
	let uploaderFilter = $state('');

	let results = $state<any[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let searched = $state(false);
	let debounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	$effect(() => {
		// Track all reactive dependencies
		const q = query;
		const vt = videoType;
		const sp = storagePool;
		const uf = uploaderFilter;

		if (debounceTimer) clearTimeout(debounceTimer);

		if (!q.trim()) {
			results = [];
			total = 0;
			searched = false;
			loading = false;
			return;
		}

		loading = true;
		debounceTimer = setTimeout(() => {
			performSearch(q, vt, sp, uf);
		}, 300);
	});

	async function performSearch(q: string, vt: string, sp: string, uf: string) {
		try {
			const params = new URLSearchParams({ q, limit: '40' });
			if (vt !== 'all') params.set('videoType', vt);
			if (sp !== 'all') params.set('storagePool', sp);
			if (uf.trim()) params.set('uploader', uf.trim());

			const res = await fetch(`/api/search?${params}`);
			if (res.ok) {
				const data = await res.json();
				results = data.results;
				total = data.total;
			} else {
				results = [];
				total = 0;
			}
		} catch (e) {
			console.error('Search failed:', e);
			results = [];
			total = 0;
		} finally {
			loading = false;
			searched = true;
		}
	}

	function navigateToDownload(id: string) {
		goto(`/downloads/${id}`);
	}
</script>

<svelte:head>
	<title>Search - wytui</title>
</svelte:head>

<div class="page">
	<div class="search-header">
		<h1>Search</h1>
		<div class="search-bar">
			<svg class="search-icon" width="20" height="20" viewBox="0 0 16 16" fill="none">
				<circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
				<path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			</svg>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				class="search-input"
				placeholder="Search downloads by title, description, or uploader..."
				bind:value={query}
				autofocus
			/>
			{#if query}
				<button class="search-clear" aria-label="Clear search" onclick={() => (query = '')}>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
				</button>
			{/if}
		</div>
	</div>

	<div class="filter-bar">
		<div class="filter-group">
			<label class="filter-label" for="video-type">Type</label>
			<select id="video-type" class="filter-select" bind:value={videoType}>
				<option value="all">All types</option>
				<option value="regular">Regular</option>
				<option value="short">Short</option>
				<option value="stream">Stream</option>
			</select>
		</div>
		<div class="filter-group">
			<label class="filter-label" for="storage-pool">Storage</label>
			<select id="storage-pool" class="filter-select" bind:value={storagePool}>
				<option value="all">All storage</option>
				<option value="cache">Cache</option>
				<option value="library">Library</option>
			</select>
		</div>
		<div class="filter-group filter-group-grow">
			<label class="filter-label" for="uploader-filter">Uploader</label>
			<input
				id="uploader-filter"
				type="text"
				class="filter-input"
				placeholder="Filter by uploader..."
				bind:value={uploaderFilter}
			/>
		</div>
	</div>

	{#if loading}
		<div class="status-message">
			<div class="spinner"></div>
			<span>Searching...</span>
		</div>
	{:else if searched && results.length === 0}
		<div class="status-message empty">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<circle cx="11" cy="11" r="8"/>
				<path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
			</svg>
			<p>No results found</p>
			<p class="text-muted">Try different keywords or adjust your filters</p>
		</div>
	{:else if searched}
		<div class="results-header">
			<span class="results-count">{total} result{total !== 1 ? 's' : ''}</span>
		</div>
		<div class="results-grid">
			{#each results as result (result.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="result-card" onclick={() => navigateToDownload(result.id)}>
					{#if result.thumbnail}
						<div class="result-thumbnail">
							<img src={result.thumbnail} alt="" />
							{#if result.duration}
								<span class="duration-badge">{formatDuration(result.duration)}</span>
							{/if}
						</div>
					{:else}
						<div class="result-thumbnail no-thumb">
							<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<rect x="2" y="2" width="20" height="20" rx="2"/>
								<path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/>
							</svg>
							{#if result.duration}
								<span class="duration-badge">{formatDuration(result.duration)}</span>
							{/if}
						</div>
					{/if}
					<div class="result-content">
						<h3 class="result-title">{result.title || 'Untitled'}</h3>
						{#if result.uploader}
							<p class="result-uploader">{result.uploader}</p>
						{/if}
						<div class="result-badges">
							{#if result.videoType}
								<span class="badge badge-type">{result.videoType}</span>
							{/if}
							<span class="badge" class:badge-library={result.storagePool === 'library'} class:badge-cache={result.storagePool === 'cache'}>
								{result.storagePool === 'library' ? 'Library' : 'Cache'}
							</span>
							{#if result.filesize}
								<span class="badge badge-meta">{formatBytes(result.filesize)}</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="status-message empty">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<circle cx="11" cy="11" r="8"/>
				<path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
			</svg>
			<p>Search your downloads</p>
			<p class="text-muted">Find videos by title, description, or uploader</p>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
	}

	.search-header {
		margin-bottom: var(--spacing-xl);
	}

	.search-header h1 {
		margin-bottom: var(--spacing-lg);
	}

	.search-bar {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: var(--spacing-lg);
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: var(--spacing-md) var(--spacing-lg) var(--spacing-md) calc(var(--spacing-lg) + 28px);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		color: var(--text-primary);
		font-size: 1.0625rem;
		transition: border-color var(--transition-fast);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.search-clear {
		position: absolute;
		right: var(--spacing-md);
		display: flex;
		align-items: center;
		padding: 4px;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.search-clear:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}

	.filter-bar {
		display: flex;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-xl);
		flex-wrap: wrap;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		min-width: 140px;
	}

	.filter-group-grow {
		flex: 1;
		min-width: 180px;
	}

	.filter-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
	}

	.filter-select,
	.filter-input {
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.875rem;
		transition: border-color var(--transition-fast);
	}

	.filter-select:focus,
	.filter-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.filter-select option {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.filter-input::placeholder {
		color: var(--text-tertiary);
	}

	.status-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md);
		padding: var(--spacing-2xl) var(--spacing-xl);
		color: var(--text-secondary);
		text-align: center;
	}

	.status-message.empty {
		background: var(--bg-secondary);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
	}

	.status-message p {
		margin: 0;
	}

	.status-message .text-muted {
		color: var(--text-tertiary);
		font-size: 0.875rem;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--border);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.results-header {
		display: flex;
		align-items: center;
		margin-bottom: var(--spacing-md);
	}

	.results-count {
		font-size: 0.875rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.results-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--spacing-lg);
		width: 100%;
	}

	.result-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		cursor: pointer;
		transition: all var(--transition-normal);
		display: flex;
		flex-direction: column;
	}

	.result-card:hover {
		border-color: var(--border-light);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.result-thumbnail {
		width: 100%;
		height: 160px;
		background: var(--bg-tertiary);
		position: relative;
		overflow: hidden;
	}

	.result-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.result-thumbnail.no-thumb {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
	}

	.duration-badge {
		position: absolute;
		bottom: var(--spacing-sm);
		right: var(--spacing-sm);
		padding: 2px 6px;
		background: rgba(0, 0, 0, 0.8);
		border-radius: var(--radius-sm);
		font-size: 0.6875rem;
		font-weight: 600;
		color: #fff;
		font-family: monospace;
	}

	.result-content {
		padding: var(--spacing-md) var(--spacing-lg);
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.result-title {
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		color: var(--text-primary);
	}

	.result-uploader {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.result-badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-xs);
	}

	.badge {
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		font-size: 0.625rem;
		font-weight: 600;
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.badge-library {
		background: rgba(16, 185, 129, 0.15);
		color: var(--success);
	}

	.badge-cache {
		background: rgba(59, 130, 246, 0.15);
		color: var(--accent-primary);
	}

	.badge-type {
		text-transform: capitalize;
	}

	.badge-meta {
		font-family: monospace;
		letter-spacing: 0.02em;
	}

	@media (max-width: 768px) {
		.page {
			padding: 0 var(--spacing-sm);
		}

		.search-input {
			font-size: 1rem;
		}

		.filter-bar {
			flex-direction: column;
		}

		.filter-group {
			min-width: unset;
		}

		.results-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
