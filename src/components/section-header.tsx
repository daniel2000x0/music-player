import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SectionHeaderProps = {
  title: string;
  /** Texto de la acción a la derecha (ej. "Ver todo"). */
  actionLabel?: string;
  onActionPress?: () => void;
};

/**
 * Encabezado de sección con acción opcional.
 *
 * LÓGICA: unifica los títulos de bloque ("Álbumes", "Tus playlists", ...)
 * y el enlace de acción a la derecha.
 */
export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      {actionLabel && onActionPress ? (
        <Pressable hitSlop={8} onPress={onActionPress}>
          <ThemedText type="smallBold" themeColor="accent">
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : (
        <View style={[styles.spacer, { backgroundColor: theme.border }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  spacer: {
    height: 1,
  },
});
