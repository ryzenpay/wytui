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

		// Build WHERE clauses
		const conditions: string[] = ['d.search_vector @@ plainto_tsquery(\'english\', $1)'];
		const params: any[] = [query];
		let paramIndex = 2;

		// User access: own downloads or admin would see all, but for simplicity filter by userId
		conditions.push(`d."userId" = $${paramIndex}`);
		params.push(userId);
		paramIndex++;

		// Only completed downloads
		conditions.push(`d.status = 'COMPLETED'`);

		if (videoType) {
			conditions.push(`d."videoType" = $${paramIndex}`);
			params.push(videoType);
			paramIndex++;
		}
		if (storagePool) {
			conditions.push(`d."storagePool" = $${paramIndex}`);
			params.push(storagePool);
			paramIndex++;
		}
		if (uploader) {
			conditions.push(`d.uploader ILIKE $${paramIndex}`);
			params.push(`%${uploader}%`);
			paramIndex++;
		}

		const whereClause = conditions.join(' AND ');

		const results = await prisma.$queryRawUnsafe(`
			SELECT d.id, d.url, d.title, d.uploader, d.duration, d.thumbnail, d.status,
				d."storagePool", d.filepath, d.filesize, d.format, d."createdAt", d."updatedAt",
				d."userId", d."profileId", d."videoType", d.description, d.category, d.tags,
				d."dislikeCount", d."videoId", d."downloadedBytes", d."totalBytes", d."channelUrl",
				ts_rank(d.search_vector, plainto_tsquery('english', $1)) as rank
			FROM downloads d
			WHERE ${whereClause}
			ORDER BY rank DESC
			LIMIT ${limit} OFFSET ${offset}
		`, ...params);

		const countResult = await prisma.$queryRawUnsafe(`
			SELECT COUNT(*)::int as total
			FROM downloads d
			WHERE ${whereClause}
		`, ...params) as { total: number }[];

		return {
			results: (results as any[]).map(r => ({
				...r,
				filesize: r.filesize?.toString() ?? null,
				downloadedBytes: r.downloadedBytes?.toString() ?? null,
				totalBytes: r.totalBytes?.toString() ?? null,
			})),
			total: countResult[0]?.total ?? 0,
		};
	}
}

export const searchService = new SearchService();
