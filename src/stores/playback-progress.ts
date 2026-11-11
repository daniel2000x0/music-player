import { useSyncExternalStore } from 'react';

/**
 * Progreso de reproducción (posición y duración) aislado del store de zustand.
 *
 * RENDIMIENTO: el motor de audio reporta el estado cada 500 ms; si la posición
 * viviera en `usePlayerStore`, PlayerScreen y MiniPlayer (portada, controles,
 * textos) se re-renderizarían 2 veces por segundo. Aquí solo se suscriben los
 * componentes que muestran el progreso.
 *
 * LÓGICA: los escritores son exclusivamente acciones de `player.store`; la
 * lógica no-React usa los getters y los componentes usan los hooks.
 */
type Listener = () => void;

let position = 0;
let duration = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function apply(nextPosition: number, nextDuration: number): void {
  if (nextPosition === position && nextDuration === duration) {
    return;
  }
  position = nextPosition;
  duration = nextDuration;
  emit();
}

/** Fija posición y duración (no notifica si nada cambia). */
export function setPlaybackProgress(nextPosition: number, nextDuration: number): void {
  apply(nextPosition, nextDuration);
}

/** Fija la posición conservando la duración actual. */
export function setPlaybackPosition(nextPosition: number): void {
  apply(nextPosition, duration);
}

/** Reinicia la posición a 0 con una duración nueva (cambio de pista). */
export function resetPlaybackProgress(nextDuration: number): void {
  apply(0, nextDuration);
}

/** Lectores para lógica fuera de React (p. ej. `player.store.previous`). */
export function getPlaybackPosition(): number {
  return position;
}

export function getPlaybackDuration(): number {
  return duration;
}

/** Suscripción de componentes: solo quienes muestran el progreso. */
export function usePlaybackPosition(): number {
  return useSyncExternalStore(
    subscribe,
    () => position,
    () => position
  );
}

export function usePlaybackDuration(): number {
  return useSyncExternalStore(
    subscribe,
    () => duration,
    () => duration
  );
}
