import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import type { Album } from '@/types/song';
import { displayMetadata, formatSongCount } from '@/utils/format';

export type AlbumCardProps = {
  album: Album;
  /** Ancho calculado por el grid contenedor. */
  width: number;
  onPress: () => void;
};

/**
 * Tarjeta de álbum para grids.
 *
 * LÓGICA: representa un álbum agrupado (ver `LibraryProvider`). Al pulsarla
 * se reproduce el álbum completo (la cola son todas sus canciones).
 */
export function AlbumCard({ album, width, onPress }: AlbumCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('playAlbum', { title: displayMetadata(album.title) })}>
      <View>
        <Artwork uri={album.artwork} size={width} radius={Radius.medium} />
        <View style={[styles.playBadge, { backgroundColor: theme.accent }]}>
          <Ionicons name="play" size={18} color={theme.accentText} />
        </View>
      </View>

      <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
        {displayMetadata(album.title)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.meta}>
        {displayMetadata(album.artist)} · {formatSongCount(album.songCount)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82,
  },
  playBadge: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Ajuste óptico: el triángulo de "play" se ve mejor un poco a la derecha.
    paddingLeft: 2,
  },
  title: {
    marginTop: Spacing.sm,
  },
  meta: {
    marginTop: 2,
  },
});
