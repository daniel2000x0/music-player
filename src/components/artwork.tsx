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
 * LÓGICA: la mediateca del dispositivo no expone arte embebido (ID3), así
 * que si no hay `uri` dibujamos un placeholder coherente con el tema
 * (cuadro + ícono musical) en lugar de dejar un hueco.
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
