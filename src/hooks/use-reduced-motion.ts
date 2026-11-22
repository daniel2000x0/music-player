import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Indica si el sistema tiene activado "reducir movimiento".
 *
 * LÓGICA: se consulta el estado inicial de forma asíncrona y se suscribe a
 * `reduceMotionChanged` para reaccionar si el usuario lo activa con la app
 * abierta. La suscripción se libera al desmontar.
 *
 * En Android el evento también se dispara cuando "Escala de animación de
 * transición" está en "Desactivada" en Opciones de desarrollador, que es la
 * forma habitual de probarlo en un dispositivo sin accesibilidad adicional.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduced(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduced(enabled)
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
