import { createAudioPlaylist, type AudioPlaylist } from 'expo-audio';

import type { RepeatMode } from '@/domain/playback/session';
import { computeQueueWindow, needsWindowRecenter } from '@/domain/playback/queue-window';
import { AUDIO_CONFIG } from '@/services/audio/config';
import { logError } from '@/services/error-log.service';
import type { Song } from '@/types/song';

/**
 * Ciclo de vida de `AudioPlaylist` y orden real de reproducción.
 *
 * RESPONSABILIDAD ÚNICA: crear, alimentar y liberar la playlist nativa, y
 * exponer operaciones que actúan sobre ella. No conoce la pantalla de bloqueo,
 * el modo de audio ni la máquina de estados: la fachada (`audio/index.ts`)
 * coordina esos módulos.
 *
 * La cola canónica (`queue`) vive en Zustand (`player.store`); aquí se guarda
 * el orden de reproducción completo. El motor nativo NO recibe ese orden
 * entero: recibe una ventana (`domain/playback/queue-window`) para que
 * `MediaSession` no publique miles de pistas en una transacción binder que
 * bloquee el hilo principal. Los índices que se exponen hacia fuera son
 * siempre índices del orden completo.
 */

/**
 * Modos de repetición. La definición canónica vive en el dominio
 * (`domain/playback/session`) porque la sesión persistida también los guarda;
 * aquí se re-exportan para no duplicar el tipo.
 */
export type { RepeatMode } from '@/domain/playback/session';

/** Subconjunto de `AudioPlaylistStatus` que consume la app. */
export type PlaybackStatus = {
  /** Índice de la pista actual dentro del orden de reproducción completo. */
  currentIndex: number;
  playing: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
};

/** Callbacks con los que la fachada enlaza eventos y lock screen. */
export type PlaylistEvents = {
  onStatus: (status: PlaybackStatus) => void;
  onTrack: (song: Song) => void;
};

let playlist: AudioPlaylist | null = null;
/** Orden de reproducción COMPLETO (no solo el tramo que tiene el motor). */
let order: Song[] = [];
/** Índice del orden completo de cada pista de la playlist nativa. */
let windowIndices: number[] = [];
/** Repetición total: la ventana da la vuelta para no cortar la reproducción. */
let windowCyclic = false;
/** Modo de repetición con el que está cargada la playlist. */
let loopMode: RepeatMode = 'none';
let subscriptions: { remove(): void }[] = [];
/**
 * Volumen del motor (0–1). Vive aquí y no en la playlist para sobrevivir a
 * cada reconstrucción de la cola: `createPlaylist` lo vuelve a aplicar.
 */
let volume = 1;

/** Playlist nativa actual, o `null` si no hay cola cargada. */
export function getPlaylist(): AudioPlaylist | null {
  return playlist;
}

/**
 * ¿El motor tiene una cola cargada?
 *
 * Se consulta al motor y no a una copia en el store: así el estado no puede
 * desincronizarse (p. ej. tras restaurar una sesión en pausa, que deja la cola
 * en el store pero el motor todavía vacío).
 */
export function hasQueue(): boolean {
  return playlist !== null;
}

/** Volumen aplicado al motor (0–1). */
export function getVolume(): number {
  return volume;
}

/** Fija el volumen del motor; se conserva entre playlists. */
export function setVolume(next: number): void {
  volume = Math.max(0, Math.min(1, next));
  withPlaylist('playlist.volume', (instance) => {
    instance.volume = volume;
  });
}

/**
 * Orden de reproducción completo (`order[index]` es la pista `index`).
 *
 * NO coincide con lo que contiene la playlist nativa (esa solo tiene una
 * ventana), pero es la referencia para todos los índices de la app.
 */
export function getOrder(): Song[] {
  return order;
}

/** Modo de repetición con el que está cargada la playlist nativa. */
export function getLoop(): RepeatMode {
  return loopMode;
}

/** Ejecuta una operación sobre la playlist registrando fallos sin propagarlos. */
export function withPlaylist(
  action: string,
  run: (instance: AudioPlaylist) => void
): void {
  if (!playlist) {
    return;
  }
  try {
    run(playlist);
  } catch (error) {
    logError('audio/playlist', action, error);
  }
}

function detachListeners(): void {
  for (const subscription of subscriptions) {
    try {
      subscription.remove();
    } catch (error) {
      logError('audio/playlist', 'playlist.removeListener', error);
    }
  }
  subscriptions = [];
}

/**
 * Crea la playlist nativa con una ventana del orden de reproducción.
 *
 * `startIndex` es un índice del orden completo; la pista que debe sonar se
 * coloca dentro de la ventana. Los oyentes se enlazan ya con la ventana
 * aplicada, así que los eventos siempre se traducen a índices del orden
 * completo.
 */
export function createPlaylist(
  songs: Song[],
  loop: RepeatMode,
  events: PlaylistEvents,
  startIndex: number
): AudioPlaylist {
  const lastIndex = Math.max(0, songs.length - 1);
  const safeStart = Math.max(0, Math.min(startIndex, lastIndex));
  const cyclic = loop === 'all';
  const indices = computeQueueWindow(songs.length, safeStart, cyclic);
  const instance = createAudioPlaylist({
    sources: indices
      .map((index) => songs[index])
      .filter((song): song is Song => song !== undefined)
      .map((song) => ({ uri: song.uri })),
    updateInterval: AUDIO_CONFIG.updateIntervalMs,
    loop,
  });
  playlist = instance;
  order = songs;
  windowIndices = indices;
  windowCyclic = cyclic;
  loopMode = loop;
  // El volumen es del motor, no de la playlist: se reaplica al reconstruir.
  instance.volume = volume;

  const nativeStart = indices.indexOf(safeStart);
  if (nativeStart > 0) {
    instance.skipTo(nativeStart);
  }

  subscriptions = [
    instance.addListener('playlistStatusUpdate', (status) => {
      // Ignora ticks de una playlist ya reemplazada.
      if (playlist !== instance) {
        return;
      }
      events.onStatus({
        currentIndex: windowIndices[status.currentIndex] ?? status.currentIndex,
        playing: status.playing,
        // ExoPlayer reporta `TIME_UNSET` mientras prepara la pista; se acota
        // para no enviar posiciones/duraciones negativas a la barra de UI.
        currentTime: Math.max(0, status.currentTime),
        duration: Math.max(0, status.duration),
        isBuffering: status.isBuffering,
      });
    }),
    instance.addListener('trackChanged', ({ currentIndex }) => {
      if (playlist !== instance) {
        return;
      }
      const fullIndex = windowIndices[currentIndex];
      const song = fullIndex === undefined ? undefined : order[fullIndex];
      if (song) {
        events.onTrack(song);
      }
    }),
  ];

  return instance;
}

/**
 * Libera la playlist actual y deja el módulo sin instancia.
 *
 * `destroy()` la retira del registro nativo y limpia la sesión de medios;
 * `release()` desconecta el reproductor compartido (ExoPlayer/AVQueuePlayer).
 * La fachada retira antes los controles del sistema.
 */
export function disposePlaylist(): void {
  detachListeners();
  const instance = playlist;
  playlist = null;
  order = [];
  windowIndices = [];
  windowCyclic = false;
  loopMode = 'none';
  if (!instance) {
    return;
  }
  try {
    instance.pause();
  } catch (error) {
    logError('audio/playlist', 'playlist.pause', error);
  }
  try {
    instance.destroy();
  } catch (error) {
    logError('audio/playlist', 'playlist.destroy', error);
  }
  try {
    instance.release();
  } catch (error) {
    logError('audio/playlist', 'playlist.release', error);
  }
}

export function pausePlayback(): void {
  withPlaylist('playlist.pause', (instance) => instance.pause());
}

export function nextTrack(): void {
  withPlaylist('playlist.next', (instance) => instance.next());
}

export function previousTrack(): void {
  withPlaylist('playlist.previous', (instance) => instance.previous());
}

/** Envía un seek al motor registrando cualquier rechazo nativo. */
export function seekTo(seconds: number): void {
  withPlaylist('playlist.seekTo', (instance) => {
    void instance
      .seekTo(seconds)
      .catch((error: unknown) => logError('audio/playlist', 'playlist.seekTo', error));
  });
}

export function setLoop(loop: RepeatMode): void {
  loopMode = loop;
  withPlaylist('playlist.setLoop', (instance) => {
    instance.loop = loop;
  });
}

/** Índice (del orden completo) de la pista actual; `-1` si no hay ninguna. */
export function getCurrentIndex(): number {
  if (!playlist) {
    return -1;
  }
  return windowIndices[playlist.currentIndex] ?? -1;
}

/** Pista actual (del orden completo), o `null` si no hay ninguna. */
export function getCurrentSong(): Song | null {
  const index = getCurrentIndex();
  if (index < 0) {
    return null;
  }
  return order[index] ?? null;
}

/** Pistas de la cola completa (no solo el tramo cargado en el motor). */
export function getTrackCount(): number {
  return order.length;
}

/** ¿El índice del orden completo está dentro de la ventana nativa? */
export function isInWindow(fullIndex: number): boolean {
  return windowIndices.includes(fullIndex);
}

/**
 * Salta a un índice del orden completo si está dentro de la ventana nativa.
 *
 * Devuelve `false` cuando la pista está fuera de la ventana: entonces la
 * fachada reconstruye la playlist en vez de saltar.
 */
export function skipToFullIndex(fullIndex: number): boolean {
  if (!playlist) {
    return false;
  }
  const nativeIndex = windowIndices.indexOf(fullIndex);
  if (nativeIndex < 0) {
    return false;
  }
  withPlaylist('playlist.skipTo', (instance) => instance.skipTo(nativeIndex));
  return true;
}

/**
 * ¿La ventana nativa se quedó corta?
 *
 * También devuelve `true` cuando cambió el modo de repetición y la ventana ya
 * no refleja si debe dar la vuelta (p. ej. el usuario activó la repetición
 * total): en ese caso hay que reconstruirla.
 */
export function windowNeedsRecenterNow(): boolean {
  if (!playlist) {
    return false;
  }
  const nativeIndex = playlist.currentIndex;
  const fullIndex = windowIndices[nativeIndex] ?? -1;
  if (fullIndex < 0) {
    return false;
  }
  const cyclicNow = loopMode === 'all';
  if (cyclicNow !== windowCyclic && windowIndices.length < order.length) {
    return true;
  }
  return needsWindowRecenter({
    nativeIndex,
    windowLength: windowIndices.length,
    fullIndex,
    orderLength: order.length,
    cyclic: windowCyclic,
  });
}

/** Añade una pista al final del orden de reproducción. */
export function appendToOrder(song: Song): void {
  order.push(song);
}

/** Quita una pista del orden de reproducción. */
export function removeFromOrder(songId: number): void {
  const index = order.findIndex((song) => song.id === songId);
  if (index >= 0) {
    order.splice(index, 1);
  }
}

/** Coloca una pista justo después de otra del orden (la mueve si ya estaba). */
export function insertInOrderAfter(song: Song, afterSongId: number | null): void {
  const existing = order.findIndex((item) => item.id === song.id);
  if (existing >= 0) {
    order.splice(existing, 1);
  }
  const after = afterSongId === null ? -1 : order.findIndex((item) => item.id === afterSongId);
  const at = after < 0 ? order.length : after + 1;
  order.splice(at, 0, song);
}
