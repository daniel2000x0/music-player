export type SongView = 'all' | 'favorites' | 'played' | 'unplayed';

export type SongFilter = {
  query?: string;
  view?: SongView;
  artist?: string | null;
  album?: string | null;
  minDuration?: number | null;
  maxDuration?: number | null;
};

export type SongSortKey =
  | 'title-asc'
  | 'title-desc'
  | 'artist-asc'
  | 'artist-desc'
  | 'album-asc'
  | 'album-desc'
  | 'duration-asc'
  | 'duration-desc'
  | 'added-asc'
  | 'added-desc'
  | 'plays-asc'
  | 'plays-desc'
  | 'lastPlayed-asc'
  | 'lastPlayed-desc';

export type AlbumSortKey =
  | 'title-asc'
  | 'title-desc'
  | 'artist-asc'
  | 'artist-desc'
  | 'added-asc'
  | 'added-desc'
  | 'songs-asc'
  | 'songs-desc'
  | 'duration-asc'
  | 'duration-desc';

export type ArtistSortKey =
  | 'name-asc'
  | 'name-desc'
  | 'songs-asc'
  | 'songs-desc'
  | 'albums-asc'
  | 'albums-desc'
  | 'lastPlayed-asc'
  | 'lastPlayed-desc';

export type PlaylistSortKey =
  | 'name-asc'
  | 'name-desc'
  | 'created-asc'
  | 'created-desc'
  | 'songs-asc'
  | 'songs-desc';
