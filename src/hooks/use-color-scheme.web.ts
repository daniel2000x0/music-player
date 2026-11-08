import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Hook de esquema de color para web.
 *
 * LÓGICA: el render estático de Expo Router (SSR) no conoce el tema del
 * navegador, por lo que si devolviéramos el valor real de `useColorScheme`
 * en el servidor, el HTML inicial y el render en cliente podrían diferir
 * (lo que provoca "hydration mismatch").
 *
 * Solución:
 * 1. En el servidor/primer render devolvemos `'light'` (valor fijo).
 * 2. Tras la hidratación (`hasHydrated === true`) ya podemos leer y
 *    devolver el esquema real del navegador y React re-renderiza con él.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Patrón intencional del template: recalcular el tema tras la hidratación en web.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  // Sólo después de la hidratación devolvemos el esquema verdadero.
  if (hasHydrated) {
    return colorScheme;
  }

  // Valor estable para el primer render y el SSR (evita mismatches).
  return 'light';
}