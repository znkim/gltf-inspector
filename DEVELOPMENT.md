# Development Guide

## Setup

```bash
npm install
npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## GitHub Pages

This repository is prepared for GitHub Pages deployment from the `docs/` directory.

Published URL:

```text
https://znkim.github.io/gltf-inspector/
```

GitHub Pages settings:

1. Open `Settings -> Pages`.
2. Set `Build and deployment -> Source` to `Deploy from a branch`.
3. Select `develop` and `/docs`.

Build and commit the Pages output:

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
