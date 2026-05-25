<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { showConfirm } from '$lib/stores/modal.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import { formatDuration, formatBytes } from '$lib/utils/format';

	let playlist = $state<any>(null);
	let loading = $state(true);
	let loadError = $state('');

	let editing = $state(false);
	let editName = $state('');
	let editDescription = $state('');
	let saving = $state(false);
	let deleting = $state(false);

	let playlistId = $derived($page.params.id);

	onMount(() => {
		loadPlaylist();
	});

	async function loadPlaylist() {
		loading = true;
		loadError = '';
		try {
			const res = await fetch(`/api/playlists/${playlistId}`);
			if (res.ok) {
				playlist = await res.json();
			} else if (res.status === 404) {
				loadError = 'Playlist not found';
			} else {
				loadError = 'Failed to load playlist';
			}
		} catch {
			loadError = 'Failed to load playlist';
		} finally {
			loading = false;
		}
	}

	function startEdit() {
		editName = playlist.name;
		editDescription = playlist.description || '';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	async function saveEdit() {
		saving = true;
		try {
			const res = await fetch(`/api/playlists/${playlistId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: editName, description: editDescription || null }),
			});
			if (res.ok) {
				playlist.name = editName;
				playlist.description = editDescription || null;
				editing = false;
				addToast('success', 'Playlist updated');
			} else {
				const data = await res.json().catch(() => null);
				addToast('error', data?.message || 'Failed to update playlist');
			}
		} catch {
			addToast('error', 'Failed to update playlist');
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		const confirmed = await showConfirm(
			'Delete Playlist',
			`Delete "${playlist.name}"? This cannot be undone.`,
			'Delete'
		);
		if (!confirmed) return;

		deleting = true;
		try {
			const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
			if (res.ok) {
				addToast('success', 'Playlist deleted');
				goto('/playlists');
			} else {
				addToast('error', 'Failed to delete playlist');
			}
		} catch {
			addToast('error', 'Failed to delete playlist');
		} finally {
			deleting = false;
		}
	}

	async function removeItem(downloadId: string, title: string) {
		const confirmed = await showConfirm(
			'Remove Item',
			`Remove "${title || 'this item'}" from the playlist?`,
			'Remove'
		);
		if (!confirmed) return;

		try {
			const res = await fetch(`/api/playlists/${playlistId}/items`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ downloadId }),
			});
			if (res.ok) {
				playlist.items = playlist.items.filter((item: any) => item.downloadId !== downloadId);
				addToast('success', 'Item removed');
			} else {
				addToast('error', 'Failed to remove item');
			}
		} catch {
			addToast('error', 'Failed to remove item');
		}
	}

	function formatDate(date: string | Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
</script>

<svelte:head>
	<title>{playlist?.name || 'Playlist'} - wytui</title>
</svelte:head>

<div class="page">
	<a href="/playlists" class="back-link">Back to Playlists</a>

	{#if loading}
		<div class="loading">Loading playlist...</div>
	{:else if loadError}
		<div class="empty-state">
			<p>{loadError}</p>
		</div>
	{:else if playlist}
		<div class="playlist-header">
			{#if editing}
				<div class="edit-form">
					<div class="form-group">
						<label for="edit-name">Name</label>
						<input type="text" id="edit-name" bind:value={editName} required />
					</div>
					<div class="form-group">
						<label for="edit-desc">Description</label>
						<input type="text" id="edit-desc" bind:value={editDescription} placeholder="Optional description" />
					</div>
					<div class="edit-actions">
						<button class="btn btn-sm btn-primary" onclick={saveEdit} disabled={saving}>
							{saving ? 'Saving...' : 'Save'}
						</button>
						<button class="btn btn-sm btn-secondary" onclick={cancelEdit}>Cancel</button>
					</div>
				</div>
			{:else}
				<div class="header-info">
					<h2>{playlist.name}</h2>
					{#if playlist.description}
						<p class="text-muted">{playlist.description}</p>
					{/if}
					<p class="meta">
						{playlist.items.length} item{playlist.items.length !== 1 ? 's' : ''} · Created {formatDate(playlist.createdAt)}
					</p>
				</div>
				<div class="header-actions">
					<button class="btn btn-sm btn-secondary" onclick={startEdit}>Edit</button>
					<button class="btn btn-sm btn-danger" onclick={handleDelete} disabled={deleting}>
						{deleting ? 'Deleting...' : 'Delete'}
					</button>
				</div>
			{/if}
		</div>

		{#if playlist.items.length === 0}
			<div class="empty-state">
				<p>This playlist is empty</p>
				<p class="text-muted">Add downloads to this playlist from the downloads page</p>
			</div>
		{:else}
			<div class="items-list">
				{#each playlist.items as item, index}
					<div class="item-card">
						<span class="item-position">{index + 1}</span>
						<button
							class="item-content"
							onclick={() => goto(`/downloads/${item.downloadId}`)}
						>
							{#if item.download.thumbnail}
								<img
									class="item-thumbnail"
									src={item.download.thumbnail}
									alt={item.download.title || 'Thumbnail'}
								/>
							{:else}
								<div class="item-thumbnail placeholder-thumb"></div>
							{/if}
							<div class="item-info">
								<h4>{item.download.title || 'Untitled'}</h4>
								<div class="item-meta">
									{#if item.download.uploader}
										<span>{item.download.uploader}</span>
									{/if}
									{#if item.download.duration}
										<span>{formatDuration(item.download.duration)}</span>
									{/if}
									{#if item.download.filesize}
										<span>{formatBytes(item.download.filesize)}</span>
									{/if}
								</div>
							</div>
						</button>
						<button
							class="btn btn-sm btn-danger remove-btn"
							onclick={() => removeItem(item.downloadId, item.download.title)}
							title="Remove from playlist"
						>
							Remove
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 1000px;
		margin: 0 auto;
		width: 100%;
	}

	.back-link {
		display: inline-block;
		color: var(--accent-primary);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-lg);
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.loading {
		text-align: center;
		padding: var(--spacing-2xl);
		color: var(--text-secondary);
	}

	.empty-state {
		text-align: center;
		padding: var(--spacing-2xl);
		background: var(--bg-secondary);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
	}

	.empty-state p {
		margin-bottom: var(--spacing-sm);
	}

	.playlist-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-lg);
		border-bottom: 1px solid var(--border);
	}

	.header-info h2 {
		margin-bottom: var(--spacing-xs);
	}

	.header-info .text-muted {
		margin-bottom: var(--spacing-sm);
	}

	.meta {
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.header-actions {
		display: flex;
		gap: var(--spacing-sm);
		flex-shrink: 0;
	}

	.edit-form {
		width: 100%;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		margin-bottom: var(--spacing-md);
	}

	label {
		margin-bottom: var(--spacing-sm);
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.edit-actions {
		display: flex;
		gap: var(--spacing-sm);
	}

	.items-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.item-card {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-md);
		transition: all var(--transition-normal);
	}

	.item-card:hover {
		border-color: var(--border-light);
	}

	.item-position {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
		min-width: 1.5rem;
		text-align: center;
		flex-shrink: 0;
	}

	.item-content {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		flex: 1;
		min-width: 0;
		cursor: pointer;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		text-align: left;
		padding: 0;
	}

	.item-content:hover h4 {
		color: var(--accent-primary);
	}

	.item-thumbnail {
		width: 80px;
		height: 45px;
		border-radius: var(--radius-sm);
		object-fit: cover;
		flex-shrink: 0;
	}

	.placeholder-thumb {
		background: var(--bg-tertiary);
	}

	.item-info {
		flex: 1;
		min-width: 0;
	}

	.item-info h4 {
		font-size: 0.9375rem;
		margin-bottom: var(--spacing-xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: color var(--transition-fast);
	}

	.item-meta {
		display: flex;
		gap: var(--spacing-md);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.remove-btn {
		flex-shrink: 0;
	}

	@media (max-width: 768px) {
		.page {
			padding: 0 var(--spacing-sm);
		}

		.playlist-header {
			flex-direction: column;
		}

		.header-actions {
			width: 100%;
		}

		.header-actions .btn {
			flex: 1;
		}

		.item-card {
			padding: var(--spacing-sm);
		}

		.item-thumbnail {
			width: 60px;
			height: 34px;
		}

		.item-meta {
			flex-wrap: wrap;
			gap: var(--spacing-sm);
		}

		.item-info h4 {
			font-size: 0.875rem;
		}
	}
</style>
