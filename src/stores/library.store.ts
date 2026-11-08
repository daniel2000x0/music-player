import { create } from 'zustand';

import { albumRepository } from '@/data/repositories/album.repository';
import { artistRepository } from '@/data/repositories/artist.repository';
import { favoriteRepository } from '@/data/repositories/favorite.repository';
import { historyRepository } from '@/data/repositories/history.repository';
import { maintenanceRepository } from '@/data/repositories/maintenance.repository';
import { playlistRepository } from '@/data/repositories/playlist.repository';
import { songRepository } from '@/data/repositories/song.repository';
import { migrateLegacyLibrary } from '@/services/legacy-migration.service';
import { hasAudioPermission, loadDeviceAudio, requestAudioAccess } from '@/services/media.service';
import type { Playlist } from '@/types/playlist';
import type { Album, Artist, Song } from '@/types/song';

type LibraryState = {
  songs: Song[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  favoriteIds: number[];
  recentIds: number[];
  hasPermission: boolean;
  isLoading: boolean;
  isScanning: boolean;
  hydrated: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  requestAccess: () => Promise<void>;
  toggleFavorite: (songId: number) => Promise<void>;
  isFavorite: (songId: number) => boolean;
  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  addToPlaylist: (playlistId: number, songId: number) => Promise<void>;
  removeFromPlaylist: (playlistId: number, songId: number) => Promise<void>;
  movePlaylistSong: (playlistId: number, songId: number, direction: 'up' | 'down') => Promise<void>;
  clearHistory: () => Promise<void>;
  clearAdministrativeData: () => Promise<void>;
  getSongById: (id: number) => Song | undefined;
  getSongByIdOrMedia: (id: number | string) => Song | undefined;
  getSongsByIds: (ids: number[]) => Song[];
  getSongsByAlbum: (albumId: number) => Song[];
  getSongsByArtist: (artistName: string) => Song[];
  recordPlayLocal: (songId: number, playedAt: number) => void;
};

let hydratePromise: Promise<void> | null = null;

async function loadLocal(): Promise<
  Pick<LibraryState, 'songs' | 'artists' | 'albums' | 'playlists' | 'favoriteIds' | 'recentIds'>
> {
  const [songs, artists, albums, playlists, favoriteIds, recent] = await Promise.all([
    songRepository.getAll(),
    artistRepository.getAll(),
    albumRepository.getAll(),
    playlistRepository.getAll(),
    favoriteRepository.getIds(),
    historyRepository.getRecent(50),
  ]);
  return {
    songs,
    artists,
    albums,
    playlists,
    favoriteIds,
    recentIds: recent.map((entry) => entry.songId),
  };
}

async function scanLibrary(): Promise<void> {
  const scanned = await loadDeviceAudio();
  await songRepository.upsertScannedSongs(scanned);
  await migrateLegacyLibrary();
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  songs: [],
  artists: [],
  albums: [],
  playlists: [],
  favoriteIds: [],
  recentIds: [],
  hasPermission: false,
  isLoading: true,
  isScanning: false,
  hydrated: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated) {
      return;
    }
    if (hydratePromise) {
      return hydratePromise;
    }
    hydratePromise = (async () => {
      try {
        const granted = await hasAudioPermission();
        set({ hasPermission: granted });
        if (granted) {
          await scanLibrary();
        }
        const local = await loadLocal();
        set({ ...local, hydrated: true, isLoading: false, error: null });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'No se pudo cargar la biblioteca',
          hydrated: true,
          isLoading: false,
        });
      } finally {
        hydratePromise = null;
      }
    })();
    return hydratePromise;
  },

  refresh: async () => {
    set({ isScanning: true, error: null });
    try {
      const granted = await hasAudioPermission();
      set({ hasPermission: granted });
      if (granted) {
        await scanLibrary();
      }
      const local = await loadLocal();
      set({ ...local, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo actualizar la biblioteca' });
    } finally {
      set({ isScanning: false });
    }
  },

  requestAccess: async () => {
    set({ isLoading: true });
    const granted = await requestAudioAccess();
    set({ hasPermission: granted });
    if (granted) {
      await get().refresh();
    } else {
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (songId) => {
    await favoriteRepository.toggle(songId);
    set({ favoriteIds: await favoriteRepository.getIds() });
  },

  isFavorite: (songId) => get().favoriteIds.includes(songId),

  createPlaylist: async (name) => {
    const playlist = await playlistRepository.create(name);
    set({ playlists: await playlistRepository.getAll() });
    return playlist;
  },

  renamePlaylist: async (id, name) => {
    await playlistRepository.rename(id, name);
    set({ playlists: await playlistRepository.getAll() });
  },

  deletePlaylist: async (id) => {
    await playlistRepository.remove(id);
    set({ playlists: await playlistRepository.getAll() });
  },

  addToPlaylist: async (playlistId, songId) => {
    await playlistRepository.addSong(playlistId, songId);
    set({ playlists: await playlistRepository.getAll() });
  },

  removeFromPlaylist: async (playlistId, songId) => {
    await playlistRepository.removeSong(playlistId, songId);
    set({ playlists: await playlistRepository.getAll() });
  },

  movePlaylistSong: async (playlistId, songId, direction) => {
    await playlistRepository.moveSong(playlistId, songId, direction);
    set({ playlists: await playlistRepository.getAll() });
  },

  clearHistory: async () => {
    await historyRepository.clear();
    set({ recentIds: [] });
    const songs = await songRepository.getAll();
    set({ songs });
  },

  clearAdministrativeData: async () => {
    await maintenanceRepository.clearAdministrativeData();
    const local = await loadLocal();
    set(local);
  },

  getSongById: (id) => get().songs.find((song) => song.id === id),

  getSongByIdOrMedia: (id) => {
    if (typeof id === 'number') {
      return get().songs.find((song) => song.id === id);
    }
    return get().songs.find((song) => song.mediaId === id);
  },

  getSongsByIds: (ids) => {
    const map = new Map(get().songs.map((song) => [song.id, song]));
    return ids.map((id) => map.get(id)).filter((song): song is Song => song !== undefined);
  },

  getSongsByAlbum: (albumId) => {
    const album = get().albums.find((item) => item.id === albumId);
    if (!album) {
      return [];
    }
    return get().songs.filter(
      (song) => song.album === album.title && song.artist === album.artist
    );
  },

  getSongsByArtist: (artistName) => get().songs.filter((song) => song.artist === artistName),

  recordPlayLocal: (songId, playedAt) => {
    set({
      songs: get().songs.map((song) =>
        song.id === songId
          ? { ...song, playCount: song.playCount + 1, lastPlayedAt: playedAt }
          : song
      ),
      recentIds: [songId, ...get().recentIds.filter((id) => id !== songId)].slice(0, 50),
    });
  },
}));
