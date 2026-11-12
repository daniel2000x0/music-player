import type { AutoPlaylistKey } from '@/types/playlist';
import type { Song } from '@/types/song';

export type AutoPlaylistDefinition = {
  key: AutoPlaylistKey;
  name: string;
  description: string;
  icon: 'flame' | 'heart' | 'time' | 'add-circle' | 'shuffle' | 'radio-button-off';
};

export const AUTO_PLAYLISTS: readonly AutoPlaylistDefinition[] = [
  { key: 'mostPlayed', name: 'Más escuchadas', description: 'Tus canciones con más reproducciones', icon: 'flame' },
  { key: 'favorites', name: 'Favoritos', description: 'Las canciones que marcaste', icon: 'heart' },
  { key: 'recent', name: 'Últimas reproducidas', description: 'Tu historial reciente', icon: 'time' },
  { key: 'recentlyAdded', name: 'Agregadas recientemente', description: 'Lo último que llegó a tu biblioteca', icon: 'add-circle' },
  { key: 'random', name: 'Aleatoria', description: 'Una selección al azar', icon: 'shuffle' },
  { key: 'unplayed', name: 'Sin reproducir', description: 'Canciones que aún no escuchaste', icon: 'radio-button-off' },
];

export function getAutoPlaylistSongs(
  key: AutoPlaylistKey,
  songs: Song[],
  favoriteIds: ReadonlySet<number>,
  recentIds: readonly number[]
): Song[] {
  // Los audiolibros viven en su pestaña: no deben colarse en las listas
  // automáticas de música (favoritos, más escuchadas, aleatoria, etc.).
  const available = songs.filter((song) => song.isAvailable && !song.isAudiobook);
  switch (key) {
    case 'mostPlayed':
      return [...available]
        .filter((song) => song.playCount > 0)
        .sort((a, b) => b.playCount - a.playCount || (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
    case 'favorites':
      return available.filter((song) => favoriteIds.has(song.id));
    case 'recent': {
      const order = new Map(recentIds.map((id, index) => [id, index]));
      return available
        .filter((song) => order.has(song.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    case 'recentlyAdded':
      return [...available].sort((a, b) => b.addedAt - a.addedAt);
    case 'unplayed':
      return available.filter((song) => song.playCount === 0);
    case 'random': {
      const copy = [...available];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
      }
      return copy;
    }
    default:
      return [];
  }
}

export function getAutoPlaylistDefinition(key: AutoPlaylistKey): AutoPlaylistDefinition {
  return AUTO_PLAYLISTS.find((item) => item.key === key) ?? AUTO_PLAYLISTS[0];
}
