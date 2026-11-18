import { useCallback, useState } from 'react';

import type { DeleteChoice } from '@/components/song-delete-sheet';
import type { SongMetadataPatch } from '@/components/song-edit-modal';
import { useLibraryStore } from '@/stores/library.store';
import { useNoticeStore } from '@/stores/notice.store';
import type { Song } from '@/types/song';

/** Pistas a eliminar mientras el diálogo está abierto (`FASE 5.2`). */
export type DeleteTarget = {
  songs: Song[];
  /** Título del diálogo: el de la pista o el conteo del lote. */
  title: string;
};

export type SongLibraryActions = {
  /** Pista en edición (abre el modal) o `null`. */
  editSong: Song | null;
  /** Pistas a eliminar (abre el diálogo) o `null`. */
  deleteTarget: DeleteTarget | null;
  /** Abre el modal de edición de metadatos. */
  requestEdit: (song: Song) => void;
  /** Guarda la corrección local y cierra el modal. */
  confirmEdit: (patch: SongMetadataPatch) => Promise<void>;
  /** Cierra el modal sin guardar. */
  cancelEdit: () => void;
  /** Abre el diálogo de eliminación para una pista o un lote. */
  requestDelete: (songs: Song | Song[], title?: string) => void;
  /** Ejecuta la eliminación elegida (biblioteca o dispositivo). */
  confirmDelete: (choice: DeleteChoice) => Promise<void>;
  /** Cierra el diálogo sin eliminar. */
  cancelDelete: () => void;
};

/**
 * Acciones compartidas de gestión de la biblioteca (`FASE 5.2`).
 *
 * RESPONSABILIDAD ÚNICA: concentrar el estado efímero (pista en edición, lote a
 * eliminar) y traducir la decisión del usuario en llamadas al store, de modo
 * que las cuatro pantallas que gestionan pistas (Canciones, álbum, artista y
 * playlist) compartan el mismo comportamiento y los mismos avisos.
 */
export function useSongLibraryActions(): SongLibraryActions {
  const updateSongMetadata = useLibraryStore((state) => state.updateSongMetadata);
  const removeSongs = useLibraryStore((state) => state.removeSongs);
  const deleteSongsFromDevice = useLibraryStore((state) => state.deleteSongsFromDevice);
  const pushNotice = useNoticeStore((state) => state.push);

  const [editSong, setEditSong] = useState<Song | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const requestEdit = useCallback((song: Song) => setEditSong(song), []);
  const cancelEdit = useCallback(() => setEditSong(null), []);

  const confirmEdit = useCallback(
    async (patch: SongMetadataPatch) => {
      if (!editSong) {
        return;
      }
      setEditSong(null);
      await updateSongMetadata(editSong.id, {
        title: patch.title,
        // Un campo vacío significa "no cambiar", no "borrar".
        artist: patch.artist || undefined,
        album: patch.album || undefined,
      });
    },
    [editSong, updateSongMetadata]
  );

  const requestDelete = useCallback((songs: Song | Song[], title?: string) => {
    const list = Array.isArray(songs) ? songs : [songs];
    if (list.length === 0) {
      return;
    }
    setDeleteTarget({
      songs: list,
      title: title ?? (list.length === 1 ? list[0].title : `${list.length} pistas`),
    });
  }, []);

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const confirmDelete = useCallback(
    async (choice: DeleteChoice) => {
      if (!deleteTarget) {
        return;
      }
      const ids = deleteTarget.songs.map((song) => song.id);
      setDeleteTarget(null);

      if (choice === 'library') {
        await removeSongs(ids);
        return;
      }

      const result = await deleteSongsFromDevice(ids);
      if (result.error) {
        pushNotice({
          code: 'library.delete-device-failed',
          severity: 'warning',
          title: 'No se borraron los archivos',
          message: result.error,
        });
      }
    },
    [deleteTarget, removeSongs, deleteSongsFromDevice, pushNotice]
  );

  return {
    editSong,
    deleteTarget,
    requestEdit,
    confirmEdit,
    cancelEdit,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
