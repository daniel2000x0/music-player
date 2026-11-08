import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { EmptyState } from '@/components/empty-state';
import { PlaylistPicker } from '@/components/playlist-picker';
import { ScreenShell } from '@/components/screen-shell';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { formatDuration, formatSongCount } from '@/utils/format';

/** Detalle de álbum: portada, metadatos y lista de canciones. */
export default function AlbumDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const albumId = Number(params.id);
  const album = useLibraryStore((state) => state.albums.find((item) => item.id === albumId));
  const getSongsByAlbum = useLibraryStore((state) => state.getSongsByAlbum);
  const play = usePlayerStore((state) => state.play);

  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const songs = useMemo(
    () => (album ? getSongsByAlbum(album.id) : []),
    [album, getSongsByAlbum]
  );

  if (!album) {
    return (
      <ScreenShell
        title="Álbum"
        leading={
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
        }>
        <EmptyState title="Álbum no encontrado" message="Puede que ya no esté en tu biblioteca." />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={album.title}
        subtitle={`${album.artist} · ${formatSongCount(album.songCount)}`}
        leading={
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
        }>
        <View style={styles.hero}>
          <Artwork uri={album.artwork} size={160} radius={Radius.large} />
          <View style={styles.heroInfo}>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDuration(album.totalDuration)} de música
            </ThemedText>
            <Pressable
              onPress={() => songs.length > 0 && play(songs[0], songs)}
              style={[styles.playButton, { backgroundColor: theme.accent }]}>
              <Ionicons name="play" size={18} color={theme.accentText} />
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                Reproducir álbum
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {songs.length === 0 ? (
          <EmptyState title="Sin canciones" message="Este álbum no tiene pistas disponibles." />
        ) : (
          <SongList
            songs={songs}
            onMore={(song) => {
              setPickerSong(song);
              setPickerVisible(true);
            }}
          />
        )}
      </ScreenShell>

      <PlaylistPicker
        visible={pickerVisible}
        song={pickerSong}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  heroInfo: {
    flex: 1,
    gap: Spacing.three,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
});
