import { createAudioPlaylist, type AudioPlaylist } from 'expo-audio';

import type { RepeatMode } from '@/domain/playback/session';
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
 * La cola canónica (`queue`) vive en Zustand (`player.store`); aquí solo se
 * guarda `order`, que coincide con ella salvo cuando el aleatorio la reordena.
 */

/**
 * Modos de repetición. La definición canónica vive en el dominio
 * (`domain/playback/session`) porque la sesión persistida también los guarda;
 * aquí se re-exportan para no duplicar el tipo.
 */
export type { RepeatMode } from '@/domain/playback/session';

/** Subconjunto de `AudioPlaylistStatus` que consume la app. */
export type PlaybackStatus = {
  /** Índice de la pista actual dentro del orden de reproducción. */
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

/** Frecuencia de los ticks de estado (posición, duración, buffering). */
const UPDATE_INTERVAL_MS = 500;

let playlist: AudioPlaylist | null = null;
let order: Song[] = [];
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

/** Orden de reproducción actual (`order[index]` es la pista nativa `index`). */
export function getOrder(): Song[] {
  return order;
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

/** Crea la playlist nativa con los oyentes ya enlazados. */
export function createPlaylist(
  songs: Song[],
  loop: RepeatMode,
  events: PlaylistEvents
): AudioPlaylist {
  const instance = createAudioPlaylist({
    sources: songs.map((song) => ({ uri: song.uri })),
    updateInterval: UPDATE_INTERVAL_MS,
    loop,
  });
  playlist = instance;
  order = songs;
  // El volumen es del motor, no de la playlist: se reaplica al reconstruir.
  instance.volume = volume;

  subscriptions = [
    instance.addListener('playlistStatusUpdate', (status) => {
      // Ignora ticks de una playlist ya reemplazada.
      if (playlist !== instance) {
        return;
      }
      events.onStatus({
        currentIndex: status.currentIndex,
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
      const song = order[currentIndex];
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
  withPlaylist('playlist.setLoop', (instance) => {
    instance.loop = loop;
  });
}

export function getCurrentIndex(): number {
  return playlist?.currentIndex ?? -1;
}

export function getTrackCount(): number {
  return playlist?.trackCount ?? 0;
}
