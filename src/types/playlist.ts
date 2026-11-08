/**
 * Playlists manuales, playlists automáticas e historial.
 */

export type AutoPlaylistKey =
  | 'mostPlayed'
  | 'favorites'
  | 'recent'
  | 'recentlyAdded'
  | 'random'
  | 'unplayed';

export type Playlist = {
  id: number;
  name: string;
  isAuto: boolean;
  autoKey: AutoPlaylistKey | null;
  /** Ids de canciones en orden. */
  songIds: number[];
  createdAt: number;
  updatedAt: number;
};

/** Entrada del historial de reproducción. */
export type RecentEntry = {
  songId: number;
  playedAt: number;
};
