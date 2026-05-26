<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { showConfirm } from '$lib/stores/modal.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import { formatBytes, formatDuration } from '$lib/utils/format';
	import VideoPlayer from '$lib/components/player/VideoPlayer.svelte';
	import TagEditor from '$lib/components/ui/TagEditor.svelte';
	import DownloadIcon from '$lib/components/icons/DownloadIcon.svelte';
	import FolderDownIcon from '$lib/components/icons/FolderDownIcon.svelte';
	import ExternalLinkIcon from '$lib/components/icons/ExternalLinkIcon.svelte';
	import RefreshIcon from '$lib/components/icons/RefreshIcon.svelte';
	import TrashIcon from '$lib/components/icons/TrashIcon.svelte';
	import AddToPlaylistMenu from '$lib/components/playlist/AddToPlaylistMenu.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let download = $state(data.download);
	let deleting = $state(false);
	let promoting = $state(false);
	let refreshing = $state(false);

	// Playlist autoplay
	let autoplay = $state(false);
	onMount(() => {
		autoplay = localStorage.getItem('playlist-autoplay') === 'true';
	});

	function handleVideoEnded() {
		if (!autoplay || !data.playlistContext?.nextDownloadId) return;
		goto(`/downloads/${data.playlistContext.nextDownloadId}?playlist=${data.playlistContext.playlistId}`);
	}

	function toggleAutoplay() {
		autoplay = !autoplay;
		localStorage.setItem('playlist-autoplay', String(autoplay));
	}

	// -- Watch progress saving --
	let watchProgressTimer: ReturnType<typeof setInterval> | undefined;
	let lastSavedPosition = $state(0);

	$effect(() => {
		// Only set up for completed video downloads
		if (!isVideo || download.status !== 'COMPLETED') return;

		watchProgressTimer = setInterval(() => {
			const videoEl = document.querySelector('.video-player-wrapper video') as HTMLVideoElement;
			if (!videoEl || videoEl.paused || !videoEl.duration) return;

			const position = videoEl.currentTime;
			const dur = videoEl.duration;

			// Only save if position changed by at least 2 seconds
			if (Math.abs(position - lastSavedPosition) < 2) return;
			lastSavedPosition = position;

			fetch(`/api/watch-progress/${download.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ position, duration: dur })
			}).catch(() => {
				// Fail silently
			});
		}, 10000);

		return () => {
			if (watchProgressTimer) clearInterval(watchProgressTimer);
		};
	});

	function formatDate(date: string | Date | null): string {
		if (!date) return 'Unknown';
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric', month: 'long', day: 'numeric',
		});
	}

	function formatDateTime(date: string | Date | null): string {
		if (!date) return 'Unknown';
		return new Date(date).toLocaleString();
	}

	async function handleDelete() {
		const confirmed = await showConfirm(
			'Delete Download',
			`Delete "${download.title || 'this download'}"? This cannot be undone.`,
			'Delete'
		);
		if (!confirmed) return;

		deleting = true;
		try {
			const res = await fetch(`/api/downloads/${download.id}`, { method: 'DELETE' });
			if (res.ok) {
				addToast('success', 'Download deleted');
				goto('/downloads');
			} else {
				addToast('error', 'Failed to delete download');
			}
		} catch {
			addToast('error', 'Failed to delete download');
		} finally {
			deleting = false;
		}
	}

	async function handlePromote() {
		promoting = true;
		try {
			const res = await fetch(`/api/downloads/${download.id}/promote`, { method: 'POST' });
			if (res.ok) {
				download = { ...download, storagePool: 'library' };
				addToast('success', 'Moved to library');
			} else {
				addToast('error', 'Failed to move to library');
			}
		} catch {
			addToast('error', 'Failed to move to library');
		} finally {
			promoting = false;
		}
	}

	async function handleRefreshMetadata() {
		refreshing = true;
		try {
			const res = await fetch(`/api/downloads/${download.id}/refresh`, { method: 'POST' });
			if (res.ok) {
				const updated = await res.json();
				download = { ...download, ...updated };
				addToast('success', 'Metadata refreshed');
			} else {
				const err = await res.json().catch(() => null);
				addToast('error', err?.message || 'Failed to refresh metadata');
			}
		} catch {
			addToast('error', 'Failed to refresh metadata');
		} finally {
			refreshing = false;
		}
	}

	function downloadFile() {
		window.open(`/api/files/${download.id}`, '_blank');
	}

	function openInJellyfin() {
		if (data.jellyfinUrl) {
			window.open(`${data.jellyfinUrl}/web/index.html#!/search.html?query=${encodeURIComponent(download.title || '')}`, '_blank');
		}
	}

	// Use ?t= query param for subtitle timestamp linking, fallback to watch progress
	let urlStartTime = $derived(() => {
		const t = $page.url.searchParams.get('t');
		return t ? parseFloat(t) : null;
	});

	let isVideo = $derived(
		download.filepath?.match(/\.(mp4|webm|mkv)$/i) !== null
	);

	let isAudio = $derived(
		download.filepath?.match(/\.(mp3|m4a|aac|flac|opus|ogg|wav)$/i) !== null
	);
</script>

<svelte:head>
	<title>{download.title || 'Download'} - wytui</title>
</svelte:head>

<div class="detail-page">
	{#if data.playlistContext}
		<div class="playlist-nav-bar">
			<a href="/playlists/{data.playlistContext.playlistId}" class="back-link">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				{data.playlistContext.playlistName}
			</a>
			<div class="playlist-nav-controls">
				{#if data.playlistContext.prevDownloadId}
					<a href="/downloads/{data.playlistContext.prevDownloadId}?playlist={data.playlistContext.playlistId}" class="btn btn-sm btn-secondary">
						← Prev
					</a>
				{/if}
				<span class="playlist-position">{data.playlistContext.currentPosition} / {data.playlistContext.totalItems}</span>
				{#if data.playlistContext.nextDownloadId}
					<a href="/downloads/{data.playlistContext.nextDownloadId}?playlist={data.playlistContext.playlistId}" class="btn btn-sm btn-secondary">
						Next →
					</a>
				{/if}
				<button
					class="btn btn-sm"
					class:btn-secondary={!autoplay}
					class:btn-primary={autoplay}
					onclick={toggleAutoplay}
					title={autoplay ? 'Autoplay on' : 'Autoplay off'}
				>
					Autoplay {autoplay ? 'On' : 'Off'}
				</button>
			</div>
		</div>
	{:else}
		<a href="/downloads" class="back-link">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			Back to Downloads
		</a>
	{/if}

	<div class="detail-layout">
		<!-- Player / Thumbnail Area -->
		<div class="media-area">
			{#if isVideo && download.status === 'COMPLETED'}
				<VideoPlayer
					src="/api/files/{download.id}"
					poster={download.thumbnail || undefined}
					videoId={download.videoId || undefined}
					downloadId={download.id}
					startTime={data.startTimeParam ?? download.watchProgress?.position ?? 0}
					onEnded={handleVideoEnded}
				/>
			{:else if isAudio && download.status === 'COMPLETED'}
				<div class="audio-area">
					{#if download.thumbnail}
						<img src={download.thumbnail} alt="" class="audio-cover" />
					{/if}
					<!-- svelte-ignore a11y_media_has_caption -->
					<audio controls preload="metadata" class="audio-player">
						<source src="/api/files/{download.id}" />
					</audio>
				</div>
			{:else if download.thumbnail}
				<img src={download.thumbnail} alt="" class="thumbnail" />
			{:else}
				<div class="no-thumbnail">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<rect x="2" y="2" width="20" height="20" rx="2"/>
						<path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/>
					</svg>
				</div>
			{/if}
		</div>

		<!-- Metadata -->
		<div class="meta-area">
			<h1 class="title">{download.title || 'Untitled'}</h1>

			{#if download.uploader}
				<a href="/channels/{encodeURIComponent(download.uploader)}" class="uploader-link">{download.uploader}</a>
			{/if}

			<div class="badges">
				<span class="badge" class:badge-library={download.storagePool === 'library'} class:badge-cache={download.storagePool === 'cache'}>
					{download.storagePool === 'library' ? 'Library' : 'Cache'}
				</span>
				{#if download.videoType}
					<span class="badge badge-type">{download.videoType}</span>
				{/if}
				{#if download.profile}
					<span class="badge badge-profile">{download.profile.name}</span>
				{/if}
			</div>

			<div class="meta-grid">
				{#if download.duration}
					<div class="meta-item">
						<span class="meta-label">Duration</span>
						<span class="meta-value">{formatDuration(download.duration)}</span>
					</div>
				{/if}
				{#if download.filesize}
					<div class="meta-item">
						<span class="meta-label">File Size</span>
						<span class="meta-value">{formatBytes(download.filesize)}</span>
					</div>
				{/if}
				{#if download.format}
					<div class="meta-item">
						<span class="meta-label">Format</span>
						<span class="meta-value">{download.format}</span>
					</div>
				{/if}
				{#if download.uploadDate}
					<div class="meta-item">
						<span class="meta-label">Upload Date</span>
						<span class="meta-value">{formatDate(download.uploadDate)}</span>
					</div>
				{/if}
				{#if download.completedAt}
					<div class="meta-item">
						<span class="meta-label">Downloaded</span>
						<span class="meta-value">{formatDateTime(download.completedAt)}</span>
					</div>
				{/if}
				{#if download.dislikeCount !== null && download.dislikeCount !== undefined}
					<div class="meta-item">
						<span class="meta-label">Dislikes</span>
						<span class="meta-value">{download.dislikeCount.toLocaleString()}</span>
					</div>
				{/if}
			</div>

			{#if download.description}
				<details class="description-section">
					<summary>Description</summary>
					<p class="description-text">{download.description}</p>
				</details>
			{/if}

			<div class="tags-section">
				<span class="meta-label">Tags</span>
				<TagEditor
					tags={download.tags || []}
					onUpdate={async (newTags) => {
						try {
							const res = await fetch(`/api/downloads/${download.id}`, {
								method: 'PATCH',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ tags: newTags }),
							});
							if (res.ok) {
								download = { ...download, tags: newTags };
							}
						} catch {}
					}}
				/>
			</div>

			{#if download.artist || download.album}
				<div class="music-meta">
					<h3>Music Info</h3>
					<div class="meta-grid">
						{#if download.artist}
							<div class="meta-item">
								<span class="meta-label">Artist</span>
								<span class="meta-value">{download.artist}</span>
							</div>
						{/if}
						{#if download.album}
							<div class="meta-item">
								<span class="meta-label">Album</span>
								<span class="meta-value">{download.album}</span>
							</div>
						{/if}
						{#if download.trackNumber}
							<div class="meta-item">
								<span class="meta-label">Track</span>
								<span class="meta-value">#{download.trackNumber}</span>
							</div>
						{/if}
						{#if download.releaseYear}
							<div class="meta-item">
								<span class="meta-label">Year</span>
								<span class="meta-value">{download.releaseYear}</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<div class="actions">
				{#if download.status === 'COMPLETED'}
					<button class="btn btn-primary" onclick={downloadFile}>
						<DownloadIcon />
						Download File
					</button>
					<AddToPlaylistMenu downloadId={download.id} />
					{#if download.storagePool === 'cache'}
						<button class="btn btn-accent" onclick={handlePromote} disabled={promoting}>
							<FolderDownIcon />
							{promoting ? 'Moving...' : 'Save to Library'}
						</button>
					{/if}
					{#if data.jellyfinUrl}
						<button class="btn btn-secondary" onclick={openInJellyfin}>
							<ExternalLinkIcon />
							Open in Jellyfin
						</button>
					{/if}
				{/if}
				<button class="btn btn-secondary" onclick={handleRefreshMetadata} disabled={refreshing}>
					<RefreshIcon />
					{refreshing ? 'Refreshing...' : 'Refresh Metadata'}
				</button>
				<button class="btn btn-danger" onclick={handleDelete} disabled={deleting}>
					<TrashIcon />
					{deleting ? 'Deleting...' : 'Delete'}
				</button>
			</div>

			<div class="source-url">
				<span class="meta-label">Source</span>
				<a href={download.url} target="_blank" rel="noopener noreferrer" class="url-link">{download.url}</a>
			</div>
		</div>
	</div>

	{#if data.similar && data.similar.length > 0}
		<div class="similar-section">
			<h3 class="similar-heading">More from <a href="/channels/{encodeURIComponent(download.uploader)}" class="similar-channel-link">{download.uploader}</a></h3>
			<div class="similar-grid">
				{#each data.similar as item}
					<a href="/downloads/{item.id}" class="similar-card">
						{#if item.thumbnail}
							<img src={item.thumbnail} alt={item.title || ''} class="similar-thumb" />
						{:else}
							<div class="similar-thumb placeholder-thumb"></div>
						{/if}
						<div class="similar-info">
							<p class="similar-title">{item.title || 'Untitled'}</p>
							{#if item.duration}
								<span class="similar-duration">{formatDuration(item.duration)}</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.detail-page {
		max-width: 1200px;
		margin: 0 auto;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.875rem;
		margin-bottom: var(--spacing-xl);
		transition: color var(--transition-fast);
	}

	.back-link:hover {
		color: var(--text-primary);
	}

	.playlist-nav-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-xl);
		flex-wrap: wrap;
	}

	.playlist-nav-bar .back-link {
		margin-bottom: 0;
	}

	.playlist-nav-controls {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.playlist-position {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.detail-layout {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
	}

	.media-area {
		width: 100%;
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}

	.audio-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--spacing-xl);
		gap: var(--spacing-lg);
	}

	.audio-cover {
		width: 200px;
		height: 200px;
		border-radius: var(--radius-lg);
		object-fit: cover;
	}

	.audio-player {
		width: 100%;
		max-width: 500px;
	}

	.thumbnail {
		width: 100%;
		display: block;
		object-fit: cover;
	}

	.no-thumbnail {
		width: 100%;
		height: 300px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
	}

	.meta-area {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.title {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.3;
	}

	.uploader-link {
		font-size: 1rem;
		color: var(--text-secondary);
		margin-top: calc(-1 * var(--spacing-sm));
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.uploader-link:hover {
		color: var(--accent-primary);
	}

	.badges {
		display: flex;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.badge {
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
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

	.badge-profile {
		background: rgba(139, 92, 246, 0.15);
		color: #a78bfa;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: var(--spacing-md);
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.meta-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
	}

	.meta-value {
		font-size: 0.9375rem;
		color: var(--text-primary);
	}

	.description-section {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
	}

	.description-section summary {
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.description-text {
		margin-top: var(--spacing-md);
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.6;
		white-space: pre-wrap;
		max-height: 300px;
		overflow-y: auto;
	}

	.tags-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.tag {
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.music-meta {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
	}

	.music-meta h3 {
		font-size: 0.875rem;
		margin-bottom: var(--spacing-md);
		color: var(--text-secondary);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--border);
	}

	.actions .btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.source-url {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.url-link {
		font-size: 0.8125rem;
		color: var(--accent-primary);
		text-decoration: none;
		word-break: break-all;
	}

	.url-link:hover {
		text-decoration: underline;
	}

	.similar-section {
		margin-top: var(--spacing-2xl);
		padding-top: var(--spacing-xl);
		border-top: 1px solid var(--border);
	}

	.similar-heading {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: var(--spacing-lg);
		color: var(--text-secondary);
	}

	.similar-channel-link {
		color: var(--text-primary);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.similar-channel-link:hover {
		color: var(--accent-primary);
	}

	.similar-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-md);
	}

	.similar-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		text-decoration: none;
		color: inherit;
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: opacity var(--transition-fast);
	}

	.similar-card:hover {
		opacity: 0.8;
	}

	.similar-thumb {
		width: 100%;
		aspect-ratio: 16/9;
		object-fit: cover;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
	}

	.similar-info {
		padding: 0 2px;
	}

	.similar-title {
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.4;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		margin-bottom: 2px;
	}

	.similar-duration {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	@media (max-width: 768px) {
		.title { font-size: 1.25rem; }
		.meta-grid { grid-template-columns: 1fr 1fr; }
		.actions { flex-direction: column; }
		.actions .btn { width: 100%; justify-content: center; }
		.similar-grid { grid-template-columns: repeat(2, 1fr); }
	}
</style>
