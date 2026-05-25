<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { addToast } from '$lib/stores/toast.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	let playlists = $state<any[]>([]);
	let loading = $state(true);

	let showCreateForm = $state(false);
	let formName = $state('');
	let formDescription = $state('');
	let formError = $state('');
	let creating = $state(false);

	onMount(() => {
		loadPlaylists();
	});

	async function loadPlaylists() {
		loading = true;
		try {
			const res = await fetch('/api/playlists');
			if (res.ok) {
				playlists = await res.json();
			}
		} catch (e) {
			console.error('Failed to load playlists:', e);
		} finally {
			loading = false;
		}
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		formError = '';
		creating = true;

		try {
			const res = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: formName, description: formDescription || undefined }),
			});

			if (res.ok) {
				formName = '';
				formDescription = '';
				showCreateForm = false;
				addToast('success', 'Playlist created');
				await loadPlaylists();
			} else {
				const data = await res.json().catch(() => null);
				formError = data?.message || `Failed to create playlist (${res.status})`;
			}
		} catch {
			formError = 'Failed to create playlist';
		} finally {
			creating = false;
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
	<title>Playlists - wytui</title>
</svelte:head>

<div class="page">
	<div class="page-content">
		<div class="page-header">
			<div>
				<h2>Playlists</h2>
				<p class="text-muted">Organize your downloads into playlists</p>
			</div>
			<button class="btn btn-primary" onclick={() => (showCreateForm = !showCreateForm)}>
				{showCreateForm ? 'Cancel' : 'Create Playlist'}
			</button>
		</div>

		{#if showCreateForm}
			<form class="form-card" onsubmit={handleCreate}>
				<div class="form-group">
					<label for="playlist-name">Name</label>
					<input
						type="text"
						id="playlist-name"
						bind:value={formName}
						required
						placeholder="My Playlist"
					/>
				</div>
				<div class="form-group">
					<label for="playlist-desc">Description (optional)</label>
					<input
						type="text"
						id="playlist-desc"
						bind:value={formDescription}
						placeholder="A collection of..."
					/>
				</div>
				{#if formError}
					<p class="form-error">{formError}</p>
				{/if}
				<button type="submit" class="btn btn-primary" disabled={creating}>
					{creating ? 'Creating...' : 'Create'}
				</button>
			</form>
		{/if}

		{#if loading}
			<Skeleton count={4} variant="card" />
		{:else if playlists.length === 0}
			<div class="empty-state">
				<p>No playlists yet</p>
				<p class="text-muted">Create a playlist to organize your downloads</p>
			</div>
		{:else}
			<div class="content-grid">
				{#each playlists as playlist}
					<div class="content-card">
						<button class="card-main" onclick={() => goto(`/playlists/${playlist.id}`)}>
							<div class="card-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M3 12h18M3 6h18M3 18h18" />
								</svg>
								<span class="icon-count">{playlist.itemCount}</span>
							</div>
							<div class="card-content">
								<h3 class="card-title">{playlist.name}</h3>
								{#if playlist.description}
									<p class="card-description">{playlist.description}</p>
								{:else}
									<p class="card-description empty">No description</p>
								{/if}
								<div class="card-footer">
									<span class="card-meta">Created {formatDate(playlist.createdAt)}</span>
									{#if playlist.updatedAt && playlist.updatedAt !== playlist.createdAt}
										<span class="card-meta">• Updated {formatDate(playlist.updatedAt)}</span>
									{/if}
								</div>
							</div>
						</button>
						<div class="card-actions">
							<button class="action-btn" onclick={(e) => { e.stopPropagation(); /* TODO: edit */ }} title="Edit playlist">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
							</button>
							<button class="action-btn danger" onclick={(e) => { e.stopPropagation(); /* TODO: delete */ }} title="Delete playlist">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
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

	.page-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2xl);
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--spacing-lg);
	}

	.page-header h2 {
		margin-bottom: var(--spacing-xs);
	}

	.page-header p {
		margin-top: var(--spacing-xs);
	}

	.form-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		margin-bottom: var(--spacing-xl);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		margin-bottom: var(--spacing-lg);
	}

	label {
		margin-bottom: var(--spacing-sm);
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.form-error {
		color: var(--error, #ef4444);
		font-size: 0.85rem;
		margin: var(--spacing-xs) 0 var(--spacing-md);
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

	.content-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: var(--spacing-lg);
		width: 100%;
	}

	.content-card {
		position: relative;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		transition: all var(--transition-normal);
	}

	.content-card:hover {
		border-color: var(--accent-dim);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
	}

	.content-card:hover .card-actions {
		opacity: 1;
		pointer-events: all;
	}

	.card-main {
		display: flex;
		gap: var(--spacing-lg);
		padding: var(--spacing-lg);
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font: inherit;
		transition: background var(--transition-fast);
	}

	.card-main:hover {
		background: var(--bg-hover);
	}

	.card-icon {
		position: relative;
		flex-shrink: 0;
		width: 56px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
		border-radius: var(--radius-md);
		color: var(--accent-primary);
	}

	.icon-count {
		position: absolute;
		bottom: -4px;
		right: -4px;
		min-width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 6px;
		background: var(--accent-primary);
		color: white;
		font-size: 0.6875rem;
		font-weight: 700;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.card-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.card-title {
		font-size: 1.0625rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-description {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		margin: 0;
	}

	.card-description.empty {
		color: var(--text-tertiary);
		font-style: italic;
	}

	.card-footer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		margin-top: auto;
		padding-top: var(--spacing-xs);
	}

	.card-meta {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-weight: 500;
	}

	.card-actions {
		position: absolute;
		top: var(--spacing-sm);
		right: var(--spacing-sm);
		display: flex;
		gap: var(--spacing-xs);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--transition-fast);
	}

	.action-btn {
		width: 32px;
		height: 32px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.action-btn:hover {
		background: var(--bg-elevated);
		border-color: var(--accent-primary);
		color: var(--accent-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		transform: scale(1.05);
	}

	.action-btn.danger:hover {
		border-color: var(--error);
		color: var(--error);
	}

	@media (max-width: 768px) {
		.page {
			padding: 0 var(--spacing-sm);
		}

		.page-header {
			flex-direction: column;
			gap: var(--spacing-md);
		}

		.page-header .btn {
			width: 100%;
		}

		.content-grid {
			grid-template-columns: 1fr;
		}

		.form-card {
			padding: var(--spacing-md);
		}

		.card-main {
			padding: var(--spacing-md);
			gap: var(--spacing-md);
		}

		.card-icon {
			width: 48px;
			height: 48px;
		}

		.card-title {
			font-size: 1rem;
		}

		.card-actions {
			opacity: 1;
			pointer-events: all;
		}
	}
</style>
