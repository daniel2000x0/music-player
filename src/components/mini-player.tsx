import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Artwork } from '@/components/artwork';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlaybackDuration, usePlaybackPosition } from '@/stores/playback-progress';
import { usePlayerStore } from '@/stores/player.store';

export type MiniPlayerProps = {
  /** Distancia desde el borde inferior de la pantalla (alto del tab bar). */
  bottomOffset?: number;
  style?: ViewStyle;
};

/**
 * Barra de progreso del mini-reproductor. Suscribe posición y duración al
 * almacén aislado para que el resto del MiniPlayer (portada, textos,
 * controles) no se re-renderice con cada tick de reproducción.
 */
function MiniPlayerProgress() {
  const theme = useTheme();
  const position = usePlaybackPosition();
  const duration = usePlaybackDuration();

  const progress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;

  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${progress * 100}%` }]} />
    </View>
  );
}

/**
 * Mini-reproductor flotante. Tocar el cuerpo abre `/player`.
 */
export function MiniPlayer({ bottomOffset = 0, style }: MiniPlayerProps) {
  const theme = useTheme();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const toggle = usePlayerStore((state) => state.toggle);
  const next = usePlayerStore((state) => state.next);

  if (!currentSong) {
    return null;
  }

  return (
    <Pressable
      onPress={() => router.push('/player')}
      accessibilityRole="button"
      accessibilityLabel={`Abrir reproductor: ${currentSong.title}, de ${currentSong.artist}`}
      accessibilityHint="Abre la pantalla completa del reproductor."
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement, bottom: bottomOffset },
        style,
      ]}>
      <MiniPlayerProgress />

      <View style={styles.content}>
        <Artwork uri={currentSong.artwork} size={44} />

        <View style={styles.info}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {currentSong.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {currentSong.artist}
          </ThemedText>
        </View>

        <Pressable hitSlop={8} onPress={toggle} style={styles.control} accessibilityRole="button" accessibilityLabel="Reproducir o pausar">
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color={theme.text} />
        </Pressable>

        <Pressable hitSlop={8} onPress={next} style={styles.control} accessibilityRole="button" accessibilityLabel="Siguiente">
          <Ionicons name="play-skip-forward" size={24} color={theme.text} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.sm,
    right: Spacing.sm,
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    height: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.lg,
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  control: {
    padding: Spacing.xs,
  },
});
