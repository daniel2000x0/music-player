import { Animated, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { scrollThumbMetrics } from '@/utils/scroll-indicator';

export type EdgeScrollIndicatorProps = {
  /** Progreso de desplazamiento, entre 0 y 1. */
  progress: Animated.Value;
  /** Opacidad animada (se desvanece al dejar de desplazarse). */
  opacity: Animated.Value;
  contentHeight: number;
  viewportHeight: number;
  /** Color del tema activo (`scrollbarIndicator`). */
  color: string;
};

/**
 * Indicador vertical dibujado en el borde físico de la lista.
 *
 * Sustituye al thumb gris del sistema: usa el color del tema, aparece solo
 * cuando hay contenido desplazable y se desvanece al terminar el gesto.
 */
export function EdgeScrollIndicator({
  progress,
  opacity,
  contentHeight,
  viewportHeight,
  color,
}: EdgeScrollIndicatorProps) {
  const metrics = scrollThumbMetrics(contentHeight, viewportHeight);
  if (!metrics) {
    return null;
  }

  // El native driver solo admite `transform` y `opacity`, no propiedades de
  // posición como `top`. El pulgar se ancla en top: 0 y se desplaza con
  // translateY para que el driver nativo pueda moverlo en el hilo de UI.
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, metrics.travel],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.indicator,
        {
          height: metrics.height,
          backgroundColor: color,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    borderRadius: Radius.pill,
  },
});
