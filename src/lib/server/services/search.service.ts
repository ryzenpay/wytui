import { prisma } from '../db';

class SearchService {
	async search(query: string, userId: string, options: {
		limit?: number;
		offset?: number;
		videoType?: string;
		storagePool?: string;
		uploader?: string;
	} = {}) {
		const { limit = 20, offset = 0, videoType, storagePool, uploader } = options;

		const searchPattern = `%${query}%`;

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
			where.uploader = { contains: uploader, mode: 'insensitive' };
			delete where.OR;
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
