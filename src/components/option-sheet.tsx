import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              {title}
            </ThemedText>
            <Pressable hitSlop={8} onPress={onClose} accessibilityLabel="Cerrar">
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
                  style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
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
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  headerTitle: {
    fontSize: 16,
  },
  list: {
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  itemText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
