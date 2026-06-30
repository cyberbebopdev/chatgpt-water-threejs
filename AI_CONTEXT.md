# AI_CONTEXT.md — Realistic Three.js Water Renderer

> **Purpose:** This document allows any AI assistant or new developer to understand the entire project instantly. It covers architecture, implementation status, equations, file responsibilities, and what remains to be done.

---

## 1. Project Summary

A single-page, physically based ocean renderer built with Three.js r180+, TypeScript, and Vite. The goal is to create one of the most realistic water renderers possible as an open-source graphics showcase.

**Tech Stack:**
- **Three.js** r180+ — 3D rendering engine
- **TypeScript** 5.4+ — type-safe development
- **Vite** 5.4+ — build tool and dev server
- **GLSL** — custom vertex and fragment shaders
- **ES Modules** — modular code organization

**How to Run:**
```bash
npm install
npm run dev       # starts Vite dev server, opens browser
npm run build     # production build to dist/
```

---

## 2. Steps Completed So Far

These represent the sequential prompts/steps taken to build the project:

### ✅ Step 1 — Architecture Design
Designed a complete water rendering architecture covering:
- Wave simulation (Gerstner waves chosen over FFT for simplicity and visual quality)
- Lighting model (Cook-Torrance microfacet BRDF)
- Fresnel reflections (Schlick approximation)
- Refraction (planned, not yet implemented)
- Depth attenuation (elevation-based color gradients)
- Shoreline interaction (planned, not yet implemented)
- Foam (elevation-based whitecaps at wave crests)
- Underwater rendering (planned, not yet implemented)
- Caustics (planned, not yet implemented)
- Performance optimizations (planned: LOD, tiling shaders)
- Shader organization (embedded in TypeScript modules currently)
- Render passes (single-pass currently, multi-pass planned)
- Reusable classes (`WaterMesh` extends Three.js `Mesh`)

### ✅ Step 2 — Project Architecture & Organization
Created a minimal but functional project structure. The intended final structure includes:
```
rendering/   # render passes, post-processing
shaders/     # GLSL source files (vertex, fragment, utility)
water/       # WaterMesh class and water-specific logic
math/        # wave math, Gerstner utilities, vector operations
utilities/   # helpers, config loaders, procedural texture generators
textures/    # BRDF LUT, normal maps, foam masks (generated or baked)
```
**Current state:** Only `water/` exists. Shaders are embedded as template literals in `WaterMesh.ts`. The other directories are planned for future expansion.

### ✅ Step 3 — Ocean Mesh Implementation
- `PlaneGeometry` with configurable size (1000×1000) and resolution (256×256 segments)
- Centered at origin, rotated -90° on X axis to lie flat on the XZ plane
- GPU vertex displacement via Gerstner waves
- No textures or lighting in the base geometry
- TypeScript class extending `Mesh<BufferGeometry, ShaderMaterial>`

### ✅ Step 4 — Gerstner Wave Simulation
- Multiple wave layers (3 configured, up to 8 supported)
- Configurable per-layer: amplitude, wavelength, speed, direction, steepness
- Displacement performed entirely in the vertex shader
- **Analytical normals** computed via partial derivatives (tangent vectors) crossed together
- No numerical finite-difference approximations used
- Wave parameters passed as uniform arrays

**Default wave layers:**
| Layer | Amplitude | Wavelength | Speed | Direction | Steepness |
|-------|-----------|------------|-------|-----------|-----------|
| 1     | 2.0m      | 40m        | 12m/s | (1, 0.3)  | 0.4       |
| 2     | 1.0m      | 12m        | 6m/s  | (0.5, 1)  | 0.5       |
| 3     | 0.5m      | 5m         | 3m/s  | (-1, 0.7) | 0.6       |

### ✅ Step 5 — Physically Based Lighting (Full PBR)
The fragment shader implements a complete PBR pipeline with 10 equations:

1. **Schlick Fresnel** — angle-dependent reflectance using F₀ from IOR
2. **GGX/Trowbridge-Reitz NDF** — microfacet normal distribution
3. **Smith Geometric Shadowing (Schlick-GGX)** — visibility/masking term
4. **Cook-Torrance Specular BRDF** — combines D·G·F / (4·N·V)
5. **Energy-Conserving Diffuse** — (1-F)·(1-metalness)·albedo/π
6. **HDR Environment Map Reflections** — PMREM prefiltered CubeTexture
7. **BRDF Integration** — analytical fallback (closed-form approximation)
8. **Fresnel-Weighted Irradiance** — diffuse environment lighting
9. **Subsurface Scattering Approximation** — rim-lighting effect
10. **ACES Filmic Tone Mapping** — cinematic HDR→LDR curve + gamma correction

Additional effects:
- **Foam/whitecaps** at wave crests using elevation-based smoothstep
- **Depth-based color** gradient (deep color in troughs → shallow color at crests)
- **Metalness compatibility** (water is a dielectric, metalness=0)

**Detailed equation explanations** are in `PBR_EXPLAINED.md` (639 lines, 10 equations with references).

---

## 3. Current File Structure

```
├── index.html              # Minimal HTML container with fullscreen canvas
├── main.ts                 # Entry point: scene, camera, renderer, PMREM, animation loop
├── water/
│   └── WaterMesh.ts        # Ocean mesh class with embedded GLSL shaders (~898 lines)
├── PBR_EXPLAINED.md        # Detailed documentation of all 10 PBR equations
├── AI_CONTEXT.md           # This file
├── package.json            # Dependencies: three, typescript, vite
├── tsconfig.json           # TypeScript config: ES2022, strict, ESNext modules
├── vite.config.ts          # Vite config: root '.', dist output, auto-open
└── .gitignore              # Standard ignores (node_modules, dist)
```

### File Responsibilities

| File | Responsibility |
|------|---------------|
| `index.html` | Minimal HTML shell. Fullscreen canvas, black background, imports `main.ts` as module. |
| `main.ts` | Application entry. Creates scene, camera, renderer, procedural sky, PMREM environment maps, instantiates `WaterMesh`, sets up OrbitControls, runs animation loop. |
| `water/WaterMesh.ts` | Core ocean renderer. Contains `WaterMesh` class, `GerstnerWaveConfig` interface, vertex shader (Gerstner displacement + analytical normals), fragment shader (full PBR pipeline). |
| `PBR_EXPLAINED.md` | Reference documentation. Explains every equation in the fragment shader with physics, math, GLSL code, and academic references. |

---

## 4. Rendering Pipeline (Data Flow)

```
┌─────────────────────────────────────────────────────────────┐
│                    main.ts                                   │
│                                                               │
│  1. Create procedural sky scene (gradient + sun shader)     │
│  2. PMREMGenerator.fromScene() → envMap (prefiltered)       │
│  3. PMREMGenerator.fromScene(blur) → irradianceMap          │
│  4. new WaterMesh({ envMap, irradianceMap, ... })           │
│  5. animation loop: water.update(elapsedTime)               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 water/WaterMesh.ts                           │
│                                                               │
│  VERTEX SHADER:                                               │
│    • Read original vertex position (y≈0 on XZ plane)         │
│    • For each Gerstner layer:                                 │
│        - Compute phase φ = k·(d·p₀) - ω·t                   │
│        - Accumulate displacement (x', y', z')                │
│        - Accumulate analytical tangent components (tx, tz)   │
│    • Normal = normalize(cross(tx, tz))                       │
│    • Pass: vWorldPosition, vNormal, vElevation to fragment   │
│                                                               │
│  FRAGMENT SHADER:                                             │
│    • Compute V, L, H directions                               │
│    • Eq 1: Fresnel = fresnelSchlick(H·V, F₀)                │
│    • Eq 2: D = distributionGGX(N·H, roughness)              │
│    • Eq 3: G = geometrySmith(N·V, N·L, roughness)           │
│    • Eq 4: kSpec = D·G·F / (4·N·V·N·L)                     │
│    • Eq 5: kDiff = (1-F)·(1-metalness)·albedo/π            │
│    • Direct = (kSpec + kDiff) · lightColor · N·L            │
│    • Eq 6: envColor = textureLod(envMap, R, roughness*4)    │
│    • Eq 7: brdfFactor = analytical BRDF integration         │
│    • Eq 8: envDiffuse = (1-F(N,V)) · irradiance(N) · albedo│
│    • Eq 9: SSS = sssColor · rim · (1-F) · wrapLight        │
│    • Foam = foamColor · smoothstep(threshold, elevation)    │
│    • color = direct + envSpecular + envDiffuse + SSS + foam │
│    • Eq 10: ACES tone mapping + gamma (1/2.2)               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Output                                     │
│  • ACES tone-mapped, gamma-corrected pixel                  │
│  • Rendered to fullscreen canvas                             │
│  • OrbitControls allow camera navigation                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Key Design Decisions

### Gerstner Waves Over FFT
- **Choice:** Analytical Gerstner waves with up to 8 layers
- **Reason:** Simpler implementation, fully analytical normals, visually excellent for most scenarios. FFT would be more physically accurate but requires complex spectral energy distribution setup and numerical normal computation.

### Analytical Normals Over Finite Difference
- **Choice:** Compute tangent vectors as partial derivatives, then cross product
- **Reason:** Exact normals with no numerical artifacts. Finite difference methods produce visible errors at high frequencies and require careful grid alignment.

### PMREM Over Runtime Convolution
- **Choice:** Use Three.js `PMREMGenerator` to prefilter environment maps at startup
- **Reason:** PMREM produces a correct GGX-convolved mip chain. Runtime convolution would be prohibitively expensive. The one-time cost at startup is acceptable.

### Single-Mesh, Single-Pass Approach
- **Choice:** Everything in one `ShaderMaterial` on one mesh
- **Reason:** Simplicity and performance. No additional render targets, no post-processing passes yet. This can be expanded to multi-pass later for refraction, caustics, and underwater effects.

### Analytical BRDF Integration (No LUT)
- **Choice:** Closed-form approximation `(1-N·V)⁵ · (1-F₀) + F₀`
- **Reason:** No texture lookup needed. Less accurate than a precomputed BRDF LUT but the visual difference is subtle. A LUT can be added later.

### Embedded Shaders in TypeScript
- **Choice:** GLSL as template literals inside `.ts` files
- **Reason:** Keeps everything in one file, easy to edit. Planned to extract to separate `.glsl` files in a `shaders/` directory for the final showcase.

---

## 6. Shader Uniforms Reference

### Vertex Shader Uniforms
| Uniform | Type | Description |
|---------|------|-------------|
| `uTime` | `float` | Current time in seconds (updated each frame) |
| `uWaveCount` | `int` | Number of active wave layers (0-8) |
| `uAmplitude[8]` | `float[]` | Wave amplitude in meters |
| `uWavelength[8]` | `float[]` | Wave wavelength in meters |
| `uSpeed[8]` | `float[]` | Wave propagation speed in m/s |
| `uDirection[8]` | `vec2[]` | Wave direction on XZ plane (normalized) |
| `uSteepness[8]` | `float[]` | Gerstner shape parameter q ∈ [0,1] |

### Fragment Shader Uniforms
| Uniform | Type | Description |
|---------|------|-------------|
| `uRoughness` | `float` | GGX roughness (0=mirror, 1=diffuse). Default: 0.15 |
| `uMetalness` | `float` | Metalness factor. Water=0 (dielectric) |
| `uF0` | `vec3` | Base reflectance at normal incidence. ~0.023 for water |
| `uLightDir` | `vec3` | Directional light direction (world space) |
| `uLightColor` | `vec3` | Directional light color (HDR values allowed) |
| `uEnvMap` | `samplerCube` | PMREM prefiltered environment map |
| `uIrradianceMap` | `samplerCube` | Irradiance map for diffuse environment |
| `uBRDFLUT` | `sampler2D` | BRDF lookup texture (optional, analytical fallback used) |
| `uDeepColor` | `vec3` | Deep water color (troughs). Default: [0, 0.05, 0.15] |
| `uShallowColor` | `vec3` | Shallow water color (crests). Default: [0, 0.5, 0.6] |
| `uFoamColor` | `vec3` | Foam color. Default: [0.95, 0.95, 0.95] |
| `uFoamThreshold` | `float` | Elevation threshold for foam. Default: 2.5 |
| `uSSSColor` | `vec3` | Subsurface scattering color. Default: [0, 0.35, 0.45] |
| `uSSSScale` | `float` | SSS effect scale. Default: 8.0 |

---

## 7. What Remains (Future Development)

### High Priority
- [ ] **Refraction pass** — Render scene geometry through the water surface using a screen-space refraction technique
- [ ] **Caustics** — Compute focusing/defocusing patterns from wave normals, project onto a render target
- [ ] **Shoreline interaction** — Foam accumulation near land, depth-based foam density, wet sand transitions
- [ ] **Underwater camera** — Support camera below water surface with caustic lighting and volumetric effects

### Medium Priority
- [ ] **Shader file separation** — Extract GLSL from `.ts` files into `shaders/` directory
- [ ] **BRDF LUT texture** — Generate a proper 2D BRDF lookup texture for more accurate environment integration
- [ ] **FFT wave simulation** — Add optional FFT-based wave spectrum for more realistic ocean spectra
- [ ] **Foam texture** — Replace elevation-based foam with a procedural or texture-based foam system

### Performance Optimizations
- [ ] **Distance-based LOD** — Reduce wave layers and geometry resolution at distance
- [ ] **Tiling shader** — Repeat a smaller high-resolution mesh instead of one giant plane
- [ ] **Instanced rendering** — Support multiple water bodies efficiently
- [ ] **Compute shader waves** — Move wave computation to WebGL2 compute shaders (future)

### Architecture Expansion
- [ ] Create `shaders/` directory with separate `.glsl` files
- [ ] Create `math/` for wave computation utilities
- [ ] Create `rendering/` for render passes (refraction, caustics, post-processing)
- [ ] Create `utilities/` for helpers and procedural generators
- [ ] Create `textures/` for generated textures (BRDF LUT, foam masks)

---

## 8. Academic References

1. Cook, R. & Torrance, K. (1982). "A model for reflection from rough surfaces." SIGGRAPH.
2. Schlick, C. (1995). "An inexpensive BRDF model for physically based rendering." Journal of Graphics Tools.
3. Trowbridge, B. & Reitz, K. (1975). "Average information reflected from a roughened sphere." J. Opt. Soc. Am.
4. Walter, B. et al. (2007). "Microfacet models for refraction through rough surfaces." SIGGRAPH / EGSR.
5. Epic Games. "Moving Frostbite to PBR." Frostbite Technology Document.
6. Burley, M. & Borshukov, A. (2014). "An Analytic Model for Phase One's Tone Reproduction Preview." ACM SIGGRAPH.
7. Gerstner, F. (1809). "Theorie der Wellen." Annalen der Physik.

---

## 9. Quick Start for AI Assistants

```
1. Read this file first to understand the project
2. Read PBR_EXPLAINED.md for detailed equation documentation
3. Read water/WaterMesh.ts for the core implementation
4. Read main.ts for the application entry point
5. Run `npm run dev` to see the renderer in action
```

**Important conventions:**
- All shaders use `/* glsl */` template literals for syntax highlighting
- Uniforms are prefixed with `u` (e.g., `uTime`, `uRoughness`)
- Varyings are prefixed with `v` (e.g., `vWorldPosition`, `vNormal`)
- Wave directions use `[dx, dy]` where `dy` represents the Z axis
- Y axis is up, XZ plane is the water surface
- The project uses strict TypeScript with ES2022 target