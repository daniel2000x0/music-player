import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { EdgeScrollIndicatorProps } from '@/components/edge-scroll-indicator';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { motionDuration } from '@/utils/motion';

const HIDE_DELAY_MS = 900;

type ScrollMetrics = {
  contentHeight: number;
  viewportHeight: number;
};

export type EdgeScrollController = {
  /** Props a propagar al `FlatList` (indicador nativo apagado). */
  scrollProps: {
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle: number;
    showsVerticalScrollIndicator: false;
  };
  /** Props del indicador absoluto, a renderizar dentro del marco de la lista. */
  indicatorProps: EdgeScrollIndicatorProps;
};

/**
 * Controla el indicador de scroll propio del tema.
 *
 * El thumb nativo se desactiva porque en Android no admite color y siempre
 * queda gris, despegado del borde. Aquí se mide el scroll en cada frame, se
 * anima un pulgar con el color de la paleta y se oculta al dejar de desplazarse.
 */
export function useScrollIndicator(): EdgeScrollController {
  const palette = useTheme();
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fade = useRef<Animated.CompositeAnimation | null>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    contentHeight: 0,
    viewportHeight: 0,
  });

  const fadeTo = useCallback(
    (toValue: number, duration: number) => {
      fade.current?.stop();
      fade.current = Animated.timing(opacity, {
        toValue,
        duration: motionDuration(reducedMotion, duration),
        easing: toValue === 1 ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: true,
      });
      fade.current.start();
    },
    [opacity, reducedMotion]
  );

  const show = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    fadeTo(1, 120);
    hideTimer.current = setTimeout(() => fadeTo(0, 320), HIDE_DELAY_MS);
  }, [fadeTo]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentSize, layoutMeasurement, contentOffset } = event.nativeEvent;

      setMetrics((previous) =>
        previous.contentHeight === contentSize.height &&
        previous.viewportHeight === layoutMeasurement.height
          ? previous
          : {
              contentHeight: contentSize.height,
              viewportHeight: layoutMeasurement.height,
            }
      );

      const range = Math.max(1, contentSize.height - layoutMeasurement.height);
      progress.setValue(Math.min(1, Math.max(0, contentOffset.y / range)));
      show();
    },
    [progress, show]
  );

  useEffect(
    () => () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      fade.current?.stop();
    },
    []
  );

  return {
    scrollProps: {
      onScroll,
      scrollEventThrottle: 16,
      showsVerticalScrollIndicator: false,
    },
    indicatorProps: {
      progress,
      opacity,
      contentHeight: metrics.contentHeight,
      viewportHeight: metrics.viewportHeight,
      color: palette.scrollbarIndicator,
    },
  };
}
