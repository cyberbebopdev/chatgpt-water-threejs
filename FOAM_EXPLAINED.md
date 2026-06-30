# Procedural Foam Math

The foam shader builds a scalar coverage mask in `[0, 1]` from four procedural signals:

```text
foam = max(crestFoam, breakingFoam, shorelineFoam, objectFoam) * breakupNoise
```

No painted foam texture is used. The foam shape comes from wave derivatives, distance fields, and procedural noise.

## Wave Steepness

For each Gerstner wave, the vertical displacement is:

```text
y_i = A_i cos(phi_i)
phi_i = k_i dot(d_i, xz) - omega_i t
k_i = 2 pi / wavelength_i
```

The height gradient is:

```text
grad(y_i) = -A_i k_i sin(phi_i) d_i
```

For the combined water surface:

```text
grad(y) = sum_i grad(y_i)
steepness = length(grad(y))
```

This is better than summing absolute slopes per wave because overlapping waves can cancel or reinforce. Foam should follow the final surface.

The steepness mask is:

```text
steepMask = smoothstep(threshold, threshold + 1 / sharpness, steepness)
```

## Crest Foam

Foam at crests should favor high water, not just steep water. The shader normalizes elevation by the maximum possible wave height:

```text
crestHeight = clamp(elevation / sum(abs(amplitude_i)), 0, 1)
crestMask = smoothstep(0.45, 0.78, crestHeight)
```

Then crest foam is weighted by steepness:

```text
crestFoam = crestMask * (0.35 + 0.65 * steepMask)
```

This allows some foam at high crests, with stronger coverage when the crest is also steep.

## Breaking Foam

Some foam comes purely from steep/breaking water even below the highest crests:

```text
breakingFoam = steepMask^3 * 0.45
```

The power curve keeps gentle slopes clean and makes foam appear rapidly near unstable wave faces.

## Shoreline Foam

Before a true depth buffer is added, shorelines are represented as procedural distance fields.

For circular islands or sandbars:

```text
d = distance(worldXZ, shoreCenter)
insideFade = smoothstep(radius - 0.35 * width, radius, d)
outsideFade = 1 - smoothstep(radius, radius + width, d)
shorelineFoam = insideFade * outsideFade
```

This creates a band around the shoreline boundary instead of filling the entire island.

The square ocean boundary also contributes a shoreline band:

```text
distEdge = min(halfSize - abs(x), halfSize - abs(z))
edgeFoam = 1 - smoothstep(0, shorelineWidth, distEdge)
```

## Object Intersection Foam

Objects use the same circular band distance field:

```text
d = distance(worldXZ, objectCenter)
objectFoam = band(d, radius, width)
```

This creates foam around the waterline of rocks, posts, boats, or other intersecting objects.

## Procedural Breakup

Raw masks look too uniform, so the shader uses animated, domain-warped fBM:

```text
warp = vec2(fbm(uv + c1), fbm(uv + c2)) - 0.5
breakup = fbm(uv + warp * warpAmount)
lace = smoothstep(0.28, 0.86, breakup)
```

Weak foam regions are heavily broken up. Strong foam regions stay more continuous:

```text
noiseMod = mix(0.25 + 0.75 * lace, 1.0, smoothstep(0.65, 1.0, foamBase))
foamFinal = clamp(foamBase * noiseMod, 0, maxOpacity)
```

The final color blends toward foam:

```text
color = mix(waterColor, foamColor, foamFinal)
```
