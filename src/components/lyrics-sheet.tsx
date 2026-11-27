import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Scrim, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import type { Song } from '@/types/song';

export type LyricsSheetProps = {
  visible: boolean;
  /** Canción cuyas letras se muestran. */
  song: Song | null;
  onClose: () => void;
};

/**
 * Hoja modal con la letra incrustada en el archivo.
 *
 * LÓGICA: el texto se leyó durante el escaneo y vive en SQLite, así que abrir
 * la hoja no vuelve a tocar el archivo (importante en `content://` de Android).
 * `ThemedText` respeta claro/oscuro y `selectable` permite copiar la letra.
 */
export function LyricsSheet({ visible, song, onClose }: LyricsSheetProps) {
  const theme = useTheme();
  const { tr } = useTranslation();
  const lyrics = song?.lyrics ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="smallBold" style={styles.headerTitle}>
                {tr('Letras')}
              </ThemedText>
              {song ? (
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {song.title}
                </ThemedText>
              ) : null}
            </View>
            <Pressable hitSlop={8} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('Cerrar')}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {lyrics ? (
              <ThemedText style={styles.lyrics} selectable>
                {lyrics}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {tr('Esta canción no tiene letras incrustadas.')}
              </ThemedText>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Scrim,
  },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingVertical: Spacing.sm,
  },
  lyrics: {
    fontSize: 16,
    lineHeight: 24,
  },
});
