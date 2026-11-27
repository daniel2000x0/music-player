import type { ImageSourcePropType } from 'react-native';

// Las etiquetas pasan por `tr(...)` en el selector: tiparlas como LiteralKey
// obliga a que cada tema a?adido tenga traducci?n antes de compilar.
import type { LiteralKey } from '@/i18n';
import type { ThemeMode } from '@/types/settings';

/**
 * Logotipo predeterminado de la app. Se usa como fallback para temas sin imagen
 * específica asignada. Importación estática para que Metro lo resuelva.
 */
export const DEFAULT_THEME_LOGO: ImageSourcePropType = require('../../assets/images/defaultLogo.png');

/** Imagen específica del tema claro (selector/preview en app). */
export const LIGHT_THEME_LOGO: ImageSourcePropType = require('../../assets/images/themesIcons/defaultlight/lighticon (1).jpg');

/** Imagen específica del tema oscuro (selector/preview en app). */
export const DARK_THEME_LOGO: ImageSourcePropType = require('../../assets/images/themesIcons/defaultdark/darckicon.jpg');

/**
 * Logotipo específico del tema Hunger Games.
 * Se usa la imagen definida en `assets/images/themesIcons/Hungergames/`.
 */
export const HUNGER_GAMES_THEME_LOGO: ImageSourcePropType = require('../../assets/images/themesIcons/Hungergames/HungerGame.png');

/**
 * Cat?logo visible del selector de temas.
 *
 * L?GICA: `icon` es la imagen que se pinta dentro de la app (funciona en Expo
 * Go) y `appIcon` es el nombre registrado por el config plugin para el icono
 * del launcher (solo en builds nativos). Claro y Oscuro usan sus imágenes específicas; los temas con imagen propia conservan su recurso.
 */
export type ThemeCatalogItem = {
  id: ThemeMode;
  label: LiteralKey;
  icon: ImageSourcePropType;
  appIcon: string | null;
  swatch: string;
};

export const THEME_CATALOG: readonly ThemeCatalogItem[] = [
  {
    id: 'light',
    label: 'Claro',
    icon: LIGHT_THEME_LOGO,
    appIcon: null,
    swatch: '#12B76A',
  },
  {
    id: 'dark',
    label: 'Oscuro',
    icon: DARK_THEME_LOGO,
    appIcon: null,
    swatch: '#FF3D1F',
  },
  {
    id: 'ironman',
    label: 'Iron Man',
    icon: require('../../assets/images/themesIcons/ironMan/icons8-iron-man-240.png'),
    appIcon: 'IronMan',
    swatch: '#C50600',
  },
  {
    id: 'avengers',
    label: 'Avengers',
    icon: require('../../assets/images/themesIcons/Avengers/icons8-avengers-240.png'),
    appIcon: 'Avengers',
    swatch: '#E32636',
  },
  {
    id: 'capitanAmerica',
    label: 'Capitán América',
    icon: require('../../assets/images/themesIcons/CapitanAmerica/icons8-captain-america-240.png'),
    appIcon: 'CapitanAmerica',
    swatch: '#D62E2D',
  },
  {
    id: 'spiderman',
    label: 'Spider-Man',
    icon: require('../../assets/images/themesIcons/spiderman/icons8-spider-man-head-240.png'),
    appIcon: 'SpiderMan',
    swatch: '#EC2F2C',
  },
  {
    id: 'superman',
    label: 'Superman',
    icon: require('../../assets/images/themesIcons/superman/icons8-superman-200.png'),
    appIcon: 'Superman',
    swatch: '#D90D1F',
  },
  {
    id: 'greenLantern',
    label: 'Linterna Verde',
    icon: require('../../assets/images/themesIcons/greenLantern/icons8-green-lantern-240.png'),
    appIcon: 'GreenLantern',
    swatch: '#50C878',
  },
  {
    id: 'hungergames',
    label: 'Hunger Games',
    icon: HUNGER_GAMES_THEME_LOGO,
    appIcon: 'HungerGames',
    swatch: '#B8A47A',
  },
];

/**
 * Resuelve el logotipo a mostrar para un tema.
 *
 * Reglas:
 * - Claro/Oscuro: usan sus imágenes específicas configuradas.
 * - Hunger Games: imagen específica en `assets/images/themesIcons/Hungergames/`.
 * - Tema con imagen propia asignada en catálogo: conserva su imagen.
 * - Tema sin imagen específica: `DEFAULT_THEME_LOGO`.
 */
export function getThemeLogo(theme: ThemeMode | string): ImageSourcePropType {
  if (theme === 'light') return LIGHT_THEME_LOGO;
  if (theme === 'dark') return DARK_THEME_LOGO;
  if (theme === 'hungergames' || theme === 'hungerGames' || theme === 'HungerGames') {
    return HUNGER_GAMES_THEME_LOGO;
  }
  const item = THEME_CATALOG.find((entry) => entry.id === theme);
  return item?.icon ?? DEFAULT_THEME_LOGO;
}

export function themeAppIcon(theme: ThemeMode): string | null {
  return THEME_CATALOG.find((item) => item.id === theme)?.appIcon ?? null;
}
