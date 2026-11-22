import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={typeof color === 'string' ? color : undefined} />;
  }
  return TabBarIcon;
}

/**
 * Los componentes se crean una sola vez fuera del render. Si se generaran con
 * `icon('home')` dentro de `options`, cada cambio de tema/idioma cambiaría la
 * identidad del componente y React Navigation remontaría los seis iconos.
 */
const TAB_ICONS = {
  index: icon('home'),
  songs: icon('musical-notes'),
  albums: icon('albums'),
  audiobooks: icon('book'),
  playlists: icon('list'),
  settings: icon('settings-outline'),
} as const;

/**
 * Las pestañas principales: Inicio, Canciones, Álbumes, Audiolibros,
 * Playlists y Configuración. Los detalles (álbum, artista, playlist, cola)
 * viven fuera del grupo para que el tab bar no aparezca en ellos.
 */
export default function TabsLayout() {
  const palette = useTheme();
  const { tr } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textSecondary,
        // UI-05: seis pestañas deben caber a 320 dp. La etiqueta se reduce y
        // no escala con la fuente del sistema (el nombre accesible completo lo
        // sigue anunciando el lector de pantalla), así la barra no se rompe ni
        // recorta texto con fuentes grandes.
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          backgroundColor: palette.backgroundElement,
          borderTopColor: palette.border,
        },
        sceneStyle: { backgroundColor: palette.background },
      }}>
      <Tabs.Screen name="index" options={{ title: tr('Inicio'), tabBarIcon: TAB_ICONS.index }} />
      <Tabs.Screen name="songs" options={{ title: tr('Canciones'), tabBarIcon: TAB_ICONS.songs }} />
      <Tabs.Screen name="albums" options={{ title: tr('Álbumes'), tabBarIcon: TAB_ICONS.albums }} />
      <Tabs.Screen name="audiobooks" options={{ title: tr('Audiolibros'), tabBarIcon: TAB_ICONS.audiobooks }} />
      <Tabs.Screen name="playlists" options={{ title: tr('Playlists'), tabBarIcon: TAB_ICONS.playlists }} />
      <Tabs.Screen name="settings" options={{ title: tr('Ajustes'), tabBarIcon: TAB_ICONS.settings }} />
    </Tabs>
  );
}
