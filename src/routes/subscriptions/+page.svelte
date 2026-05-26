<script lang="ts">
	import { onMount } from 'svelte';
	import { onSSEEvent } from '$lib/stores/sse.svelte';
	import { showConfirm } from '$lib/stores/modal.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import CheckIcon from '$lib/components/icons/CheckIcon.svelte';
	import XIcon from '$lib/components/icons/XIcon.svelte';

	// Shared state
	let profiles = $state<any[]>([]);
	let libraryConfigured = $state(false);

	// Subscriptions state
	let subscriptions = $state<any[]>([]);
	let subsLoading = $state(false);
	let checkingNow = $state<Set<string>>(new Set());
	let checkResult = $state<{ id: string; message: string } | null>(null);
	let showSubsForm = $state(false);
	let subFormUrl = $state('');
	let subFormProfileId = $state('');
	let subFormCheckInterval = $state(1800);
	let subFormAutoDownload = $state(true);
	let subFormSaveToLibrary = $state(false);
	let subFormOptions = $state({ sponsorblock: false, subtitles: false, metadata: false });

	// Subscription edit state
	let editingSub = $state<any | null>(null);
	let editSubName = $state('');
	let editSubUrl = $state('');
	let editSubProfileId = $state('');
	let editSubCheckInterval = $state(1800);
	let editSubAutoDownload = $state(true);
	let editSubSaveToLibrary = $state(false);
	let editSubOptions = $state({ sponsorblock: false, subtitles: false, metadata: false });

	// Subscription backfill state
	let backfillDate = $state('');
	let showBackfillMenu = $state<string | null>(null);

	// Form error state
	let subFormError = $state('');

	function buildOptionsFlags(opts: { sponsorblock: boolean; subtitles: boolean; metadata: boolean }, saveToLibrary = false): string[] {
		const flags: string[] = [];
		if (opts.sponsorblock) flags.push('--sponsorblock-remove', 'sponsor,selfpromo');
		if (opts.subtitles) flags.push('--write-subs', '--write-auto-subs', '--embed-subs', '--sub-langs', 'en');
		if (opts.metadata) flags.push('--embed-metadata', '--embed-chapters');
		if (saveToLibrary) flags.push('--write-thumbnail');
		return flags;
	}

	function parseOptionsFromFlags(flags: string[]): { sponsorblock: boolean; subtitles: boolean; metadata: boolean } {
		return {
			sponsorblock: flags.includes('--sponsorblock-remove'),
			subtitles: flags.includes('--write-subs') || flags.includes('--write-auto-subs'),
			metadata: flags.includes('--embed-metadata'),
		};
	}

	function formatInterval(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
		return `${Math.floor(seconds / 86400)}d`;
	}

	function formatRelativeTime(date: string | Date): string {
		const ms = Date.now() - new Date(date).getTime();
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `${days}d ago`;
		const months = Math.floor(days / 30);
		return `${months}mo ago`;
	}

	onMount(() => {
		loadProfiles();
		loadSubscriptions();

		const unsubChecked = onSSEEvent('subscription:checked', ({ id, name, newVideos }) => {
			const message =
				newVideos > 0
					? `Found ${newVideos} new video${newVideos > 1 ? 's' : ''} for ${name}`
					: `No new videos for ${name}`;
			checkResult = { id, message };
			setTimeout(() => {
				if (checkResult?.id === id) checkResult = null;
			}, 5000);
			loadSubscriptions();
		});
		const unsubBackfill = onSSEEvent('subscription:backfill', ({ name, totalVideos, newVideos }) => {
			addToast('success', `Queued ${newVideos} new video${newVideos !== 1 ? 's' : ''} from ${name} (${totalVideos} total found)`);
		});

		return () => {
			unsubChecked();
			unsubBackfill();
		};
	});

	async function loadProfiles() {
		try {
			const [profilesRes, settingsRes] = await Promise.all([
				fetch('/api/profiles'),
				fetch('/api/settings'),
			]);
			if (profilesRes.ok) {
				profiles = await profilesRes.json();
				const defaultProfile = profiles.find((p) => p.isDefault);
				if (defaultProfile) {
					subFormProfileId = defaultProfile.id;
				}
			}
			if (settingsRes.ok) {
				const settings = await settingsRes.json();
				libraryConfigured = !!settings.libraryPath;
				if (libraryConfigured) {
					subFormSaveToLibrary = true;
				}
			}
		} catch (e) {
			console.error('Failed to load profiles:', e);
		}
	}

	async function loadSubscriptions() {
		subsLoading = true;
		try {
			const res = await fetch('/api/subscriptions');
			if (res.ok) {
				subscriptions = await res.json();
			}
		} catch (e) {
			console.error('Failed to load subscriptions:', e);
		} finally {
			subsLoading = false;
		}
	}

	async function handleSubsSubmit(e: Event) {
		e.preventDefault();
		subFormError = '';
		try {
			const res = await fetch('/api/subscriptions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: subFormUrl,
					name: subFormUrl,
					type: 'CHANNEL',
					profileId: subFormProfileId,
					checkInterval: subFormCheckInterval,
					autoDownload: subFormAutoDownload,
					saveToLibrary: subFormSaveToLibrary,
					customFlags: buildOptionsFlags(subFormOptions, subFormSaveToLibrary),
				}),
			});

			if (res.ok) {
				subFormUrl = '';
				subFormSaveToLibrary = libraryConfigured;
				subFormOptions = { sponsorblock: false, subtitles: false, metadata: false };
				showSubsForm = false;
				await loadSubscriptions();
			} else {
				const data = await res.json().catch(() => null);
				subFormError = data?.message || `Failed to create subscription (${res.status})`;
			}
		} catch (e) {
			subFormError = 'Failed to create subscription';
		}
	}

	async function toggleSubscription(id: string, enabled: boolean) {
		try {
			await fetch(`/api/subscriptions/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: !enabled }),
			});
			await loadSubscriptions();
		} catch (e) {
			console.error('Failed to toggle subscription:', e);
		}
	}

	async function deleteSubscription(id: string) {
		const confirmed = await showConfirm(
			'Delete Subscription',
			'Are you sure you want to delete this subscription?',
			'Delete'
		);
		if (!confirmed) return;

		try {
			await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
			await loadSubscriptions();
		} catch (e) {
			console.error('Failed to delete subscription:', e);
		}
	}

	async function checkNow(id: string) {
		if (checkingNow.has(id)) return;
		checkingNow = new Set([...checkingNow, id]);
		try {
			await fetch(`/api/subscriptions/${id}/check`, { method: 'POST' });
		} catch (e) {
			console.error('Failed to check subscription:', e);
		} finally {
			checkingNow = new Set([...checkingNow].filter((x) => x !== id));
		}
	}

	function startEditSub(sub: any) {
		editingSub = sub;
		editSubName = sub.name;
		editSubUrl = sub.url;
		editSubProfileId = sub.profileId;
		editSubCheckInterval = sub.checkInterval;
		editSubAutoDownload = sub.autoDownload;
		editSubSaveToLibrary = sub.saveToLibrary;
		editSubOptions = parseOptionsFromFlags(sub.customFlags || []);
	}

	function cancelEditSub() {
		editingSub = null;
	}

	async function saveEditSub() {
		if (!editingSub) return;
		try {
			const res = await fetch(`/api/subscriptions/${editingSub.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editSubName,
					url: editSubUrl,
					profileId: editSubProfileId,
					checkInterval: editSubCheckInterval,
					autoDownload: editSubAutoDownload,
					saveToLibrary: editSubSaveToLibrary,
					customFlags: buildOptionsFlags(editSubOptions, editSubSaveToLibrary),
				}),
			});
			if (res.ok) {
				editingSub = null;
				await loadSubscriptions();
			}
		} catch (e) {
			console.error('Failed to update subscription:', e);
		}
	}

	async function backfillFromDate(id: string) {
		if (!backfillDate) return;
		try {
			await fetch(`/api/subscriptions/${id}/backfill`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dateAfter: backfillDate }),
			});
			backfillDate = '';
			showBackfillMenu = null;
		} catch (e) {
			console.error('Failed to backfill:', e);
		}
	}

	async function backfillAll(id: string) {
		const confirmed = await showConfirm(
			'Download All Videos',
			'This will download every video from this channel that hasn\'t been downloaded before. This could queue a large number of downloads.',
			'Download All'
		);
		if (!confirmed) return;
		try {
			await fetch(`/api/subscriptions/${id}/backfill`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});
			showBackfillMenu = null;
		} catch (e) {
			console.error('Failed to backfill:', e);
		}
	}
</script>

<svelte:head>
	<title>Subscriptions - wytui</title>
</svelte:head>

<div class="page">
	<div class="tab-content">
		<div class="tab-header">
			<div>
				<h2>Subscriptions</h2>
				<p class="text-muted">Monitor channels and auto-download new videos</p>
			</div>
			<button class="btn btn-primary" onclick={() => (showSubsForm = !showSubsForm)}>
				{showSubsForm ? 'Cancel' : 'Add Subscription'}
			</button>
		</div>

		{#if showSubsForm}
			<form class="form-card" onsubmit={handleSubsSubmit}>
				<div class="form-row">
					<div class="form-group">
						<label for="sub-url">Channel/Playlist URL</label>
						<input type="url" id="sub-url" bind:value={subFormUrl} required placeholder="https://www.youtube.com/@channel" />
					</div>
					<div class="form-group">
						<label for="sub-profile">Download Profile</label>
						<select id="sub-profile" bind:value={subFormProfileId} required>
							{#each profiles as profile}
								<option value={profile.id}>{profile.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="form-group">
					<label for="sub-interval">Check Interval</label>
					<select id="sub-interval" bind:value={subFormCheckInterval}>
						<option value={900}>Every 15 minutes</option>
						<option value={1800}>Every 30 minutes</option>
						<option value={3600}>Every hour</option>
						<option value={21600}>Every 6 hours</option>
						<option value={43200}>Every 12 hours</option>
						<option value={86400}>Every 24 hours</option>
					</select>
				</div>

				<div class="checkbox-row">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={subFormAutoDownload} />
						Auto-download new videos
					</label>
					{#if libraryConfigured}
						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={subFormSaveToLibrary}
								onchange={() => {
									if (subFormSaveToLibrary) {
										subFormOptions = { sponsorblock: true, subtitles: true, metadata: true };
									}
								}}
							/>
							Save to Library
						</label>
					{/if}
				</div>

				<div class="options-row">
					<span class="options-label">Options</span>
					<div class="options-chips">
						<button type="button" class="option-chip" class:active={subFormOptions.sponsorblock} onclick={() => subFormOptions.sponsorblock = !subFormOptions.sponsorblock}>SponsorBlock</button>
						<button type="button" class="option-chip" class:active={subFormOptions.subtitles} onclick={() => subFormOptions.subtitles = !subFormOptions.subtitles}>Subtitles</button>
						<button type="button" class="option-chip" class:active={subFormOptions.metadata} onclick={() => subFormOptions.metadata = !subFormOptions.metadata}>Metadata</button>
					</div>
				</div>

				{#if subFormError}
					<p class="form-error">{subFormError}</p>
				{/if}
				<button type="submit" class="btn btn-primary">Create Subscription</button>
			</form>
		{/if}

		{#if subsLoading}
			<Skeleton count={4} variant="card" />
		{:else if subscriptions.length === 0}
			<div class="empty-state">
				<p>No subscriptions yet</p>
				<p class="text-muted">Add a channel to start monitoring for new videos</p>
			</div>
		{:else}
			<div class="content-grid">
				{#each subscriptions as sub}
					<div class="content-card">
						{#if editingSub?.id === sub.id}
							<div class="edit-form">
								<div class="form-row">
									<div class="form-group">
										<label>Name</label>
										<input type="text" bind:value={editSubName} />
									</div>
									<div class="form-group">
										<label>URL</label>
										<input type="url" bind:value={editSubUrl} />
									</div>
								</div>
								<div class="form-row">
									<div class="form-group">
										<label>Profile</label>
										<select bind:value={editSubProfileId}>
											{#each profiles as profile}
												<option value={profile.id}>{profile.name}</option>
											{/each}
										</select>
									</div>
									<div class="form-group">
										<label>Check Interval</label>
										<select bind:value={editSubCheckInterval}>
											<option value={900}>Every 15 minutes</option>
											<option value={1800}>Every 30 minutes</option>
											<option value={3600}>Every hour</option>
											<option value={21600}>Every 6 hours</option>
											<option value={43200}>Every 12 hours</option>
											<option value={86400}>Every 24 hours</option>
										</select>
									</div>
								</div>
								<div class="checkbox-row">
									<label class="checkbox-label">
										<input type="checkbox" bind:checked={editSubAutoDownload} />
										Auto-download
									</label>
									{#if libraryConfigured}
										<label class="checkbox-label">
											<input
												type="checkbox"
												bind:checked={editSubSaveToLibrary}
												onchange={() => {
													if (editSubSaveToLibrary) {
														editSubOptions = { sponsorblock: true, subtitles: true, metadata: true };
													}
												}}
											/>
											Save to Library
										</label>
									{/if}
								</div>
								<div class="options-row">
									<span class="options-label">Options</span>
									<div class="options-chips">
										<button type="button" class="option-chip" class:active={editSubOptions.sponsorblock} onclick={() => editSubOptions.sponsorblock = !editSubOptions.sponsorblock}>SponsorBlock</button>
										<button type="button" class="option-chip" class:active={editSubOptions.subtitles} onclick={() => editSubOptions.subtitles = !editSubOptions.subtitles}>Subtitles</button>
										<button type="button" class="option-chip" class:active={editSubOptions.metadata} onclick={() => editSubOptions.metadata = !editSubOptions.metadata}>Metadata</button>
									</div>
								</div>
								<div class="actions">
									<button class="btn btn-sm btn-primary btn-icon" onclick={saveEditSub} aria-label="Save" title="Save">
										<CheckIcon />
									</button>
									<button class="btn btn-sm btn-secondary btn-icon" onclick={cancelEditSub} aria-label="Cancel" title="Cancel">
										<XIcon />
									</button>
								</div>
							</div>
						{:else}
							<div class="card-header">
								<h3>{sub.name}</h3>
								<span class="status" class:enabled={sub.enabled}>
									{sub.enabled ? 'Active' : 'Paused'}
								</span>
							</div>

							<p class="url">{sub.url}</p>

							<div class="meta">
								<span>Profile: {sub.profile.name}</span>
								<span>Check: {formatInterval(sub.checkInterval)}</span>
								{#if sub.videoCount}
									<span>{sub.videoCount} video{sub.videoCount !== 1 ? 's' : ''}</span>
								{/if}
								{#if sub.saveToLibrary}
									<span class="library-tag">Library</span>
								{/if}
								{#if sub.customFlags?.includes('--sponsorblock-remove')}
									<span class="option-tag">SB</span>
								{/if}
								{#if sub.customFlags?.includes('--write-subs')}
									<span class="option-tag">Subs</span>
								{/if}
								{#if sub.customFlags?.includes('--embed-metadata')}
									<span class="option-tag">Meta</span>
								{/if}
							</div>

							{#if sub.lastChecked || sub.lastVideoDate}
								<p class="text-muted text-sm">
									{#if sub.lastChecked}Last checked: {new Date(sub.lastChecked).toLocaleString()}{/if}
									{#if sub.lastChecked && sub.lastVideoDate} · {/if}
									{#if sub.lastVideoDate}Latest video: {formatRelativeTime(sub.lastVideoDate)}{/if}
								</p>
							{/if}

							{#if checkResult && checkResult.id === sub.id}
								<p class="check-result">{checkResult.message}</p>
							{/if}

							<div class="actions">
								<button
									class="btn btn-sm btn-icon btn-primary"
									onclick={() => checkNow(sub.id)}
									disabled={checkingNow.has(sub.id)}
									aria-label="Check now"
									title="Check now"
								>
									{#if checkingNow.has(sub.id)}
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
									{/if}
								</button>
								<button class="btn btn-sm btn-icon btn-secondary" onclick={() => startEditSub(sub)} aria-label="Edit" title="Edit">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
								</button>
								<button
									class="btn btn-sm btn-icon btn-secondary"
									onclick={() => toggleSubscription(sub.id, sub.enabled)}
									aria-label={sub.enabled ? 'Pause' : 'Resume'}
									title={sub.enabled ? 'Pause' : 'Resume'}
								>
									{#if sub.enabled}
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
									{/if}
								</button>
								<button
									class="btn btn-sm btn-icon btn-secondary"
									onclick={() => (showBackfillMenu = showBackfillMenu === sub.id ? null : sub.id)}
									aria-label={showBackfillMenu === sub.id ? 'Close backfill' : 'Backfill'}
									title={showBackfillMenu === sub.id ? 'Close backfill' : 'Backfill'}
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
								</button>
								<button class="btn btn-sm btn-icon btn-danger" onclick={() => deleteSubscription(sub.id)} aria-label="Delete" title="Delete">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
								</button>
							</div>

							{#if showBackfillMenu === sub.id}
								<div class="backfill-menu">
									<div class="backfill-option">
										<label for="backfill-date-{sub.id}">Download videos uploaded after:</label>
										<div class="backfill-date-row">
											<input type="date" id="backfill-date-{sub.id}" bind:value={backfillDate} />
											<button
												class="btn btn-sm btn-primary"
												disabled={!backfillDate}
												onclick={() => backfillFromDate(sub.id)}
											>
												Go
											</button>
										</div>
									</div>
									<div class="backfill-divider"></div>
									<button
										class="btn btn-sm btn-primary"
										style="width: 100%;"
										onclick={() => backfillAll(sub.id)}
									>
										Download Entire Channel
									</button>
								</div>
							{/if}
						{/if}
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

	.tab-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2xl);
	}

	.tab-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--spacing-lg);
	}

	.tab-header h2 {
		margin-bottom: var(--spacing-xs);
	}

	.tab-header p {
		margin-top: var(--spacing-xs);
	}

	.form-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		margin-bottom: var(--spacing-xl);
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	label {
		margin-bottom: var(--spacing-sm);
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-lg);
	}

	.checkbox-label input {
		width: auto;
	}

	.checkbox-row {
		display: flex;
		gap: var(--spacing-xl);
		margin-bottom: var(--spacing-lg);
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
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: var(--spacing-lg);
		width: 100%;
	}

	.content-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		transition: all var(--transition-normal);
	}

	.content-card:hover {
		border-color: var(--border-light);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.edit-form .form-row {
		margin-bottom: 0;
	}

	.edit-form .form-group {
		margin-bottom: 0;
	}

	.edit-form .checkbox-row {
		margin-bottom: 0;
	}

	.edit-form .checkbox-label {
		margin-bottom: 0;
	}

	.edit-form .actions {
		margin-top: 0;
	}

	.backfill-menu {
		margin-top: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.backfill-option label {
		display: block;
		margin-bottom: var(--spacing-sm);
		font-size: 0.8125rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.backfill-date-row {
		display: flex;
		gap: var(--spacing-sm);
		align-items: center;
	}

	.backfill-date-row input[type='date'] {
		flex: 1;
	}

	.backfill-divider {
		height: 1px;
		background: var(--border);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-md);
	}

	.card-header h3 {
		font-size: 1rem;
		flex: 1;
	}

	.status {
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.status.enabled {
		background: rgba(16, 185, 129, 0.1);
		color: var(--success);
	}

	.url {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-bottom: var(--spacing-md);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-md);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.check-result {
		font-size: 0.85rem;
		color: var(--accent-primary);
		margin: var(--spacing-xs) 0 0;
	}

	.form-error {
		color: var(--error, #ef4444);
		font-size: 0.85rem;
		margin: var(--spacing-xs) 0;
	}

	.library-tag {
		background: rgba(16, 185, 129, 0.15);
		color: var(--success);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		font-weight: 600;
	}

	.option-tag {
		background: rgba(99, 102, 241, 0.15);
		color: var(--accent-primary);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.options-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
	}

	.options-label {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}

	.options-chips {
		display: flex;
		gap: var(--spacing-xs);
		flex-wrap: wrap;
	}

	.option-chip {
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.option-chip:hover {
		background: var(--bg-hover);
		border-color: var(--accent-dim);
	}

	.option-chip.active {
		background: rgba(99, 102, 241, 0.15);
		border-color: var(--accent-primary);
		color: var(--accent-primary);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-md);
	}

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
	:global(.spin) { animation: spin 1s linear infinite; }

	@media (max-width: 768px) {
		.page {
			padding: 0 var(--spacing-sm);
		}

		.tab-header {
			flex-direction: column;
			gap: var(--spacing-md);
		}

		.tab-header .btn {
			width: 100%;
		}

		.content-grid {
			grid-template-columns: 1fr;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.form-card {
			padding: var(--spacing-md);
		}

		.content-card {
			padding: var(--spacing-md);
		}

		.card-header h3 {
			font-size: 0.9375rem;
		}

		.actions {
			flex-wrap: wrap;
		}

		.actions .btn {
			flex: 1;
			min-width: 0;
		}

		.backfill-menu {
			padding: var(--spacing-md);
		}

		.checkbox-row {
			flex-direction: column;
			gap: var(--spacing-sm);
		}

		.options-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.meta {
			gap: var(--spacing-sm);
		}
	}
</style>
