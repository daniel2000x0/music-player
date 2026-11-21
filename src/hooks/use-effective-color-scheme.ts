import { resolveScheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Esquema (claro/oscuro) que realmente se está pintando.
 *
 * LÓGICA: los temas base fijan su esquema; los de superhéroe tienen variante
 * clara y oscura y siguen la preferencia del sistema. Un único hook evita que
 * StatusBar, navegación, paleta y web calculen cosas distintas.
 */
export function useEffectiveColorScheme(): 'light' | 'dark' {
  const mode = useSettingsStore((state) => state.theme);
  const systemScheme = useColorScheme() ?? 'dark';
  return resolveScheme(mode, systemScheme);
}
