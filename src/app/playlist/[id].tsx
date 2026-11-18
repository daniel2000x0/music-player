import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { ScreenShell } from '@/components/screen-shell';
import { SelectionActions } from '@/components/selection-actions';
import { SongDeleteSheet, type DeleteChoice } from '@/components/song-delete-sheet';
import { SongEditModal } from '@/components/song-edit-modal';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { resolveSongsByIds } from '@/domain/library/selection';
import { useSongLibraryActions } from '@/hooks/use-song-library-actions';
import { useSongSelection } from '@/hooks/use-song-selection';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';

type SongAction = 'playNext' | 'up' | 'down' | 'remove' | 'edit' | 'delete';

const SONG_ACTIONS: readonly Option<SongAction>[] = [
  { value: 'playNext', label: 'Reproducir a continuación' },
  { value: 'up', label: 'Subir en la lista' },
  { value: 'down', label: 'Bajar en la lista' },
  { value: 'edit', label: 'Editar información', description: 'Corrige el título, el artista o el álbum solo en esta app.' },
  {
    value: 'delete',
    label: 'Eliminar',
    description: 'Quítala de la biblioteca o bórrala del dispositivo.',
    destructive: true,
  },
  { value: 'remove', label: 'Quitar de la playlist', destructive: true },
];

/** Detalle de una playlist manual con reordenamiento y eliminación. */
export default function PlaylistDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const playlistId = Number(params.id);
  const playlist = useLibraryStore((state) =>
    state.playlists.find((item) => item.id === playlistId)
  );
  const librarySongs = useLibraryStore((state) => state.songs);
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

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Volver">
      <Ionicons name="chevron-back" size={26} color={theme.text} />
    </Pressable>
  );

  if (!playlist) {
    return (
      <ScreenShell title="Playlist" leading={back}>
        <EmptyState title="Playlist no encontrada" message="Puede que hayas eliminado esta playlist." />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={playlist.name}
        subtitle={`${songs.length} canciones`}
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
              accessibilityLabel="Reproducir playlist">
              <Ionicons name="play" size={18} color={theme.accentText} />
            </Pressable>
          ) : null
        }>
        {songs.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title="Playlist vacía"
            message="Agrega canciones desde el menú de cada pista."
          />
        ) : (
          <SongList
            songs={songs}
            onMore={(song) => setActionSong(song)}
            selectedIds={selectedIds}
            selectionActive={isActive}
            onToggleSelect={toggle}
            onLongPressSong={toggle}
            ListFooterComponent={
              <View style={styles.hint}>
                <ThemedText type="small" themeColor="textSecondary">
                  Usa el botón de opciones de cada canción para reordenarla o quitarla.
                </ThemedText>
              </View>
            }
          />
        )}
      </ScreenShell>

      <OptionSheet
        visible={actionSong !== null}
        title={actionSong?.title ?? 'Canción'}
        options={SONG_ACTIONS}
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
        title={deleteTarget?.title ?? 'Eliminar'}
        onSelect={handleConfirmDelete}
        onClose={cancelDelete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  playButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  hint: {
    paddingTop: Spacing.two,
  },
});
