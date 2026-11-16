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
  getOrder,
  getPlaylist,
  pausePlayback,
  seekTo,
  setLoop,
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

/** Retira la sesión de medios y libera la playlist actual. */
function releaseCurrentPlaylist(): void {
  clearLockScreenControls();
  disposePlaylist();
}

function createAndPlay(
  songs: Song[],
  startSong: Song,
  loop: RepeatMode,
  shuffle: boolean,
  position: number,
  play: boolean
): void {
  releaseCurrentPlaylist();
  const nextOrder = buildPlaybackOrder(songs, startSong.id, shuffle);
  const instance = createPlaylist(nextOrder, loop, {
    onStatus: handleStatus,
    onTrack: handleTrack,
  });
  const startIndex = nextOrder.findIndex((song) => song.id === startSong.id);
  activateLockScreen(instance, startSong);
  if (getSession().state === 'idle') {
    advance('preparing');
  }
  advance('ready');
  if (startIndex > 0) {
    instance.skipTo(startIndex);
  }
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
      if (index >= 0 && index !== existing.currentIndex) {
        withPlaylist('playlist.skipTo', (instance) => instance.skipTo(index));
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
  const playing = options.playing ?? getPlaylist()?.playing ?? false;
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

/** Pausa la reproducción sin liberar la cola. */
export function pause(): void {
  pausePlayback();
  advance('paused');
}

export function togglePlayback(): void {
  withPlaylist('playlist.toggle', (instance) => {
    if (instance.playing) {
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
