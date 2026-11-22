import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { lerpColor } from '@/utils/color';

export type AnimatedScrimProps = {
  /** Color objetivo de la veladura (scrim) del tema activo. */
  color: string;
  /** Duración del crossfade en milisegundos. */
  duration?: number;
};

type Transition = { from: string; to: string };

/**
 * Veladura del fondo con crossfade entre temas.
 *
 * LÓGICA: `Animated` interpola colores en el hilo JS (`useNativeDriver: false`),
 * así que el cambiazo de tintes al elegir otro héroe desaparece. El color
 * visible se guarda en cada frame para que, si el usuario cambia de tema a
 * mitad de la transición, la nueva animación arranque desde ese color y no
 * desde el objetivo anterior (evita saltos).
 */
export function AnimatedScrim({ color, duration = 380 }: AnimatedScrimProps) {
  const [progress] = useState(() => new Animated.Value(1));
  const [transition, setTransition] = useState<Transition>({ from: color, to: color });
  const visibleColor = useRef(color);
  const target = useRef(color);

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      visibleColor.current = lerpColor(transition.from, transition.to, value);
    });
    return () => progress.removeListener(listenerId);
  }, [progress, transition.from, transition.to]);

  useEffect(() => {
    // Con duration 0 (movimiento reducido) se fuerza el estado final aunque el
    // color no haya cambiado: así no se congela un crossfade a medias si el
    // usuario activa la preferencia mientras la veladura se estaba fundiendo.
    if (color === target.current && duration > 0) {
      return;
    }

    setTransition({
      from: duration === 0 ? color : visibleColor.current,
      to: color,
    });
    target.current = color;
    progress.setValue(0);

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [color, duration, progress]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [transition.from, transition.to],
  });

  return <Animated.View pointerEvents="none" style={[styles.scrim, { backgroundColor }]} />;
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
