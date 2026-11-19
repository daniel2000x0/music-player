import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryBar, type CategoryOption } from '@/components/category-bar';
import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { PlaylistPicker } from '@/components/playlist-picker';
import { RefreshButton } from '@/components/refresh-button';
import { ScreenShell } from '@/components/screen-shell';
import { SelectionActions } from '@/components/selection-actions';
import { SkeletonList } from '@/components/skeleton';
import { SongDeleteSheet, type DeleteChoice } from '@/components/song-delete-sheet';
import { SongEditModal } from '@/components/song-edit-modal';
import { SortSheet, type SortField } from '@/components/sort-sheet';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { filterSongs } from '@/domain/library/filters';
import { describeScanProgress } from '@/domain/library/scan-progress';
import { resolveSongsByIds } from '@/domain/library/selection';
import { sortDirectionOf, sortFieldOf, sortSongs } from '@/domain/library/sorting';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSongLibraryActions } from '@/hooks/use-song-library-actions';
import { useSongSelection } from '@/hooks/use-song-selection';
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

type SongAction = 'playlist' | 'audiobook' | 'edit' | 'delete';

const SONG_ACTIONS: readonly Option<SongAction>[] = [
  {
    value: 'playlist',
    label: 'Agregar a playlist',
    description: 'Incluye esta canción en una playlist existente o nueva.',
  },
  {
    value: 'audiobook',
    label: 'Agregar como audiolibro',
    description: 'Se oculta de Canciones y aparece en la pestaña Audiolibros.',
  },
  {
    value: 'edit',
    label: 'Editar información',
    description: 'Corrige el título, el artista o el álbum solo en esta app.',
  },
  {
    value: 'delete',
    label: 'Eliminar',
    description: 'Quítala de la biblioteca o bórrala del dispositivo.',
    destructive: true,
  },
];

const SORT_FIELDS: readonly SortField<SongSortKey>[] = [
  { value: 'title-asc', label: 'Título' },
  { value: 'artist-asc', label: 'Artista' },
  { value: 'album-asc', label: 'Álbum' },
  { value: 'duration-asc', label: 'Duración' },
  { value: 'added-desc', label: 'Agregadas' },
  { value: 'plays-desc', label: 'Reproducciones' },
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
  const isScanning = useLibraryStore((state) => state.isScanning);
  const scanProgress = useLibraryStore((state) => state.scanProgress);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const setAudiobook = useLibraryStore((state) => state.setAudiobook);
  const play = usePlayerStore((state) => state.play);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SongSortKey>('title-asc');
  const [sortVisible, setSortVisible] = useState(false);
  const [menuSong, setMenuSong] = useState<Song | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const { selectedIds, isActive, toggle, selectAll, clear } = useSongSelection();
  const {
    editSong,
    deleteTarget,
    requestEdit,
    confirmEdit,
    cancelEdit,
    requestDelete,
    confirmDelete,
    cancelDelete,
  } = useSongLibraryActions();

  const view: SongView = isSongView(params.view) ? params.view : 'all';
  const setView = useCallback(
    (next: SongView) => {
      if (next !== view) {
        router.setParams({ view: next });
      }
    },
    [view]
  );

  // El filtrado (caro con bibliotecas grandes) corre sobre el texto
  // "asentado"; el input responde al instante.
  const debouncedQuery = useDebouncedValue(query);

  // El Set solo se reconstruye cuando cambian los favoritos.
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // Filtros memorizados: filterSongs recibe una dependencia estable.
  const currentFilter = useMemo(
    () => ({ query: debouncedQuery, view }),
    [debouncedQuery, view]
  );

  // Filtrado + ordenamiento se recalculan solo cuando cambia una dependencia;
  // cambiar de pestaña y volver reutiliza el resultado memorizado.
  const visibleSongs = useMemo(() => {
    const filtered = filterSongs(songs, currentFilter, favoriteSet);
    return sortSongs(filtered, sortKey);
  }, [songs, currentFilter, favoriteSet, sortKey]);

  const handleMore = useCallback((song: Song) => {
    setMenuSong(song);
    setMenuVisible(true);
  }, []);

  // Elimina el lote seleccionado: abre el diálogo y, al confirmar, sale del
  // modo de selección (las pistas dejan de estar visibles).
  const handleDeleteSelected = useCallback(() => {
    requestDelete(resolveSongsByIds(visibleSongs, selectedIds));
  }, [requestDelete, visibleSongs, selectedIds]);

  const handleConfirmDelete = useCallback(
    async (choice: DeleteChoice) => {
      await confirmDelete(choice);
      clear();
    },
    [confirmDelete, clear]
  );

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
        <View style={styles.toolbarActions}>
          <RefreshButton />
          <Pressable
            onPress={() => setSortVisible(true)}
            style={[styles.sortButton, { backgroundColor: theme.backgroundElement }]}
            accessibilityRole="button"
            accessibilityLabel="Ordenar canciones">
            <Ionicons name="swap-vertical" size={16} color={theme.text} />
            <ThemedText type="small" numberOfLines={1}>
              {SORT_FIELDS.find((field) => sortFieldOf(field.value) === sortFieldOf(sortKey))?.label}
            </ThemedText>
            <Ionicons
              name={sortDirectionOf(sortKey) === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={14}
              color={theme.text}
            />
          </Pressable>
        </View>
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
        scroll={false}
        action={
          isActive ? (
            <SelectionActions
              count={selectedIds.length}
              onSelectAll={() => selectAll(visibleSongs)}
              onDelete={handleDeleteSelected}
              onClose={clear}
            />
          ) : visibleSongs.length > 0 ? (
            <Pressable
              onPress={() => play(visibleSongs[0], visibleSongs)}
              style={[styles.playAll, { backgroundColor: theme.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Reproducir todo">
              <Ionicons name="play" size={16} color={theme.accentText} />
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                Reproducir
              </ThemedText>
            </Pressable>
          ) : null
        }
        header={header}>
        {/* Escaneo observable: fase y conteo, también en la sincronización
            silenciosa del arranque en frío (`UI-06`). */}
        {scanProgress ? (
          <View style={[styles.scanBanner, { backgroundColor: theme.backgroundElement }]}>
            <ActivityIndicator size="small" color={theme.accent} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.scanText}>
              {describeScanProgress(scanProgress)}
            </ThemedText>
          </View>
        ) : null}
        {isLoading ? (
          <SkeletonList />
        ) : error && songs.length === 0 ? (
          <EmptyState
            icon="alert-circle-outline"
            title="No se pudo leer tu música"
            message={error}
            actionLabel="Reintentar"
            onAction={() => void refresh()}
          />
        ) : songs.length === 0 ? (
          <EmptyState
            icon="musical-notes-outline"
            title="Tu biblioteca está vacía"
            message="No se encontraron archivos de audio en este dispositivo. Copia música y vuelve a escanear."
            actionLabel="Escanear de nuevo"
            onAction={() => void refresh()}
          />
        ) : visibleSongs.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Sin resultados"
            message={
              query.trim()
                ? `Nada coincide con «${query.trim()}» en este filtro.`
                : 'No hay canciones en este filtro.'
            }
            actionLabel="Limpiar filtros"
            onAction={() => {
              setQuery('');
              setView('all');
            }}
          />
        ) : (
          <SongList
            songs={visibleSongs}
            onMore={handleMore}
            refreshing={isScanning}
            onRefresh={() => void refresh()}
            selectedIds={selectedIds}
            selectionActive={isActive}
            onToggleSelect={toggle}
            onLongPressSong={toggle}
          />
        )}
      </ScreenShell>

      <OptionSheet
        visible={menuVisible}
        title={menuSong?.title ?? 'Opciones de canción'}
        options={SONG_ACTIONS}
        onSelect={(action) => {
          if (!menuSong) {
            return;
          }
          if (action === 'playlist') {
            setPickerSong(menuSong);
            setPickerVisible(true);
          } else if (action === 'audiobook') {
            void setAudiobook([menuSong.id], true);
          } else if (action === 'edit') {
            requestEdit(menuSong);
          } else {
            requestDelete(menuSong);
          }
        }}
        onClose={() => setMenuVisible(false)}
      />
      <SortSheet
        visible={sortVisible}
        title="Ordenar canciones"
        fields={SORT_FIELDS}
        value={sortKey}
        onSelect={setSortKey}
        onClose={() => setSortVisible(false)}
      />
      <PlaylistPicker
        visible={pickerVisible}
        song={pickerSong}
        onClose={() => setPickerVisible(false)}
      />
      <SongEditModal
        visible={editSong !== null}
        initialValues={{
          title: editSong?.title ?? '',
          artist: editSong?.artist ?? '',
          album: editSong?.album ?? '',
        }}
        onConfirm={confirmEdit}
        onClose={cancelEdit}
      />
      <SongDeleteSheet
        visible={deleteTarget !== null}
        title={deleteTarget?.title ?? 'Eliminar'}
        onSelect={handleConfirmDelete}
        onClose={cancelDelete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  search: {
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    maxWidth: '65%',
    flexShrink: 1,
  },
  playAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.medium,
    marginBottom: Spacing.sm,
  },
  scanText: {
    flex: 1,
  },
});
