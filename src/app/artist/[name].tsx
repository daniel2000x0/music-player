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
import { SkeletonList } from '@/components/skeleton';
import { BackButton } from '@/components/back-button';
import { SongDeleteSheet, type DeleteChoice } from '@/components/song-delete-sheet';
import { SongEditModal } from '@/components/song-edit-modal';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { resolveSongsByIds, songsOfArtist } from '@/domain/library/selection';
import { useSongLibraryActions } from '@/hooks/use-song-library-actions';
import { useSongSelection } from '@/hooks/use-song-selection';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { formatSongCount } from '@/utils/format';
import { useTranslation } from '@/hooks/use-translation';

type SongAction = 'playlist' | 'edit' | 'delete';

// NOTA (i18n): las opciones se construyen dentro del componente para que sus
// etiquetas sigan el idioma activo (los `const` de módulo no pueden usar hooks).

/** Detalle de artista con sus canciones y álbumes. */
export default function ArtistDetailScreen() {
  const theme = useTheme();

  const { tr, t } = useTranslation();

  const songActions: readonly Option<SongAction>[] = [
    {
      value: 'playlist',
      label: tr('Agregar a playlist'),
      description: tr('Incluye esta canción en una playlist existente o nueva.'),
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
  const isLoading = useLibraryStore((state) => state.isLoading);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
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

  const back = <BackButton onPress={() => router.back()} />;

  if (isLoading && !artist) {
    return (
      <ScreenShell title={tr('Artista')} scroll={false} leading={back}>
        <SkeletonList rows={6} />
      </ScreenShell>
    );
  }

  if (error && !artist) {
    return (
      <ScreenShell title={tr('Artista')} scroll={false} leading={back}>
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

  if (!artist) {
    return (
      <ScreenShell
        title={tr('Artista')}
        leading={back}>
        <EmptyState title={tr('Artista no encontrado')} message={tr('Puede que ya no esté en tu biblioteca.')} />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={artist.name}
        subtitle={t('artistSummary', {
          songs: formatSongCount(artist.songCount),
          albums: artist.albumCount,
        })}
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
          ) : null
        }>
        <SongList
          songs={songs}
          onMore={setMenuSong}
          selectedIds={selectedIds}
          selectionActive={isActive}
          onToggleSelect={toggle}
          onLongPressSong={toggle}
          ListEmptyComponent={
            <EmptyState
              title={tr('Sin canciones')}
              message={tr('Este artista no tiene pistas disponibles.')}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.hero}>
                <Artwork size={120} radius={Radius.pill} />
                {songs.length > 0 ? (
                  <Pressable
                    onPress={() => play(songs[0], songs)}
                    style={[styles.playButton, { backgroundColor: theme.accent }]}
                    accessibilityRole="button"
                    accessibilityLabel={tr('Reproducir todo')}>
                    <Ionicons name="play" size={18} color={theme.accentText} />
                    <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                      {tr('Reproducir todo')}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {artistAlbums.length > 0 ? (
                <View style={styles.albumRow}>
                  {artistAlbums.map((album) => (
                    <Pressable
                      key={album.id}
                      onPress={() =>
                        router.push({ pathname: '/album/[id]', params: { id: String(album.id) } })
                      }
                      style={styles.albumItem}
                      accessibilityRole="button"
                      accessibilityLabel={album.title}>
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
        title={menuSong?.title ?? tr('Opciones de canción')}
        options={songActions}
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
        title={deleteTarget?.title ?? tr('Eliminar')}
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
    justifyContent: 'center',
    minHeight: MinTouchTarget,
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
