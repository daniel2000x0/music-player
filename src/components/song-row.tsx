import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { formatDuration } from '@/utils/format';

export type SongRowProps = {
  song: Song;
  /** Cola de reproducción al pulsar la fila. */
  queue?: Song[];
  isFavorite?: boolean;
  onToggleFavorite?: (song: Song) => void;
  /** Acción del botón "más" (agregar a playlist, etc.). */
  onMore?: (song: Song) => void;
  /** Muestra u oculta el botón de favorito. */
  showFavorite?: boolean;
};

/**
 * Fila de canción reutilizable. Resalta la pista actual y reproduce dentro
 * de la cola indicada.
 *
 * RENDIMIENTO: `memo` evita re-renderizar todas las filas cuando cambia
 * algo ajeno a ellas (favoritos, búsqueda) — solo re-renderizan las filas
 * cuyas props cambiaron, siempre que los callbacks del padre sean estables.
 */
export const SongRow = memo(function SongRow({
  song,
  queue,
  isFavorite = false,
  onToggleFavorite,
  onMore,
  showFavorite = true,
}: SongRowProps) {
  const theme = useTheme();
  const play = usePlayerStore((state) => state.play);
  const currentId = usePlayerStore((state) => state.currentSong?.id);
  const isCurrent = currentId === song.id;

  return (
    <Pressable
      onPress={() => play(song, queue)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Artwork uri={song.artwork} size={52} />

      <View style={styles.info}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          themeColor={isCurrent ? 'accent' : 'text'}
          style={styles.title}>
          {song.title}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
          {song.artist}
        </ThemedText>
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.duration}>
        {formatDuration(song.duration)}
      </ThemedText>

      {showFavorite && onToggleFavorite ? (
        <Pressable
          hitSlop={8}
          onPress={() => onToggleFavorite(song)}
          style={styles.action}
          accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? theme.accent : theme.textSecondary}
          />
        </Pressable>
      ) : null}

      {onMore ? (
        <Pressable
          hitSlop={8}
          onPress={() => onMore(song)}
          style={styles.action}
          accessibilityLabel="Más opciones">
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

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
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    flexShrink: 1,
  },
  duration: {
    minWidth: 40,
    textAlign: 'right',
  },
  action: {
    padding: Spacing.one,
  },
});
