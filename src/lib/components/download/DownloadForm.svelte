<script lang="ts">
	import { onMount } from 'svelte';

	let url = $state('');
	let selectedProfileId = $state('');
	let saveToLibrary = $state(false);
	let profiles = $state<any[]>([]);
	let loading = $state(false);
	let error = $state('');
	let libraryConfigured = $state(false);

	onMount(async () => {
		const [profilesRes, settingsRes] = await Promise.all([
			fetch('/api/profiles'),
			fetch('/api/settings'),
		]);
		if (profilesRes.ok) {
			profiles = await profilesRes.json();
			const defaultProfile = profiles.find((p) => p.isDefault);
			if (defaultProfile) {
				selectedProfileId = defaultProfile.id;
			}
		}
		if (settingsRes.ok) {
			const settings = await settingsRes.json();
			libraryConfigured = !!settings.libraryPath;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (!url || !selectedProfileId) {
			error = 'Please enter a URL and select a profile';
			return;
		}

		loading = true;

		try {
			const res = await fetch('/api/downloads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, profileId: selectedProfileId, saveToLibrary }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Failed to create download');
			}

			url = '';
			saveToLibrary = false;
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	// Get profile categories
	let videoProfiles = $derived(
		profiles.filter((p) => p.isSystem && !p.audioOnly).slice(0, 4)
	);
	let audioProfiles = $derived(
		profiles.filter((p) => p.isSystem && p.audioOnly).slice(0, 3)
	);
</script>

<div class="download-form">
	<form onsubmit={handleSubmit}>
		<div class="form-group">
			<label for="url">Video URL</label>
			<textarea
				id="url"
				bind:value={url}
				placeholder="Paste YouTube, TikTok, Twitter, or any supported URL..."
				rows="3"
				disabled={loading}
			></textarea>
		</div>

		<!-- Quick Profile Buttons -->
		<div class="profile-quick-select">
			<div class="profile-group">
				<span class="profile-group-label">Video</span>
				<div class="profile-buttons">
					{#each videoProfiles as profile}
						<button
							type="button"
							class="profile-btn"
							class:active={selectedProfileId === profile.id}
							onclick={() => (selectedProfileId = profile.id)}
							disabled={loading}
						>
							{profile.name}
						</button>
					{/each}
				</div>
			</div>

			<div class="profile-group">
				<span class="profile-group-label">Audio</span>
				<div class="profile-buttons">
					{#each audioProfiles as profile}
						<button
							type="button"
							class="profile-btn"
							class:active={selectedProfileId === profile.id}
							onclick={() => (selectedProfileId = profile.id)}
							disabled={loading}
						>
							{profile.name}
						</button>
					{/each}
				</div>
			</div>
		</div>

		{#if libraryConfigured}
			<label class="checkbox-label library-toggle">
				<input type="checkbox" bind:checked={saveToLibrary} disabled={loading} />
				Save to Library
			</label>
		{/if}

		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		<button type="submit" class="btn btn-primary btn-lg" disabled={loading}>
			{#if loading}
				Downloading...
			{:else}
				Download
			{/if}
		</button>
	</form>
</div>

<style>
	.download-form {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
	}

	.form-group {
		margin-bottom: var(--spacing-lg);
	}

	label {
		display: block;
		margin-bottom: var(--spacing-sm);
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.profile-quick-select {
		margin-bottom: var(--spacing-lg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.profile-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.profile-group-label {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.profile-buttons {
		display: flex;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.profile-btn {
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.profile-btn:hover:not(:disabled) {
		background: var(--bg-hover);
		border-color: var(--accent-dim);
	}

	.profile-btn.active {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: white;
	}

	.profile-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-lg);
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.checkbox-label input {
		width: auto;
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid var(--error);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		color: var(--error);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-md);
	}

	button[type='submit'] {
		width: 100%;
	}

	@media (max-width: 768px) {
		.download-form {
			padding: var(--spacing-md);
		}

		.profile-buttons {
			gap: var(--spacing-xs);
		}

		.profile-btn {
			flex: 1;
			min-width: 0;
			padding: var(--spacing-sm);
			font-size: 0.8125rem;
		}
	}
</style>
