# DOCUMENTO DE REQUISITOS DE SOFTWARE (SRS)
## Aplicación móvil de reproducción y administración musical

**Versión:** 1.2  
**Estado:** Especificación alineada con la implementación actual  
**Plataforma:** Android / iOS  
**Framework:** React Native + Expo  
**Lenguaje:** TypeScript  
**Base de datos:** SQLite  
**Arquitectura:** Local-first  
**Conectividad:** No requerida para las funcionalidades principales.

---

# 1. Descripción general

## 1.1. Propósito

Desarrollar una aplicación móvil ligera para reproducir y administrar una biblioteca musical almacenada localmente en el dispositivo.

La aplicación permitirá organizar canciones, álbumes, artistas, playlists y audiolibros, además de administrar favoritos, historial de reproducción y preferencias del usuario.

Se priorizará una arquitectura sencilla, eficiente, modular y escalable, evitando dependencias externas y servicios innecesarios.

## 1.2. Objetivos

- Reproducir archivos de audio locales.
- Administrar una biblioteca musical.
- Crear y administrar playlists.
- Gestionar canciones favoritas.
- Registrar historial y estadísticas de reproducción.
- Incorporar filtros y ordenamientos.
- Proporcionar una interfaz moderna y ligera.
- Mantener toda la información administrativa mediante SQLite.
- Permitir personalizar la apariencia con dos temas: claro y oscuro.

# 2. Arquitectura tecnológica

| Componente | Tecnología |
|---|---|
| Aplicación móvil | React Native |
| Entorno de desarrollo | Expo |
| Lenguaje | TypeScript |
| Navegación | Expo Router |
| Persistencia | Expo SQLite |
| Estado global | Zustand |
| Reproducción de audio | Expo Audio |
| Estilos | StyleSheet / componentes reutilizables |

## 2.1. Arquitectura local

La aplicación no contará con un servidor backend.

SQLite funcionará como almacenamiento persistente local para los datos administrativos.

Los archivos musicales permanecerán en el almacenamiento del dispositivo. La aplicación utilizará sus URI o identificadores de acceso para reproducirlos.

## 2.2. Separación de responsabilidades

- **Presentation:** pantallas, componentes y navegación.
- **Domain:** reglas de negocio y casos de uso.
- **Data:** repositorios y acceso a SQLite.
- **Services:** reproducción de audio y exploración de biblioteca.
- **Store:** administración del estado global.

# 3. Requisitos funcionales

## RF-001. Biblioteca musical

El sistema permitirá explorar los archivos musicales disponibles en el dispositivo.

- Detectar archivos de audio compatibles.
- Obtener metadatos disponibles.
- Mostrar título, artista, álbum y duración.
- Mostrar portada cuando esté disponible.
- Registrar la fecha de incorporación a la biblioteca.
- Clasificar contenido largo como audiolibro y permitir reclasificación manual.
- Actualizar la biblioteca.
- Evitar registros duplicados.
- Identificar archivos inaccesibles o eliminados.
- Mantener los datos administrativos en SQLite.

## RF-002. Reproductor musical

- Reproducir y pausar.
- Cambiar a la canción siguiente o anterior.
- Controlar la posición de reproducción.
- Mostrar tiempo transcurrido y duración.
- Reproducción aleatoria.
- Repetición de canción.
- Repetición de lista.
- Reproducción en segundo plano, cuando sea compatible con la configuración nativa.
- Mantener los controles de reproducción durante la navegación.

## RF-003. Pantalla de inicio

Será la pantalla predeterminada.

Contendrá las siguientes secciones:

1. Resumen de la biblioteca (canciones, álbumes y playlists).
2. Accesos rápidos (favoritos, más escuchadas, recientes).
3. Últimas reproducidas.
4. Más escuchadas.
5. Álbumes recientes.
6. Playlists del usuario.
7. Acceso rápido a la biblioteca.

Cada sección permitirá visualizar una selección de elementos y acceder al listado completo.

Las playlists automáticas se consultan desde la pestaña Playlists.

## RF-004. Biblioteca y categorías

La biblioteca tendrá las siguientes categorías:

- Canciones.
- Álbumes.
- Artistas.
- Audiolibros.
- Playlists.
- Favoritos.

Cada categoría tendrá su propio listado y opciones de ordenamiento.

Los artistas se consultan dentro de la pestaña Álbumes y los favoritos como vista de la pestaña Canciones.

## RF-005. Favoritos

- Marcar canciones como favoritas.
- Quitar canciones de favoritos.
- Consultar favoritos.
- Reproducir todos los favoritos.
- Ordenar favoritos.
- Guardar permanentemente los cambios en SQLite.

## RF-006. Playlists

### Playlists manuales

- Crear listas.
- Asignar nombres.
- Agregar canciones.
- Eliminar canciones.
- Reordenar canciones.
- Eliminar listas.
- Reproducir listas completas.

### Playlists automáticas

Se generarán automáticamente:

- Más escuchadas.
- Favoritos.
- Últimas reproducidas.
- Agregadas recientemente.
- Reproducción aleatoria.
- Sin reproducir.

El contenido de estas listas se calculará a partir de la información almacenada en SQLite.

## RF-007. Filtros y ordenamientos

Se permitirá ordenar y filtrar los elementos de la biblioteca.

### Canciones

- Duración ascendente.
- Duración descendente.
- Fecha agregada: reciente a antigua.
- Fecha agregada: antigua a reciente.
- Nombre A-Z.
- Nombre Z-A.
- Artista A-Z / Z-A.
- Álbum A-Z / Z-A.
- Reproducciones: mayor a menor.
- Reproducciones: menor a mayor.
- Última reproducción: reciente a antigua.
- Última reproducción: antigua a reciente.

### Álbumes

- Nombre A-Z / Z-A.
- Artista A-Z / Z-A.
- Fecha agregada.
- Cantidad de canciones.
- Duración total.

### Artistas

- Nombre A-Z / Z-A.
- Cantidad de canciones.
- Cantidad de álbumes.
- Última reproducción.

### Playlists

- Nombre A-Z / Z-A.
- Fecha de creación.
- Cantidad de canciones.

### Filtros adicionales

- Favoritos.
- Reproducidas.
- No reproducidas.
- Por artista.
- Por álbum.
- Por rango de duración (soporte de dominio; interfaz pendiente).

Los filtros y ordenamientos podrán combinarse cuando sean compatibles.

## RF-008. Búsqueda

La búsqueda se ofrecerá dentro de las pestañas correspondientes:

- Canciones: por título, artista o álbum.
- Álbumes: por título de álbum o artista.
- Audiolibros: por título o autor.

Los resultados se actualizarán conforme el usuario introduzca texto, con una breve demora (debounce) para no filtrar en cada tecla.

La búsqueda de playlists queda como evolución futura.

## RF-009. Cola de reproducción

- Consultar cola.
- Agregar canciones.
- Reproducir a continuación.
- Eliminar elementos.
- Reordenar canciones.
- Vaciar cola.
- Activar reproducción aleatoria.
- Activar repetición.

## RF-010. Historial de reproducción

El sistema registrará:

- Identificador de canción.
- Fecha y hora de reproducción.
- Número de reproducciones.
- Última reproducción.

Se definirá un tiempo mínimo de reproducción para contabilizar una escucha válida.

## RF-011. Configuración

La aplicación tendrá un apartado de configuración sencillo.

### Apariencia

Se permitirán exclusivamente dos temas:

**Tema claro**
- Fondo claro.
- Textos oscuros.
- Superficies claras.
- Iconografía adaptada.

**Tema oscuro**
- Fondo oscuro.
- Textos claros.
- Superficies oscuras.
- Iconografía adaptada.

El usuario podrá cambiar entre ambos temas manualmente.

La preferencia seleccionada deberá almacenarse en SQLite y mantenerse después de cerrar la aplicación.

### Información de la aplicación

Se mostrará:

- Nombre de la aplicación.
- Versión instalada.
- Información general.
- Tecnologías utilizadas.
- Información de derechos de autor, cuando corresponda.

### Administración de biblioteca

- Actualizar biblioteca musical.
- Consultar permisos de acceso.
- Mostrar información básica de la biblioteca.

### Administración de datos

- Limpiar historial de reproducción.
- Eliminar información administrativa de la aplicación mediante una acción explícita de confirmación.

La eliminación de información administrativa no deberá eliminar los archivos musicales originales.

### Diagnóstico

- Consultar el registro local de errores y advertencias de la aplicación.

## RF-012. Audiolibros

- Clasificar automáticamente contenido largo durante el escaneo.
- Marcar canciones como audiolibro desde su menú de opciones.
- Remover la clasificación: los capítulos vuelven a la pestaña Canciones.
- Consultar los audiolibros en una pestaña propia, agrupados por libro.
- Buscar audiolibros por título o autor.
- Reproducir un libro completo con sus capítulos.
- Persistir la clasificación, incluida la marca manual, en SQLite.

## RF-013. Registro de errores

- Registrar errores y advertencias con contexto (módulo y acción en curso).
- Deduplicar errores repetidos con contador y fecha de última ocurrencia.
- Consultar el registro desde Configuración → Diagnóstico.

# 4. Requisitos no funcionales

## RNF-001. Rendimiento

- Navegación fluida.
- Consultas SQLite optimizadas.
- Uso de índices para consultas frecuentes.
- Renderizado eficiente de listas.
- Evitar cargar toda la biblioteca en memoria.
- Procesar filtros y ordenamientos eficientemente.

## RNF-002. Ligereza

- Evitar dependencias innecesarias.
- Utilizar componentes reutilizables.
- Minimizar operaciones de lectura y escritura.
- Optimizar imágenes de portada.
- Evitar procesos en segundo plano innecesarios.
- Mantener una arquitectura sencilla.

## RNF-003. Persistencia

SQLite almacenará:

- Favoritos.
- Playlists manuales.
- Canciones asociadas a playlists.
- Historial.
- Estadísticas de reproducción.
- Preferencias del usuario.
- Metadatos administrativos de la biblioteca.

## RNF-004. Disponibilidad

Las funcionalidades principales deberán funcionar sin conexión a Internet.

## RNF-005. Compatibilidad

- Android e iOS.
- Compatibilidad con Expo.
- Uso de módulos nativos compatibles con el entorno de compilación.
- Validación de funcionalidades avanzadas mediante Development Builds cuando sea necesario.

## RNF-006. Seguridad

- Solicitar permisos mínimos.
- No almacenar credenciales innecesarias.
- No recopilar información personal.
- Evitar acceso no autorizado a archivos.
- Proteger las operaciones de eliminación de datos.

## RNF-007. Mantenibilidad

- TypeScript.
- Separación de responsabilidades.
- Código modular.
- Repositorios para acceso a datos.
- Componentes reutilizables.
- Migraciones de base de datos.
- Manejo centralizado de errores.

## RNF-008. Interfaz

- Diseño adaptable.
- Tema claro y oscuro.
- Navegación intuitiva.
- Componentes visuales consistentes.
- Controles accesibles.
- Estados de carga, error y contenido vacío.

# 5. Estructura de navegación

La navegación principal estará compuesta por seis secciones:

1. Home.
2. Canciones.
3. Álbumes.
4. Audiolibros.
5. Playlists.
6. Configuración.

Los artistas se consultan dentro de la pestaña Álbumes; los favoritos, como vista de la pestaña Canciones.

Existen además pantallas de detalle fuera de las pestañas: álbum, artista, playlist, playlist automática, cola de reproducción, reproductor a pantalla completa y registro de errores.

El reproductor minimizado estará disponible durante la navegación cuando exista una reproducción activa.

# 6. Persistencia y base de datos

SQLite será responsable de almacenar los datos de administración de la aplicación.

Las entidades implementadas son:

- songs (incluye las columnas `is_audiobook` y `audiobook_manual`)
- artists
- albums
- favorites
- playlists
- playlist_songs
- playback_history (con segundos escuchados y marca de escucha válida)
- app_settings
- error_logs (registro local de errores y advertencias)

Las relaciones y restricciones de integridad deberán definirse durante el diseño de base de datos.

Los archivos de audio no se almacenarán dentro de SQLite.

# 7. Reglas de negocio

1. Una canción podrá estar asociada a múltiples playlists.
2. Una canción podrá ser favorita independientemente de las playlists.
3. Las playlists automáticas se generarán mediante consultas y criterios predefinidos.
4. Los favoritos deberán mantenerse después de reiniciar la aplicación.
5. El historial deberá registrar reproducciones válidas.
6. Las fechas de incorporación corresponderán al primer registro realizado por la aplicación, salvo que exista un dato fiable diferente.
7. Los filtros no modificarán los registros originales.
8. Los cambios de tema deberán aplicarse inmediatamente.
9. La eliminación del historial no eliminará favoritos ni playlists.
10. La eliminación de información administrativa no deberá eliminar archivos originales.
11. Un audiolibro se oculta de la pestaña Canciones y no cuenta en los resúmenes musicales de Home.
12. La clasificación manual de audiolibros persistirá entre escaneos.

# 8. Restricciones del proyecto

- No se utilizará un backend remoto.
- No se implementará autenticación de usuarios.
- No se utilizarán servicios de streaming.
- No se implementará sincronización en la nube.
- No se implementarán sistemas de suscripción.
- No se incorporarán funcionalidades innecesarias en configuración.
- No se almacenarán archivos musicales en la base de datos.

# 9. Criterios de aceptación

La primera versión deberá cumplir con lo siguiente:

- Detectar y mostrar canciones locales.
- Reproducir y controlar canciones.
- Mostrar información de canciones, artistas y álbumes.
- Gestionar favoritos.
- Crear y administrar playlists.
- Generar playlists automáticas.
- Clasificar y reproducir audiolibros.
- Filtrar y ordenar por duración.
- Filtrar y ordenar por fecha agregada.
- Ordenar alfabéticamente.
- Consultar historial.
- Guardar información administrativa en SQLite.
- Mantener los datos después de reiniciar la aplicación.
- Permitir alternar entre tema claro y oscuro.
- Funcionar sin conexión a Internet.

# 10. Evolución futura

Las siguientes funcionalidades quedan fuera de la primera versión:

- Ecualizador.
- Temporizador de apagado.
- Widgets.
- Estadísticas avanzadas.
- Letras de canciones.
- Integración con servicios externos.
- Sincronización en la nube.

# 11. Conclusión

El producto será un reproductor musical local, ligero y modular.

Su principal responsabilidad será ofrecer una experiencia de reproducción y administración de música, utilizando SQLite como mecanismo de persistencia local.

La prioridad del desarrollo será mantener una arquitectura sencilla, un consumo reducido de recursos y una experiencia de usuario consistente, dejando espacio para futuras ampliaciones sin introducir complejidad prematura.