# Blender tools (optional)

Scripted, headless Blender. Everything here is code; outputs are regenerated, never hand-edited. See `docs/DECISIONS.md`.

## Setup (one time, outside the project dependencies)

```bash
python3 -m venv ~/.venvs/bpy && ~/.venvs/bpy/bin/pip install bpy
```

## Scripts
* `smoke_test.py`: creates a cube, renders it with Cycles and writes `.dev/blender_smoke.png` (checks the install).

Run: `~/.venvs/bpy/bin/python tools/blender/smoke_test.py`
