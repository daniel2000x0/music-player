import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { AudioQualityBadge } from '@/components/audio-quality-badge';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { displayMetadata, formatDuration } from '@/utils/format';
import { useTranslation } from '@/hooks/use-translation';

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


  const { tr, t } = useTranslation();

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
      accessibilityRole="button"
      accessibilityLabel={
        selectionActive
          ? t(selected ? 'selectedSong' : 'unselectedSong', {
              title: song.title,
              artist: song.artist,
            })
          : t('playSong', { title: song.title, artist: song.artist })
      }
      accessibilityHint={
        selectionActive ? tr('Toca para seleccionar o deseleccionar.') : undefined
      }
      accessibilityState={selectionActive ? { selected } : undefined}
      style={({ pressed }) => [
        styles.row,
        isCurrent && !selectionActive && { backgroundColor: theme.backgroundElement },
        selected && selectionActive && { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}
    >
      {/* Indicador de canción actual: refuerza el estado sin depender solo del color del título. */}
      <View
        style={[
          styles.currentIndicator,
          { backgroundColor: isCurrent && !selectionActive ? theme.accent : 'transparent' },
        ]}
      />

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
          {displayMetadata(song.title)}
        </ThemedText>

        <ThemedText
          type="small"
          numberOfLines={1}
          themeColor="textSecondary"
        >
          {displayMetadata(song.artist)}
        </ThemedText>

        {/* Duración y formato en la misma fila; primero el tiempo, luego la píldora. */}
        <View style={styles.metaRow}>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.duration}
          >
            {formatDuration(song.duration)}
          </ThemedText>
          <AudioQualityBadge
            format={song.fileFormat}
            bitDepth={song.bitDepth}
            sampleRate={song.sampleRate}
            bitrate={song.bitrate}
            hasLyrics={song.hasLyrics}
          />
        </View>
      </View>

      {!selectionActive && showFavorite && onToggleFavorite ? (
        <Pressable
          hitSlop={10}
          onPress={handleToggleFavorite}
          style={styles.action}
          accessibilityRole="button"
          accessibilityState={{ selected: isFavorite }}
          accessibilityLabel={
            isFavorite
              ? tr('Quitar de favoritos')
              : tr('Agregar a favoritos')
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
          hitSlop={10}
          onPress={handleMore}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={tr('Más opciones')}
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.md,
    borderRadius: Radius.medium,
  },
  pressed: {
    opacity: 0.72,
  },
  currentIndicator: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: Radius.pill,
    marginVertical: 6,
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 20,
    marginTop: 2,
  },
  title: {
    flexShrink: 1,
  },
  duration: {
    minWidth: 36,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  action: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
