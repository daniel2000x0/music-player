import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { describeScanProgress } from '@/domain/library/scan-progress';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useLibraryStore } from '@/stores/library.store';

/**
 * Progreso del escaneo compartido por las pestañas de biblioteca.
 *
 * LÓGICA: la sincronización del arranque corre en segundo plano y no activa
 * `isScanning`; por eso la visibilidad depende de `scanProgress` y no del
 * spinner del botón. Así Canciones, Álbumes y Playlists comunican la misma
 * fase y el mismo conteo sin duplicar este bloque en cada pantalla (`UI-06`).
 */
export function ScanProgressBanner() {
  const theme = useTheme();
  const { language } = useTranslation();
  const scanProgress = useLibraryStore((state) => state.scanProgress);

  if (!scanProgress) {
    return null;
  }

  return (
    <View
      style={[styles.banner, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={theme.accent} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {describeScanProgress(scanProgress, language)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  text: {
    flex: 1,
  },
});
