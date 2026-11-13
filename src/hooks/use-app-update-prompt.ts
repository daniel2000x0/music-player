import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

import {
  applyAppUpdate,
  checkForAppUpdate,
  downloadAppUpdate,
} from '@/services/update.service';

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
          'Actualización descargada',
          'La actualización está lista. Reinicia la aplicación para aplicar los cambios.',
          [
            {
              text: 'Reiniciar ahora',
              onPress: () => {
                void applyAppUpdate().catch((error) => {
                  console.error('Error aplicando actualización:', error);
                });
              },
            },
            {
              text: 'Después',
              style: 'cancel',
            },
          ]
        );
      } catch (error) {
        console.error('Error descargando actualización:', error);

        Alert.alert(
          'Error',
          'No se pudo descargar la actualización. Inténtalo nuevamente.'
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
          'Actualización disponible',
          'Hay una nueva versión del reproductor. ¿Deseas descargarla?',
          [
            {
              text: 'Más tarde',
              style: 'cancel',
            },
            {
              text: 'Actualizar',
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
