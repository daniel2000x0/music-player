import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { MediaTile } from '@/components/media-tile';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { PlaylistCard } from '@/components/playlist-card';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { SkeletonList } from '@/components/skeleton';
import { TextPromptModal } from '@/components/text-prompt-modal';
import { ThemedText } from '@/components/themed-text';
import { ViewModePicker } from '@/components/view-mode-picker';
import { Radius, Spacing } from '@/constants/theme';
import { AUTO_PLAYLISTS, getAutoPlaylistSongs } from '@/domain/library/auto-playlists';
import { sortPlaylists } from '@/domain/library/sorting';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useViewMode } from '@/hooks/use-view-mode';
import { useLibraryStore } from '@/stores/library.store';
import type { PlaylistSortKey } from '@/types/filters';
import type { Playlist } from '@/types/playlist';
import { displayMetadata } from '@/utils/format';
import { getGridMetrics } from '@/utils/grid-layout';

type PlaylistAction = 'rename' | 'delete';

// NOTA (i18n): las opciones se construyen en el componente para seguir
// el idioma activo. Ver `useTranslation`.

/** Pantalla "Playlists": automáticas + playlists del usuario. */
export default function PlaylistsScreen() {
  const theme = useTheme();
  const { tr, t } = useTranslation();
  const { mode } = useViewMode('playlists');
  const { width } = useWindowDimensions();
  const songs = useLibraryStore((state) => state.songs);
  const playlists = useLibraryStore((state) => state.playlists);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const recentIds = useLibraryStore((state) => state.recentIds);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
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

  const actionOptions: readonly Option<PlaylistAction>[] = [
    { value: 'rename', label: tr('Renombrar') },
    { value: 'delete', label: tr('Eliminar'), destructive: true },
  ];

  const sortOptions: readonly Option<PlaylistSortKey>[] = [
    { value: 'name-asc', label: tr('Nombre (A-Z)') },
    { value: 'name-desc', label: tr('Nombre (Z-A)') },
    { value: 'created-desc', label: tr('Más recientes') },
    { value: 'created-asc', label: tr('Más antiguas') },
    { value: 'songs-desc', label: tr('Más canciones') },
  ];

  // Columnas, ancho de celda y paddings centrados desde una única fórmula.
  const grid = getGridMetrics(mode, width);

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
    Alert.alert(
      tr('Eliminar playlist'),
      t('confirmDeletePlaylist', { name: displayMetadata(target.name) }),
      [
        { text: tr('Cancelar'), style: 'cancel' },
        {
          text: tr('Eliminar'),
          style: 'destructive',
          onPress: () => void deletePlaylist(target.id),
        },
      ]
    );
  };

  if (!hasPermission) {
    return (
      <ScreenShell title={tr('Playlists')} scroll={false}>
        <EmptyState
          icon="list-outline"
          title={tr('Sin acceso a tu música')}
          message={tr('Concede permiso de audio para administrar tus playlists.')}
          actionLabel={tr('Conceder permiso')}
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={tr('Playlists')}
        subtitle={t('ownPlaylists', { count: sortedPlaylists.length })}
        header={
          <View style={styles.viewPicker}>
            <ViewModePicker tab="playlists" />
          </View>
        }
        action={
          <Pressable
            onPress={() => {
              setRenameTarget(null);
              setPromptVisible(true);
            }}
            style={[styles.newButton, { backgroundColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityLabel={tr('Crear playlist')}>
            <Ionicons name="add" size={18} color={theme.accentText} />
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              {tr('Nueva')}
            </ThemedText>
          </Pressable>
        }>
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : error && songs.length === 0 ? (
          <EmptyState
            icon="alert-circle-outline"
            title={tr('No se pudo leer tu música')}
            message={error}
            actionLabel={tr('Reintentar')}
            onAction={() => void refresh()}
          />
        ) : songs.length === 0 && sortedPlaylists.length === 0 ? (
          <EmptyState
            icon="musical-notes-outline"
            title={tr('Tu biblioteca está vacía')}
            message={tr('Las playlists automáticas y las tuyas necesitan canciones en el dispositivo. Agrega música y vuelve a escanear.')}
            actionLabel={tr('Escanear de nuevo')}
            onAction={() => void refresh()}
          />
        ) : (
          <>
            <View>
              <SectionHeader title={tr('Automáticas')} />
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
                        {tr(definition.name)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {t('songsCount', { count: autoCounts.get(definition.key) ?? 0 })}
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <SectionHeader
                title={tr('Tus playlists')}
                actionLabel={tr('Ordenar playlists')}
                onActionPress={() => setSortVisible(true)}
              />
              {sortedPlaylists.length === 0 ? (
                <EmptyState
                  icon="list-outline"
                  title={tr('Sin playlists')}
                  message={tr('Crea una playlist y agrega tus canciones favoritas.')}
                  actionLabel={tr('Crear playlist')}
                  onAction={() => {
                    setRenameTarget(null);
                    setPromptVisible(true);
                  }}
                />
              ) : mode === 'list' ? (
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
              ) : (
                <FlatList
                  data={sortedPlaylists}
                  keyExtractor={(playlist) => String(playlist.id)}
                  numColumns={grid.columns}
                  columnWrapperStyle={{
                    columnGap: grid.gap,
                    justifyContent: 'center',
                  }}
                  key={mode}
                  renderItem={({ item }) => (
                    <MediaTile
                      width={grid.tileWidth}
                      variant={grid.variant}
                      fallbackIcon="list-outline"
                      title={displayMetadata(item.name)}
                      subtitle={t('songsCount', { count: item.songIds.length })}
                      accessibilityLabel={t('openPlaylist', {
                        name: item.name,
                        count: t('songsCount', { count: item.songIds.length }),
                      })}
                      onPress={() =>
                        router.push({
                          pathname: '/playlist/[id]',
                          params: { id: String(item.id) },
                        })
                      }
                      onLongPress={() => setActionTarget(item)}
                    />
                  )}
                  contentContainerStyle={[
                    styles.grid,
                    {
                      gap: grid.gap,
                      // Esta lista NO usa el marco con margen negativo de las
                      // otras pestañas: ScreenShell ya aporta Spacing.xl a cada
                      // lado, así que solo aplicamos el residuo del redondeo.
                      paddingLeft: grid.paddingLeft - Spacing.xl,
                      paddingRight: grid.paddingRight - Spacing.xl,
                    },
                  ]}
                  scrollEnabled={false}
                />
              )}
            </View>
          </>
        )}
      </ScreenShell>

      <OptionSheet
        visible={sortVisible}
        title={tr('Ordenar playlists')}
        options={sortOptions}
        value={sortKey}
        onSelect={setSortKey}
        onClose={() => setSortVisible(false)}
      />
      <OptionSheet
        visible={actionTarget !== null}
        title={actionTarget ? displayMetadata(actionTarget.name) : tr('Playlist')}
        options={actionOptions}
        onSelect={handleAction}
        onClose={() => setActionTarget(null)}
      />
      <TextPromptModal
        visible={promptVisible}
        title={renameTarget ? tr('Renombrar playlist') : tr('Nueva playlist')}
        placeholder={tr('Nombre de la playlist')}
        initialValue={renameTarget?.name ?? ''}
        confirmLabel={renameTarget ? tr('Guardar') : tr('Crear')}
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
  viewPicker: {
    flexDirection: 'row',
    paddingBottom: Spacing.sm,
  },
  grid: {
    rowGap: Spacing.xl,
    // `gap` y los paddings horizontales viven en `getGridMetrics`.
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
  autoGrid: {
    gap: Spacing.sm,
  },
  autoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
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
    gap: Spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
});
