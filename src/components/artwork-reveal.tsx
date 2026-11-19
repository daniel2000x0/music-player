import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

import { Artwork, type ArtworkProps } from '@/components/artwork';

export type ArtworkRevealProps = ArtworkProps;

/**
 * Portada con aparición animada (`UI-08`).
 *
 * LÓGICA: cuando cambia la pista (y por tanto la portada), la imagen entra con
 * un fundido y un leve crecimiento en vez de aparecer de golpe. Da continuidad
 * visual al saltar de canción. Usa `Animated` de React Native (sin dependencias
 * nuevas) y `useNativeDriver`, así la animación corre fuera del hilo de JS.
 */
export function ArtworkReveal({ uri, ...props }: ArtworkRevealProps) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [uri, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
          },
        ],
      }}>
      <Artwork uri={uri} {...props} />
    </Animated.View>
  );
}
