<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="glTF Inspector logo" />
</p>

# glTF Inspector

Browser-based glTF/GLB inspector for scene hierarchy, materials, textures, geometry stats, validation, and debug rendering.

<p>
  <a href="https://znkim.github.io/gltf-inspector/">Live Demo</a>
  ·
  <a href="DEVELOPMENT.md">Development Guide</a>
</p>

<img width="1412" height="944" alt="image" src="https://github.com/user-attachments/assets/554623de-8e42-4670-965c-61580a6f81b5" />

> Warning: glTF Inspector is currently beta software. Core asset, scene, material, texture, geometry, and validation inspection are usable, but animation, skin, and morph target workflows are still incomplete and should not be treated as fully supported yet.

## Highlights

- Open `.glb`, `.gltf`, external resource folders, and `.zip` packages directly in the browser.
- Inspect scene hierarchy, selection stats, bounding boxes, materials, textures, UV maps, and raw JSON.
- Switch debug views including PBR, Unlit, Face Orientation, Normal Texture, UV Color, Wireframe, Depth, Material ID, and Node ID.
- Preview texture resources, material texture bindings, and validation results.

Dropped files are read locally through the File API and are not uploaded to a server.

## License

Project source code is distributed under the MIT License.

Bundled sample GLB files under `public/samples/` have separate asset licenses and
are not covered by the project source code license. See
[`public/samples/NOTICE.md`](public/samples/NOTICE.md) before redistributing the
sample assets. `DamagedHelmet.glb` is licensed for non-commercial use only.
