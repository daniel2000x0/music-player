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
    link: '#1B6FD1',

    // Indicador de desplazamiento
    scrollbarIndicator: 'black',
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
    link: '#6BA6FF',

    // Indicador de desplazamiento
    scrollbarIndicator: 'white',
  },
} as const;

/**
 * Unión de claves que existen tanto en el modo claro como en el oscuro.
 * Se usa como tipo de prop (`type="backgroundElement"`, `themeColor="text"`, ...)
 * para garantizar que siempre haya un color disponible en ambos modos.
 */
export type ThemeColor = Exclude<
  keyof typeof Colors.light & keyof typeof Colors.dark,
  'scrollbarIndicator'
>;

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
 * jerarquía visual consistente. La escala es completa y de paso 4:
 * `xs` (4) para separaciones mínimas, `sm` (8) para gaps entre elementos,
 * `md` (12) para rellenos intermedios, `lg` (16) para paddings de tarjeta,
 * `xl` (24) y `xxl` (32) para secciones con más aire.
 *
 * `FASE 6`: se sustituyeron los nombres posicionales (`one`, `two`, …) por
 * nombres semánticos y se añadió el paso de 12 (`md`) que antes faltaba.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Área táctil mínima recomendada por las guías de accesibilidad (44 pt/dp).
 * Se aplica con `hitSlop` o `minHeight`/`minWidth` en botones pequeños.
 */
export const MinTouchTarget = 44;

/**
 * Tamaños de icono reutilizables, alineados con la escala de espaciado.
 * Evitan números sueltos en `size={…}` de `Ionicons`.
 */
export const IconSize = {
  sm: 18,
  md: 22,
  lg: 26,
  xl: 32,
} as const;

/**
 * Velo (scrim) que oscurece el fondo tras un modal o una hoja inferior.
 * Es el mismo en ambos temas, así que vive fuera de la paleta.
 */
export const Scrim = 'rgba(0,0,0,0.5)';

/** Color de la sombra proyectada (banners, tarjetas elevadas). */
export const Shadow = '#000';

/**
 * Color de un icono o texto pintado **sobre** el color `danger`.
 * Es blanco en ambos temas porque `danger` es un rojo saturado.
 */
export const OnDanger = '#FFFFFF';

/**
 * Ancho reservado en el borde derecho de las listas para el indicador
 * vertical de scroll.
 *
 * LÓGICA: la barra nativa se dibuja sobre el contenido y en Android queda
 * siempre visible (`persistentScrollbar`), así que este margen evita que tape
 * botones o tarjetas.
 */
export const ScrollbarGutter = 12;

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
 * Altura base de la barra de pestañas, sin el área segura inferior.
 *
 * LÓGICA: la barra que renderiza `expo-router` (variante "uikit") mide
 * 49 px más el inset inferior del dispositivo. El mini-reproductor necesita
 * ese valor exacto para apoyarse justo encima de la barra: una altura fija
 * por plataforma (`BottomTabInset`) dejaba un hueco visible en Android y en
 * pantallas sin área segura.
 */
export const TabBarBaseHeight = 49;

/**
 * Espacio extra que reserva el contenido bajo la barra de pestañas para que
 * el mini-reproductor flotante no tape la última fila de una lista.
 *
 * LÓGICA: el mini-reproductor mide ~64 px y se apoya sobre la barra; 110 px
 * cubren su alto más un margen de seguridad. Antes era un literal `+ 110`
 * repetido en cinco pantallas.
 */
export const MiniPlayerInset = 110;

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