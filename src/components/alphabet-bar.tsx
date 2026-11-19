import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AlphabetBarProps = {
  /** Letras disponibles, en orden alfabético. */
  letters: string[];
  onSelect: (letter: string) => void;
  /** Sustantivo para el texto accesible (ej. "canciones", "audiolibros"). */
  itemNoun: string;
  /**
   * Inicial de la fila que encabeza la lista. La píldora resalta esa letra y
   * hace las veces de indicador de posición, de modo que no hace falta dibujar
   * una segunda barra de scroll en el mismo carril.
   */
  activeLetter?: string | null;
};

/** Ancho de la barra alfabética flotante. */
const BAR_WIDTH = 24;

/**
 * Aire entre la barra y el borde derecho de la pantalla.
 *
 * LÓGICA: no se pega a 0 px para conservar la silueta redondeada de la
 * píldora, dejar espacio al gesto "atrás" de Android y separarla del borde.
 * El indicador nativo se desactiva en estas listas (ver `useScrollIndicator`),
 * así que ya no hay dos barras compitiendo por el mismo carril.
 */
const BAR_EDGE_GAP = Spacing.sm;

/**
 * Índice alfabético flotante para listas largas y, a la vez, indicador de la
 * posición de desplazamiento.
 *
 * POSICIÓN: se ancla al borde derecho de la pantalla compensando el padding
 * horizontal de `ScreenShell` (`Spacing.xl`). El contenedor padre debe ser
 * el área de contenido de una pantalla y ocupar todo su alto.
 */
export function AlphabetBar({
  letters,
  onSelect,
  itemNoun,
  activeLetter,
}: AlphabetBarProps) {
  const theme = useTheme();

  if (letters.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      {letters.map((letter) => {
        const active = letter === activeLetter;

        return (
          <Pressable
            key={letter}
            onPress={() => onSelect(letter)}
            hitSlop={2}
            style={({ pressed }) => [
              styles.letterButton,
              active && [styles.activeLetter, { backgroundColor: theme.backgroundSelected }],
              pressed && styles.letterPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Ir a ${itemNoun} con la letra ${letter}`}>
            <ThemedText
              type="small"
              style={[
                styles.letterText,
                { color: theme.accent },
                active && styles.activeLetterText,
              ]}>
              {letter}
            </ThemedText>
            {active ? <View style={[styles.thumb, { backgroundColor: theme.accent }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    // Compensa el padding horizontal de `ScreenShell` para llegar al borde
    // de la pantalla (respetando el área segura) dejando un pequeño aire.
    right: -(Spacing.xl - BAR_EDGE_GAP),
    top: Spacing.sm,
    bottom: Spacing.sm,
    width: BAR_WIDTH,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.xs,
    elevation: 3,
    zIndex: 10,
  },

  letterButton: {
    flex: 1,
    position: 'relative',
    width: '100%',
    minHeight: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
  },

  activeLetter: {
    borderRadius: Radius.small,
  },

  activeLetterText: {
    fontWeight: '700',
  },

  /** Marca fina que viaja con la letra activa, en lugar de una segunda barra. */
  thumb: {
    position: 'absolute',
    right: 1,
    top: 2,
    bottom: 2,
    width: 2,
    borderRadius: 1,
  },

  letterText: {
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 11,
  },

  letterPressed: {
    opacity: 0.45,
  },
});
