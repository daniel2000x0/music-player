import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { describeScanPercent } from '@/domain/library/scan-progress';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { useTranslation } from '@/hooks/use-translation';

/** Icono de 22 px + `hitSlop` a cada lado = área táctil de 44 dp. */
const ICON_SIZE = 22;
const ICON_HIT_SLOP = (MinTouchTarget - ICON_SIZE) / 2;

/**
 * Botón de actualizar biblioteca.
 *
 * LÓGICA: dispara un re-escaneo de la mediateca (`refresh`) y muestra el
 * porcentaje real del pipeline mientras dura (`UI-06`), en lugar de un
 * spinner indeterminado. Se deshabilita durante el escaneo para no encolar
 * peticiones.
 */
export function RefreshButton() {
  const theme = useTheme();

  const { tr } = useTranslation();
  const isScanning = useLibraryStore((state) => state.isScanning);
  const scanProgress = useLibraryStore((state) => state.scanProgress);
  const refresh = useLibraryStore((state) => state.refresh);

  return (
    <Pressable
      hitSlop={ICON_HIT_SLOP}
      disabled={isScanning}
      onPress={() => void refresh()}
      accessibilityRole="button"
      accessibilityLabel={tr('Actualizar biblioteca')}
      accessibilityState={{ busy: isScanning }}>
      {isScanning ? (
        <View style={styles.progress}>
          <ActivityIndicator size="small" color={theme.accent} />
          <ThemedText type="small" themeColor="textSecondary">
            {describeScanPercent(scanProgress)}
          </ThemedText>
        </View>
      ) : (
        <Ionicons name="refresh" size={ICON_SIZE} color={theme.text} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
