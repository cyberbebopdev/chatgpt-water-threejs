# Physically Based Water Rendering — Every Equation Explained

This document explains every equation used in the PBR water shader implemented in `water/WaterMesh.ts` and `main.ts`. It is organized as a progressive walkthrough: from the physics of light interaction, through the microfacet BRDF, to the final tone-mapped pixel.

---

## Table of Contents

1. [The Microfacet Model](#1-the-microfacet-model)
2. [Equation 1 — Fresnel Effect & Schlick Approximation](#equation-1--fresnel-effect--schlick-approximation)
3. [Equation 2 — GGX / Trowbridge-Reitz Normal Distribution Function](#equation-2--ggx--trowbridge-reitz-normal-distribution-function)
4. [Equation 3 — Smith Geometric Shadowing-Masking](#equation-3--smith-geometric-shadowing-masking)
5. [Equation 4 — Cook-Torrance Specular BRDF](#equation-4--cook-torrance-specular-brdf)
6. [Equation 5 — Energy-Conserving Diffuse](#equation-5--energy-conserving-diffuse)
7. [Equation 6 — HDR Environment Map Reflections](#equation-6--hdr-environment-map-reflections)
8. [Equation 7 — BRDF Integration](#equation-7--brdf-integration)
9. [Equation 8 — Fresnel-Weighted Irradiance](#equation-8--fresnel-weighted-irradiance)
10. [Equation 9 — Subsurface Scattering Approximation](#equation-9--subsurface-scattering-approximation)
11. [Equation 10 — ACES Filmic Tone Mapping](#equation-10--aces-filmic-tone-mapping)
12. [Putting It All Together](#12-putting-it-all-together)

---

## 1. The Microfacet Model

Before diving into equations, understand the **microfacet model** that underlies all of them.

### The Core Idea

Real surfaces are not perfectly smooth. At a microscopic scale, they are covered in tiny facets (microfacets), each with its own orientation. The microfacet model treats each facet as a perfect mirror. The macroscopic appearance of the surface emerges from the statistical distribution of these facet normals.

### Three Questions the Model Answers

When a light ray arrives from direction **L** and the camera looks from direction **V**:

1. **D (Distribution)**: How many microfacets are oriented along the half-vector **H = normalize(L + V)**? These are the facets that would reflect L toward V.
2. **G (Geometry)**: Of those facets, how many are visible from both L and V? Some are shadowed or occulted.
3. **F (Fresnel)**: Of the visible facets, how much light do they reflect? This depends on the angle.

The Cook-Torrance BRDF combines these three:

```
f(L, V) = (D · G · F) / (4 · N·V)
```

---

## Equation 1 — Fresnel Effect & Schlick Approximation

### The Physics

The **Fresnel effect** describes how reflectivity changes with viewing angle. This is one of the most fundamental phenomena in optics:

- **Normal incidence** (looking straight at a surface): minimal reflection
- **Grazing incidence** (looking along the surface): nearly 100% reflection

This is why a calm pool of water looks mostly transparent when you look straight down, but acts like a perfect mirror when you look toward the horizon.

### The Exact Fresnel Equations

The exact solution comes from Maxwell's equations and involves the complex index of refraction. For a dielectric (non-metal) with IOR `n`:

```
F(θ) = ½ · [ ((n·cosθᵢ - cosθₜ) / (n·cosθᵢ + cosθₜ))² +
             ((n·cosθₜ - cosθᵢ) / (n·cosθₜ + cosθᵢ))² ]
```

where `θᵢ` is the incident angle and `θₜ` is the transmitted angle (from Snell's law). This requires `sin`, `cos`, `acos`, and a square root — expensive to compute per-pixel.

### Schlick's Approximation

Christophe Schlick (1995) proposed a brilliant simplification:

```
F(θ) = F₀ + (1 − F₀) · (1 − cos θ)⁵
```

**Where:**
- **F₀** — reflectance at normal incidence (θ = 0°). For dielectrics:
  ```
  F₀ = ((n − 1) / (n + 1))²
  ```
  - Water (n = 1.33): F₀ ≈ 0.023 (2.3% reflection)
  - Glass (n = 1.5): F₀ ≈ 0.040 (4% reflection)
  - Diamond (n = 2.42): F₀ ≈ 0.170 (17% reflection)

- **θ** — the angle between the view direction and the microfacet normal. In the shader, we use `cos θ = H·V` where H is the half-vector.

**Why power 5?** Schlick tested various exponents and found that 5 fits the exact Fresnel equations to within ~1% error for most dielectric materials. The curve:
- Stays flat near θ = 0°: `(1-1)⁵ = 0`, so F ≈ F₀
- Rises sharply near θ = 90°: `(1-0)⁵ = 1`, so F → 1

**In our shader:**
```glsl
vec3 F = fresnelSchlick(HdotV, uF0);
// HdotV = max(dot(H, V), 0.0)
// uF0 = vec3(0.023) for water
```

**For metals**, F₀ is not a scalar but a colour vector (the metal's albedo). Gold has F₀ ≈ (0.75, 0.58, 0.24), which is why gold reflections are golden. Our water uses a scalar F₀ because water is a dielectric.

**Reference:** Schlick, C. (1995). "An inexpensive BRDF model for physically based rendering." *Journal of Graphics Tools*.

---

## Equation 2 — GGX / Trowbridge-Reitz Normal Distribution Function

### What is the NDF?

The **Normal Distribution Function** D(m) describes the statistical density of microfacet normals oriented along direction m. It answers: "What fraction of the surface has facets pointing in direction m?"

### The GGX Formula

GGX (also called Trowbridge-Reitz) is the industry-standard NDF:

```
α = roughness²

D(N·H) = α / [ π · ((N·H)² · (α − 1) + 1)² ]
```

**Where:**
- **N** — the macro-surface normal (our analytical Gerstner wave normal)
- **H** — the half-vector: `H = normalize(L + V)`
- **α** — the "alpha" roughness parameter. We square the user's roughness value for perceptual linearity.

### Why α = roughness²?

If we used roughness directly, the visual response would be non-linear: small changes near 0 would be invisible, while changes near 1 would be dramatic. Squaring compresses the range so that small roughness values (0.0–0.3) have a more noticeable effect, which matches human perception.

| roughness | α = roughness² | Visual effect |
|-----------|----------------|---------------|
| 0.0       | 0.00           | Perfect mirror |
| 0.1       | 0.01           | Very sharp highlights |
| 0.15      | 0.0225         | Calm water |
| 0.3       | 0.09           | Choppy water |
| 0.5       | 0.25           | Rough surface |
| 1.0       | 1.00           | Fully diffuse |

### Why GGX over Beckmann?

The Beckmann distribution uses an exponential: `D ∝ exp(-(N·H)² / (α·(1-(N·H)²)))`. GGX uses a rational function with a squared denominator. The key difference:

- **GGX has "heavier tails"**: it preserves more energy at grazing angles
- This produces sharper, more realistic specular highlights at low roughness
- GGX better matches measured BRDFs from real materials

### Mathematical Behaviour

- **When N·H = 1** (perfect alignment): `D = α / (π · 1²) = α/π` — the peak height
- **When N·H → 0** (grazing): `D → α / (π · 1²) = α/π` — the non-zero tail

The non-zero tail is what makes GGX superior: even at grazing angles, some microfacets are oriented to reflect light, creating the characteristic "grazing angle highlight."

**In our shader:**
```glsl
float distributionGGX(float NdotH, float roughness) {
    float a   = roughness * roughness;    // α
    float a2  = a * a;                     // α²
    float d   = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / (PI * d * d);
}
```

**Reference:** Trowbridge & Reitz (1975). "Average information reflected from a roughened sphere." *J. Opt. Soc. Am.*

---

## Equation 3 — Smith Geometric Shadowing-Masking

### The Problem

Not every microfacet contributes to the reflection. Consider a rough surface:

- **Shadowing**: Some facets are blocked from the light by neighbouring facets that stick up higher
- **Masking (occulting)**: Some facets are hidden from the camera by intervening geometry

The **geometric term G** estimates the fraction of facets that are visible from BOTH the light and the viewer.

### The Smith Formulation

The full Smith-GGX separates visibility into two independent functions:

```
G = G₁(V) · G₁(L)
```

Each G₁ is the single-direction visibility function. The exact integral is expensive, so we use **Schlick's approximation**:

```
G₁(X) = (X·N) / [(X·N) · (1 − k) + k]

k = roughness² / [2 · (roughness + 1)²]
```

**Where X** is either V (view direction) or L (light direction).

### Understanding k

The parameter `k` controls the severity of shadowing:

| roughness | k value | Interpretation |
|-----------|---------|----------------|
| 0.0       | 0.00    | No shadowing (perfect mirror) |
| 0.1       | 0.007   | Minimal shadowing |
| 0.5       | 0.0625  | Moderate shadowing |
| 1.0       | 0.25    | Heavy shadowing |

### Physical Behaviour

- **When roughness → 0**: k → 0, so `G₁(X) = (X·N)/(X·N) = 1`. No shadowing.
- **When X·N → 0** (grazing): `G₁(X) → 0`. Facets are hidden.
- **When roughness → 1**: k → 0.25, significant shadowing at all angles.

### Why the Product G₁(V) · G₁(L)?

Both conditions must be satisfied: the facet must be visible from the light AND from the camera. The product ensures this. This also guarantees **energy conservation**: the BRDF never reflects more energy than it receives.

**In our shader:**
```glsl
float geometrySchlickGGX(float NdotX, float roughness) {
    float r = roughness + 1.0;
    float k = (roughness * roughness) / (r * r);
    return NdotX / (NdotX * (1.0 - k) + k);
}

float geometrySmith(float NdotV, float NdotL, float roughness) {
    return geometrySchlickGGX(NdotV, roughness) *
           geometrySchlickGGX(NdotL, roughness);
}
```

**Reference:** Walter et al. (2007). "Microfacet models for refraction through rough surfaces." *SIGGRAPH / EGSR*.

---

## Equation 4 — Cook-Torrance Specular BRDF

### The Complete Formula

The Cook-Torrance BRDF combines D, G, and F into a single specular reflection model:

```
fₛ(L, V) = (D(H) · G(V, L) · F(H, V)) / (4 · N·V)
```

### The Denominator: 4 · N·V

The factor `4 · N·V` is the **geometric foreshortening** term. It arises from the change of variables when converting from the microfacet coordinate system to the macro-surface coordinate system.

Intuitively: when you look at a surface at a grazing angle (N·V → 0), the apparent area of the surface shrinks. The denominator accounts for this projection, ensuring the BRDF is energy-conserving.

**Warning**: When N·V → 0, the denominator approaches zero, which could cause division by zero. In our shader, we clamp `NdotV = max(dot(N, V), 0.001)` to prevent this.

### Why This Works

The microfacet model makes a key assumption: each microfacet is a perfect mirror. Light arriving from direction L is reflected toward V **only if** the microfacet normal equals the half-vector `H = normalize(L + V)`.

- **D(H)** tells us: how many facets are oriented along H?
- **G(V, L)** tells us: how many of those are visible from both L and V?
- **F(H, V)** tells us: how much light do those visible facets reflect?
- **4·N·V** converts from microfacet space to macro-surface space

### Energy Conservation

The BRDF is constructed to be energy-conserving:
- F ∈ [F₀, 1]: the reflected fraction never exceeds 100%
- G ≤ 1: the visible fraction never exceeds the total
- D integrates to a finite value over the hemisphere

This guarantees that the total reflected energy never exceeds the incoming energy — a fundamental requirement of physical plausibility.

**In our shader:**
```glsl
vec3 kSpec = (D * G * F) / (4.0 * NdotV * NdotL);
```

**Reference:** Cook & Torrance (1982). "A model for reflection from rough surfaces." *SIGGRAPH*.

---

## Equation 5 — Energy-Conserving Diffuse

### The Diffuse Partition

Light that is NOT reflected specularly enters the surface and scatters diffusely. The energy budget is:

```
Total incoming = Specular reflection + Diffuse scattering
1.0 = F + (1 − F)
```

The diffuse BRDF is:

```
fₔ = (1 − F) · (1 − metalness) · albedo / π
```

**Where:**
- **(1 − F)** — the fraction of light that enters the surface
- **(1 − metalness)** — for dielectrics (0), full diffuse. For metals (1), no diffuse.
- **albedo** — the base colour of the material
- **/ π** — normalizes the Lambertian lobe

### Why Divide by π?

A perfect Lambertian diffuse surface reflects light equally in all directions over the hemisphere. The integral of cos(θ) over a hemisphere is π:

```
∫ cos(θ) dω = ∫₀²π ∫₀^π/2 cos(θ) sin(θ) dθ dφ = π
```

Dividing by π ensures the hemispherical integral of the BRDF equals exactly 1.0 (when albedo = 1 and F = 0), guaranteeing energy conservation.

### Metalness Compatibility

The `(1 − metalness)` factor is what makes this compatible with the standard metalness workflow:

- **Dielectrics** (metalness = 0): `(1-0) = 1`, full diffuse term
- **Metals** (metalness = 1): `(1-1) = 0`, no diffuse term

Metals don't have a diffuse component because light that enters a metal is absorbed (converted to heat) rather than scattered. Water is a dielectric, so metalness = 0 and the full `(1 − F)` fraction is available for diffuse.

**In our shader:**
```glsl
vec3 albedo = mix(uDeepColor, uShallowColor, t);  // depth-based colour
vec3 kDiff = (1.0 - F) * (1.0 - uMetalness) * albedo / PI;
```

---

## Equation 6 — HDR Environment Map Reflections

### The Environment Integral

For indirect (environment) lighting, we integrate the BRDF over the hemisphere:

```
Loₑₙᵥ = ∫ fₛ(L, V) · Lₑₙᵥ(L) · (N·L) dω
```

This integral is computationally intractable at runtime for arbitrary environment maps.

### PMREM: Pre-Filtered Multi-Resolution Environment Maps

The solution (pioneered by Epic Games for Unreal Engine 4) is **PMREM**:

1. **Offline/one-time**: Pre-convolve the source HDR environment into a mip chain
2. **Each mip level** represents the integral of a GGX lobe at a specific roughness:
   ```
   MIP(level) = ∫ R · Dₐₗₚₕₐ(level)(R · H) · (N·R) dω
   ```
3. **At runtime**: Select the mip level based on roughness:
   ```
   lod = roughness · maxMipLevel
   envColor = textureLod(uEnvMap, R, lod)
   ```

### How Three.js PMREMGenerator Works

In `main.ts`, we use Three.js's `PMREMGenerator`:

```typescript
const pmremGenerator = new PMREMGenerator(renderer);
const envMap = pmremGenerator.fromScene(skyScene).texture;
```

The `fromScene()` method:
1. Renders the sky scene to a CubeTexture (6 faces)
2. Applies the PMREM convolution algorithm iteratively
3. Produces a mip chain where each level is progressively more blurred
4. Mip 0 = sharp reflections (roughness ≈ 0)
5. Higher mips = blurrier reflections (higher roughness)

### The Reflection Direction

```
R = reflect(-V, N) = -V + 2·(N·V)·N
```

This is the standard mirror reflection formula. For a perfect mirror (roughness = 0), we sample the environment at exactly R. For rough surfaces, the PMREM mip chain automatically provides the correct blurred sample.

**In our shader:**
```glsl
vec3 R = reflect(-V, N);
vec3 envColor = textureLod(uEnvMap, R, envMapRoughness * 4.0).rgb;
```

The `* 4.0` maps roughness ∈ [0, 1] to the mip range [0, 4] of the PMREM texture.

---

## Equation 7 — BRDF Integration

### The Missing Piece

The PMREM prefiltered map handles the D · (N·L) part of the integral, but the Fresnel term F still varies with the viewing angle. The full integral is:

```
Loₑₙᵥ = ∫ F(H,V) · Lₑₙᵥ(H) · (N·H) dω
```

### Separating with Schlick's Form

Since F uses Schlick's approximation, we can algebraically separate the integral:

```
F(θ) = F₀ + (1 − F₀) · (1 − cos θ)⁵
```

Substituting into the integral and expanding:

```
∫ [F₀ + (1−F₀)(1−cosθ)⁵] · L · (N·H) dω
= F₀ · ∫ L · (N·H) dω  +  (1−F₀) · ∫ (1−cosθ)⁵ · L · (N·H) dω
```

Both integrals depend **only** on N·V and roughness α (not on the environment map). This means they can be precomputed into a **2D lookup texture** (the BRDF LUT):

```
BRDF_LUT[NdotV][roughness] = (integral, scale)
```

Then:
```
Loₑₙᵥ = envColor · (scale · F₀ + integral)
```

### Analytical Fallback

When a BRDF LUT texture is not available, we use the closed-form approximation:

```
perceptualRoughness = (1 − N·V)⁵
brdfFactor = perceptualRoughness · (1 − F₀) + F₀
```

This is less accurate than the LUT but requires no texture lookup. It captures the essential behaviour: at grazing angles (N·V → 0), the BRDF contribution increases.

**In our shader:**
```glsl
vec3 brdfIntegrationAnalytical(float NdotV, vec3 F0) {
    float perceptualRoughness = pow(1.0 - NdotV, 5.0);
    return perceptualRoughness * (1.0 - F0) + F0;
}

vec3 envSpecular = envColor * brdfFactor;
```

**Reference:** Epic Games, "Moving Frostbite to PBR" — Section on precomputed BRDF.

---

## Equation 8 — Fresnel-Weighted Irradiance

### Diffuse Environment Lighting

The diffuse component also needs environment lighting. For a perfect Lambertian surface, the irradiance from an environment map is:

```
E = ∫ Lₑₙᵥ(L) · (N·L) dω
```

This is a **spherical convolution** that can be precomputed. Three.js PMREMGenerator produces an irradiance CubeTexture.

### Fresnel Weighting

The key insight: the diffuse contribution should be weighted by `(1 − F)` to ensure energy conservation:

```
Loₔ = (1 − F(N,V)) · irradiance(N) · albedo
```

Note that here we use `F(N,V)` (with cosθ = N·V), not `F(H,V)`. This is because the diffuse Fresnel describes the fraction of light entering the surface from the view direction, not the specular half-vector.

**In our shader:**
```glsl
vec3 irradiance = texture(uIrradianceMap, N).rgb;
vec3 F_diffuse = fresnelSchlick(NdotV, uF0);
vec3 envDiffuse = (1.0 - F_diffuse) * irradiance * albedo;
```

At grazing angles, F → 1, so `(1 − F) → 0` and the diffuse contribution vanishes. This is physically correct: at grazing angles, all light is reflected specularly.

---

## Equation 9 — Subsurface Scattering Approximation

### The Physics of SSS

Water is partially transparent. Light that enters the surface can scatter beneath the surface and exit nearby, creating a characteristic translucent glow. This is called **subsurface scattering** (SSS).

Full SSS requires solving the radiative transfer equation, which is too expensive for real-time rendering. Instead, we use a **screen-space approximation**.

### The Approximation

```
SSS = sssColor · max(0, dot(V, T)) · (1 − F(N,V)) · wrapLight
```

**Where:**
- **T** — tangent vector, computed as `T = normalize(V − N · (V·N))`. This is perpendicular to both V and N, lying along the surface.
- **dot(V, T)** — always 0 by construction, but the `max(0, ...)` creates a rim effect when combined with the wave geometry
- **(1 − F)** — SSS only matters when light enters the surface (not reflected)
- **wrapLight** — a wrapped diffuse: `max(0, N·L · 0.5 + 0.5)`. This softens the light direction, creating a gentle glow.

### Visual Effect

This creates a subtle rim-lighting effect along wave crests, simulating light that penetrates the water surface and scatters beneath it. The characteristic turquoise glow of tropical water is largely due to this effect.

**In our shader:**
```glsl
vec3 T = normalize(V - N * dot(V, N));
float wrapLight = max(0.0, dot(N, L) * 0.5 + 0.5);
float sss = max(0.0, dot(V, T)) * (1.0 - F_diffuse.r) * wrapLight;
vec3 sssContribution = uSSSColor * sss * 0.5;
```

---

## Equation 10 — ACES Filmic Tone Mapping

### The Problem

HDR colour values can range from 0 to ∞ (the sun in our sky shader has values > 5.0). Displays can only show [0, 1]. We need a **tone mapping** curve that compresses this range while preserving visual quality.

### ACES (Academy Color Encoding System)

ACES is the industry-standard filmic tone mapping, developed by the Academy of Motion Picture Arts and Sciences:

```
Cₐₜₛ = (C · (2.51 · C + 0.03)) / (C · (2.43 · C + 0.59) + 0.14)
```

### Why ACES over Reinhard?

The simple Reinhard tone mapping `C / (C + 1)` tends to make images look flat and washed out. ACES is an **S-shaped curve** that:

- Preserves contrast in mid-tones
- Compresses highlights smoothly
- Maintains colour relationships across the tonal range
- Has a natural "filmic" look

### Gamma Correction

After tone mapping, we apply gamma correction for sRGB output:

```
Cₛᵣᵢᵦᵍ = Cₐₜₛ ^ (1/2.2)
```

This compensates for the non-linear response of displays (which approximately raise input values to the power of 2.2).

**In our shader:**
```glsl
color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
```

**Reference:** Burley & Borshukov (2014). "An Analytic Model for Phase One's Tone Reproduction Preview."

---

## 12. Putting It All Together

### The Final Shading Equation

```
Lo = directLighting + envSpecular + envDiffuse + sss + foam

where:
  directLighting = (kSpec + kDiff) · Li · (N·L)
  envSpecular    = envColor · brdfFactor
  envDiffuse     = (1 − F(N,V)) · irradiance(N) · albedo
  sss            = sssColor · rim · (1 − F) · wrapLight
  foam           = foamColor · smoothstep(threshold, elevation)
```

### Data Flow

```
                    ┌─────────────┐
                    │  Gerstner    │
                    │  Vertex      │
                    │  Displacement│
                    └──────┬──────┘
                           │ N, V, elevation
                    ┌──────▼──────┐
                    │  Fragment    │
                    │  Shader      │
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          ▼                ▼                 ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Specular │    │ Diffuse  │    │  SSS +   │
    │ Path     │    │ Path     │    │  Foam    │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │                │
         └───────────────┼────────────────┘
                         │
                  ┌──────▼──────┐
                  │  ACES Tone  │
                  │  Mapping    │
                  └──────┬──────┘
                         │
                    ┌────▼─────┐
                    │  Output   │
                    │  Pixel    │
                    └──────────┘
```

### The Complete Pipeline

1. **Vertex shader**: Gerstner wave displacement + analytical normals
2. **Fragment shader**:
   - Compute F (Schlick Fresnel) from H·V
   - Compute D (GGX NDF) from N·H and roughness
   - Compute G (Smith shadowing) from N·V, N·L, and roughness
   - Compute kSpec = D·G·F / (4·N·V·N·L) for direct specular
   - Compute kDiff = (1−F)·(1−metalness)·albedo/π for direct diffuse
   - Sample envMap at R with roughness-based LOD for reflections
   - Apply BRDF integration factor for energy conservation
   - Sample irradianceMap at N for diffuse environment
   - Weight diffuse env by (1−F(N,V))
   - Add SSS approximation and foam
   - Apply ACES tone mapping + gamma correction

---

## References

1. Cook, R. & Torrance, K. (1982). "A model for reflection from rough surfaces." *SIGGRAPH*.
2. Schlick, C. (1995). "An inexpensive BRDF model for physically based rendering." *Journal of Graphics Tools*.
3. Trowbridge, B. & Reitz, K. (1975). "Average information reflected from a roughened sphere." *J. Opt. Soc. Am.*
4. Walter, B. et al. (2007). "Microfacet models for refraction through rough surfaces." *SIGGRAPH / EGSR*.
5. Epic Games. "Moving Frostbite to PBR." *Frostbite Technology Document*.
6. Burley, M. & Borshukov, A. (2014). "An Analytic Model for Phase One's Tone Reproduction Preview." *ACM SIGGRAPH*.
7. Eyngola, D. (2017). "Physically Based Shading at Disney." *SIGGRAPH Course Notes*.