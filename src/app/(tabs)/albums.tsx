import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { AlbumCard } from '@/components/album-card';
import { Artwork } from '@/components/artwork';
import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { sortAlbums, sortArtists } from '@/domain/library/sorting';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import type { AlbumSortKey } from '@/types/filters';
import type { Album } from '@/types/song';

const SORT_OPTIONS: readonly Option<AlbumSortKey>[] = [
  { value: 'title-asc', label: 'Título (A-Z)' },
  { value: 'title-desc', label: 'Título (Z-A)' },
  { value: 'artist-asc', label: 'Artista (A-Z)' },
  { value: 'artist-desc', label: 'Artista (Z-A)' },
  { value: 'songs-desc', label: 'Más canciones' },
  { value: 'duration-desc', label: 'Mayor duración' },
  { value: 'added-desc', label: 'Agregados recientemente' },
];

/** Pantalla "Álbumes": artistas y álbumes derivados de la biblioteca. */
export default function AlbumsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const albums = useLibraryStore((state) => state.albums);
  const artists = useLibraryStore((state) => state.artists);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const requestAccess = useLibraryStore((state) => state.requestAccess);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<AlbumSortKey>('title-asc');
  const [sortVisible, setSortVisible] = useState(false);

  // El filtrado corre sobre el texto "asentado" (ver `useDebouncedValue`).
  const debouncedQuery = useDebouncedValue(query);

  const contentWidth = Math.min(width, MaxContentWidth) - Spacing.four * 2;
  const cardWidth = (contentWidth - Spacing.three) / 2;

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
        placeholder="Buscar álbumes o artistas"
        placeholderTextColor={theme.textSecondary}
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />
    </View>
  );

  if (!hasPermission) {
    return (
      <ScreenShell title="Álbumes" scroll={false}>
        <EmptyState
          icon="albums-outline"
          title="Sin acceso a tu música"
          message="Concede permiso de audio para ver tus álbumes."
          actionLabel="Conceder permiso"
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title="Álbumes"
        subtitle={`${albums.length} álbumes · ${artists.length} artistas`}
        scroll={false}
        action={
          <Pressable
            onPress={() => setSortVisible(true)}
            style={[styles.sortButton, { backgroundColor: theme.backgroundElement }]}
            accessibilityLabel="Ordenar álbumes">
            <Ionicons name="swap-vertical" size={16} color={theme.text} />
            <ThemedText type="small">Ordenar</ThemedText>
          </Pressable>
        }
        header={header}>
        {isLoading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : albums.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="Sin álbumes"
            message="Las canciones de tu dispositivo se agruparán por carpeta de álbum."
          />
        ) : visibleAlbums.length === 0 ? (
          <EmptyState title="Sin resultados" message="No hay álbumes que coincidan." />
        ) : (
          <FlatList
            data={visibleAlbums}
            keyExtractor={keyExtractor}
            numColumns={2}
            columnWrapperStyle={{ columnGap: Spacing.three }}
            key={`${cardWidth}`}
            renderItem={({ item }) => (
              <AlbumCard album={item} width={cardWidth} onPress={() => handleAlbumPress(item.id)} />
            )}
            ListHeaderComponent={
              visibleArtists.length > 0 ? (
                <View style={styles.albumsHeader}>
                  <SectionHeader title="Artistas" />
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
                          {artist.songCount} canciones
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <SectionHeader title="Álbumes" />
                </View>
              ) : (
                <SectionHeader title="Álbumes" />
              )
            }
            ListEmptyComponent={
              <EmptyState title="Sin resultados" message="No hay álbumes que coincidan." />
            }
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            showsVerticalScrollIndicator={false}
            style={styles.flex}
            contentContainerStyle={styles.gridContent}
          />
        )}
      </ScreenShell>

      <OptionSheet
        visible={sortVisible}
        title="Ordenar álbumes"
        options={SORT_OPTIONS}
        value={sortKey}
        onSelect={setSortKey}
        onClose={() => setSortVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: Spacing.two,
  },
  search: {
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  artistRow: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  albumsHeader: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  artist: {
    width: 84,
    alignItems: 'center',
    gap: Spacing.one,
  },
  artistName: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  gridContent: {
    rowGap: Spacing.four,
    paddingBottom: BottomTabInset + 110,
  },
  loader: {
    marginTop: Spacing.five,
  },
});
