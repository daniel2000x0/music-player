import type {
  AlbumSortKey,
  ArtistSortKey,
  PlaylistSortKey,
  SongSortKey,
} from '@/types/filters';
import type { Playlist } from '@/types/playlist';
import type { Album, Artist, Song } from '@/types/song';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}

function compareNumber(a: number, b: number): number {
  return a - b;
}

function compareNullableNumber(a: number | null, b: number | null, direction: 'asc' | 'desc'): number {
  const left = a ?? 0;
  const right = b ?? 0;
  return direction === 'asc' ? left - right : right - left;
}

export function sortSongs(songs: Song[], key: SongSortKey): Song[] {
  const copy = [...songs];
  copy.sort((a, b) => {
    switch (key) {
      case 'title-asc':
        return compareText(a.title, b.title);
      case 'title-desc':
        return compareText(b.title, a.title);
      case 'artist-asc':
        return compareText(a.artist, b.artist) || compareText(a.title, b.title);
      case 'artist-desc':
        return compareText(b.artist, a.artist) || compareText(a.title, b.title);
      case 'album-asc':
        return compareText(a.album, b.album) || compareText(a.title, b.title);
      case 'album-desc':
        return compareText(b.album, a.album) || compareText(a.title, b.title);
      case 'duration-asc':
        return compareNumber(a.duration, b.duration);
      case 'duration-desc':
        return compareNumber(b.duration, a.duration);
      case 'added-asc':
        return compareNumber(a.addedAt, b.addedAt);
      case 'added-desc':
        return compareNumber(b.addedAt, a.addedAt);
      case 'plays-asc':
        return compareNumber(a.playCount, b.playCount);
      case 'plays-desc':
        return compareNumber(b.playCount, a.playCount);
      case 'lastPlayed-asc':
        return compareNullableNumber(a.lastPlayedAt, b.lastPlayedAt, 'asc');
      case 'lastPlayed-desc':
        return compareNullableNumber(a.lastPlayedAt, b.lastPlayedAt, 'desc');
      default:
        return 0;
    }
  });
  return copy;
}

export function sortAlbums(albums: Album[], key: AlbumSortKey): Album[] {
  const copy = [...albums];
  copy.sort((a, b) => {
    switch (key) {
      case 'title-asc':
        return compareText(a.title, b.title);
      case 'title-desc':
        return compareText(b.title, a.title);
      case 'artist-asc':
        return compareText(a.artist, b.artist) || compareText(a.title, b.title);
      case 'artist-desc':
        return compareText(b.artist, a.artist) || compareText(a.title, b.title);
      case 'added-asc':
        return compareNumber(a.createdAt, b.createdAt);
      case 'added-desc':
        return compareNumber(b.createdAt, a.createdAt);
      case 'songs-asc':
        return compareNumber(a.songCount, b.songCount);
      case 'songs-desc':
        return compareNumber(b.songCount, a.songCount);
      case 'duration-asc':
        return compareNumber(a.totalDuration, b.totalDuration);
      case 'duration-desc':
        return compareNumber(b.totalDuration, a.totalDuration);
      default:
        return 0;
    }
  });
  return copy;
}

export function sortArtists(artists: Artist[], key: ArtistSortKey): Artist[] {
  const copy = [...artists];
  copy.sort((a, b) => {
    switch (key) {
      case 'name-asc':
        return compareText(a.name, b.name);
      case 'name-desc':
        return compareText(b.name, a.name);
      case 'songs-asc':
        return compareNumber(a.songCount, b.songCount);
      case 'songs-desc':
        return compareNumber(b.songCount, a.songCount);
      case 'albums-asc':
        return compareNumber(a.albumCount, b.albumCount);
      case 'albums-desc':
        return compareNumber(b.albumCount, a.albumCount);
      case 'lastPlayed-asc':
        return compareNullableNumber(a.lastPlayedAt, b.lastPlayedAt, 'asc');
      case 'lastPlayed-desc':
        return compareNullableNumber(a.lastPlayedAt, b.lastPlayedAt, 'desc');
      default:
        return 0;
    }
  });
  return copy;
}

export function sortPlaylists(playlists: Playlist[], key: PlaylistSortKey): Playlist[] {
  const copy = [...playlists];
  copy.sort((a, b) => {
    switch (key) {
      case 'name-asc':
        return compareText(a.name, b.name);
      case 'name-desc':
        return compareText(b.name, a.name);
      case 'created-asc':
        return compareNumber(a.createdAt, b.createdAt);
      case 'created-desc':
        return compareNumber(b.createdAt, a.createdAt);
      case 'songs-asc':
        return compareNumber(a.songIds.length, b.songIds.length);
      case 'songs-desc':
        return compareNumber(b.songIds.length, a.songIds.length);
      default:
        return 0;
    }
  });
  return copy;
}
