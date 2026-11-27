import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { OptionSheet, type Option } from '@/components/option-sheet';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useViewMode } from '@/hooks/use-view-mode';
import type { LiteralKey } from '@/i18n';
import type { ViewMode, ViewModeTab } from '@/types/view-mode';

const MODE_ICONS: Record<ViewMode, keyof typeof Ionicons.glyphMap> = {
  list: 'list-outline',
  compact: 'grid-outline',
  smallIcons: 'apps-outline',
};

/** La etiqueta es una clave del catálogo: cambia con el idioma de la app. */
const MODE_LABELS: Record<ViewMode, LiteralKey> = {
  list: 'Lista',
  compact: 'Compacto',
  smallIcons: 'Iconos pequeños',
};

/** La descripción indica el número de columnas para que no haya dudas. */
const MODE_DESCRIPTIONS: Record<ViewMode, LiteralKey> = {
  list: 'Una fila por elemento',
  compact: '4 columnas',
  smallIcons: '3 columnas',
};

const MODE_ORDER: readonly ViewMode[] = ['list', 'compact', 'smallIcons'];

/**
 * Selector de estilo de visualización. Se coloca en la barra de herramientas
 * de cada pestaña, al mismo nivel que el filtro y el orden.
 *
 * LÓGICA: usa la hoja `OptionSheet` en vez de un control segmentado para que
 * las cinco opciones quepan a 320 dp. Cada opción lleva su número de columnas
 * como descripción y el botón muestra el icono del modo activo.
 */
export function ViewModePicker({ tab }: { tab: ViewModeTab }) {
  const theme = useTheme();
  const { tr } = useTranslation();
  const { mode, setMode } = useViewMode(tab);
  const [visible, setVisible] = useState(false);

  // Se construyen en render porque las etiquetas dependen del idioma actual.
  const options: readonly Option<ViewMode>[] = MODE_ORDER.map((value) => ({
    value,
    label: tr(MODE_LABELS[value]),
    description: tr(MODE_DESCRIPTIONS[value]),
  }));

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={[styles.button, { backgroundColor: theme.backgroundElement }]}
        accessibilityRole="button"
        accessibilityLabel={tr('Estilo de visualización')}
        accessibilityHint={tr('Abre las opciones Lista, Compacto e Iconos pequeños')}>
        <Ionicons name={MODE_ICONS[mode]} size={16} color={theme.text} />
        <ThemedText type="small" numberOfLines={1} style={styles.label}>
          {tr(MODE_LABELS[mode])}
        </ThemedText>
        <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
      </Pressable>

      <OptionSheet
        visible={visible}
        title={tr('Estilo de visualización')}
        options={options}
        value={mode}
        onSelect={setMode}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  label: {
    flexShrink: 1,
  },
});
