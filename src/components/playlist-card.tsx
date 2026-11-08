import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Playlist } from '@/types/playlist';
import { formatSongCount } from '@/utils/format';

export type PlaylistCardProps = {
  playlist: Playlist;
  /** Número de canciones resueltas. */
  songCount: number;
  onPress: () => void;
  onMore?: () => void;
};

/**
 * Tarjeta de playlist en formato fila.
 *
 * LÓGICA: muestra una playlist del usuario con su contador de canciones.
 * Al pulsarla se reproduce; el botón "más" permite administrarla.
 */
export function PlaylistCard({ playlist, songCount, onPress, onMore }: PlaylistCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.thumb, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name="list" size={24} color={theme.accent} />
      </View>

      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {playlist.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatSongCount(songCount)}
        </ThemedText>
      </View>

      {onMore ? (
        <Pressable hitSlop={8} onPress={onMore} style={styles.action} accessibilityLabel="Opciones">
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  action: {
    padding: Spacing.one,
  },
});
