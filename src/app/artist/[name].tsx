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
import { formatSongCount } from '@/utils/format';

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
  const getSongsByArtist = useLibraryStore((state) => state.getSongsByArtist);
  const albums = useLibraryStore((state) =>
    state.albums.filter((album) => album.artist === name)
  );
  const play = usePlayerStore((state) => state.play);
  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const songs = useMemo(() => getSongsByArtist(name), [getSongsByArtist, name]);

  if (!artist || songs.length === 0) {
    return (
      <ScreenShell
        title="Artista"
        leading={
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Volver">
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
        leading={
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
        }>
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

        {albums.length > 0 ? (
          <View style={styles.albumRow}>
            {albums.map((album) => (
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

        <SongList
          songs={songs}
          onMore={(song) => {
            setPickerSong(song);
            setPickerVisible(true);
          }}
        />
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
    gap: Spacing.four,
    paddingVertical: Spacing.two,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  albumRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  albumItem: {
    width: 80,
    gap: Spacing.one,
  },
  albumTitle: {
    marginTop: Spacing.half,
  },
});
