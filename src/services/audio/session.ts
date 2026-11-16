/**
 * Máquina de estados de la sesión de reproducción.
 *
 * RESPONSABILIDAD ÚNICA: describir en qué fase está el motor y qué
 * transiciones son legales. No toca expo-audio; la fachada informa de cada
 * cambio y la UI puede leer un estado que representa la realidad del motor.
 *
 * La persistencia de la sesión NO vive aquí: la decide
 * `services/audio/session-persistence` y la guarda
 * `data/repositories/playback-session.repository`, para que este módulo siga
 * siendo puro y probable sin mocks.
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
  | 'recovering'
  /**
   * Reproduce, pero sin alguna capacidad del sistema (p. ej. los controles de
   * pantalla de bloqueo). No es terminal: al recuperarse la capacidad se
   * vuelve al estado real de reproducción. Vive solo en la sesión de UI, nunca
   * en disco.
   */
  | 'degraded';

export type SessionSnapshot = {
  state: SessionState;
  /** Motivo legible cuando `state === 'failed'` o `'degraded'`. */
  error: string | null;
};

const TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  idle: ['preparing'],
  preparing: ['ready', 'playing', 'failed', 'degraded', 'idle'],
  ready: ['playing', 'paused', 'preparing', 'failed', 'degraded', 'idle'],
  playing: ['paused', 'ready', 'preparing', 'recovering', 'failed', 'degraded', 'idle'],
  paused: ['playing', 'ready', 'preparing', 'failed', 'degraded', 'idle'],
  failed: ['recovering', 'degraded', 'preparing', 'idle'],
  recovering: ['ready', 'playing', 'paused', 'failed', 'degraded', 'idle'],
  degraded: ['ready', 'playing', 'paused', 'preparing', 'recovering', 'failed', 'idle'],
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
    console.warn(`[audio/session] ${message}`);
    return false;
  }

  current = next;
  if (next === 'failed') {
    lastError = options.error ?? 'Error de reproducción';
  } else if (next === 'degraded') {
    // Degradarse no borra el motivo anterior: describe la capacidad ausente.
    lastError = options.error ?? lastError;
  } else {
    lastError = null;
  }
  emit();
  return true;
}

/**
 * Declara la sesión degradada: reproduce, pero sin alguna capacidad del
 * sistema (`A-04`). Se ignora si el estado actual no lo permite (p. ej.
 * `idle`: no hay nada que degradar todavía).
 */
export function degradeSession(reason: string): void {
  if (current === 'degraded') {
    if (lastError !== reason) {
      lastError = reason;
      emit();
    }
    return;
  }
  if (!canTransitionTo('degraded')) {
    return;
  }
  transitionTo('degraded', { error: reason });
}

/**
 * Vuelve a la realidad de reproducción cuando la capacidad degradada se
 * recupera. `playing` es el estado real del motor en ese momento.
 */
export function clearDegradation(playing: boolean): void {
  if (current !== 'degraded') {
    return;
  }
  transitionTo(playing ? 'playing' : 'paused');
}

/** Vuelve al estado inicial (playlist liberada). */
export function resetSession(): void {
  current = 'idle';
  lastError = null;
  emit();
}
