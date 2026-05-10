import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { DownloadStatus } from '@prisma/client';
import type { RequestHandler } from './$types';

/**
 * GET /api/analytics
 * Get analytics data for admin dashboard
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.session?.user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		// Total downloads by status
		const totalDownloads = await prisma.download.count();
		const completedDownloads = await prisma.download.count({
			where: { status: DownloadStatus.COMPLETED },
		});
		const failedDownloads = await prisma.download.count({
			where: { status: DownloadStatus.FAILED },
		});
		const activeDownloads = await prisma.download.count({
			where: {
				status: {
					in: [
						DownloadStatus.PENDING,
						DownloadStatus.FETCHING_INFO,
						DownloadStatus.DOWNLOADING,
						DownloadStatus.PROCESSING,
					],
				},
			},
		});

		// Storage usage
		const cacheDownloads = await prisma.download.findMany({
			where: {
				storagePool: 'cache',
				status: DownloadStatus.COMPLETED,
				filesize: { not: null },
			},
			select: { filesize: true },
		});

		const libraryDownloads = await prisma.download.findMany({
			where: {
				storagePool: 'library',
				status: DownloadStatus.COMPLETED,
				filesize: { not: null },
			},
			select: { filesize: true },
		});

		const cacheBytes = cacheDownloads.reduce(
			(sum, d) => sum + (d.filesize ? BigInt(d.filesize) : BigInt(0)),
			BigInt(0)
		);

		const libraryBytes = libraryDownloads.reduce(
			(sum, d) => sum + (d.filesize ? BigInt(d.filesize) : BigInt(0)),
			BigInt(0)
		);

		// Downloads per day (last 30 days)
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const downloadsPerDay = await prisma.$queryRaw<
			{ date: string; count: number }[]
		>`
			SELECT
				DATE(COALESCE("completedAt", "createdAt")) as date,
				COUNT(*)::int as count
			FROM downloads
			WHERE
				status = ${DownloadStatus.COMPLETED}
				AND COALESCE("completedAt", "createdAt") >= ${thirtyDaysAgo}
			GROUP BY DATE(COALESCE("completedAt", "createdAt"))
			ORDER BY date DESC
		`;

		// Top uploaders
		const topUploaders = await prisma.download.groupBy({
			by: ['uploader'],
			where: {
				status: DownloadStatus.COMPLETED,
				uploader: { not: null },
			},
			_count: { uploader: true },
			orderBy: { _count: { uploader: 'desc' } },
			take: 10,
		});

		// Most active subscriptions
		const activeSubscriptions = await prisma.subscription.findMany({
			where: { enabled: true },
			select: {
				id: true,
				name: true,
				_count: {
					select: { downloads: true },
				},
			},
			orderBy: {
				downloads: { _count: 'desc' },
			},
			take: 10,
		});

		// Average file size
		const completedWithSize = await prisma.download.findMany({
			where: {
				status: DownloadStatus.COMPLETED,
				filesize: { not: null },
			},
			select: { filesize: true },
		});

		const avgFilesize =
			completedWithSize.length > 0
				? completedWithSize.reduce(
						(sum, d) => sum + (d.filesize ? Number(d.filesize) : 0),
						0
				  ) / completedWithSize.length
				: 0;

		// Downloads by format
		const downloadsByFormat = await prisma.$queryRaw<
			{ format: string; count: number }[]
		>`
			SELECT
				LOWER(SUBSTRING(filename FROM '\\.([^.]+)$')) as format,
				COUNT(*)::int as count
			FROM downloads
			WHERE
				status = ${DownloadStatus.COMPLETED}
				AND filename IS NOT NULL
			GROUP BY LOWER(SUBSTRING(filename FROM '\\.([^.]+)$'))
			ORDER BY count DESC
			LIMIT 10
		`;

		// Success rate
		const totalCompleteOrFailed = completedDownloads + failedDownloads;
		const successRate =
			totalCompleteOrFailed > 0
				? (completedDownloads / totalCompleteOrFailed) * 100
				: 100;

		// Get settings for quota info
		const settings = await prisma.settings.findUnique({
			where: { id: 'singleton' },
		});

		return json({
			overview: {
				totalDownloads,
				completedDownloads,
				failedDownloads,
				activeDownloads,
				successRate: Math.round(successRate * 10) / 10,
			},
			storage: {
				cacheBytes: cacheBytes.toString(),
				libraryBytes: libraryBytes.toString(),
				totalBytes: (cacheBytes + libraryBytes).toString(),
				cacheQuotaBytes: settings?.cacheQuotaBytes.toString() || '0',
			},
			downloadsPerDay: downloadsPerDay.map((d) => ({
				date: d.date,
				count: d.count,
			})),
			topUploaders: topUploaders.map((u) => ({
				uploader: u.uploader || 'Unknown',
				count: u._count.uploader,
			})),
			activeSubscriptions: activeSubscriptions.map((s) => ({
				id: s.id,
				name: s.name,
				downloadCount: s._count.downloads,
			})),
			avgFilesize,
			downloadsByFormat: downloadsByFormat.map((f) => ({
				format: f.format || 'unknown',
				count: f.count,
			})),
		});
	} catch (e: any) {
		console.error('Failed to get analytics:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to get analytics');
	}
};
