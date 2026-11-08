import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryBar, type CategoryOption } from '@/components/category-bar';
import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { PlaylistPicker } from '@/components/playlist-picker';
import { ScreenShell } from '@/components/screen-shell';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { filterSongs } from '@/domain/library/filters';
import { sortSongs } from '@/domain/library/sorting';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { SongSortKey, SongView } from '@/types/filters';
import type { Song } from '@/types/song';

const VIEWS: readonly CategoryOption<SongView>[] = [
  { key: 'all', label: 'Todas' },
  { key: 'favorites', label: 'Favoritos' },
  { key: 'played', label: 'Escuchadas' },
  { key: 'unplayed', label: 'Sin reproducir' },
];

const SORT_OPTIONS: readonly Option<SongSortKey>[] = [
  { value: 'title-asc', label: 'Título (A-Z)' },
  { value: 'title-desc', label: 'Título (Z-A)' },
  { value: 'artist-asc', label: 'Artista (A-Z)' },
  { value: 'artist-desc', label: 'Artista (Z-A)' },
  { value: 'album-asc', label: 'Álbum (A-Z)' },
  { value: 'album-desc', label: 'Álbum (Z-A)' },
  { value: 'duration-asc', label: 'Duración (menor)' },
  { value: 'duration-desc', label: 'Duración (mayor)' },
  { value: 'added-desc', label: 'Agregadas recientemente' },
  { value: 'plays-desc', label: 'Más escuchadas' },
  { value: 'lastPlayed-desc', label: 'Última reproducción' },
];

const isSongView = (value: string | undefined): value is SongView =>
  value === 'all' || value === 'favorites' || value === 'played' || value === 'unplayed';

/** Pantalla "Canciones": búsqueda, filtros, orden y reproducción. */
export default function SongsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ view?: string }>();
  const songs = useLibraryStore((state) => state.songs);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const play = usePlayerStore((state) => state.play);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SongSortKey>('title-asc');
  const [sortVisible, setSortVisible] = useState(false);
  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const view: SongView = isSongView(params.view) ? params.view : 'all';
  const setView = (next: SongView) => router.setParams({ view: next });

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const visibleSongs = useMemo(() => {
    const filtered = filterSongs(songs, { query, view }, favoriteSet);
    return sortSongs(filtered, sortKey);
  }, [songs, query, view, favoriteSet, sortKey]);

  const header = (
    <View style={styles.header}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por título, artista o álbum"
        placeholderTextColor={theme.textSecondary}
        returnKeyType="search"
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />
      <CategoryBar options={VIEWS} value={view} onChange={setView} />
      <View style={styles.toolbar}>
        <ThemedText type="small" themeColor="textSecondary">
          {visibleSongs.length} canciones
        </ThemedText>
        <Pressable
          onPress={() => setSortVisible(true)}
          style={[styles.sortButton, { backgroundColor: theme.backgroundElement }]}
          accessibilityLabel="Ordenar canciones">
          <Ionicons name="swap-vertical" size={16} color={theme.text} />
          <ThemedText type="small" numberOfLines={1}>
            {SORT_OPTIONS.find((option) => option.value === sortKey)?.label}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  if (!hasPermission) {
    return (
      <ScreenShell title="Canciones" scroll={false}>
        <EmptyState
          icon="folder-open-outline"
          title="Sin acceso a tu música"
          message="Concede permiso de audio para ver tus canciones."
          actionLabel="Conceder permiso"
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title="Canciones"
        subtitle={`${songs.length} en tu biblioteca`}
        action={
          visibleSongs.length > 0 ? (
            <Pressable
              onPress={() => play(visibleSongs[0], visibleSongs)}
              style={[styles.playAll, { backgroundColor: theme.accent }]}
              accessibilityLabel="Reproducir todo">
              <Ionicons name="play" size={16} color={theme.accentText} />
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                Reproducir
              </ThemedText>
            </Pressable>
          ) : null
        }
        header={header}>
        {isLoading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : visibleSongs.length === 0 ? (
          <EmptyState
            title="Nada por aquí"
            message="No hay canciones que coincidan con la búsqueda o el filtro."
          />
        ) : (
          <SongList
            songs={visibleSongs}
            onMore={(song) => {
              setPickerSong(song);
              setPickerVisible(true);
            }}
          />
        )}
      </ScreenShell>

      <OptionSheet
        visible={sortVisible}
        title="Ordenar canciones"
        options={SORT_OPTIONS}
        value={sortKey}
        onSelect={setSortKey}
        onClose={() => setSortVisible(false)}
      />
      <PlaylistPicker
        visible={pickerVisible}
        song={pickerSong}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  search: {
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    maxWidth: '65%',
  },
  playAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  loader: {
    marginTop: Spacing.five,
  },
});
