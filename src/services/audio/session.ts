/**
 * Máquina de estados de la sesión de reproducción.
 *
 * RESPONSABILIDAD ÚNICA: describir en qué fase está el motor y qué
 * transiciones son legales. No toca expo-audio; la fachada informa de cada
 * cambio y la UI puede leer un estado que representa la realidad del motor.
 *
 * LÓGICA: las transiciones no declaradas se rechazan. En desarrollo lanzan
 * para detectar bugs de integración al instante; en producción se ignoran y se
 * conserva el estado anterior para no romper la reproducción.
 */

export type SessionState =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'failed'
  | 'recovering';

export type SessionSnapshot = {
  state: SessionState;
  /** Motivo legible cuando `state === 'failed'`. */
  error: string | null;
};

const TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  idle: ['preparing'],
  preparing: ['ready', 'playing', 'failed', 'idle'],
  ready: ['playing', 'paused', 'preparing', 'failed', 'idle'],
  playing: ['paused', 'ready', 'preparing', 'recovering', 'failed', 'idle'],
  paused: ['playing', 'ready', 'preparing', 'failed', 'idle'],
  failed: ['recovering', 'preparing', 'idle'],
  recovering: ['ready', 'playing', 'paused', 'failed', 'idle'],
};

let current: SessionState = 'idle';
let lastError: string | null = null;
const listeners = new Set<(snapshot: SessionSnapshot) => void>();

function snapshot(): SessionSnapshot {
  return { state: current, error: lastError };
}

function emit(): void {
  const value = snapshot();
  for (const listener of listeners) {
    listener(value);
  }
}

export function getSession(): SessionSnapshot {
  return snapshot();
}

/** Suscribe un oyente; emite el estado actual de inmediato. */
export function subscribeSession(
  listener: (snapshot: SessionSnapshot) => void
): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

/** `true` si la transición está declarada desde el estado actual. */
export function canTransitionTo(next: SessionState): boolean {
  return next === current || TRANSITIONS[current].includes(next);
}

/**
 * Intenta pasar a `next`.
 *
 * Devuelve `true` si la transición se aplicó. Una transición no declarada
 * lanza en desarrollo y se ignora en producción.
 */
export function transitionTo(
  next: SessionState,
  options: { error?: string | null } = {}
): boolean {
  if (next === current) {
    if (options.error !== undefined) {
      lastError = options.error;
      emit();
    }
    return true;
  }

  if (!TRANSITIONS[current].includes(next)) {
    const message = `transición de sesión inválida: ${current} → ${next}`;
    if (__DEV__) {
      throw new Error(message);
    }
    console.warn(`[audio-engine] ${message}`);
    return false;
  }

  current = next;
  lastError = next === 'failed' ? (options.error ?? 'Error de reproducción') : null;
  emit();
  return true;
}

/** Vuelve al estado inicial (playlist liberada). */
export function resetSession(): void {
  current = 'idle';
  lastError = null;
  emit();
}
