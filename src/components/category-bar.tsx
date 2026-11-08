import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CategoryOption<T extends string> = {
  key: T;
  label: string;
};

export type CategoryBarProps<T extends string> = {
  options: readonly CategoryOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Barra de categorías (segmented control de píldoras).
 *
 * LÓGICA: controla qué se muestra en la pantalla de inicio
 * (Álbumes / Canciones / Playlists) resaltando la opción activa.
 */
export function CategoryBar<T extends string>({ options, value, onChange }: CategoryBarProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.pill,
              { backgroundColor: active ? theme.accent : theme.backgroundElement },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <ThemedText
              type="smallBold"
              style={{ color: active ? theme.accentText : theme.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
});
