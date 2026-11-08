import { create } from 'zustand';

import { historyRepository } from '@/data/repositories/history.repository';
import { isValidPlay } from '@/domain/playback/valid-play';
import { moveItem } from '@/domain/playlists/reorder';
import { getPlayer, loadAndPlay } from '@/services/audio-engine';
import { useLibraryStore } from '@/stores/library.store';
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
  position: number;
  duration: number;
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
  position: 0,
  duration: 0,
  isBuffering: false,
  repeatMode: 'none',
  shuffle: false,
  listenedSeconds: 0,
  recordedSongId: null,

  play: (song, nextQueue) => {
    const queue = resolveQueue(get().queue, song, nextQueue);
    lastPosition = 0;
    set({
      currentSong: song,
      queue,
      position: 0,
      duration: song.duration,
      listenedSeconds: 0,
      recordedSongId: null,
      isPlaying: true,
    });
    loadAndPlay(song);
  },

  playQueueIndex: (index) => {
    const { queue, currentSong } = get();
    const song = queue[index];
    if (!song) {
      return;
    }
    lastPosition = 0;
    set({
      currentSong: song,
      position: 0,
      duration: song.duration,
      listenedSeconds: 0,
      recordedSongId: null,
      isPlaying: true,
    });
    loadAndPlay(song);
    if (currentSong?.id === song.id) {
      getPlayer().seekTo(0);
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
        set({ isPlaying: false });
      }
      return;
    }
    get().playQueueIndex(nextIndex);
  },

  previous: () => {
    const { queue, currentSong, position, repeatMode } = get();
    if (queue.length === 0) {
      return;
    }
    if (position > 3) {
      getPlayer().seekTo(0);
      lastPosition = 0;
      set({ position: 0 });
      return;
    }
    const index = queue.findIndex((item) => item.id === currentSong?.id);
    const previousIndex = index - 1;
    if (previousIndex < 0) {
      if (repeatMode === 'all') {
        get().playQueueIndex(queue.length - 1);
      } else {
        getPlayer().seekTo(0);
        lastPosition = 0;
        set({ position: 0 });
      }
      return;
    }
    get().playQueueIndex(previousIndex);
  },

  seek: (seconds) => {
    const clamped = Math.max(0, seconds);
    getPlayer().seekTo(clamped);
    lastPosition = clamped;
    set({ position: clamped });
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
      set({ queue: [], currentSong: null, isPlaying: false, position: 0, duration: 0 });
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
    const delta = status.currentTime - lastPosition;
    // Siempre sincroniza la posición para no perder el hilo tras un salto
    // (buffering, cambio de pista o app en segundo plano); solo suma el
    // tiempo cuando el avance es continuo y la reproducción está activa.
    lastPosition = status.currentTime;
    const countedDelta = status.playing && delta > 0 && delta < 2.5 ? delta : 0;

    const nextListened = listenedSeconds + countedDelta;

    set({
      isPlaying: status.playing,
      position: status.currentTime,
      duration: status.duration > 0 ? status.duration : get().duration,
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
        .catch(() => undefined);
    }
  },

  handleDidFinish: () => {
    if (get().repeatMode === 'single') {
      lastPosition = 0;
      getPlayer().seekTo(0);
      getPlayer().play();
      set({ position: 0, listenedSeconds: 0, recordedSongId: null });
      return;
    }
    get().next();
  },
}));
