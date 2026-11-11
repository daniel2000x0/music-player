import { errorLogRepository } from '@/data/repositories/error-log.repository';
import type { ErrorLogInput } from '@/types/error-log';

/**
 * Registro persistente de errores y advertencias en SQLite.
 *
 * LÓGICA: fire-and-forget — nunca bloquea ni rompe al llamador. Si el
 * propio registro falla (p. ej. la base de datos aún no abrió), se
 * degrada a `console.warn` sin reintentar, evitando bucles infinitos.
 * En desarrollo además imprime en consola para facilitar el debugging.
 */

const MAX_MESSAGE_LENGTH = 500;

function truncate(message: string): string {
  return message.length > MAX_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_MESSAGE_LENGTH)}…`
    : message;
}

function emit(input: ErrorLogInput): void {
  const entry: ErrorLogInput = { ...input, message: truncate(input.message) };
  if (__DEV__) {
    const line = `[${entry.level}] ${entry.scope} · ${entry.action}: ${entry.message}`;
    if (entry.level === 'error') {
      console.warn(line);
    } else {
      console.info(line);
    }
  }
  void errorLogRepository
    .record(entry)
    .catch((error: unknown) => console.warn('[error-log] no se pudo registrar:', error));
}

/** Registra un error capturado, con mensaje legible del valor lanzado. */
export function logError(scope: string, action: string, error: unknown): void {
  emit({ level: 'error', scope, action, message: toMessage(error) });
}

/** Registra una advertencia (comportamiento degradado, fallo esperado...). */
export function logWarning(scope: string, action: string, message: string): void {
  emit({ level: 'warning', scope, action, message });
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
