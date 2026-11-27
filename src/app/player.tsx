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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArtworkReveal } from '@/components/artwork-reveal';
import { AudioQualityBadge } from '@/components/audio-quality-badge';
import { EmptyState } from '@/components/empty-state';
import { InlineLyrics } from '@/components/inline-lyrics';
import { LyricsSheet } from '@/components/lyrics-sheet';
import { PlaylistPicker } from '@/components/playlist-picker';
import { SeekBar } from '@/components/seek-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VolumeControl } from '@/components/volume-control';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useLibraryStore } from '@/stores/library.store';
import { usePlaybackDuration, usePlaybackPosition } from '@/stores/playback-progress';
import { usePlayerStore } from '@/stores/player.store';
import { formatDuration } from '@/utils/format';
import {
  inlineLyricsBoxHeight,
  playerArtworkSize,
  playerContentGap,
} from '@/utils/player-layout';

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

  const { tr, t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isBuffering = usePlayerStore((state) => state.isBuffering);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  // Los valores de repeatMode son internos ('none'|'all'|'single'); la etiqueta
  // accesible se traduce para que el modo elegido se entienda en cualquier idioma.
  const repeatLabel =
    repeatMode === 'none'
      ? tr('sin repetición')
      : repeatMode === 'single'
        ? tr('una pista')
        : tr('toda la cola');
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
  // Se guarda el id de la canción, no un booleano: así la hoja se cierra sola
  // cuando cambia la pista (derived state) sin un effect que dispare renders.
  const [lyricsSongId, setLyricsSongId] = useState<number | null>(null);
  const lyricsVisible = currentSong?.id === lyricsSongId;

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

  const hasInlineLyrics = Boolean(currentSong?.lyrics);
  const artworkSize = playerArtworkSize(width, height, hasInlineLyrics);
  const contentGap = playerContentGap(height);
  const compact = height < 740;
  const ultraCompact = height < 680;

  if (!currentSong) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <Pressable hitSlop={10} onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-down" size={28} color={theme.text} />
          </Pressable>
          <EmptyState
            icon="musical-notes-outline"
            title={tr('Nada en reproducción')}
            message={tr('Elige una canción de la biblioteca para empezar.')}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const favorite = favoriteIds.includes(currentSong.id);

  // Motivo del aviso de controles del sistema (`C-01`). Se distingue el caso
  // del permiso denegado porque SÍ tiene arreglo: abrir los ajustes del sistema.
  const lockScreenWarning = !capabilities['playback.lockScreen']
    ? tr('Este entorno no admite controles del sistema. La reproducción puede detenerse en segundo plano.')
    : !capabilities['playback.notifications']
      ? tr('Las notificaciones están desactivadas: los controles de reproducción no aparecerán en la pantalla de bloqueo.')
      : tr('Los controles del sistema no están disponibles. La reproducción puede detenerse en segundo plano.');
  const canOpenNotificationSettings = !capabilities['playback.notifications'];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            hitSlop={10}
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={tr('Cerrar')}>
            <Ionicons name="chevron-down" size={28} color={theme.text} />
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            Reproduciendo
          </ThemedText>
          <Pressable
            hitSlop={10}
            onPress={() => router.push('/queue')}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={tr('Cola de reproducción')}>
            <Ionicons name="list" size={24} color={theme.text} />
          </Pressable>
        </View>

        <Animated.View
          style={[
            styles.content,
            {
              gap: contentGap,
              paddingBottom: Math.max(insets.bottom, Spacing.sm),
              opacity: enter,
              transform: [
                { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
              ],
            },
          ]}>
          {!capabilities['playback.lockScreen'] ||
          sessionState === 'degraded' ||
          lockScreen.status === 'degraded' ? (
            <View
              style={[
                styles.lockNotice,
                compact && styles.lockNoticeCompact,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              <Ionicons name="warning-outline" size={16} color={theme.danger} />
              <View style={styles.lockNoticeBody}>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={compact ? 2 : 3}>
                  {lockScreenWarning}
                </ThemedText>
                {canOpenNotificationSettings ? (
                  <Pressable
                    hitSlop={8}
                    onPress={() => void Linking.openSettings()}
                    accessibilityRole="button"
                    accessibilityLabel={tr('Abrir ajustes del sistema')}>
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      {tr('Abrir ajustes')}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Portada protagonista, con tamaño calculado para evitar scroll. */}
          <View style={[styles.artworkHero, { width: artworkSize, height: artworkSize }]}>
            <ArtworkReveal uri={currentSong.artwork} size={artworkSize} radius={Radius.large} elevated />
          </View>

          {hasInlineLyrics && currentSong.lyrics ? (
            <InlineLyrics
              lyrics={currentSong.lyrics}
              height={inlineLyricsBoxHeight(height)}
              numberOfLines={ultraCompact ? 1 : 2}
              onPress={() => setLyricsSongId(currentSong.id)}
            />
          ) : null}

          <View style={[styles.metaBlock, compact && styles.metaBlockCompact]}>
            <ThemedText
              type="subtitle"
              numberOfLines={ultraCompact ? 1 : 2}
              // El título puede cortarse en pantallas pequeñas: el label da
              // el texto completo y la región anuncia el cambio de pista.
              accessibilityLabel={`${currentSong.title} · ${currentSong.artist}`}
              accessibilityLiveRegion="polite"
              style={[styles.songTitle, compact && styles.songTitleCompact]}>
              {currentSong.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.artistLine}>
              {currentSong.artist} · {currentSong.album}
            </ThemedText>
            <View style={styles.qualityRow}>
              <AudioQualityBadge
                format={currentSong.fileFormat}
                bitDepth={currentSong.bitDepth}
                sampleRate={currentSong.sampleRate}
                bitrate={currentSong.bitrate}
                hasLyrics={currentSong.hasLyrics}
              />
            </View>
          </View>

          <PlayerProgress onSeek={seek} trackKey={currentSong.id} />

          <View style={styles.controlsBlock}>
            <View style={styles.modeRow}>
              <Pressable
                hitSlop={8}
                onPress={toggleShuffle}
                style={styles.modeButton}
                accessibilityRole="button"
                accessibilityLabel={tr('Aleatorio')}
                accessibilityState={{ selected: shuffle }}>
                <Ionicons name="shuffle" size={22} color={shuffle ? theme.accent : theme.textSecondary} />
              </Pressable>

              <View style={styles.transportRow}>
                <Pressable hitSlop={8} onPress={previous} style={styles.secondaryControl} accessibilityRole="button" accessibilityLabel={tr('Anterior')}>
                  <Ionicons name="play-skip-back" size={30} color={theme.text} />
                </Pressable>

                <Pressable
                  onPress={toggle}
                  style={[styles.playButton, compact && styles.playButtonCompact, { backgroundColor: theme.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Reproducir o pausar')}>
                  {isBuffering ? (
                    <ActivityIndicator color={theme.accentText} />
                  ) : (
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={compact ? 30 : 34}
                      color={theme.accentText}
                      style={!isPlaying ? styles.playIcon : undefined}
                    />
                  )}
                </Pressable>

                <Pressable hitSlop={8} onPress={next} style={styles.secondaryControl} accessibilityRole="button" accessibilityLabel={tr('Siguiente')}>
                  <Ionicons name="play-skip-forward" size={30} color={theme.text} />
                </Pressable>
              </View>

              <Pressable
                hitSlop={8}
                onPress={cycleRepeat}
                style={styles.modeButton}
                accessibilityRole="button"
                accessibilityLabel={t('repeatMode', { mode: repeatLabel })}
                accessibilityState={{ selected: repeatMode !== 'none' }}>
                <View>
                  <Ionicons
                    name={repeatMode === 'none' ? 'repeat-outline' : 'repeat'}
                    size={22}
                    color={repeatMode === 'none' ? theme.textSecondary : theme.accent}
                  />
                  {repeatMode === 'single' ? (
                    <View style={[styles.repeatBadge, { backgroundColor: theme.accent }]}>
                      <ThemedText style={[styles.repeatBadgeText, { color: theme.accentText }]}>1</ThemedText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                hitSlop={8}
                onPress={() => void toggleFavorite(currentSong.id)}
                style={styles.secondaryControl}
                accessibilityRole="button"
                accessibilityLabel={tr('Favorito')}
                accessibilityState={{ selected: favorite }}>
                <Ionicons
                  name={favorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={favorite ? theme.accent : theme.textSecondary}
                />
              </Pressable>

              {currentSong.lyrics ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => setLyricsSongId(currentSong.id)}
                  style={styles.secondaryControl}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Ver letras')}>
                  <Ionicons name="book-outline" size={24} color={theme.accent} />
                </Pressable>
              ) : null}

              <Pressable
                hitSlop={8}
                onPress={() => router.push('/queue')}
                style={styles.secondaryControl}
                accessibilityRole="button"
                accessibilityLabel={tr('Cola de reproducción')}>
                <Ionicons name="list" size={24} color={theme.textSecondary} />
              </Pressable>

              <Pressable
                hitSlop={8}
                onPress={() => setPickerVisible(true)}
                style={styles.secondaryControl}
                accessibilityRole="button"
                accessibilityLabel={tr('Agregar a playlist')}>
                <Ionicons name="add-circle-outline" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          <VolumeControl volume={volume} onChange={setVolume} />
        </Animated.View>
      </SafeAreaView>

      <PlaylistPicker
        visible={pickerVisible}
        song={currentSong}
        onClose={() => setPickerVisible(false)}
      />

      <LyricsSheet
        visible={lyricsVisible}
        song={currentSong}
        onClose={() => setLyricsSongId(null)}
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
    paddingVertical: Spacing.md,
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
  },
  lockNotice: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  lockNoticeCompact: {
    paddingVertical: 6,
  },
  lockNoticeBody: {
    flex: 1,
    gap: 2,
  },
  artworkHero: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
  },
  metaBlockCompact: {
    gap: 0,
  },
  qualityRow: {
    marginTop: 2,
    alignItems: 'center',
  },
  songTitle: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  songTitleCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  artistLine: {
    textAlign: 'center',
    opacity: 0.92,
  },
  progressBlock: {
    alignSelf: 'stretch',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  controlsBlock: {
    alignSelf: 'stretch',
    gap: Spacing.xs,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  modeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryControl: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCompact: {
    width: 64,
    height: 64,
  },
  playIcon: {
    marginLeft: 2,
  },
  repeatBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
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
});
