export function formatBytes(bytes: string | number): string {
	const b = Number(bytes);
	if (!Number.isFinite(b) || b <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(b) / Math.log(1024));
	return `${(b / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTimestamp(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = Math.floor(totalSeconds % 60);
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${m}:${String(s).padStart(2, '0')}`;
}

const DOWNLOAD_STATUS_COLORS: Record<string, string> = {
	PENDING: 'var(--text-tertiary)',
	FETCHING_INFO: 'var(--info)',
	DOWNLOADING: 'var(--accent-primary)',
	PROCESSING: 'var(--warning)',
	COMPLETED: 'var(--success)',
	FAILED: 'var(--error)',
	CANCELLED: 'var(--text-tertiary)',
	DELETED: 'var(--text-tertiary)',
};

const DOWNLOAD_STATUS_LABELS: Record<string, string> = {
	PENDING: 'Pending',
	FETCHING_INFO: 'Fetching Info',
	DOWNLOADING: 'Downloading',
	PROCESSING: 'Processing',
	COMPLETED: 'Completed',
	FAILED: 'Failed',
	CANCELLED: 'Cancelled',
	DELETED: 'Deleted',
};

export function getDownloadStatusColor(status: string): string {
	return DOWNLOAD_STATUS_COLORS[status] || 'var(--text-secondary)';
}

export function getDownloadStatusLabel(status: string): string {
	return DOWNLOAD_STATUS_LABELS[status] || status;
}

export function formatUptime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}
