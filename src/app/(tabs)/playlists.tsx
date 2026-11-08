import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { PlaylistCard } from '@/components/playlist-card';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { TextPromptModal } from '@/components/text-prompt-modal';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { AUTO_PLAYLISTS, getAutoPlaylistSongs } from '@/domain/library/auto-playlists';
import { sortPlaylists } from '@/domain/library/sorting';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import type { PlaylistSortKey } from '@/types/filters';
import type { Playlist } from '@/types/playlist';

type PlaylistAction = 'rename' | 'delete';

const ACTION_OPTIONS: readonly Option<PlaylistAction>[] = [
  { value: 'rename', label: 'Renombrar' },
  { value: 'delete', label: 'Eliminar', destructive: true },
];

const SORT_OPTIONS: readonly Option<PlaylistSortKey>[] = [
  { value: 'name-asc', label: 'Nombre (A-Z)' },
  { value: 'name-desc', label: 'Nombre (Z-A)' },
  { value: 'created-desc', label: 'Más recientes' },
  { value: 'created-asc', label: 'Más antiguas' },
  { value: 'songs-desc', label: 'Más canciones' },
];

/** Pantalla "Playlists": automáticas + playlists del usuario. */
export default function PlaylistsScreen() {
  const theme = useTheme();
  const songs = useLibraryStore((state) => state.songs);
  const playlists = useLibraryStore((state) => state.playlists);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const recentIds = useLibraryStore((state) => state.recentIds);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const renamePlaylist = useLibraryStore((state) => state.renamePlaylist);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);

  const [sortKey, setSortKey] = useState<PlaylistSortKey>('created-desc');
  const [sortVisible, setSortVisible] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Playlist | null>(null);
  const [actionTarget, setActionTarget] = useState<Playlist | null>(null);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const sortedPlaylists = useMemo(
    () => sortPlaylists(playlists.filter((playlist) => !playlist.isAuto), sortKey),
    [playlists, sortKey]
  );

  const autoCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const definition of AUTO_PLAYLISTS) {
      map.set(
        definition.key,
        getAutoPlaylistSongs(definition.key, songs, favoriteSet, recentIds).length
      );
    }
    return map;
  }, [songs, favoriteSet, recentIds]);

  const handleAction = (action: PlaylistAction) => {
    const target = actionTarget;
    setActionTarget(null);
    if (!target) {
      return;
    }
    if (action === 'rename') {
      setRenameTarget(target);
      setPromptVisible(true);
      return;
    }
    Alert.alert('Eliminar playlist', `¿Eliminar "${target.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void deletePlaylist(target.id),
      },
    ]);
  };

  if (!hasPermission) {
    return (
      <ScreenShell title="Playlists" scroll={false}>
        <EmptyState
          icon="list-outline"
          title="Sin acceso a tu música"
          message="Concede permiso de audio para administrar tus playlists."
          actionLabel="Conceder permiso"
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title="Playlists"
        subtitle={`${sortedPlaylists.length} playlists propias`}
        action={
          <Pressable
            onPress={() => {
              setRenameTarget(null);
              setPromptVisible(true);
            }}
            style={[styles.newButton, { backgroundColor: theme.accent }]}
            accessibilityLabel="Crear playlist">
            <Ionicons name="add" size={18} color={theme.accentText} />
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              Nueva
            </ThemedText>
          </Pressable>
        }>
        {isLoading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : (
          <>
            <View>
              <SectionHeader title="Automáticas" />
              <View style={styles.autoGrid}>
                {AUTO_PLAYLISTS.map((definition) => (
                  <Pressable
                    key={definition.key}
                    onPress={() =>
                      router.push({
                        pathname: '/auto/[key]',
                        params: { key: definition.key },
                      })
                    }
                    style={({ pressed }) => [
                      styles.autoCard,
                      { backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <View style={[styles.autoIcon, { backgroundColor: theme.backgroundSelected }]}>
                      <Ionicons name={definition.icon} size={22} color={theme.accent} />
                    </View>
                    <View style={styles.autoInfo}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {definition.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {autoCounts.get(definition.key) ?? 0} canciones
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <SectionHeader
                title="Tus playlists"
                actionLabel="Ordenar"
                onActionPress={() => setSortVisible(true)}
              />
              {sortedPlaylists.length === 0 ? (
                <EmptyState
                  icon="list-outline"
                  title="Sin playlists"
                  message="Crea una playlist y agrega tus canciones favoritas."
                  actionLabel="Crear playlist"
                  onAction={() => {
                    setRenameTarget(null);
                    setPromptVisible(true);
                  }}
                />
              ) : (
                sortedPlaylists.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    songCount={playlist.songIds.length}
                    onPress={() =>
                      router.push({
                        pathname: '/playlist/[id]',
                        params: { id: String(playlist.id) },
                      })
                    }
                    onMore={() => setActionTarget(playlist)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScreenShell>

      <OptionSheet
        visible={sortVisible}
        title="Ordenar playlists"
        options={SORT_OPTIONS}
        value={sortKey}
        onSelect={setSortKey}
        onClose={() => setSortVisible(false)}
      />
      <OptionSheet
        visible={actionTarget !== null}
        title={actionTarget?.name ?? 'Playlist'}
        options={ACTION_OPTIONS}
        onSelect={handleAction}
        onClose={() => setActionTarget(null)}
      />
      <TextPromptModal
        visible={promptVisible}
        title={renameTarget ? 'Renombrar playlist' : 'Nueva playlist'}
        placeholder="Nombre de la playlist"
        initialValue={renameTarget?.name ?? ''}
        confirmLabel={renameTarget ? 'Guardar' : 'Crear'}
        onClose={() => {
          setPromptVisible(false);
          setRenameTarget(null);
        }}
        onConfirm={(value) => {
          if (renameTarget) {
            void renamePlaylist(renameTarget.id, value);
          } else {
            void createPlaylist(value);
          }
          setRenameTarget(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  loader: {
    marginTop: Spacing.five,
  },
  autoGrid: {
    gap: Spacing.two,
  },
  autoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  autoIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
