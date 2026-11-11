import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ArtworkProps = {
  /** URI de la portada; si es `null`, se muestra un placeholder. */
  uri?: string | null;
  /** Lado del cuadrado en píxeles. */
  size?: number;
  /** Radio de esquina explícito (por defecto se deriva del tamaño). */
  radius?: number;
};

/**
 * Portada cuadrada de una canción/álbum/playlist.
 *
 * LÓGICA: el arte embebido se extrae de los tags ID3v2/MP4 durante el
 * escaneo y se cachea en el dispositivo (ver `artwork.service`); la URI
 * llega por `song.artwork`/`album.artwork`. Si el archivo de audio no
 * tiene portada (o el cache fue purgado), se dibuja un placeholder
 * coherente con el tema en lugar de dejar un hueco.
 *
 * CÓDIGO:
 * - Con `uri` usa `expo-image` (cachea y recorta).
 * - Sin `uri` usa una `View` con fondo `backgroundSelected`.
 */
export function Artwork({ uri, size = 56, radius }: ArtworkProps) {
  const theme = useTheme();
  const cornerRadius = radius ?? (size >= 120 ? Radius.large : Radius.medium);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        // Clave de reciclaje: al reusarse la celda de una FlatList con otra
        // portada, expo-image descarta la imagen anterior de inmediato.
        recyclingKey={uri}
        style={{ width: size, height: size, borderRadius: cornerRadius }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View
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
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
