import { useCallback, useMemo, type ReactElement } from 'react';
import { FlatList, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SongRow } from '@/components/song-row';
import { BottomTabInset } from '@/constants/theme';
import { useLibraryStore } from '@/stores/library.store';
import type { Song } from '@/types/song';

export type SongListProps = {
  songs: Song[];
  /** Cola al reproducir; por defecto, la propia lista. */
  queue?: Song[];
  /** Acción del botón "más" de cada fila. */
  onMore?: (song: Song) => void;
  /** Encabezado que se desplaza con la lista (búsqueda, filtros). */
  ListHeaderComponent?: ReactElement | null;
  /** Pie que se desplaza con la lista. */
  ListFooterComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** Altura fija de una fila (artwork 52 + padding 8×2). */
const ROW_HEIGHT = 68;

/**
 * Lista de canciones virtualizada (FlatList) conectada al store de favoritos.
 *
 * RENDIMIENTO: solo monta las filas visibles (+ ventana de anticipación)
 * en lugar de toda la biblioteca; `getItemLayout` evita medir filas y
 * `memo` en `SongRow` minimiza re-renders. Usar en pantallas completas
 * (la lista debe ser el único scrollable vertical de su contenedor).
 */
export function SongList({
  songs,
  queue,
  onMore,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
}: SongListProps) {
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const resolvedQueue = queue ?? songs;
  const handleToggleFavorite = useCallback(
    (song: Song) => void toggleFavorite(song.id),
    [toggleFavorite]
  );
  const keyExtractor = useCallback((song: Song) => String(song.id), []);

  return (
    <FlatList
      data={songs}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => (
        <SongRow
          song={item}
          queue={resolvedQueue}
          isFavorite={favoriteSet.has(item.id)}
          onToggleFavorite={handleToggleFavorite}
          onMore={onMore}
        />
      )}
      getItemLayout={(_, index) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={5}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.flex}
      ListHeaderComponent={
        // FlatList no acepta `null` en estos props: se normaliza a `undefined`.
        ListHeaderComponent ?? undefined
      }
      ListFooterComponent={ListFooterComponent ?? undefined}
      contentContainerStyle={[styles.content, contentContainerStyle]}
    />
  );
}

export type InlineSongListProps = {
  songs: Song[];
  /** Acción del botón "más" de cada fila. */
  onMore?: (song: Song) => void;
};

/**
 * Variante no virtualizada para listas cortas (≤ ~8 filas) embebidas en
 * secciones dentro de un `ScrollView` (ej. Inicio). Las listas largas deben
 * usar `SongList` (FlatList): anidar una FlatList en un ScrollView rompe
 * la virtualización.
 */
export function InlineSongList({ songs, onMore }: InlineSongListProps) {
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  return (
    <View style={styles.list}>
      {songs.map((song) => (
        <SongRow
          key={song.id}
          song={song}
          queue={songs}
          isFavorite={favoriteSet.has(song.id)}
          onToggleFavorite={(item) => void toggleFavorite(item.id)}
          onMore={onMore}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  list: {
    width: '100%',
  },
  content: {
    paddingBottom: BottomTabInset + 110,
  },
});
