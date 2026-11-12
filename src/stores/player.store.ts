import { create } from 'zustand';

import { historyRepository } from '@/data/repositories/history.repository';
import { isValidPlay } from '@/domain/playback/valid-play';
import { moveItem } from '@/domain/playlists/reorder';
import { clearLockScreenControls, getPlayer, loadAndPlay } from '@/services/audio-engine';
import { logError } from '@/services/error-log.service';
import { useLibraryStore } from '@/stores/library.store';
import {
  getPlaybackDuration,
  getPlaybackPosition,
  resetPlaybackProgress,
  setPlaybackPosition,
  setPlaybackProgress,
} from '@/stores/playback-progress';
import type { Song } from '@/types/song';

export type RepeatMode = 'none' | 'all' | 'single';

export type PlaybackStatus = {
  playing: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  didJustFinish: boolean;
};

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
  syncStatus: (status: PlaybackStatus) => void;
  handleDidFinish: () => void;
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

function clearSeekTarget(): void {
  seekTarget = null;
}

/** Envía un seek al motor sin dejar promesas rechazadas sin manejar. */
function safeSeekTo(seconds: number): void {
  void getPlayer()
    .seekTo(seconds)
    .catch((error: unknown) => logError('player-store', 'seekTo', error));
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
  safeSeekTo(clamped);
}

/** Reproduce una pista registrando fallos (archivo borrado, códec, etc.). */
function safeLoadAndPlay(song: Song): void {
  try {
    loadAndPlay(song);
  } catch (error) {
    logError('player-store', 'loadAndPlay', error);
  }
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

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  isPlaying: false,
  isBuffering: false,
  repeatMode: 'none',
  shuffle: false,
  listenedSeconds: 0,
  recordedSongId: null,

  play: (song, nextQueue) => {
    const queue = resolveQueue(get().queue, song, nextQueue);
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
    safeLoadAndPlay(song);
  },

  playQueueIndex: (index) => {
    const { queue, currentSong } = get();
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
    safeLoadAndPlay(song);
    if (currentSong?.id === song.id) {
      requestSeek(0);
    }
  },

  toggle: () => {
    const player = getPlayer();
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  },

  next: () => {
    const { queue, currentSong, shuffle, repeatMode } = get();
    if (queue.length === 0) {
      return;
    }
    const index = queue.findIndex((item) => item.id === currentSong?.id);

    if (shuffle && queue.length > 1) {
      let randomIndex = index;
      while (randomIndex === index) {
        randomIndex = Math.floor(Math.random() * queue.length);
      }
      get().playQueueIndex(randomIndex);
      return;
    }

    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        get().playQueueIndex(0);
      } else {
        getPlayer().pause();
        clearLockScreenControls();
        set({ isPlaying: false });
      }
      return;
    }
    get().playQueueIndex(nextIndex);
  },

  previous: () => {
    const { queue, currentSong, repeatMode } = get();
    if (queue.length === 0) {
      return;
    }
    if (getPlaybackPosition() > 3) {
      requestSeek(0);
      return;
    }
    const index = queue.findIndex((item) => item.id === currentSong?.id);
    const previousIndex = index - 1;
    if (previousIndex < 0) {
      if (repeatMode === 'all') {
        get().playQueueIndex(queue.length - 1);
      } else {
        requestSeek(0);
      }
      return;
    }
    get().playQueueIndex(previousIndex);
  },

  seek: (seconds) => {
    if (!Number.isFinite(seconds)) {
      return;
    }
    requestSeek(seconds);
  },

  cycleRepeat: () => {
    set({ repeatMode: get().repeatMode === 'none' ? 'all' : get().repeatMode === 'all' ? 'single' : 'none' });
  },

  toggleShuffle: () => {
    set({ shuffle: !get().shuffle });
  },

  enqueue: (song) => {
    if (get().queue.some((item) => item.id === song.id)) {
      return;
    }
    set({ queue: [...get().queue, song] });
  },

  playNext: (song) => {
    const { queue, currentSong } = get();
    const withoutSong = queue.filter((item) => item.id !== song.id);
    const index = withoutSong.findIndex((item) => item.id === currentSong?.id);
    const insertAt = index < 0 ? withoutSong.length : index + 1;
    set({ queue: [...withoutSong.slice(0, insertAt), song, ...withoutSong.slice(insertAt)] });
  },

  removeFromQueue: (index) => {
    const { queue, currentSong } = get();
    const song = queue[index];
    if (!song) {
      return;
    }
    const nextQueue = queue.filter((_, position) => position !== index);
    if (song.id !== currentSong?.id) {
      set({ queue: nextQueue });
      return;
    }
    if (nextQueue.length === 0) {
      getPlayer().pause();
      clearLockScreenControls();
      set({ queue: [], currentSong: null, isPlaying: false });
      setPlaybackProgress(0, 0);
      return;
    }
    const target = Math.min(index, nextQueue.length - 1);
    set({ queue: nextQueue });
    get().playQueueIndex(target);
  },

  moveInQueue: (from, to) => {
    set({ queue: moveItem(get().queue, from, to) });
  },

  clearQueue: () => {
    const current = get().currentSong;
    set({ queue: current ? [current] : [] });
  },

  syncStatus: (status) => {
    const { currentSong, recordedSongId, listenedSeconds } = get();

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

    const nextListened = listenedSeconds + countedDelta;

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

  handleDidFinish: () => {
    if (get().repeatMode === 'single') {
      requestSeek(0);
      getPlayer().play();
      set({ listenedSeconds: 0, recordedSongId: null });
      return;
    }
    get().next();
  },
}));
