/**
 * Hook de esquema de color para plataformas nativas.
 *
 * LÓGICA: en iOS/Android sólo se re-exporta el hook oficial de React
 * Native, porque no hay problema de render estático (el tema ya está
 * disponible en el primer render nativo).
 *
 * CÓDIGO: este alias permite que el resto de la app importe siempre desde
 * `@/hooks/use-color-scheme` y que Metro resuelva la variante
 * `use-color-scheme.web` sólo en web (misma mecánica de los `.web.tsx`).
 */
export { useColorScheme } from 'react-native';