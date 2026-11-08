/**
 * Sistema de diseño central de la aplicación.
 *
 * LÓGICA: aquí se concentran los "tokens" de diseño (colores, tipografías,
 * espaciado, medidas) que el resto del proyecto importa. Así, si cambias
 * un color o un espacio, se aplica en toda la app sin tocar cada pantalla.
 *
 * Alternativas de estilos: Nativewind, Tamagui, Unistyles, etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Paleta de colores por modo del sistema.
 *
 * CÓDIGO:
 * - Cada tema expone las mismas claves (text, background, backgroundElement,
 *   backgroundSelected, textSecondary). Eso permite que `ThemeColor`
 *   sea un tipo seguro y que `ThemedView`/`ThemedText` resuelvan el color
 *   según el esquema activo sin fallar en ninguna clave.
 * - `backgroundElement`: superficie neutra (tarjetas, barras).
 * - `backgroundSelected`: superficie de realce (elemento activo/seleccionado).
 * - `as const` hace que los valores sean literales y el tipo `ThemeColor`
 *   se derive correctamente.
 */
export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    border: '#D7D7DE',
    accent: '#12B76A',
    accentText: '#04140A',
    danger: '#E5484D',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0B0B0F',
    backgroundElement: '#17171C',
    backgroundSelected: '#26262E',
    textSecondary: '#9BA1A6',
    border: '#26262E',
    accent: '#1ED760',
    accentText: '#04140A',
    danger: '#FF453A',
  },
} as const;

/**
 * Unión de claves que existen tanto en el modo claro como en el oscuro.
 * Se usa como tipo de prop (`type="backgroundElement"`, `themeColor="text"`, ...)
 * para garantizar que siempre haya un color disponible en ambos modos.
 */
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Familias tipográficas por plataforma.
 *
 * CÓDIGO:
 * - `Platform.select` devuelve un objeto distinto según la plataforma.
 * - En web se usan variables CSS definidas en `global.css`
 *   (`var(--font-display)`, etc.) que permiten fuentes personalizadas.
 * - En iOS se usan las familias del sistema (ui-rounded, ui-serif, ...).
 */
export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Escala de espaciado base (en píxeles).
 *
 * LÓGICA: usar estos tokens en lugar de números sueltos mantiene la
 * jerarquía visual consistente. p.ej. `Spacing.three` (16) se usa en
 * paddings y gaps; `Spacing.four` (24) en secciones con más aire.
 */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Radios de esquina reutilizables (píldoras, tarjetas, artwork).
 */
export const Radius = {
  small: 8,
  medium: 12,
  large: 20,
  pill: 999,
} as const;

/**
 * Altura que ocupa la barra de pestañas nativa de abajo.
 *
 * LÓGICA: el contenido de las pantallas le suma este valor a su padding
 * inferior para que la última tarjeta no quede oculta detrás del
 * tab bar nativo (iOS/Android).
 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/**
 * Espacio que reserva el contenido en la parte superior en web.
 *
 * LÓGICA: la barra de navegación de la versión web es una barra flotante
 * (position: absolute) anclada arriba. Para que no tape el título de la
 * pantalla, las pantallas usan este valor como paddingTop. En móvil la
 * navegación va abajo, así que el valor es 0.
 */
export const TopTabBarInset = 0;

/**
 * Ancho máximo del contenido en pantallas grandes (tablet/web),
 * así el contenido se centra y no se estira en monitores anchos.
 */
export const MaxContentWidth = 800;