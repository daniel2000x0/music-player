import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { AlbumCard } from '@/components/album-card';
import { EmptyState } from '@/components/empty-state';
import { PlaylistCard } from '@/components/playlist-card';
import { PlaylistPicker } from '@/components/playlist-picker';
import { QuickAccess, type QuickAccessItem } from '@/components/quick-access';
import { RefreshButton } from '@/components/refresh-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { InlineSongList } from '@/components/song-list';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { resolveSongsByIds } from '@/domain/library/selection';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import type { Song } from '@/types/song';
import { formatSongCount } from '@/utils/format';

/**
 * Pantalla de inicio: resumen de la biblioteca, accesos rápidos, historial,
 * más escuchadas, álbumes recientes y playlists.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const songs = useLibraryStore((state) => state.songs);
  const albums = useLibraryStore((state) => state.albums);
  const artists = useLibraryStore((state) => state.artists);
  const playlists = useLibraryStore((state) => state.playlists);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const recentIds = useLibraryStore((state) => state.recentIds);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const isScanning = useLibraryStore((state) => state.isScanning);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const error = useLibraryStore((state) => state.error);
  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const refresh = useLibraryStore((state) => state.refresh);

  const [pickerSong, setPickerSong] = useState<Song | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const contentWidth = Math.min(width, MaxContentWidth) - Spacing.four * 2;
  const albumCardWidth = (contentWidth - Spacing.three) / 2;

  // Los audiolibros no cuentan como canciones en Inicio (ni en contadores
  // ni en recientes/más escuchadas): viven en su propia pestaña.
  const musicSongs = useMemo(() => songs.filter((song) => !song.isAudiobook), [songs]);
  // Set de ids para contar canciones de una playlist sin recorrer toda la
  // biblioteca por cada id (antes: O(canciones) por canción de la playlist).
  const songIdSet = useMemo(() => new Set(songs.map((song) => song.id)), [songs]);

  const recentSongs = useMemo(
    () =>
      resolveSongsByIds(songs, recentIds)
        .filter((song) => !song.isAudiobook)
        .slice(0, 5),
    [recentIds, songs]
  );
  const mostPlayed = useMemo(
    () =>
      [...musicSongs]
        .filter((song) => song.playCount > 0)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 5),
    [musicSongs]
  );
  const topAlbums = useMemo(
    () => [...albums].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4),
    [albums]
  );
  const topPlaylists = useMemo(() => playlists.slice(0, 3), [playlists]);

  const quickAccessItems = useMemo<QuickAccessItem[]>(
    () => [
      {
        key: 'favorites',
        label: 'Favoritos',
        icon: 'heart',
        count: favoriteIds.length,
        accent: 'accent',
        onPress: () => router.push({ pathname: '/songs', params: { view: 'favorites' } }),
      },
      {
        key: 'mostPlayed',
        label: 'Más escuchadas',
        icon: 'flame',
        count: mostPlayed.length,
        accent: 'textSecondary',
        onPress: () => router.push({ pathname: '/songs', params: { view: 'played' } }),
      },
      {
        key: 'recent',
        label: 'Recientes',
        icon: 'time',
        count: recentIds.length,
        accent: 'textSecondary',
        onPress: () => router.push('/songs'),
      },
    ],
    [favoriteIds.length, mostPlayed.length, recentIds.length]
  );

  const openPicker = (song: Song | null) => {
    setPickerSong(song);
    setPickerVisible(true);
  };

  if (isLoading) {
    return (
      <ScreenShell title="Mi Música" scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText type="small" themeColor="textSecondary">
            Cargando tu biblioteca…
          </ThemedText>
        </View>
      </ScreenShell>
    );
  }

  if (!hasPermission) {
    return (
      <ScreenShell title="Mi Música" scroll={false}>
        <EmptyState
          icon="folder-open-outline"
          title="Sin acceso a tu música"
          message="Concede permiso de audio para escanear las canciones de tu dispositivo."
          actionLabel="Conceder permiso"
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title="Mi Música"
        subtitle={`${formatSongCount(musicSongs.length)} · ${artists.length} artistas`}
        action={<RefreshButton />}
        refreshControl={
          <RefreshControl
            refreshing={isScanning}
            onRefresh={() => void refresh()}
            tintColor={theme.accent}
          />
        }>
        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.statsRow}>
          {[
            { label: 'Canciones', value: musicSongs.length },
            { label: 'Álbumes', value: albums.length },
            { label: 'Playlists', value: playlists.length },
          ].map((stat) => (
            <View key={stat.label} style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="subtitle" style={styles.statValue}>
                {stat.value}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {stat.label}
              </ThemedText>
            </View>
          ))}
        </View>

        <QuickAccess items={quickAccessItems} />

        {recentSongs.length > 0 ? (
          <View>
            <SectionHeader
              title="Reproducidas recientemente"
              actionLabel="Ver todo"
              onActionPress={() => router.push('/songs')}
            />
            <InlineSongList songs={recentSongs} onMore={openPicker} />
          </View>
        ) : null}

        {mostPlayed.length > 0 ? (
          <View>
            <SectionHeader
              title="Más escuchadas"
              actionLabel="Ver todo"
              onActionPress={() => router.push({ pathname: '/songs', params: { view: 'played' } })}
            />
            <InlineSongList songs={mostPlayed} onMore={openPicker} />
          </View>
        ) : null}

        <View>
          <SectionHeader
            title="Álbumes recientes"
            actionLabel="Ver todo"
            onActionPress={() => router.push('/albums')}
          />
          {topAlbums.length === 0 ? (
            <EmptyState title="Sin álbumes" message="Tus canciones aparecerán agrupadas aquí." />
          ) : (
            <View style={styles.grid}>
              {topAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  width={albumCardWidth}
                  onPress={() =>
                    router.push({ pathname: '/album/[id]', params: { id: String(album.id) } })
                  }
                />
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionHeader
            title="Tus playlists"
            actionLabel="Ver todo"
            onActionPress={() => router.push('/playlists')}
          />
          {topPlaylists.length === 0 ? (
            <EmptyState
              icon="list-outline"
              title="Sin playlists"
              message="Crea una playlist y agrega tus canciones favoritas."
              actionLabel="Crear playlist"
              onAction={() => openPicker(null)}
            />
          ) : (
            topPlaylists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                songCount={
                  playlist.songIds.filter((id) => songIdSet.has(id)).length
                }
                onPress={() =>
                  router.push({ pathname: '/playlist/[id]', params: { id: String(playlist.id) } })
                }
              />
            ))
          )}
        </View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    rowGap: Spacing.four,
  },
});
