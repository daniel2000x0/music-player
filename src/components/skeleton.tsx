import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SkeletonBlockProps = {
  width: DimensionValue;
  height?: number;
  radius?: number;
};

/**
 * Bloque gris estático que representa contenido todavía no cargado.
 *
 * LÓGICA: no anima por sí solo; el pulso lo aporta `SkeletonList` en un único
 * `Animated.Value` compartido, para no crear una animación por bloque.
 */
export function SkeletonBlock({ width, height = 14, radius = Radius.small }: SkeletonBlockProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: theme.backgroundSelected,
      }}
    />
  );
}

export type SkeletonListProps = {
  /** Número de filas esqueleto a dibujar. */
  rows?: number;
};

/**
 * Estado de carga con esqueleto (`UI-06`).
 *
 * LÓGICA: en lugar de un spinner centrado, dibuja filas con la forma de una
 * lista real (portada + dos líneas de texto) y las hace pulsar suavemente.
 * Así la transición a los datos reales se percibe como continuidad, no como
 * un salto. Usa `Animated` de React Native: sin dependencias nuevas.
 */
export function SkeletonList({ rows = 8 }: SkeletonListProps) {
  const [pulse] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{ opacity: pulse }}
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando contenido">
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.row}>
          <SkeletonBlock width={52} height={52} radius={Radius.medium} />
          <View style={styles.rowText}>
            <SkeletonBlock width="70%" />
            <SkeletonBlock width="45%" height={12} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: Spacing.sm,
  },
});
