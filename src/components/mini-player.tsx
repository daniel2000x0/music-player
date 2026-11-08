import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Artwork } from '@/components/artwork';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayerStore } from '@/stores/player.store';

export type MiniPlayerProps = {
  /** Separación inferior (para no chocar con el tab bar). */
  bottomOffset?: number;
  style?: ViewStyle;
};

/**
 * Mini-reproductor flotante. Tocar el cuerpo abre `/player`.
 */
export function MiniPlayer({ bottomOffset = 0, style }: MiniPlayerProps) {
  const theme = useTheme();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const position = usePlayerStore((state) => state.position);
  const duration = usePlayerStore((state) => state.duration);
  const toggle = usePlayerStore((state) => state.toggle);
  const next = usePlayerStore((state) => state.next);

  if (!currentSong) {
    return null;
  }

  const progress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;

  return (
    <Pressable
      onPress={() => router.push('/player')}
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement, bottom: bottomOffset + Spacing.two },
        style,
      ]}>
      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${progress * 100}%` }]} />
      </View>

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

        <Pressable hitSlop={8} onPress={toggle} style={styles.control} accessibilityLabel="Reproducir o pausar">
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color={theme.text} />
        </Pressable>

        <Pressable hitSlop={8} onPress={next} style={styles.control} accessibilityLabel="Siguiente">
          <Ionicons name="play-skip-forward" size={24} color={theme.text} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
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
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: Spacing.three,
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  control: {
    padding: Spacing.one,
  },
});
