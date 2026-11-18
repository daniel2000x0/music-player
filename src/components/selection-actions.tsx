import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectionActionsProps = {
  /** Cantidad de pistas seleccionadas. */
  count: number;
  /** Selecciona todas las pistas visibles. */
  onSelectAll: () => void;
  /** Elimina las pistas seleccionadas (abre el diálogo de eliminación). */
  onDelete: () => void;
  /** Sale del modo de selección. */
  onClose: () => void;
};

/**
 * Barra de acciones del modo de selección múltiple (`FASE 5.2`).
 *
 * LÓGICA: sustituye la acción de cabecera de la pantalla mientras hay pistas
 * seleccionadas; muestra el conteo, permite seleccionar todo y eliminar, y
 * ofrece salir del modo.
 */
export function SelectionActions({
  count,
  onSelectAll,
  onDelete,
  onClose,
}: SelectionActionsProps) {
  const theme = useTheme();

  return (
    <View style={styles.bar}>
      <Pressable
        hitSlop={8}
        onPress={onClose}
        style={styles.icon}
        accessibilityLabel="Salir de la selección">
        <Ionicons name="close" size={22} color={theme.text} />
      </Pressable>

      <ThemedText type="smallBold" style={styles.count}>
        {count}
      </ThemedText>

      <Pressable
        hitSlop={8}
        onPress={onSelectAll}
        style={styles.icon}
        accessibilityLabel="Seleccionar todo">
        <Ionicons name="checkmark-done-outline" size={22} color={theme.text} />
      </Pressable>

      <Pressable
        hitSlop={8}
        onPress={onDelete}
        style={styles.icon}
        accessibilityLabel="Eliminar selección">
        <Ionicons name="trash-outline" size={21} color={theme.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  count: {
    minWidth: 18,
    textAlign: 'center',
  },
  icon: {
    padding: Spacing.one,
  },
});
