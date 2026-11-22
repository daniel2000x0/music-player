import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Scrim, Spacing } from '@/constants/theme';
import { sortDirectionOf, sortFieldOf, toggleSortDirection } from '@/domain/library/sorting';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

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

  const { tr, t } = useTranslation();
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
            <Pressable hitSlop={8} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('Cerrar')}>
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
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t('sortAccessibility', {
                    field: field.label,
                    direction: direction === 'asc' ? tr('ascendente') : tr('descendente'),
                  })}
                  accessibilityHint={
                    selected ? tr('Toca de nuevo para alternar el sentido.') : undefined
                  }>
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
  list: {
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
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
