import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={typeof color === 'string' ? color : undefined} />;
  }
  return TabBarIcon;
}

/**
 * Las pestañas principales: Inicio, Canciones, Álbumes, Audiolibros,
 * Playlists y Configuración. Los detalles (álbum, artista, playlist, cola)
 * viven fuera del grupo para que el tab bar no aparezca en ellos.
 */
export default function TabsLayout() {
  const palette = useTheme();

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
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="songs" options={{ title: 'Canciones', tabBarIcon: icon('musical-notes') }} />
      <Tabs.Screen name="albums" options={{ title: 'Álbumes', tabBarIcon: icon('albums') }} />
      <Tabs.Screen name="audiobooks" options={{ title: 'Audiolibros', tabBarIcon: icon('book') }} />
      <Tabs.Screen name="playlists" options={{ title: 'Playlists', tabBarIcon: icon('list') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
