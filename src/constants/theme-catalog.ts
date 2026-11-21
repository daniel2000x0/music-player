import type { ImageSourcePropType } from 'react-native';

import type { ThemeMode } from '@/types/settings';

/**
 * Catálogo visible del selector de temas.
 *
 * LÓGICA: `icon` es la imagen que se pinta dentro de la app (funciona en Expo
 * Go) y `appIcon` es el nombre registrado por el config plugin para el icono
 * del launcher (solo en builds nativos). Claro y Oscuro no tienen `appIcon`:
 * conservan el icono por defecto.
 */
export type ThemeCatalogItem = {
  id: ThemeMode;
  label: string;
  icon: ImageSourcePropType;
  appIcon: string | null;
  swatch: string;
};

export const THEME_CATALOG: readonly ThemeCatalogItem[] = [
  {
    id: 'light',
    label: 'Claro',
    icon: require('../../assets/images/icon.png'),
    appIcon: null,
    swatch: '#12B76A',
  },
  {
    id: 'dark',
    label: 'Oscuro',
    icon: require('../../assets/images/icon.png'),
    appIcon: null,
    swatch: '#1ED760',
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
];

export function themeAppIcon(theme: ThemeMode): string | null {
  return THEME_CATALOG.find((item) => item.id === theme)?.appIcon ?? null;
}
