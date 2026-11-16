import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { describeScanPercent } from '@/domain/library/scan-progress';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';

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
  const isScanning = useLibraryStore((state) => state.isScanning);
  const scanProgress = useLibraryStore((state) => state.scanProgress);
  const refresh = useLibraryStore((state) => state.refresh);

  return (
    <Pressable
      hitSlop={8}
      disabled={isScanning}
      onPress={() => void refresh()}
      accessibilityRole="button"
      accessibilityLabel="Actualizar biblioteca"
      accessibilityState={{ busy: isScanning }}>
      {isScanning ? (
        <View style={styles.progress}>
          <ActivityIndicator size="small" color={theme.accent} />
          <ThemedText type="small" themeColor="textSecondary">
            {describeScanPercent(scanProgress)}
          </ThemedText>
        </View>
      ) : (
        <Ionicons name="refresh" size={22} color={theme.text} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
