import { create } from 'zustand';

import { historyRepository } from '@/data/repositories/history.repository';
import { playbackSessionRepository } from '@/data/repositories/playback-session.repository';
import { settingsRepository } from '@/data/repositories/settings.repository';
import {
  filterSessionToAvailable,
  type PlaybackSession,
} from '@/domain/playback/session';
import { isValidPlay } from '@/domain/playback/valid-play';
import { moveItem } from '@/domain/playlists/reorder';
import {
  appendSong,
  getCurrentIndex,
  getTrackCount,
  hasQueue,
  insertAfterCurrent,
  nextTrack,
  pause,
  previousTrack,
  rebuildQueue,
  removeSongById,
  seekTo,
  setLoop,
  setVolume as applyEngineVolume,
  startQueue,
  stopPlayback,
  togglePlayback,
  type LockScreenHealth,
  type PlaybackStatus,
  type RepeatMode,
  type SessionSnapshot,
  type SessionState,
} from '@/services/audio';
import {
  flushSessionPersistence,
  savePositionThrottled,
  saveSessionNow,
  saveSessionSoon,
} from '@/services/audio/session-persistence';
import { logError } from '@/services/error-log.service';
import { useLibraryStore } from '@/stores/library.store';
import { useNoticeStore } from '@/stores/notice.store';
import {
  getPlaybackDuration,
  getPlaybackPosition,
  resetPlaybackProgress,
  setPlaybackPosition,
  setPlaybackProgress,
} from '@/stores/playback-progress';
import type { Song } from '@/types/song';

export type { RepeatMode };

type PlayerState = {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  // `position` y `duration` viven en `playback-progress` (almacén aislado):
  // cambian cada 500 ms y no deben re-renderizar las pantallas completas.
  isBuffering: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;
  listenedSeconds: number;
  recordedSongId: number | null;
  /** Salud de los controles del sistema (notificación / pantalla de bloqueo). */
  lockScreen: LockScreenHealth;
  /** Volumen del reproductor (0–1). Se persiste en `app_settings` (`M-02`). */
  volume: number;
  /**
   * Estado real del motor. La UI lo necesita para comunicar una sesión
   * degradada (`C-01`); no se persiste en disco.
   */
  sessionState: SessionState;

  play: (song: Song, queue?: Song[]) => void;
  playQueueIndex: (index: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  enqueue: (song: Song) => void;
  playNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  setVolume: (value: number) => void;
  syncStatus: (status: PlaybackStatus) => void;
  syncTrack: (song: Song) => void;
  syncLockScreen: (health: LockScreenHealth) => void;
  syncSessionState: (snapshot: SessionSnapshot) => void;
  /**
   * Restaura la última sesión (cola, pista, posición y modos) **en pausa**.
   * Debe llamarse después de hidratar la biblioteca: los ids se filtran contra
   * las canciones que existen hoy.
   */
  hydrateSession: () => Promise<void>;
};

let lastPosition = 0;

/**
 * Destino del último seek pendiente de confirmar por el motor nativo.
 *
 * LÓGICA: `seek()` escribe la posición de forma optimista para que la barra
 * responda al instante, pero el motor tarda hasta un tick (500 ms) en
 * reportar la nueva posición. Mientras el destino siga pendiente,
 * `syncStatus` ignora los ticks que aún traen la posición anterior y evita
 * que la barra (y el mini-reproductor) salten atrás.
 */
let seekTarget: number | null = null;
let seekRequestedAt = 0;

/** Tiempo máximo que se espera la confirmación nativa de un seek (ms). */
const SEEK_CONFIRMATION_TIMEOUT_MS = 1500;

/** Retardo con el que se persiste el volumen tras el último arrastre (ms). */
const VOLUME_PERSIST_DEBOUNCE_MS = 500;

let hydrateSessionPromise: Promise<void> | null = null;
let sessionHydrated = false;
let volumePersistTimer: ReturnType<typeof setTimeout> | null = null;

function clearSeekTarget(): void {
  seekTarget = null;
}

/**
 * Sesión serializable del estado actual.
 *
 * RENDIMIENTO: se construye bajo demanda (dentro de `build`) para que los ticks
 * de posición que el throttle descarta no recorran la cola entera.
 */
function buildSession(state: PlayerState): PlaybackSession {
  return {
    queueSongIds: state.queue.map((song) => song.id),
    currentSongId: state.currentSong?.id ?? null,
    positionSeconds: getPlaybackPosition(),
    repeatMode: state.repeatMode,
    shuffle: state.shuffle,
    updatedAt: Date.now(),
  };
}

/** Persiste el volumen con retardo: un arrastre produce decenas de cambios. */
function scheduleVolumePersist(volume: number): void {
  if (volumePersistTimer !== null) {
    clearTimeout(volumePersistTimer);
  }
  volumePersistTimer = setTimeout(() => {
    volumePersistTimer = null;
    void settingsRepository
      .setVolume(volume)
      .catch((error: unknown) => logError('player-store', 'setVolume', error));
  }, VOLUME_PERSIST_DEBOUNCE_MS);
}

/**
 * Registra un seek optimista y lo envía al motor.
 *
 * Acota al rango reproducible para evitar saltos al final (o reinicios)
 * cuando la duración de metadatos no coincide con la real o aún es 0.
 */
function requestSeek(seconds: number): void {
  const duration = getPlaybackDuration();
  const clamped =
    duration > 0 ? Math.max(0, Math.min(seconds, duration)) : Math.max(0, seconds);
  seekTarget = clamped;
  seekRequestedAt = Date.now();
  lastPosition = clamped;
  setPlaybackPosition(clamped);
  seekTo(clamped);
}

function resolveQueue(current: Song[], song: Song, nextQueue?: Song[]): Song[] {
  if (nextQueue && nextQueue.length > 0) {
    return nextQueue;
  }
  if (current.some((item) => item.id === song.id)) {
    return current;
  }
  return [song];
}

/** Cancela la cola actual y deja el reproductor listo para otra pista. */
function stopAndClear(): void {
  stopPlayback();
  clearSeekTarget();
  lastPosition = 0;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  /**
   * Carga en el motor la cola restaurada si aún no está cargada.
   *
   * LÓGICA: al restaurar la sesión el store tiene cola y pista, pero el motor
   * no ha creado la playlist (restaurar no es reproducir). La primera acción
   * que necesita el motor la carga aquí, en la posición guardada y sin
   * arrancar, salvo que la acción sea `play`.
   *
   * Devuelve `true` si la cola se cargó en esta llamada y ya está sonando.
   */
  const ensureEngineQueue = (play: boolean): boolean => {
    if (hasQueue()) {
      return false;
    }
    const state = get();
    if (!state.currentSong || state.queue.length === 0) {
      return false;
    }
    try {
      rebuildQueue(state.queue, {
        currentSongId: state.currentSong.id,
        loop: state.repeatMode,
        shuffle: state.shuffle,
        position: getPlaybackPosition(),
        playing: play,
      });
    } catch (error) {
      logError('player-store', 'ensureEngineQueue', error);
      return false;
    }
    return play;
  };

  return {
    currentSong: null,
    queue: [],
    isPlaying: false,
    isBuffering: false,
    repeatMode: 'none',
    shuffle: false,
    listenedSeconds: 0,
    recordedSongId: null,
    lockScreen: { status: 'unknown', attempts: 0, lastError: null },
    volume: 1,
    sessionState: 'idle',

    play: (song, nextQueue) => {
      const queue = resolveQueue(get().queue, song, nextQueue);
      const { repeatMode, shuffle } = get();
      lastPosition = 0;
      clearSeekTarget();
      set({
        currentSong: song,
        queue,
        listenedSeconds: 0,
        recordedSongId: null,
        isPlaying: true,
      });
      resetPlaybackProgress(song.duration);
      try {
        startQueue(queue, { startSongId: song.id, loop: repeatMode, shuffle, restart: true });
      } catch (error) {
        logError('player-store', 'startQueue', error);
      }
      saveSessionNow(() => buildSession(get()));
    },

    playQueueIndex: (index) => {
      const { queue, currentSong, repeatMode, shuffle } = get();
      const song = queue[index];
      if (!song) {
        return;
      }
      lastPosition = 0;
      clearSeekTarget();
      set({
        currentSong: song,
        listenedSeconds: 0,
        recordedSongId: null,
        isPlaying: true,
      });
      resetPlaybackProgress(song.duration);
      try {
        startQueue(queue, { startSongId: song.id, loop: repeatMode, shuffle, restart: true });
      } catch (error) {
        logError('player-store', 'startQueue', error);
      }
      // Repetir la misma pista desde la cola reinicia su reproducción.
      if (currentSong?.id === song.id) {
        requestSeek(0);
      }
      saveSessionNow(() => buildSession(get()));
    },

    toggle: () => {
      if (ensureEngineQueue(true)) {
        // La cola restaurada acaba de arrancar en la posición guardada.
        saveSessionNow(() => buildSession(get()));
        return;
      }
      togglePlayback();
      // Pausa/reanudación: se escribe la posición de inmediato (`05` §7.3).
      saveSessionNow(() => buildSession(get()));
    },

    next: () => {
      const { queue, repeatMode } = get();
      if (queue.length === 0) {
        return;
      }
      ensureEngineQueue(false);
      // Al final del orden de reproducción y sin repetición total se detiene,
      // igual que hacía el motor anterior.
      if (repeatMode !== 'all' && getCurrentIndex() >= getTrackCount() - 1) {
        // Conserva la notificación (con el botón de reproducir) en vez de
        // retirarla al llegar al final de la cola.
        pause();
        clearSeekTarget();
        lastPosition = 0;
        set({ isPlaying: false });
        saveSessionNow(() => buildSession(get()));
        return;
      }
      nextTrack();
      saveSessionNow(() => buildSession(get()));
    },

    previous: () => {
      if (get().queue.length === 0) {
        return;
      }
      ensureEngineQueue(false);
      if (getPlaybackPosition() > 3) {
        requestSeek(0);
        saveSessionNow(() => buildSession(get()));
        return;
      }
      previousTrack();
      saveSessionNow(() => buildSession(get()));
    },

    seek: (seconds) => {
      if (!Number.isFinite(seconds)) {
        return;
      }
      ensureEngineQueue(false);
      requestSeek(seconds);
      // Un seek es una acción deliberada, no un tick: se escribe al momento.
      saveSessionNow(() => buildSession(get()));
    },

    cycleRepeat: () => {
      const repeatMode = get().repeatMode;
      const nextMode =
        repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'single' : 'none';
      set({ repeatMode: nextMode });
      setLoop(nextMode);
      saveSessionNow(() => buildSession(get()));
    },

    toggleShuffle: () => {
      const shuffle = !get().shuffle;
      set({ shuffle });
      saveSessionNow(() => buildSession(get()));
      const { queue, currentSong, repeatMode, isPlaying } = get();
      if (!currentSong || queue.length === 0) {
        return;
      }
      // La cola nativa se reordena conservando la pista y su posición.
      rebuildQueue(queue, {
        currentSongId: currentSong.id,
        loop: repeatMode,
        shuffle,
        playing: isPlaying,
      });
    },

    enqueue: (song) => {
      if (get().queue.some((item) => item.id === song.id)) {
        return;
      }
      set({ queue: [...get().queue, song] });
      appendSong(song);
      saveSessionSoon(() => buildSession(get()));
    },

    playNext: (song) => {
      const { queue, currentSong } = get();
      if (currentSong?.id === song.id) {
        return;
      }
      const withoutSong = queue.filter((item) => item.id !== song.id);
      const index = withoutSong.findIndex((item) => item.id === currentSong?.id);
      const insertAt = index < 0 ? withoutSong.length : index + 1;
      set({
        queue: [...withoutSong.slice(0, insertAt), song, ...withoutSong.slice(insertAt)],
      });
      insertAfterCurrent(song);
      saveSessionSoon(() => buildSession(get()));
    },

    removeFromQueue: (index) => {
      const { queue, currentSong, repeatMode, shuffle } = get();
      const song = queue[index];
      if (!song) {
        return;
      }
      const nextQueue = queue.filter((_, position) => position !== index);
      if (song.id !== currentSong?.id) {
        set({ queue: nextQueue });
        removeSongById(song.id);
        saveSessionSoon(() => buildSession(get()));
        return;
      }
      if (nextQueue.length === 0) {
        stopAndClear();
        set({ queue: [], currentSong: null, isPlaying: false });
        setPlaybackProgress(0, 0);
        // Sin cola no hay nada que restaurar: se borra la fila persistida.
        void flushSessionPersistence()
          .then(() => playbackSessionRepository.clear())
          .catch((error: unknown) => logError('player-store', 'clearSession', error));
        return;
      }
      const target = nextQueue[Math.min(index, nextQueue.length - 1)];
      if (!target) {
        return;
      }
      lastPosition = 0;
      clearSeekTarget();
      set({
        queue: nextQueue,
        currentSong: target,
        listenedSeconds: 0,
        recordedSongId: null,
        isPlaying: true,
      });
      resetPlaybackProgress(target.duration);
      rebuildQueue(nextQueue, {
        currentSongId: target.id,
        loop: repeatMode,
        shuffle,
        position: 0,
        playing: true,
      });
      saveSessionNow(() => buildSession(get()));
    },

    moveInQueue: (from, to) => {
      const queue = moveItem(get().queue, from, to);
      set({ queue });
      saveSessionSoon(() => buildSession(get()));
      const { currentSong, repeatMode, shuffle, isPlaying } = get();
      // Con aleatorio activo la cola visible no es el orden de reproducción:
      // reordenarla no debe cortar la pista actual.
      if (shuffle || !currentSong) {
        return;
      }
      rebuildQueue(queue, {
        currentSongId: currentSong.id,
        loop: repeatMode,
        shuffle: false,
        playing: isPlaying,
      });
    },

    clearQueue: () => {
      const { queue, currentSong, repeatMode, shuffle, isPlaying } = get();
      if (!currentSong) {
        set({ queue: [] });
        return;
      }
      set({ queue: [currentSong] });
      saveSessionSoon(() => buildSession(get()));
      if (queue.length <= 1) {
        return;
      }
      rebuildQueue([currentSong], {
        currentSongId: currentSong.id,
        loop: repeatMode,
        shuffle,
        playing: isPlaying,
      });
    },

    setVolume: (value) => {
      const volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
      if (volume === get().volume) {
        return;
      }
      set({ volume });
      applyEngineVolume(volume);
      scheduleVolumePersist(volume);
    },

    /**
     * Refleja en el store la pista que el motor nativo puso a sonar.
     *
     * LÓGICA: la playlist avanza sola al terminar una pista o al usar los
     * botones de la notificación/auriculares. El motor resuelve el índice real
     * (incluido el orden aleatorio) y avisa aquí para que la UI, el historial y
     * los metadatos compartan la misma canción.
     */
    syncTrack: (song) => {
      if (get().currentSong?.id === song.id) {
        return;
      }
      clearSeekTarget();
      lastPosition = 0;
      set({ currentSong: song, listenedSeconds: 0, recordedSongId: null });
      resetPlaybackProgress(song.duration);
      // Cambio de pista: escritura inmediata (`05` §7.3).
      saveSessionNow(() => buildSession(get()));
    },

    syncStatus: (status) => {
      const state = get();
      const currentSong = state.currentSong;

      // Confirma (o descarta por timeout) el seek pendiente. Mientras siga
      // pendiente se muestra el destino, no el tick viejo del motor, para que
      // la barra no salte atrás tras soltar el dedo.
      if (seekTarget !== null) {
        const confirmed = Math.abs(status.currentTime - seekTarget) < 1;
        const expired = Date.now() - seekRequestedAt > SEEK_CONFIRMATION_TIMEOUT_MS;
        if (confirmed || expired) {
          clearSeekTarget();
        }
      }

      const position = seekTarget ?? status.currentTime;
      const delta = position - lastPosition;
      // Solo suma el tiempo cuando el avance es continuo y la reproducción
      // está activa (un seek produce un salto grande y no debe contar).
      lastPosition = position;
      const countedDelta = status.playing && delta > 0 && delta < 2.5 ? delta : 0;

      const nextListened = state.listenedSeconds + countedDelta;

      // La posición y la duración van al almacén de progreso aislado: los ticks
      // de 500 ms no re-renderizan las pantallas del reproductor.
      setPlaybackProgress(
        position,
        status.duration > 0 ? status.duration : getPlaybackDuration()
      );
      set({
        isPlaying: status.playing,
        isBuffering: status.isBuffering,
        listenedSeconds: nextListened,
      });
      // La posición se persiste con throttle de 5 s: sin él serían 7200
      // escrituras por hora (`05` §7.3).
      savePositionThrottled(() => buildSession(get()));

      const recordedSongId = state.recordedSongId;
      if (
        currentSong &&
        recordedSongId !== currentSong.id &&
        isValidPlay(nextListened, currentSong.duration)
      ) {
        set({ recordedSongId: currentSong.id });
        const playedAt = Date.now();
        void historyRepository
          .record(currentSong.id, nextListened, true)
          .then(() => useLibraryStore.getState().recordPlayLocal(currentSong.id, playedAt))
          .catch((error: unknown) =>
            logError('player-store', 'historyRepository.record', error)
          );
      }
    },

    syncLockScreen: (health) => {
      const current = get().lockScreen;
      if (
        current.status === health.status &&
        current.attempts === health.attempts &&
        current.lastError === health.lastError
      ) {
        return;
      }
      set({ lockScreen: health });
    },

    syncSessionState: (snapshot) => {
      if (get().sessionState === snapshot.state) {
        return;
      }
      set({ sessionState: snapshot.state });
    },

    hydrateSession: async () => {
      if (sessionHydrated) {
        return;
      }
      if (hydrateSessionPromise) {
        return hydrateSessionPromise;
      }
      hydrateSessionPromise = (async () => {
        try {
          const [saved, settings] = await Promise.all([
            playbackSessionRepository.load(),
            settingsRepository.get(),
          ]);
          set({ volume: settings.volume });
          applyEngineVolume(settings.volume);
          if (!saved) {
            return;
          }
          const songs = useLibraryStore.getState().songs;
          if (songs.length === 0) {
            // La biblioteca no cargó: no se borra la sesión guardada, se
            // reintenta en el siguiente arranque.
            return;
          }
          const { session, removed } = filterSessionToAvailable(
            saved,
            new Set(songs.map((song) => song.id))
          );
          const byId = new Map(songs.map((song) => [song.id, song]));
          const queue = session.queueSongIds
            .map((id) => byId.get(id))
            .filter((song): song is Song => song !== undefined);
          if (queue.length === 0 || session.currentSongId === null) {
            await playbackSessionRepository.clear();
            return;
          }
          const currentSong =
            queue.find((song) => song.id === session.currentSongId) ?? queue[0];
          const position =
            currentSong.duration > 0
              ? Math.min(session.positionSeconds, currentSong.duration)
              : session.positionSeconds;
          clearSeekTarget();
          lastPosition = position;
          // Restaurar es restaurar el ESTADO, no la acción: nunca auto-play.
          set({
            queue,
            currentSong,
            repeatMode: session.repeatMode,
            shuffle: session.shuffle,
            isPlaying: false,
            isBuffering: false,
            listenedSeconds: 0,
            recordedSongId: null,
          });
          setPlaybackProgress(position, currentSong.duration);
          if (removed > 0) {
            useNoticeStore.getState().push({
              code: 'player.session-restored',
              severity: 'info',
              title: 'Sesión restaurada',
              message:
                removed === 1
                  ? 'Una pista de la última cola ya no está disponible.'
                  : `${removed} pistas de la última cola ya no están disponibles.`,
            });
          }
        } catch (error) {
          logError('player-store', 'hydrateSession', error);
        } finally {
          sessionHydrated = true;
          hydrateSessionPromise = null;
        }
      })();
      return hydrateSessionPromise;
    },
  };
});
