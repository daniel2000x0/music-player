import { useEffect, useState } from 'react';

/**
 * Devuelve `value` tras un retraso sin updates. Para búsquedas: el input
 * responde al instante con el texto crudo y el filtrado (caro) corre sobre
 * el valor "asentado", evitando re-filtrar en cada tecla.
 */
export function useDebouncedValue<T>(value: T, delayMs = 120): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
