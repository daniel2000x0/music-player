import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  /** Color a usar en modo claro (override manual, opcional). */
  lightColor?: string;
  /** Color a usar en modo oscuro (override manual, opcional). */
  darkColor?: string;
  /**
   * Clave de la paleta que aplicará de fondo.
   * Ej.: `'background'`, `'backgroundElement'`, `'backgroundSelected'`.
   */
  type?: ThemeColor;
};

/**
 * `<View>` vinculado al tema.
 *
 * LÓGICA: envuelve el `View` nativo y le asigna el color de fondo según
 * el tema activo. Si no pasas `type`, usa el fondo principal
 * (`'background'`). Es el contenedor base de casi toda la UI.
 *
 * CÓDIGO:
 * - `useTheme()` devuelve la paleta actual (clara/oscura).
 * - `theme[type ?? 'background']` resuelve el color por clave.
 * - Recibe `style` del consumidor, así conserva la API de React Native.
 */
export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}