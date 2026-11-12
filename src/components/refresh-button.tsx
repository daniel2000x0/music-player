import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';

/**
 * Botón de actualizar biblioteca.
 *
 * LÓGICA: dispara un re-escaneo de la mediateca (`refresh`) y muestra un
 * spinner mientras dura, para que el usuario sepa que el trabajo está en
 * curso. Se deshabilita durante el escaneo para no encolar peticiones.
 */
export function RefreshButton() {
  const theme = useTheme();
  const isScanning = useLibraryStore((state) => state.isScanning);
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
        <ActivityIndicator color={theme.accent} />
      ) : (
        <Ionicons name="refresh" size={22} color={theme.text} />
      )}
    </Pressable>
  );
}
