import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type SeekBarProps = {
  /** Posición actual en segundos. */
  position: number;
  /** Duración total en segundos. */
  duration: number;
  /** Se llama al soltar, con el segundo destino. */
  onSeek: (seconds: number) => void;
};

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;
const HIT_HEIGHT = 32;

/** Traduce una X del gesto a segundos, acotada al rango [0, duration]. */
function computeSeek(x: number, width: number, duration: number): number {
  if (!width) {
    return 0;
  }
  const ratio = Math.max(0, Math.min(1, x / width));
  return ratio * (duration || 0);
}

/**
 * Barra de progreso arrastrable.
 *
 * LÓGICA: permite saltar a un punto de la canción. Mientras se arrastra
 * muestra el valor "temporal" (no el del reproductor) para que no brincoe.
 *
 * CÓDIGO:
 * - `PanResponder` (sin dependencias extra) captura toque y arrastre.
 * - El responder se recrea cuando cambian `width`, `duration` u `onSeek`,
 *   así sus callbacks siempre ven valores actuales sin usar refs.
 */
export function SeekBar({ position, duration, onSeek }: SeekBarProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setDragging(true);
          setDragValue(computeSeek(event.nativeEvent.locationX, width, duration));
        },
        onPanResponderMove: (event) => {
          setDragValue(computeSeek(event.nativeEvent.locationX, width, duration));
        },
        onPanResponderRelease: (event) => {
          const value = computeSeek(event.nativeEvent.locationX, width, duration);
          setDragging(false);
          onSeek(value);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
        },
      }),
    [width, duration, onSeek]
  );

  const current = dragging ? dragValue : position;
  const progress = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0;

  return (
    <View
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      style={styles.hitArea}
      {...responder.panHandlers}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[styles.fill, { backgroundColor: theme.accent, width: `${progress * 100}%` }]}
        />
      </View>
      {width > 0 ? (
        <View
          style={[
            styles.thumb,
            { backgroundColor: theme.text, left: progress * width - THUMB_SIZE / 2 },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    height: HIT_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT,
    overflow: 'hidden',
  },
  fill: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE,
  },
});
