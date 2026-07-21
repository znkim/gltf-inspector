<img width="1714" height="972" alt="image" src="https://github.com/user-attachments/assets/fb53f311-e0af-4e1d-9e0f-48d9f72aa5ea" />


# 🛠️ glTF Inspector

Browser-based glTF/GLB inspection tool built with React, TypeScript, Vite, and Three.js.

The app runs entirely in the browser. Dropped files are read locally through the File API and are not uploaded to a server.

Live site: https://znkim.github.io/gltf-inspector/

> Warning: glTF Inspector is currently beta software. Core asset, scene, material, texture, geometry, and validation inspection are usable, but animation, skin, and morph target workflows are still incomplete and should not be treated as fully supported yet.

## Features

- Open `.glb`, `.gltf`, external resource folders, and `.zip` packages.
- Inspect scene hierarchy, node transforms, primitive geometry, materials, textures, animations, skins, morph targets, and raw JSON.
- View asset and selection statistics including vertices, triangles, primitives, draw calls, and bounding boxes.
- Preview texture resources and material-to-texture usage.
- Render UV mapping previews on canvas.
- Switch debug render modes: PBR, vertex color, base color, wireframe, triangle color, normals, depth, UV checker, material ID, and node ID.
- Toggle grid, world axes, display recenter, perspective/orthographic camera, and a viewport orientation gizmo.
- Validate assets with `gltf-validator` in a Web Worker.
- Export a JSON inspection report.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:pages
```

## GitHub Pages Deployment

This repository is prepared for GitHub Pages deployment from the `docs/` directory.

Published URL:

```text
https://znkim.github.io/gltf-inspector/
```

1. In GitHub, open `Settings -> Pages`.
2. Set `Build and deployment -> Source` to `Deploy from a branch`.
3. Select `main` and `/docs`.
4. Build and commit the Pages output:

```bash
npm run build:pages
git add docs
git commit -m "Build GitHub Pages site"
git push
```

The Pages base path is configured as:

```text
/gltf-inspector/
```

If the repository name changes, update the `--base` value in the `build:pages` script in `package.json`.

## Build Notes

- Vite `base` is read from `VITE_BASE_PATH` and defaults to `/` for local development.
- `npm run build:pages` overrides Vite output to `docs/` and base to `/gltf-inspector/`.
- Draco and KTX2 decoder paths are resolved from `import.meta.env.BASE_URL`, so they work under the GitHub Pages subpath.
- `public/.nojekyll` is included so GitHub Pages serves static decoder files directly.

## Open Source

This project uses open source libraries including:

- Three.js
- React
- Vite
- glTF-Validator
- meshoptimizer
- fflate
- Pretendard

See `package.json` and `package-lock.json` for exact versions.
