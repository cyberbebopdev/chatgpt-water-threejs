# PROJECT.md — Architecture & Conventions

> **Project:** Realistic PBR Water Renderer
> **Stack:** Three.js r180+ · TypeScript 5.4+ · Vite 5.4+ · GLSL
> **Repository:** `github.com/cyberbebopdev/chatgpt-water-threejs`

---

## 1. Vision

Build one of the most realistic open-source water renderers as a single-page graphics showcase. The renderer uses a physically based pipeline (Cook-Torrance microfacet BRDF) with Gerstner wave simulation, targeting photographic quality as the long-term goal.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        main.ts                                │
│  Scene · Camera · Renderer · PMREM · Controls · Loop        │
└──────────────────────────────────┬───────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                     water/WaterMesh.ts                        │
│  WaterMesh class extending Three.js Mesh                     │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Vertex Shader                                         │   │
│  │  · Gerstner wave displacement (up to 8 layers)        │   │
│  │  · Analytical normals via tangent cross product       │   │
│  │  · Outputs: worldPosition, normal, elevation          │   │
│  └───────────────────────────────────────────────────────┘   │
│                        │                                      │
│                        ▼                                      │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Fragment Shader — Full PBR Pipeline                  │   │
│  │  1.  Schlick Fresnel                                  │   │
│  │  2.  GGX/Trowbridge-Reitz NDF                         │   │
│  │  3.  Smith Geometric Shadowing (Schlick-GGX)          │   │
│  │  4.  Cook-Torrance Specular BRDF                      │   │
│  │  5.  Energy-Conserving Diffuse                        │   │
│  │  6.  PMREM Environment Reflections                    │   │
│  │  7.  BRDF Integration (analytical fallback)           │   │
│  │  8.  Fresnel-Weighted Irradiance                      │   │
│  │  9.  Subsurface Scattering Approximation              │   │
│  │  10. ACES Filmic Tone Mapping + Gamma                 │   │
│  │  + Foam/Whitecaps · Depth Color Gradient              │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Single-pass first** — Everything runs in one `ShaderMaterial` on one mesh. Multi-pass features (refraction, caustics) will be added incrementally.
2. **Analytical over numerical** — Normals computed via partial derivatives, not finite differences. Closed-form BRDF integration until a LUT is available.
3. **GPU-driven** — All wave displacement and normal computation happens in the vertex shader. CPU only updates `uTime`.
4. **Physically based** — Every lighting term traces back to measured optics or peer-reviewed approximations. See `PBR_EXPLAINED.md` for references.

---

## 3. Directory Structure

### Current (Minimal)

```
chatgpt-water-tutorial/
├── index.html              # HTML shell — fullscreen canvas
├── main.ts                 # Entry point — scene, PMREM, animation loop
├── water/
│   └── WaterMesh.ts        # Core ocean renderer — class + embedded GLSL
├── AI_CONTEXT.md           # Architecture doc for AI assistants
├── PBR_EXPLAINED.md        # Equation documentation with references
├── CURRENT_STATE.md        # Project snapshot — what works, what's next
├── PROJECT.md              # This file — architecture & conventions
├── SESSION_SUMMARY.md      # Last session changelog
├── TODO.md                 # Actionable task backlog
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config
├── .gitignore
└── node_modules/
```

### Target (After Expansion)

```
chatgpt-water-tutorial/
├── index.html
├── main.ts
├── water/
│   ├── WaterMesh.ts        # WaterMesh class (no embedded shaders)
│   └── WaterConfig.ts      # Configuration types and defaults
├── shaders/
│   ├── water/
│   │   ├── water.vert      # Vertex shader — Gerstner + normals
│   │   ├── water.frag      # Fragment shader — full PBR pipeline
│   │   └── water.lib.glsl  # Shared functions (fresnel, ggx, etc.)
│   ├── sky/
│   │   └── sky.frag        # Procedural sky gradient shader
│   └── post/
│       ├── refraction.frag # Screen-space refraction pass
│       └── caustics.frag   # Caustic projection pass
├── math/
│   ├── GerstnerWaves.ts    # Wave math utilities
│   └── BRDFLUTGenerator.ts # Offline BRDF LUT generation
├── rendering/
│   ├── RefractionPass.ts   # Render scene through water surface
│   ├── CausticsPass.ts     # Compute caustic patterns
│   └── UnderwaterPass.ts   # Below-surface volumetric effects
├── utilities/
│   ├── ProceduralTextures.ts # Foam masks, noise textures
│   └── ConfigLoader.ts     # Load wave/PBR configs from JSON
├── textures/
│   ├── brdf-lut.png        # Precomputed BRDF lookup texture
│   └── foam.png            # Foam displacement/alpha texture
└── docs/
    ├── AI_CONTEXT.md
    ├── PBR_EXPLAINED.md
    ├── CURRENT_STATE.md
    ├── PROJECT.md
    ├── SESSION_SUMMARY.md
    └── TODO.md
```

**Migration path:** Shader extraction (`shaders/`) is the first structural change. Then `math/` for wave utilities, then `rendering/` for multi-pass features.

---

## 4. Coding Conventions

### TypeScript

| Convention | Rule |
|------------|------|
| **Target** | ES2022 |
| **Modules** | ESNext (ESM) |
| **Strict mode** | Enabled — no `any`, no implicit this |
| **Naming** | PascalCase for classes/interfaces, camelCase for functions/variables |
| **Exports** | Named exports only — no default exports |
| **Config types** | Interface per module with `Partial<T>` constructor patterns |

### GLSL Shaders

| Convention | Rule |
|------------|------|
| **Uniforms** | Prefixed with `u` — `uTime`, `uRoughness`, `uEnvMap` |
| **Varyings** | Prefixed with `v` — `vWorldPosition`, `vNormal`, `vElevation` |
| **Constants** | UPPER_SNAKE_CASE — `PI`, `MAX_WAVES` |
| **Functions** | lowercase with descriptive names — `fresnelSchlick()`, `distributionGGX()` |
| **Comments** | Each equation block documented with physics, math, and reference |
| **Embedding** | Template literals with `/* glsl */` directive for syntax highlighting |

### Wave Parameters

| Convention | Rule |
|------------|------|
| **Direction** | `[dx, dz]` two-element tuple — second component is Z axis |
| **Coordinate system** | Y is up, XZ is the water surface plane |
| **Units** | Meters for distances, meters/second for speeds |

### File Organization

- One class per file
- Shader code co-located with its mesh class (until extraction to `shaders/`)
- Documentation in `docs/` directory (currently at root until expansion)

---

## 5. Rendering Pipeline

### Current: Single-Pass

```
main.ts
  ├── createProceduralSkyScene()  → sky dome + sun shader
  ├── PMREMGenerator.fromScene()  → prefiltered envMap (specular)
  ├── PMREMGenerator.fromScene(blur) → irradianceMap (diffuse)
  ├── new WaterMesh({ envMap, irradianceMap, ... })
  └── animate() → water.update(elapsed) → controls.update() → render()
```

### Future: Multi-Pass

```
main.ts
  ├── Pass 1: Geometry pass — water mesh with displacement + normals
  ├── Pass 2: Refraction pass — scene geometry through water surface
  ├── Pass 3: Caustics pass — wave normal patterns projected to targets
  ├── Pass 4: Composite — combine specular, refraction, caustics, SSS
  └── Pass 5: Post-processing — bloom, color grading, dither
```

Multi-pass will use Three.js `EffectComposer` with custom `Pass` subclasses in `rendering/`.

---

## 6. Environment & Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |
| TypeScript | 5.4+ | Type-safe development |
| Vite | 5.4+ | Dev server, HMR, production builds |
| Three.js | r180+ | 3D rendering engine |

### Commands

```bash
npm run dev       # Start dev server, auto-open browser
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

---

## 7. Documentation Strategy

| Document | Audience | Purpose |
|----------|----------|---------|
| `AI_CONTEXT.md` | AI assistants, new developers | Full architecture, data flow, design decisions |
| `PBR_EXPLAINED.md` | Graphics programmers, academics | 10 PBR equations with math, GLSL, references |
| `CURRENT_STATE.md` | Project maintainers | What works, what's next, configuration defaults |
| `PROJECT.md` | All contributors | This file — architecture, conventions, roadmap |
| `SESSION_SUMMARY.md` | Dev team, AI context | What changed in the last session |
| `TODO.md` | Dev team, AI assistants | Actionable task backlog with priorities |

**Rule:** After every significant session, update `SESSION_SUMMARY.md`, `CURRENT_STATE.md`, and `TODO.md`. These keep AI assistants and human collaborators synchronized.

---

## 8. Long-Term Roadmap

### Phase 1 — Foundation (✅ Complete)
- Project scaffolding, Gerstner waves, full PBR fragment shader
- Procedural sky, PMREM environment maps, OrbitControls
- Comprehensive documentation

### Phase 2 — Code Quality (Next)
- Extract GLSL shaders to `shaders/` directory
- Split `WaterMesh.ts` into class + config files
- Add `math/` for wave utilities
- Populate documentation backlog

### Phase 3 — Visual Enhancements
- Screen-space refraction pass
- Caustic computation and projection
- BRDF LUT texture for accurate environment integration
- Procedural foam texture system

### Phase 4 — Scene Complexity
- Shoreline interaction with foam accumulation
- Underwater camera with volumetric effects
- Distance-based LOD system
- Tiling shader for infinite ocean

### Phase 5 — Advanced Simulation
- FFT-based wave spectrum (optional)
- WebGL2 compute shaders for wave computation
- Wind-driven roughness variation
- Rain/wind particle systems

### Phase 6 — Polish & Showcase
- Post-processing pipeline (bloom, color grading)
- Interactive UI for parameter tuning
- Benchmark suite and performance optimizations
- Demo reel and documentation site

---

## 9. Git Conventions

- **Branch model:** Main branch is `main`. Feature work on short-lived branches.
- **Commit messages:** Imperative mood, describe what and why — `add refraction pass`, `extract shaders to shaders/`
- **Documentation commits:** Commit documentation updates with the code changes they describe.