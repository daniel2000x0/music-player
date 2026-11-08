# User Stories — Aplicación de Reproducción Musical

**Versión:** 1.0  
**Estado:** Propuesta inicial  
**Documento relacionado:** `SRS.md`

## 1. Introducción

Este documento define las historias de usuario de la aplicación móvil de reproducción y administración musical.

Las historias describen las necesidades del usuario desde su perspectiva y establecen criterios de aceptación que permitirán verificar el correcto funcionamiento de cada funcionalidad.

## 2. Roles de usuario

La aplicación contempla un único tipo de usuario:

**Usuario local:** persona que utiliza la aplicación para reproducir y administrar su biblioteca musical almacenada en el dispositivo.

No se requiere autenticación ni registro de cuentas.

## 3. Historias de usuario

### US-001. Acceder a la biblioteca musical

**Como** usuario,  
**quiero** que la aplicación detecte los archivos de audio disponibles en mi dispositivo,  
**para** poder consultar y reproducir mi música.

Criterios de aceptación:

- El sistema debe solicitar los permisos necesarios para acceder a los archivos musicales.
- Debe detectar los archivos de audio compatibles.
- Debe mostrar título, artista, álbum y duración cuando los metadatos estén disponibles.
- Debe identificar canciones sin información completa.
- No debe registrar dos veces el mismo archivo.
- Debe informar cuando no existan canciones disponibles.

### US-002. Reproducir canciones

**Como** usuario,  
**quiero** reproducir canciones de mi biblioteca,  
**para** escuchar mi música desde la aplicación.

Criterios de aceptación:

- Debe permitir iniciar la reproducción.
- Debe permitir pausar y reanudar.
- Debe permitir avanzar y retroceder entre canciones.
- Debe mostrar el progreso de reproducción.
- Debe permitir desplazarse a una posición específica.
- Debe mostrar información de la canción actual.

### US-003. Consultar la pantalla de inicio

**Como** usuario,  
**quiero** visualizar un resumen de mi actividad musical al abrir la aplicación,  
**para** acceder rápidamente a mis canciones y listas habituales.

Criterios de aceptación:

- Home debe ser la pantalla predeterminada.
- Debe mostrar las canciones más escuchadas.
- Debe mostrar los favoritos.
- Debe mostrar las últimas reproducidas.
- Debe mostrar las canciones agregadas recientemente.
- Debe mostrar accesos a las playlists automáticas.
- Cada sección debe permitir consultar su contenido completo.

### US-004. Consultar canciones

**Como** usuario,  
**quiero** visualizar todas las canciones disponibles,  
**para** explorar mi biblioteca musical.

Criterios de aceptación:

- Debe mostrar un listado de canciones.
- Debe mostrar título, artista y duración.
- Debe permitir reproducir canciones individualmente.
- Debe permitir acceder a las opciones de ordenamiento.
- Debe permitir marcar canciones como favoritas.

### US-005. Consultar álbumes

**Como** usuario,  
**quiero** consultar los álbumes disponibles,  
**para** organizar y reproducir mi música por álbum.

Criterios de aceptación:

- Debe agrupar canciones por álbum.
- Debe mostrar nombre del álbum y artista.
- Debe mostrar portada cuando esté disponible.
- Debe permitir consultar las canciones de un álbum.
- Debe permitir reproducir un álbum completo.

### US-006. Consultar artistas

**Como** usuario,  
**quiero** consultar los artistas de mi biblioteca,  
**para** encontrar rápidamente su música.

Criterios de aceptación:

- Debe mostrar artistas disponibles.
- Debe agrupar las canciones correspondientes.
- Debe mostrar sus álbumes cuando exista información.
- Debe permitir reproducir todas las canciones de un artista.

### US-007. Administrar favoritos

**Como** usuario,  
**quiero** marcar y desmarcar canciones como favoritas,  
**para** mantener una colección de mi música preferida.

Criterios de aceptación:

- Debe permitir agregar canciones a favoritos.
- Debe permitir quitarlas de favoritos.
- Debe existir una sección para consultar favoritos.
- Debe permitir reproducir toda la colección.
- Los cambios deben persistir en SQLite.
- Los favoritos deben conservarse al reiniciar la aplicación.

### US-008. Crear playlists personalizadas

**Como** usuario,  
**quiero** crear playlists con mis canciones preferidas,  
**para** organizar mi música según mis gustos.

Criterios de aceptación:

- Debe permitir crear una playlist con un nombre.
- Debe permitir agregar canciones.
- Debe permitir eliminar canciones.
- Debe permitir cambiar el orden de las canciones.
- Debe permitir eliminar una playlist.
- Los cambios deben almacenarse en SQLite.

### US-009. Consultar playlists automáticas

**Como** usuario,  
**quiero** disponer de playlists generadas automáticamente,  
**para** acceder rápidamente a diferentes grupos de canciones.

Criterios de aceptación:

- Debe existir una playlist de más escuchadas.
- Debe existir una playlist de favoritos.
- Debe existir una playlist de últimas reproducidas.
- Debe existir una playlist de canciones agregadas recientemente.
- Debe existir una playlist aleatoria.
- Debe existir una playlist de canciones no reproducidas.
- Su contenido debe actualizarse según los datos disponibles.

### US-010. Filtrar canciones

**Como** usuario,  
**quiero** aplicar filtros a mi biblioteca musical,  
**para** encontrar canciones según características específicas.

Criterios de aceptación:

- Debe permitir filtrar por artista.
- Debe permitir filtrar por álbum.
- Debe permitir filtrar por rango de duración.
- Debe permitir mostrar solamente favoritos.
- Debe permitir mostrar canciones reproducidas.
- Debe permitir mostrar canciones no reproducidas.
- Debe permitir combinar filtros compatibles.
- Debe permitir limpiar los filtros aplicados.

### US-011. Ordenar canciones por duración

**Como** usuario,  
**quiero** ordenar las canciones por duración ascendente o descendente,  
**para** encontrar canciones cortas o largas fácilmente.

Criterios de aceptación:

- Ascendente: menor duración primero.
- Descendente: mayor duración primero.
- El orden debe aplicarse correctamente.
- Los filtros activos deben conservarse cuando sea posible.

### US-012. Ordenar canciones por fecha agregada

**Como** usuario,  
**quiero** ordenar las canciones según su fecha de incorporación,  
**para** consultar primero las canciones nuevas o antiguas.

Criterios de aceptación:

- Más recientes primero.
- Más antiguas primero.
- La fecha debe corresponder al registro inicial de la canción en la biblioteca.
- El orden debe ser consistente.

### US-013. Ordenar alfabéticamente

**Como** usuario,  
**quiero** ordenar canciones, álbumes, artistas y playlists alfabéticamente,  
**para** encontrar contenido fácilmente.

Criterios de aceptación:

- Debe permitir orden A-Z.
- Debe permitir orden Z-A.
- Debe funcionar en las categorías compatibles.
- Debe manejar correctamente nombres sin información.

### US-014. Buscar música

**Como** usuario,  
**quiero** buscar canciones, artistas, álbumes y playlists,  
**para** encontrar contenido sin recorrer toda la biblioteca.

Criterios de aceptación:

- Debe permitir buscar por título.
- Debe permitir buscar por artista.
- Debe permitir buscar por álbum.
- Debe permitir buscar por nombre de playlist.
- Debe mostrar resultados relacionados con el texto ingresado.
- Debe informar cuando no existan resultados.

### US-015. Administrar la cola de reproducción

**Como** usuario,  
**quiero** administrar las canciones pendientes de reproducción,  
**para** controlar el orden en que escucharé mi música.

Criterios de aceptación:

- Debe permitir consultar la cola.
- Debe permitir agregar canciones.
- Debe permitir reproducir una canción a continuación.
- Debe permitir eliminar canciones.
- Debe permitir cambiar el orden.
- Debe permitir vaciar la cola.

### US-016. Consultar el historial musical

**Como** usuario,  
**quiero** consultar las canciones reproducidas recientemente,  
**para** recuperar fácilmente música que escuché anteriormente.

Criterios de aceptación:

- Debe registrar reproducciones válidas.
- Debe almacenar fecha y hora.
- Debe actualizar el número de reproducciones.
- Debe mostrar las últimas reproducidas primero.
- Debe permitir limpiar el historial.

### US-017. Cambiar el tema visual

**Como** usuario,  
**quiero** seleccionar entre un tema claro y uno oscuro,  
**para** utilizar la aplicación con la apariencia que prefiera.

Criterios de aceptación:

- Debe existir un tema claro.
- Debe existir un tema oscuro.
- El cambio debe aplicarse inmediatamente.
- La preferencia debe guardarse en SQLite.
- El tema seleccionado debe mantenerse después de reiniciar la aplicación.
- Todos los componentes deben adaptarse al tema seleccionado.

### US-018. Consultar configuración e información

**Como** usuario,  
**quiero** acceder a una sección de configuración sencilla,  
**para** consultar información de la aplicación y administrar opciones básicas.

Criterios de aceptación:

- Debe mostrar el nombre de la aplicación.
- Debe mostrar la versión.
- Debe permitir cambiar el tema.
- Debe permitir actualizar la biblioteca.
- Debe mostrar información sobre permisos.
- Debe permitir limpiar el historial.
- Debe solicitar confirmación antes de eliminar información.

### US-019. Mantener los datos localmente

**Como** usuario,  
**quiero** que mis favoritos, playlists e historial permanezcan guardados,  
**para** no perder mi organización musical al cerrar la aplicación.

Criterios de aceptación:

- Los datos deben almacenarse en SQLite.
- Los datos deben recuperarse al iniciar la aplicación.
- Las operaciones deben mantener la integridad de la información.
- No debe requerirse conexión a Internet.

## 4. Priorización

Se utilizará el siguiente sistema:

- P0: imprescindible para la primera versión.
- P1: importante para completar la experiencia inicial.
- P2: mejora que puede incorporarse posteriormente.

| ID | Historia | Prioridad |
|---|---|---|
| US-001 | Biblioteca musical | P0 |
| US-002 | Reproducción | P0 |
| US-003 | Home | P0 |
| US-004 | Canciones | P0 |
| US-005 | Álbumes | P1 |
| US-006 | Artistas | P1 |
| US-007 | Favoritos | P0 |
| US-008 | Playlists manuales | P0 |
| US-009 | Playlists automáticas | P1 |
| US-010 | Filtros | P1 |
| US-011 | Orden por duración | P1 |
| US-012 | Orden por fecha | P1 |
| US-013 | Orden alfabético | P1 |
| US-014 | Búsqueda | P0 |
| US-015 | Cola de reproducción | P1 |
| US-016 | Historial | P0 |
| US-017 | Temas | P0 |
| US-018 | Configuración | P1 |
| US-019 | Persistencia | P0 |

## 5. Consideraciones

- Las historias deberán mantenerse alineadas con el documento `SRS.md`.
- Cada historia podrá convertirse en tareas técnicas.
- Los criterios de aceptación servirán como referencia para las pruebas.
- Las funcionalidades deberán implementarse progresivamente.
- No se deberán incorporar funcionalidades fuera del alcance sin actualizar la documentación.