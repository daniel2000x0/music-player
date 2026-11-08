import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Album } from '@/types/song';
import { formatSongCount } from '@/utils/format';

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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
      accessibilityLabel={`Reproducir álbum ${album.title}`}>
      <View>
        <Artwork uri={album.artwork} size={width} radius={Radius.medium} />
        <View style={[styles.playBadge, { backgroundColor: theme.accent }]}>
          <Ionicons name="play" size={18} color={theme.accentText} />
        </View>
      </View>

      <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
        {album.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {album.artist} · {formatSongCount(album.songCount)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  playBadge: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Ajuste óptico: el triángulo de "play" se ve mejor un poco a la derecha.
    paddingLeft: 2,
  },
  title: {
    marginTop: Spacing.two,
  },
});
