import * as ReactNative from 'react-native';

import { resolvePalette } from '@/constants/theme';
import type { ThemeMode } from '@/types/settings';
import type { MediaWidgetTheme } from '@/widgets/media-widget.contract';

/**
 * Traduce los tokens de `Colors` a la paleta plana que pinta el widget.
 *
 * LÓGICA: vive en su propio módulo por dos razones. El contrato del widget no
 * puede importar `constants/theme` (el componente se compila en un bundle
 * Hermes aislado, sin React Native ni CSS), y el servicio arrastra el módulo
 * nativo de `expo-widgets`, que no debe cargarse para probar la resolución del
 * tema. Aquí solo se mapean nombres; la fuente de verdad sigue siendo `Colors`.
 */
/** `Appearance` puede no existir en bundles aislados o en pruebas. */
function systemScheme(): 'light' | 'dark' {
  const appearance = (ReactNative as { Appearance?: { getColorScheme?: () => string | null } })
    .Appearance;
  return appearance?.getColorScheme?.() === 'light' ? 'light' : 'dark';
}

export function resolveWidgetTheme(mode: ThemeMode): MediaWidgetTheme {
  const palette = resolvePalette(mode, systemScheme());
  return {
    background: palette.background,
    surface: palette.backgroundElement,
    text: palette.text,
    textSecondary: palette.textSecondary,
    accent: palette.accent,
    accentText: palette.accentText,
    progressTrack: palette.backgroundSelected,
  };
}
