# El Archivo Perdido de Thot

Proyecto base para una aventura grafica web construida con Flask, SQLite y contenido configurable en JSON.

## Continuidad en otro PC

Si vas a clonar el proyecto en otra maquina para seguir el desarrollo, usa la guia de continuidad:

- [docs/CONTINUIDAD_DESARROLLO.md](docs/CONTINUIDAD_DESARROLLO.md)

## Objetivo

Esta base esta preparada para crecer por modulos:

- Rutas separadas en blueprints de juego y administracion.
- Logica de negocio separada en servicios.
- Persistencia del estado de partida en SQLite.
- Escenas y puzles configurables desde archivos JSON.
- Editor interno para actualizar salas y puzles desde navegador.
- Sistema de pistas por puzle con penalizacion de progreso.
- Integracion de tablilla visual como referencia jugable por sala.
- Pruebas iniciales para proteger comportamiento basico.

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
    css/main.css
    img/tablilla.jpeg
    js/main.js
  templates/
    base.html
    index.html
    puzzle.html
    room.html
data/
  rooms.json
  puzzles.json
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

## Panel de administracion

- GET /admin/ devuelve estado actual de partida en JSON.
- POST /admin/reset reinicia la partida activa.
- GET /admin/editor abre el editor de contenido JSON.
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

La imagen base se encuentra en [app/static/img/tablilla.jpeg](app/static/img/tablilla.jpeg) y se referencia desde [data/rooms.json](data/rooms.json) mediante los campos:

- tablet_image
- tablet_alt

Esto permite reutilizar la tablilla en nuevas salas sin tocar codigo de backend.
