# Continuidad de desarrollo en otro PC

Este documento resume como descargar el proyecto en otra maquina y retomar el trabajo sin perder contexto.

## 1. Clonar el repositorio

```bash
git clone https://github.com/wolfverinehim/el_Archivo_Perdido_de_Thot.git
cd el_Archivo_Perdido_de_Thot
```

## 2. Preparar entorno Python

```bash
python -m venv .venv
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Instalar dependencias:

```bash
pip install -r requirements.txt
```

## 3. Ejecutar y validar

Arrancar juego:

```bash
python run.py
```

Ejecutar pruebas:

```bash
pytest -q
```

Estado esperado actual: 11 tests en verde.

## 4. Estado funcional actual

- Juego Flask con persistencia SQLite y contenido en JSON.
- Pantalla inicial narrativa en espanol.
- Sistema de salas, inventario, puzles y victoria.
- Hotspots sobre la tablilla con modo estricto y modo hard.
- Visualizacion de secuencia por signos en la UI del puzle.
- Panel admin para reset y editor JSON de salas/puzles.
- Musica ambiental integrada en layout global.
- CI en GitHub Actions para tests en push y pull request.

## 5. Archivos clave para continuar

- app/routes/game.py: flujo principal del juego.
- app/services/puzzle_service.py: validacion de respuestas.
- app/static/js/main.js: logica de hotspots y UI de puzles.
- app/templates/base.html: layout global y musica.
- data/rooms.json: definicion de salas.
- data/puzzles.json: definicion de puzles y secuencias.
- tests/test_game.py: regresion funcional basica.

## 6. Flujo recomendado de trabajo

1. Crear rama de feature desde main.
2. Implementar cambio pequeno.
3. Ejecutar pytest -q.
4. Commit con mensaje claro.
5. Push y revisar CI en GitHub Actions.
6. Abrir pull request a main.

## 7. Notas operativas

- La base de datos de desarrollo esta en instance/game.db y se regenera en entorno nuevo.
- El contenido jugable se modifica preferentemente en data/rooms.json y data/puzzles.json.
- Si hay problemas de autoplay de audio, el navegador puede requerir interaccion del usuario.

## 8. Proximos pasos sugeridos

1. Completar navegacion parcial para transiciones sin recarga completa.
2. Mejorar accesibilidad de hotspots y feedback visual.
3. Añadir tests para flujo de musica y navegacion de UI.
4. Publicar release v1.0.0 con changelog.
