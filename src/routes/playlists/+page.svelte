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
					<button
						class="content-card"
						onclick={() => goto(`/playlists/${playlist.id}`)}
					>
						<div class="card-header">
							<h3>{playlist.name}</h3>
							<span class="item-count">{playlist.itemCount} item{playlist.itemCount !== 1 ? 's' : ''}</span>
						</div>
						{#if playlist.description}
							<p class="card-description">{playlist.description}</p>
						{/if}
						<p class="card-date text-muted">Created {formatDate(playlist.createdAt)}</p>
					</button>
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
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--spacing-lg);
		width: 100%;
	}

	.content-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		transition: all var(--transition-normal);
		cursor: pointer;
		text-align: left;
		width: 100%;
		color: inherit;
		font: inherit;
	}

	.content-card:hover {
		border-color: var(--border-light);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
	}

	.card-header h3 {
		font-size: 1rem;
		flex: 1;
	}

	.item-count {
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		background: rgba(99, 102, 241, 0.15);
		color: var(--accent-primary);
		white-space: nowrap;
	}

	.card-description {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-bottom: var(--spacing-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-date {
		font-size: 0.75rem;
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
	}
</style>
