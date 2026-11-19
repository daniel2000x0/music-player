import { DarkTheme, DefaultTheme } from 'expo-router';
import { useMemo } from 'react';

import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Tema de navegación (expo-router / react-navigation) derivado de los tokens
 * del sistema de diseño y del tema activo.
 *
 * LÓGICA (`B-06`): antes este mapeo vivía duplicado dentro del layout raíz.
 * Ahora es un único punto de verdad: la app elige el tema manualmente y aquí
 * se traduce a las claves que espera la navegación, de modo que las pantallas,
 * las tarjetas y los bordes usan siempre la misma paleta que el resto de la UI.
 */
export function useNavigationTheme() {
  const theme = useSettingsStore((state) => state.theme);

  return useMemo(() => {
    const base = theme === 'dark' ? DarkTheme : DefaultTheme;
    const palette = Colors[theme];
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.accent,
        background: palette.background,
        card: palette.backgroundElement,
        text: palette.text,
        border: palette.border,
        notification: palette.danger,
      },
    };
  }, [theme]);
}
