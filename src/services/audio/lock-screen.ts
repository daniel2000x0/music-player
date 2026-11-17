import Constants from 'expo-constants';
import type {
  AudioLockScreenOptions,
  AudioMetadata,
  AudioPlaylist,
} from 'expo-audio';

import { getCurrentSong, getPlaylist } from '@/services/audio/native-playlist';
import { logError } from '@/services/error-log.service';
import type { Song } from '@/types/song';

/**
 * Sesión de medios: notificación, pantalla bloqueada y reintentos.
 *
 * RESPONSABILIDAD ÚNICA: registrar la playlist en la sesión de medios,
 * actualizar sus metadatos y publicar la salud de la integración.
 */

/** Expo Go no aplica los config plugins ni enlaza `AudioControlsService`. */
const IS_EXPO_GO = Constants.appOwnership === 'expo';

/** Botones visibles: la playlist nativa ofrece anterior/siguiente. */
const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showPreviousTrack: true,
  showNextTrack: true,
};

/** Esperas entre reintentos; tras agotarlas la sesión queda `degraded`. */
const RETRY_DELAYS_MS = [1000, 3000, 10000] as const;

export type LockScreenStatus = 'unknown' | 'active' | 'degraded' | 'unsupported';

export type LockScreenHealth = {
  status: LockScreenStatus;
  /** Reintentos consumidos en el ciclo actual. */
  attempts: number;
  lastError: string | null;
};
let status: LockScreenStatus = IS_EXPO_GO ? 'unsupported' : 'unknown';
let attempts = 0;
let lastError: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let registered = false;
const healthListeners = new Set<(health: LockScreenHealth) => void>();

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  return String(error);
}

/** Metadatos que alimentan la sesión de medios. */
function lockScreenMetadata(song: Song): AudioMetadata {
  return {
    title: song.title,
    artist: song.artist,
    albumTitle: song.album || undefined,
    // URI local del arte extraído a la caché (`artwork.service`).
    artworkUrl: song.artwork ?? undefined,
  };
}

function health(): LockScreenHealth {
  return { status, attempts, lastError };
}

/** Notifica a la UI cada cambio de salud (activación, reintento, degradación). */
function emitHealth(): void {
  const snapshot = health();
  for (const listener of healthListeners) {
    try {
      listener(snapshot);
    } catch (error) {
      logError('audio/lock-screen', 'lockScreenHealthListener', error);
    }
  }
}

/** Estado actual de los controles del sistema. */
export function getLockScreenHealth(): LockScreenHealth {
  return health();
}

/** Suscribe un oyente a la salud del lock screen y emite el estado actual. */
export function subscribeLockScreenHealth(
  listener: (health: LockScreenHealth) => void
): () => void {
  healthListeners.add(listener);
  listener(health());
  return () => {
    healthListeners.delete(listener);
  };
}

/** Cancela el reintento pendiente, si lo hay. */
export function cancelLockScreenRetry(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/** Actualiza la notificación con los metadatos de una pista. */
export function updateLockScreenMetadata(instance: AudioPlaylist, song: Song): void {
  if (IS_EXPO_GO) {
    return;
  }
  try {
    instance.updateLockScreenMetadata(lockScreenMetadata(song));
  } catch (error) {
    logError('audio/lock-screen', 'updateLockScreenMetadata', error);
  }
}

function tryRegister(instance: AudioPlaylist, song: Song): boolean {
  if (IS_EXPO_GO) {
    return false;
  }
  try {
    instance.setActiveForLockScreen(true, lockScreenMetadata(song), LOCK_SCREEN_OPTIONS);
    return true;
  } catch (error) {
    lastError = messageOf(error);
    logError('audio/lock-screen', 'setActiveForLockScreen', error);
    return false;
  }
}

/** Programa el siguiente reintento o declara la sesión degradada. */
function scheduleRetry(instance: AudioPlaylist, song: Song): void {
  const delay = RETRY_DELAYS_MS[attempts];
  if (delay === undefined) {
    status = 'degraded';
    emitHealth();
    if (__DEV__) {
      console.warn(
        '[audio/lock-screen] Controles de pantalla de bloqueo degradados tras agotar reintentos:',
        lastError
      );
    }
    return;
  }

  attempts += 1;
  emitHealth();

  retryTimer = setTimeout(() => {
    retryTimer = null;
    // La playlist cambió o se liberó: el reintento ya no tiene sentido.
    if (getPlaylist() !== instance) {
      return;
    }
    const current = getCurrentSong() ?? song;
    attempt(instance, current, false);
  }, delay);
}

/** Un intento de activación; con `resetAttempts` inicia un ciclo nuevo. */
function attempt(instance: AudioPlaylist, song: Song, resetAttempts: boolean): void {
  if (resetAttempts) {
    cancelLockScreenRetry();
    attempts = 0;
    lastError = null;
  }

  if (IS_EXPO_GO) {
    status = 'unsupported';
    emitHealth();
    return;
  }

  if (tryRegister(instance, song)) {
    registered = true;
    attempts = 0;
    lastError = null;
    status = 'active';
    emitHealth();
    return;
  }

  registered = false;
  scheduleRetry(instance, song);
}

/** Punto de entrada al crear o reconstruir la cola: ciclo de reintentos nuevo. */
export function activateLockScreen(instance: AudioPlaylist, song: Song): void {
  attempt(instance, song, true);
}

/**
 * Reactiva la notificación si se había retirado. Si la sesión está
 * `degraded`, se espera a una cola nueva para no repetir el backoff.
 */
export function ensureLockScreenActive(): void {
  const instance = getPlaylist();
  if (!instance || registered) {
    return;
  }
  if (status === 'degraded') {
    return;
  }
  const song = getCurrentSong();
  if (song) {
    activateLockScreen(instance, song);
  }
}

/** Retira la notificación de medios y los controles del lock screen. */
export function clearLockScreenControls(): void {
  cancelLockScreenRetry();
  registered = false;
  if (status === 'active') {
    // La sesión ya no está registrada: `active` dejaría de ser cierto.
    status = 'unknown';
    emitHealth();
  }
  const instance = getPlaylist();
  if (!instance || IS_EXPO_GO) {
    return;
  }
  try {
    instance.clearLockScreenControls();
  } catch (error) {
    logError('audio/lock-screen', 'clearLockScreenControls', error);
  }
}
