<script lang="ts">
	import { onMount } from 'svelte';
	import DownloadForm from '$lib/components/download/DownloadForm.svelte';
	import DownloadCard from '$lib/components/download/DownloadCard.svelte';
	import DownloadListRow from '$lib/components/download/DownloadListRow.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import ViewToggle from '$lib/components/ui/ViewToggle.svelte';
	import { getSSEState, onSSEEvent } from '$lib/stores/sse.svelte';
	import { showConfirm } from '$lib/stores/modal.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import { formatBytes } from '$lib/utils/format';
	import CheckSquareIcon from '$lib/components/icons/CheckSquareIcon.svelte';
	import FolderDownIcon from '$lib/components/icons/FolderDownIcon.svelte';
	import TrashIcon from '$lib/components/icons/TrashIcon.svelte';

	let sseState = getSSEState();

	let completedDownloads = $state<any[]>([]);
	let completedLoading = $state(false);
	let completedFilter = $state<'all' | 'cache' | 'library'>('all');
	let channelFilter = $state<string>('all');
	let channelSearch = $state('');
	let channelDropdownOpen = $state(false);
	let sortOption = $state<'newest' | 'oldest' | 'largest' | 'smallest' | 'longest' | 'shortest' | 'uploader'>('newest');
	let sortDropdownOpen = $state(false);
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let searchTotal = $state(0);
	let searchLoading = $state(false);
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	let viewMode = $state<'grid' | 'list'>('grid');
	let selectionMode = $state(false);
	let selectedIds = $state<Set<string>>(new Set());
	let bulkActing = $state(false);

	let jellyfinUrl = $state('');
	let libraryConfigured = $state(false);
	let cacheUsage = $state<{ usedBytes: string; quotaBytes: string; percentage: number } | null>(null);
	let libraryUsage = $state<{ video: { usedBytes: string; count: number } | null; music: { usedBytes: string; count: number } | null } | null>(null);
	let clearingCache = $state(false);

	let poolFilteredDownloads = $derived(
		completedFilter === 'all'
			? completedDownloads
			: completedDownloads.filter((d) => d.storagePool === completedFilter)
	);

	let availableChannels = $derived(
		[...new Set(poolFilteredDownloads.map((d) => d.uploader).filter(Boolean))].sort() as string[]
	);

	$effect(() => {
		if (channelFilter !== 'all' && !availableChannels.includes(channelFilter)) {
			channelFilter = 'all';
		}
	});

	let filteredChannelOptions = $derived(
		channelSearch
			? availableChannels.filter((c) => c.toLowerCase().includes(channelSearch.toLowerCase()))
			: availableChannels
	);

	$effect(() => {
		const q = searchQuery;
		const sp = completedFilter;
		const uf = channelFilter;

		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

		if (!q.trim()) {
			searchResults = [];
			searchTotal = 0;
			searchLoading = false;
			return;
		}

		searchLoading = true;
		searchDebounceTimer = setTimeout(async () => {
			try {
				const params = new URLSearchParams({ q, limit: '50' });
				if (sp !== 'all') params.set('storagePool', sp);
				if (uf !== 'all') params.set('uploader', uf);

				const res = await fetch(`/api/search?${params}`);
				if (res.ok) {
					const data = await res.json();
					searchResults = data.results || data;
					searchTotal = data.total || searchResults.length;
				} else {
					searchResults = [];
					searchTotal = 0;
				}
			} catch (e) {
				console.error('Search failed:', e);
				searchResults = [];
				searchTotal = 0;
			} finally {
				searchLoading = false;
			}
		}, 300);
	});

	let filteredCompletedDownloads = $derived.by(() => {
		// Use search results if searching
		if (searchQuery.trim()) {
			return searchResults;
		}

		// Otherwise use normal filtering
		let filtered = channelFilter === 'all'
			? poolFilteredDownloads
			: poolFilteredDownloads.filter((d) => d.uploader === channelFilter);

		const sorted = [...filtered];
		switch (sortOption) {
			case 'oldest':
				sorted.sort((a, b) => new Date(a.completedAt || a.createdAt).getTime() - new Date(b.completedAt || b.createdAt).getTime());
				break;
			case 'newest':
				sorted.sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
				break;
			case 'largest':
				sorted.sort((a, b) => Number(b.filesize || 0) - Number(a.filesize || 0));
				break;
			case 'smallest':
				sorted.sort((a, b) => Number(a.filesize || 0) - Number(b.filesize || 0));
				break;
			case 'longest':
				sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
				break;
			case 'shortest':
				sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));
				break;
			case 'uploader':
				sorted.sort((a, b) => (a.uploader || '').localeCompare(b.uploader || ''));
				break;
		}
		return sorted;
	});

	onMount(() => {
		loadSettings();
		loadCompletedDownloads();
		loadCacheUsage();

		const unsubComplete = onSSEEvent('download:complete', ({ download }) => {
			const exists = completedDownloads.find((d) => d.id === download.id);
			if (!exists) {
				completedDownloads = [download, ...completedDownloads];
			}
			loadCacheUsage();
		});
		const unsubDeleted = onSSEEvent('download:deleted', ({ id }) => {
			completedDownloads = completedDownloads.filter((d) => d.id !== id);
			loadCacheUsage();
		});

		return () => {
			unsubComplete();
			unsubDeleted();
		};
	});

	async function loadSettings() {
		try {
			const res = await fetch('/api/settings');
			if (res.ok) {
				const settings = await res.json();
				libraryConfigured = !!settings.libraryPath;
				jellyfinUrl = settings.jellyfinExternalUrl || settings.jellyfinUrl || '';
			}
		} catch (e) {
			console.error('Failed to load settings:', e);
		}
	}

	async function loadCompletedDownloads() {
		completedLoading = true;
		try {
			const res = await fetch('/api/downloads?status=COMPLETED&limit=50');
			if (res.ok) {
				completedDownloads = await res.json();
			}
		} catch (e) {
			console.error('Failed to load completed downloads:', e);
		} finally {
			completedLoading = false;
		}
	}

	async function loadCacheUsage() {
		try {
			const res = await fetch('/api/library/usage');
			if (res.ok) {
				const data = await res.json();
				cacheUsage = data.cache;
				libraryUsage = data.library;
			}
		} catch (e) {
			console.error('Failed to load usage:', e);
		}
	}

	async function clearCache() {
		const confirmed = await showConfirm(
			'Clear Cache',
			'This will delete all cached downloads. Library downloads will not be affected.',
			'Clear Cache'
		);
		if (!confirmed) return;

		clearingCache = true;
		try {
			await fetch('/api/library/clear', { method: 'POST' });
			await Promise.all([loadCompletedDownloads(), loadCacheUsage()]);
		} catch (e) {
			console.error('Failed to clear cache:', e);
		} finally {
			clearingCache = false;
		}
	}

	function toggleSelection(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		selectedIds = next;
	}

	function selectAll() {
		selectedIds = new Set(filteredCompletedDownloads.map((d) => d.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function exitSelectionMode() {
		selectionMode = false;
		selectedIds = new Set();
	}

	async function bulkDelete() {
		const count = selectedIds.size;
		const confirmed = await showConfirm(
			'Delete Selected',
			`Delete ${count} download${count !== 1 ? 's' : ''}? This cannot be undone.`,
			'Delete'
		);
		if (!confirmed) return;

		bulkActing = true;
		try {
			await Promise.all(
				[...selectedIds].map((id) => fetch(`/api/downloads/${id}`, { method: 'DELETE' }))
			);
			addToast('success', `Deleted ${count} download${count !== 1 ? 's' : ''}`);
			exitSelectionMode();
			await loadCompletedDownloads();
		} catch (e) {
			addToast('error', 'Failed to delete some downloads');
		} finally {
			bulkActing = false;
		}
	}

	async function bulkPromote() {
		const ids = [...selectedIds].filter((id) => {
			const d = completedDownloads.find((dl) => dl.id === id);
			return d?.storagePool === 'cache';
		});
		if (ids.length === 0) {
			addToast('info', 'No cache downloads selected to move');
			return;
		}
		bulkActing = true;
		try {
			await Promise.all(
				ids.map((id) => fetch(`/api/downloads/${id}/promote`, { method: 'POST' }))
			);
			addToast('success', `Moved ${ids.length} download${ids.length !== 1 ? 's' : ''} to library`);
			exitSelectionMode();
			await loadCompletedDownloads();
		} catch (e) {
			addToast('error', 'Failed to move some downloads');
		} finally {
			bulkActing = false;
		}
	}
</script>

<svelte:head>
	<title>Downloads - wytui</title>
</svelte:head>

<div class="page">
	<div class="downloads-layout">
		<div class="form-section">
			<h2>Download</h2>
			<DownloadForm />
		</div>

		<div class="active-section">
			<h2>Active ({sseState.downloads.length})</h2>
			{#if sseState.downloads.length === 0}
				<div class="empty-state">
					<p>No active downloads</p>
					<p class="text-muted">Paste a URL to get started</p>
				</div>
			{:else}
				<div class="downloads-list">
					{#each [...sseState.downloads].sort((a, b) => {
						const active = ['FETCHING_INFO', 'DOWNLOADING', 'PROCESSING'];
						const aActive = active.includes(a.status) ? 0 : 1;
						const bActive = active.includes(b.status) ? 0 : 1;
						if (aActive !== bActive) return aActive - bActive;
						return sseState.downloads.indexOf(b) - sseState.downloads.indexOf(a);
					}) as download (download.id)}
						<DownloadCard {download} {jellyfinUrl} {libraryConfigured} />
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if cacheUsage || libraryUsage}
		<div class="storage-row">
			{#if cacheUsage}
				<div class="storage-box">
					<div class="cache-usage-header">
						<div class="cache-usage-left">
							<span class="cache-usage-label">Cache</span>
							<span class="cache-usage-tooltip" data-tooltip="Downloads are stored in a temporary cache. When the cache fills up, the oldest downloads are automatically removed to free space. Save to Library to keep downloads permanently.">?</span>
						</div>
						<div class="cache-usage-right">
							<span class="cache-usage-value">{formatBytes(cacheUsage.usedBytes)} / {formatBytes(cacheUsage.quotaBytes)}</span>
							{#if Number(cacheUsage.usedBytes) > 0}
								<button class="btn btn-sm btn-secondary cache-clear-btn" onclick={clearCache} disabled={clearingCache} aria-label="Clear cache" title="Clear cache">
									{#if clearingCache}
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
									{/if}
								</button>
							{/if}
						</div>
					</div>
					<div class="cache-usage-bar">
						<div class="cache-usage-fill" class:warning={cacheUsage.percentage > 80} class:critical={cacheUsage.percentage > 95} style="width: max({cacheUsage.percentage}%, {cacheUsage.percentage > 0 ? '4px' : '0px'})"></div>
					</div>
				</div>
			{/if}
			{#if libraryUsage?.video}
				<div class="storage-box">
					<div class="cache-usage-header">
						<div class="cache-usage-left">
							<span class="cache-usage-label">Video Library</span>
						</div>
						<div class="cache-usage-right">
							<span class="cache-usage-value">{formatBytes(libraryUsage.video.usedBytes)}</span>
							<span class="storage-count">{libraryUsage.video.count} file{libraryUsage.video.count !== 1 ? 's' : ''}</span>
						</div>
					</div>
				</div>
			{/if}
			{#if libraryUsage?.music}
				<div class="storage-box">
					<div class="cache-usage-header">
						<div class="cache-usage-left">
							<span class="cache-usage-label">Music Library</span>
						</div>
						<div class="cache-usage-right">
							<span class="cache-usage-value">{formatBytes(libraryUsage.music.usedBytes)}</span>
							<span class="storage-count">{libraryUsage.music.count} file{libraryUsage.music.count !== 1 ? 's' : ''}</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="section">
		<div class="search-bar-section">
			<div class="search-bar-wrapper">
				<svg class="search-icon" width="20" height="20" viewBox="0 0 16 16" fill="none">
					<circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
					<path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
				<input
					type="text"
					class="search-input-main"
					placeholder="Search downloads by title, description, or uploader..."
					bind:value={searchQuery}
				/>
				{#if searchQuery}
					<button class="search-clear-btn" aria-label="Clear search" onclick={() => (searchQuery = '')}>
						<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="section">
		<div class="section-header">
			<div class="section-header-left">
				<h2>Completed ({searchQuery ? searchTotal : filteredCompletedDownloads.length})</h2>
				<ViewToggle bind:view={viewMode} />
				<button
					class="select-btn"
					class:active={selectionMode}
					onclick={(e) => { e.stopPropagation(); if (selectionMode) exitSelectionMode(); else selectionMode = true; }}
				>
					{selectionMode ? 'Cancel' : 'Select'}
				</button>
			</div>
			<div class="section-header-right">
				<div class="tabs completed-filter">
					<button class="tab" class:active={completedFilter === 'all'} onclick={(e) => { e.stopPropagation(); completedFilter = 'all'; }}>All</button>
					<button class="tab" class:active={completedFilter === 'cache'} onclick={(e) => { e.stopPropagation(); completedFilter = 'cache'; }}>Cache</button>
					<button class="tab" class:active={completedFilter === 'library'} onclick={(e) => { e.stopPropagation(); completedFilter = 'library'; }}>Library</button>
				</div>
				{#if availableChannels.length > 1}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="channel-dropdown" onkeydown={(e) => { if (e.key === 'Escape') channelDropdownOpen = false; }}>
						<button class="channel-dropdown-trigger" onclick={(e) => { e.stopPropagation(); channelDropdownOpen = !channelDropdownOpen; channelSearch = ''; }}>
							<span class="channel-dropdown-label">{channelFilter === 'all' ? 'All channels' : channelFilter}</span>
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="channel-dropdown-chevron" class:open={channelDropdownOpen}>
								<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</button>
						{#if channelDropdownOpen}
							<div class="channel-dropdown-menu" onclick={(e) => e.stopPropagation()}>
								<input type="text" class="channel-dropdown-search" placeholder="Search channels..." bind:value={channelSearch} autofocus />
								<div class="channel-dropdown-options">
									<button class="channel-dropdown-option" class:selected={channelFilter === 'all'} onclick={(e) => { e.stopPropagation(); channelFilter = 'all'; channelDropdownOpen = false; }}>All channels</button>
									{#each filteredChannelOptions as channel}
										<button class="channel-dropdown-option" class:selected={channelFilter === channel} onclick={(e) => { e.stopPropagation(); channelFilter = channel; channelDropdownOpen = false; }}>{channel}</button>
									{/each}
									{#if filteredChannelOptions.length === 0}
										<div class="channel-dropdown-empty">No channels found</div>
									{/if}
								</div>
							</div>
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="channel-dropdown-backdrop" onclick={() => (channelDropdownOpen = false)}></div>
						{/if}
					</div>
				{/if}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="sort-dropdown" onkeydown={(e) => { if (e.key === 'Escape') sortDropdownOpen = false; }}>
					<button class="channel-dropdown-trigger" onclick={(e) => { e.stopPropagation(); sortDropdownOpen = !sortDropdownOpen; }}>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
						<span class="channel-dropdown-label">{
							({ newest: 'Newest', oldest: 'Oldest', largest: 'Largest', smallest: 'Smallest', longest: 'Longest', shortest: 'Shortest', uploader: 'Uploader' } as Record<string, string>)[sortOption]
						}</span>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="channel-dropdown-chevron" class:open={sortDropdownOpen}>
							<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</button>
					{#if sortDropdownOpen}
						<div class="channel-dropdown-menu" onclick={(e) => e.stopPropagation()}>
							<div class="channel-dropdown-options">
								{#each [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['largest', 'Largest first'], ['smallest', 'Smallest first'], ['longest', 'Longest first'], ['shortest', 'Shortest first'], ['uploader', 'Uploader A–Z']] as [value, label]}
									<button class="channel-dropdown-option" class:selected={sortOption === value} onclick={(e) => { e.stopPropagation(); sortOption = value as typeof sortOption; sortDropdownOpen = false; }}>{label}</button>
								{/each}
							</div>
						</div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="channel-dropdown-backdrop" onclick={() => (sortDropdownOpen = false)}></div>
					{/if}
				</div>
			</div>
		</div>
		{#if completedLoading}
			<Skeleton count={6} variant="card" />
		{:else if filteredCompletedDownloads.length === 0}
			<div class="empty-state">
				<p>{completedFilter === 'all' ? 'No completed downloads yet' : `No ${completedFilter} downloads`}</p>
				<p class="text-muted">{completedFilter === 'all' ? 'Downloads will appear here once they finish' : 'Try changing your filters'}</p>
			</div>
		{:else if viewMode === 'grid'}
			<div class="downloads-grid">
				{#each filteredCompletedDownloads as download (download.id)}
					<DownloadCard
						{download}
						{jellyfinUrl}
						{selectionMode}
						selected={selectedIds.has(download.id)}
						{libraryConfigured}
						onToggleSelect={() => toggleSelection(download.id)}
					/>
				{/each}
			</div>
		{:else}
			<div class="downloads-list">
				{#each filteredCompletedDownloads as download (download.id)}
					<DownloadListRow
						{download}
						onclick={() => { if (download.status === 'COMPLETED') window.location.href = `/downloads/${download.id}`; }}
					/>
				{/each}
			</div>
		{/if}

		{#if selectionMode && selectedIds.size > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{selectedIds.size} selected</span>
				<div class="bulk-actions">
					<button class="btn btn-sm btn-secondary btn-icon" onclick={() => { selectedIds.size === filteredCompletedDownloads.length ? deselectAll() : selectAll(); }} aria-label={selectedIds.size === filteredCompletedDownloads.length ? 'Deselect all' : 'Select all'} title={selectedIds.size === filteredCompletedDownloads.length ? 'Deselect all' : 'Select all'}>
						<CheckSquareIcon checked={selectedIds.size === filteredCompletedDownloads.length} />
					</button>
					<button class="btn btn-sm btn-icon btn-accent" onclick={bulkPromote} disabled={bulkActing} aria-label="Move to library" title="Move to library">
						<FolderDownIcon />
					</button>
					<button class="btn btn-sm btn-icon btn-danger" onclick={bulkDelete} disabled={bulkActing} aria-label="Delete selected" title="Delete selected">
						<TrashIcon />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.page {
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
	}

	.downloads-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-xl);
		align-items: start;
		margin-bottom: var(--spacing-2xl);
	}

	.form-section { align-self: start; }
	.form-section h2 { margin-bottom: var(--spacing-lg); }
	.active-section { min-width: 0; }
	.active-section h2 { margin-bottom: var(--spacing-lg); }

	.downloads-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
		max-height: 70vh;
		overflow-y: auto;
	}

	.section { margin-bottom: var(--spacing-xl); width: 100%; }

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.section-header-left { display: flex; align-items: baseline; gap: var(--spacing-sm); }
	.section-header-right { display: flex; align-items: center; gap: var(--spacing-sm); }
	.section-header h2 { margin: 0; line-height: 1; }
	.section h2 { margin-bottom: var(--spacing-lg); }

	.select-btn {
		padding: var(--spacing-xs) var(--spacing-md);
		background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.select-btn:hover { color: var(--text-primary); border-color: rgba(255, 255, 255, 0.2); }
	.select-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); color: #fff; }

	.tabs { display: flex; gap: 4px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 4px; }
	.tab { padding: var(--spacing-sm) var(--spacing-xl); background: transparent; border: none; border-radius: var(--radius-md); color: var(--text-secondary); font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all var(--transition-fast); }
	.tab:hover:not(.active) { color: var(--text-primary); background: rgba(255, 255, 255, 0.05); }
	.tab.active { background: var(--accent-primary); color: #fff; font-weight: 600; }

	.completed-filter { margin-bottom: 0; background: var(--bg-tertiary); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); }
	.completed-filter .tab { padding: var(--spacing-xs) var(--spacing-md); font-size: 0.8rem; }

	.channel-dropdown { position: relative; }
	.channel-dropdown-trigger {
		display: flex; align-items: center; gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md); background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--border-radius-md);
		color: var(--text-primary); font-size: 0.8rem; cursor: pointer; white-space: nowrap;
		transition: border-color 0.15s;
	}
	.channel-dropdown-trigger:hover { border-color: rgba(255, 255, 255, 0.2); }
	.channel-dropdown-chevron { transition: transform 0.15s; }
	.channel-dropdown-chevron.open { transform: rotate(180deg); }
	.channel-dropdown-menu {
		position: absolute; top: calc(100% + 4px); right: 0; min-width: 220px;
		background: var(--bg-tertiary); border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--border-radius-md); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); z-index: 100; overflow: hidden;
	}
	.channel-dropdown-search {
		width: 100%; padding: var(--spacing-sm) var(--spacing-md); background: transparent;
		border: none; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		color: var(--text-primary); font-size: 0.85rem; outline: none;
	}
	.channel-dropdown-search::placeholder { color: var(--text-secondary); }
	.channel-dropdown-options { max-height: 200px; overflow-y: auto; padding: var(--spacing-xs) 0; }
	.channel-dropdown-option {
		display: block; width: 100%; padding: var(--spacing-xs) var(--spacing-md);
		background: transparent; border: none; color: var(--text-primary); font-size: 0.85rem;
		text-align: left; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}
	.channel-dropdown-option:hover { background: rgba(255, 255, 255, 0.06); }
	.channel-dropdown-option.selected { color: var(--accent-primary); }
	.channel-dropdown-empty { padding: var(--spacing-sm) var(--spacing-md); color: var(--text-secondary); font-size: 0.85rem; }
	.channel-dropdown-backdrop { position: fixed; inset: 0; z-index: 99; }
	.sort-dropdown { position: relative; }

	.downloads-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: var(--spacing-lg); width: 100%; }

	.downloads-list { display: flex; flex-direction: column; gap: var(--spacing-sm); width: 100%; }

	.bulk-bar {
		position: sticky; bottom: var(--spacing-lg); display: flex; align-items: center; justify-content: space-between;
		padding: var(--spacing-sm) var(--spacing-lg); background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--border-radius-md);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); margin-top: var(--spacing-lg); z-index: 50;
	}
	.bulk-count { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); }
	.bulk-actions { display: flex; gap: var(--spacing-sm); }

	.storage-row { display: flex; gap: var(--spacing-md); margin-bottom: var(--spacing-lg); }
	.storage-box {
		background: var(--bg-secondary); border: 1px solid var(--border);
		border-radius: var(--radius-lg); padding: var(--spacing-md) var(--spacing-lg); flex: 1; min-width: 0;
	}
	.storage-count { font-size: 0.75rem; color: var(--text-tertiary); }
	.cache-usage-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm); }
	.cache-usage-left { display: flex; align-items: center; gap: var(--spacing-xs); }
	.cache-usage-right { display: flex; align-items: center; gap: var(--spacing-sm); }
	.cache-usage-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); }
	.cache-usage-tooltip {
		display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;
		border-radius: 50%; background: var(--bg-tertiary); color: var(--text-tertiary);
		font-size: 0.625rem; font-weight: 700; cursor: help; border: 1px solid var(--border); position: relative;
	}
	.cache-usage-tooltip::after {
		content: attr(data-tooltip); position: absolute; bottom: calc(100% + 8px); left: 50%;
		transform: translateX(-50%); background: var(--bg-tertiary); color: var(--text-primary);
		border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 8px 12px;
		font-size: 0.75rem; font-weight: 400; line-height: 1.4; width: 260px; white-space: normal;
		pointer-events: none; opacity: 0; transition: opacity 0.15s ease; z-index: 10; box-shadow: var(--shadow-lg);
	}
	.cache-usage-tooltip:hover::after { opacity: 1; }
	.cache-usage-value { font-size: 0.8125rem; color: var(--text-secondary); }
	.cache-clear-btn {
		padding: 4px !important;
		font-size: 0 !important;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.cache-clear-btn svg { display: block; }

	:global(.btn-icon) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-sm) !important;
		line-height: 1;
	}

	:global(.btn-icon svg) {
		display: block;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
	.cache-clear-btn .spin { animation: spin 1s linear infinite; }
	.cache-usage-bar { height: 6px; background: var(--bg-tertiary); border-radius: var(--radius-sm); overflow: hidden; }
	.cache-usage-fill { height: 100%; background: var(--accent-primary); border-radius: var(--radius-sm); transition: width 0.3s ease; }
	.cache-usage-fill.warning { background: var(--warning); }
	.cache-usage-fill.critical { background: var(--error); }

	.empty-state { text-align: center; padding: var(--spacing-2xl); background: var(--bg-secondary); border: 1px dashed var(--border); border-radius: var(--radius-lg); }
	.empty-state p { margin-bottom: var(--spacing-sm); }

	.search-bar-section {
		margin-bottom: var(--spacing-xl);
		display: flex;
		gap: var(--spacing-md);
		flex-wrap: wrap;
		align-items: flex-start;
	}

	.search-bar-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 300px;
	}

	.search-icon {
		position: absolute;
		left: var(--spacing-lg);
		color: var(--text-tertiary);
		pointer-events: none;
		z-index: 1;
	}

	.search-input-main {
		width: 100%;
		padding: var(--spacing-md) var(--spacing-lg) var(--spacing-md) calc(var(--spacing-lg) + 28px);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		color: var(--text-primary);
		font-size: 1.0625rem;
		transition: border-color var(--transition-fast);
	}

	.search-input-main:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
	}

	.search-input-main::placeholder {
		color: var(--text-tertiary);
	}

	.search-clear-btn {
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
		z-index: 1;
	}

	.search-clear-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}

	.filter-dropdown { position: relative; }

	@media (max-width: 768px) {
		.page { padding: 0 var(--spacing-sm); }
		.storage-row { flex-direction: column; }
		.downloads-layout { grid-template-columns: 1fr; gap: var(--spacing-lg); }
		.downloads-grid { grid-template-columns: 1fr; }
		.search-bar-section { flex-direction: column; }
		.search-bar-wrapper { min-width: unset; }
		.search-input-main { font-size: 1rem; }
		.section-header { flex-direction: column; align-items: stretch; }
		.section-header-left { justify-content: space-between; }
		.section-header-right { flex-wrap: wrap; }
		.completed-filter { width: 100%; }
		.completed-filter .tab { flex: 1; text-align: center; }
		.channel-dropdown, .sort-dropdown { flex: 1; min-width: 0; }
		.channel-dropdown-trigger { width: 100%; justify-content: center; }
		.channel-dropdown-label { overflow: hidden; text-overflow: ellipsis; }
		.channel-dropdown-menu { left: 0; right: 0; min-width: unset; }
		.bulk-bar { flex-direction: column; gap: var(--spacing-sm); padding: var(--spacing-md); }
		.bulk-actions { width: 100%; flex-wrap: wrap; }
		.bulk-actions .btn { flex: 1; min-width: 0; }
	}
</style>
