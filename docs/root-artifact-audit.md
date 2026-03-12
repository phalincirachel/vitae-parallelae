# Root Artifact Audit

## Runtime files

- `index.html`
- `liminal library.html`
- `main.js`
- `preload.js`
- `package.json`
- `package-lock.json`

## One-off or generated files to review before moving/removing

- `index_dump.txt`
- `index_dump_utf8.txt`
- `__tmp_index_inline.js`
- `__tmp_liminal_inline.js`
- `.tmp_inline.js`
- `__codex_tmp_check.js`
- `temp_script_0.js` to `temp_script_8.js`
- `book_ascii.txt`
- `book_encoded.txt`
- `temp_b64.txt`
- `inject_png.js`
- `img_script.js`
- `remove_style.py`
- `debug.log`
- `err.txt`

## Policy

- Nothing in this list is deleted blindly.
- Each file must be classified as `runtime`, `tooling`, `generated`, or `archive` before it moves.
- Runtime references must be removed or redirected before any cleanup happens.
