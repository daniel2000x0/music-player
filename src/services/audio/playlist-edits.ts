import type { AudioPlaylist } from 'expo-audio';
import { Platform } from 'react-native';

import { getOrder, getPlaylist, withPlaylist } from '@/services/audio/native-playlist';
import { logError } from '@/services/error-log.service';
import type { Song } from '@/types/song';

/**
 * Ediciones estructurales de la cola nativa.
 *
 * RESPONSABILIDAD ÚNICA: añadir, insertar o quitar pistas de la playlist ya
 * creada. La creación, los oyentes y la liberación viven en
 * `native-playlist.ts`; la fachada decide cuándo reconstruir la cola entera.
 */

/**
 * iOS reconstruye la cola al insertar o quitar pistas anteriores a la actual
 * y reinicia la posición a 0; este ajuste la devuelve donde estaba.
 */
function restoreIosPosition(
  instance: AudioPlaylist,
  position: number,
  playing: boolean
): void {
  if (Platform.OS !== 'ios') {
    return;
  }
  if (position > 0) {
    void instance
      .seekTo(position)
      .catch((error: unknown) => logError('audio/playlist', 'playlist.seekTo', error));
  }
  if (playing) {
    instance.play();
  }
}

/** Añade una canción al final de la cola nativa (equivale a `enqueue`). */
export function appendToPlaylist(song: Song): void {
  withPlaylist('playlist.add', (instance) => {
    instance.add({ uri: song.uri });
    getOrder().push(song);
  });
}

/** Inserta una canción justo después de la actual (equivale a `playNext`). */
export function insertAfterCurrent(song: Song): void {
  const playlist = getPlaylist();
  if (!playlist) {
    return;
  }
  const order = getOrder();
  const existing = order.findIndex((item) => item.id === song.id);
  if (existing >= 0 && existing === playlist.currentIndex) {
    return;
  }

  const position = playlist.currentTime;
  const playing = playlist.playing;

  if (existing >= 0) {
    try {
      playlist.remove(existing);
      order.splice(existing, 1);
    } catch (error) {
      logError('audio/playlist', 'playlist.remove', error);
      return;
    }
  }

  withPlaylist('playlist.insert', (instance) => {
    const insertAt = instance.currentIndex + 1;
    instance.insert({ uri: song.uri }, insertAt);
    getOrder().splice(insertAt, 0, song);
    restoreIosPosition(instance, position, playing);
  });
}

/** Quita una canción que no es la actual. La actual la resuelve el store. */
export function removeSongById(songId: number): void {
  const playlist = getPlaylist();
  if (!playlist) {
    return;
  }
  const order = getOrder();
  const index = order.findIndex((song) => song.id === songId);
  if (index < 0) {
    return;
  }

  // Si el índice coincide con la pista nativa actual pero el store cree que
  // no lo es, hay un desfase de un tick: se quita igual y el evento de estado
  // posterior vuelve a sincronizar la canción actual.
  const isNativeCurrent = index === playlist.currentIndex;
  if (isNativeCurrent && order.length <= 1) {
    return;
  }

  // En iOS quitar una pista anterior a la actual reconstruye la cola y
  // reinicia la pista actual; hay que devolverla a su posición.
  const wasBeforeCurrent = index < playlist.currentIndex;
  const position = playlist.currentTime;
  const playing = playlist.playing;
  withPlaylist('playlist.remove', (instance) => {
    instance.remove(index);
    getOrder().splice(index, 1);
    if (!isNativeCurrent && wasBeforeCurrent) {
      restoreIosPosition(instance, position, playing);
    }
  });
}
