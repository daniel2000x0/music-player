import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { formatDuration } from '@/utils/format';

export type SongRowProps = {
  /** Cola de reproducción al pulsar la fila. */
  song: Song;
  queue?: Song[];
  isFavorite?: boolean;
  onToggleFavorite?: (song: Song) => void;
  /** Acción del botón más. */
  onMore?: (song: Song) => void;
  /** Muestra u oculta el botón de favorito. */
  showFavorite?: boolean;
  /** `true` mientras la pantalla está en modo selección (`FASE 5.2`). */
  selectionActive?: boolean;
  /** `true` si esta fila está seleccionada. */
  selected?: boolean;
  /** Pulsación larga: entra en el modo de selección. */
  onLongPress?: (song: Song) => void;
  /** Alterna la selección de la fila (en modo selección). */
  onToggleSelect?: (song: Song) => void;
};

/**
 * Fila de canción reutilizable.
 *
 * RENDIMIENTO:
 * - memo evita renderizados por cambios en el padre
 *   cuando las propiedades permanecen iguales.
 * - useCallback estabiliza los eventos.
 * - Zustand permite actualizar el resaltado de la canción actual.
 */
export const SongRow = memo(function SongRow({
  song,
  queue,
  isFavorite = false,
  onToggleFavorite,
  onMore,
  showFavorite = true,
  selectionActive = false,
  selected = false,
  onLongPress,
  onToggleSelect,
}: SongRowProps) {

  const theme = useTheme();

  // Suscripción al estado del reproductor.
  const play = usePlayerStore((state) => state.play);
  const currentId = usePlayerStore(
    (state) => state.currentSong?.id
  );

  const isCurrent = currentId === song.id;

  // Callbacks estables: evitan recrear funciones en cada render y así
  // conservan la memoización de `SongRow`.
  const handlePlay = useCallback(() => {
    play(song, queue);
  }, [play, song, queue]);

  // En modo selección, pulsar la fila alterna la selección en vez de
  // reproducir; la pulsación larga es la que entra en el modo.
  const handlePress = useCallback(() => {
    if (selectionActive) {
      onToggleSelect?.(song);
      return;
    }
    handlePlay();
  }, [selectionActive, onToggleSelect, song, handlePlay]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(song);
  }, [onLongPress, song]);

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite?.(song);
  }, [onToggleFavorite, song]);

  const handleMore = useCallback(() => {
    onMore?.(song);
  }, [onMore, song]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
      ]}
    >
      {selectionActive ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? theme.accent : theme.textSecondary}
        />
      ) : null}

      <Artwork uri={song.artwork} size={52} />

      <View style={styles.info}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          themeColor={isCurrent ? 'accent' : 'text'}
          style={styles.title}
        >
          {song.title}
        </ThemedText>

        <ThemedText
          type="small"
          numberOfLines={1}
          themeColor="textSecondary"
        >
          {song.artist}
        </ThemedText>
      </View>

      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.duration}
      >
        {formatDuration(song.duration)}
      </ThemedText>

      {!selectionActive && showFavorite && onToggleFavorite ? (
        <Pressable
          hitSlop={8}
          onPress={handleToggleFavorite}
          style={styles.action}
          accessibilityLabel={
            isFavorite
              ? 'Quitar de favoritos'
              : 'Agregar a favoritos'
          }
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={
              isFavorite
                ? theme.accent
                : theme.textSecondary
            }
          />
        </Pressable>
      ) : null}

      {!selectionActive && onMore ? (
        <Pressable
          hitSlop={8}
          onPress={handleMore}
          style={styles.action}
          accessibilityLabel="Más opciones"
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={theme.textSecondary}
          />
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
