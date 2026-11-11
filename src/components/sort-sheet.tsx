import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { sortDirectionOf, sortFieldOf, toggleSortDirection } from '@/domain/library/sorting';
import { useTheme } from '@/hooks/use-theme';

export type SortField<K extends string> = {
  value: K;
  label: string;
};

export type SortSheetProps<K extends string> = {
  visible: boolean;
  title: string;
  fields: readonly SortField<K>[];
  value: K;
  onSelect: (value: K) => void;
  onClose: () => void;
};

/** Hoja modal de orden: un ítem por campo, con flecha de sentido en el activo. */
export function SortSheet<K extends string>({
  visible,
  title,
  fields,
  value,
  onSelect,
  onClose,
}: SortSheetProps<K>) {
  const theme = useTheme();
  const activeField = sortFieldOf(value);

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
            {fields.map((field) => {
              const selected = sortFieldOf(field.value) === activeField;
              const direction = selected ? sortDirectionOf(value) : sortDirectionOf(field.value);
              return (
                <Pressable
                  key={field.value}
                  onPress={() => {
                    if (selected) {
                      onSelect(toggleSortDirection(value));
                    } else {
                      onSelect(field.value);
                      onClose();
                    }
                  }}
                  style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                  accessibilityLabel={`${field.label}, ${direction === 'asc' ? 'ascendente' : 'descendente'}`}
                  accessibilityHint={selected ? 'Toca de nuevo para alternar el sentido.' : undefined}>
                  <View style={styles.itemText}>
                    <ThemedText
                      type="smallBold"
                      style={selected ? { color: theme.accent } : undefined}>
                      {field.label}
                    </ThemedText>
                  </View>
                  {selected ? (
                    <Ionicons
                      name={direction === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={20}
                      color={theme.accent}
                    />
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
