import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { THEME_CATALOG } from '@/constants/theme-catalog';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeMode } from '@/types/settings';

export type ThemePickerProps = {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
};

/**
 * Selector visual de temas: píldoras con el icono del héroe y su etiqueta.
 *
 * LÓGICA: los dos primeros son los temas base (icono por defecto); el resto
 * son las seis carpetas de `themesIcons`. La paleta activa pinta borde y
 * etiqueta, así el propio selector ya anticipa el estilo que se aplicará.
 */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {THEME_CATALOG.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[
              styles.item,
              {
                backgroundColor: active ? theme.backgroundSelected : theme.background,
                borderColor: active ? theme.accent : theme.border,
              },
            ]}
            accessibilityRole="radio"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}>
            <View style={[styles.iconWrap, { backgroundColor: `${item.swatch}22` }]}>
              <Image source={item.icon} style={styles.icon} resizeMode="contain" />
            </View>
            <ThemedText
              type="small"
              numberOfLines={1}
              style={[styles.label, active ? { color: theme.accent } : undefined]}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  item: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
  },
  icon: {
    width: 34,
    height: 34,
  },
  label: {
    textAlign: 'center',
  },
});
