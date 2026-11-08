import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Devuelve la paleta de colores del tema activo.
 * El tema se hidrata desde SQLite y se cambia desde Configuración.
 */
export function useTheme() {
  const theme = useSettingsStore((state) => state.theme);
  return Colors[theme];
}
