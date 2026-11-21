import { resolvePalette } from '@/constants/theme';
import { useEffectiveColorScheme } from '@/hooks/use-effective-color-scheme';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Devuelve la paleta del tema activo (base o de superhéroe).
 * El tema se hidrata desde SQLite y se cambia desde Configuración.
 */
export function useTheme() {
  const theme = useSettingsStore((state) => state.theme);
  const scheme = useEffectiveColorScheme();
  return resolvePalette(theme, scheme);
}
