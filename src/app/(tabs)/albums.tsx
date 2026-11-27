import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { AlbumCard } from '@/components/album-card';
import { AlbumRow } from '@/components/album-row';
import { Artwork } from '@/components/artwork';
import { MediaTile } from '@/components/media-tile';
import { EdgeScrollIndicator } from '@/components/edge-scroll-indicator';
import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { RefreshButton } from '@/components/refresh-button';
import { ScanProgressBanner } from '@/components/scan-progress-banner';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ViewModePicker } from '@/components/view-mode-picker';
import {
  BottomTabInset,
  MinTouchTarget,
  MiniPlayerInset,
  Radius,
  ScrollbarEdgeMargin,
  ScrollbarGutter,
  Spacing,
} from '@/constants/theme';
import { sortAlbums, sortArtists } from '@/domain/library/sorting';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useScrollIndicator } from '@/hooks/use-scroll-indicator';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useViewMode } from '@/hooks/use-view-mode';
import { useLibraryStore } from '@/stores/library.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { AlbumSortKey } from '@/types/filters';
import type { Album } from '@/types/song';
import { getGridMetrics } from '@/utils/grid-layout';

// NOTA (i18n): las opciones se crean dentro del componente para que sus
// etiquetas cambien con el idioma sin recargar la pantalla.

/** Pantalla "Álbumes": artistas y álbumes derivados de la biblioteca. */
export default function AlbumsScreen() {
  const theme = useTheme();
  const { tr, t } = useTranslation();
  const { mode } = useViewMode('albums');
  const scrollIndicator = useScrollIndicator();
  const { width } = useWindowDimensions();
  const albums = useLibraryStore((state) => state.albums);
  const artists = useLibraryStore((state) => state.artists);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const isScanning = useLibraryStore((state) => state.isScanning);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
  const requestAccess = useLibraryStore((state) => state.requestAccess);

  const [query, setQuery] = useState('');
  const sortKey = useSettingsStore((state) => state.sortModes.albums);
  const setSortMode = useSettingsStore((state) => state.setSortMode);
  const [sortVisible, setSortVisible] = useState(false);

  // El filtrado corre sobre el texto "asentado" (ver `useDebouncedValue`).
  const debouncedQuery = useDebouncedValue(query);

  // Una sola fuente de verdad para columnas, ancho de celda y paddings.
  // El residuo del redondeo se reparte a ambos lados para centrar la rejilla.
  const grid = getGridMetrics(mode, width);

  const sortOptions: readonly Option<AlbumSortKey>[] = [
    { value: 'title-asc', label: tr('Título (A-Z)') },
    { value: 'title-desc', label: tr('Título (Z-A)') },
    { value: 'artist-asc', label: tr('Artista (A-Z)') },
    { value: 'artist-desc', label: tr('Artista (Z-A)') },
    { value: 'songs-desc', label: tr('Más canciones') },
    { value: 'duration-desc', label: tr('Mayor duración') },
    { value: 'added-desc', label: tr('Agregados recientemente') },
  ];

  const visibleAlbums = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    const filtered = term
      ? albums.filter(
          (album) =>
            album.title.toLowerCase().includes(term) ||
            album.artist.toLowerCase().includes(term)
        )
      : albums;
    return sortAlbums(filtered, sortKey);
  }, [albums, debouncedQuery, sortKey]);

  const visibleArtists = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    const filtered = term
      ? artists.filter((artist) => artist.name.toLowerCase().includes(term))
      : artists;
    return sortArtists(filtered, 'name-asc').filter((artist) => artist.songCount > 0);
  }, [artists, debouncedQuery]);

  const handleAlbumPress = useCallback(
    (id: number) => router.push({ pathname: '/album/[id]', params: { id: String(id) } }),
    []
  );
  const keyExtractor = useCallback((album: Album) => String(album.id), []);

  const header = (
    <View style={styles.header}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={tr('Buscar álbumes o artistas')}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={tr('Buscar álbumes o artistas')}
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />
      {/* Selector al mismo nivel que la búsqueda/filtro de la pestaña. */}
      <ViewModePicker tab="albums" />
    </View>
  );

  if (!hasPermission) {
    return (
      <ScreenShell title={tr('Álbumes')} scroll={false}>
        <EmptyState
          icon="albums-outline"
          title={tr('Sin acceso a tu música')}
          message={tr('Concede permiso de audio para ver tus álbumes.')}
          actionLabel={tr('Conceder permiso')}
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={tr('Álbumes')}
        subtitle={t('albumsArtists', { albums: albums.length, artists: artists.length })}
        scroll={false}
        action={
          <View style={styles.actions}>
            <Pressable
              onPress={() => setSortVisible(true)}
              style={[styles.sortButton, { backgroundColor: theme.backgroundElement }]}
              accessibilityRole="button"
              accessibilityLabel={tr('Ordenar álbumes')}>
              <Ionicons name="swap-vertical" size={16} color={theme.text} />
              <ThemedText type="small">{tr('Ordenar álbumes')}</ThemedText>
            </Pressable>
            <RefreshButton />
          </View>
        }
        header={header}>
        <ScanProgressBanner />
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : error && albums.length === 0 ? (
          <EmptyState
            icon="alert-circle-outline"
            title={tr('No se pudo leer tu música')}
            message={error}
            actionLabel={tr('Reintentar')}
            onAction={() => void refresh()}
          />
        ) : albums.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title={tr('Sin álbumes')}
            message={tr('Las canciones de tu dispositivo se agruparán por carpeta de álbum.')}
          />
        ) : visibleAlbums.length === 0 ? (
          <EmptyState title={tr('Sin resultados')} message={tr('No hay álbumes que coincidan.')} />
        ) : (
          <View style={styles.listFrame}>
            <FlatList
              data={visibleAlbums}
              keyExtractor={keyExtractor}
              numColumns={grid.isGrid ? grid.columns : 1}
              columnWrapperStyle={
                grid.isGrid
                  ? { columnGap: grid.gap, justifyContent: 'center' }
                  : undefined
              }
              key={`${mode}-${grid.tileWidth}`}
              renderItem={({ item }) => {
                if (!grid.isGrid) {
                  return <AlbumRow album={item} onPress={() => handleAlbumPress(item.id)} />;
                }
                if (grid.variant === 'icon') {
                  return (
                    <MediaTile
                      width={grid.tileWidth}
                      variant="icon"
                      artworkUri={item.artwork}
                      title={item.title}
                      onPress={() => handleAlbumPress(item.id)}
                    />
                  );
                }
                return (
                  <AlbumCard
                    album={item}
                    width={grid.tileWidth}
                    onPress={() => handleAlbumPress(item.id)}
                  />
                );
              }}
              ListHeaderComponent={
                visibleArtists.length > 0 ? (
                  <View style={styles.albumsHeader}>
                    <SectionHeader title={tr('Artistas')} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.artistRow}>
                      {visibleArtists.map((artist) => (
                        <Pressable
                          key={artist.id}
                          onPress={() =>
                            router.push({
                              pathname: '/artist/[name]',
                              params: { name: encodeURIComponent(artist.name) },
                            })
                          }
                          style={styles.artist}>
                          <Artwork size={68} radius={Radius.pill} />
                          <ThemedText type="smallBold" numberOfLines={1} style={styles.artistName}>
                            {artist.name}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                            {t('songsCount', { count: artist.songCount })}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <SectionHeader title={tr('Álbumes')} />
                  </View>
                ) : (
                  <SectionHeader title={tr('Álbumes')} />
                )
              }
              ListEmptyComponent={
                <EmptyState title={tr('Sin resultados')} message={tr('No hay álbumes que coincidan.')} />
              }
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              {...scrollIndicator.scrollProps}
              style={styles.flex}
              contentContainerStyle={[
                styles.gridContent,
                {
                  paddingLeft: grid.paddingLeft,
                  paddingRight: grid.paddingRight,
                  ...(grid.isGrid ? { gap: grid.gap } : null),
                },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={isScanning}
                  onRefresh={() => void refresh()}
                  tintColor={theme.accent}
                  colors={[theme.accent]}
                />
              }
            />
            <EdgeScrollIndicator {...scrollIndicator.indicatorProps} />
          </View>
        )}
      </ScreenShell>

      <OptionSheet
        visible={sortVisible}
        title={tr('Ordenar álbumes')}
        options={sortOptions}
        value={sortKey}
        onSelect={(value) => void setSortMode('albums', value)}
        onClose={() => setSortVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    paddingRight: ScrollbarGutter,
  },
  search: {
    flex: 1,
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MinTouchTarget,
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  artistRow: {
    gap: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  albumsHeader: {
    gap: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  artist: {
    width: 84,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  artistName: {
    textAlign: 'center',
    marginTop: Spacing.xs,
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
  gridContent: {
    rowGap: Spacing.xl,
    paddingBottom: BottomTabInset + MiniPlayerInset,
    // Los paddings horizontales vienen de `getGridMetrics` y son simétricos.
  },
});
