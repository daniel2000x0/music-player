import { playbackSessionRepository } from '@/data/repositories/playback-session.repository';
import {
  POSITION_THROTTLE_MS,
  QUEUE_DEBOUNCE_MS,
  type PlaybackSession,
} from '@/domain/playback/session';
import { logError } from '@/services/error-log.service';

/**
 * Política de escritura de la sesión de reproducción (`05` §7.3).
 *
 * RESPONSABILIDAD ÚNICA: decidir CUÁNDO se escribe la sesión. El contenido lo
 * construye el llamador y `playback-session.repository` lo persiste; aquí solo
 * viven el throttle de posición, el debounce de cola y el flush al salir a
 * segundo plano.
 *
 * LÓGICA: las tres entradas reciben un constructor (`build`) en vez de una
 * sesión ya armada, para que un tick de posición que no toca escribir no tenga
 * que recorrer la cola entera (con 5000 pistas, dos veces por segundo).
 */

/** Última escritura confirmada (o enviada): base del throttle de posición. */
let lastWriteAt = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBuild: (() => PlaybackSession) | null = null;
/** Cola de escrituras: serializa el acceso a la fila única. */
let inFlight: Promise<void> = Promise.resolve();

function cancelPending(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  pendingBuild = null;
}

function write(build: () => PlaybackSession): void {
  let session: PlaybackSession;
  try {
    // Se construye aquí (no dentro del `.then`) para que un tick descartado
    // por el throttle no recorra la cola, y uno aceptado no dependa de cuándo
    // se resuelva la escritura anterior.
    session = build();
  } catch (error) {
    logError('audio/session-persistence', 'build', error);
    return;
  }
  lastWriteAt = Date.now();
  inFlight = inFlight
    .then(() => playbackSessionRepository.save(session))
    .catch((error: unknown) => logError('audio/session-persistence', 'save', error));
}

/** Escritura inmediata: cambio de pista, de modos y pausa/reanudación. */
export function saveSessionNow(build: () => PlaybackSession): void {
  cancelPending();
  write(build);
}

/**
 * Debounce de 1 s: cambios de cola (añadir, quitar, reordenar).
 *
 * LÓGICA: reordenar la cola con el dedo produce decenas de cambios por
 * segundo; solo interesa el estado final.
 */
export function saveSessionSoon(build: () => PlaybackSession): void {
  pendingBuild = build;
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
  }
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    const pending = pendingBuild;
    pendingBuild = null;
    if (pending) {
      write(pending);
    }
  }, QUEUE_DEBOUNCE_MS);
}

/** Throttle de 5 s: la posición del motor llega cada 500 ms. */
export function savePositionThrottled(build: () => PlaybackSession): void {
  if (Date.now() - lastWriteAt < POSITION_THROTTLE_MS) {
    return;
  }
  write(build);
}

/**
 * Fuerza la escritura pendiente y espera a las que estén en vuelo.
 *
 * Se usa al pausar, al pasar la app a segundo plano y antes de cerrar la
 * sesión: sin esto, el debounce de cola podría perderse con el proceso.
 */
export function flushSessionPersistence(): Promise<void> {
  const pending = pendingBuild;
  cancelPending();
  if (pending) {
    write(pending);
  }
  return inFlight;
}

/**
 * Descarta el estado del módulo. Solo para pruebas: no borra la fila.
 * (`playbackSessionRepository.clear` hace eso.)
 */
export function resetSessionPersistence(): void {
  cancelPending();
  lastWriteAt = 0;
  inFlight = Promise.resolve();
}
