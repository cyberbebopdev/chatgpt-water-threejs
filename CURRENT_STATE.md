# CURRENT_STATE.md — Project Snapshot

> **Last Updated:** June 30, 2026  
> **Last Commit:** `584c37d` — Initial project setup with Gerstner waves + full PBR water renderer  
> **Status:** Functional MVP — single-pass ocean renderer is complete and running

---

## 1. What This Project Is

A single-page, physically based ocean renderer built with Three.js r180+, TypeScript, and Vite. The goal is to create one of the most realistic water renderers possible as an open-source graphics showcase.

**Repository:** `git@github-cyberbebop:cyberbebopdev/chatgpt-water-threejs.git`

---

## 2. What Works Right Now

The following features are **fully implemented and functional**:

| Feature | Status | Details |
|---------|--------|---------|
| Gerstner Wave Simulation | ✅ Complete | 3 active wave layers (8 max), GPU vertex displacement |
| Analytical Normals | ✅ Complete | Partial derivatives (tangent vectors) crossed for exact normals |
| Schlick Fresnel | ✅ Complete | Angle-dependent reflectance, F₀ from IOR 1.33 |
| GGX/Trowbridge-Reitz NDF | ✅ Complete | Microfacet normal distribution |
| Smith Geometric Shadowing | ✅ Complete | Schlick-GGX visibility/masking term |
| Cook-Torrance Specular BRDF | ✅ Complete | D·G·F / (4·N·V) combination |
| Energy-Conserving Diffuse | ✅ Complete | (1-F)·(1-metalness)·albedo/π |
| PMREM Environment Reflections | ✅ Complete | Prefiltered CubeTexture from procedural sky scene |
| Analytical BRDF Integration | ✅ Complete | Closed-form fallback (no LUT texture yet) |
| Fresnel-Weighted Irradiance | ✅ Complete | Diffuse environment from PMREM irradiance map |
| Subsurface Scattering Approx. | ✅ Complete | Rim-lighting effect along wave crests |
| Foam/Whitecaps | ✅ Complete | Elevation-based smoothstep at wave crests |
| Depth-Based Color Gradient | ✅ Complete | Deep color (troughs) → shallow color (crests) |
| ACES Filmic Tone Mapping | ✅ Complete | Cinematic HDR→LDR curve + gamma 1/2.2 |
| Procedural Sky Scene | ✅ Complete | Gradient sky + sun disc + glow, used for PMREM |
| OrbitControls | ✅ Complete | Full camera navigation with damping |
| Resize Handling | ✅ Complete | Responsive fullscreen canvas |

---

## 3. Current File Structure

```
chatgpt-water-tutorial/
├── index.html              # Minimal HTML shell — fullscreen canvas, imports main.ts
├── main.ts                 # Entry point — scene, camera, renderer, PMREM, animation loop (217 lines)
├── water/
│   └── WaterMesh.ts        # Core ocean renderer — WaterMesh class + embedded GLSL shaders (898 lines)
├── AI_CONTEXT.md           # Comprehensive architecture doc — equations, data flow, design decisions (304 lines)
├── PBR_EXPLAINED.md        # Detailed equation documentation — 10 PBR equations with references (639 lines)
├── CURRENT_STATE.md        # This file — current project snapshot
├── TODO.md                 # Empty — pending population
├── SESSION_SUMMARY.md      # Empty — pending population
├── PROJECT.md              # Empty — pending population
├── package.json            # Dependencies: three@^0.180.0, typescript@^5.4.0, vite@^5.4.0
├── tsconfig.json           # ES2022 target, strict mode, ESNext modules
├── vite.config.ts          # Root '.', dist output, auto-open browser
├── .gitignore              # Standard ignores (node_modules, dist)
└── node_modules/           # Installed dependencies
```

### File Responsibilities

| File | Lines | Responsibility |
|------|-------|---------------|
| `index.html` | ~10 | Minimal HTML container with fullscreen canvas |
| `main.ts` | 217 | Scene setup, procedural sky, PMREM generation, WaterMesh instantiation, OrbitControls, animation loop |
| `water/WaterMesh.ts` | 898 | WaterMesh class, GerstnerWaveConfig interface, vertex shader (displacement + normals), fragment shader (full PBR) |
| `AI_CONTEXT.md` | 304 | Architecture, implementation status, rendering pipeline, design decisions, uniforms reference |
| `PBR_EXPLAINED.md` | 639 | Academic-level documentation of all 10 PBR equations with math, GLSL, and references |

---

## 4. Implementation Status

### Completed

- [x] Project scaffolding (Vite + TypeScript + Three.js)
- [x] Ocean mesh (1000×1000 plane, 256×256 segments, rotated to XZ plane)
- [x] Gerstner wave vertex displacement (3 layers, up to 8 supported)
- [x] Analytical normal computation via tangent cross product
- [x] Full Cook-Torrance PBR fragment shader (10 equations)
- [x] Procedural HDR sky scene for environment maps
- [x] PMREM prefiltered environment map generation
- [x] PMREM irradiance map for diffuse lighting
- [x] Foam/whitecaps at wave crests
- [x] Depth-based color gradient
- [x] ACES tone mapping + gamma correction
- [x] OrbitControls with damping
- [x] Comprehensive documentation (AI_CONTEXT.md, PBR_EXPLAINED.md)

### Not Yet Implemented

| Feature | Priority | Notes |
|---------|----------|-------|
| Refraction pass | High | Screen-space refraction through water surface |
| Caustics | High | Focusing/defocusing patterns from wave normals |
| Shoreline interaction | High | Foam accumulation near land, wet sand |
| Underwater camera | High | Camera below surface with volumetric effects |
| Shader file separation | Medium | Extract GLSL from .ts into `shaders/` directory |
| BRDF LUT texture | Medium | Proper 2D lookup texture for environment integration |
| FFT wave simulation | Medium | Optional FFT-based ocean spectrum |
| Foam texture | Medium | Procedural/texture-based foam system |
| Distance-based LOD | Performance | Reduce wave layers and geometry at distance |
| Tiling shader | Performance | Repeat smaller high-res mesh |
| Compute shader waves | Future | WebGL2 compute shaders for wave computation |

---

## 5. Known Limitations

1. **Single-pass rendering** — Everything happens in one ShaderMaterial on one mesh. No post-processing, no refraction, no caustics yet.
2. **Analytical BRDF integration** — Uses closed-form approximation `(1-N·V)⁵ · (1-F₀) + F₀` instead of a precomputed BRDF LUT texture. Less accurate but no texture lookup needed.
3. **Embedded shaders** — GLSL code lives as template literals inside `WaterMesh.ts` rather than separate `.glsl` files.
4. **No LOD system** — Full 256×256 geometry with all wave layers active regardless of camera distance.
5. **No shoreline** — Infinite ocean plane with no land interaction.
6. **No refraction** — Water surface does not refract underlying geometry.
7. **No caustics** — Light focusing patterns not computed.
8. **Minimal directory structure** — Only `water/` exists; `shaders/`, `math/`, `rendering/`, `utilities/`, `textures/` are planned but not created.

---

## 6. Configuration Defaults

### Wave Layers (3 active, 8 max)

| Layer | Amplitude | Wavelength | Speed | Direction | Steepness |
|-------|-----------|------------|-------|-----------|-----------|
| 1 | 2.0m | 40m | 12m/s | (1, 0.3) | 0.4 |
| 2 | 1.0m | 12m | 6m/s | (0.5, 1) | 0.5 |
| 3 | 0.5m | 5m | 3m/s | (-1, 0.7) | 0.6 |

### PBR Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Roughness | 0.15 | GGX roughness (calm water) |
| Metalness | 0.0 | Dielectric (water) |
| IOR | 1.33 | Index of refraction → F₀ ≈ 0.023 |
| Deep Color | [0, 0.05, 0.15] | Dark navy (troughs) |
| Shallow Color | [0, 0.5, 0.6] | Teal (crests) |
| Foam Color | [0.95, 0.95, 0.95] | Near-white |
| Foam Threshold | 2.5 | Elevation threshold for foam |
| SSS Color | [0, 0.35, 0.45] | Subsurface scattering tint |
| SSS Scale | 8.0 | SSS effect intensity |
| Light Direction | (0.5, 1.0, 0.3) normalized | Sun direction |
| Light Color | (1.5, 1.3, 1.0) | Warm HDR sunlight |

### Geometry

| Parameter | Value |
|-----------|-------|
| Plane Size | 1000×1000 |
| Segments | 256×256 |
| Rotation | -90° on X axis (lies on XZ plane) |
| Position | Y=0 (water surface at origin) |

### Camera

| Parameter | Value |
|-----------|-------|
| FOV | 60° |
| Initial Position | (0, 50, 120) |
| Near/Far | 0.1 / 5000 |

---

## 7. How to Run

```bash
npm install
npm run dev       # Starts Vite dev server, opens browser automatically
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

The dev server opens a fullscreen browser window with the animated ocean renderer. Use mouse to orbit, zoom, and pan the camera.

---

## 8. Quick Reference for AI Assistants

1. Read `AI_CONTEXT.md` first for full architecture and design decisions
2. Read `PBR_EXPLAINED.md` for detailed equation documentation
3. Read `water/WaterMesh.ts` for the core implementation (shaders + class)
4. Read `main.ts` for the application entry point
5. Run `npm run dev` to see the renderer in action

**Conventions:**
- Uniforms prefixed with `u` (e.g., `uTime`, `uRoughness`)
- Varyings prefixed with `v` (e.g., `vWorldPosition`, `vNormal`)
- Wave directions use `[dx, dz]` where the second component is the Z axis
- Y axis is up, XZ plane is the water surface
- Strict TypeScript with ES2022 target

---

## 9. Git History

| Commit | Hash | Description |
|--------|------|-------------|
| Initial setup | `584c37d` | Gerstner waves + full PBR water renderer with procedural sky |