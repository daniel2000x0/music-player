import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEPS = 10;
const TOP_OPACITY = 0.22;
const BOTTOM_OPACITY = 0.16;

type FadeBandProps = {
  color: string;
  height: number;
  maxOpacity: number;
  fromTop: boolean;
  bottomOffset?: number;
};

/**
 * Banda degradada construida con franjas finas: no añade dependencias nativas
 * y suaviza el contraste entre el fondo del héroe y las barras del sistema.
 */
function FadeBand({ color, height, maxOpacity, fromTop, bottomOffset = 0 }: FadeBandProps) {
  const opacities = useMemo(
    () =>
      Array.from({ length: STEPS }, (_, index) => {
        const t = index / (STEPS - 1);
        return maxOpacity * (fromTop ? (1 - t) ** 2 : t ** 2);
      }),
    [fromTop, maxOpacity]
  );
  const stepHeight = height / STEPS;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.band,
        fromTop ? styles.top : styles.bottom,
        { height, bottom: fromTop ? undefined : bottomOffset },
      ]}>
      {opacities.map((opacity, index) => (
        <View
          key={index}
          style={{ height: stepHeight, backgroundColor: color, opacity }}
        />
      ))}
    </View>
  );
}

export type EdgeFadeProps = {
  /** Color del tema con el que se tiñen las bandas. */
  color: string;
  /** Altura extra añadida al área segura superior. */
  topExtra?: number;
  /** Altura extra añadida al área segura inferior. */
  bottomExtra?: number;
};

/** Bandas superiores e inferiores para mimetizar el fondo con los bordes. */
export function EdgeFade({
  color,
  topExtra = 16,
  bottomExtra = 12,
}: EdgeFadeProps) {
  const insets = useSafeAreaInsets();

  return (
    <>
      <FadeBand
        color={color}
        height={Math.max(40, insets.top + topExtra)}
        maxOpacity={TOP_OPACITY}
        fromTop
      />
      <FadeBand
        color={color}
        height={Math.max(24, insets.bottom + bottomExtra)}
        maxOpacity={BOTTOM_OPACITY}
        fromTop={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
});
