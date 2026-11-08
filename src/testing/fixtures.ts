import type { Song } from '@/types/song';

export function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 1,
    mediaId: 'media-1',
    uri: 'file:///music/song-1.mp3',
    title: 'Canción',
    artist: 'Artista',
    album: 'Álbum',
    duration: 180,
    artwork: null,
    addedAt: 1_000,
    isAvailable: true,
    playCount: 0,
    lastPlayedAt: null,
    ...overrides,
  };
}
