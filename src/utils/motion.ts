/**
 * Resuelve la duración de una animación según la preferencia del sistema.
 *
 * Con movimiento reducido se devuelve 0: `Animated` aplica el valor final de
 * forma instantánea y `expo-image` muestra el fondo nuevo sin crossfade.
 * Así las transiciones decorativas desaparecen sin perder información.
 */
export function motionDuration(reducedMotion: boolean, duration: number): number {
  return reducedMotion ? 0 : duration;
}
