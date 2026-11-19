import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { PlaylistPicker } from '@/components/playlist-picker';
import { ScreenShell } from '@/components/screen-shell';
import { SelectionActions } from '@/components/selection-actions';
import { SongDeleteSheet, type DeleteChoice } from '@/components/song-delete-sheet';
import { SongEditModal } from '@/components/song-edit-modal';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { resolveSongsByIds, songsOfArtist } from '@/domain/library/selection';
import { useSongLibraryActions } from '@/hooks/use-song-library-actions';
import { useSongSelection } from '@/hooks/use-song-selection';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { formatSongCount } from '@/utils/format';

type SongAction = 'playlist' | 'edit' | 'delete';

const SONG_ACTIONS: readonly Option<SongAction>[] = [
  {
    value: 'playlist',
    label: 'Agregar a playlist',
    description: 'Incluye esta canción en una playlist existente o nueva.',
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

/** Detalle de artista con sus canciones y álbumes. */
export default function ArtistDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ name?: string }>();
  const name = useMemo(() => {
    const raw = params.name ?? '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [params.name]);
  const artist = useLibraryStore((state) => state.artists.find((item) => item.name === name));
  const librarySongs = useLibraryStore((state) => state.songs);
  // Seleccionar el array completo y filtrar en `useMemo` evita devolver un
  // array nuevo en el selector (que re-renderiza en cada cambio del store).
  const allAlbums = useLibraryStore((state) => state.albums);
  const artistAlbums = useMemo(
    () => allAlbums.filter((album) => album.artist === name),
    [allAlbums, name]
  );
  const play = usePlayerStore((state) => state.play);

  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [menuSong, setMenuSong] = useState<Song | null>(null);

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

  const songs = useMemo(() => songsOfArtist(librarySongs, name), [librarySongs, name]);

  const handleSongAction = useCallback(
    (action: SongAction) => {
      const song = menuSong;
      setMenuSong(null);
      if (!song) {
        return;
      }
      if (action === 'playlist') {
        setPickerSong(song);
        setPickerVisible(true);
      } else if (action === 'edit') {
        requestEdit(song);
      } else {
        requestDelete(song);
      }
    },
    [menuSong, requestEdit, requestDelete]
  );

  const handleDeleteSelected = useCallback(() => {
    requestDelete(resolveSongsByIds(songs, selectedIds));
  }, [requestDelete, songs, selectedIds]);

  const handleConfirmDelete = useCallback(
    async (choice: DeleteChoice) => {
      await confirmDelete(choice);
      clear();
      // Si se eliminaron todas sus pistas, el artista deja de existir: volver
      // a la pantalla anterior en vez de mostrar "Artista no encontrado".
      const stillExists = useLibraryStore
        .getState()
        .artists.some((item) => item.name === name);
      if (!stillExists) {
        router.back();
      }
    },
    [confirmDelete, clear, name]
  );

  if (!artist || songs.length === 0) {
    return (
      <ScreenShell
        title="Artista"
        leading={
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
        }>
        <EmptyState title="Artista no encontrado" message="Puede que ya no esté en tu biblioteca." />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={artist.name}
        subtitle={`${formatSongCount(artist.songCount)} · ${artist.albumCount} álbumes`}
        scroll={false}
        leading={
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
        }
        action={
          isActive ? (
            <SelectionActions
              count={selectedIds.length}
              onSelectAll={() => selectAll(songs)}
              onDelete={handleDeleteSelected}
              onClose={clear}
            />
          ) : null
        }>
        <SongList
          songs={songs}
          onMore={(song) => setMenuSong(song)}
          selectedIds={selectedIds}
          selectionActive={isActive}
          onToggleSelect={toggle}
          onLongPressSong={toggle}
          ListHeaderComponent={
            <>
              <View style={styles.hero}>
                <Artwork size={120} radius={Radius.pill} />
                <Pressable
                  onPress={() => play(songs[0], songs)}
                  style={[styles.playButton, { backgroundColor: theme.accent }]}>
                  <Ionicons name="play" size={18} color={theme.accentText} />
                  <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                    Reproducir todo
                  </ThemedText>
                </Pressable>
              </View>

              {artistAlbums.length > 0 ? (
                <View style={styles.albumRow}>
                  {artistAlbums.map((album) => (
                    <Pressable
                      key={album.id}
                      onPress={() =>
                        router.push({ pathname: '/album/[id]', params: { id: String(album.id) } })
                      }
                      style={styles.albumItem}>
                      <Artwork uri={album.artwork} size={80} />
                      <ThemedText type="small" numberOfLines={1} style={styles.albumTitle}>
                        {album.title}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          }
        />
      </ScreenShell>

      <OptionSheet
        visible={menuSong !== null}
        title={menuSong?.title ?? 'Opciones de canción'}
        options={SONG_ACTIONS}
        onSelect={handleSongAction}
        onClose={() => setMenuSong(null)}
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
  albumRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  albumItem: {
    width: 80,
    gap: Spacing.xs,
  },
  albumTitle: {
    marginTop: Spacing.xs,
  },
});
