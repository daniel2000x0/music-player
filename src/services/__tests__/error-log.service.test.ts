import { errorLogRepository } from '@/data/repositories/error-log.repository';
import { logError, logWarning } from '@/services/error-log.service';

/**
 * Registro de errores (`FASE 7`).
 *
 * `emit` es fire-and-forget: el repositorio se sustituye por un doble que
 * permite forzar un rechazo y comprobar la degradación a `console.warn`. Se
 * fija `__DEV__` para que las impresiones de desarrollo sean deterministas.
 */

jest.mock('@/data/repositories/error-log.repository', () => ({
  errorLogRepository: {
    record: jest.fn(async () => undefined),
  },
}));

const mockedRecord = jest.mocked(errorLogRepository.record);
const devGlobal = globalThis as typeof globalThis & { __DEV__: boolean };
const ORIGINAL_DEV = devGlobal.__DEV__;

/** Espera a que se resuelva la cadena de promesas disparada sin `await`. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  jest.clearAllMocks();
  devGlobal.__DEV__ = true;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  devGlobal.__DEV__ = ORIGINAL_DEV;
});

describe('logError: envío al repositorio', () => {
  it('registra el nivel, el ámbito, la acción y el mensaje del Error', async () => {
    logError('audio/session', 'start', new Error('no se pudo iniciar'));
    await flushMicrotasks();

    expect(mockedRecord).toHaveBeenCalledWith({
      level: 'error',
      scope: 'audio/session',
      action: 'start',
      message: 'no se pudo iniciar',
    });
  });

  it('usa el nombre del Error cuando no tiene mensaje', async () => {
    const error = new Error();
    error.message = '';

    logError('scope', 'action', error);
    await flushMicrotasks();

    expect(mockedRecord).toHaveBeenCalledWith(expect.objectContaining({ message: 'Error' }));
  });

  it('convierte strings y objetos a mensaje legible', async () => {
    logError('scope', 'string', 'fallo simple');
    logError('scope', 'objeto', { code: 42, reason: 'disco' });
    await flushMicrotasks();

    expect(mockedRecord.mock.calls.map(([entry]) => entry.message)).toEqual([
      'fallo simple',
      '{"code":42,"reason":"disco"}',
    ]);
  });

  it('cae a String(error) si el objeto no se puede serializar', async () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    logError('scope', 'circular', circular);
    await flushMicrotasks();

    expect(mockedRecord).toHaveBeenCalledWith(
      expect.objectContaining({ message: '[object Object]' })
    );
  });
});

describe('logWarning: nivel y avisos en desarrollo', () => {
  it('registra el aviso con nivel warning y lo imprime por console.info', async () => {
    logWarning('media-service', 'collectPages', 'offset ignorado');
    await flushMicrotasks();

    expect(mockedRecord).toHaveBeenCalledWith({
      level: 'warning',
      scope: 'media-service',
      action: 'collectPages',
      message: 'offset ignorado',
    });
    expect(console.info).toHaveBeenCalledWith(
      '[warning] media-service · collectPages: offset ignorado'
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('no imprime nada en producción', async () => {
    devGlobal.__DEV__ = false;

    logError('scope', 'action', 'fallo');
    await flushMicrotasks();

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(mockedRecord).toHaveBeenCalledTimes(1);
  });
});

describe('truncamiento del mensaje', () => {
  it('recorta a 500 caracteres y añade elipsis', async () => {
    logError('scope', 'largo', 'x'.repeat(600));
    await flushMicrotasks();

    const message = mockedRecord.mock.calls[0][0].message;
    expect(message).toHaveLength(501);
    expect(message).toBe(`${'x'.repeat(500)}…`);
  });

  it('deja intacto un mensaje de exactamente 500 caracteres', async () => {
    logWarning('scope', 'limite', 'y'.repeat(500));
    await flushMicrotasks();

    expect(mockedRecord.mock.calls[0][0].message).toBe('y'.repeat(500));
  });
});

describe('degradación si falla el registro', () => {
  it('no lanza y avisa por console.warn si el repositorio rechaza', async () => {
    const failure = new Error('base de datos cerrada');
    mockedRecord.mockRejectedValueOnce(failure);

    await expect(
      Promise.resolve().then(() => logError('scope', 'action', 'fallo'))
    ).resolves.toBeUndefined();
    await flushMicrotasks();

    expect(console.warn).toHaveBeenCalledWith('[error-log] no se pudo registrar:', failure);
  });
});
