import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { PlaylistPicker } from '@/components/playlist-picker';
import { ScanProgressBanner } from '@/components/scan-progress-banner';
import { ScreenShell } from '@/components/screen-shell';
import { SelectionActions } from '@/components/selection-actions';
import { SkeletonList } from '@/components/skeleton';
import { SongDeleteSheet, type DeleteChoice } from '@/components/song-delete-sheet';
import { SongEditModal } from '@/components/song-edit-modal';
import { SortSheet, type SortField } from '@/components/sort-sheet';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { ViewModePicker } from '@/components/view-mode-picker';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { filterSongs } from '@/domain/library/filters';
import { resolveSongsByIds } from '@/domain/library/selection';
import { sortDirectionOf, sortFieldOf, sortSongs } from '@/domain/library/sorting';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSongLibraryActions } from '@/hooks/use-song-library-actions';
import { useSongSelection } from '@/hooks/use-song-selection';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useViewMode } from '@/hooks/use-view-mode';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { SongSortKey, SongView } from '@/types/filters';
import type { Song } from '@/types/song';

type SongAction = 'playlist' | 'audiobook' | 'edit' | 'delete';

// NOTA (i18n): estas opciones antes eran constantes de módulo. Ahora se
// construyen dentro del componente para que sus etiquetas sigan al idioma
// activo sin necesidad de reiniciar la pantalla.

const isSongView = (value: string | undefined): value is SongView =>
  value === 'all' ||
  value === 'favorites' ||
  value === 'withLyrics' ||
  value === 'played' ||
  value === 'unplayed';

/** Pantalla "Canciones": búsqueda, filtros, orden y reproducción. */
export default function SongsScreen() {
  const theme = useTheme();
  const { tr, t } = useTranslation();
  const { mode } = useViewMode('songs');
  const params = useLocalSearchParams<{ view?: string }>();
  const songs = useLibraryStore((state) => state.songs);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const isScanning = useLibraryStore((state) => state.isScanning);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const setAudiobook = useLibraryStore((state) => state.setAudiobook);
  const play = usePlayerStore((state) => state.play);

  const [query, setQuery] = useState('');
  const sortKey = useSettingsStore((state) => state.sortModes.songs);
  const setSortMode = useSettingsStore((state) => state.setSortMode);
  const songView = useSettingsStore((state) => state.songView);
  const setSongView = useSettingsStore((state) => state.setSongView);
  const [sortVisible, setSortVisible] = useState(false);
  const [viewVisible, setViewVisible] = useState(false);
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

  const views: readonly Option<SongView>[] = [
    { value: 'all', label: tr('Todas') },
    { value: 'favorites', label: tr('Favoritos') },
    { value: 'withLyrics', label: tr('Con letras') },
    { value: 'played', label: tr('Escuchadas') },
    { value: 'unplayed', label: tr('Sin reproducir') },
  ];

  const songActions: readonly Option<SongAction>[] = [
    {
      value: 'playlist',
      label: tr('Agregar a playlist'),
      description: tr('Incluye esta canción en una playlist existente o nueva.'),
    },
    {
      value: 'audiobook',
      label: tr('Agregar como audiolibro'),
      description: tr('Se oculta de Canciones y aparece en la pestaña Audiolibros.'),
    },
    {
      value: 'edit',
      label: tr('Editar información'),
      description: tr('Corrige el título, el artista o el álbum solo en esta app.'),
    },
    {
      value: 'delete',
      label: tr('Eliminar'),
      description: tr('Quítala de la biblioteca o bórrala del dispositivo.'),
      destructive: true,
    },
  ];

  const sortFields: readonly SortField<SongSortKey>[] = [
    { value: 'title-asc', label: tr('Título') },
    { value: 'artist-asc', label: tr('Artista') },
    { value: 'album-asc', label: tr('Álbum') },
    { value: 'duration-asc', label: tr('Duración') },
    { value: 'added-desc', label: tr('Agregadas') },
    { value: 'plays-desc', label: tr('Reproducciones') },
    { value: 'lastPlayed-desc', label: tr('Última reproducción') },
  ];

  // La vista persiste en SQLite (app_settings). Si llega por deep link/ruta,
  // se sincroniza una vez al store para que reabrir la app mantenga la elección.
  const view: SongView = isSongView(params.view) ? params.view : songView;
  useEffect(() => {
    if (isSongView(params.view) && params.view !== songView) {
      void setSongView(params.view);
    }
  }, [params.view, setSongView, songView]);

  const setView = useCallback(
    (next: SongView) => {
      void setSongView(next);
      if (next !== view) {
        router.setParams({ view: next });
      }
    },
    [setSongView, view]
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
        placeholder={tr('Buscar por título, artista o álbum')}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={tr('Buscar por título, artista o álbum')}
        returnKeyType="search"
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setViewVisible(true)}
          style={[styles.menuButton, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="button"
          accessibilityLabel={tr('Filtrar canciones por vista')}
          accessibilityHint={tr('Abre las opciones Todas, Favoritos, Con letras, Escuchadas y Sin reproducir')}>
          <Ionicons name="list-outline" size={16} color={theme.text} />
          <ThemedText type="small" numberOfLines={1} style={styles.menuButtonLabel}>
            {views.find((option) => option.value === view)?.label ?? tr('Todas')}
          </ThemedText>
          <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
        </Pressable>

        <ViewModePicker tab="songs" />

        <Pressable
          onPress={() => setSortVisible(true)}
          style={[styles.menuButton, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="button"
          accessibilityLabel={tr('Ordenar canciones')}>
          <Ionicons name="swap-vertical" size={16} color={theme.text} />
          <ThemedText type="small" numberOfLines={1} style={styles.menuButtonLabel}>
            {sortFields.find((field) => sortFieldOf(field.value) === sortFieldOf(sortKey))?.label}
          </ThemedText>
          <Ionicons
            name={sortDirectionOf(sortKey) === 'asc' ? 'arrow-up' : 'arrow-down'}
            size={14}
            color={theme.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );

  if (!hasPermission) {
    return (
      <ScreenShell title={tr('Canciones')} scroll={false}>
        <EmptyState
          icon="folder-open-outline"
          title={tr('Sin acceso a tu música')}
          message={tr('Concede permiso de audio para ver tus canciones.')}
          actionLabel={tr('Conceder permiso')}
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={tr('Canciones')}
        subtitle={t('songsInLibrary', { count: songs.length })}
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
              accessibilityLabel={tr('Reproducir todo')}>
              <Ionicons name="play" size={16} color={theme.accentText} />
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                {tr('Reproducir todo')}
              </ThemedText>
            </Pressable>
          ) : null
        }
        header={header}>
        {/* Escaneo observable: fase y conteo, también en la sincronización
            silenciosa del arranque en frío (`UI-06`). */}
        <ScanProgressBanner />
        {isLoading ? (
          <SkeletonList />
        ) : error && songs.length === 0 ? (
          <EmptyState
            icon="alert-circle-outline"
            title={tr('No se pudo leer tu música')}
            message={error}
            actionLabel={tr('Reintentar')}
            onAction={() => void refresh()}
          />
        ) : songs.length === 0 ? (
          <EmptyState
            icon="musical-notes-outline"
            title={tr('Tu biblioteca está vacía')}
            message={tr('No se encontraron archivos de audio en este dispositivo. Copia música y vuelve a escanear.')}
            actionLabel={tr('Escanear de nuevo')}
            onAction={() => void refresh()}
          />
        ) : (
          <SongList
            songs={visibleSongs}
            mode={mode}
            onMore={handleMore}
            refreshing={isScanning}
            onRefresh={() => void refresh()}
            selectedIds={selectedIds}
            selectionActive={isActive}
            onToggleSelect={toggle}
            onLongPressSong={toggle}
            ListEmptyComponent={
              <EmptyState
                icon="search-outline"
                title={tr('Sin resultados')}
                message={
                  query.trim()
                    ? t('noMatchQuery', { query: query.trim() })
                    : tr('No hay canciones en este filtro.')
                }
                actionLabel={tr('Limpiar filtros')}
                onAction={() => {
                  setQuery('');
                  setView('all');
                }}
              />
            }
          />
        )}
      </ScreenShell>

      <OptionSheet
        visible={menuVisible}
        title={menuSong?.title ?? tr('Opciones de canción')}
        options={songActions}
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
      <OptionSheet
        visible={viewVisible}
        title={tr('Mostrar canciones')}
        options={views}
        value={view}
        onSelect={setView}
        onClose={() => setViewVisible(false)}
      />
      <SortSheet
        visible={sortVisible}
        title={tr('Ordenar canciones')}
        fields={sortFields}
        value={sortKey}
        onSelect={(value) => void setSortMode('songs', value)}
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
        title={deleteTarget?.title ?? tr('Eliminar')}
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
    gap: Spacing.sm,
  },
  menuButton: {
    flex: 1,
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  menuButtonLabel: {
    flexShrink: 1,
  },
  playAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MinTouchTarget,
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
});
