import { prisma } from '../db';

class PlaylistService {
	async create(userId: string, name: string, description?: string) {
		return prisma.playlist.create({
			data: { userId, name, description },
		});
	}

	async list(userId: string) {
		const playlists = await prisma.playlist.findMany({
			where: { userId },
			include: { _count: { select: { items: true } } },
			orderBy: { updatedAt: 'desc' },
		});

		return playlists.map((p) => ({
			...p,
			itemCount: p._count.items,
			_count: undefined,
		}));
	}

	async get(playlistId: string, userId: string) {
		const playlist = await prisma.playlist.findUnique({
			where: { id: playlistId },
			include: {
				items: {
					include: { download: true },
					orderBy: { position: 'asc' },
				},
			},
		});

		if (!playlist) return null;
		if (playlist.userId !== userId) return null;

		return {
			...playlist,
			items: playlist.items.map((item) => ({
				...item,
				download: {
					...item.download,
					filesize: item.download.filesize?.toString() ?? null,
					downloadedBytes: item.download.downloadedBytes?.toString() ?? null,
					totalBytes: item.download.totalBytes?.toString() ?? null,
				},
			})),
		};
	}

	async update(playlistId: string, userId: string, data: { name?: string; description?: string }) {
		const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
		if (!playlist) throw new Error('Playlist not found');
		if (playlist.userId !== userId) throw new Error('Access denied');

		return prisma.playlist.update({
			where: { id: playlistId },
			data,
		});
	}

	async delete(playlistId: string, userId: string) {
		const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
		if (!playlist) throw new Error('Playlist not found');
		if (playlist.userId !== userId) throw new Error('Access denied');

		return prisma.playlist.delete({ where: { id: playlistId } });
	}

	async addItem(playlistId: string, userId: string, downloadId: string) {
		const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
		if (!playlist) throw new Error('Playlist not found');
		if (playlist.userId !== userId) throw new Error('Access denied');

		const maxPosition = await prisma.playlistItem.aggregate({
			where: { playlistId },
			_max: { position: true },
		});

		const nextPosition = (maxPosition._max.position ?? -1) + 1;

		return prisma.playlistItem.create({
			data: { playlistId, downloadId, position: nextPosition },
		});
	}

	async removeItem(playlistId: string, userId: string, downloadId: string) {
		const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
		if (!playlist) throw new Error('Playlist not found');
		if (playlist.userId !== userId) throw new Error('Access denied');

		return prisma.playlistItem.delete({
			where: { playlistId_downloadId: { playlistId, downloadId } },
		});
	}

	async reorderItems(playlistId: string, userId: string, itemIds: string[]) {
		const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
		if (!playlist) throw new Error('Playlist not found');
		if (playlist.userId !== userId) throw new Error('Access denied');

		const updates = itemIds.map((id, index) =>
			prisma.playlistItem.update({
				where: { id },
				data: { position: index },
			})
		);

		return prisma.$transaction(updates);
	}
}

export const playlistService = new PlaylistService();
