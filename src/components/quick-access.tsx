import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AccentKey = 'accent' | 'textSecondary';

export type QuickAccessItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Número mostrado bajo el título (p. ej. canciones). */
  count: number;
  onPress: () => void;
  accent?: AccentKey;
};

export type QuickAccessProps = {
  items: QuickAccessItem[];
};

/**
 * Accesos rápidos (Favoritos / Más escuchadas / Recientes).
 *
 * LÓGICA: tres tarjetas de un toque que llevan a la lista filtrada
 * correspondiente en la pantalla de biblioteca.
 */
export function QuickAccess({ items }: QuickAccessProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {items.map((item) => {
        const accentColor =
          item.accent === 'textSecondary' ? theme.textSecondary : theme.accent;
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.backgroundSelected }]}>
              <Ionicons name={item.icon} size={20} color={accentColor} />
            </View>
            <ThemedText type="smallBold" numberOfLines={1}>
              {item.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.count}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  card: {
    flex: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
