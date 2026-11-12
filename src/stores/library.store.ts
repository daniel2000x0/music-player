import { create } from 'zustand';

import { albumRepository } from '@/data/repositories/album.repository';
import { artistRepository } from '@/data/repositories/artist.repository';
import { favoriteRepository } from '@/data/repositories/favorite.repository';
import { historyRepository } from '@/data/repositories/history.repository';
import { maintenanceRepository } from '@/data/repositories/maintenance.repository';
import { playlistRepository } from '@/data/repositories/playlist.repository';
import { songRepository } from '@/data/repositories/song.repository';
import { migrateLegacyLibrary } from '@/services/legacy-migration.service';
import { logError } from '@/services/error-log.service';
import { hasAudioPermission, listDeviceAudioIds, loadDeviceAudio, requestAudioAccess } from '@/services/media.service';
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
  /** Sincronización automática en segundo plano (sin spinners de usuario). */
  isSyncing: boolean;
  hydrated: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
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
  /** Marca/desmarca canciones como audiolibro (decisión manual del usuario). */
  setAudiobook: (songIds: number[], isAudiobook: boolean) => Promise<void>;
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

let scanPromise: Promise<void> | null = null;

/**
 * Escanea la mediateca (consulta + portadas + upsert) y sincroniza SQLite.
 *
 * RENDIMIENTO: deduplica ejecuciones simultáneas — el escaneo de arranque
 * corre en background y un refresh manual durante ese tiempo comparte el
 * mismo trabajo en vuelo en lugar de duplicarlo.
 */
function scanLibrary(): Promise<void> {
  if (!scanPromise) {
    scanPromise = (async () => {
      try {
        const scanned = await loadDeviceAudio();
        await songRepository.upsertScannedSongs(scanned);
        await songRepository.reclassifyAudiobooks();
        await migrateLegacyLibrary();
      } finally {
        scanPromise = null;
      }
    })();
  }
  return scanPromise;
}

/**
 * `true` si la mediateca tiene exactamente las mismas canciones que la BD.
 *
 * LÓGICA: la consulta liviana de ids evita releer etiquetas y portadas de
 * todos los archivos en cada arranque. Si algo no se puede comprobar, se
 * devuelve `false` para forzar un escaneo completo (nunca se asume vacío).
 */
async function libraryMatchesDevice(): Promise<boolean> {
  const deviceIds = await listDeviceAudioIds();
  if (!deviceIds) {
    return false;
  }
  const storedIds = await songRepository.getAvailableMediaIds();
  if (deviceIds.size !== storedIds.size) {
    return false;
  }
  for (const id of deviceIds) {
    if (!storedIds.has(id)) {
      return false;
    }
  }
  return true;
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
  isSyncing: false,
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
        // La BD persistida carga primero: la biblioteca de la sesión
        // anterior aparece al instante, sin esperar el escaneo del
        // dispositivo (consulta de mediateca + portadas + upsert).
        const [granted, local] = await Promise.all([hasAudioPermission(), loadLocal()]);
        // Primera ejecución (BD vacía): no hay nada persistido que mostrar,
        // se mantiene el loader hasta que la sincronización inicial termine
        // (`sync` baja `isLoading` al finalizar).
        const keepLoading = granted && local.songs.length === 0;
        set({
          ...local,
          hasPermission: granted,
          hydrated: true,
          isLoading: keepLoading,
          error: null,
        });
        // Sincronización silenciosa en segundo plano: no activa `isScanning`,
        // así el botón y el pull-to-refresh no giran durante el arranque.
        if (granted) {
          void get().sync();
        }
      } catch (error) {
        logError('library-store', 'hydrate', error);
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
    if (get().isScanning) {
      return;
    }
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
      logError('library-store', 'refresh', error);
      set({
        error: error instanceof Error ? error.message : 'No se pudo actualizar la biblioteca',
        isLoading: false,
      });
    } finally {
      set({ isScanning: false });
    }
  },

  /**
   * Sincronización automática: silenciosa (no toca `isScanning`).
   *
   * LÓGICA: si la mediateca tiene los mismos ids que la BD, no se releen
   * etiquetas ni portadas; solo se recarga el estado local. El escaneo
   * completo queda para el refresco manual del usuario.
   */
  sync: async () => {
    if (get().isSyncing) {
      return;
    }
    set({ isSyncing: true, error: null });
    try {
      const granted = await hasAudioPermission();
      set({ hasPermission: granted });
      if (granted && !(await libraryMatchesDevice())) {
        await scanLibrary();
      } else if (granted && get().songs.length > 0) {
        // La BD ya está al día: se reintenta la importación heredada sin
        // escanear. Solo con canciones resueltas, para no marcarla como
        // hecha antes de que existan ids de mediateca que mapear.
        await migrateLegacyLibrary();
      }
      const local = await loadLocal();
      set({ ...local, isLoading: false });
    } catch (error) {
      logError('library-store', 'sync', error);
      set({
        error: error instanceof Error ? error.message : 'No se pudo actualizar la biblioteca',
        isLoading: false,
      });
    } finally {
      set({ isSyncing: false });
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

  setAudiobook: async (songIds, isAudiobook) => {
    await songRepository.setAudiobook(songIds, isAudiobook);
    set({ songs: await songRepository.getAll() });
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
