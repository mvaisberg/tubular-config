---
name: threejs-expert
description: Comprehensive Three.js reference covering scene setup, geometry, materials, lighting, interaction, animation, and performance optimization. Use this skill when you need implementation patterns, code snippets, or best practices for 3D development with Three.js or React Three Fiber.
---

# Three.js Expert Knowledge Base

This skill provides a curated collection of Three.js knowledge, patterns, and code snippets. Consult the specific resource file relevant to your task.

## 📚 Resources

The following detailed guides are available in the `resources/` directory:

| Topic | Description | File |
|-------|-------------|------|
| **Fundamentals** | Scene setup, cameras, renderer configuration, object hierarchy. | [fundamentals.md](resources/fundamentals.md) |
| **Geometry** | Creating built-in geometries, buffer attributes, custom meshes. | [geometry.md](resources/geometry.md) |
| **Materials** | Standard, basic, physical materials, transparency, blending. | [materials.md](resources/materials.md) |
| **Lighting** | Light types, shadows, environment maps (HDRI). | [lighting.md](resources/lighting.md) |
| **Interaction** | Raycasting, mouse/touch events, camera controls (Orbit, Fly, etc.). | [interaction.md](resources/interaction.md) |
| **Animation** | Animation loop, clock usage, tweening, keyframe tracks. | [animation.md](resources/animation.md) |
| **Loaders** | Loading GLTF/GLB models, textures, managing assets. | [loaders.md](resources/loaders.md) |
| **Textures** | Texture mapping, UVs, filtering, repeating. | [textures.md](resources/textures.md) |
| **Shaders** | Custom shaders (GLSL), ShaderMaterial, uniforms/attributes. | [shaders.md](resources/shaders.md) |
| **Post-processing** | Bloom, depth of field, ambient occlusion, effect composer. | [postprocessing.md](resources/postprocessing.md) |

## 🚀 Quick Usage

### When to use this skill
- **Setup**: When initializing a new 3D scene or component. (Ref: `fundamentals.md`)
- **Interactivity**: When adding click handlers, drag controls, or camera movement. (Ref: `interaction.md`)
- **Visuals**: When tuning materials, lighting, or post-processing effects. (Ref: `lighting.md`, `materials.md`, `postprocessing.md`)
- **Optimization**: When improving performance (instancing, geometry merging). (Check individual topic sections on optimization)

### Example: Basic Scene Setup (Vanilla Three.js)
```javascript
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
camera.position.z = 5;

function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
}
animate();
```

### Example: React Three Fiber (R3F) Cheatsheet
Since this project uses R3F, map Three.js concepts to R3F components:

- `new THREE.Scene()` -> `<Canvas>` (implicit scene)
- `new THREE.PerspectiveCamera()` -> `<PerspectiveCamera makeDefault />` (or default camera prop on Canvas)
- `new THREE.Mesh(geo, mat)` -> `<mesh><boxGeometry /><meshStandardMaterial /></mesh>`
- `new THREE.AmbientLight()` -> `<ambientLight />`
- `scene.add(obj)` -> Place component in the component tree
- `requestAnimationFrame` -> `useFrame(() => ...)`

Refer to `resources/` for deeper implementation details.
