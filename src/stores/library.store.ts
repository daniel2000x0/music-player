import { create } from 'zustand';

import { albumRepository } from '@/data/repositories/album.repository';
import { artistRepository } from '@/data/repositories/artist.repository';
import { favoriteRepository } from '@/data/repositories/favorite.repository';
import { historyRepository } from '@/data/repositories/history.repository';
import { maintenanceRepository } from '@/data/repositories/maintenance.repository';
import { playlistRepository } from '@/data/repositories/playlist.repository';
import { songRepository } from '@/data/repositories/song.repository';
import {
  resolveSongsByIds,
  songsOfAlbum,
  songsOfArtist,
} from '@/domain/library/selection';
import type { ScanProgress } from '@/domain/library/scan-progress';
import { scanReportHasChanges, type ScanReport } from '@/domain/library/scan-report';
import { migrateLegacyLibrary } from '@/services/legacy-migration.service';
import { logError } from '@/services/error-log.service';
import { runLibraryScan } from '@/services/library-scan.service';
import { hasAudioPermission, requestAudioAccess } from '@/services/media.service';
import { setPermissionSnapshot } from '@/services/capabilities';
import { useNoticeStore } from '@/stores/notice.store';
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
  /** Progreso del escaneo en curso; `null` cuando no hay ninguno. */
  scanProgress: ScanProgress | null;
  /** Resumen del último escaneo terminado en esta sesión. */
  lastScanReport: ScanReport | null;
  hydrated: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  /** Ejecuta (o comparte) el pipeline de escaneo; `null` si la mediateca falló. */
  scanOnce: () => Promise<ScanReport | null>;
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

let scanPromise: Promise<ScanReport | null> | null = null;

/** Publica un fallo en el canal de avisos en vez de dejarlo solo en logs. */
function notifyFailure(
  code: string,
  title: string,
  message: string,
  onRetry?: () => void
): void {
  useNoticeStore.getState().push({
    code,
    severity: 'error',
    title,
    message,
    action: onRetry ? { label: 'Reintentar', onPress: onRetry } : undefined,
  });
}

function clearNotice(code: string): void {
  useNoticeStore.getState().dismiss(code);
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
  scanProgress: null,
  lastScanReport: null,
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
        setPermissionSnapshot({ mediaLibrary: granted });
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
        notifyFailure(
          'library.load-failed',
          'No se pudo cargar la biblioteca',
          'La copia local no está disponible. Reintenta en unos segundos.',
          () => void get().refresh()
        );
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

  /**
   * Pipeline de escaneo compartido.
   *
   * RENDIMIENTO: deduplica ejecuciones simultáneas — el escaneo de arranque
   * corre en segundo plano y un refresh manual durante ese tiempo comparte
   * el mismo trabajo en vuelo en lugar de duplicarlo.
   */
  scanOnce: async () => {
    if (scanPromise) {
      return scanPromise;
    }
    scanPromise = (async () => {
      set({ scanProgress: { phase: 'enumerate', processed: 0, total: 0 } });
      try {
        const report = await runLibraryScan((scanProgress) => set({ scanProgress }));
        if (report) {
          set({ lastScanReport: report });
        }
        return report;
      } finally {
        set({ scanProgress: null });
        scanPromise = null;
      }
    })();
    return scanPromise;
  },

  refresh: async () => {
    if (get().isScanning) {
      return;
    }
    set({ isScanning: true, error: null });
    try {
      const granted = await hasAudioPermission();
      setPermissionSnapshot({ mediaLibrary: granted });
      set({ hasPermission: granted });
      if (granted) {
        const report = await get().scanOnce();
        if (!report) {
          const message =
            'No se pudo leer la mediateca del dispositivo. Inténtalo de nuevo.';
          set({ error: message });
          notifyFailure(
            'library.scan-failed',
            'No se pudo escanear tu música',
            message,
            () => void get().refresh()
          );
        } else {
          clearNotice('library.scan-failed');
          await migrateLegacyLibrary();
        }
      }
      const local = await loadLocal();
      set({ ...local, isLoading: false });
    } catch (error) {
      logError('library-store', 'refresh', error);
      const message =
        error instanceof Error ? error.message : 'No se pudo actualizar la biblioteca';
      notifyFailure(
        'library.scan-failed',
        'No se pudo escanear tu música',
        message,
        () => void get().refresh()
      );
      set({
        error: message,
        isLoading: false,
      });
    } finally {
      set({ isScanning: false });
    }
  },

  /**
   * Sincronización automática: silenciosa (no toca `isScanning`).
   *
   * LÓGICA: el pipeline es incremental por `modificationTime`, así que un
   * arranque sin cambios no relee etiquetas ni portadas. El progreso se
   * publica igual para que el arranque en frío tenga fase y conteo (`UI-06`).
   */
  sync: async () => {
    if (get().isSyncing) {
      return;
    }
    set({ isSyncing: true, error: null });
    try {
      const granted = await hasAudioPermission();
      setPermissionSnapshot({ mediaLibrary: granted });
      set({ hasPermission: granted });
      let changed = false;
      if (granted) {
        const report = await get().scanOnce();
        changed = report ? scanReportHasChanges(report) : false;
        if (changed || get().songs.length > 0) {
          // La importación heredada es idempotente y barata tras la primera
          // vez; solo con canciones resueltas para no marcarla como hecha
          // antes de que existan ids de mediateca que mapear.
          changed = (await migrateLegacyLibrary()) || changed;
        }
      }
      clearNotice('library.scan-failed');
      clearNotice('library.sync-failed');
      if (changed) {
        const local = await loadLocal();
        set({ ...local, isLoading: false });
      } else {
        // Nada cambió: el estado que cargó `hydrate` ya es válido. Se evita
        // repetir las seis consultas de `loadLocal` en cada arranque.
        set({ isLoading: false });
      }
    } catch (error) {
      logError('library-store', 'sync', error);
      const message =
        error instanceof Error ? error.message : 'No se pudo actualizar la biblioteca';
      notifyFailure(
        'library.sync-failed',
        'No se pudo sincronizar tu biblioteca',
        message,
        () => void get().refresh()
      );
      set({
        error: message,
        isLoading: false,
      });
    } finally {
      set({ isSyncing: false });
    }
  },

  requestAccess: async () => {
    set({ isLoading: true });
    const granted = await requestAudioAccess();
    setPermissionSnapshot({ mediaLibrary: granted });
    set({ hasPermission: granted });
    if (granted) {
      clearNotice('library.permission-denied');
      await get().refresh();
    } else {
      notifyFailure(
        'library.permission-denied',
        'Permiso de audio denegado',
        'Revisa los permisos de la app en los ajustes del sistema para ver tu música.'
      );
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

  getSongsByIds: (ids) => resolveSongsByIds(get().songs, ids),

  getSongsByAlbum: (albumId) => {
    const album = get().albums.find((item) => item.id === albumId);
    return album ? songsOfAlbum(get().songs, album) : [];
  },

  getSongsByArtist: (artistName) => songsOfArtist(get().songs, artistName),

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
