<script lang="ts">
	import { onMount } from 'svelte';
	import { showConfirm } from '$lib/stores/modal.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import PathBrowser from '$lib/components/ui/PathBrowser.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import RefreshIcon from '$lib/components/icons/RefreshIcon.svelte';
	import ZapIcon from '$lib/components/icons/ZapIcon.svelte';
	import BellIcon from '$lib/components/icons/BellIcon.svelte';
	import UsersIcon from '$lib/components/icons/UsersIcon.svelte';
	import LockIcon from '$lib/components/icons/LockIcon.svelte';
	import ShieldIcon from '$lib/components/icons/ShieldIcon.svelte';
	import TrashIcon from '$lib/components/icons/TrashIcon.svelte';

	interface Props {
		data: {
			session: {
				user: {
					id: string;
					email: string;
					isAdmin: boolean;
				};
			} | null;
		};
	}

	let { data }: Props = $props();

	let settings = $state<any>(null);
	let users = $state<any[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let settingsLoaded = $state(false);
	let settingsSnapshot = $state('');
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isAdmin = $derived(data.session?.user?.isAdmin ?? false);
	let activeTab = $state<'general' | 'users'>('general');

	// Create user form
	let showCreateUser = $state(false);
	let newUser = $state({ email: '', password: '', name: '', isAdmin: false });
	let createUserError = $state('');

	// API Keys
	let apiKeys = $state<any[]>([]);
	let newKeyName = $state('');
	let newKeyResult = $state<string | null>(null);

	// Password change form
	let passwordChangeUserId = $state<string | null>(null);
	let passwordForm = $state({
		newPassword: '',
		confirmPassword: '',
	});
	let passwordError = $state('');

	// Rescan
	let rescanning = $state(false);
	let rescanReport = $state<{ missing: { id: string; title: string | null; filepath: string }[]; ok: number } | null>(null);
	let reconciling = $state(false);

	async function runRescan() {
		rescanning = true;
		rescanReport = null;
		try {
			const res = await fetch('/api/rescan');
			if (res.ok) {
				rescanReport = await res.json();
			} else {
				addToast('error', 'Rescan failed');
			}
		} catch {
			addToast('error', 'Rescan failed');
		} finally {
			rescanning = false;
		}
	}

	async function deleteRescanRecords(ids: string[]) {
		const confirmed = await showConfirm(
			'Delete Records',
			`Delete ${ids.length} download record${ids.length === 1 ? '' : 's'} with missing files? This cannot be undone.`,
			'Delete'
		);
		if (!confirmed) return;

		reconciling = true;
		try {
			const res = await fetch('/api/rescan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ deleteRecords: ids }),
			});
			if (res.ok) {
				const result = await res.json();
				addToast('success', `Deleted ${result.deleted} record${result.deleted === 1 ? '' : 's'}`);
				// Re-run scan to refresh the list
				await runRescan();
			} else {
				addToast('error', 'Reconciliation failed');
			}
		} catch {
			addToast('error', 'Reconciliation failed');
		} finally {
			reconciling = false;
		}
	}

	async function markRescanMissing(ids: string[]) {
		reconciling = true;
		try {
			const res = await fetch('/api/rescan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ markMissing: ids }),
			});
			if (res.ok) {
				const result = await res.json();
				addToast('success', `Marked ${result.marked} record${result.marked === 1 ? '' : 's'} as deleted`);
				await runRescan();
			} else {
				addToast('error', 'Failed to mark records');
			}
		} catch {
			addToast('error', 'Failed to mark records');
		} finally {
			reconciling = false;
		}
	}

	onMount(async () => {
		loadApiKeys();
		if (isAdmin) {
			await Promise.all([loadSettings(), loadUsers(), loadDiskInfo(), loadCookieStatus()]);
		}
	});

	async function loadSettings() {
		loading = true;
		try {
			const res = await fetch('/api/settings');
			if (res.ok) {
				settings = await res.json();
				settingsSnapshot = JSON.stringify(settings);
				settingsLoaded = true;
				if (settings.cleanupEnabled && settings.jellyfinUrl && settings.jellyfinApiKey) {
					loadJellyfinUsers();
				}
			}
		} catch (e) {
			console.error('Failed to load settings:', e);
		} finally {
			loading = false;
		}
	}

	async function loadUsers() {
		try {
			const res = await fetch('/api/users');
			if (res.ok) {
				users = await res.json();
			}
		} catch (e) {
			console.error('Failed to load users:', e);
		}
	}

	const SAVEABLE_FIELDS = ['maxConcurrentDownloads', 'downloadPath', 'ytdlpPath', 'autoUpdateYtdlp', 'updateCheckInterval', 'enableArchive', 'archivePath', 'authMode', 'libraryPath', 'musicLibraryPath', 'cacheQuotaBytes', 'jellyfinUrl', 'jellyfinApiKey', 'maxDurationSeconds', 'jellyfinExternalUrl', 'plexUrl', 'plexToken', 'cleanupEnabled', 'cleanupUserIds', 'cleanupIntervalSeconds', 'cleanupProfileTypes', 'cleanupGraceHours', 'autoDeleteWatchedDays', 'appriseUrl', 'notifyOnComplete', 'notifyOnFail', 'backupEnabled', 'backupCron', 'backupPath', 'ldapEnabled', 'ldapUrl', 'ldapBindDn', 'ldapBindPassword', 'ldapSearchBase', 'ldapSearchFilter', 'rateLimit', 'sleepInterval', 'proxyAuthEnabled', 'proxyAuthHeader', 'versionCheckEnabled', 'rydEnabled'];

	let diskInfo = $state<{ totalBytes: string; availableBytes: string } | null>(null);
	let diskTotalGB = $derived(diskInfo ? Number(BigInt(diskInfo.totalBytes)) / (1024 * 1024 * 1024) : null);
	let cacheQuotaGB = $derived(settings ? Math.floor(Number(BigInt(settings.cacheQuotaBytes || '10737418240')) / (1024 * 1024 * 1024)) : 10);
	let cacheQuotaExceedsDisk = $derived(diskTotalGB !== null && cacheQuotaGB > diskTotalGB);
	let libraryEnabled = $derived(settings ? !!settings.libraryPath : false);
	let jellyfinEnabled = $derived(settings ? !!(settings.jellyfinUrl || settings.jellyfinApiKey) : false);
	let plexEnabled = $derived(settings ? !!(settings.plexUrl || settings.plexToken) : false);
	let cleanupEnabled = $derived(settings ? !!settings.cleanupEnabled : false);

	async function loadDiskInfo() {
		try {
			const res = await fetch('/api/settings/disk');
			if (res.ok) {
				diskInfo = await res.json();
			}
		} catch {
			// disk info is best-effort
		}
	}

	function updateCacheQuota(gb: number) {
		if (settings) {
			settings.cacheQuotaBytes = String(Math.round(gb * 1024 * 1024 * 1024));
		}
	}

	function toggleLibrary(enabled: boolean) {
		if (!settings) return;
		if (enabled) {
			settings.libraryPath = settings.libraryPath || '/media';
		} else {
			settings.libraryPath = null;
			settings.musicLibraryPath = null;
		}
	}

	let testingJellyfin = $state(false);
	let jellyfinTestResult = $state<{ success: boolean; message: string } | null>(null);
	let jellyfinUsers = $state<{ id: string; name: string }[]>([]);
	let loadingJellyfinUsers = $state(false);
	let jellyfinUsersError = $state<string | null>(null);

	async function loadJellyfinUsers() {
		if (!settings?.jellyfinUrl || !settings?.jellyfinApiKey) return;
		loadingJellyfinUsers = true;
		jellyfinUsersError = null;
		try {
			const res = await fetch('/api/settings/jellyfin-users');
			if (res.ok) {
				jellyfinUsers = await res.json();
				if (jellyfinUsers.length === 0) {
					jellyfinUsersError = 'No users found on Jellyfin server';
				}
			} else {
				const data = await res.json().catch(() => null);
				jellyfinUsersError = data?.message || `Failed to fetch users (${res.status})`;
			}
		} catch {
			jellyfinUsersError = 'Could not connect to Jellyfin';
			jellyfinUsers = [];
		} finally {
			loadingJellyfinUsers = false;
		}
	}

	function toggleCleanupUser(userId: string) {
		if (!settings) return;
		const current: string[] = settings.cleanupUserIds || [];
		if (current.includes(userId)) {
			settings.cleanupUserIds = current.filter((id: string) => id !== userId);
		} else {
			settings.cleanupUserIds = [...current, userId];
		}
	}

	// Cookie management
	let cookieStatus = $state<{ hasCookies: boolean; path: string | null }>({ hasCookies: false, path: null });
	let uploadingCookies = $state(false);
	let cookieError = $state<string | null>(null);

	async function loadCookieStatus() {
		try {
			const res = await fetch('/api/settings/cookies');
			if (res.ok) {
				cookieStatus = await res.json();
			}
		} catch {
			// best-effort
		}
	}

	async function uploadCookieFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploadingCookies = true;
		cookieError = null;

		try {
			const formData = new FormData();
			formData.append('file', file);

			const res = await fetch('/api/settings/cookies', {
				method: 'POST',
				body: formData,
			});

			if (res.ok) {
				await loadCookieStatus();
				addToast('success', 'Cookie file uploaded');
			} else {
				const data = await res.json().catch(() => null);
				cookieError = data?.message || 'Failed to upload cookie file';
			}
		} catch {
			cookieError = 'Failed to upload cookie file';
		} finally {
			uploadingCookies = false;
			input.value = '';
		}
	}

	async function deleteCookieFile() {
		try {
			const res = await fetch('/api/settings/cookies', { method: 'DELETE' });
			if (res.ok) {
				cookieStatus = { hasCookies: false, path: null };
				addToast('success', 'Cookie file removed');
			} else {
				addToast('error', 'Failed to remove cookie file');
			}
		} catch {
			addToast('error', 'Failed to remove cookie file');
		}
	}

	let testingNotification = $state(false);
	let notificationTestResult = $state<{ success: boolean; message: string } | null>(null);

	async function testNotification() {
		testingNotification = true;
		notificationTestResult = null;
		try {
			const res = await fetch('/api/notifications/test', { method: 'POST' });
			if (res.ok) {
				notificationTestResult = { success: true, message: 'Notification sent' };
			} else {
				const data = await res.json().catch(() => null);
				notificationTestResult = { success: false, message: data?.message || 'Failed to send' };
			}
		} catch {
			notificationTestResult = { success: false, message: 'Request failed' };
		} finally {
			testingNotification = false;
		}
	}

	function toggleJellyfin(enabled: boolean) {
		if (!settings) return;
		jellyfinTestResult = null;
		if (enabled) {
			settings.jellyfinUrl = settings.jellyfinUrl || 'http://jellyfin:8096';
			settings.jellyfinApiKey = settings.jellyfinApiKey || '';
		} else {
			settings.jellyfinUrl = null;
			settings.jellyfinApiKey = null;
			settings.jellyfinExternalUrl = null;
		}
	}

	async function testJellyfinConnection() {
		if (!settings?.jellyfinUrl || !settings?.jellyfinApiKey) return;
		testingJellyfin = true;
		jellyfinTestResult = null;
		try {
			const res = await fetch('/api/settings/jellyfin-test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: settings.jellyfinUrl, apiKey: settings.jellyfinApiKey }),
			});
			const data = await res.json();
			if (data.success) {
				jellyfinTestResult = { success: true, message: `Connected to ${data.serverName}` };
			} else {
				jellyfinTestResult = { success: false, message: data.error };
			}
		} catch {
			jellyfinTestResult = { success: false, message: 'Request failed' };
		} finally {
			testingJellyfin = false;
		}
	}

	let testingPlex = $state(false);
	let plexTestResult = $state<{ success: boolean; message: string } | null>(null);

	function togglePlex(enabled: boolean) {
		if (!settings) return;
		plexTestResult = null;
		if (enabled) {
			settings.plexUrl = settings.plexUrl || 'http://localhost:32400';
			settings.plexToken = settings.plexToken || '';
		} else {
			settings.plexUrl = null;
			settings.plexToken = null;
		}
	}

	async function testPlexConnection() {
		if (!settings?.plexUrl || !settings?.plexToken) return;
		testingPlex = true;
		plexTestResult = null;
		try {
			const res = await fetch('/api/settings/plex/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: settings.plexUrl, token: settings.plexToken }),
			});
			const data = await res.json();
			if (data.success) {
				plexTestResult = { success: true, message: `Connected to ${data.serverName}` };
			} else {
				plexTestResult = { success: false, message: data.error };
			}
		} catch {
			plexTestResult = { success: false, message: 'Request failed' };
		} finally {
			testingPlex = false;
		}
	}

	async function saveSettings() {
		saving = true;
		try {
			const payload: Record<string, any> = {};
			for (const key of SAVEABLE_FIELDS) {
				if (key in settings) payload[key] = settings[key];
			}
			const res = await fetch('/api/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				addToast('error', 'Failed to save settings');
			}
		} catch (e) {
			console.error('Failed to save settings:', e);
			addToast('error', 'Failed to save settings');
		} finally {
			saving = false;
		}
	}

	function debouncedSave() {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => saveSettings(), 800);
	}

	$effect(() => {
		if (!settingsLoaded || !settings) return;
		const current = JSON.stringify(settings);
		if (current === settingsSnapshot) return;
		settingsSnapshot = current;
		debouncedSave();
	});

	async function toggleAdmin(user: any) {
		const confirmed = await showConfirm(
			`${user.isAdmin ? 'Demote' : 'Promote'} User`,
			`Are you sure you want to ${user.isAdmin ? 'demote' : 'promote'} ${user.name}?`,
			user.isAdmin ? 'Demote' : 'Promote'
		);
		if (!confirmed) return;

		try {
			const res = await fetch(`/api/users/${user.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isAdmin: !user.isAdmin }),
			});

			if (res.ok) {
				await loadUsers();
			} else {
				const data = await res.json();
				addToast('error', data.message || 'Failed to update user');
			}
		} catch (e: any) {
			addToast('error', e.message || 'Failed to update user');
		}
	}

	async function deleteUser(user: any) {
		const confirmed = await showConfirm(
			'Delete User',
			`Are you sure you want to delete ${user.name}? This action cannot be undone.`,
			'Delete',
			'Cancel'
		);
		if (!confirmed) return;

		try {
			const res = await fetch(`/api/users/${user.id}`, {
				method: 'DELETE',
			});

			if (res.ok) {
				await loadUsers();
			} else {
				const data = await res.json();
				addToast('error', data.message || 'Failed to delete user');
			}
		} catch (e: any) {
			addToast('error', e.message || 'Failed to delete user');
		}
	}

	async function createUser() {
		createUserError = '';

		if (!newUser.email || !newUser.password || !newUser.name) {
			createUserError = 'All fields are required';
			return;
		}

		try {
			const res = await fetch('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newUser),
			});

			if (res.ok) {
				await loadUsers();
				showCreateUser = false;
				newUser = { email: '', password: '', name: '', isAdmin: false };
			} else {
				const data = await res.json();
				createUserError = data.message || 'Failed to create user';
			}
		} catch (e: any) {
			createUserError = e.message || 'Failed to create user';
		}
	}

	function openPasswordChange(userId: string) {
		passwordChangeUserId = userId;
		passwordForm = {
			newPassword: '',
			confirmPassword: '',
		};
		passwordError = '';
	}

	function closePasswordChange() {
		passwordChangeUserId = null;
		passwordForm = {
			newPassword: '',
			confirmPassword: '',
		};
		passwordError = '';
	}

	async function loadApiKeys() {
		try {
			const res = await fetch('/api/keys');
			if (res.ok) apiKeys = await res.json();
		} catch {
			// best-effort
		}
	}

	async function createApiKey() {
		if (!newKeyName.trim()) return;
		try {
			const res = await fetch('/api/keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newKeyName }),
			});
			if (res.ok) {
				const data = await res.json();
				newKeyResult = data.key;
				newKeyName = '';
				await loadApiKeys();
				addToast('success', 'API key created');
			}
		} catch {
			addToast('error', 'Failed to create API key');
		}
	}

	async function revokeApiKey(id: string) {
		const confirmed = await showConfirm('Revoke API Key', 'This key will stop working immediately.', 'Revoke');
		if (!confirmed) return;
		try {
			const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
			if (res.ok) {
				await loadApiKeys();
				addToast('success', 'API key revoked');
			}
		} catch {
			addToast('error', 'Failed to revoke key');
		}
	}

	async function changePassword() {
		passwordError = '';

		if (!passwordChangeUserId) return;

		// Validation
		if (!passwordForm.newPassword) {
			passwordError = 'New password is required';
			return;
		}

		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			passwordError = 'Passwords do not match';
			return;
		}

		try {
			const res = await fetch(`/api/users/${passwordChangeUserId}/password`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newPassword: passwordForm.newPassword }),
			});

			if (res.ok) {
				addToast('success', 'Password changed successfully');
				closePasswordChange();
			} else {
				const data = await res.json();
				passwordError = data.message || 'Failed to change password';
			}
		} catch (e: any) {
			passwordError = e.message || 'Failed to change password';
		}
	}
</script>

<svelte:head>
	<title>Settings - wytui</title>
</svelte:head>

<div class="page">
	{#if isAdmin}
		<div class="tabs-wrapper">
			<a href="/" class="back-arrow" aria-label="Back to home">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
			</a>
			<div class="tabs">
				<button
					class="tab"
					class:active={activeTab === 'general'}
					onclick={() => (activeTab = 'general')}
				>
					General
				</button>
				<button
					class="tab"
					class:active={activeTab === 'users'}
					onclick={() => (activeTab = 'users')}
				>
					Users
				</button>
			</div>
		</div>
	{:else}
		<div class="tabs-wrapper">
			<a href="/" class="back-arrow" aria-label="Back to home">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
			</a>

		</div>
	{/if}

	{#if !isAdmin}
		<div class="settings-section">
			<h2>Account</h2>
			<p class="text-muted">Manage your account settings.</p>
			<button
				class="btn-primary"
				onclick={() => openPasswordChange(data.session?.user?.id || '')}
			>
				Change Password
			</button>
		</div>
	{:else if loading}
		<div class="general-settings">
			<Skeleton count={3} variant="row" />
		</div>
	{:else}
		{#if activeTab === 'general' && settings}
			<div class="general-settings">
				<div class="settings-section">
					<h2>Storage</h2>

					<div class="form-row">
						<div class="form-group">
							<label for="downloadPath">Cache Path</label>
							<input
								type="text"
								id="downloadPath"
								bind:value={settings.downloadPath}
								readonly
							/>
							<p class="help-text">Temporary storage for downloads</p>
						</div>

						<div class="form-group">
							<label for="cacheQuota">Cache Quota (GB)</label>
							<input
								type="number"
								id="cacheQuota"
								value={cacheQuotaGB}
								oninput={(e) => updateCacheQuota(parseFloat(e.currentTarget.value) || 0)}
								min="1"
								max={diskTotalGB ? Math.floor(diskTotalGB) : undefined}
								step="1"
							/>
							{#if cacheQuotaExceedsDisk && diskTotalGB}
								<p class="help-text error-text">Exceeds total disk space ({diskTotalGB.toFixed(1)} GB)</p>
							{:else if diskTotalGB}
								<p class="help-text">{diskTotalGB.toFixed(1)} GB total on disk</p>
							{:else}
								<p class="help-text">Oldest downloads are auto-removed when exceeded</p>
							{/if}
						</div>
					</div>

					<div class="form-group">
						<label class="toggle-label">
							<input
								type="checkbox"
								checked={libraryEnabled}
								onchange={(e) => toggleLibrary(e.currentTarget.checked)}
							/>
							Enable Library
						</label>
						<p class="help-text">Save downloads permanently, organized by uploader</p>
					</div>

					{#if libraryEnabled}
						<div class="form-group nested-field">
							<label for="libraryPath">Video Library Path</label>
							<PathBrowser
								id="libraryPath"
								bind:value={settings.libraryPath}
								placeholder="/media"
							/>
						</div>

						<div class="form-group nested-field">
							<label for="musicLibraryPath">Music Library Path</label>
							<PathBrowser
								id="musicLibraryPath"
								bind:value={settings.musicLibraryPath}
								placeholder="/media/music"
							/>
							<p class="help-text">Audio-only downloads go here instead. Leave empty to use the video library path for everything.</p>
						</div>
					{/if}

					<div class="form-row">
						<div class="form-group">
							<label for="maxConcurrent">Max Concurrent Downloads</label>
							<input
								type="number"
								id="maxConcurrent"
								bind:value={settings.maxConcurrentDownloads}
								min="1"
								max="10"
							/>
						</div>

						<div class="form-group">
							<label for="maxDuration">Max Duration (hours)</label>
							<input
								type="number"
								id="maxDuration"
								value={settings.maxDurationSeconds ? Math.round(settings.maxDurationSeconds / 3600) : 3}
								oninput={(e) => {
									const hours = parseFloat(e.currentTarget.value) || 3;
									settings.maxDurationSeconds = Math.round(hours * 3600);
								}}
								min="0"
								step="0.5"
							/>
							<p class="help-text">Skip downloads longer than this (0 = no limit)</p>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="rateLimit">Speed Limit</label>
							<input
								type="text"
								id="rateLimit"
								bind:value={settings.rateLimit}
								placeholder="Unlimited"
							/>
							<p class="help-text">e.g. "5M" for 5 MB/s, "500K" for 500 KB/s</p>
						</div>

						<div class="form-group">
							<label for="sleepInterval">Sleep Between Downloads (seconds)</label>
							<input
								type="number"
								id="sleepInterval"
								bind:value={settings.sleepInterval}
								min="0"
								max="3600"
								placeholder="0"
							/>
							<p class="help-text">Wait time between consecutive downloads</p>
						</div>
					</div>

					<div class="form-group">
						<label>
							<input
								type="checkbox"
								bind:checked={settings.enableArchive}
							/>
							Deduplicate downloads
						</label>
						<p class="help-text">Track downloaded videos to prevent re-downloading the same content</p>
					</div>
				</div>

				<div class="settings-section">
					<h2>Jellyfin</h2>

					<div class="form-group">
						<label class="toggle-label">
							<input
								type="checkbox"
								checked={jellyfinEnabled}
								onchange={(e) => toggleJellyfin(e.currentTarget.checked)}
							/>
							Enable Jellyfin Integration
						</label>
						<p class="help-text">Triggers a library scan when downloads are saved to library</p>
					</div>

					{#if jellyfinEnabled}
						<div class="form-row nested-field">
							<div class="form-group">
								<label for="jellyfinUrl">Server URL</label>
								<input
									type="text"
									id="jellyfinUrl"
									bind:value={settings.jellyfinUrl}
									placeholder="http://jellyfin:8096"
								/>
							</div>

							<div class="form-group">
								<label for="jellyfinApiKey">API Key</label>
								<input
									type="password"
									id="jellyfinApiKey"
									bind:value={settings.jellyfinApiKey}
									placeholder="Enter API key"
								/>
								<p class="help-text">Dashboard > API Keys in Jellyfin</p>
							</div>

							<div class="form-group">
								<label for="jellyfinExternalUrl">External URL</label>
								<input
									type="text"
									id="jellyfinExternalUrl"
									bind:value={settings.jellyfinExternalUrl}
									placeholder="https://jellyfin.example.com"
								/>
								<p class="help-text">Public URL used for "Open in Jellyfin" links. Defaults to Server URL if empty.</p>
							</div>
						</div>
						<div class="jellyfin-test nested-field">
							<button
								type="button"
								class="btn-secondary btn-sm btn-with-icon"
								onclick={testJellyfinConnection}
								disabled={testingJellyfin || !settings.jellyfinUrl || !settings.jellyfinApiKey}
							>
								<ZapIcon width={14} height={14} />
								{testingJellyfin ? 'Testing...' : 'Test Connection'}
							</button>
							{#if jellyfinTestResult}
								<span class="test-result" class:success={jellyfinTestResult.success} class:error={!jellyfinTestResult.success}>
									{jellyfinTestResult.message}
								</span>
							{/if}
						</div>

						<div class="cleanup-section nested-field">
							<div class="form-group">
								<label class="toggle-label">
									<input
										type="checkbox"
										bind:checked={settings.cleanupEnabled}
										onchange={() => {
											if (settings.cleanupEnabled && jellyfinUsers.length === 0) {
												loadJellyfinUsers();
											}
										}}
									/>
									Auto-Cleanup Watched Items
								</label>
								<p class="help-text">Automatically delete library items after all selected users have watched them</p>
							</div>

							{#if cleanupEnabled}
								<div class="form-group nested-field">
									<label>Watch Users</label>
									{#if loadingJellyfinUsers}
										<p class="text-muted">Loading users...</p>
									{:else if jellyfinUsers.length === 0}
										<button class="btn-secondary btn-sm btn-with-icon" onclick={loadJellyfinUsers}>
											<UsersIcon width={14} height={14} />
											{jellyfinUsersError ? 'Retry' : 'Load Jellyfin Users'}
										</button>
										{#if jellyfinUsersError}
											<span class="test-result error">{jellyfinUsersError}</span>
										{/if}
									{:else}
										<div class="user-checkboxes">
											{#each jellyfinUsers as user}
												<label class="checkbox-label">
													<input
														type="checkbox"
														checked={(settings.cleanupUserIds || []).includes(user.id)}
														onchange={() => toggleCleanupUser(user.id)}
													/>
													{user.name}
												</label>
											{/each}
										</div>
										<button class="btn-secondary btn-sm btn-with-icon" onclick={loadJellyfinUsers} style="margin-top: var(--spacing-sm); align-self: flex-start;">
											<RefreshIcon width={14} height={14} />
											Refresh
										</button>
									{/if}
									<p class="help-text">Item is deleted only when ALL selected users have watched it</p>
								</div>

								<div class="form-row nested-field">
									<div class="form-group">
										<label for="cleanupInterval">Check Interval (hours)</label>
										<input
											type="number"
											id="cleanupInterval"
											value={settings.cleanupIntervalSeconds ? Math.round(settings.cleanupIntervalSeconds / 3600) : 1}
											oninput={(e) => {
												const hours = parseFloat(e.currentTarget.value) || 1;
												settings.cleanupIntervalSeconds = Math.round(hours * 3600);
											}}
											min="1"
											max="24"
											step="1"
										/>
									</div>

									<div class="form-group">
										<label for="cleanupGraceHours">Grace Period (hours)</label>
										<input
											type="number"
											id="cleanupGraceHours"
											bind:value={settings.cleanupGraceHours}
											min="0"
											max="720"
											step="1"
										/>
										<p class="help-text">Wait time after all users watched before deleting</p>
									</div>
								</div>

								<div class="form-group nested-field">
									<label>Profile Types</label>
									<div class="user-checkboxes">
										<label class="checkbox-label">
											<input
												type="checkbox"
												checked={(settings.cleanupProfileTypes || []).includes('video')}
												onchange={() => {
													const types: string[] = settings.cleanupProfileTypes || [];
													settings.cleanupProfileTypes = types.includes('video')
														? types.filter((t: string) => t !== 'video')
														: [...types, 'video'];
												}}
											/>
											Video
										</label>
										<label class="checkbox-label">
											<input
												type="checkbox"
												checked={(settings.cleanupProfileTypes || []).includes('music')}
												onchange={() => {
													const types: string[] = settings.cleanupProfileTypes || [];
													settings.cleanupProfileTypes = types.includes('music')
														? types.filter((t: string) => t !== 'music')
														: [...types, 'music'];
												}}
											/>
											Music
										</label>
									</div>
									<p class="help-text">Which download types to auto-clean</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<div class="settings-section">
					<h2>Plex</h2>

					<div class="form-group">
						<label class="toggle-label">
							<input
								type="checkbox"
								checked={plexEnabled}
								onchange={(e) => togglePlex(e.currentTarget.checked)}
							/>
							Enable Plex Integration
						</label>
						<p class="help-text">Triggers a library scan when downloads are saved to library</p>
					</div>

					{#if plexEnabled}
						<div class="form-row nested-field">
							<div class="form-group">
								<label for="plexUrl">Server URL</label>
								<input
									type="text"
									id="plexUrl"
									bind:value={settings.plexUrl}
									placeholder="http://localhost:32400"
								/>
							</div>

							<div class="form-group">
								<label for="plexToken">Token</label>
								<input
									type="password"
									id="plexToken"
									bind:value={settings.plexToken}
									placeholder="Enter Plex token"
								/>
								<p class="help-text">Find your token at plex.tv/claim or in Plex server XML</p>
							</div>
						</div>
						<div class="jellyfin-test nested-field">
							<button
								type="button"
								class="btn-secondary btn-sm btn-with-icon"
								onclick={testPlexConnection}
								disabled={testingPlex || !settings.plexUrl || !settings.plexToken}
							>
								<ZapIcon width={14} height={14} />
								{testingPlex ? 'Testing...' : 'Test Connection'}
							</button>
							{#if plexTestResult}
								<span class="test-result" class:success={plexTestResult.success} class:error={!plexTestResult.success}>
									{plexTestResult.message}
								</span>
							{/if}
						</div>
					{/if}
				</div>

				<div class="settings-section">
					<h2>yt-dlp</h2>
					<div class="form-group">
						<label>
							<input
								type="checkbox"
								bind:checked={settings.autoUpdateYtdlp}
							/>
							Auto-update yt-dlp
						</label>
					</div>

					{#if settings.ytdlpVersion}
						<div class="info-box">
							<strong>Current version:</strong> {settings.ytdlpVersion}
						</div>
					{/if}
				</div>

				<div class="settings-section">
					<h2>Version Check</h2>
					<div class="form-group">
						<label>
							<input
								type="checkbox"
								bind:checked={settings.versionCheckEnabled}
							/>
							Check for new versions
						</label>
						<p class="help-text">Periodically check GitHub for new releases and show an indicator in the sidebar</p>
					</div>
				</div>

				<div class="settings-section">
					<h2>Cookies</h2>
					<p class="help-text" style="margin-bottom: var(--spacing-lg);">
						Upload a Netscape-format cookies.txt file to access member-only and age-restricted content.
					</p>

					{#if cookieStatus.hasCookies}
						<div class="info-box" style="margin-bottom: var(--spacing-md);">
							Cookie file is active.
						</div>
						<button
							class="btn-danger btn-sm btn-with-icon"
							onclick={deleteCookieFile}
						>
							<TrashIcon width={14} height={14} />
							Remove Cookies
						</button>
					{:else}
						<label class="cookie-upload-label btn-secondary btn-sm btn-with-icon">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
							{uploadingCookies ? 'Uploading...' : 'Upload cookies.txt'}
							<input
								type="file"
								accept=".txt"
								onchange={uploadCookieFile}
								disabled={uploadingCookies}
								style="display: none;"
							/>
						</label>
					{/if}

					{#if cookieError}
						<div class="error-message" style="margin-top: var(--spacing-md);">
							{cookieError}
						</div>
					{/if}
				</div>

				<div class="settings-section">
					<h2>Auto-Delete</h2>
					<div class="form-group">
						<label for="autoDeleteDays">Delete watched videos after (days)</label>
						<input
							type="number"
							id="autoDeleteDays"
							bind:value={settings.autoDeleteWatchedDays}
							min="0"
							placeholder="Disabled"
						/>
						<p class="help-text">Automatically delete watched cache downloads after this many days. Set to 0 or leave empty to disable. Library items are never auto-deleted.</p>
					</div>
				</div>

				<div class="settings-section">
					<h2>Return YouTube Dislike</h2>
					<div class="form-group">
						<label>
							<input
								type="checkbox"
								bind:checked={settings.rydEnabled}
							/>
							Enable dislike counts
						</label>
						<p class="help-text">Fetch dislike counts from the Return YouTube Dislike API when downloading videos. When enabled, video IDs are sent to an external service (<a href="https://returnyoutubedislike.com" target="_blank" rel="noopener noreferrer">returnyoutubedislike.com</a>).</p>
					</div>
				</div>

				<div class="settings-section">
					<h2>Rescan Library</h2>
					<p class="help-text" style="margin-bottom: var(--spacing-lg);">Check that downloaded files still exist on disk. Finds completed downloads whose files are missing.</p>

					<div class="rescan-actions">
						<button
							class="btn-secondary btn-sm btn-with-icon"
							onclick={runRescan}
							disabled={rescanning}
						>
							<RefreshIcon width={14} height={14} />
							{rescanning ? 'Scanning...' : 'Rescan Now'}
						</button>
					</div>

					{#if rescanReport}
						<div class="rescan-results">
							<div class="rescan-summary">
								<span class="rescan-stat ok">{rescanReport.ok} OK</span>
								<span class="rescan-stat" class:missing={rescanReport.missing.length > 0}>{rescanReport.missing.length} missing</span>
							</div>

							{#if rescanReport.missing.length > 0}
								<div class="rescan-missing-list">
									<div class="rescan-bulk-actions">
										<button
											class="btn-secondary btn-sm btn-with-icon"
											onclick={() => markRescanMissing(rescanReport!.missing.map(m => m.id))}
											disabled={reconciling}
										>
											Mark all as deleted
										</button>
										<button
											class="btn-danger btn-sm btn-with-icon"
											onclick={() => deleteRescanRecords(rescanReport!.missing.map(m => m.id))}
											disabled={reconciling}
										>
											<TrashIcon width={14} height={14} />
											Delete all records
										</button>
									</div>

									{#each rescanReport.missing as item}
										<div class="rescan-missing-item">
											<div class="rescan-missing-info">
												<span class="rescan-missing-title">{item.title || 'Untitled'}</span>
												<code class="rescan-missing-path">{item.filepath}</code>
											</div>
											<div class="rescan-missing-actions">
												<button
													class="btn-danger btn-sm btn-icon"
													onclick={() => deleteRescanRecords([item.id])}
													disabled={reconciling}
													aria-label="Delete record"
													title="Delete record"
												>
													<TrashIcon width={14} height={14} />
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<div class="settings-section">
					<h2>Notifications</h2>
					<div class="form-group">
						<label for="appriseUrl">Apprise URL</label>
						<input
							type="text"
							id="appriseUrl"
							bind:value={settings.appriseUrl}
							placeholder="http://apprise:8000"
						/>
						<p class="help-text">URL of your Apprise API server for push notifications</p>
					</div>

					{#if settings.appriseUrl}
						<div class="form-group">
							<label>
								<input type="checkbox" bind:checked={settings.notifyOnComplete} />
								Notify on download complete
							</label>
						</div>
						<div class="form-group">
							<label>
								<input type="checkbox" bind:checked={settings.notifyOnFail} />
								Notify on download failure
							</label>
						</div>
						<div class="jellyfin-test nested-field">
							<button
								type="button"
								class="btn-secondary btn-sm btn-with-icon"
								onclick={testNotification}
								disabled={testingNotification}
							>
								<BellIcon width={14} height={14} />
								{testingNotification ? 'Sending...' : 'Test Notification'}
							</button>
							{#if notificationTestResult}
								<span class="test-result" class:success={notificationTestResult.success} class:error={!notificationTestResult.success}>
									{notificationTestResult.message}
								</span>
							{/if}
						</div>
					{/if}
				</div>

				<div class="settings-section">
					<h2>Backup</h2>
					<div class="form-group">
						<label>
							<input type="checkbox" bind:checked={settings.backupEnabled} />
							Enable scheduled backups
						</label>
					</div>

					{#if settings.backupEnabled}
						<div class="form-row nested-field">
							<div class="form-group">
								<label for="backupCron">Backup schedule (cron)</label>
								<input
									type="text"
									id="backupCron"
									bind:value={settings.backupCron}
									placeholder="0 2 * * *"
								/>
								<p class="help-text">Cron expression (e.g. "0 2 * * *" for daily at 2 AM)</p>
							</div>
							<div class="form-group">
								<label for="backupPath">Backup path</label>
								<input
									type="text"
									id="backupPath"
									bind:value={settings.backupPath}
									placeholder="/backups"
								/>
							</div>
						</div>
					{/if}
				</div>

				<div class="settings-section">
					<h2>LDAP</h2>
					<div class="form-group">
						<label>
							<input type="checkbox" bind:checked={settings.ldapEnabled} />
							Enable LDAP authentication
						</label>
						<p class="help-text">Users authenticating via LDAP are auto-created on first login</p>
					</div>

					{#if settings.ldapEnabled}
						<div class="form-group nested-field">
							<label for="ldapUrl">LDAP Server URL</label>
							<input
								type="text"
								id="ldapUrl"
								bind:value={settings.ldapUrl}
								placeholder="ldap://ldap.example.com:389"
							/>
						</div>
						<div class="form-row nested-field">
							<div class="form-group">
								<label for="ldapBindDn">Bind DN</label>
								<input
									type="text"
									id="ldapBindDn"
									bind:value={settings.ldapBindDn}
									placeholder="cn=admin,dc=example,dc=com"
								/>
							</div>
							<div class="form-group">
								<label for="ldapBindPassword">Bind Password</label>
								<input
									type="password"
									id="ldapBindPassword"
									bind:value={settings.ldapBindPassword}
									placeholder="••••••••"
								/>
							</div>
						</div>
						<div class="form-group nested-field">
							<label for="ldapSearchBase">Search Base</label>
							<input
								type="text"
								id="ldapSearchBase"
								bind:value={settings.ldapSearchBase}
								placeholder="ou=users,dc=example,dc=com"
							/>
						</div>
						<div class="form-group nested-field">
							<label for="ldapSearchFilter">Search Filter</label>
							<input
								type="text"
								id="ldapSearchFilter"
								bind:value={settings.ldapSearchFilter}
								placeholder={'(uid={{username}})'}
							/>
							<p class="help-text">Use {"{{username}}"} as placeholder. For Active Directory use (sAMAccountName={"{{username}}"})</p>
						</div>
					{/if}
				</div>

				<div class="settings-section">
					<h2>Reverse Proxy Auth</h2>
					<div class="form-group">
						<label>
							<input type="checkbox" bind:checked={settings.proxyAuthEnabled} />
							Enable reverse proxy authentication
						</label>
						<p class="help-text">Automatically log in users based on a header set by your reverse proxy (Authelia, Authentik, etc.)</p>
					</div>

					{#if settings.proxyAuthEnabled}
						<div class="info-box warning-box" style="margin-bottom: var(--spacing-lg);">
							Only enable this if wytui is behind a trusted reverse proxy that sets the authentication header. If users can reach wytui directly, they can forge the header and impersonate any user.
						</div>

						<div class="form-group nested-field">
							<label for="proxyAuthHeader">Auth Header Name</label>
							<input
								type="text"
								id="proxyAuthHeader"
								bind:value={settings.proxyAuthHeader}
								placeholder="X-Forwarded-User"
							/>
							<p class="help-text">The HTTP header your reverse proxy sets with the authenticated username or email. Common values: <code>X-Forwarded-User</code>, <code>Remote-User</code>, <code>X-Authentik-Username</code></p>
						</div>
					{/if}
				</div>

				{#if settings.oidcConfigured}
					<div class="settings-section">
						<h2>Authentication</h2>
						<div class="form-group">
							<label for="authMode">Login Method</label>
							<select
								id="authMode"
								bind:value={settings.authMode}
							>
								<option value="password" disabled={!settings.canUsePasswordOnly}>Password Only{!settings.canUsePasswordOnly ? ' (no admin has a password)' : ''}</option>
								<option value="both">Password + {settings.oidcDisplayName || 'SSO'}</option>
								<option value="oidc">{settings.oidcDisplayName || 'SSO'} Only</option>
							</select>
							<p class="help-text">Choose which login methods are shown on the sign-in page</p>
							{#if !settings.canUsePasswordOnly}
								<div class="info-box warning-box">
									Password-only mode is unavailable because no admin account has a password set. Set a password for an admin account to enable this option.
								</div>
							{/if}
						</div>

						{#if settings.authMode === 'oidc'}
							<div class="info-box warning-box">
								Password login will remain accessible at <code>/auth/signin?fallback=password</code> as a safety fallback in case SSO is unavailable.
							</div>
						{/if}
					</div>
				{/if}

			</div>

			<div class="api-docs-link">
				<a href="/docs" class="btn-secondary btn-lg">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
					API Documentation
				</a>
			</div>
		{/if}

		{#if activeTab === 'users'}
			<div class="settings-section">
				<div class="section-header">
					<h2>User Management</h2>
					<button class="btn-secondary" onclick={() => (showCreateUser = !showCreateUser)}>
						{showCreateUser ? 'Cancel' : '+ Add User'}
					</button>
				</div>

				{#if showCreateUser}
					<div class="create-user-form">
						<h3>Create New User</h3>

						{#if createUserError}
							<div class="error-message">{createUserError}</div>
						{/if}

						<div class="form-group">
							<label for="new-name">Name</label>
							<input
								type="text"
								id="new-name"
								bind:value={newUser.name}
								placeholder="John Doe"
							/>
						</div>

						<div class="form-group">
							<label for="new-email">Email</label>
							<input
								type="email"
								id="new-email"
								bind:value={newUser.email}
								placeholder="user@example.com"
							/>
						</div>

						<div class="form-group">
							<label for="new-password">Password</label>
							<input
								type="password"
								id="new-password"
								bind:value={newUser.password}
								placeholder="Enter a password"
							/>
							{#if newUser.password.length > 0}
								<div class="password-suggestions">
									<span class="suggestion" class:met={newUser.password.length >= 8}>8+ characters</span>
									<span class="suggestion" class:met={/[a-z]/.test(newUser.password)}>lowercase</span>
									<span class="suggestion" class:met={/[A-Z]/.test(newUser.password)}>uppercase</span>
									<span class="suggestion" class:met={/[0-9]/.test(newUser.password)}>number</span>
									<span class="suggestion" class:met={/[^a-zA-Z0-9]/.test(newUser.password)}>special character</span>
								</div>
							{/if}
						</div>

						<div class="form-group">
							<label>
								<input type="checkbox" bind:checked={newUser.isAdmin} />
								Admin privileges
							</label>
						</div>

						<button class="btn-primary" onclick={createUser}>Create User</button>
					</div>
				{/if}

				<div class="users-list">
					{#each users as user}
						<div class="user-card">
							<div class="user-info">
								<div class="user-name">
									{user.name}
									{#if user.isAdmin}
										<span class="badge badge-admin">Admin</span>
									{/if}
									{#if user.id === data.session?.user?.id}
										<span class="badge badge-you">You</span>
									{/if}
								</div>
								<div class="user-email">{user.email}</div>
								<div class="user-stats">
									{user._count.downloads} downloads • {user._count.subscriptions} subscriptions
								</div>
							</div>
							<div class="user-actions">
								{#if user.id === data.session?.user?.id}
									<button
										class="btn-secondary btn-sm btn-with-icon"
										onclick={() => openPasswordChange(user.id)}
									>
										<LockIcon width={14} height={14} />
										Change Password
									</button>
								{:else if data.session?.user?.isAdmin && !user.isAdmin}
									<button
										class="btn-secondary btn-sm btn-with-icon"
										onclick={() => openPasswordChange(user.id)}
									>
										<LockIcon width={14} height={14} />
										Change Password
									</button>
								{/if}

								{#if data.session?.user?.isAdmin}
									<button
										class="btn-secondary btn-sm btn-with-icon"
										onclick={() => toggleAdmin(user)}
									>
										<ShieldIcon width={14} height={14} />
										{user.isAdmin ? 'Demote' : 'Promote'}
									</button>
								{/if}

								{#if data.session?.user?.isAdmin}
									<button
										class="btn-danger btn-sm btn-with-icon"
										onclick={() => deleteUser(user)}
									>
										<TrashIcon width={14} height={14} />
										Delete
									</button>
								{/if}
							</div>
						</div>
					{/each}

					{#if users.length === 0}
						<div class="empty-state">No users found</div>
					{/if}
				</div>
			</div>

			<div class="settings-section api-keys-section">
				<h2>API Keys</h2>
				<p class="text-muted">Create keys for programmatic access. Use as <code>Authorization: Bearer &lt;key&gt;</code></p>

				{#if newKeyResult}
					<div class="info-box warning-box">
						<strong>Copy your key now — it won't be shown again:</strong>
						<code class="api-key-display">{newKeyResult}</code>
						<button class="btn-secondary btn-sm btn-icon" onclick={() => { navigator.clipboard.writeText(newKeyResult!); addToast('success', 'Copied'); }} aria-label="Copy key" title="Copy key">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
						</button>
						<button class="btn-secondary btn-sm btn-icon" onclick={() => newKeyResult = null} aria-label="Dismiss" title="Dismiss">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>
				{/if}

				<div class="create-key-form">
					<input type="text" bind:value={newKeyName} placeholder="Key name (e.g. CI/CD)" />
					<button class="btn-primary btn-sm" onclick={createApiKey} disabled={!newKeyName.trim()}>Create Key</button>
				</div>

				{#if apiKeys.length > 0}
					<div class="api-keys-list">
						{#each apiKeys as key}
							<div class="api-key-item">
								<div class="api-key-info">
									<span class="api-key-name">{key.name}</span>
									<code class="api-key-prefix">{key.keyPrefix}...</code>
									<span class="api-key-meta">
										Created {new Date(key.createdAt).toLocaleDateString()}
										{#if key.lastUsedAt}
											· Last used {new Date(key.lastUsedAt).toLocaleDateString()}
										{/if}
									</span>
								</div>
								<button class="btn-danger btn-sm btn-icon" onclick={() => revokeApiKey(key.id)} aria-label="Revoke key" title="Revoke key">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-muted">No API keys yet.</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

	<!-- Password Change Modal -->
	{#if passwordChangeUserId}
		<div class="modal-overlay" role="button" tabindex="-1" onclick={closePasswordChange} onkeydown={(e) => { if (e.key === 'Escape') closePasswordChange(); }}>
			<div class="modal-content" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<h3>Change Password</h3>
					<button class="modal-close" onclick={closePasswordChange}>&times;</button>
				</div>

				<div class="modal-body">
					{#if passwordError}
						<div class="error-message">{passwordError}</div>
					{/if}

					<form onsubmit={(e) => { e.preventDefault(); changePassword(); }}>
						<div class="form-group">
							<label for="new-password">New Password</label>
							<input
								type="password"
								id="new-password"
								bind:value={passwordForm.newPassword}
								placeholder="Enter new password"
								required
							/>
							{#if passwordForm.newPassword.length > 0}
								<div class="password-suggestions">
									<span class="suggestion" class:met={passwordForm.newPassword.length >= 8}>8+ characters</span>
									<span class="suggestion" class:met={/[a-z]/.test(passwordForm.newPassword)}>lowercase</span>
									<span class="suggestion" class:met={/[A-Z]/.test(passwordForm.newPassword)}>uppercase</span>
									<span class="suggestion" class:met={/[0-9]/.test(passwordForm.newPassword)}>number</span>
									<span class="suggestion" class:met={/[^a-zA-Z0-9]/.test(passwordForm.newPassword)}>special character</span>
								</div>
							{/if}
						</div>

						<div class="form-group">
							<label for="confirm-password">Confirm New Password</label>
							<input
								type="password"
								id="confirm-password"
								bind:value={passwordForm.confirmPassword}
								placeholder="Re-enter new password"
								required
							/>
						</div>

						<div class="modal-actions">
							<button type="button" class="btn-secondary" onclick={closePasswordChange}>
								Cancel
							</button>
							<button type="submit" class="btn-primary">
								Change Password
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}

<style>
	.page {
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
	}

	.tabs-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-2xl);
	}

	.back-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		transition: all var(--transition-fast);
		text-decoration: none;
	}

	.back-arrow:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	.tabs {
		display: flex;
		justify-content: center;
		gap: 4px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 4px;
		width: fit-content;
	}

	.tab {
		padding: var(--spacing-sm) var(--spacing-xl);
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.tab:hover:not(.active) {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.05);
	}

	.tab.active {
		background: var(--accent-primary);
		color: #fff;
		font-weight: 600;
	}

	.general-settings {
		max-width: 800px;
	}

	.settings-section {
		background: var(--bg-secondary);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		margin-bottom: var(--spacing-lg);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}

	.settings-section h2 {
		font-size: 1.25rem;
		margin-bottom: var(--spacing-lg);
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-lg);
	}

	@media (max-width: 600px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		cursor: pointer;
		font-weight: 600;
	}

	.nested-field {
		margin-left: var(--spacing-xl);
		padding-left: var(--spacing-lg);
		border-left: 2px solid rgba(255, 255, 255, 0.1);
	}

	.user-checkboxes {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-weight: 400;
		cursor: pointer;
	}

	.cookie-upload-label {
		cursor: pointer;
	}

	.cookie-upload-label:has(input:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cleanup-section {
		margin-top: var(--spacing-lg);
		padding-top: var(--spacing-lg);
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.jellyfin-test {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.test-result {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.test-result.success {
		color: var(--success);
	}

	.test-result.error {
		color: var(--error);
	}

	.form-group {
		margin-bottom: var(--spacing-lg);
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	label {
		display: block;
		margin-bottom: var(--spacing-sm);
		color: var(--text-primary);
		font-weight: 500;
	}

	label input[type='checkbox'] {
		width: auto;
		margin-right: var(--spacing-sm);
	}

	input[type='text'],
	input[type='number'],
	input[type='email'],
	input[type='password'] {
		width: 100%;
		padding: var(--spacing-md);
		background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
	}

	select {
		width: 100%;
		padding: var(--spacing-md);
		padding-right: calc(var(--spacing-md) + 20px);
		background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
	}

	select:focus,
	input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	input[readonly] {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.help-text {
		margin-top: var(--spacing-xs);
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.error-text {
		color: var(--error);
	}

	.info-box {
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		font-size: 0.875rem;
	}

	.warning-box {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.4);
		color: var(--text-primary);
	}

	.warning-box code {
		background: rgba(255, 255, 255, 0.1);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.8125rem;
	}

	.create-user-form {
		background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
	}

	.create-user-form h3 {
		font-size: 1.125rem;
		margin-bottom: var(--spacing-lg);
	}

	.password-suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: var(--spacing-xs);
	}

	.suggestion {
		font-size: 0.75rem;
		color: var(--text-secondary);
		opacity: 0.6;
		transition: all var(--transition-fast);
	}

	.suggestion.met {
		color: var(--success, #22c55e);
		opacity: 1;
	}

	.suggestion::before {
		content: '○ ';
	}

	.suggestion.met::before {
		content: '● ';
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid var(--error);
		color: var(--error);
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-lg);
		font-size: 0.875rem;
	}

	.users-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.user-card {
		background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.user-info {
		flex: 1;
	}

	.user-name {
		font-weight: 600;
		font-size: 1.125rem;
		margin-bottom: var(--spacing-xs);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.user-email {
		color: var(--text-secondary);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-xs);
	}

	.user-stats {
		color: var(--text-tertiary);
		font-size: 0.875rem;
	}

	.user-actions {
		display: flex;
		gap: var(--spacing-sm);
	}

	.badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.badge-admin {
		background: var(--accent-primary);
		color: white;
	}

	.btn-primary,
	.btn-secondary,
	.btn-danger {
		padding: var(--spacing-md) var(--spacing-lg);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		cursor: pointer;
		transition: var(--transition-fast);
	}

	.btn-primary {
		background: var(--accent-primary);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-secondary {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.btn-secondary:hover {
		background: var(--bg-elevated);
	}

	.btn-danger {
		background: transparent;
		color: var(--error);
		border: 1px solid var(--error);
	}

	.btn-danger:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	.btn-sm {
		padding: var(--spacing-sm) var(--spacing-md);
		font-size: 0.875rem;
	}

	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-sm) !important;
		line-height: 1;
	}

	.btn-icon svg {
		display: block;
	}

	.btn-with-icon {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.btn-with-icon :global(svg) {
		flex-shrink: 0;
	}

	.btn-lg {
		padding: var(--spacing-md) var(--spacing-xl);
		margin-top: var(--spacing-xl);
	}

	.api-docs-link {
		margin-top: var(--spacing-xl);
		padding-top: var(--spacing-xl);
		border-top: 1px solid var(--border);
	}

	.api-docs-link a {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		text-decoration: none;
		color: var(--text-secondary);
	}

	.api-docs-link a:hover {
		color: var(--text-primary);
	}

	.api-keys-section {
		margin-top: var(--spacing-xl);
	}

	.create-key-form {
		display: flex;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
	}

	.create-key-form input {
		flex: 1;
	}

	.api-key-display {
		display: block;
		margin: var(--spacing-sm) 0;
		padding: var(--spacing-sm);
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		word-break: break-all;
		font-size: 0.85rem;
	}

	.api-keys-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.api-key-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.api-key-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.api-key-name {
		font-weight: 500;
	}

	.api-key-prefix {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.api-key-meta {
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.btn-primary:disabled,
	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.empty-state {
		text-align: center;
		padding: var(--spacing-2xl);
		color: var(--text-secondary);
	}

	.badge-you {
		background: rgba(59, 130, 246, 0.2);
		color: var(--accent-primary);
		border: 1px solid var(--accent-primary);
	}

	/* Rescan styles */
	.rescan-actions {
		margin-bottom: var(--spacing-lg);
	}

	.rescan-results {
		margin-top: var(--spacing-md);
	}

	.rescan-summary {
		display: flex;
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-md);
	}

	.rescan-stat {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.rescan-stat.ok {
		color: var(--success, #22c55e);
	}

	.rescan-stat.missing {
		color: var(--error);
	}

	.rescan-bulk-actions {
		display: flex;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
	}

	.rescan-missing-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.rescan-missing-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-tertiary);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
	}

	.rescan-missing-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.rescan-missing-title {
		font-weight: 500;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rescan-missing-path {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rescan-missing-actions {
		flex-shrink: 0;
	}

	/* Modal styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--spacing-lg);
	}

	.modal-content {
		background: var(--bg-secondary);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-lg);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
	}

	.modal-close {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: var(--transition-fast);
	}

	.modal-close:hover {
		color: var(--text-primary);
	}

	.modal-body {
		padding: var(--spacing-lg);
	}

	.modal-actions {
		display: flex;
		gap: var(--spacing-md);
		justify-content: flex-end;
		margin-top: var(--spacing-lg);
	}

	@media (max-width: 768px) {
		.page {
			padding: 0 var(--spacing-sm);
		}

		.tabs {
			width: 100%;
			flex-wrap: nowrap;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			margin-bottom: var(--spacing-lg);
		}

		.tabs::-webkit-scrollbar {
			display: none;
		}

		.tab {
			padding: var(--spacing-sm) var(--spacing-md);
			font-size: 0.8125rem;
			white-space: nowrap;
			flex-shrink: 0;
		}

		.settings-section {
			padding: var(--spacing-md);
		}

		.settings-section h2 {
			font-size: 1.25rem;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.form-group input[type='text'],
		.form-group input[type='number'],
		.form-group input[type='email'],
		.form-group input[type='password'],
		.form-group select {
			font-size: 1rem;
		}

		.section-header {
			flex-direction: column;
			gap: var(--spacing-md);
		}

		.section-header .btn-secondary {
			width: 100%;
		}

		.nested-field {
			margin-left: var(--spacing-sm);
			padding-left: var(--spacing-md);
		}

		.jellyfin-test {
			flex-wrap: wrap;
		}

		.create-user-form {
			padding: var(--spacing-md);
		}

		.user-card {
			flex-direction: column;
			align-items: flex-start;
			padding: var(--spacing-md);
		}

		.user-actions {
			width: 100%;
			flex-wrap: wrap;
		}

		.user-actions button {
			flex: 1;
			min-width: 0;
		}

		.btn-lg {
			width: 100%;
		}

		.modal-content {
			margin: var(--spacing-sm);
		}

		.modal-header,
		.modal-body {
			padding: var(--spacing-md);
		}

		.modal-actions {
			flex-direction: column;
		}

		.modal-actions button {
			width: 100%;
		}
	}
</style>
