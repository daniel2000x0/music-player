import {
  appendToOrder,
  getCurrentSong,
  hasQueue,
  insertInOrderAfter,
  removeFromOrder,
} from '@/services/audio/native-playlist';
import { refreshWindow } from '@/services/audio/queue';
import type { Song } from '@/types/song';

/**
 * Ediciones estructurales de la cola.
 *
 * RESPONSABILIDAD ÚNICA: aplicar altas, inserciones y bajas al orden de
 * reproducción y volver a recortar la ventana nativa. Como el motor solo tiene
 * un tramo de la cola, el índice nativo no coincide con el del orden completo;
 * en vez de traducir índices en cada edición se recompone la ventana desde el
 * orden actual (recrear una playlist de una ventana es barato y conserva pista,
 * posición y estado).
 *
 * Si el motor aún no tiene cola cargada no se toca el orden: la cola canónica
 * vive en el store y se cargará entera en la primera acción.
 */

/** Añade una canción al final de la cola (equivale a `enqueue`). */
export function appendToPlaylist(song: Song): void {
  if (!hasQueue()) {
    return;
  }
  appendToOrder(song);
  refreshWindow(getCurrentSong()?.id ?? null);
}

/** Inserta una canción justo después de la actual (equivale a `playNext`). */
export function insertAfterCurrent(song: Song): void {
  if (!hasQueue()) {
    return;
  }
  const current = getCurrentSong();
  if (current?.id === song.id) {
    return;
  }
  insertInOrderAfter(song, current?.id ?? null);
  refreshWindow(current?.id ?? null);
}

/** Quita una canción que no es la actual. La actual la resuelve el store. */
export function removeSongById(songId: number): void {
  if (!hasQueue()) {
    return;
  }
  const current = getCurrentSong();
  if (current?.id === songId) {
    return;
  }
  removeFromOrder(songId);
  refreshWindow(current?.id ?? null);
}
