import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PlaylistPicker } from '@/components/playlist-picker';
import { ScreenShell } from '@/components/screen-shell';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import {
  AUTO_PLAYLISTS,
  getAutoPlaylistDefinition,
  getAutoPlaylistSongs,
} from '@/domain/library/auto-playlists';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import type { AutoPlaylistKey } from '@/types/playlist';
import type { Song } from '@/types/song';

const isAutoKey = (value: string | undefined): value is AutoPlaylistKey =>
  AUTO_PLAYLISTS.some((item) => item.key === value);

/** Detalle de una playlist automática (favoritos, recientes, etc.). */
export default function AutoPlaylistScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ key?: string }>();
  const key = isAutoKey(params.key) ? params.key : 'mostPlayed';
  const definition = getAutoPlaylistDefinition(key);

  const songs = useLibraryStore((state) => state.songs);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const recentIds = useLibraryStore((state) => state.recentIds);
  const play = usePlayerStore((state) => state.play);

  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const list = useMemo(
    () => getAutoPlaylistSongs(key, songs, favoriteSet, recentIds),
    [key, songs, favoriteSet, recentIds]
  );

  return (
    <>
      <ScreenShell
        title={definition.name}
        subtitle={definition.description}
        scroll={false}
        leading={
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
        }
        action={
          list.length > 0 ? (
            <Pressable
              onPress={() => play(list[0], list)}
              style={[styles.playButton, { backgroundColor: theme.accent }]}
              accessibilityLabel={`Reproducir ${definition.name}`}>
              <Ionicons name="play" size={18} color={theme.accentText} />
            </Pressable>
          ) : null
        }>
        {list.length === 0 ? (
          <EmptyState
            icon="musical-notes-outline"
            title="Sin canciones"
            message="Esta lista se llenará a medida que uses la aplicación."
          />
        ) : (
          <SongList
            songs={list}
            onMore={(song) => {
              setPickerSong(song);
              setPickerVisible(true);
            }}
            ListHeaderComponent={
              <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.bannerIcon, { backgroundColor: theme.backgroundSelected }]}>
                  <Ionicons name={definition.icon} size={26} color={theme.accent} />
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.bannerText}>
                  {list.length} canciones · se actualiza automáticamente
                </ThemedText>
              </View>
            }
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
  playButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
});
