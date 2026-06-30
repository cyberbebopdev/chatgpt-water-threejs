# TODO.md — Actionable Task Backlog

> **Last Updated:** June 30, 2026
> **Current Phase:** Phase 1 complete, preparing for Phase 2

---

## Phase 2 — Code Quality (Next)

### P2.1 Extract Shaders to `shaders/` Directory
- [ ] Create `shaders/water/` directory
- [ ] Extract vertex shader GLSL to `shaders/water/water.vert`
- [ ] Extract fragment shader GLSL to `shaders/water/water.frag`
- [ ] Extract shared functions (fresnelSchlick, distributionGGX, geometrySchlickGGX, brdfIntegrationAnalytical) to `shaders/water/water.lib.glsl`
- [ ] Update `WaterMesh.ts` to read shader files via `import` + `raw` module imports
- [ ] Extract sky fragment shader to `shaders/sky/sky.frag`
- [ ] Update `main.ts` to import sky shader from file
- [ ] Verify `npm run dev` still works after extraction
- [ ] Verify `npm run build` produces correct output

### P2.2 Split WaterMesh Configuration
- [ ] Create `water/WaterConfig.ts` with default config and type definitions
- [ ] Move `GerstnerWaveConfig` and `WaterMeshConfig` interfaces to `WaterConfig.ts`
- [ ] Move `defaultConfig` constant to `WaterConfig.ts`
- [ ] Update `WaterMesh.ts` to import from `WaterConfig.ts`
- [ ] Update `main.ts` to import config types from `water/WaterConfig.js`

### P2.3 Create `math/` Utilities
- [ ] Create `math/GerstnerWaves.ts` — wave phase computation, displacement, tangent math
- [ ] Move `normalizeDirection2()` helper to `math/GerstnerWaves.ts`
- [ ] Add unit tests or validation functions for wave parameters
- [ ] Create `math/BRDFLUTGenerator.ts` — offline BRDF LUT texture generation

### P2.4 Code Quality
- [ ] Add JSDoc comments to all public APIs in `WaterMesh.ts`
- [ ] Add TypeScript strict mode audit — ensure no implicit `any`
- [ ] Configure ESLint with TypeScript + Three.js rules
- [ ] Add Prettier configuration for consistent formatting

---

## Phase 3 — Visual Enhancements

### P3.1 Screen-Space Refraction Pass
- [ ] Create `rendering/RefractionPass.ts` extending Three.js `Pass`
- [ ] Implement screen-space refraction using water normal map
- [ ] Render scene geometry to render target (background to refract)
- [ ] Sample background render target with normal-based offset in water fragment shader
- [ ] Add `uRefractionStrength` uniform for control
- [ ] Add `uCameraNearPlane` uniform for depth-aware refraction

### P3.2 Caustics
- [ ] Create `rendering/CausticsPass.ts`
- [ ] Compute caustic patterns from wave normals (normal variation → light focusing)
- [ ] Project caustics onto render target
- [ ] Composite caustics over water surface or onto geometry
- [ ] Add `uCausticsIntensity` uniform

### P3.3 BRDF LUT Texture
- [ ] Implement offline BRDF LUT generation shader (256x256 2D texture)
- [ ] X-axis: NdotV (0 to 1), Y-axis: roughness (0 to 1)
- [ ] Generate LUT once at build time, save as PNG
- [ ] Load LUT in `main.ts`, pass to `WaterMesh`
- [ ] Enable `USE_BRDF_LUT` define in fragment shader
- [ ] Compare visual quality vs analytical fallback

### P3.4 Procedural Foam System
- [ ] Create `utilities/ProceduralTextures.ts`
- [ ] Generate foam noise texture (Perlin/simplex noise)
- [ ] Add foam advection shader (noise displaced by wave velocities)
- [ ] Replace elevation-based foam with texture-based foam mask
- [ ] Add foam accumulation near edges (precursor to shoreline)

---

## Phase 4 — Scene Complexity

### P4.1 Shoreline Interaction
- [ ] Add depth map uniform for water depth
- [ ] Implement foam accumulation near shallow areas
- [ ] Add wet sand transition shader (foam → wet → dry)
- [ ] Create simple shoreline geometry (beach/rock) to test against
- [ ] Depth-based wave attenuation (smaller waves near shore)

### P4.2 Underwater Camera
- [ ] Create `rendering/UnderwaterPass.ts`
- [ ] Detect when camera is below water surface (Y < 0)
- [ ] Render underwater view with caustic lighting patterns
- [ ] Add volumetric light shafts (God rays approximation)
- [ ] Add depth-based color absorption (red fades first)
- [ ] Add surface view from below (upward Fresnel, caustics on geometry)

### P4.3 Distance-Based LOD
- [ ] Implement camera distance check in vertex shader
- [ ] Reduce active wave layers based on distance from camera
- [ ] Add geometry LOD (reduce segments at distance)
- [ ] Consider instanced tiling: repeat smaller high-res mesh

### P4.4 Tiling Shader
- [ ] Implement UV tiling for infinite ocean appearance
- [ ] Use modular arithmetic in wave phase computation
- [ ] Test with 50x50 mesh repeated across 1000x1000 area
- [ ] Verify seamless tile boundaries (no visible seams)

---

## Phase 5 — Advanced Simulation

### P5.1 FFT Wave Spectrum
- [ ] Research Disney Ocean / GPU Gems 3 FFT ocean approach
- [ ] Implement FFT-based heightmap generation
- [ ] Compute normals from FFT heightmap (finite difference or analytical)
- [ ] Add option to switch between Gerstner and FFT modes
- [ ] Benchmark performance vs Gerstner waves

### P5.2 Compute Shader Waves
- [ ] Research WebGL2 compute shader support in Three.js
- [ ] Move wave displacement computation to compute shader
- [ ] Store wave state in storage texture
- [ ] Read displacement texture in vertex shader
- [ ] Enable temporal coherence (wave state persists between frames)

### P5.3 Environmental Effects
- [ ] Wind-driven roughness variation (stronger wind → higher roughness)
- [ ] Add `uWindSpeed` and `uWindDirection` uniforms
- [ ] Rain particle system interacting with water surface
- [ ] Splash/ripple effects at rain impact points

---

## Phase 6 — Polish & Showcase

### P6.1 Post-Processing Pipeline
- [ ] Set up Three.js `EffectComposer`
- [ ] Add bloom pass for specular highlights
- [ ] Add color grading / LUT pass
- [ ] Add dithering pass to reduce banding
- [ ] Ensure ACES tone mapping in shader is compatible with post-processing

### P6.2 Interactive UI
- [ ] Add `lil-gui` or `tweakpane` for live parameter control
- [ ] Expose: roughness, foam threshold, wave amplitudes, colors
- [ ] Add preset configurations (calm sea, stormy ocean, tropical lagoon)
- [ ] Save/load configurations to localStorage

### P6.3 Performance
- [ ] Add FPS counter with frame time display
- [ ] Benchmark shader performance on target devices
- [ ] Profile GPU time with Chrome DevTools / RenderDoc
- [ ] Optimize fragment shader: reduce redundant computations
- [ ] Consider instanced rendering for multiple water bodies

### P6.4 Documentation Site
- [ ] Create demo page with screenshots and video
- [ ] Document all uniforms and their visual effects
- [ ] Add comparison screenshots (before/after each feature)
- [ ] Publish to GitHub Pages or separate deployment

---

## Quick Wins (Can Do Anytime)

- [ ] Add sky color as configurable uniform (currently hardcoded in procedural sky)
- [ ] Add sun position as configurable uniform
- [ ] Add night mode (dark sky, moon reflections, bioluminescence)
- [ ] Add fog that interacts with water surface
- [ ] Improve foam visual quality (currently simple smoothstep)
- [ ] Add specular highlight animation (sparkles on wave crests)
- [ ] Document all known visual artifacts and their causes

---

## Notes

- **Priority order:** Work through phases sequentially. Each phase builds on the previous one.
- **Documentation rule:** Update `CURRENT_STATE.md`, `SESSION_SUMMARY.md`, and this file after every significant session.
- **AI handoff:** These documents (`AI_CONTEXT.md`, `PROJECT.md`, `CURRENT_STATE.md`, `SESSION_SUMMARY.md`, `TODO.md`) are designed to be read by AI assistants to continue work seamlessly.