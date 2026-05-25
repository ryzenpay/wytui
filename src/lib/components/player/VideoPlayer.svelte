<script lang="ts">
	let { src, poster, videoId }: { src: string; poster?: string; videoId?: string } = $props();

	// -- Element refs --
	let wrapperEl: HTMLDivElement | undefined = $state();
	let videoEl: HTMLVideoElement | undefined = $state();

	// -- Playback state --
	let paused = $state(true);
	let currentTime = $state(0);
	let duration = $state(0);
	let buffered = $state(0);
	let volume = $state(1);
	let muted = $state(false);
	let playbackRate = $state(1);
	let isFullscreen = $state(false);

	// -- UI state --
	let controlsVisible = $state(true);
	let hideControlsTimer: ReturnType<typeof setTimeout> | undefined;
	let speedMenuOpen = $state(false);
	let skipNotification = $state('');
	let skipNotificationTimer: ReturnType<typeof setTimeout> | undefined;

	// -- SponsorBlock --
	type SBSegment = {
		segment: [number, number];
		category: string;
		UUID: string;
	};
	let segments = $state<SBSegment[]>([]);
	let skippedUUIDs = $state<Set<string>>(new Set());
	let autoSkipEnabled = $state(true);

	const SEGMENT_COLORS: Record<string, string> = {
		sponsor: '#00d400',
		selfpromo: '#ffff00',
		interaction: '#cc00ff',
		intro: '#00ffff',
		outro: '#0202ed',
		preview: '#008fd6',
		music_offtopic: '#ff9900'
	};

	const CATEGORY_LABELS: Record<string, string> = {
		sponsor: 'Sponsor',
		selfpromo: 'Self-Promotion',
		interaction: 'Interaction Reminder',
		intro: 'Intro',
		outro: 'Outro',
		preview: 'Preview',
		music_offtopic: 'Non-Music'
	};

	const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

	// -- Fetch SponsorBlock segments --
	$effect(() => {
		if (!videoId) return;
		const categories = JSON.stringify([
			'sponsor',
			'selfpromo',
			'interaction',
			'intro',
			'outro',
			'preview',
			'music_offtopic'
		]);
		fetch(
			`https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=${encodeURIComponent(categories)}`
		)
			.then((res) => {
				if (!res.ok) return [];
				return res.json();
			})
			.then((data: SBSegment[]) => {
				if (Array.isArray(data)) {
					segments = data;
				}
			})
			.catch(() => {
				// Fail silently
			});
	});

	// -- Auto-skip sponsor segments --
	$effect(() => {
		if (!autoSkipEnabled || segments.length === 0 || !videoEl) return;
		const time = currentTime;
		for (const seg of segments) {
			if (skippedUUIDs.has(seg.UUID)) continue;
			const [start, end] = seg.segment;
			if (time >= start && time < end - 0.5) {
				videoEl.currentTime = end;
				skippedUUIDs = new Set([...skippedUUIDs, seg.UUID]);
				showSkipNotification(CATEGORY_LABELS[seg.category] || seg.category);
				break;
			}
		}
	});

	function showSkipNotification(label: string) {
		skipNotification = `Skipped: ${label}`;
		if (skipNotificationTimer) clearTimeout(skipNotificationTimer);
		skipNotificationTimer = setTimeout(() => {
			skipNotification = '';
		}, 2500);
	}

	// -- Controls visibility --
	function resetHideTimer() {
		controlsVisible = true;
		if (hideControlsTimer) clearTimeout(hideControlsTimer);
		if (!paused) {
			hideControlsTimer = setTimeout(() => {
				controlsVisible = false;
				speedMenuOpen = false;
			}, 3000);
		}
	}

	$effect(() => {
		if (paused) {
			controlsVisible = true;
			if (hideControlsTimer) clearTimeout(hideControlsTimer);
		}
	});

	// -- Video event handlers --
	function handleTimeUpdate() {
		if (!videoEl) return;
		currentTime = videoEl.currentTime;
		// Update buffered
		if (videoEl.buffered.length > 0) {
			buffered = videoEl.buffered.end(videoEl.buffered.length - 1);
		}
	}

	function handleMetadata() {
		if (!videoEl) return;
		duration = videoEl.duration;
	}

	function handlePlay() {
		paused = false;
		resetHideTimer();
	}

	function handlePause() {
		paused = true;
	}

	function handleVolumeChange() {
		if (!videoEl) return;
		volume = videoEl.volume;
		muted = videoEl.muted;
	}

	function handleRateChange() {
		if (!videoEl) return;
		playbackRate = videoEl.playbackRate;
	}

	// -- Control actions --
	function togglePlay() {
		if (!videoEl) return;
		if (videoEl.paused) {
			videoEl.play();
		} else {
			videoEl.pause();
		}
	}

	function seek(time: number) {
		if (!videoEl) return;
		videoEl.currentTime = Math.max(0, Math.min(time, duration));
	}

	function changeVolume(delta: number) {
		if (!videoEl) return;
		videoEl.volume = Math.max(0, Math.min(1, videoEl.volume + delta));
	}

	function toggleMute() {
		if (!videoEl) return;
		videoEl.muted = !videoEl.muted;
	}

	function setSpeed(speed: number) {
		if (!videoEl) return;
		videoEl.playbackRate = speed;
		speedMenuOpen = false;
	}

	function changeSpeed(delta: number) {
		const idx = SPEED_OPTIONS.indexOf(playbackRate);
		let newIdx: number;
		if (idx === -1) {
			// Find closest
			newIdx = SPEED_OPTIONS.findIndex((s) => s >= playbackRate);
			if (newIdx === -1) newIdx = SPEED_OPTIONS.length - 1;
			if (delta < 0 && newIdx > 0) newIdx--;
		} else {
			newIdx = Math.max(0, Math.min(SPEED_OPTIONS.length - 1, idx + delta));
		}
		setSpeed(SPEED_OPTIONS[newIdx]);
	}

	function toggleFullscreen() {
		if (!wrapperEl) return;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			wrapperEl.requestFullscreen();
		}
	}

	$effect(() => {
		function handleFsChange() {
			isFullscreen = !!document.fullscreenElement;
		}
		document.addEventListener('fullscreenchange', handleFsChange);
		return () => document.removeEventListener('fullscreenchange', handleFsChange);
	});

	// -- Chromecast --
	let castAvailable = $state(false);
	let castConnected = $state(false);
	let castSession: any = $state(null);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const win = window as any;
		if (win.chrome?.cast) {
			initCast();
			return;
		}
		win['__onGCastApiAvailable'] = (isAvailable: boolean) => {
			if (isAvailable) initCast();
		};
		if (!document.querySelector('script[src*="cast_sender"]')) {
			const script = document.createElement('script');
			script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
			script.async = true;
			document.head.appendChild(script);
		}
	});

	function initCast() {
		const win = window as any;
		const cast = win.cast;
		const chrome = win.chrome;
		if (!cast?.framework || !chrome?.cast) return;

		cast.framework.CastContext.getInstance().setOptions({
			receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
			autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
		});

		cast.framework.CastContext.getInstance().addEventListener(
			cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
			(event: any) => {
				castConnected = event.sessionState === cast.framework.SessionState.SESSION_STARTED ||
					event.sessionState === cast.framework.SessionState.SESSION_RESUMED;
				castSession = castConnected ? cast.framework.CastContext.getInstance().getCurrentSession() : null;
			}
		);
		castAvailable = true;
	}

	function toggleCast() {
		const win = window as any;
		const cast = win.cast;
		if (!cast?.framework) return;
		if (castConnected) {
			cast.framework.CastContext.getInstance().endCurrentSession(true);
		} else {
			cast.framework.CastContext.getInstance().requestSession();
		}
	}

	$effect(() => {
		if (!castSession || !castConnected || !src) return;
		const win = window as any;
		const chrome = win.chrome;
		if (!chrome?.cast) return;

		const mediaUrl = new URL(src, window.location.origin).href;
		const mediaInfo = new chrome.cast.media.MediaInfo(mediaUrl, 'video/mp4');
		if (poster) {
			mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
			mediaInfo.metadata.images = [{ url: new URL(poster, window.location.origin).href }];
		}
		const request = new chrome.cast.media.LoadRequest(mediaInfo);
		request.currentTime = currentTime;
		castSession.loadMedia(request).catch((e: any) => console.error('[Cast] Load failed:', e));
	});

	// -- Progress bar interaction --
	let progressDragging = $state(false);

	function handleProgressMouseDown(e: MouseEvent) {
		progressDragging = true;
		seekToMousePosition(e);
		window.addEventListener('mousemove', handleProgressMouseMove);
		window.addEventListener('mouseup', handleProgressMouseUp);
	}

	function handleProgressMouseMove(e: MouseEvent) {
		if (progressDragging) {
			seekToMousePosition(e);
		}
	}

	function handleProgressMouseUp() {
		progressDragging = false;
		window.removeEventListener('mousemove', handleProgressMouseMove);
		window.removeEventListener('mouseup', handleProgressMouseUp);
	}

	function seekToMousePosition(e: MouseEvent) {
		const bar = wrapperEl?.querySelector('.progress-bar-track') as HTMLElement;
		if (!bar || !duration) return;
		const rect = bar.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		seek(pct * duration);
	}

	// Touch support for progress bar
	function handleProgressTouchStart(e: TouchEvent) {
		progressDragging = true;
		seekToTouchPosition(e);
	}

	function handleProgressTouchMove(e: TouchEvent) {
		if (progressDragging) {
			e.preventDefault();
			seekToTouchPosition(e);
		}
	}

	function handleProgressTouchEnd() {
		progressDragging = false;
	}

	function seekToTouchPosition(e: TouchEvent) {
		const bar = wrapperEl?.querySelector('.progress-bar-track') as HTMLElement;
		if (!bar || !duration || !e.touches[0]) return;
		const rect = bar.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
		seek(pct * duration);
	}

	// -- SponsorBlock segment click (unskip) --
	function handleSegmentClick(seg: SBSegment) {
		if (!videoEl) return;
		// Seek to start of the segment to re-watch it
		videoEl.currentTime = seg.segment[0];
		// Remove from skipped so auto-skip doesn't re-trigger immediately; re-add after segment ends
		skippedUUIDs = new Set([...skippedUUIDs, seg.UUID]);
		// Temporarily disable auto-skip for this segment
		const prevAutoSkip = autoSkipEnabled;
		autoSkipEnabled = false;
		const end = seg.segment[1];
		function checkEnd() {
			if (videoEl && videoEl.currentTime >= end) {
				autoSkipEnabled = prevAutoSkip;
				videoEl.removeEventListener('timeupdate', checkEnd);
			}
		}
		videoEl.addEventListener('timeupdate', checkEnd);
	}

	// -- Keyboard shortcuts --
	function handleKeydown(e: KeyboardEvent) {
		// Ignore if an input/textarea is focused
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

		let handled = true;

		switch (e.key) {
			case ' ':
				togglePlay();
				break;
			case 'ArrowLeft':
				seek(currentTime - 5);
				break;
			case 'ArrowRight':
				seek(currentTime + 5);
				break;
			case 'ArrowUp':
				changeVolume(0.1);
				break;
			case 'ArrowDown':
				changeVolume(-0.1);
				break;
			case 'f':
			case 'F':
				toggleFullscreen();
				break;
			case 'm':
			case 'M':
				toggleMute();
				break;
			case '<':
				changeSpeed(-1);
				break;
			case '>':
				changeSpeed(1);
				break;
			default:
				if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.metaKey) {
					const pct = parseInt(e.key) / 10;
					seek(duration * pct);
				} else {
					handled = false;
				}
		}

		if (handled) {
			e.preventDefault();
			e.stopPropagation();
			resetHideTimer();
		}
	}

	// -- Time formatting --
	function formatTime(seconds: number): string {
		if (!isFinite(seconds) || seconds < 0) return '0:00';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		if (h > 0) {
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		}
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	// -- Derived values --
	let playedPct = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
	let bufferedPct = $derived(duration > 0 ? (buffered / duration) * 100 : 0);

	let volumeIcon = $derived.by(() => {
		if (muted || volume === 0) return 'muted';
		if (volume < 0.5) return 'low';
		return 'high';
	});

	// -- Close speed menu on outside click --
	function handleWrapperClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (speedMenuOpen && !target.closest('.speed-control')) {
			speedMenuOpen = false;
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="video-player-wrapper"
	class:controls-hidden={!controlsVisible && !paused}
	bind:this={wrapperEl}
	tabindex="0"
	onkeydown={handleKeydown}
	onmousemove={resetHideTimer}
	onclick={handleWrapperClick}
	role="application"
	aria-label="Video player"
>
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={videoEl}
		{src}
		{poster}
		preload="metadata"
		onclick={togglePlay}
		ondblclick={toggleFullscreen}
		ontimeupdate={handleTimeUpdate}
		onloadedmetadata={handleMetadata}
		onplay={handlePlay}
		onpause={handlePause}
		onvolumechange={handleVolumeChange}
		onratechange={handleRateChange}
		class="video-element"
	></video>

	<!-- Big play button overlay when paused -->
	{#if paused && currentTime === 0}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="big-play-overlay" onclick={togglePlay}>
			<div class="big-play-btn">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
					<path d="M8 5v14l11-7z" />
				</svg>
			</div>
		</div>
	{/if}

	<!-- Custom controls overlay -->
	<div class="player-controls" class:visible={controlsVisible || paused}>
		<!-- Progress bar -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="progress-bar-track"
			onmousedown={handleProgressMouseDown}
			ontouchstart={handleProgressTouchStart}
			ontouchmove={handleProgressTouchMove}
			ontouchend={handleProgressTouchEnd}
			role="slider"
			aria-label="Seek"
			aria-valuenow={Math.floor(currentTime)}
			aria-valuemin={0}
			aria-valuemax={Math.floor(duration)}
		>
			<div class="progress-bar-buffered" style="width: {bufferedPct}%"></div>
			<div class="progress-bar-played" style="width: {playedPct}%">
				<div class="progress-bar-thumb"></div>
			</div>
			<!-- SponsorBlock segments -->
			{#each segments as seg}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="sb-segment"
					style="left: {(seg.segment[0] / duration) * 100}%; width: {((seg.segment[1] - seg.segment[0]) / duration) * 100}%;"
					style:background-color={SEGMENT_COLORS[seg.category] || '#888'}
					title="{CATEGORY_LABELS[seg.category] || seg.category} ({formatTime(seg.segment[0])} - {formatTime(seg.segment[1])})"
					onmousedown={(e: MouseEvent) => e.stopPropagation()}
					onclick={(e: MouseEvent) => { e.stopPropagation(); handleSegmentClick(seg); }}
				></div>
			{/each}
		</div>

		<div class="controls-row">
			<!-- Play/Pause -->
			<button class="ctrl-btn" onclick={togglePlay} aria-label={paused ? 'Play' : 'Pause'}>
				{#if paused}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
						<path d="M8 5v14l11-7z" />
					</svg>
				{:else}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
						<rect x="6" y="4" width="4" height="16" />
						<rect x="14" y="4" width="4" height="16" />
					</svg>
				{/if}
			</button>

			<!-- Time -->
			<div class="time-display">
				{formatTime(currentTime)} / {formatTime(duration)}
			</div>

			<div class="controls-spacer"></div>

			<!-- Speed selector -->
			<div class="speed-control">
				<button
					class="ctrl-btn speed-btn"
					onclick={() => (speedMenuOpen = !speedMenuOpen)}
					aria-label="Playback speed"
				>
					{playbackRate === 1 ? '1x' : playbackRate + 'x'}
				</button>
				{#if speedMenuOpen}
					<div class="speed-menu">
						{#each SPEED_OPTIONS as speed}
							<button
								class="speed-option"
								class:active={playbackRate === speed}
								onclick={() => setSpeed(speed)}
							>
								{speed}x
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Volume -->
			<button class="ctrl-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
				{#if volumeIcon === 'muted'}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
						<line x1="23" y1="9" x2="17" y2="15" />
						<line x1="17" y1="9" x2="23" y2="15" />
					</svg>
				{:else if volumeIcon === 'low'}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
						<path d="M15.54 8.46a5 5 0 010 7.07" />
					</svg>
				{:else}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
						<path d="M15.54 8.46a5 5 0 010 7.07" />
						<path d="M19.07 4.93a10 10 0 010 14.14" />
					</svg>
				{/if}
			</button>

			<!-- Chromecast -->
			{#if castAvailable}
				<button class="ctrl-btn" class:cast-active={castConnected} onclick={toggleCast} aria-label={castConnected ? 'Stop casting' : 'Cast'}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M2 16.1A5 5 0 015.9 20M2 12.05A9 9 0 019.95 20M2 8V6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2h-6" />
						<line x1="2" y1="20" x2="2.01" y2="20" />
					</svg>
				</button>
			{/if}

			<!-- Fullscreen -->
			<button class="ctrl-btn" onclick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
				{#if isFullscreen}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
					</svg>
				{:else}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
					</svg>
				{/if}
			</button>
		</div>
	</div>

	<!-- Skip notification toast -->
	{#if skipNotification}
		<div class="skip-toast">{skipNotification}</div>
	{/if}
</div>

<style>
	.video-player-wrapper {
		position: relative;
		width: 100%;
		background: #000;
		border-radius: var(--radius-lg);
		overflow: hidden;
		outline: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.video-player-wrapper:focus-visible {
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
	}

	.video-element {
		width: 100%;
		display: block;
		max-height: 70vh;
		cursor: pointer;
	}

	/* Big play overlay */
	.big-play-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		background: rgba(0, 0, 0, 0.3);
	}

	.big-play-btn {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		transition: transform var(--transition-fast), background var(--transition-fast);
	}

	.big-play-overlay:hover .big-play-btn {
		transform: scale(1.1);
		background: rgba(59, 130, 246, 0.8);
	}

	/* Controls */
	.player-controls {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
		padding: var(--spacing-md) var(--spacing-md) var(--spacing-sm);
		opacity: 0;
		transition: opacity var(--transition-normal);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.player-controls.visible {
		opacity: 1;
	}

	.controls-hidden {
		cursor: none;
	}

	/* Progress bar */
	.progress-bar-track {
		position: relative;
		width: 100%;
		height: 4px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
		cursor: pointer;
		transition: height var(--transition-fast);
	}

	.progress-bar-track:hover {
		height: 8px;
	}

	.progress-bar-buffered {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		pointer-events: none;
	}

	.progress-bar-played {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		background: #ef4444;
		border-radius: 2px;
		pointer-events: none;
		z-index: 1;
	}

	.progress-bar-thumb {
		position: absolute;
		right: -6px;
		top: 50%;
		transform: translateY(-50%);
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #ef4444;
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.progress-bar-track:hover .progress-bar-thumb {
		opacity: 1;
	}

	/* SponsorBlock segments */
	.sb-segment {
		position: absolute;
		top: 0;
		height: 100%;
		border-radius: 2px;
		opacity: 0.7;
		z-index: 2;
		cursor: pointer;
		transition: opacity var(--transition-fast);
		min-width: 2px;
	}

	.sb-segment:hover {
		opacity: 1;
	}

	/* Controls row */
	.controls-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.controls-spacer {
		flex: 1;
	}

	.ctrl-btn {
		background: none;
		border: none;
		color: white;
		width: 36px;
		height: 36px;
		min-height: unset;
		min-width: unset;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: background var(--transition-fast);
		flex-shrink: 0;
	}

	.cast-active {
		color: var(--accent-primary, #6366f1);
	}

	.ctrl-btn:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	/* Time display */
	.time-display {
		color: white;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		padding: 0 var(--spacing-xs);
	}

	/* Speed control */
	.speed-control {
		position: relative;
	}

	.speed-btn {
		font-size: 0.8125rem;
		font-weight: 600;
		width: auto;
		padding: 0 var(--spacing-xs);
		min-width: 36px;
	}

	.speed-menu {
		position: absolute;
		bottom: 100%;
		right: 0;
		margin-bottom: var(--spacing-xs);
		background: var(--bg-elevated, #2a2a2a);
		border: 1px solid var(--border, #3a3a3a);
		border-radius: var(--radius-md);
		padding: var(--spacing-xs);
		display: flex;
		flex-direction: column;
		min-width: 80px;
		z-index: 10;
		box-shadow: var(--shadow-lg);
	}

	.speed-option {
		background: none;
		border: none;
		color: var(--text-secondary, #a0a0a0);
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
		border-radius: var(--radius-sm);
		min-height: unset;
		min-width: unset;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.speed-option:hover {
		background: rgba(255, 255, 255, 0.1);
		color: white;
	}

	.speed-option.active {
		color: var(--accent-primary, #3b82f6);
		font-weight: 600;
	}

	/* Skip notification toast */
	.skip-toast {
		position: absolute;
		top: var(--spacing-lg);
		right: var(--spacing-lg);
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		z-index: 20;
		pointer-events: none;
		animation: toast-in 0.3s ease;
		border-left: 3px solid #00d400;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Mobile */
	@media (max-width: 768px) {
		.ctrl-btn {
			width: 44px;
			height: 44px;
		}

		.time-display {
			font-size: 0.75rem;
		}

		.speed-btn {
			font-size: 0.75rem;
		}

		.player-controls {
			padding: var(--spacing-sm);
		}

		.skip-toast {
			top: var(--spacing-md);
			right: var(--spacing-md);
			font-size: 0.75rem;
		}
	}

	/* Fullscreen adjustments */
	:global(:fullscreen) .video-element {
		max-height: 100vh;
	}
</style>
