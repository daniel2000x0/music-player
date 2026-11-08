import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { sortAlbums, sortArtists } from '@/domain/library/sorting';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import type { AlbumSortKey } from '@/types/filters';

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

  const contentWidth = Math.min(width, MaxContentWidth) - Spacing.four * 2;
  const cardWidth = (contentWidth - Spacing.three) / 2;

  const visibleAlbums = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? albums.filter(
          (album) =>
            album.title.toLowerCase().includes(term) ||
            album.artist.toLowerCase().includes(term)
        )
      : albums;
    return sortAlbums(filtered, sortKey);
  }, [albums, query, sortKey]);

  const visibleArtists = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? artists.filter((artist) => artist.name.toLowerCase().includes(term))
      : artists;
    return sortArtists(filtered, 'name-asc').filter((artist) => artist.songCount > 0);
  }, [artists, query]);

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
        ) : (
          <>
            {visibleArtists.length > 0 ? (
              <View>
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
              </View>
            ) : null}

            <View>
              <SectionHeader title="Álbumes" />
              {visibleAlbums.length === 0 ? (
                <EmptyState title="Sin resultados" message="No hay álbumes que coincidan." />
              ) : (
                <View style={styles.grid}>
                  {visibleAlbums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      width={cardWidth}
                      onPress={() =>
                        router.push({ pathname: '/album/[id]', params: { id: String(album.id) } })
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          </>
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
  artist: {
    width: 84,
    alignItems: 'center',
    gap: Spacing.one,
  },
  artistName: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    rowGap: Spacing.four,
  },
  loader: {
    marginTop: Spacing.five,
  },
});
