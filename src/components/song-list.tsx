import { useCallback, useMemo, useRef, type ReactElement } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AlphabetBar } from '@/components/alphabet-bar';
import { SongRow } from '@/components/song-row';
import { BottomTabInset, ScrollbarGutter } from '@/constants/theme';
import { useScrollIndicator } from '@/hooks/use-scroll-indicator';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import type { Song } from '@/types/song';
import { collectInitials, normalizeLetter } from '@/utils/alphabet';

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
  /** Muestra el spinner de "desliza para actualizar". */
  refreshing?: boolean;
  /** Habilita el gesto de deslizar para actualizar. */
  onRefresh?: () => void;
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
  refreshing = false,
  onRefresh,
}: SongListProps) {
  const listRef = useRef<FlatList<Song>>(null);

  const theme = useTheme();
  const scrollIndicator = useScrollIndicator();
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);

  // El Set solo se reconstruye cuando cambian los favoritos.
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // Se reproduce la cola recibida o, por defecto, la propia lista.
  const resolvedQueue = queue ?? songs;

  // Callbacks estables para no romper la memoización de las filas.
  const handleToggleFavorite = useCallback(
    (song: Song) => {
      void toggleFavorite(song.id);
    },
    [toggleFavorite]
  );

  const keyExtractor = useCallback((song: Song) => String(song.id), []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Song> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Song>) => (
      <SongRow
        song={item}
        queue={resolvedQueue}
        isFavorite={favoriteSet.has(item.id)}
        onToggleFavorite={handleToggleFavorite}
        onMore={onMore}
      />
    ),
    [resolvedQueue, favoriteSet, handleToggleFavorite, onMore]
  );

  // Letras presentes en la lista, en orden alfabético.
  const availableLetters = useMemo(
    () => collectInitials(songs.map((song) => song.title)),
    [songs]
  );

  // Desplaza la lista hasta la primera canción de la letra elegida.
  const scrollToLetter = useCallback(
    (letter: string) => {
      const index = songs.findIndex(
        (song) => normalizeLetter(song.title) === letter
      );

      if (index !== -1) {
        listRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0,
        });
      }
    },
    [songs]
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={songs}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        extraData={favoriteSet}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        {...scrollIndicator}
        style={styles.flex}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          ) : undefined
        }
        ListHeaderComponent={ListHeaderComponent ?? undefined}
        ListFooterComponent={ListFooterComponent ?? undefined}
        contentContainerStyle={[styles.content, contentContainerStyle]}
      />

      <AlphabetBar
        letters={availableLetters}
        onSelect={scrollToLetter}
        itemNoun="canciones"
      />
    </View>
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

  // Callback estable: si cambia en cada render, `memo` en `SongRow` deja de
  // servir y todas las filas se re-renderizan con cualquier cambio del padre.
  const handleToggleFavorite = useCallback(
    (song: Song) => void toggleFavorite(song.id),
    [toggleFavorite]
  );

  return (
    <View style={styles.list}>
      {songs.map((song) => (
        <SongRow
          key={song.id}
          song={song}
          queue={songs}
          isFavorite={favoriteSet.has(song.id)}
          onToggleFavorite={handleToggleFavorite}
          onMore={onMore}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },

  flex: {
    flex: 1,
  },

  list: {
    width: '100%',
  },

  content: {
    paddingBottom: BottomTabInset + 110,
    // La barra alfabética vive en el margen derecho de la pantalla; solo
    // se reserva el carril del indicador para que no toque las filas.
    paddingRight: ScrollbarGutter,
  },
});
