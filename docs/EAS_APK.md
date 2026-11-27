# APK de producción con EAS

Guion operativo para generar el APK firmado de `Music` cuando haya cupo en EAS.
El código y la configuración ya están listos; **no falta cambiar nada antes del
build** salvo ejecutar la verificación y lanzar el comando.

## Estado al 2026-11-27

| Dato | Valor |
|---|---|
| Cuenta EAS | `abeladoor` (`danielprograming1945@gmail.com`) |
| Proyecto | `mi-music-player` |
| Paquete Android | `com.abelo.mimusicplayer` (idéntico al dev build: conserva la biblioteca) |
| Perfil | `production` → `channel: production`, `autoIncrement: true`, `android.buildType: apk` |
| Keystore | Remoto, «Build Credentials kEwcTAH6KA (default)» |
| Último intento | 2026-11-26: rechazado por cupo agotado del plan Free |
| Reinicio del cupo | **2026-12-01** (Tue Dec 01 2026) |
| `versionCode` | EAS incrementó de 8 a 9 en el servidor durante el intento fallido; con `autoIncrement` el próximo build puede tomar el 10. Comprobarlo en el dashboard antes de publicar. |

> El cupo es el único bloqueo. No es un error de firma ni de configuración.

## Prerrequisitos

1. Estar logueado con la cuenta correcta:

   ```bash
   npx eas-cli@latest whoami
   # debe mostrar: abeladoor
   ```

2. Árbol limpio y verificación en verde (ya ejecutada antes de publicar, pero
   repetirla si ha pasado tiempo):

   ```bash
   npm run verify
   ```

3. Confirmar el perfil en `eas.json`:

   ```json
   "production": {
     "autoIncrement": true,
     "channel": "production",
     "android": { "buildType": "apk" }
   }
   ```

## Generar el APK

```bash
npm run build:apk
# equivalente:
npx eas-cli@latest build -p android --profile production --non-interactive --wait
```

`--wait` mantiene la terminal abierta y muestra la URL del artefacto al terminar.
Si se prefiere no esperar, quitar `--wait` y consultar el estado con:

```bash
npx eas-cli@latest build:list --platform android --limit 3
```

## Después del build

1. Descargar el APK desde la URL del artefacto que imprime EAS.
2. Instalar sobre la build anterior conservando datos:

   ```bash
   adb install -r <ruta-del-apk.apk>
   ```

3. Comprobar en el dispositivo `09729372AM004325`:
   - Abrir la app y confirmar que la biblioteca conserva las canciones.
   - Reproducir una canción con letra y verificar la vista previa bajo la
     carátula; al tocarla debe abrirse la letra completa.
   - Revisar que el acento del tema Oscuro es `#FF3D1F`.
   - Si las letras no aparecen, ejecutar **Volver a escanear**: las filas
     escaneadas antes de la migración V13 tienen `songs.lyrics = NULL`.

> Un APK de producción **no se conecta a Metro**: es normal que no cargue el
> bundle del dev server. Para depurar con Metro usa el dev build
> `com.abelo.mimusicplayer` con `npx expo start --dev-client`.

## Alternativa local (solo para pruebas)

```bash
$env:ANDROID_HOME='C:\Users\abelo\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
cd android
.\gradlew.bat assembleRelease --no-daemon
```

El APK resultante queda en `android/app/build/outputs/apk/release/`. Está firmado
con `signingConfigs.debug` (ver `android/app/build.gradle`), por lo que es
instalable y útil para probar, pero **no apto para Play Store**. Tampoco debe
sustituir al build de EAS en una entrega.

## Problemas conocidos

- **«This account has used its Android builds from the Free plan this month»**:
  esperar al reinicio del cupo o cambiar de plan. No hay workaround local que
  produzca un APK con la firma de release.
- **Fingerprint / «Project fingerprint changed»**: ejecutar el build desde el
  mismo commit publicado y con `npm install` limpio; no editar `android/` a mano.
- **Cambios solo de JavaScript**: se podrían enviar con
  `npx eas-cli@latest update --channel production --message "..."`, pero el
  cambio de icono en `app.json` es nativo y **exige APK nuevo**; un OTA no lo
  aplica.
- **Cierre de Metro por timeout**: no afecta al build EAS; el servidor se
  reinicia con `npx expo start --dev-client`.

## Checklist rápido

- [ ] `npx eas-cli@latest whoami` → `abeladoor`
- [ ] `npm run verify` en verde
- [ ] Cupo disponible (desde el 2026-12-01)
- [ ] `npm run build:apk`
- [ ] Descargar artefacto y `adb install -r`
- [ ] Verificar biblioteca, letras y tema oscuro en el móvil
- [ ] Anotar `versionCode`, URL del artefacto y mensaje del build
