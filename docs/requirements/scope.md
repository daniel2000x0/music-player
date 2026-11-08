# Project Scope — Aplicación de Reproducción Musical

**Versión:** 1.0  
**Estado:** Propuesta inicial  
**Documento relacionado:** `SRS.md`

## 1. Propósito del proyecto

Definir el alcance funcional y técnico de una aplicación móvil de reproducción y administración musical desarrollada con React Native y Expo.

El proyecto busca proporcionar un reproductor local ligero, intuitivo y eficiente, que permita administrar una biblioteca musical sin depender de servicios externos.

## 2. Objetivo general

Desarrollar una aplicación móvil que permita reproducir, organizar y administrar archivos musicales almacenados en el dispositivo, proporcionando funcionalidades de búsqueda, filtros, ordenamientos, favoritos, playlists e historial.

## 3. Objetivos específicos

- Implementar una biblioteca musical local.
- Desarrollar un reproductor de audio.
- Organizar canciones por álbum y artista.
- Implementar playlists manuales y automáticas.
- Administrar favoritos.
- Registrar el historial de reproducción.
- Incorporar búsqueda y filtros.
- Permitir diferentes criterios de ordenamiento.
- Implementar configuración básica.
- Incorporar temas claro y oscuro.
- Mantener los datos administrativos mediante SQLite.

## 4. Alcance funcional

### 4.1. Administración de biblioteca

Incluye:

- Exploración de archivos de audio locales.
- Lectura de metadatos disponibles.
- Clasificación por canciones.
- Clasificación por álbumes.
- Clasificación por artistas.
- Detección de archivos duplicados.
- Actualización de biblioteca.

### 4.2. Reproducción musical

Incluye:

- Reproducir.
- Pausar.
- Reanudar.
- Siguiente canción.
- Canción anterior.
- Barra de progreso.
- Reproducción aleatoria.
- Repetición.
- Cola de reproducción.
- Reproductor minimizado y completo.

La reproducción en segundo plano y los controles del sistema estarán sujetos a las capacidades de los módulos nativos utilizados.

### 4.3. Administración musical

Incluye:

- Favoritos.
- Playlists manuales.
- Playlists automáticas.
- Historial.
- Número de reproducciones.
- Última reproducción.
- Fecha de incorporación.

### 4.4. Exploración y búsqueda

Incluye:

- Búsqueda por canción.
- Búsqueda por artista.
- Búsqueda por álbum.
- Búsqueda por playlist.
- Filtros por duración.
- Filtros por artista.
- Filtros por álbum.
- Filtros por favoritos.
- Filtros por estado de reproducción.

### 4.5. Ordenamiento

Incluye:

- Duración ascendente y descendente.
- Fecha agregada reciente y antigua.
- Nombre A-Z y Z-A.
- Artista A-Z y Z-A.
- Álbum A-Z y Z-A.
- Reproducciones mayor y menor.
- Última reproducción reciente y antigua.

### 4.6. Inicio

La pantalla Home incluirá:

- Más escuchadas.
- Favoritos.
- Últimas reproducidas.
- Agregadas recientemente.
- Playlists automáticas.
- Accesos a la biblioteca.

### 4.7. Configuración

La configuración será sencilla e incluirá:

- Tema claro.
- Tema oscuro.
- Información de la aplicación.
- Versión instalada.
- Actualización de biblioteca.
- Consulta de permisos.
- Limpieza del historial.

No se incorporarán configuraciones avanzadas de audio ni personalizaciones complejas en esta versión.

## 5. Alcance técnico

### Tecnologías

| Componente | Tecnología |
|---|---|
| Framework móvil | React Native |
| Entorno | Expo |
| Lenguaje | TypeScript |
| Navegación | Expo Router |
| Base de datos | SQLite |
| Estado global | Zustand |
| Audio | Expo Audio |

### Arquitectura

Se utilizará una arquitectura modular con separación de responsabilidades:

- Presentation.
- Domain.
- Data.
- Services.
- Store.

SQLite será el mecanismo de persistencia local.

No se desarrollará una API REST ni un servidor backend.

## 6. Fuera del alcance

Las siguientes funcionalidades no forman parte de la primera versión.

### Servicios externos

- Streaming musical.
- Integración con Spotify.
- Integración con YouTube Music.
- Reproducción desde servidores remotos.
- Descarga de canciones desde Internet.

### Gestión de usuarios

- Registro.
- Inicio de sesión.
- Autenticación.
- Perfiles.
- Sincronización de cuentas.

### Servicios en la nube

- Backend remoto.
- API REST propia.
- Sincronización entre dispositivos.
- Copias de seguridad en la nube.

### Funcionalidades avanzadas

- Ecualizador avanzado.
- Letras sincronizadas.
- Recomendaciones mediante inteligencia artificial.
- Temporizador de apagado.
- Widgets.
- Estadísticas avanzadas.
- Integración con Android Auto.

Estas funcionalidades podrán evaluarse en futuras versiones.

## 7. Restricciones

- La aplicación dependerá de los permisos de acceso a archivos del sistema operativo.
- Los formatos reproducibles dependerán de la compatibilidad del motor de audio.
- La información de metadatos dependerá de los archivos disponibles.
- La aplicación deberá funcionar sin conexión a Internet para las funcionalidades principales.
- Expo Go podrá utilizarse durante el desarrollo inicial, pero algunas capacidades nativas requerirán Development Builds.
- SQLite almacenará información administrativa, no archivos de audio.

## 8. Supuestos

- El usuario dispone de archivos de audio locales.
- El dispositivo permite acceder a los archivos mediante los permisos correspondientes.
- Los archivos contienen metadatos cuando sea posible.
- El almacenamiento local es suficiente para mantener la información administrativa.
- No se requiere sincronización entre dispositivos.

## 9. Entregables

### Entregables de software

- Aplicación móvil Android.
- Código fuente en TypeScript.
- Base de datos SQLite.
- Módulo de reproducción.
- Módulo de administración de biblioteca.
- Sistema de favoritos y playlists.
- Sistema de filtros y ordenamientos.
- Historial de reproducción.
- Configuración de temas.

### Entregables de documentación

- `README.md`.
- `SRS.md`.
- `user-stories.md`.
- `use-cases.md`.
- `scope.md`.
- `ARCHITECTURE.md`.
- `DATABASE.md`.
- `CODING_STANDARDS.md`.
- `TESTING.md`.

## 10. Fases de desarrollo propuestas

### Fase 1. Configuración inicial

- Inicialización de Expo.
- Configuración de TypeScript.
- Configuración de navegación.
- Estructura de carpetas.
- Configuración de SQLite.

### Fase 2. Biblioteca musical

- Acceso a archivos.
- Lectura de metadatos.
- Registro en SQLite.
- Clasificación por canciones, álbumes y artistas.

### Fase 3. Reproductor

- Servicio de audio.
- Controles.
- Cola de reproducción.
- Reproductor minimizado y completo.

### Fase 4. Administración musical

- Favoritos.
- Playlists manuales.
- Playlists automáticas.
- Historial.
- Estadísticas básicas.

### Fase 5. Exploración

- Búsqueda.
- Filtros.
- Ordenamientos.
- Pantalla Home.

### Fase 6. Configuración y calidad

- Tema claro.
- Tema oscuro.
- Información de aplicación.
- Pruebas.
- Optimización de rendimiento.

## 11. Criterios de finalización

La primera versión se considerará finalizada cuando:

1. Permita acceder a la biblioteca musical local.
2. Permita reproducir archivos de audio compatibles.
3. Permita administrar favoritos.
4. Permita crear y modificar playlists.
5. Genere playlists automáticas.
6. Registre historial de reproducción.
7. Disponga de búsqueda.
8. Disponga de filtros y ordenamientos.
9. Permita cambiar entre tema claro y oscuro.
10. Mantenga los datos administrativos mediante SQLite.
11. Funcione sin necesidad de un servidor backend.
12. Cumpla los requisitos funcionales y no funcionales establecidos en `SRS.md`.

## 12. Gestión de cambios

Cualquier funcionalidad nueva que modifique el alcance deberá:

- Evaluarse técnicamente.
- Determinar su impacto en la arquitectura.
- Actualizar el documento SRS.
- Actualizar las historias de usuario cuando corresponda.
- Actualizar los casos de uso cuando corresponda.
- Registrar los cambios de alcance.

## 13. Conclusión

El proyecto se centrará en desarrollar un reproductor musical local, ligero y modular.

La primera versión priorizará las funcionalidades esenciales de reproducción y administración musical, evitando servicios externos y funcionalidades que incrementen innecesariamente la complejidad.

El alcance definido servirá como referencia para la planificación, implementación y validación del software.