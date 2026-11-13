import * as Updates from 'expo-updates';

export type UpdateCheckStatus = 'available' | 'not-available' | 'disabled';

/** Consulta si EAS tiene una actualización OTA para esta versión. */
export async function checkForAppUpdate(): Promise<UpdateCheckStatus> {
  if (__DEV__ || !Updates.isEnabled) {
    return 'disabled';
  }

  const result = await Updates.checkForUpdateAsync();

  return result.isAvailable ? 'available' : 'not-available';
}

/** Descarga la actualización disponible sin aplicarla todavía. */
export async function downloadAppUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) {
    throw new Error(
      'Las actualizaciones OTA no están disponibles en este entorno.'
    );
  }

  const result = await Updates.fetchUpdateAsync();

  if (!result.isNew) {
    throw new Error('No se pudo descargar una nueva actualización.');
  }
}

/** Reinicia la app para aplicar la actualización descargada. */
export async function applyAppUpdate(): Promise<void> {
  await Updates.reloadAsync();
}
