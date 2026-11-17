import { buildPlaybackOrder, hasSamePlaybackOrder } from '@/domain/playback/queue-order';
import {
  advance,
  handleStatus,
  handleTrack,
} from '@/services/audio/events';
import {
  activateLockScreen,
  clearLockScreenControls,
  ensureLockScreenActive,
  updateLockScreenMetadata,
} from '@/services/audio/lock-screen';
import {
  createPlaylist,
  disposePlaylist,
  getCurrentIndex,
  getCurrentSong,
  getLoop,
  getOrder,
  getPlaylist,
  isInWindow,
  pausePlayback,
  seekTo,
  setLoop,
  skipToFullIndex,
  windowNeedsRecenterNow,
  withPlaylist,
  type RepeatMode,
} from '@/services/audio/native-playlist';
import { getSession } from '@/services/audio/session';
import { logError } from '@/services/error-log.service';
import type { Song } from '@/types/song';

/**
 * Orquestación de la reproducción.
 *
 * RESPONSABILIDAD ÚNICA: decidir cuándo crear o reconstruir la cola y cuándo
 * pausar o detener. Los eventos nativos los traduce `events.ts`; no conoce
 * Zustand: el puente de React conecta ambos.
 *
 * El motor nativo solo recibe una ventana del orden de reproducción
 * (`domain/playback/queue-window`); aquí se decide cuándo hay que recentrarla.
 */

type QueueStartOptions = {
  /** Pista que debe sonar al terminar la sincronización. */
  startSongId: number | null;
  loop: RepeatMode;
  shuffle: boolean;
  /** Reinicia desde 0 si la pista solicitada ya es la actual. */
  restart?: boolean;
  /**
   * Carga la cola SIN iniciar la reproducción (restauración de sesión: se
   * restaura el estado, no la acción).
   */
  startPaused?: boolean;
};

type QueueRebuildOptions = {
  /** Pista que debe seguir sonando tras reconstruir la cola. */
  currentSongId: number | null;
  loop: RepeatMode;
  shuffle: boolean;
  /** Posición a restaurar; por defecto, la del reproductor actual. */
  position?: number;
  /** Estado de reproducción a conservar; por defecto, el actual. */
  playing?: boolean;
};

/**
 * ¿El usuario pretende que la música siga sonando?
 *
 * NO se puede leer `playlist.playing`: ese getter nativo devuelve
 * `ExoPlayer.isPlaying` en crudo, que es `false` mientras el motor está en
 * buffering (p. ej. al cambiar de pista o al recrear la ventana). La sesión, en
 * cambio, se alimenta del `playing` que el módulo nativo ya corrige con
 * `intendedPlayingState` durante el buffering, así que refleja la intención real.
 *
 * `degraded` reproduce igual (solo perdió los controles del sistema), por eso
 * también cuenta como "debe sonar".
 */
function intendsPlayback(): boolean {
  const { state } = getSession();
  return state === 'playing' || state === 'degraded';
}

/** Retira la sesión de medios y libera la playlist actual. */
function releaseCurrentPlaylist(): void {
  clearLockScreenControls();
  disposePlaylist();
}

/**
 * Crea la playlist nativa a partir de un orden de reproducción completo.
 *
 * `startIndex` es un índice de `songs`; `createPlaylist` recorta la ventana que
 * recibe el motor y coloca ahí la pista actual. Conserva posición y estado.
 */
function createPlaylistWithOrder(
  songs: Song[],
  startIndex: number,
  loop: RepeatMode,
  position: number,
  play: boolean
): void {
  releaseCurrentPlaylist();
  const instance = createPlaylist(
    songs,
    loop,
    { onStatus: handleStatus, onTrack: handleTrack },
    startIndex
  );
  const startSong = songs[startIndex];
  if (startSong) {
    activateLockScreen(instance, startSong);
  }
  if (getSession().state === 'idle') {
    advance('preparing');
  }
  advance('ready');
  if (position > 0) {
    void instance
      .seekTo(position)
      .catch((error: unknown) => logError('audio/queue', 'playlist.seekTo', error));
  }
  if (play) {
    instance.play();
    advance('playing');
  } else {
    advance('paused');
  }
}

function createAndPlay(
  songs: Song[],
  startSong: Song,
  loop: RepeatMode,
  shuffle: boolean,
  position: number,
  play: boolean
): void {
  const nextOrder = buildPlaybackOrder(songs, startSong.id, shuffle);
  const startIndex = Math.max(
    0,
    nextOrder.findIndex((song) => song.id === startSong.id)
  );
  createPlaylistWithOrder(nextOrder, startIndex, loop, position, play);
}

/**
 * Reproduce una cola desde una pista concreta.
 *
 * Si la playlist ya contiene exactamente esas canciones en el mismo orden solo
 * salta de pista (sin recrear la sesión). En caso contrario se recrea para que
 * la cola nativa y el orden de reproducción queden sincronizados.
 */
export function startQueue(songs: Song[], options: QueueStartOptions): void {
  if (songs.length === 0) {
    return;
  }
  const { startSongId, loop, shuffle, restart = false, startPaused = false } = options;
  const startSong = songs.find((song) => song.id === startSongId) ?? songs[0];
  advance('preparing');

  try {
    const existing = getPlaylist();
    if (existing && !shuffle && hasSamePlaybackOrder(songs, getOrder())) {
      setLoop(loop);
      const index = getOrder().findIndex((song) => song.id === startSong.id);
      if (index >= 0 && !isInWindow(index)) {
        // La pista pedida quedó fuera de la ventana nativa: se reconstruye.
        createAndPlay(songs, startSong, loop, shuffle, 0, !startPaused);
        return;
      }
      if (index >= 0 && index !== getCurrentIndex()) {
        skipToFullIndex(index);
      } else if (restart) {
        seekTo(0);
        updateLockScreenMetadata(existing, startSong);
      }
      if (startPaused) {
        // Restauración: la sesión de medios se registra pero sin sonar.
        ensureLockScreenActive();
        existing.pause();
        advance('paused');
        return;
      }
      ensureLockScreenActive();
      withPlaylist('playlist.play', (instance) => instance.play());
      advance('playing');
      return;
    }

    createAndPlay(songs, startSong, loop, shuffle, 0, !startPaused);
  } catch (error) {
    advance('failed', error instanceof Error ? error.message : String(error));
    logError('audio/queue', 'startQueue', error);
    throw error;
  }
}

/**
 * Reconstruye la cola nativa conservando pista, posición y estado.
 *
 * Se usa cuando cambia el orden visible (aleatorio, arrastrar, vaciar cola)
 * porque la API nativa no expone un `move`.
 */
export function rebuildQueue(songs: Song[], options: QueueRebuildOptions): void {
  if (songs.length === 0) {
    return;
  }
  const { currentSongId, loop, shuffle } = options;
  const position = options.position ?? getPlaylist()?.currentTime ?? 0;
  const playing = options.playing ?? intendsPlayback();
  const startSong = songs.find((song) => song.id === currentSongId) ?? songs[0];
  advance('recovering');

  try {
    createAndPlay(songs, startSong, loop, shuffle, position, playing);
  } catch (error) {
    advance('failed', error instanceof Error ? error.message : String(error));
    logError('audio/queue', 'rebuildQueue', error);
    throw error;
  }
}

/**
 * Recrea la ventana nativa desde el orden actual (sin reordenarlo).
 *
 * La cola completa no cambia: solo se vuelve a recortar el tramo que el motor
 * tiene cargado. Conserva pista, posición y estado de reproducción.
 *
 * El estado se toma de la intención (`intendsPlayback`), no de
 * `playlist.playing`: durante el buffering de un cambio de pista ese getter
 * devuelve `false` y la reproducción se detendría al recentrar.
 */
export function refreshWindow(currentSongId: number | null): void {
  const instance = getPlaylist();
  const songs = getOrder();
  if (!instance || songs.length === 0) {
    return;
  }
  const position = instance.currentTime ?? 0;
  const playing = intendsPlayback();
  const found = currentSongId === null ? -1 : songs.findIndex((song) => song.id === currentSongId);
  const index = found >= 0 ? found : Math.max(0, getCurrentIndex());
  createPlaylistWithOrder(songs, index, getLoop(), position, playing);
}

/**
 * Recentra la ventana nativa si se acercó a sus bordes.
 *
 * Se llama tras cada cambio de pista: mantiene siempre margen por delante y por
 * detrás para que el avance automático y `previous`/`next` no se corten.
 */
export function maintainWindow(): void {
  if (!windowNeedsRecenterNow()) {
    return;
  }
  refreshWindow(getCurrentSong()?.id ?? null);
}

/** Pausa la reproducción sin liberar la cola. */
export function pause(): void {
  pausePlayback();
  advance('paused');
}

export function togglePlayback(): void {
  // Se decide por la intención, no por `instance.playing`: durante el buffering
  // de un cambio de pista ese getter devuelve `false` y el botón de pausa
  // reanudaría en vez de pausar.
  const shouldPause = intendsPlayback();
  withPlaylist('playlist.toggle', (instance) => {
    if (shouldPause) {
      instance.pause();
      advance('paused');
      return;
    }
    ensureLockScreenActive();
    instance.play();
    advance('playing');
  });
}

/** Pausa y retira la notificación de medios. Conserva la cola cargada. */
export function stopPlayback(): void {
  pause();
  clearLockScreenControls();
  advance('ready');
}
