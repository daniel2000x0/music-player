import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Elevation, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ArtworkProps = {
  /** URI de la portada; si es `null`, se muestra un placeholder. */
  uri?: string | null;
  /** Lado del cuadrado en píxeles. */
  size?: number;
  /** Radio de esquina explícito (por defecto se deriva del tamaño). */
  radius?: number;
  /** Aplica sombra suave para jerarquía visual (útil en reproductor/hero). */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Portada cuadrada de una canción/álbum/playlist.
 *
 * LÓGICA: el arte embebido se extrae de los tags ID3v2/MP4 durante el
 * escaneo y se cachea en el dispositivo (ver `artwork.service`); la URI
 * llega por `song.artwork`/`album.artwork`. Si el archivo no tiene portada,
 * fue purgado o falla su carga, se ve el placeholder del tema en vez de un
 * cuadro negro.
 *
 * CÓDIGO:
 * - El placeholder se dibuja SIEMPRE debajo de `expo-image`. En las celdas
 *   recicladas, `recyclingKey` deja la imagen vacía un instante; sin ese fondo
 *   (y con `transition`, que entra desde alpha 0) se ve negro al desplazarse.
 * - No se usa `transition`: en una FlatList provoca un fundido desde el hueco
 *   cada vez que se reutiliza una celda.
 * - `expo-image` se superpone solo cuando tiene bytes válidos que pintar.
 */
export function Artwork({ uri, size = 56, radius, elevated = false, style }: ArtworkProps) {
  const theme = useTheme();
  const cornerRadius = radius ?? (size >= 120 ? Radius.large : Radius.medium);
  const elevationStyle = elevated ? Elevation.floating : undefined;

  const placeholder = (
    <View
      accessibilityElementsHidden={Boolean(uri)}
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
          backgroundColor: theme.backgroundSelected,
        },
      ]}>
      <Ionicons name="musical-notes" size={size * 0.38} color={theme.textSecondary} />
    </View>
  );

  if (!uri) {
    return <View style={[elevationStyle, style]}>{placeholder}</View>;
  }

  return (
    <View style={[elevationStyle, styles.container, style]}>
      {placeholder}
      <Image
        source={{ uri }}
        // Al reusar la celda con otra portada, expo-image descarta la anterior.
        recyclingKey={uri}
        style={[styles.image, { width: size, height: size, borderRadius: cornerRadius }]}
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    // Encima del placeholder; si la URI falla, queda transparente y el
    // placeholder del tema sigue visible.
    position: 'absolute',
  },
});
