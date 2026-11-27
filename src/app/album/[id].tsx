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
import { TextPromptModal } from '@/components/text-prompt-modal';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { resolveSongsByIds, songsOfAlbum } from '@/domain/library/selection';
import { useSongLibraryActions } from '@/hooks/use-song-library-actions';
import { useSongSelection } from '@/hooks/use-song-selection';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { formatDuration, formatSongCount } from '@/utils/format';
import { useTranslation } from '@/hooks/use-translation';

type AlbumAction = 'rename' | 'delete';
type SongAction = 'playlist' | 'edit' | 'delete';

// NOTA (i18n): las opciones se construyen dentro del componente para que sus
// etiquetas sigan el idioma activo (los `const` de módulo no pueden usar hooks).

/** Detalle de álbum: portada, metadatos y lista de canciones. */
export default function AlbumDetailScreen() {
  const theme = useTheme();

  const { tr, t } = useTranslation();

  const albumActions: readonly Option<AlbumAction>[] = [
    {
      value: 'rename',
      label: tr('Renombrar álbum'),
      description: tr('Cambia el nombre en todas sus pistas.'),
    },
    {
      value: 'delete',
      label: tr('Eliminar álbum'),
      description: tr('Quita o borra todas sus pistas a la vez.'),
      destructive: true,
    },
  ];

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
  const params = useLocalSearchParams<{ id?: string }>();
  const albumId = Number(params.id);
  const album = useLibraryStore((state) => state.albums.find((item) => item.id === albumId));
  const librarySongs = useLibraryStore((state) => state.songs);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
  const renameAlbum = useLibraryStore((state) => state.renameAlbum);
  const play = usePlayerStore((state) => state.play);

  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [menuSong, setMenuSong] = useState<Song | null>(null);
  const [albumMenuVisible, setAlbumMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);

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
    () => (album ? songsOfAlbum(librarySongs, album) : []),
    [album, librarySongs]
  );

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

  const handleAlbumAction = useCallback(
    (action: AlbumAction) => {
      setAlbumMenuVisible(false);
      if (action === 'rename') {
        setRenameVisible(true);
      } else {
        requestDelete(songs, album?.title ?? tr('Álbum'));
      }
    },
    [songs, album?.title, requestDelete, tr]
  );

  // Al renombrar puede ocurrir una fusión con un álbum ya existente: en ese
  // caso el id actual desaparece y hay que seguir al álbum resultante.
  const handleRenameAlbum = useCallback(
    async (title: string) => {
      if (!album) {
        return;
      }
      const artist = album.artist;
      await renameAlbum(albumId, title);
      const merged = useLibraryStore
        .getState()
        .albums.find((item) => item.title === title && item.artist === artist);
      if (merged && merged.id !== albumId) {
        router.replace({ pathname: '/album/[id]', params: { id: String(merged.id) } });
      }
    },
    [album, albumId, renameAlbum]
  );

  const handleDeleteSelected = useCallback(() => {
    requestDelete(resolveSongsByIds(songs, selectedIds));
  }, [requestDelete, songs, selectedIds]);

  const handleConfirmDelete = useCallback(
    async (choice: DeleteChoice) => {
      await confirmDelete(choice);
      clear();
      // Si se eliminaron todas sus pistas, el álbum deja de existir: volver
      // a la pantalla anterior en vez de mostrar "Álbum no encontrado".
      const stillExists = useLibraryStore
        .getState()
        .albums.some((item) => item.id === albumId);
      if (!stillExists) {
        router.back();
      }
    },
    [confirmDelete, clear, albumId]
  );

  const back = <BackButton onPress={() => router.back()} />;

  // El detalle puede abrirse antes de que termine el escaneo inicial: muestra
  // el mismo esqueleto que las pestañas y permite reintentar si falló la lectura.
  if (isLoading && !album) {
    return (
      <ScreenShell title={tr('Álbum')} scroll={false} leading={back}>
        <SkeletonList rows={6} />
      </ScreenShell>
    );
  }

  if (error && !album) {
    return (
      <ScreenShell title={tr('Álbum')} scroll={false} leading={back}>
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

  if (!album) {
    return (
      <ScreenShell title={tr('Álbum')} leading={back}>
        <EmptyState title={tr('Álbum no encontrado')} message={tr('Puede que ya no esté en tu biblioteca.')} />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={album.title}
        subtitle={`${album.artist} · ${formatSongCount(album.songCount)}`}
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
          ) : (
            <Pressable
              onPress={() => setAlbumMenuVisible(true)}
              hitSlop={11}
              style={styles.headerAction}
              accessibilityRole="button"
              accessibilityLabel={tr('Opciones del álbum')}>
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
            </Pressable>
          )
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
              message={tr('Este álbum no tiene pistas disponibles.')}
            />
          }
          ListHeaderComponent={
            <View style={styles.hero}>
              <Artwork uri={album.artwork} size={160} radius={Radius.large} />
              <View style={styles.heroInfo}>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration(album.totalDuration)} de música
                </ThemedText>
                <Pressable
                  onPress={() => songs.length > 0 && play(songs[0], songs)}
                  style={[styles.playButton, { backgroundColor: theme.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('playAlbum', { title: album.title })}>
                  <Ionicons name="play" size={18} color={theme.accentText} />
                  <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                    {tr('Reproducir todo')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          }
        />
      </ScreenShell>

      <OptionSheet
        visible={albumMenuVisible}
        title={album.title}
        options={albumActions}
        onSelect={handleAlbumAction}
        onClose={() => setAlbumMenuVisible(false)}
      />
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
      <TextPromptModal
        visible={renameVisible}
        title={tr('Renombrar álbum')}
        placeholder={tr('Nombre del álbum')}
        initialValue={album.title}
        confirmLabel={tr('Renombrar')}
        onConfirm={handleRenameAlbum}
        onClose={() => setRenameVisible(false)}
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
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  heroInfo: {
    flex: 1,
    gap: Spacing.lg,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: MinTouchTarget,
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
  headerAction: {
    padding: Spacing.xs,
  },
});
