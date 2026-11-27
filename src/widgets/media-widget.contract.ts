/**
 * Contrato compartido entre la app y el widget de pantalla de inicio.
 *
 * LÓGICA: este módulo no importa `expo-widgets`, `@expo/ui` ni el sistema de
 * diseño (`constants/theme`): `media-widget.tsx` se compila en un bundle
 * Hermes aislado, sin React Native ni CSS. La app puede así importar el
 * nombre, los destinos y el tipo de props sin arrancar el runtime del widget;
 * el widget los importa en tiempo de compilación para su layout.
 */

/** Nombre interno; debe coincidir con `expo.plugins > expo-widgets > widgets`. */
export const MEDIA_WIDGET_NAME = 'MediaWidget';

/**
 * Destinos de los botones. Deben coincidir literalmente con los `target`
 * declarados dentro de la función `'widget'` (el runtime aislado no puede
 * referenciar este objeto).
 */
export const MEDIA_WIDGET_TARGETS = {
  previous: 'previous',
  toggle: 'toggle',
  next: 'next',
} as const;

export type MediaWidgetTarget =
  (typeof MEDIA_WIDGET_TARGETS)[keyof typeof MEDIA_WIDGET_TARGETS];

/**
 * Paleta que pinta el widget, ya resuelta desde `Colors` al publicar.
 *
 * LÓGICA: el runtime del widget no puede importar `constants/theme` (ver
 * cabecera), así que la app traduce los tokens a estos nombres planos. Los
 * valores por defecto de `MEDIA_WIDGET_INITIAL_PROPS` replican la paleta
 * oscura; una prueba de contrato compara ambos orígenes para que no diverjan.
 */
export type MediaWidgetTheme = {
  /** Fondo del contenedor. */
  background: string;
  /** Superficie secundaria (hueco de portada y botones laterales). */
  surface: string;
  /** Texto principal. */
  text: string;
  /** Texto secundario (artista y tiempos). */
  textSecondary: string;
  /** Acento (botón central y barra de progreso). */
  accent: string;
  /** Texto sobre el acento. */
  accentText: string;
  /** Carril de la barra de progreso. */
  progressTrack: string;
};

/** Props que la app publica con `updateSnapshot`. */
export type MediaWidgetProps = {
  title: string;
  artist: string;
  /** URI `file://` de la portada dentro de `widgetsDirectory`. */
  artwork: string | null;
  isPlaying: boolean;
  /** `false` cuando no hay ninguna canción cargada. */
  hasSong: boolean;
  /** Posición actual en segundos (entera y nunca negativa). */
  position: number;
  /** Duración total en segundos (0 si aún no se conoce). */
  duration: number;
  /** Paleta del tema activo, resuelta desde `Colors` al publicar. */
  theme: MediaWidgetTheme;
  /** `true` solo si hay más de una pista: evita botones inertes (`A-03`). */
  canGoPrevious: boolean;
  canGoNext: boolean;
  /** Descripción accesible del contenido para lectores de pantalla. */
  statusLabel: string;
};

/**
 * Props visibles antes de que la app abra por primera vez.
 *
 * `theme` replica `Colors.dark` de `constants/theme` (el modo por defecto) y
 * `statusLabel` describe el estado vacío. No puede importarse la paleta real
 * por el aislamiento del bundle; la prueba de contrato vigila la deriva.
 */
export const MEDIA_WIDGET_INITIAL_PROPS: MediaWidgetProps = {
  title: 'Sin reproducción',
  artist: 'Abre la app y elige música',
  artwork: null,
  isPlaying: false,
  hasSong: false,
  position: 0,
  duration: 0,
  theme: {
    background: '#0B0B0F',
    surface: '#17171C',
    text: '#FFFFFF',
    textSecondary: '#9BA1A6',
    accent: '#FF3D1F',
    accentText: '#FFFFFF',
    progressTrack: '#26262E',
  },
  canGoPrevious: false,
  canGoNext: false,
  statusLabel: 'Sin reproducción',
};
