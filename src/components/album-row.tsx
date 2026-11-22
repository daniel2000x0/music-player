import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Artwork } from '@/components/artwork';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import type { Album } from '@/types/song';

/** Fila compacta de álbum, usada por el estilo "Lista" de la pestaña Álbumes. */
export const AlbumRow = memo(function AlbumRow({
  album,
  onPress,
}: {
  album: Album;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={album.title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Artwork uri={album.artwork} size={52} />
      <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
        {album.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.artist}>
        {album.artist} · {t('songsCount', { count: album.songCount })}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.chevron}>›</ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.lg,
  },
  pressed: { opacity: 0.6 },
  title: { flex: 1, minWidth: 0 },
  artist: { flex: 1, minWidth: 0, textAlign: 'right' },
  chevron: { fontSize: 20 },
});
