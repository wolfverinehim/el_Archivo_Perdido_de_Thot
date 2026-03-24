# El Archivo Perdido de Thot

Aventura grafica web de un solo jugador ambientada en el Antiguo Egipto, construida con Flask, SQLite y contenido configurable en JSON.

## Continuidad en otro PC

Si vas a clonar el proyecto en otra maquina para seguir el desarrollo, usa la guia de continuidad:

- [docs/CONTINUIDAD_DESARROLLO.md](docs/CONTINUIDAD_DESARROLLO.md)

## Funcionalidades implementadas

- Rutas separadas en blueprints de juego y administracion.
- Logica de negocio separada en servicios.
- Persistencia del estado de partida en SQLite.
- Escenas y puzles configurables desde archivos JSON.
- Editor interno para actualizar salas y puzles desde navegador.
- Sistema de pistas por puzle con penalizacion de progreso.
- Integracion de tablilla visual como referencia jugable por sala.
- Exploracion de salas estilo aventura grafica con personaje movible.
- Colisiones configurables por sala para mejorar navegacion y sensacion de mundo.
- Pruebas de regresion funcional (12 tests en verde).
- Navegacion parcial sin recarga completa de pagina (reemplaza regiones #app-topbar, #app-alerts, #app-main).
- Sistema de audio completo: musica de fondo, narracion de entrada, narracion por sala y locucion de victoria.
- Glosario de glifos consultable en cualquier momento.

## Requisitos

- Python 3.11+
- VS Code

## Instalacion

1. Crear entorno virtual:

```bash
python -m venv .venv
```

2. Activar entorno (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
```

3. Instalar dependencias:

```bash
pip install -r requirements.txt
```

## Ejecucion

```bash
python run.py
```

Abrir en navegador:

- http://127.0.0.1:5000

## Pruebas

```bash
pytest -q
```

En Windows, si pytest no esta en PATH:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## Estructura

```text
app/
  __init__.py
  config.py
  extensions.py
  models.py
  routes/
    admin.py
    game.py
  services/
    content_service.py
    game_service.py
    inventory_service.py
    puzzle_service.py
  static/
    audio/
      audio_entrada.mp3      <- narracion de pantalla de inicio
      egypt_theme.mp3        <- musica de fondo
      gran_sala_del_archivo.mp3
      camara_ritual.mp3
      santuario_final.mp3
      locucion_final.mp3     <- locucion de victoria
    css/main.css
    img/tablilla.jpeg
    js/main.js
  templates/
    base.html
    glyphs.html
    index.html
    puzzle.html
    room.html
    admin_dashboard.html
    admin_editor.html
data/
  glyphs.json
  rooms.json
  puzzles.json
docs/
  CONTINUIDAD_DESARROLLO.md
tests/
  conftest.py
  test_game.py
run.py
requirements.txt
README.md
```

## Variables de entorno

- SECRET_KEY: clave de sesion (recomendado para no usar valor por defecto).
- DATABASE_URL: URL de base de datos si se quiere cambiar SQLite local.

## Extender funcionalidad

1. Agregar una sala: editar data/rooms.json.
2. Agregar un puzle: editar data/puzzles.json.
3. Crear nueva regla compleja: agregar servicio en app/services.
4. Exponer nuevas acciones: agregar ruta en app/routes/game.py.
5. Cubrir cambios: agregar pruebas en tests/.

## Sistema de audio

El audio se gestiona completamente desde `app/static/js/main.js` mediante `window.egyptAudio` y las funciones `initRoomNarration` / `initVictoryLocution`. Los datos de audio se pasan al frontend via atributos HTML en `data-narration-audio` y `data-final-locution-audio`.

Archivos de audio y cuando se reproducen:

- `audio_entrada.mp3`: narracion introductoria en la pantalla de inicio, al primer click del usuario. Se marca como escuchada con la clave `egyptNarrationHeard` en localStorage.
- `egypt_theme.mp3`: musica de fondo en bucle, controlable con el boton de musica del layout global.
- `gran_sala_del_archivo.mp3`: narracion de la Gran Sala del Archivo, autoreproducida en la primera visita. Clave: `egyptRoomNarV2_archives`.
- `camara_ritual.mp3`: narracion de la Camara Ritual. Clave: `egyptRoomNarV2_ritual`.
- `santuario_final.mp3`: narracion del Santuario Final. Clave: `egyptRoomNarV2_sanctum`.
- `locucion_final.mp3`: locucion de victoria, se reproduce una sola vez tras resolver el puzle final. Clave: `egyptFinalLocutionV2_<player_id>` (se repite en nuevas partidas).

Para anadir narracion a una sala nueva basta con definir `narration_audio` en su entrada de `data/rooms.json`. No se requiere cambiar nada en el codigo.

## Navegacion parcial (SPA ligera)

La funcion `replaceAppRegions()` en `main.js` intercepta los clicks de navegacion interna y reemplaza unicamente las regiones `#app-topbar`, `#app-alerts` y `#app-main` sin recargar la pagina completa. Tras cada navegacion se ejecuta `initPage(root)` para reinicializar toda la logica JS del nuevo contenido.

Las claves localStorage que marcan audio como escuchado persisten entre navegaciones y sesiones para no repetir narraciones ya oidas.

## Glosario de glifos

Disponible en `/glyphs`. Consolida todos los glifos definidos en `data/glyphs.json` y los hotspots de `data/puzzles.json`. Incluye campo de busqueda en tiempo real por nombre, glifo, token o significado.

## Exploracion inmersiva de salas

La vista de sala incluye un minijuego de exploracion con movimiento del personaje:

- Clic en suelo: el personaje camina al punto.
- Clic en objeto: el personaje camina hasta posicion de interaccion y lo inspecciona.
- Teclado: flechas o WASD para movimiento continuo.
- Proximidad: al acercarse a un objeto, se evalua automaticamente.

La recompensa de la sala se mantiene mediante el flujo de hallazgo y reclamo del glifo objetivo.

## Navegacion y colisiones por datos

La navegacion de cada sala se configura en data/rooms.json dentro de cada room con scene_navigation:

- walkable_polygon: poligono en porcentaje (x, y) que define la zona transitable.
- obstacles: obstaculos estaticos con x, y y radius para bloquear paso.

Ejemplo:

```json
"scene_navigation": {
  "walkable_polygon": [
    { "x": 4, "y": 40 },
    { "x": 96, "y": 38 },
    { "x": 96, "y": 92 },
    { "x": 4, "y": 92 }
  ],
  "obstacles": [
    { "x": 49, "y": 62, "radius": 6.2 }
  ]
}
```

Ademas, los objetos del hunt aportan colision dinamica usando su posicion y tamano.

## Modo debug visual de escena

Existe un overlay opcional para calibrar navegacion:

- Muestra el poligono transitable.
- Muestra obstaculos estaticos.
- Muestra zonas de colision dinamica de objetos.
- Muestra posicion del avatar.

Activacion:

- Por URL: agregar ?sceneDebug=1 en una sala.
- Persistente en navegador: localStorage.setItem("sceneDebug", "1")
- Desactivar persistente: localStorage.removeItem("sceneDebug")

## Mini guia de calibracion (poligonos y colisiones)

Proceso recomendado para ajustar una sala:

1. Activar debug con ?sceneDebug=1 y abrir la sala objetivo.
2. Ajustar primero walkable_polygon para cubrir solo suelo transitable.
3. Probar bordes con clic y teclado, verificando que no atraviesa paredes.
4. Ajustar obstacles para bloquear columnas, altares o mobiliario fijo.
5. Repetir pruebas de movimiento diagonal y cambios de direccion rapidos.

Reglas practicas:

- Mantener vertices del poligono en orden (sentido horario o antihorario) sin cruces.
- Usar pocos vertices al inicio (6-8) y aumentar solo si hace falta precision.
- Empezar con radios de obstaculo conservadores y subir gradualmente.
- Evitar obstaculos pegados al borde del poligono para no crear "atascos".

Checklist rapido de validacion:

- El avatar alcanza todas las zonas jugables importantes.
- El avatar no atraviesa geometria visual evidente.
- Se puede inspeccionar cada objeto sin bloqueo injusto.
- No hay vibraciones ni empujes extraños al caminar cerca de obstaculos.

## Panel de administracion

- GET /admin/ devuelve estado actual de partida en JSON.
- POST /admin/reset reinicia la partida activa.
- GET /admin/editor abre el editor de contenido JSON.
- POST /admin/editor/rooms guarda data/rooms.json.
- POST /admin/editor/puzzles guarda data/puzzles.json.- GET /admin/editor abre el editor de contenido JSON.
- POST /admin/editor/rooms guarda data/rooms.json.
- POST /admin/editor/puzzles guarda data/puzzles.json.

## Sistema de pistas

Cada puzle puede definir:

- hint: pista base.
- hints: lista de pistas progresivas.
- hint_penalty: penalizacion de progreso por cada pista solicitada.

Endpoint usado por la UI:

- POST /puzzle/<puzzle_code>/hint

## Tablilla interactiva en puzles

Para habilitar hotspots en un puzle, define en [data/puzzles.json](data/puzzles.json):

- tablet_image: ruta relativa dentro de static.
- tablet_alt: texto accesible de la imagen.
- hotspots: lista de zonas clicables con label, token, hint, x y y.
- strict_sequence: activa validacion de orden por clic.
- expected_sequence: lista de tokens esperados para orden estricto.
- sequence_mode: guided o hard.

Ejemplo de hotspot:

```json
{
  "label": "Ankh",
  "token": "life",
  "x": 14,
  "y": 20
}
```

Los valores x/y son porcentajes sobre la imagen y al pulsar se agregan tokens al campo answer.

Cuando strict_sequence es true, la UI muestra feedback inmediato y reinicia la secuencia si el jugador pulsa un simbolo fuera de orden.
Ademas, los hotspots ya consumidos se bloquean y el siguiente simbolo esperado se resalta para guiar el avance.
En sequence_mode=hard se desactiva ese resaltado para aumentar dificultad, pero se mantiene el bloqueo de simbolos consumidos.
Cada hotspot puede incluir hint y la UI lo muestra al pasar o pulsar sobre el simbolo.

## Tablilla de jeroglificos

La imagen base se encuentra en `app/static/img/tablilla.jpeg` y se referencia desde `data/rooms.json` mediante los campos `tablet_image` y `tablet_alt`. Esto permite reutilizar la tablilla en nuevas salas sin tocar codigo de backend.

## Resetear audio en desarrollo

Para forzar que las narraciones se reproduzcan de nuevo al probar, borrar las claves en las DevTools del navegador:
DevTools > Application > Local Storage > http://127.0.0.1:5000

Claves a borrar segun lo que se quiera reprobar:

- `egyptNarrationHeard` — narracion de pantalla de inicio
- `egyptRoomNarV2_archives` — narracion Gran Sala del Archivo
- `egyptRoomNarV2_ritual` — narracion Camara Ritual
- `egyptRoomNarV2_sanctum` — narracion Santuario Final
- `egyptFinalLocutionV2_<player_id>` — locucion de victoria
