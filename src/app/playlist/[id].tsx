import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { ScreenShell } from '@/components/screen-shell';
import { SkeletonList } from '@/components/skeleton';
import { BackButton } from '@/components/back-button';
import { SelectionActions } from '@/components/selection-actions';
import { SongDeleteSheet, type DeleteChoice } from '@/components/song-delete-sheet';
import { SongEditModal } from '@/components/song-edit-modal';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { resolveSongsByIds } from '@/domain/library/selection';
import { useSongLibraryActions } from '@/hooks/use-song-library-actions';
import { useSongSelection } from '@/hooks/use-song-selection';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { useTranslation } from '@/hooks/use-translation';
import { displayMetadata } from '@/utils/format';

type SongAction = 'playNext' | 'up' | 'down' | 'remove' | 'edit' | 'delete';

// NOTA (i18n): las opciones se construyen dentro del componente para que sus
// etiquetas sigan el idioma activo (los `const` de módulo no pueden usar hooks).

/** Detalle de una playlist manual con reordenamiento y eliminación. */
export default function PlaylistDetailScreen() {
  const theme = useTheme();

  const { tr, t } = useTranslation();

  const songActions: readonly Option<SongAction>[] = [
    { value: 'playNext', label: tr('Reproducir a continuación') },
    { value: 'up', label: tr('Subir en la lista') },
    { value: 'down', label: tr('Bajar en la lista') },
    { value: 'edit', label: tr('Editar información'), description: tr('Corrige el título, el artista o el álbum solo en esta app.') },
    {
      value: 'delete',
      label: tr('Eliminar'),
      description: tr('Quítala de la biblioteca o bórrala del dispositivo.'),
      destructive: true,
    },
    { value: 'remove', label: tr('Quitar de la playlist'), destructive: true },
  ];
  const params = useLocalSearchParams<{ id?: string }>();
  const playlistId = Number(params.id);
  const playlist = useLibraryStore((state) =>
    state.playlists.find((item) => item.id === playlistId)
  );
  const librarySongs = useLibraryStore((state) => state.songs);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
  const removeFromPlaylist = useLibraryStore((state) => state.removeFromPlaylist);
  const movePlaylistSong = useLibraryStore((state) => state.movePlaylistSong);
  const play = usePlayerStore((state) => state.play);
  const playNext = usePlayerStore((state) => state.playNext);

  const [actionSong, setActionSong] = useState<Song | null>(null);

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

  const songs = useMemo(
    () => (playlist ? resolveSongsByIds(librarySongs, playlist.songIds) : []),
    [playlist, librarySongs]
  );

  const handleSongAction = useCallback(
    (action: SongAction) => {
      const song = actionSong;
      setActionSong(null);
      if (!song || !playlist) {
        return;
      }
      if (action === 'playNext') {
        playNext(song);
      } else if (action === 'up' || action === 'down') {
        void movePlaylistSong(playlist.id, song.id, action);
      } else if (action === 'edit') {
        requestEdit(song);
      } else if (action === 'delete') {
        requestDelete(song);
      } else {
        void removeFromPlaylist(playlist.id, song.id);
      }
    },
    [actionSong, playlist, playNext, movePlaylistSong, requestEdit, requestDelete, removeFromPlaylist]
  );

  const handleDeleteSelected = useCallback(() => {
    requestDelete(resolveSongsByIds(songs, selectedIds));
  }, [requestDelete, songs, selectedIds]);

  const handleConfirmDelete = useCallback(
    async (choice: DeleteChoice) => {
      await confirmDelete(choice);
      clear();
    },
    [confirmDelete, clear]
  );

  const back = <BackButton onPress={() => router.back()} />;

  if (isLoading && !playlist) {
    return (
      <ScreenShell title={tr('Playlist')} scroll={false} leading={back}>
        <SkeletonList rows={6} />
      </ScreenShell>
    );
  }

  if (error && !playlist) {
    return (
      <ScreenShell title={tr('Playlist')} scroll={false} leading={back}>
        <EmptyState
          icon="alert-circle-outline"
          title={tr('No se pudo leer tu música')}
          message={error}
          actionLabel={tr('Reintentar')}
          onAction={() => void refresh()}
        />
      </ScreenShell>
    );
  }

  if (!playlist) {
    return (
      <ScreenShell title={tr('Playlist')} leading={back}>
        <EmptyState title={tr('Playlist no encontrada')} message={tr('Puede que hayas eliminado esta playlist.')} />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={displayMetadata(playlist.name)}
        subtitle={t('songsCount', { count: songs.length })}
        scroll={false}
        leading={back}
        action={
          isActive ? (
            <SelectionActions
              count={selectedIds.length}
              onSelectAll={() => selectAll(songs)}
              onDelete={handleDeleteSelected}
              onClose={clear}
            />
          ) : songs.length > 0 ? (
            <Pressable
              onPress={() => play(songs[0], songs)}
              style={[styles.playButton, { backgroundColor: theme.accent }]}
              accessibilityRole="button"
              accessibilityLabel={tr('Reproducir playlist')}>
              <Ionicons name="play" size={18} color={theme.accentText} />
            </Pressable>
          ) : null
        }>
        <SongList
          songs={songs}
          onMore={setActionSong}
          selectedIds={selectedIds}
          selectionActive={isActive}
          onToggleSelect={toggle}
          onLongPressSong={toggle}
          ListEmptyComponent={
            <EmptyState
              icon="list-outline"
              title={tr('Playlist vacía')}
              message={tr('Agrega canciones desde el menú de cada pista.')}
            />
          }
          ListFooterComponent={
            <View style={styles.hint}>
              <ThemedText type="small" themeColor="textSecondary">
                {tr('Usa el botón de opciones de cada canción para reordenarla o quitarla.')}
              </ThemedText>
            </View>
          }
        />
      </ScreenShell>

      <OptionSheet
        visible={actionSong !== null}
        title={actionSong?.title ?? tr('Canción')}
        options={songActions}
        onSelect={handleSongAction}
        onClose={() => setActionSong(null)}
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
  playButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  hint: {
    paddingTop: Spacing.sm,
  },
});
