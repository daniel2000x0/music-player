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
};

/** Ancho de la barra alfabética flotante. */
const BAR_WIDTH = 24;

/**
 * Aire entre la barra y el borde derecho de la pantalla.
 *
 * LÓGICA: no se pega a 0 px para conservar la silueta redondeada de la
 * píldora, dejar espacio al gesto "atrás" de Android y cubrir por completo
 * el indicador nativo de scroll (evita dos barras verticales seguidas).
 */
const BAR_EDGE_GAP = Spacing.two;

/**
 * Índice alfabético flotante para listas largas.
 *
 * POSICIÓN: se ancla al borde derecho de la pantalla compensando el padding
 * horizontal de `ScreenShell` (`Spacing.four`). El contenedor padre debe ser
 * el área de contenido de una pantalla y ocupar todo su alto.
 */
export function AlphabetBar({ letters, onSelect, itemNoun }: AlphabetBarProps) {
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
      {letters.map((letter) => (
        <Pressable
          key={letter}
          onPress={() => onSelect(letter)}
          hitSlop={2}
          style={({ pressed }) => [
            styles.letterButton,
            pressed && styles.letterPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Ir a ${itemNoun} con la letra ${letter}`}>
          <ThemedText
            type="small"
            style={[styles.letterText, { color: theme.accent }]}>
            {letter}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    // Compensa el padding horizontal de `ScreenShell` para llegar al borde
    // de la pantalla (respetando el área segura) dejando un pequeño aire.
    right: -(Spacing.four - BAR_EDGE_GAP),
    top: 8,
    bottom: 8,
    width: BAR_WIDTH,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.half,
    elevation: 3,
    zIndex: 10,
  },

  letterButton: {
    flex: 1,
    width: '100%',
    minHeight: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
