import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayMetadata } from '@/utils/format';

export type MediaTileProps = {
  /** Ancho de la columna, calculado por la rejilla contenedora. */
  width: number;
  /** `block` = tarjeta grande; `icon` = miniatura compacta. */
  variant: 'block' | 'icon';
  artworkUri?: string | null;
  /** Icono del placeholder cuando no hay portada (playlist, canción…). */
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress?: () => void;
  selectionActive?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

/**
 * Celda reutilizable para la cuadrícula de "Iconos pequeños" y tarjetas.
 *
 * LÓGICA: la portada mantiene `aspectRatio: 1` y el ancho lo decide la
 * rejilla (`numColumns`). `icon` prioriza más columnas con buena legibilidad;
 * `block` queda disponible para tarjetas anchas donde aún se usa.
 */
export const MediaTile = memo(function MediaTile({
  width,
  variant,
  artworkUri,
  fallbackIcon = 'musical-notes',
  title,
  subtitle,
  accessibilityLabel,
  onPress,
  onLongPress,
  selectionActive = false,
  selected = false,
  onToggleSelect,
}: MediaTileProps) {
  const theme = useTheme();
  const isBlock = variant === 'block';
  const padding = isBlock ? Spacing.md : 0;
  const artworkSize = Math.max(40, width - padding * 2);

  return (
    <Pressable
      onPress={() => (selectionActive ? onToggleSelect?.() : onPress())}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={displayMetadata(accessibilityLabel ?? title)}
      accessibilityState={selectionActive ? { selected } : undefined}
      style={({ pressed }) => [
        styles.tile,
        { width, padding },
        pressed && styles.pressed,
        selected && { backgroundColor: theme.backgroundSelected },
      ]}>
      <View>
        {/* Artwork no acepta un icono de fallback configurable; para
            playlists se dibuja el icono encima del placeholder neutro. */}
        <Artwork uri={artworkUri} size={artworkSize} />
        {!artworkUri && fallbackIcon !== 'musical-notes' ? (
          <View style={styles.fallbackOverlay} pointerEvents="none">
            <Ionicons name={fallbackIcon} size={artworkSize * 0.38} color={theme.text} />
          </View>
        ) : null}
        {selectionActive ? (
          <View style={styles.check}>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={selected ? theme.accent : theme.backgroundElement}
            />
          </View>
        ) : null}
      </View>

      <ThemedText
        type={isBlock ? 'smallBold' : 'small'}
        numberOfLines={isBlock ? 2 : 1}
        style={styles.title}>
        {displayMetadata(title)}
      </ThemedText>
      {isBlock && subtitle ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {displayMetadata(subtitle)}
        </ThemedText>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: {
    alignItems: 'flex-start',
    borderRadius: Radius.medium,
    gap: Spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    alignSelf: 'stretch',
  },
  check: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
  },
  fallbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
