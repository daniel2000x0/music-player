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
 * y el enlace de acción a la derecha. El título puede encogerse con
 * elipsis (`flexShrink`) mientras la acción permanece visible
 * (`flexShrink: 0`): así "Ver todo" no se sale del borde en pantallas
 * estrechas ni con títulos largos como "Reproducidas recientemente".
 */
export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="default" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
      {actionLabel && onActionPress ? (
        <Pressable
          hitSlop={8}
          onPress={onActionPress}
          accessibilityRole="button"
          style={styles.action}>
          <ThemedText type="smallBold" themeColor="accent" numberOfLines={1}>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  action: {
    flexShrink: 0,
    minHeight: 44,
    justifyContent: 'center',
  },
  spacer: {
    height: 1,
  },
});
