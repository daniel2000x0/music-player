import { StyleSheet, View } from 'react-native';

import { SongRow } from '@/components/song-row';
import { useLibraryStore } from '@/stores/library.store';
import type { Song } from '@/types/song';

export type SongListProps = {
  songs: Song[];
  /** Cola al reproducir; por defecto, la propia lista. */
  queue?: Song[];
  /** Acción del botón "más" de cada fila. */
  onMore?: (song: Song) => void;
};

/**
 * Lista de canciones conectada al store de favoritos.
 */
export function SongList({ songs, queue, onMore }: SongListProps) {
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);

  return (
    <View style={styles.list}>
      {songs.map((song) => (
        <SongRow
          key={song.id}
          song={song}
          queue={queue ?? songs}
          isFavorite={favoriteIds.includes(song.id)}
          onToggleFavorite={(item) => void toggleFavorite(item.id)}
          onMore={onMore}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
});
