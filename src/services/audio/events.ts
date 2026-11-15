import { updateLockScreenMetadata } from '@/services/audio/lock-screen';
import { getPlaylist, type PlaybackStatus } from '@/services/audio/native-playlist';
import {
  canTransitionTo,
  getSession,
  transitionTo,
  type SessionState,
} from '@/services/audio/session';
import { logError } from '@/services/error-log.service';
import type { Song } from '@/types/song';

/**
 * Bus de eventos del motor.
 *
 * RESPONSABILIDAD ÚNICA: traducir los callbacks nativos de la playlist a
 * oyentes de la app y mantener la máquina de estados de sesión al día.
 */

const statusListeners = new Set<(status: PlaybackStatus) => void>();
const trackListeners = new Set<(song: Song) => void>();

/** Avanza la máquina de estados sin lanzar si el estado no lo permite. */
export function advance(next: SessionState, error?: string): void {
  if (canTransitionTo(next)) {
    transitionTo(next, { error });
  }
}

/** Estado nativo: publica los ticks y sincroniza `playing`/`paused`. */
export function handleStatus(status: PlaybackStatus): void {
  for (const listener of statusListeners) {
    listener(status);
  }
  // Los ticks llegan 2 veces por segundo: solo se cambia de fase cuando el
  // estado nativo contradice al declarado.
  const current = getSession().state;
  if (status.playing && current !== 'playing') {
    advance('playing');
  } else if (!status.playing && current === 'playing') {
    advance('paused');
  }
}

/** Cambio de pista: actualiza la notificación y avisa al store. */
export function handleTrack(song: Song): void {
  const instance = getPlaylist();
  if (instance) {
    updateLockScreenMetadata(instance, song);
  }
  for (const listener of trackListeners) {
    try {
      listener(song);
    } catch (error) {
      logError('audio-engine', 'trackListener', error);
    }
  }
}

/** Suscribe un oyente al estado nativo. Devuelve la función de baja. */
export function subscribePlaylistStatus(listener: (status: PlaybackStatus) => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Suscribe un oyente a los cambios de pista resueltos por el motor.
 *
 * Se usa `trackChanged` (no `currentIndex` de los ticks) porque la playlist
 * emite estados intermedios al reconstruirse; el evento solo llega cuando la
 * pista nativa realmente cambió.
 */
export function subscribeTrackChange(listener: (song: Song) => void): () => void {
  trackListeners.add(listener);
  return () => {
    trackListeners.delete(listener);
  };
}
