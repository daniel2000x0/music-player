import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PlaylistPicker } from '@/components/playlist-picker';
import { ScreenShell } from '@/components/screen-shell';
import { SkeletonList } from '@/components/skeleton';
import { BackButton } from '@/components/back-button';
import { SongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
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
import { useTranslation } from '@/hooks/use-translation';

const isAutoKey = (value: string | undefined): value is AutoPlaylistKey =>
  AUTO_PLAYLISTS.some((item) => item.key === value);

/** Detalle de una playlist automática (favoritos, recientes, etc.). */
export default function AutoPlaylistScreen() {
  const theme = useTheme();

  const { tr, t } = useTranslation();
  const params = useLocalSearchParams<{ key?: string }>();
  const key = isAutoKey(params.key) ? params.key : 'mostPlayed';
  const definition = getAutoPlaylistDefinition(key);

  const songs = useLibraryStore((state) => state.songs);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const recentIds = useLibraryStore((state) => state.recentIds);
  const play = usePlayerStore((state) => state.play);

  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // Callback estable: `SongRow` está memoizado y una función nueva por render
  // obligaría a repintar todas las filas visibles.
  const handleMore = useCallback((song: Song) => {
    setPickerSong(song);
    setPickerVisible(true);
  }, [setPickerSong, setPickerVisible]);

  const list = useMemo(
    () => getAutoPlaylistSongs(key, songs, favoriteSet, recentIds),
    [key, songs, favoriteSet, recentIds]
  );

  const back = <BackButton onPress={() => router.back()} />;

  if (isLoading && list.length === 0) {
    return (
      <ScreenShell title={tr(definition.name)} scroll={false} leading={back}>
        <SkeletonList rows={6} />
      </ScreenShell>
    );
  }

  if (error && list.length === 0) {
    return (
      <ScreenShell title={tr(definition.name)} scroll={false} leading={back}>
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

  return (
    <>
      <ScreenShell
        title={tr(definition.name)}
        subtitle={tr(definition.description)}
        scroll={false}
        leading={back}
        action={
          list.length > 0 ? (
            <Pressable
              onPress={() => play(list[0], list)}
              style={[styles.playButton, { backgroundColor: theme.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('playTitle', { title: tr(definition.name) })}>
              <Ionicons name="play" size={18} color={theme.accentText} />
            </Pressable>
          ) : null
        }>
        <SongList
          songs={list}
          onMore={handleMore}
          ListEmptyComponent={
            <EmptyState
              icon="musical-notes-outline"
              title={tr('Sin canciones')}
              message={tr('Esta lista se llenará a medida que uses la aplicación.')}
            />
          }
          ListHeaderComponent={
            list.length > 0 ? (
              <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.bannerIcon, { backgroundColor: theme.backgroundSelected }]}>
                  <Ionicons name={definition.icon} size={26} color={theme.accent} />
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.bannerText}>
                  {list.length} canciones · se actualiza automáticamente
                </ThemedText>
              </View>
            ) : undefined
          }
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
  playButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
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
