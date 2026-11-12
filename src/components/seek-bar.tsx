import { useEffect, useMemo, useRef, useState } from 'react';
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
/** Tiempo máximo que se muestra el valor temporal si el motor no confirma. */
const PENDING_SEEK_TIMEOUT_MS = 1500;

/** Traduce una X del gesto a segundos, acotada al rango [0, duration]. */
function computeSeek(x: number, width: number, duration: number): number {
  if (!width) {
    return 0;
  }
  const ratio = Math.max(0, Math.min(1, x / width));
  return ratio * (duration || 0);
}

function clampSeconds(value: number, duration: number): number {
  return Math.max(0, Math.min(value, duration));
}

/**
 * Barra de progreso arrastrable.
 *
 * LÓGICA: permite saltar a un punto de la canción. Mientras se arrastra
 * muestra el valor "temporal" (no el del reproductor) para que no brincoe.
 *
 * CÓDIGO:
 * - `PanResponder` (sin dependencias extra) captura toque y arrastre.
 * - Los hijos llevan `pointerEvents="none"`: React Native calcula
 *   `locationX` relativo a la vista tocada y el thumb está desplazado, así
 *   que agarrarlo hacía saltar el seek a un segundo incorrecto.
 * - Tras el toque inicial el desplazamiento se calcula con
 *   `gestureState.dx`, que no depende de la vista que haya bajo el dedo.
 * - El responder se recrea cuando cambian `enabled`, `width`, `duration` u
 *   `onSeek`, así sus callbacks siempre ven valores actuales sin usar refs.
 *
 * El componente se remonta con `key={song.id}` desde el reproductor, de modo
 * que un seek pendiente nunca se arrastra a la pista siguiente.
 */
export function SeekBar({ position, duration, onSeek }: SeekBarProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);
  const startValue = useRef(0);
  const enabled = duration > 0 && width > 0;

  // Red de seguridad: si el motor nunca confirma el seek, vuelve a mostrar
  // la posición real en lugar de quedarse congelado en el destino.
  useEffect(() => {
    if (pendingSeek === null) {
      return;
    }
    const timer = setTimeout(() => setPendingSeek(null), PENDING_SEEK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pendingSeek]);

  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- `startValue` solo se lee en los handlers del gesto
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled,
        // La barra está dentro de un ScrollView: sin esto, un gesto vertical
        // puede robar el responder y cancelar el seek.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          if (!enabled) {
            return;
          }
          const value = computeSeek(event.nativeEvent.locationX, width, duration);
          startValue.current = value;
          setDragging(true);
          setDragValue(value);
        },
        onPanResponderMove: (_event, gesture) => {
          if (!enabled) {
            return;
          }
          const value = clampSeconds(
            startValue.current + (gesture.dx / width) * duration,
            duration
          );
          setDragValue(value);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!enabled) {
            return;
          }
          const value = clampSeconds(
            startValue.current + (gesture.dx / width) * duration,
            duration
          );
          setDragValue(value);
          setPendingSeek(value);
          setDragging(false);
          onSeek(value);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
        },
      }),
    [enabled, width, duration, onSeek]
  );

  // Mientras el motor no confirma el destino, se muestra el valor temporal.
  const awaitingConfirmation =
    pendingSeek !== null && Math.abs(position - pendingSeek) >= 1;
  const current = dragging
    ? dragValue
    : awaitingConfirmation
      ? pendingSeek
      : position;

  const progress = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0;
  const thumbLeft = Math.max(0, Math.min(width - THUMB_SIZE, progress * width - THUMB_SIZE / 2));

  return (
    <View
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      style={styles.hitArea}
      {...responder.panHandlers}>
      <View
        pointerEvents="none"
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[styles.fill, { backgroundColor: theme.accent, width: `${progress * 100}%` }]}
        />
      </View>
      {width > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.thumb, { backgroundColor: theme.text, left: thumbLeft }]}
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
