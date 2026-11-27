import { memo, useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AlphabetChips } from '@/components/alphabet-chips';
import { EdgeScrollIndicator } from '@/components/edge-scroll-indicator';
import { MediaTile } from '@/components/media-tile';
import { SONG_ROW_HEIGHT, SongRow } from '@/components/song-row';
import {
  BottomTabInset,
  MiniPlayerInset,
  ScrollbarEdgeMargin,
  Spacing,
} from '@/constants/theme';
import { useScrollIndicator } from '@/hooks/use-scroll-indicator';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import type { ViewMode } from '@/types/view-mode';
import { collectInitials, initialKey } from '@/utils/alphabet';
import { getGridMetrics } from '@/utils/grid-layout';

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
  /** Estado vacío de la lista; las pantallas pueden aportar su propio mensaje. */
  ListEmptyComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Muestra el spinner de "desliza para actualizar". */
  refreshing?: boolean;
  /** Habilita el gesto de deslizar para actualizar. */
  onRefresh?: () => void;
  /** Ids seleccionados en modo selección (`FASE 5.2`). */
  selectedIds?: readonly number[];
  /** `true` mientras la pantalla está en modo selección. */
  selectionActive?: boolean;
  /** Alterna la selección de una fila. */
  onToggleSelect?: (song: Song) => void;
  /** Pulsación larga: entra en el modo de selección. */
  onLongPressSong?: (song: Song) => void;
  /** Estilo elegido en la pestaña. `list` mantiene el comportamiento histórico. */
  mode?: ViewMode;
};

type GridSongTileProps = {
  song: Song;
  width: number;
  variant: 'block' | 'icon';
  selectionActive: boolean;
  selected: boolean;
  onPress: (song: Song) => void;
  onToggleSelect?: (song: Song) => void;
  onLongPress?: (song: Song) => void;
};

/**
 * Celda de rejilla con callbacks estables por canción.
 *
 * RENDIMIENTO: `MediaTile` está memoizado, pero crear las tres funciones en
 * `renderItem` rompía la memoización en cada render de la lista. Aquí se
 * crean una vez por celda y solo cambian si cambia la canción o el callback
 * del padre.
 */
const GridSongTile = memo(function GridSongTile({
  song,
  width,
  variant,
  selectionActive,
  selected,
  onPress,
  onToggleSelect,
  onLongPress,
}: GridSongTileProps) {
  const handlePress = useCallback(() => onPress(song), [onPress, song]);
  const handleToggleSelect = useCallback(
    () => onToggleSelect?.(song),
    [onToggleSelect, song]
  );
  const handleLongPress = useCallback(
    () => onLongPress?.(song),
    [onLongPress, song]
  );

  return (
    <MediaTile
      width={width}
      variant={variant}
      artworkUri={song.artwork}
      title={song.title}
      subtitle={song.artist}
      selectionActive={selectionActive}
      selected={selected}
      onPress={handlePress}
      onToggleSelect={onToggleSelect ? handleToggleSelect : undefined}
      onLongPress={onLongPress ? handleLongPress : undefined}
    />
  );
});

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
  ListEmptyComponent,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
  selectedIds,
  selectionActive = false,
  onToggleSelect,
  onLongPressSong,
  mode = 'list',
}: SongListProps) {
  const listRef = useRef<FlatList<Song>>(null);
  // Letra resaltada en el índice A–Z: da feedback tras tocar un chip.
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const { tr } = useTranslation();
  const scrollIndicator = useScrollIndicator();
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const play = usePlayerStore((state) => state.play);

  // El Set solo se reconstruye cuando cambian los favoritos.
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // Set de selección: solo se reconstruye cuando cambia la selección.
  const selectedSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  // `extraData` estable: avisa a FlatList cuándo volver a pintar las filas
  // ya montadas (favoritos y selección). Un objeto nuevo en cada render
  // anularía la memoización, por eso se memoiza.
  const extraData = useMemo(
    () => ({ favoriteSet, selectedSet }),
    [favoriteSet, selectedSet]
  );

  // Se reproduce la cola recibida o, por defecto, la propia lista.
  const resolvedQueue = queue ?? songs;

  // Callbacks estables para no romper la memoización de las filas.
  const handleToggleFavorite = useCallback(
    (song: Song) => {
      void toggleFavorite(song.id);
    },
    [toggleFavorite]
  );

  // Reproducción desde las celdas de rejilla: conserva la cola completa.
  const playSong = useCallback(
    (song: Song) => {
      play(song, resolvedQueue);
    },
    [play, resolvedQueue]
  );

  const keyExtractor = useCallback((song: Song) => String(song.id), []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Song> | null | undefined, index: number) => ({
      length: SONG_ROW_HEIGHT,
      offset: SONG_ROW_HEIGHT * index,
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
        selectionActive={selectionActive}
        selected={selectedSet.has(item.id)}
        onToggleSelect={onToggleSelect}
        onLongPress={onLongPressSong}
      />
    ),
    [
      resolvedQueue,
      favoriteSet,
      handleToggleFavorite,
      onMore,
      selectionActive,
      selectedSet,
      onToggleSelect,
      onLongPressSong,
    ]
  );

  // Geometría única de la rejilla: columnas, ancho de celda y paddings
  // simétricos. El residuo del redondeo se reparte a ambos lados.
  const grid = getGridMetrics(mode, windowWidth);
  const { columns, tileWidth, gap, paddingLeft, paddingRight, isGrid, variant } = grid;

  const renderTile = useCallback(
    ({ item }: ListRenderItemInfo<Song>) => (
      <GridSongTile
        song={item}
        width={tileWidth}
        variant={variant}
        selectionActive={selectionActive}
        selected={selectedSet.has(item.id)}
        onPress={playSong}
        onToggleSelect={onToggleSelect}
        onLongPress={onLongPressSong}
      />
    ),
    [tileWidth, variant, selectionActive, selectedSet, onToggleSelect, onLongPressSong, playSong]
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
        (song) => initialKey(song.title) === letter
      );
      setActiveLetter(letter);

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

  // En rejilla no se muestra el índice alfabético: `scrollToIndex` asume
  // una fila por elemento y saltaría a la posición equivocada con numColumns.

  return (
    <View style={styles.container}>
      {!isGrid ? (
        <AlphabetChips
          letters={availableLetters}
          onSelect={scrollToLetter}
          itemNoun={tr('canciones')}
          activeLetter={activeLetter}
        />
      ) : null}

      <View style={styles.listFrame}>
        <FlatList
          ref={listRef}
          key={mode}
          data={songs}
          keyExtractor={keyExtractor}
          renderItem={isGrid ? renderTile : renderItem}
          numColumns={isGrid ? columns : undefined}
          columnWrapperStyle={
            isGrid ? { columnGap: gap, justifyContent: 'center' } : undefined
          }
          getItemLayout={isGrid ? undefined : getItemLayout}
          extraData={extraData}
          initialNumToRender={isGrid ? 16 : 12}
          maxToRenderPerBatch={isGrid ? 16 : 12}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
          {...scrollIndicator.scrollProps}
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
          ListEmptyComponent={ListEmptyComponent ?? undefined}
          contentContainerStyle={[
            styles.content,
            {
              paddingLeft,
              paddingRight,
              ...(isGrid ? { gap, rowGap: Spacing.xl } : null),
            },
            contentContainerStyle,
          ]}
        />
        <EdgeScrollIndicator {...scrollIndicator.indicatorProps} />
      </View>
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
  },

  listFrame: {
    flex: 1,
    position: 'relative',
    // El marco llega al borde real para que el indicador propio quede pegado a él.
    marginHorizontal: ScrollbarEdgeMargin,
  },

  flex: {
    flex: 1,
  },

  list: {
    width: '100%',
  },

  content: {
    paddingBottom: BottomTabInset + MiniPlayerInset,
    // Los paddings horizontales los calcula `getGridMetrics`: ahora son
    // simétricos y el indicador de 4 px cabe dentro de ese margen.
  },
});
