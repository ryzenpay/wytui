import { prisma } from '../db';

class SearchService {
	async search(query: string, userId: string, options: {
		limit?: number;
		offset?: number;
		videoType?: string;
		storagePool?: string;
		uploader?: string;
		minHeight?: number;
		maxHeight?: number;
		dateFrom?: Date;
		dateTo?: Date;
	} = {}) {
		const { limit = 20, offset = 0, videoType, storagePool, uploader, minHeight, maxHeight, dateFrom, dateTo } = options;

		const where: any = {
			userId,
			status: 'COMPLETED',
			OR: [
				{ title: { contains: query, mode: 'insensitive' } },
				{ description: { contains: query, mode: 'insensitive' } },
				{ uploader: { contains: query, mode: 'insensitive' } },
			],
		};

		if (videoType) {
			where.videoType = videoType;
		}
		if (storagePool) {
			where.storagePool = storagePool;
		}
		if (uploader) {
			where.AND = [
				{ OR: where.OR },
				{ uploader: { contains: uploader, mode: 'insensitive' } }
			];
			delete where.OR;
		}

		// Resolution (height) filters
		if (minHeight || maxHeight) {
			where.height = {};
			if (minHeight) where.height.gte = minHeight;
			if (maxHeight) where.height.lte = maxHeight;
		}

		// Date range filters
		if (dateFrom || dateTo) {
			where.createdAt = {};
			if (dateFrom) where.createdAt.gte = dateFrom;
			if (dateTo) {
				const endOfDay = new Date(dateTo);
				endOfDay.setHours(23, 59, 59, 999);
				where.createdAt.lte = endOfDay;
			}
		}

		const [results, total] = await Promise.all([
			prisma.download.findMany({
				where,
				take: limit,
				skip: offset,
				orderBy: { completedAt: 'desc' },
			}),
			prisma.download.count({ where }),
		]);

		return {
			results: results.map(r => ({
				...r,
				filesize: r.filesize?.toString() ?? null,
				downloadedBytes: r.downloadedBytes?.toString() ?? null,
				totalBytes: r.totalBytes?.toString() ?? null,
			})),
			total,
		};
	}
}

export const searchService = new SearchService();
