# Use Cases — Aplicación de Reproducción Musical

**Versión:** 1.1  
**Estado:** Alineado con la implementación actual  
**Documento relacionado:** `SRS.md`

## 1. Introducción

Este documento describe los casos de uso de la aplicación móvil de reproducción musical.

Define las interacciones entre el usuario y el sistema, los flujos principales, las condiciones previas y los resultados esperados.

## 2. Actores

### ACT-001. Usuario

Persona que utiliza la aplicación para consultar, reproducir y administrar su biblioteca musical.

### ACT-002. Sistema operativo

Proporciona acceso autorizado a los archivos de audio, almacenamiento del dispositivo y funcionalidades nativas de reproducción.

## 3. Casos de uso principales

### UC-001. Inicializar aplicación

**Actor:** Usuario.

**Objetivo:** Iniciar la aplicación y recuperar la información almacenada.

**Precondiciones:**
- La aplicación está instalada.
- La base de datos local está disponible.

**Flujo principal:**
1. El usuario abre la aplicación.
2. El sistema inicializa SQLite.
3. El sistema recupera preferencias, biblioteca, favoritos, playlists e historial desde la base local.
4. El sistema aplica el tema seleccionado.
5. El sistema muestra Home de inmediato con la biblioteca persistida.
6. Si el permiso de audio está concedido, el sistema re-escanea la mediateca en segundo plano y actualiza la biblioteca al terminar.

**Flujos alternativos:**
- Si no existen datos, se muestra una biblioteca vacía.
- Si no existen permisos, se solicita autorización cuando sea necesario.
- Si ocurre un error de base de datos, se informa al usuario sin cerrar inesperadamente la aplicación.

**Postcondición:** La aplicación queda preparada para utilizarse.

### UC-002. Explorar biblioteca musical

**Actor:** Usuario.

**Objetivo:** Consultar los archivos musicales disponibles.

**Precondiciones:**
- El usuario ha otorgado los permisos necesarios.

**Flujo principal:**
1. El usuario accede a la biblioteca.
2. El sistema consulta los archivos de audio disponibles.
3. El sistema identifica los metadatos.
4. El sistema registra o actualiza los elementos en SQLite.
5. El sistema muestra las canciones organizadas.

**Flujos alternativos:**
- Si no hay canciones, muestra un estado vacío.
- Si faltan metadatos, muestra la información disponible.
- Si un archivo ya existe, evita duplicarlo.
- Si un archivo deja de estar disponible, lo identifica como inaccesible.

**Postcondición:** La biblioteca queda disponible para su consulta.

### UC-003. Reproducir canción

**Actor:** Usuario.

**Objetivo:** Reproducir una canción seleccionada.

**Precondiciones:**
- La canción está disponible.
- El archivo es compatible.

**Flujo principal:**
1. El usuario selecciona una canción.
2. El sistema verifica el acceso al archivo.
3. El sistema inicializa el reproductor.
4. El sistema comienza la reproducción.
5. El sistema muestra el reproductor minimizado.
6. El sistema actualiza el progreso.
7. El sistema registra la reproducción cuando cumple el umbral establecido.

**Flujos alternativos:**
- Si el archivo no está disponible, informa del problema.
- Si el formato no es compatible, informa que no puede reproducirse.
- Si ocurre un error de audio, detiene la operación de forma controlada.

**Postcondición:** La canción queda reproduciéndose o se informa del error.

### UC-004. Administrar reproducción

**Actor:** Usuario.

**Objetivo:** Controlar la reproducción musical.

**Flujo principal:**
1. El usuario accede al reproductor.
2. El sistema muestra la canción actual.
3. El usuario puede pausar o reanudar.
4. El usuario puede avanzar o retroceder.
5. El usuario puede modificar el progreso.
6. El sistema actualiza el estado del reproductor.

**Flujos alternativos:**
- Si la cola está vacía, no se permite avanzar a otra canción.
- Si una canción siguiente no está disponible, el sistema la omite de manera controlada.

### UC-005. Administrar favoritos

**Actor:** Usuario.

**Objetivo:** Agregar o quitar canciones de favoritos.

**Flujo principal:**
1. El usuario selecciona una canción.
2. El usuario activa la opción de favoritos.
3. El sistema registra el cambio en SQLite.
4. El sistema actualiza la interfaz.
5. La canción aparece o desaparece de favoritos según corresponda.

**Postcondición:** Los favoritos quedan actualizados.

### UC-006. Crear playlist

**Actor:** Usuario.

**Objetivo:** Crear una lista de reproducción personalizada.

**Precondiciones:** La aplicación está inicializada.

**Flujo principal:**
1. El usuario accede a Playlists.
2. Selecciona crear playlist.
3. Introduce el nombre.
4. El sistema valida el nombre.
5. El usuario selecciona las canciones.
6. El sistema registra la playlist.
7. El sistema registra las relaciones con las canciones.
8. El sistema muestra la nueva playlist.

**Flujos alternativos:**
- Si el nombre está vacío, solicita un nombre válido.
- Si no se seleccionan canciones, permite guardar una lista vacía.
- Si ocurre un error de almacenamiento, no confirma la operación.

**Postcondición:** La playlist queda almacenada en SQLite.

### UC-007. Editar playlist

**Actor:** Usuario.

**Objetivo:** Modificar una playlist existente.

**Flujo principal:**
1. El usuario selecciona una playlist.
2. El sistema muestra su contenido.
3. El usuario agrega, elimina o reordena canciones.
4. El sistema actualiza las relaciones en SQLite.
5. El sistema muestra los cambios.

**Postcondición:** La playlist queda actualizada.

### UC-008. Consultar playlists automáticas

**Actor:** Usuario.

**Objetivo:** Acceder a listas generadas por criterios musicales.

**Flujo principal:**
1. El usuario accede a Home o Playlists.
2. Selecciona una playlist automática.
3. El sistema consulta los datos correspondientes en SQLite.
4. El sistema genera el listado según el criterio.
5. El usuario selecciona una canción o reproduce toda la lista.

**Reglas:**
- Más escuchadas: orden por cantidad de reproducciones.
- Favoritos: canciones marcadas como favoritas.
- Últimas reproducidas: orden cronológico descendente.
- Agregadas recientemente: orden por fecha de incorporación.
- Aleatoria: selección aleatoria de canciones.
- Sin reproducir: canciones sin reproducciones válidas.

**Postcondición:** El usuario visualiza una lista actualizada.

### UC-009. Filtrar biblioteca

**Actor:** Usuario.

**Objetivo:** Encontrar canciones mediante filtros.

**Flujo principal:**
1. El usuario accede a Canciones.
2. Abre las opciones de filtrado.
3. Selecciona uno o varios criterios.
4. El sistema aplica los filtros.
5. El sistema muestra los resultados.
6. El usuario puede limpiar los filtros.

**Flujos alternativos:**
- Si no existen resultados, muestra un mensaje.
- Si se eliminan los filtros, vuelve a mostrar la colección completa.

### UC-010. Ordenar biblioteca

**Actor:** Usuario.

**Objetivo:** Ordenar los elementos de la biblioteca.

**Flujo principal:**
1. El usuario accede a una categoría.
2. Selecciona ordenar.
3. Elige un criterio.
4. Selecciona el sentido ascendente o descendente cuando corresponda.
5. El sistema ordena los resultados.
6. El sistema actualiza el listado.

**Criterios disponibles:**
- Duración.
- Fecha agregada.
- Nombre.
- Artista.
- Álbum.
- Número de reproducciones.
- Última reproducción.

### UC-011. Buscar música

**Actor:** Usuario.

**Objetivo:** Encontrar contenido musical.

**Flujo principal:**
1. El usuario abre el buscador.
2. Introduce un texto.
3. El sistema consulta los registros locales.
4. El sistema presenta resultados.
5. El usuario selecciona un resultado.

**Flujos alternativos:**
- Si no existen resultados, informa al usuario.
- Si el campo está vacío, muestra el estado inicial de búsqueda.

### UC-012. Administrar cola de reproducción

**Actor:** Usuario.

**Objetivo:** Modificar las canciones pendientes.

**Flujo principal:**
1. El usuario abre la cola.
2. El sistema muestra las canciones pendientes.
3. El usuario agrega, elimina o reordena canciones.
4. El sistema actualiza la cola.
5. La reproducción continúa según el nuevo orden.

### UC-013. Consultar historial

**Actor:** Usuario.

**Objetivo:** Consultar canciones reproducidas anteriormente.

**Flujo principal:**
1. El usuario accede a últimas reproducidas.
2. El sistema consulta el historial en SQLite.
3. El sistema ordena los registros por fecha.
4. El sistema muestra las canciones.
5. El usuario puede seleccionar una canción.

### UC-014. Cambiar tema visual

**Actor:** Usuario.

**Objetivo:** Modificar la apariencia de la aplicación.

**Flujo principal:**
1. El usuario accede a Configuración.
2. Selecciona Apariencia.
3. Selecciona tema claro u oscuro.
4. El sistema actualiza el tema global.
5. El sistema guarda la preferencia en SQLite.

**Postcondición:** La aplicación mantiene el tema seleccionado.

### UC-015. Administrar configuración

**Actor:** Usuario.

**Objetivo:** Consultar y administrar opciones básicas.

**Flujo principal:**
1. El usuario abre Configuración.
2. El sistema muestra información de la aplicación.
3. El usuario puede cambiar el tema.
4. El usuario puede actualizar la biblioteca.
5. El usuario puede consultar permisos.
6. El usuario puede limpiar el historial.
7. El sistema solicita confirmación para operaciones destructivas.

### UC-016. Actualizar biblioteca

**Actor:** Usuario.

**Objetivo:** Detectar nuevos archivos musicales o cambios en los existentes.

**Flujo principal:**
1. El usuario solicita actualizar biblioteca.
2. El sistema consulta las fuentes autorizadas.
3. El sistema detecta nuevos archivos.
4. El sistema actualiza metadatos.
5. El sistema identifica archivos inaccesibles.
6. El sistema actualiza los registros locales.
7. El sistema informa el resultado.

### UC-017. Administrar audiolibros

**Actor:** Usuario.

**Objetivo:** Separar audiolibros de la biblioteca musical.

**Flujo principal:**
1. El usuario marca canciones como audiolibro desde su menú de opciones, o el escaneo clasifica contenido largo automáticamente.
2. El sistema persiste la clasificación en SQLite.
3. El usuario consulta la pestaña Audiolibros.
4. El sistema muestra los libros agrupados con sus capítulos.
5. El usuario reproduce un libro o busca por título o autor.
6. El usuario puede remover la clasificación y los capítulos vuelven a Canciones.

**Postcondición:** La clasificación persiste entre sesiones y escaneos.

### UC-018. Consultar registro de errores

**Actor:** Usuario.

**Objetivo:** Revisar errores y advertencias de la aplicación.

**Flujo principal:**
1. El usuario abre Configuración.
2. Selecciona Diagnóstico → Registro de errores.
3. El sistema consulta la tabla local de errores.
4. El sistema muestra los errores con contexto, contador y última fecha.

## 4. Relaciones entre casos de uso

- UC-001 es el proceso inicial.
- UC-002 proporciona información a UC-003, UC-005, UC-006 y UC-011.
- UC-003 utiliza UC-004 para controlar la reproducción.
- UC-006 y UC-007 administran playlists manuales.
- UC-008 consulta favoritos, historial y estadísticas.
- UC-009 y UC-010 modifican la presentación de los listados, no los datos originales.
- UC-014 administra la preferencia visual.
- UC-016 mantiene actualizada la biblioteca.
- UC-017 administra la clasificación de audiolibros consumida por UC-002 y UC-003.
- UC-018 consulta el registro de errores generado por el resto de casos de uso.

## 5. Consideraciones técnicas

- Las consultas de información se realizarán mediante repositorios SQLite.
- La reproducción se gestionará mediante un servicio independiente.
- Los cambios de estado se reflejarán en la interfaz.
- Las operaciones de escritura deberán mantener la integridad de la base de datos.
- Los archivos de audio no se almacenarán dentro de SQLite.
- La aplicación deberá gestionar permisos y archivos inaccesibles.