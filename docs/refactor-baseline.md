# Refactor Baseline

## Current entrypoints

- `index.html` is the 2D renderer entry for `marktplatz` and `steingasse`.
- `liminal library.html` is the 3D renderer entry for `liminal_library`.
- `main.js` and `preload.js` are the Electron shell entrypoints.

## Runtime constraints

- Existing page URLs, query parameters, DOM IDs and savegame keys remain stable during the refactor.
- Safari/iPhone specific behavior is preserved until a verified replacement exists.
- `window.electronAPI.saveGame` and `window.electronAPI.loadGame` remain stable.

## Initial smoke checklist

- Fresh Electron start reaches the loading screen and transitions into gameplay.
- Chapter navigation works across `index.html`, `liminal library.html` and `index.html?chapter=kapitel1c`.
- Lore unlocks and archive rendering still work.
- Bookmark create/delete/jump still work on same-page and cross-page flows.
- Save/export and load/import still work with the current JSON format.
- Reading mode, fullscreen, audio resume and mobile controls still behave as before.
- Liminal scene keeps its 2D fallback path if Three.js fails to load.
