import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArtworkReveal } from '@/components/artwork-reveal';
import { EmptyState } from '@/components/empty-state';
import { PlaylistPicker } from '@/components/playlist-picker';
import { SeekBar } from '@/components/seek-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VolumeControl } from '@/components/volume-control';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useLibraryStore } from '@/stores/library.store';
import { usePlaybackDuration, usePlaybackPosition } from '@/stores/playback-progress';
import { usePlayerStore } from '@/stores/player.store';
import { formatDuration } from '@/utils/format';

/**
 * Bloque de progreso (barra + tiempos). Suscribe posición y duración al
 * almacén aislado: solo este componente se re-renderiza con cada tick de
 * reproducción (2 por segundo), no la pantalla completa.
 */
function PlayerProgress({
  onSeek,
  trackKey,
}: {
  onSeek: (seconds: number) => void;
  trackKey: number;
}) {
  const position = usePlaybackPosition();
  const duration = usePlaybackDuration();

  return (
    <View style={styles.progressBlock}>
      <SeekBar key={trackKey} position={position} duration={duration} onSeek={onSeek} />
      <View style={styles.timeRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDuration(position)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDuration(duration)}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Reproductor a pantalla completa. El estado vive en el store global, así que
 * la reproducción continúa al cerrar esta pantalla.
 */
export default function PlayerScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isBuffering = usePlayerStore((state) => state.isBuffering);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const toggle = usePlayerStore((state) => state.toggle);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const seek = usePlayerStore((state) => state.seek);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const volume = usePlayerStore((state) => state.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const sessionState = usePlayerStore((state) => state.sessionState);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const lockScreen = usePlayerStore((state) => state.lockScreen);
  const capabilities = useCapabilities();

  const [pickerVisible, setPickerVisible] = useState(false);

  // Transición mini-reproductor → reproductor (`UI-08`): el contenido entra
  // con un leve deslizamiento hacia arriba y un fundido, dando continuidad
  // con el mini-reproductor del que se viene.
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter]);

  const artworkSize = Math.min(width - Spacing.xl * 2, MaxContentWidth - Spacing.xl * 2, 360);

  if (!currentSong) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Pressable hitSlop={8} onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="chevron-down" size={28} color={theme.text} />
          </Pressable>
          <EmptyState
            icon="musical-notes-outline"
            title="Nada en reproducción"
            message="Elige una canción de la biblioteca para empezar."
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const favorite = favoriteIds.includes(currentSong.id);

  // Motivo del aviso de controles del sistema (`C-01`). Se distingue el caso
  // del permiso denegado porque SÍ tiene arreglo: abrir los ajustes del sistema.
  const lockScreenWarning = !capabilities['playback.lockScreen']
    ? 'Este entorno no admite controles del sistema. La reproducción puede detenerse en segundo plano.'
    : !capabilities['playback.notifications']
      ? 'Las notificaciones están desactivadas: los controles de reproducción no aparecerán en la pantalla de bloqueo.'
      : 'Los controles del sistema no están disponibles. La reproducción puede detenerse en segundo plano.';
  const canOpenNotificationSettings = !capabilities['playback.notifications'];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            hitSlop={8}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Ionicons name="chevron-down" size={28} color={theme.text} />
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            Reproduciendo
          </ThemedText>
          <Pressable
            hitSlop={8}
            onPress={() => router.push('/queue')}
            accessibilityRole="button"
            accessibilityLabel="Cola de reproducción">
            <Ionicons name="list" size={24} color={theme.text} />
          </Pressable>
        </View>

        {!capabilities['playback.lockScreen'] ||
        sessionState === 'degraded' ||
        lockScreen.status === 'degraded' ? (
          <View
            style={[
              styles.lockNotice,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            <Ionicons name="warning-outline" size={16} color={theme.danger} />
            <View style={styles.lockNoticeBody}>
              <ThemedText type="small" themeColor="textSecondary">
                {lockScreenWarning}
              </ThemedText>
              {canOpenNotificationSettings ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => void Linking.openSettings()}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir ajustes del sistema">
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    Abrir ajustes
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={{
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          }}>
          <ArtworkReveal uri={currentSong.artwork} size={artworkSize} radius={Radius.large} />

          <View style={styles.meta}>
            <ThemedText type="subtitle" numberOfLines={2} style={styles.songTitle}>
              {currentSong.title}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" numberOfLines={1}>
              {currentSong.artist} · {currentSong.album}
            </ThemedText>
          </View>

          <PlayerProgress onSeek={seek} trackKey={currentSong.id} />

          <View style={styles.controls}>
            <Pressable
              hitSlop={8}
              onPress={toggleShuffle}
              style={styles.controlWithState}
              accessibilityRole="button"
              accessibilityLabel="Aleatorio"
              accessibilityState={{ selected: shuffle }}>
              <Ionicons
                name="shuffle"
                size={24}
                color={shuffle ? theme.accent : theme.textSecondary}
              />
              <View
                style={[
                  styles.activeDot,
                  { backgroundColor: shuffle ? theme.accent : 'transparent' },
                ]}
              />
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={previous}
              accessibilityRole="button"
              accessibilityLabel="Anterior">
              <Ionicons name="play-skip-back" size={34} color={theme.text} />
            </Pressable>

            <Pressable
              onPress={toggle}
              style={[styles.playButton, { backgroundColor: theme.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Reproducir o pausar">
              {isBuffering ? (
                <ActivityIndicator color={theme.accentText} />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={34}
                  color={theme.accentText}
                  style={styles.playIcon}
                />
              )}
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={next}
              accessibilityRole="button"
              accessibilityLabel="Siguiente">
              <Ionicons name="play-skip-forward" size={34} color={theme.text} />
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={cycleRepeat}
              style={styles.controlWithState}
              accessibilityRole="button"
              accessibilityLabel={`Repetir: ${repeatMode}`}
              accessibilityState={{ selected: repeatMode !== 'none' }}>
              <View>
                <Ionicons
                  name={repeatMode === 'none' ? 'repeat-outline' : 'repeat'}
                  size={24}
                  color={repeatMode === 'none' ? theme.textSecondary : theme.accent}
                />
                {repeatMode === 'single' ? (
                  <View style={[styles.repeatBadge, { backgroundColor: theme.accent }]}>
                    <ThemedText style={[styles.repeatBadgeText, { color: theme.accentText }]}>
                      1
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.activeDot,
                  { backgroundColor: repeatMode !== 'none' ? theme.accent : 'transparent' },
                ]}
              />
            </Pressable>
          </View>

          <VolumeControl volume={volume} onChange={setVolume} />

          <View style={styles.actions}>
            <Pressable
              hitSlop={8}
              onPress={() => void toggleFavorite(currentSong.id)}
              style={styles.actionItem}
              accessibilityRole="button"
              accessibilityLabel="Favorito"
              accessibilityState={{ selected: favorite }}>
              <Ionicons
                name={favorite ? 'heart' : 'heart-outline'}
                size={26}
                color={favorite ? theme.accent : theme.textSecondary}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Favorito
              </ThemedText>
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={() => setPickerVisible(true)}
              style={styles.actionItem}
              accessibilityRole="button"
              accessibilityLabel="Agregar a playlist">
              <Ionicons name="add-circle-outline" size={26} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Playlist
              </ThemedText>
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={() => router.push('/queue')}
              style={styles.actionItem}
              accessibilityRole="button"
              accessibilityLabel="Cola de reproducción">
              <Ionicons name="list-outline" size={26} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Cola
              </ThemedText>
            </Pressable>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>

      <PlaylistPicker
        visible={pickerVisible}
        song={currentSong}
        onClose={() => setPickerVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.xl,
  },
  closeButton: {
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  lockNoticeBody: {
    flex: 1,
    gap: Spacing.xs,
  },
  meta: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  songTitle: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  progressBlock: {
    alignSelf: 'stretch',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.lg,
  },
  controlWithState: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  activeDot: {
    width: Spacing.xs,
    height: Spacing.xs,
    borderRadius: Radius.pill,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: Spacing.xs,
  },
  repeatBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBadgeText: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xxl,
    marginTop: Spacing.sm,
  },
  actionItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
