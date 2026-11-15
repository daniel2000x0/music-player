import Constants from 'expo-constants';
import {
  createAudioPlaylist,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  type AudioLockScreenOptions,
  type AudioMetadata,
  type AudioPlaylist,
} from 'expo-audio';
import { Platform } from 'react-native';

import { logError } from '@/services/error-log.service';
import type { Song } from '@/types/song';

/**
 * Motor de audio de bajo nivel.
 *
 * LÓGICA: mantiene una única `AudioPlaylist` fuera del ciclo de React para que
 * la reproducción sobreviva a la navegación y el sistema operativo pueda
 * controlar la cola (notificación, pantalla de bloqueo, auriculares) sin
 * depender del hilo de JavaScript.
 *
 * La cola canónica (`queue`) vive en Zustand (`player.store`); este módulo
 * guarda únicamente el orden real de reproducción (`order`), que coincide con
 * el de `queue` salvo cuando el modo aleatorio lo reordena.
 *
 * Es la ÚNICA instancia de reproducción de la app: el reproductor interno, la
 * notificación y la pantalla de bloqueo comparten esta misma cola y sesión de
 * medios.
 */

export type RepeatMode = 'none' | 'all' | 'single';

/** Subconjunto de `AudioPlaylistStatus` que consume la app. */
export type PlaybackStatus = {
  /** Índice de la pista actual dentro del orden de reproducción. */
  currentIndex: number;
  playing: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
};

type QueueStartOptions = {
  /** Pista que debe sonar al terminar la sincronización. */
  startSongId: number | null;
  loop: RepeatMode;
  shuffle: boolean;
  /** Reinicia desde 0 si la pista solicitada ya es la actual. */
  restart?: boolean;
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
 * Botones visibles en notificación y pantalla bloqueada.
 *
 * LÓGICA: `AudioPlaylist` implementa cola nativa, así que el sistema ofrece
 * anterior/siguiente. En Android esos botones ocupan los huecos de los saltos
 * ±10 s, por lo que se prioriza el cambio de pista (verificado en
 * `AudioControlsService.kt`). La barra de progreso la dibuja el propio sistema
 * a partir de la posición de la sesión de medios.
 */
const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showPreviousTrack: true,
  showNextTrack: true,
};

/** Frecuencia de los ticks de estado (posición, duración, buffering). */
const UPDATE_INTERVAL_MS = 500;

/** Metadatos que alimentan la sesión de medios (notificación + lock screen). */
function lockScreenMetadata(song: Song): AudioMetadata {
  return {
    title: song.title,
    artist: song.artist,
    albumTitle: song.album || undefined,
    // URI local del arte extraído a la caché (`artwork.service`); Android la
    // carga directamente con `BitmapFactory` para la notificación.
    artworkUrl: song.artwork ?? undefined,
  };
}

let playlist: AudioPlaylist | null = null;

/**
 * Orden real de reproducción. `order[index]` es la canción que el motor
 * nativo reproduce en el índice `index`.
 */
let order: Song[] = [];

/** Suscripciones a los eventos de la playlist actual. */
let subscriptions: { remove(): void }[] = [];

/**
 * Oyentes del estado nativo. El puente de React registra aquí
 * `player.store.syncStatus` sin que el motor dependa de Zustand.
 */
const statusListeners = new Set<(status: PlaybackStatus) => void>();

/**
 * Oyentes de cambio de pista. La playlist nativa avanza sola (fin de pista,
 * botones del sistema o auriculares), así que el store necesita enterarse para
 * actualizar la canción visible y los metadatos de la notificación.
 */
const trackListeners = new Set<(song: Song) => void>();

/** `false` tras el primer fallo de los controles de pantalla de bloqueo. */
let lockScreenControlsSupported = true;

/** `true` mientras la playlist actual está registrada en la sesión de medios. */
let lockScreenActive = false;

/**
 * Expo Go no aplica los config plugins, así que su manifest no declara
 * `AudioControlsService` y la sesión de medios no puede enlazarse.
 *
 * LÓGICA: `appOwnership` vale `'expo'` solo dentro de Expo Go y `null` en
 * standalone/desarrollo. No se usa `expoGoConfig`: en un build standalone sin
 * updates embebidos expo-constants devuelve el app.config completo y la
 * comprobación desactivaba los controles por error.
 */
const IS_EXPO_GO = Constants.appOwnership === 'expo';

/**
 * Ejecuta una operación de pantalla de bloqueo y se desactiva si falla.
 *
 * El `try/catch` sigue siendo la red de seguridad para builds sin el plugin;
 * tras el primer fallo deja de intentarlo y lo registra una sola vez.
 */
function withLockScreenGuard(action: string, run: () => void): void {
  if (!lockScreenControlsSupported || IS_EXPO_GO) {
    return;
  }
  try {
    run();
  } catch (error) {
    lockScreenControlsSupported = false;
    logError('audio-engine', action, error);
    if (__DEV__) {
      console.warn(
        '[audio-engine] Controles de pantalla de bloqueo no disponibles:',
        error
      );
    }
  }
}

/** Ejecuta una operación sobre la playlist actual registrando fallos. */
function withPlaylist(action: string, run: (instance: AudioPlaylist) => void): void {
  if (!playlist) {
    return;
  }
  try {
    run(playlist);
  } catch (error) {
    logError('audio-engine', action, error);
  }
}

/** Baraja una copia (Fisher-Yates) sin mutar la cola original. */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * Orden de reproducción para una cola.
 *
 * LÓGICA: con aleatorio activo la pista actual se coloca primero para que
 * `previous`/`next` nativos sigan teniendo sentido y el resto se baraja.
 */
function buildOrder(songs: Song[], startSongId: number | null, shuffle: boolean): Song[] {
  if (!shuffle) {
    return [...songs];
  }
  const current = songs.find((song) => song.id === startSongId);
  if (!current) {
    return shuffled(songs);
  }
  return [current, ...shuffled(songs.filter((song) => song.id !== current.id))];
}

/**
 * ¿La cola pedida tiene exactamente el mismo orden que la nativa?
 *
 * Se compara la secuencia, no el conjunto: dos colas con las mismas canciones
 * en distinto orden deben reconstruir la playlist para que `skipTo` y los
 * botones del sistema apunten a la pista correcta.
 */
function hasSameOrder(songs: Song[]): boolean {
  if (songs.length !== order.length) {
    return false;
  }
  return songs.every((song, index) => song.id === order[index]?.id);
}

function detachListeners(): void {
  for (const subscription of subscriptions) {
    try {
      subscription.remove();
    } catch (error) {
      logError('audio-engine', 'playlist.removeListener', error);
    }
  }
  subscriptions = [];
}

/**
 * Libera la playlist actual.
 *
 * LÓGICA: `destroy()` la retira del registro nativo, detiene los ticks y
 * limpia la sesión de medios. Se pausa antes para que no quede audio sonando
 * mientras el motor nativo termina de liberarse.
 */
function disposePlaylist(): void {
  detachListeners();
  const instance = playlist;
  playlist = null;
  order = [];
  lockScreenActive = false;
  if (!instance) {
    return;
  }
  try {
    instance.pause();
  } catch (error) {
    logError('audio-engine', 'playlist.pause', error);
  }
  withLockScreenGuard('clearLockScreenControls', () => instance.clearLockScreenControls());
  try {
    instance.destroy();
  } catch (error) {
    logError('audio-engine', 'playlist.destroy', error);
  }
  // `destroy()` solo desregistra la playlist del módulo nativo; `release()`
  // desconecta el objeto compartido y libera el reproductor (ExoPlayer /
  // AVQueuePlayer). Sin esto, cada reconstrucción dejaría un reproductor vivo.
  try {
    instance.release();
  } catch (error) {
    logError('audio-engine', 'playlist.release', error);
  }
}

/**
 * Actualiza la notificación con los metadatos de una pista.
 *
 * Solo tiene efecto si la playlist está activa en la sesión de medios; el
 * guard evita el log nativo en Expo Go.
 */
function updateLockScreenMetadata(instance: AudioPlaylist, song: Song): void {
  withLockScreenGuard('updateLockScreenMetadata', () => {
    instance.updateLockScreenMetadata(lockScreenMetadata(song));
  });
}

function createPlaylist(songs: Song[], loop: RepeatMode): AudioPlaylist {
  const instance = createAudioPlaylist({
    sources: songs.map((song) => ({ uri: song.uri })),
    updateInterval: UPDATE_INTERVAL_MS,
    loop,
  });
  playlist = instance;
  order = songs;
  lockScreenActive = false;

  subscriptions = [
    instance.addListener('playlistStatusUpdate', (status) => {
      // Ignora ticks de una playlist ya reemplazada.
      if (playlist !== instance) {
        return;
      }
      const payload: PlaybackStatus = {
        currentIndex: status.currentIndex,
        playing: status.playing,
        // ExoPlayer reporta `TIME_UNSET` mientras prepara la pista; se acota
        // para no enviar posiciones/duraciones negativas a la barra de UI.
        currentTime: Math.max(0, status.currentTime),
        duration: Math.max(0, status.duration),
        isBuffering: status.isBuffering,
      };
      for (const listener of statusListeners) {
        listener(payload);
      }
    }),
    instance.addListener('trackChanged', ({ currentIndex }) => {
      if (playlist !== instance) {
        return;
      }
      // La playlist nativa avanza sola: mantiene la notificación al día y
      // avisa al store para que la pista visible siga a la reproducción.
      const song = order[currentIndex];
      if (!song) {
        return;
      }
      updateLockScreenMetadata(instance, song);
      for (const listener of trackListeners) {
        try {
          listener(song);
        } catch (error) {
          logError('audio-engine', 'trackListener', error);
        }
      }
    }),
  ];

  return instance;
}

function activateLockScreen(instance: AudioPlaylist, song: Song): void {
  withLockScreenGuard('setActiveForLockScreen', () => {
    instance.setActiveForLockScreen(true, lockScreenMetadata(song), LOCK_SCREEN_OPTIONS);
    lockScreenActive = true;
  });
}

/**
 * Reactiva la notificación si se había retirado (p. ej. tras detener al
 * final de la cola) y la reproducción vuelve a empezar.
 */
function ensureLockScreenActive(): void {
  if (!playlist || lockScreenActive) {
    return;
  }
  const song = order[playlist.currentIndex];
  if (song) {
    activateLockScreen(playlist, song);
  }
}

/**
 * Suscribe un oyente al estado nativo. Devuelve la función de baja.
 *
 * El puente de React lo usa una sola vez; el motor no conoce Zustand.
 */
export function subscribePlaylistStatus(
  listener: (status: PlaybackStatus) => void
): () => void {
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
 * pista nativa realmente cambió, evitando mostrar una canción equivocada.
 */
export function subscribeTrackChange(listener: (song: Song) => void): () => void {
  trackListeners.add(listener);
  return () => {
    trackListeners.delete(listener);
  };
}

/**
 * Pide permiso de notificaciones en Android (API 33+).
 *
 * Sin este permiso el sistema puede ocultar los controles de reproducción de
 * la bandeja de notificaciones aunque el servicio de medios esté activo.
 */
export async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const { granted } = await requestNotificationPermissionsAsync();
    if (!granted && __DEV__) {
      console.warn(
        '[audio-engine] Permiso de notificaciones denegado: los controles de reproducción podrían no mostrarse.'
      );
    }
  } catch (error) {
    logError('audio-engine', 'requestNotificationPermissionsAsync', error);
  }
}

export async function configureAudioSession(): Promise<void> {
  try {
    // `doNotMix` es obligatorio para que Android asocie la sesión de medios a
    // la playlist (requisito documentado de `setActiveForLockScreen`).
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch (error) {
    logError('audio-engine', 'setAudioModeAsync', error);
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
  const { startSongId, loop, shuffle, restart = false } = options;
  const startSong = songs.find((song) => song.id === startSongId) ?? songs[0];

  if (playlist && !shuffle && hasSameOrder(songs)) {
    setLoop(loop);
    const index = order.findIndex((song) => song.id === startSong.id);
    if (index >= 0 && index !== playlist.currentIndex) {
      withPlaylist('playlist.skipTo', (instance) => instance.skipTo(index));
    } else if (restart) {
      seekTo(0);
      updateLockScreenMetadata(playlist, startSong);
    }
    ensureLockScreenActive();
    withPlaylist('playlist.play', (instance) => instance.play());
    return;
  }

  disposePlaylist();
  const nextOrder = buildOrder(songs, startSong.id, shuffle);
  const instance = createPlaylist(nextOrder, loop);
  const startIndex = nextOrder.findIndex((song) => song.id === startSong.id);
  activateLockScreen(instance, startSong);
  if (startIndex > 0) {
    instance.skipTo(startIndex);
  }
  instance.play();
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
  const position = options.position ?? playlist?.currentTime ?? 0;
  const playing = options.playing ?? playlist?.playing ?? false;
  const startSong = songs.find((song) => song.id === currentSongId) ?? songs[0];

  disposePlaylist();
  const nextOrder = buildOrder(songs, startSong.id, shuffle);
  const instance = createPlaylist(nextOrder, loop);
  const startIndex = nextOrder.findIndex((song) => song.id === startSong.id);
  activateLockScreen(instance, startSong);
  if (startIndex > 0) {
    instance.skipTo(startIndex);
  }
  if (position > 0) {
    void instance
      .seekTo(position)
      .catch((error: unknown) => logError('audio-engine', 'playlist.seekTo', error));
  }
  if (playing) {
    instance.play();
  }
}

/** Añade una canción al final de la cola nativa (equivale a `enqueue`). */
export function appendSong(song: Song): void {
  withPlaylist('playlist.add', (instance) => {
    instance.add({ uri: song.uri });
    order.push(song);
  });
}

/** Inserta una canción justo después de la actual (equivale a `playNext`). */
export function insertAfterCurrent(song: Song): void {
  if (!playlist) {
    return;
  }
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
      logError('audio-engine', 'playlist.remove', error);
      return;
    }
  }

  withPlaylist('playlist.insert', (instance) => {
    const insertAt = instance.currentIndex + 1;
    instance.insert({ uri: song.uri }, insertAt);
    order.splice(insertAt, 0, song);
    restoreIosPosition(instance, position, playing);
  });
}

/** Quita una canción que no es la actual. La actual la resuelve el store. */
export function removeSongById(songId: number): void {
  if (!playlist) {
    return;
  }
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
    order.splice(index, 1);
    if (!isNativeCurrent && wasBeforeCurrent) {
      restoreIosPosition(instance, position, playing);
    }
  });
}

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
      .catch((error: unknown) => logError('audio-engine', 'playlist.seekTo', error));
  }
  if (playing) {
    instance.play();
  }
}

export function pause(): void {
  withPlaylist('playlist.pause', (instance) => instance.pause());
}

export function togglePlayback(): void {
  withPlaylist('playlist.toggle', (instance) => {
    if (instance.playing) {
      instance.pause();
      return;
    }
    ensureLockScreenActive();
    instance.play();
  });
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
      .catch((error: unknown) => logError('audio-engine', 'playlist.seekTo', error));
  });
}

export function setLoop(loop: RepeatMode): void {
  withPlaylist('playlist.setLoop', (instance) => {
    instance.loop = loop;
  });
}

/** Retira la notificación de medios y los controles del lock screen. */
function clearLockScreenControls(): void {
  lockScreenActive = false;
  withLockScreenGuard('clearLockScreenControls', () => {
    playlist?.clearLockScreenControls();
  });
}

/** Pausa y retira la notificación de medios. Conserva la cola cargada. */
export function stopPlayback(): void {
  pause();
  clearLockScreenControls();
}

export function getCurrentIndex(): number {
  return playlist?.currentIndex ?? -1;
}

export function getTrackCount(): number {
  return playlist?.trackCount ?? 0;
}
