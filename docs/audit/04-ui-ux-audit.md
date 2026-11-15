# 04 · Auditoría de UI/UX

**Alcance:** sistema de diseño, navegación, jerarquía visual, estados, accesibilidad, tematización y consistencia entre la app y el widget.
**Limitación:** esta auditoría es **estática** (código y configuración). No se dispone de dispositivo físico ni de capturas en esta sesión, por lo que los problemas puramente visuales se marcan como **riesgo** y quedan sujetos a verificación en la FASE 1/6 del roadmap.

---

## 1. Valoración general

La interfaz tiene una **base de diseño madura y consistente**: un sistema de tokens real, componentes reutilizables, pantallas homogéneas y una atención poco común a la accesibilidad (43 props `accessibility*`). No hay señales de «UI de prototipo».

Los problemas no son de estilo general, sino de **coherencia entre superficies** y de **comunicación de estado**:

1. El widget vive en una **paleta distinta** a la app (acento púrpura vs. verde).
2. El tema es **manual** pero el sistema se declara `automatic`, así que las superficies nativas no siempre acompañan.
3. La app **no comunica fallos**: el usuario ve pantallas vacías donde debería ver una causa.
4. El arranque en frío con bibliotecas grandes no tiene progreso granular.

---

## 2. Sistema de diseño

`src/constants/theme.ts` define:

| Token | Contenido | Valoración |
| --- | --- | --- |
| `Colors.light` / `Colors.dark` | `text`, `background`, `backgroundElement`, `backgroundSelected`, `textSecondary`, `border`, `accent`, `accentText`, `danger`, `scrollbarIndicator` | ✅ Completo y con paridad de claves |
| `Fonts` | `sans`, `serif`, `rounded`, `mono` por plataforma | ✅ Correcto; en Android todo cae a `default` |
| `Spacing` | 2, 4, 8, 16, 24, 32, 64 | ✅ Escala clara; falta 12, que se usa a mano en varios sitios |
| `Radius` | 8, 12, 20, pill | ✅ |
| `BottomTabInset` | iOS 50 / Android 80 | ✅ |
| `TabBarBaseHeight` | 49 | ✅ Documentado con precisión |
| `MaxContentWidth` | 800 | ✅ Para tablet/web |
| `ScrollbarGutter` | 12 | ✅ Detalle poco habitual y bien resuelto |

**Acento:** `#12B76A` (claro) / `#1ED760` (oscuro). **Verde**. Cualquier superficie que use otro acento rompe la identidad. Eso ocurre exactamente en el widget (§6).

### Componentes

23 componentes, con responsabilidades claras:

- **Estructura:** `ScreenShell`, `ThemedView`, `ThemedText`, `SectionHeader`, `EmptyState`.
- **Listas:** `SongList`, `SongRow`, `AlbumCard`, `PlaylistCard`, `AlphabetBar`, `CategoryBar`.
- **Reproductor:** `MiniPlayer`, `SeekBar`, `Artwork`.
- **Interacción:** `OptionSheet`, `SortSheet`, `TextPromptModal`, `PlaylistPicker`, `RefreshButton`.

`ScreenShell` centraliza el área segura, el ancho máximo y el `paddingBottom = BottomTabInset + 110`, que deja espacio tanto para la barra de pestañas como para el mini-reproductor. **Esto evita el clásico solapamiento del mini-player** y demuestra que el layout se pensó con medidas reales.

---

## 3. Inventario de pantallas

| Ruta | Pantalla | Calidad | Observaciones |
| --- | --- | --- | --- |
| `(tabs)/index` | Inicio | ✅ | Resumen + accesos rápidos + secciones con «Ver todo» |
| `(tabs)/songs` | Canciones | ✅ | Búsqueda con debounce, categorías, contador, orden, refresco |
| `(tabs)/albums` | Álbumes / Artistas | ✅ | Cambio de vista por segmento |
| `(tabs)/audiobooks` | Audiolibros | ✅ | Agrupación por libro |
| `(tabs)/playlists` | Playlists | ✅ | Manuales + 6 automáticas |
| `(tabs)/settings` | Ajustes | ✅ | Tema, biblioteca, datos, OTA, diagnóstico |
| `player` | Reproductor | ✅ | Modal, portada, seek, controles, acciones |
| `queue` | Cola | ✅ | `FlatList`, mover, quitar, vaciar |
| `album/[id]` | Detalle de álbum | ✅ | — |
| `artist/[name]` | Detalle de artista | ✅ | — |
| `playlist/[id]` | Detalle de playlist | ✅ | Reordenar |
| `auto/[key]` | Playlist automática | ✅ | — |
| `logs` | Diagnóstico | ✅ | Lista de errores deduplicados |

**Navegación:** Expo Router con 6 pestañas + stack para detalles y modales. El mini-reproductor se monta en el layout raíz y se oculta solo en `/player`, lo que da continuidad correcta a la reproducción.

---

## 4. Tematización: el punto más inconsistente

### 4.1 Tema manual vs. sistema

- `app.json` declara `"userInterfaceStyle": "automatic"`.
- La app, en cambio, usa un tema **manual** persistido (`settings.store.ts`, por defecto `dark`).

Consecuencia: los controles **nativos** (teclado, diálogos del sistema, selectores, barra de estado del sistema en algunos casos) siguen el esquema del sistema operativo, mientras la app sigue el tema elegido por el usuario. Si el usuario tiene el sistema en claro y elige oscuro en la app, verá un teclado claro sobre una pantalla oscura.

**Mitigación disponible sin instalar nada:** `expo-system-ui` ya está declarado (aunque sin usar). Puede fijar el color de fondo de la raíz nativa y alinear el `color-scheme`. Alternativa: dejar de declarar `automatic` y resolver el esquema con `Appearance`.

### 4.2 Splash

`expo-splash-screen` está configurado con `backgroundColor: "#0B0B0F"` (el fondo del tema **oscuro**). Si el usuario usa el tema claro, verá un destello oscuro antes de la primera pantalla.

### 4.3 Barra de pestañas

`(tabs)/_layout.tsx` aplica `palette.backgroundElement`, `palette.border`, `accent` y `textSecondary`. Correcto y coherente.

### 4.4 Modales y hojas

`OptionSheet` y `SortSheet` usan `Modal` con `animationType="slide"`. La hoja de orden tiene etiquetas accesibles completas (`accessibilityLabel` con campo + sentido, `accessibilityHint` para alternar). Buen nivel de detalle.

> **Riesgo de usabilidad:** ambas hojas envuelven el contenido en un `Pressable` interno **sin `onPress`** dentro de un `Pressable` de fondo que cierra. En React Native el comportamiento del responder puede variar; conviene verificar en dispositivo que tocar el contenido **no** cierre la hoja. No se pudo reproducir en esta auditoría.

---

## 5. Jerarquía, densidad y responsive

- Títulos de pantalla a 34/40 px con subtítulo secundario: jerarquía clara.
- Uso de `MaxContentWidth: 800` para tablet/web: evita líneas interminables.
- Listas con `FlatList` en cola y `ScrollView` en pantallas de secciones: aceptable para el tamaño de datos actual, con la salvedad de que `songs.tsx` renderiza dentro de `ScrollView` (ver `05-architecture-proposal.md`, §6).
- **Seis pestañas** en la barra inferior. En un dispositivo de 360 dp cada pestaña dispone de ~60 dp; etiquetas como «Audiolibros» o «Playlists» pueden truncarse o reducir el tamaño de fuente. **Riesgo visual** que debe comprobarse en pantallas pequeñas. Material Design recomienda 3–5 destinos.

---

## 6. El widget: coherencia rota

| Aspecto | App | Widget | Veredicto |
| --- | --- | --- | --- |
| Acento | `#12B76A` / `#1ED760` | `#7C5CFF` (púrpura) | ❌ **Color ajeno al sistema de diseño** |
| Fondo | `#0B0B0F` (oscuro) / `#FFFFFF` (claro) | `#0B0B0F` fijo | ❌ Solo tema oscuro |
| Superficie | `#17171C` | `#1C1C26` | ⚠️ Cercano, pero no es el token |
| Texto secundario | `#9BA1A6` | `#9A9AA8` | ⚠️ Cercano, pero no es el token |
| Esquema del sistema | Manual | `environment.colorScheme` disponible y **no usado** | ❌ |
| Iconografía | Ionicons | Glifos de texto (`◀◀`, `▶▶`, `▮▮`) | ⚠️ Aspecto inconsistente |
| Accesibilidad de botones | `accessibilityLabel` | Sin `contentDescription` | ❌ |

**Restricción técnica que condiciona la solución:** el runtime `'widget'` es aislado: **no puede importar** `constants/theme.ts` ni referenciar constantes de módulo. La corrección correcta es **resolver los colores en la app y enviarlos como props** en `updateSnapshot` (por ejemplo `colors: { background, surface, accent, text, textSecondary }`), además de leer `environment.colorScheme` dentro del widget para el caso en que el snapshot esté obsoleto.

**Limitación funcional ya descrita en `03-functional-audit.md` (`A-03`):** los botones anterior/siguiente solo funcionan con el proceso vivo.

---

## 7. Estados y feedback

| Estado | Implementación | Valoración |
| --- | --- | --- |
| Primera carga | `isLoading` + loader | ⚠️ Sin progreso granular en bibliotecas grandes |
| Escaneo manual | `isScanning` + `RefreshButton` girando | ✅ |
| Sin permiso | `EmptyState` con acción para pedir acceso | ✅ |
| Biblioteca vacía | `EmptyState` | ✅ |
| Error de escaneo | `error` en el store; **no se muestra de forma sistemática** | ❌ (`A-04`) |
| Lock screen no disponible | Solo log | ❌ |
| Widget no disponible | Solo log, degradación silenciosa | ⚠️ Aceptable en Expo Go, no en build |
| Búsqueda sin resultados | Estado vacío de la lista | ✅ |
| Reproducción con buffer | `ActivityIndicator` en el botón play | ✅ |

El patrón de `EmptyState` es correcto; el problema es que **no se usa para errores**, solo para ausencia de datos.

---

## 8. Accesibilidad

**Lo que está bien:**

- 43 props de accesibilidad distribuidas en las pantallas y componentes principales.
- `hitSlop={8}` en la mayoría de los iconos pequeños.
- Roles y estados en `CategoryBar` (`accessibilityRole="button"`, `accessibilityState.selected`).
- Etiquetas descriptivas en el reproductor, la cola y el mini-reproductor.
- Etiquetas contextuales en la hoja de orden.

**Gaps:**

| Gap | Severidad |
| --- | --- |
| Botones del widget sin `contentDescription` | ALTO |
| Botones con icono que dependen del color para indicar estado (aleatorio/repetido) → no hay texto alternativo de estado | MEDIO |
| `CategoryBar`: el `Pressable` no tiene `accessibilityLabel`; el texto hijo puede leerse como nodo separado | BAJO |
| Sin auditoría con TalkBack ni con tamaño de fuente del sistema al 200 % | MEDIO (riesgo) |
| Sin `accessibilityLiveRegion` para anunciar cambio de pista | BAJO |
| Textos truncados con `numberOfLines={1}` sin alternativa accesible | BAJO |

---

## 9. Movimiento y percepción de velocidad

- `react-native-reanimated` y `react-native-worklets` están instalados pero **no se usan**. Las únicas animaciones son las del stack (`slide_from_bottom` del reproductor) y `Modal` (`slide`).
- El store de progreso aislado evita re-renderizados de 500 ms: **la percepción de fluidez está bien resuelta donde importa**.
- No hay transiciones compartidas entre tarjeta de álbum y detalle. Es una mejora de percepción, no un defecto.

---

## 10. Hallazgos de UI/UX

| ID | Severidad | Hallazgo | Estado |
| --- | --- | --- | --- |
| `UI-01` | ALTO | El widget usa `#7C5CFF`, un acento que no existe en el sistema de diseño, y no adapta claro/oscuro | Confirmado |
| `UI-02` | ALTO | Fallos de escaneo/permiso/lock screen sin feedback visible | Confirmado (`A-04`) |
| `UI-03` | MEDIO | Splash siempre oscuro → destello en tema claro | Confirmado |
| `UI-04` | MEDIO | `userInterfaceStyle: automatic` vs. tema manual → superficies nativas desalineadas | Confirmado |
| `UI-05` | MEDIO | Seis pestañas inferiores con etiquetas largas en pantallas estrechas | Riesgo (requiere dispositivo) |
| `UI-06` | MEDIO | Arranque en frío sin progreso granular de escaneo | Confirmado |
| `UI-07` | MEDIO | Botones de icono que comunican estado solo por color | Confirmado |
| `UI-08` | BAJO | Glifos de texto en el widget en lugar de iconos | Confirmado |
| `UI-09` | BAJO | Restos de plantilla: `expo-logo.png`, `react-logo*.png`, `tutorial-web.png`, `logo-glow.png`; `adaptiveIcon.backgroundColor: "#E6F4FE"` (azul por defecto) | Confirmado |
| `UI-10` | BAJO | `CategoryBar` sin etiqueta accesible propia | Confirmado |
| `UI-11` | BAJO | `Spacing` sin paso de 12; varios literales 10/12 en estilos | Confirmado |
| `UI-12` | BAJO | Hojas modales: posible cierre al tocar el contenido | Riesgo (requiere dispositivo) |

---

## 11. Recomendaciones priorizadas

1. **Unificar el widget con el sistema de diseño** enviando colores por props y respetando `environment.colorScheme` (FASE 6, depende de FASE 5).
2. **Canal de feedback único** (banner/toast) conectado a `library.store.error` y a los fallos de audio/widget (FASE 1).
3. **Alinear el esquema nativo** con el tema elegido (`expo-system-ui` o `Appearance`) y hacer el splash neutro o dependiente del tema (FASE 6).
4. **Progreso de escaneo** con contador de pistas procesadas (FASE 3).
5. **Revisar la barra de pestañas** en 320–360 dp; considerar mover «Audiolibros» a un acceso desde Inicio o reducir a 5 destinos (FASE 6).
6. **Auditoría TalkBack** y prueba con fuente al 200 % (FASE 7).
7. **Limpieza de assets de plantilla** e icono adaptativo con el color de marca (FASE 8).

---

## 12. Conclusión

La UI está **por encima de la media** de un proyecto en desarrollo: tokens reales, componentes consistentes, navegación coherente y accesibilidad cuidada. No requiere rediseño.

Lo que requiere es **coherencia de superficies** (widget, splash, esquema nativo) y **comunicación de estado** (errores y progreso). Ambas son intervenciones acotadas y de alto impacto percibido, y están asignadas a fases concretas del roadmap.
