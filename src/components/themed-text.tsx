import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  /**
   * Variante tipográfica. Cambia tamaño, grosor y familia.
   * Ej.: 'title' (grande) | 'subtitle' (título de sección) | 'default' | ...
   */
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  /** Clave de color del tema aplicada al texto (default: 'text'). */
  themeColor?: ThemeColor;
};

/**
 * `<Text>` vinculado al tema.
 *
 * LÓGICA: un único componente para todo el texto de la app, que combina:
 * 1. El color según el tema (y clave `themeColor`).
 * 2. La variante de tipografía (`type`).
 * Esto mantiene coherencia visual y evita repetir estilos por pantalla.
 *
 * CÓDIGO:
 * - Se aplica primero el color, luego la variante y al final cualquier
 *   `style` extra del consumidor (los estilos posteriores ganan).
 * - Es un componente puro: no tiene estado, sólo propaga props de `Text`
 *   (onPress, numberOfLines, ...).
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});