/**
 * Registro local de errores y advertencias.
 *
 * LÓGICA: cada entrada agrupa por huella (nivel+ámbito+acción+mensaje),
 * de modo que un fallo repetido solo incrementa `occurrences`. Sirve para
 * leer en la pantalla "Registro de errores" qué falló y dónde ocurrió.
 */

export type ErrorLogLevel = 'error' | 'warning';

/** Fila de `error_logs` tal como se muestra en la app. */
export type ErrorLogEntry = {
  id: number;
  level: ErrorLogLevel;
  scope: string;
  action: string;
  message: string;
  occurrences: number;
  firstSeenAt: number;
  lastSeenAt: number;
};

/** Datos mínimos para registrar un suceso. */
export type ErrorLogInput = {
  level: ErrorLogLevel;
  /** Módulo/servicio/pantalla donde ocurrió (ej. "audio-engine"). */
  scope: string;
  /** Operación en curso (ej. "setActiveForLockScreen"). */
  action: string;
  message: string;
};
