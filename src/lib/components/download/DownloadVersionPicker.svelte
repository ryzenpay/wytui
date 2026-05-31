<script lang="ts">
	import { addToast } from '$lib/stores/toast.svelte';
	import { formatBytes } from '$lib/utils/format';
	import DownloadIcon from '$lib/components/icons/DownloadIcon.svelte';

	type Version = {
		id: string;
		title: string | null;
		format: string | null;
		height: number | null;
		videoType: string | null;
		filesize: string | null;
		storagePool: string;
		profile?: { name?: string; quality?: string | null; audioOnly?: boolean; audioFormat?: string | null } | null;
	};

	let {
		downloadId,
		label = 'Download',
		className = 'btn btn-primary',
		showLabel = true,
		direction = 'up',
		open = $bindable(false),
	}: {
		downloadId: string;
		label?: string;
		className?: string;
		showLabel?: boolean;
		direction?: 'up' | 'down';
		open?: boolean;
	} = $props();

	let loading = $state(false);
	let loaded = $state(false);
	let versions = $state<Version[]>([]);
	let menuEl: HTMLDivElement | undefined = $state();
	let btnEl: HTMLButtonElement | undefined = $state();

	function fileUrl(id: string) {
		return `/api/files/${id}`;
	}

	function isMobileDevice() {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent
		);
	}

	function filenameFromResponse(res: Response): string | null {
		const cd = res.headers.get('Content-Disposition');
		const match = cd?.match(/filename="?([^"]+)"?/i);
		return match?.[1] ?? null;
	}

	async function triggerDownload(id: string) {
		// On mobile, open the native share sheet so users can "Save to Photos"
		// instead of dumping the file into Files/Downloads. Falls back to a plain
		// download on desktop or when the Share API is unavailable.
		const canShareFiles =
			isMobileDevice() && navigator.canShare?.({ files: [new File([], 'test')] });
		if (canShareFiles) {
			try {
				const res = await fetch(fileUrl(id));
				if (!res.ok) throw new Error('fetch failed');
				const blob = await res.blob();
				const name = filenameFromResponse(res) || 'download';
				const file = new File([blob], name, { type: blob.type });
				await navigator.share({ files: [file] });
				return;
			} catch (e: any) {
				if (e.name === 'AbortError') return; // user dismissed the share sheet
				console.warn('Share unavailable, falling back to download:', e);
			}
		}
		window.open(fileUrl(id), '_blank');
	}

	function versionLabel(v: Version): string {
		const p = v.profile;
		let detail = '';
		if (p?.audioOnly) detail = p.audioFormat ? p.audioFormat.toUpperCase() : 'Audio';
		else detail = p?.quality || (v.height ? `${v.height}p` : v.format || '');
		const name = p?.name || '';
		const base = [name, detail].filter(Boolean).join(' · ') || 'Download';
		const pool = v.storagePool === 'library' ? 'Library' : 'Cache';
		const size = v.filesize ? formatBytes(v.filesize) : null;
		return `${base} · ${pool}${size ? ` · ${size}` : ''}`;
	}

	async function loadVersions() {
		loading = true;
		try {
			const res = await fetch(`/api/downloads/${downloadId}/versions`);
			versions = res.ok ? await res.json() : [];
			loaded = true;
			// Single (or no) version → just download it, no menu.
			if (versions.length <= 1) {
				triggerDownload(versions[0]?.id ?? downloadId);
				open = false;
			}
		} catch {
			addToast('error', 'Failed to load versions');
			triggerDownload(downloadId);
			open = false;
		} finally {
			loading = false;
		}
	}

	function handleClick() {
		if (open) {
			open = false;
			return;
		}
		open = true;
		loaded = false;
		loadVersions();
	}

	// Allow the parent to open the picker programmatically (e.g. from the player
	// right-click menu) by setting `open = true`.
	$effect(() => {
		if (open && !loaded && !loading) loadVersions();
	});

	function pick(v: Version) {
		triggerDownload(v.id);
		open = false;
	}

	// Close on outside click / Escape
	$effect(() => {
		if (!open) return;
		function down(e: MouseEvent) {
			if (menuEl && !menuEl.contains(e.target as Node) && btnEl && !btnEl.contains(e.target as Node)) open = false;
		}
		function key(e: KeyboardEvent) {
			if (e.key === 'Escape') open = false;
		}
		window.addEventListener('mousedown', down);
		window.addEventListener('keydown', key);
		return () => {
			window.removeEventListener('mousedown', down);
			window.removeEventListener('keydown', key);
		};
	});
</script>

<div class="dvp-wrap">
	<button bind:this={btnEl} class={className} onclick={handleClick} title="Download file" aria-label="Download file" aria-haspopup="menu" aria-expanded={open}>
		<DownloadIcon />
		{#if showLabel}{label}{/if}
	</button>

	{#if open && versions.length > 1}
		<div class="dvp-popover" class:down={direction === 'down'} bind:this={menuEl} role="menu" aria-label="Choose version to download">
			<div class="dvp-head">Choose version</div>
			{#each versions as v}
				<button class="dvp-row" role="menuitem" onclick={() => pick(v)}>
					<DownloadIcon />
					<span class="dvp-label">{versionLabel(v)}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dvp-wrap {
		position: relative;
		display: inline-block;
	}

	.dvp-popover {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 0;
		z-index: var(--z-dropdown);
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-dropdown);
		min-width: 240px;
		max-width: 340px;
		overflow: hidden;
		padding: 4px;
	}

	.dvp-popover.down {
		bottom: auto;
		top: calc(100% + 6px);
	}

	.dvp-head {
		padding: 8px 10px 6px;
		font-size: var(--font-size-control);
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.dvp-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		color: var(--color-text-primary);
		font-size: var(--font-size-sm);
		min-height: unset;
		min-width: unset;
		border-radius: var(--radius-sm);
		transition: background var(--transition-fast);
	}

	.dvp-row:hover {
		background: var(--color-overlay-hover);
	}

	.dvp-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
