import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type VolumeControlProps = {
  /** Volumen actual, en el rango 0–1. */
  volume: number;
  /** Se llama con cada cambio del gesto y con el toque de silencio. */
  onChange: (volume: number) => void;
};

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;
const HIT_HEIGHT = 32;
/** Volumen al que salta el icono al reactivar el sonido desde 0. */
const UNMUTE_VOLUME = 0.5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Control de volumen del reproductor (`M-02`).
 *
 * RESPONSABILIDAD ÚNICA: traducir un gesto horizontal (o el toque del icono)
 * en un valor 0–1. No conoce el motor: el llamador aplica y persiste el
 * volumen. Sigue el mismo patrón de `SeekBar` para que el gesto no robe el
 * desplazamiento vertical del `ScrollView` que lo contiene.
 */
export function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const startValue = useRef(0);

  const enabled = width > 0;
  const current = dragging ? dragValue : volume;
  const muted = current <= 0;

  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- `startValue` solo se lee en los handlers del gesto
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          if (!enabled) {
            return;
          }
          const value = clamp01(event.nativeEvent.locationX / width);
          startValue.current = value;
          setDragging(true);
          setDragValue(value);
          onChange(value);
        },
        onPanResponderMove: (_event, gesture) => {
          if (!enabled) {
            return;
          }
          const value = clamp01(startValue.current + gesture.dx / width);
          setDragValue(value);
          onChange(value);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!enabled) {
            return;
          }
          const value = clamp01(startValue.current + gesture.dx / width);
          setDragValue(value);
          setDragging(false);
          onChange(value);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
        },
      }),
    [enabled, width, onChange]
  );

  const thumbLeft = Math.max(
    0,
    Math.min(width - THUMB_SIZE, current * width - THUMB_SIZE / 2)
  );

  return (
    <View style={styles.row}>
      <Pressable
        hitSlop={10}
        onPress={() => onChange(muted ? UNMUTE_VOLUME : 0)}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Activar sonido' : 'Silenciar'}>
        <Ionicons
          name={muted ? 'volume-mute' : current < 0.5 ? 'volume-low' : 'volume-high'}
          size={22}
          color={theme.textSecondary}
        />
      </Pressable>
      <View
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
        }}
        style={styles.hitArea}
        accessibilityRole="adjustable"
        accessibilityLabel="Volumen"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(current * 100) }}
        {...responder.panHandlers}>
        <View
          pointerEvents="none"
          style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: theme.accent, width: `${current * 100}%` },
            ]}
          />
        </View>
        {width > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.thumb, { backgroundColor: theme.text, left: thumbLeft }]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.lg,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitArea: {
    flex: 1,
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
