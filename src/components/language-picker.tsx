import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { OptionSheet, type Option } from '@/components/option-sheet';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { AppLanguage } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Selector de idioma global (ES/EN) para la pantalla de Ajustes.
 *
 * LÓGICA: el cambio es optimista y se persiste en SQLite a través del store.
 * Como `useTranslation` solo depende de `state.language`, TODA la app se
 * redibuja con el nuevo idioma al instante, sin reinicio ni OTA.
 */
export function LanguagePicker() {
  const theme = useTheme();
  const { tr } = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const [visible, setVisible] = useState(false);

  // Etiquetas en el idioma activo: "Español/Inglés" o "Spanish/English".
  const languages: readonly Option<AppLanguage>[] = [
    { value: 'es', label: tr('Español') },
    { value: 'en', label: tr('Inglés') },
  ];

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={tr('Idioma')}
        accessibilityHint={tr('Cambia el idioma de toda la aplicación')}>
        <Ionicons name="language-outline" size={22} color={theme.textSecondary} />

        <ThemedText type="smallBold" style={styles.label}>
          {tr('Idioma')}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {languages.find((item) => item.value === language)?.label}
        </ThemedText>

        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>

      <OptionSheet
        visible={visible}
        title={tr('Idioma')}
        options={languages}
        value={language}
        onSelect={(value) => void setLanguage(value)}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.medium,
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
