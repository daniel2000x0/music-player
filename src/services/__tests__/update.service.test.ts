import {
  applyAppUpdate,
  checkForAppUpdate,
  downloadAppUpdate,
} from '@/services/update.service';

/**
 * Actualizaciones OTA (`FASE 7`).
 *
 * `update.service` es pura lógica de `expo-updates`: no importa UI ni muestra
 * avisos, así que quedan fuera de estas pruebas la pantalla que presenta el
 * diálogo y el texto que se enseña al usuario. Se cubren los estados devueltos,
 * los guardas de `__DEV__`/`isEnabled` y los errores de descarga.
 */

type UpdatesMock = {
  isEnabled: boolean;
  checkForUpdateAsync: jest.Mock;
  fetchUpdateAsync: jest.Mock;
  reloadAsync: jest.Mock;
};

jest.mock('expo-updates', () => ({
  __esModule: true,
  isEnabled: true,
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => undefined),
}));

const updates = jest.requireMock('expo-updates') as UpdatesMock;
const devGlobal = globalThis as typeof globalThis & { __DEV__: boolean };
const ORIGINAL_DEV = devGlobal.__DEV__;

function setUpdates({
  isEnabled = true,
  isAvailable = true,
  isNew = true,
}: {
  isEnabled?: boolean;
  isAvailable?: boolean;
  isNew?: boolean;
} = {}): void {
  updates.isEnabled = isEnabled;
  updates.checkForUpdateAsync.mockResolvedValue({ isAvailable });
  updates.fetchUpdateAsync.mockResolvedValue({ isNew });
}

beforeEach(() => {
  jest.clearAllMocks();
  devGlobal.__DEV__ = false;
  setUpdates();
});

afterEach(() => {
  devGlobal.__DEV__ = ORIGINAL_DEV;
});

describe('checkForAppUpdate', () => {
  it('devuelve available cuando EAS ofrece una actualización', async () => {
    setUpdates({ isAvailable: true });

    await expect(checkForAppUpdate()).resolves.toBe('available');
    expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('devuelve not-available cuando no hay nada nuevo', async () => {
    setUpdates({ isAvailable: false });

    await expect(checkForAppUpdate()).resolves.toBe('not-available');
  });

  it('devuelve disabled en desarrollo sin consultar EAS', async () => {
    devGlobal.__DEV__ = true;

    await expect(checkForAppUpdate()).resolves.toBe('disabled');
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('devuelve disabled si expo-updates no está habilitado', async () => {
    setUpdates({ isEnabled: false });

    await expect(checkForAppUpdate()).resolves.toBe('disabled');
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });
});

describe('downloadAppUpdate', () => {
  it('descarga la actualización sin aplicarla', async () => {
    setUpdates({ isNew: true });

    await expect(downloadAppUpdate()).resolves.toBeUndefined();
    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(updates.reloadAsync).not.toHaveBeenCalled();
  });

  it('rechaza si la descarga no trae una versión nueva', async () => {
    setUpdates({ isNew: false });

    await expect(downloadAppUpdate()).rejects.toThrow(
      'No se pudo descargar una nueva actualización.'
    );
  });

  it('rechaza en desarrollo y con expo-updates deshabilitado', async () => {
    devGlobal.__DEV__ = true;
    await expect(downloadAppUpdate()).rejects.toThrow(
      'Las actualizaciones OTA no están disponibles en este entorno.'
    );
    expect(updates.fetchUpdateAsync).not.toHaveBeenCalled();

    devGlobal.__DEV__ = false;
    setUpdates({ isEnabled: false });
    await expect(downloadAppUpdate()).rejects.toThrow(
      'Las actualizaciones OTA no están disponibles en este entorno.'
    );
  });
});

describe('applyAppUpdate', () => {
  it('reinicia la app para aplicar la descarga', async () => {
    await expect(applyAppUpdate()).resolves.toBeUndefined();
    expect(updates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('propaga un fallo del reinicio', async () => {
    updates.reloadAsync.mockRejectedValueOnce(new Error('no se pudo reiniciar'));

    await expect(applyAppUpdate()).rejects.toThrow('no se pudo reiniciar');
  });
});
