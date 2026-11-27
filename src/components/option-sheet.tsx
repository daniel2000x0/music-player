import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Scrim, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

export type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
  destructive?: boolean;
};

export type OptionSheetProps<T extends string> = {
  visible: boolean;
  title: string;
  options: readonly Option<T>[];
  value?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

/** Hoja modal reutilizable para ordenar, filtrar o ejecutar acciones. */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: OptionSheetProps<T>) {
  const theme = useTheme();

  const { tr } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <View style={styles.container}>
        {/* Fondo y hoja son hermanos: tocar una opción no propaga el gesto al
            cierre, sin depender del orden de responder de React Native. */}
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('Cerrar')}
        />
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          accessibilityViewIsModal>
          <View style={styles.header}>
            <ThemedText type="smallBold" accessibilityRole="header" style={styles.headerTitle}>
              {title}
            </ThemedText>
            <Pressable
              hitSlop={11}
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={tr('Cerrar')}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={
                    option.description
                      ? `${option.label}, ${option.description}`
                      : option.label
                  }>
                  <View style={styles.itemText}>
                    <ThemedText
                      type="smallBold"
                      style={option.destructive ? { color: theme.danger } : undefined}>
                      {option.label}
                    </ThemedText>
                    {option.description ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {option.description}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark" size={20} color={theme.accent} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
  },
  closeButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  itemText: {
    flex: 1,
    gap: Spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
});
