import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

import { tr, type LiteralKey } from '@/i18n';
import { getCurrentLanguage } from '@/i18n/current-language';
import {
  applyAppUpdate,
  checkForAppUpdate,
  downloadAppUpdate,
} from '@/services/update.service';

/** Este hook se ejecuta una vez al arrancar: lee el idioma del espejo al mostrar cada aviso. */
function tx(key: LiteralKey): string {
  return tr(getCurrentLanguage(), key);
}

/**
 * Comprueba actualizaciones OTA una vez al arrancar y ofrece descargarlas.
 * En web no aplica (expo-updates solo funciona en builds nativos).
 */
export function useAppUpdatePrompt() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;

    async function downloadAndApply() {
      try {
        await downloadAppUpdate();

        Alert.alert(
          tx('Actualización descargada'),
          tx('La actualización está lista. Reinicia la aplicación para aplicar los cambios.'),
          [
            {
              text: tx('Reiniciar ahora'),
              onPress: () => {
                void applyAppUpdate().catch((error) => {
                  console.error('Error aplicando actualización:', error);
                });
              },
            },
            {
              text: tx('Después'),
              style: 'cancel',
            },
          ]
        );
      } catch (error) {
        console.error('Error descargando actualización:', error);

        Alert.alert(
          tx('Error'),
          tx('No se pudo descargar la actualización. Inténtalo nuevamente.')
        );
      }
    }

    async function checkUpdate() {
      try {
        const status = await checkForAppUpdate();

        if (!isMounted || status !== 'available') {
          return;
        }

        Alert.alert(
          tx('Actualización disponible'),
          tx('Hay una nueva versión del reproductor. ¿Deseas descargarla?'),
          [
            {
              text: tx('Más tarde'),
              style: 'cancel',
            },
            {
              text: tx('Actualizar'),
              onPress: () => {
                void downloadAndApply();
              },
            },
          ]
        );
      } catch (error) {
        console.error('Error comprobando actualizaciones:', error);
      }
    }

    void checkUpdate();

    return () => {
      isMounted = false;
    };
  }, []);
}
