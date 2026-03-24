# Guia de desarrollo — El Archivo Perdido de Thot

Este documento cubre como montar el proyecto en cualquier maquina y las lineas de trabajo abiertas para seguir desarrollando.

## 1. Clonar y arrancar

```bash
git clone https://github.com/wolfverinehim/el_Archivo_Perdido_de_Thot.git
cd el_Archivo_Perdido_de_Thot
python -m venv .venv
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

Abrir en navegador: http://127.0.0.1:5000

Ejecutar tests:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Estado esperado: 12 tests en verde.

## 2. Estado funcional actual

El juego esta completo de punta a punta con las tres salas jugables y un flujo de victoria funcional.

### Flujo de juego

1. Pantalla de inicio con narracion de audio y formulario de nueva partida.
2. Gran Sala del Archivo: exploracion inmersiva, hallazgo de glifo objetivo, puzle de secuencia de glifos.
3. Camara Ritual: exploracion, nuevo glifo y puzle de secuencia.
4. Santuario Final: exploracion, glifo final, puzle de sintesis (el Mensaje de Thot). Al resolver se reproduce la locucion de victoria y se muestra pantalla de victoria.

### Sistemas implementados

- **Exploracion inmersiva**: personaje movible con clic/teclado, zona transitable configurable por poligono, obstaculos con radio, proximidad automatica a objetos.
- **Puzles de tablilla**: hotspots clicables, modo strict con resaltado del siguiente simbolo, modo hard sin resaltado, bloqueo de simbolos consumidos.
- **Sistema de pistas**: hasta 3 pistas progresivas por puzle con penalizacion de progreso configurable.
- **Audio**: musica de fondo, narracion de entrada, narracion por sala (autoreproducida la primera vez, boton para repetir), locucion de victoria (una vez por partida via player_id).
- **Navegacion parcial**: transiciones sin recarga completa, reinicializacion de logica JS en cada navegacion.
- **Glosario de glifos**: consolidado de glyphs.json + hotspots de puzzles.json, con busqueda en tiempo real.
- **Panel de administracion**: reset de partida, editor JSON de salas y puzles en el navegador.
- **Persistencia**: SQLite via SQLAlchemy, estado de partida por player_id de sesion.
- **CI**: GitHub Actions ejecuta los tests en cada push y pull request.

## 3. Archivos clave

| Archivo | Proposito |
|---|---|
| `app/routes/game.py` | Flujo principal del juego (salas, puzles, victoria) |
| `app/services/puzzle_service.py` | Validacion de respuestas y logica de pistas |
| `app/services/game_service.py` | Gestion de partidas y progreso |
| `app/static/js/main.js` | Toda la logica de cliente: audio, navegacion parcial, exploracion, hotspots |
| `app/templates/base.html` | Layout global, musica, API de audio `window.egyptAudio` |
| `app/templates/room.html` | Vista de sala con atributos `data-*` para el sistema de audio |
| `data/rooms.json` | Definicion de salas, navegacion, audio |
| `data/puzzles.json` | Definicion de puzles y secuencias |
| `data/glyphs.json` | Catalogo de glifos |
| `tests/test_game.py` | Regresion funcional basica |

## 4. Convenciones clave del codigo

### Audio
- El audio se configura en `data/rooms.json` con el campo `narration_audio`.
- El frontend lee los datos via atributos `data-narration-audio` y `data-final-locution-audio` en `section.layout`.
- Las claves de localStorage siguen el patron `egyptRoomNarV2_<room_code>` para narraciones de sala y `egyptFinalLocutionV2_<player_id>` para la locucion de victoria.
- Para anadir narracion a una sala nueva: solo anadir `"narration_audio": "audio/mi_archivo.mp3"` en rooms.json.

### Navegacion parcial
- `replaceAppRegions()` en main.js intercepta clicks internos y reemplaza `#app-topbar`, `#app-alerts`, `#app-main`.
- `initPage(root)` se llama tras cada navegacion. Toda logica JS que afecte al contenido de la sala debe registrarse ahi.
- No uses `{% block extra_scripts %}` para logica que deba ejecutarse en navegacion parcial: mueve esa logica a `initPage`.

### Flujo de trabajo Git
- Trabajar directamente en `main` para cambios pequenos.
- Para features grandes: crear rama de feature, implementar, ejecutar pytest, hacer PR a main.
- Rama unica activa: `main`.

## 5. Ideas de desarrollo abiertas

Las siguientes funcionalidades mejorarian el juego y estan listas para implementar. Ordenadas de menor a mayor complejidad.

### Mejoras visuales y de experiencia

- **Fondos de sala reales**: cada sala tiene un `room_bg_image` (actualmente placeholder). Anadir imagenes propias en `app/static/img/` y referenciarlas en rooms.json.
- **Animacion de entrada de sala**: fade in del contenido al navegar entre salas, usando la clase CSS `.animating` que ya activa `replaceAppRegions`.
- **Pantalla de carga**: el indicador `#nav-loading` ya existe en base.html, mejorar el estilo para que sea mas visible durante navegaciones lentas.
- **Resaltado del personaje al inspecionar**: cuando el avatar se acerca a un objeto y lo inspecciona, mostrar una burbuja de dialogo o particulas de destello.

### Audio

- **Efectos de sonido por objeto**: al inspeccionar cada objeto en la escena, reproducir un sonido corto especifico (piedra, papiro, metal). Definir `sound_fx` por objeto en rooms.json.
- **Musica diferente por sala**: anadir un campo `ambient_music` en rooms.json y que `initRoomNarration` cambie la pista de fondo al entrar en la sala.
- **Fade entre musicas**: en lugar de corte abrupto al cambiar de sala, hacer un fade out / fade in entre pistas.

### Gameplay

- **Inventario visible**: mostrar los objetos recogidos en un panel lateral o modal. Ya existe `inventory_service.py`; falta la UI.
- **Pistas de objeto**: al inspeccionar un objeto sin ser el objetivo, mostrar un texto de sabor o pista contextual definida en rooms.json.
- **Contador de intentos en puzle**: mostrar cuantos intentos lleva el jugador en el puzle actual. Ya se puede inferir del log de eventos.
- **Modo sin ayuda (iron)**: opcion al inicio de partida que desactiva el sistema de pistas completamente.
- **Puntuacion final**: en la pantalla de victoria mostrar progreso restante, numero de pistas usadas, salas completadas y tiempo total.

### Contenido

- **Mas salas**: el sistema soporta cualquier numero de salas encadenadas. Solo hay que definirlas en rooms.json con `next_room` apuntando a la siguiente.
- **Puzle de traduccion libre**: en lugar de secuencia de hotspots, un puzle donde el jugador escribe la traduccion de un texto jeroglífico. Ya funciona el campo `answer` de texto libre en puzzle_service.
- **Glifos adicionales**: ampliar `data/glyphs.json` con mas simbolos del alfabeto egipcio; el glosario los mostrara automaticamente.

### Tecnico

- **Tests de audio y navegacion**: cubrir `initRoomNarration`, `replaceAppRegions` e `initVictoryLocution` con tests de integracion usando Playwright o similar.
- **Mejorar accesibilidad**: anadir `aria-live` en la zona de alertas, mejorar contraste en hotspots, asegurar navegacion completa por teclado en la escena.
- **Exportar partida**: endpoint que devuelva el estado completo de la partida como JSON descargable (historial de eventos, inventario, progreso).
- **Multijugador cooperativo**: dos jugadores en sesiones distintas comparten el mismo `game_id`; cada uno puede avanzar en diferentes salas.

## 6. Como resetear audio en desarrollo

DevTools del navegador > Application > Local Storage > http://127.0.0.1:5000

Borrar las claves que se quieran reprobar:

- `egyptNarrationHeard`
- `egyptRoomNarV2_archives`
- `egyptRoomNarV2_ritual`
- `egyptRoomNarV2_sanctum`
- `egyptFinalLocutionV2_<player_id>`
