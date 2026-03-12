# Three.js vendor slot

The new loader in `assets/js/scenes/liminal3d/load-three.js` first tries to load a local
`three.module.js` from this directory and falls back to the current remote URL if the file
is not present.

The runtime is therefore backward compatible right now, while future refactor steps can
replace the remote dependency by dropping a pinned local build into this folder.
