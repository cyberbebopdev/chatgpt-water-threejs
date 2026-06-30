import * as THREE from 'three';
import { PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WaterMesh } from './water/WaterMesh.js';

// ---------------------------------------------------------------------------
// Procedural HDR sky scene for environment map generation
// ---------------------------------------------------------------------------
//
// We build a small scene with a gradient sky shader and a sun, then run
// PMREMGenerator to produce a prefiltered CubeTexture.  This CubeTexture
// is what the water shader samples for reflections.
//
// PMREM (Pre-Filtered Multi-Resolution Environment Map) convolves the
// source environment into a mip chain where each level represents the
// integral of a GGX lobe at increasing roughness.  This is exactly what
// the Cook-Torrance BRDF needs for rough reflections.
//
// Additionally, PMREMGenerator can produce an irradiance map from the
// same scene.  The irradiance map is a spherical convolution of the
// environment that provides diffuse (ambient) lighting for the
// Fresnel-weighted diffuse term.

function createProceduralSkyScene(): THREE.Scene {
  const skyScene = new THREE.Scene();

  // Sky dome with a gradient shader
  const skyGeo = new THREE.SphereGeometry(500, 32, 32);
  skyGeo.rotateX(-Math.PI / 2);

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPosition;
      uniform vec3 uSunDirection;

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float y = dir.y;

        // Sky gradient: horizon → zenith
        vec3 horizonColor = vec3(0.6, 0.75, 0.9);
        vec3 zenithColor  = vec3(0.1, 0.2, 0.6);
        vec3 skyColor = mix(horizonColor, zenithColor, max(y, 0.0));

        // Below horizon: ground colour
        vec3 groundColor = vec3(0.05, 0.08, 0.12);
        skyColor = mix(skyColor, groundColor, smoothstep(0.0, -0.1, y));

        // Sun disc
        float sunDot = max(dot(dir, uSunDirection), 0.0);
        float sun = pow(sunDot, 256.0) * 5.0;

        // Sun glow
        float glow = pow(sunDot, 16.0) * 0.5;

        skyColor += sun + glow;

        gl_FragColor = vec4(skyColor, 1.0);
      }
    `,
    uniforms: {
      uSunDirection: {
        value: new THREE.Vector3(0.5, 1.0, 0.3).normalize(),
      },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyScene.add(skyMesh);

  // Place a camera at the origin pointing up — PMREMGenerator will
  // render the six cube faces from this position.
  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);
  camera.position.set(0, 0, 0);
  skyScene.add(camera);

  return skyScene;
}

// ---------------------------------------------------------------------------
// Scene, camera, renderer
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1520);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);
camera.position.set(0, 50, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NoToneMapping; // We tone-map in the shader
document.body.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// Generate HDR environment maps
// ---------------------------------------------------------------------------
//
// Two maps are generated from the procedural sky scene:
//
// 1. envMap (prefiltered):  The PMREM prefiltered CubeTexture with a
//    mip chain for roughness-based reflection blur.  This is sampled
//    in the specular path with textureLod().
//
// 2. irradianceMap:  A spherical convolution of the environment that
//    provides diffuse ambient lighting.  This is sampled in the diffuse
//    path and weighted by (1 - Fresnel) for energy conservation.
//
// The PMREMGenerator.fromScene() method produces both maps internally.
// The .texture property is the prefiltered map, and we can extract the
// irradiance map from the generator's internal state.

const skyScene = createProceduralSkyScene();

const pmremGenerator = new PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Generate the PMREM texture from our procedural sky scene.
// The result is a CubeTexture with a prefiltered mip chain.
const envMap = pmremGenerator.fromScene(skyScene).texture;

// Generate the irradiance map for diffuse environment lighting.
// PMREMGenerator stores the irradiance map internally after fromScene().
// The second fromScene call with a small blur radius produces the diffuse map.
const irradianceMap = pmremGenerator.fromScene(skyScene, 0.04).texture as THREE.CubeTexture;

// Clean up — we no longer need the generator or sky scene.
pmremGenerator.dispose();
skyScene.children.forEach((child) => {
  if (child instanceof THREE.Mesh) {
    child.geometry.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose());
    } else {
      child.material.dispose();
    }
  }
});

// Set the env map on the main scene so standard materials can use it too.
scene.environment = envMap;

// ---------------------------------------------------------------------------
// Ocean mesh
// ---------------------------------------------------------------------------

const shorelineFoamSources = [[35, -18, 28, 10]];
const objectFoamSources = [
  [-35, 15, 4, 6],
  [-22, 30, 3, 5],
  [16, -42, 5, 7],
];

const water = new WaterMesh({
  size: 1000,
  segments: 256,
  envMap,
  irradianceMap,
  roughness: 0.15,
  metalness: 0.0,
  ior: 1.33,
  deepColor: [0.0, 0.05, 0.15],
  shallowColor: [0.0, 0.5, 0.6],
  foamColor: [0.95, 0.95, 0.95],
  foamSteepnessThreshold: 0.3,
  shorelineFoamSources,
  objectFoamSources,
  sssColor: [0.0, 0.35, 0.45],
  sssScale: 8.0,
});
scene.add(water);

const debugModeNames = [
  'final',
  'water-no-foam',
  'normal',
  'elevation',
  'steepness',
  'crest-foam',
  'shoreline-foam',
  'object-foam',
  'final-foam',
];

let activeDebugMode = 1;
water.setDebugMode(activeDebugMode);

const debugPanel = document.createElement('div');
debugPanel.style.position = 'fixed';
debugPanel.style.left = '12px';
debugPanel.style.top = '12px';
debugPanel.style.zIndex = '10';
debugPanel.style.display = 'grid';
debugPanel.style.gridTemplateColumns = 'repeat(3, max-content)';
debugPanel.style.gap = '6px';
debugPanel.style.padding = '8px';
debugPanel.style.background = 'rgba(0, 0, 0, 0.62)';
debugPanel.style.color = '#fff';
debugPanel.style.font = '12px system-ui, sans-serif';
debugPanel.style.border = '1px solid rgba(255, 255, 255, 0.22)';
document.body.appendChild(debugPanel);

const debugLabel = document.createElement('div');
debugLabel.style.gridColumn = '1 / -1';
debugPanel.appendChild(debugLabel);

function setDebugMode(mode: number): void {
  activeDebugMode = mode;
  water.setDebugMode(mode);
  debugLabel.textContent = `Debug ${mode}: ${debugModeNames[mode]}`;

  debugPanel.querySelectorAll('button').forEach((button, index) => {
    button.style.background = index === mode ? '#fff' : 'rgba(255,255,255,0.12)';
    button.style.color = index === mode ? '#000' : '#fff';
  });
}

debugModeNames.forEach((name, mode) => {
  const button = document.createElement('button');
  button.textContent = `${mode} ${name}`;
  button.style.border = '1px solid rgba(255,255,255,0.35)';
  button.style.padding = '5px 7px';
  button.style.cursor = 'pointer';
  button.onclick = () => setDebugMode(mode);
  debugPanel.appendChild(button);
});

setDebugMode(activeDebugMode);

window.addEventListener('keydown', (event) => {
  const mode = Number(event.key);
  if (!Number.isInteger(mode) || mode < 0 || mode >= debugModeNames.length) {
    return;
  }

  setDebugMode(mode);
});

const sandMaterial = new THREE.MeshStandardMaterial({
  color: 0xb99b6b,
  roughness: 0.9,
  metalness: 0.0,
});

const island = new THREE.Mesh(
  new THREE.CylinderGeometry(28, 34, 5, 96),
  sandMaterial
);
island.position.set(35, -2.5, -18);
scene.add(island);

const rockMaterial = new THREE.MeshStandardMaterial({
  color: 0x3e4345,
  roughness: 0.75,
  metalness: 0.0,
});

objectFoamSources.forEach(([x, z, radius], index) => {
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.75, radius, 12 + index * 2, 18),
    rockMaterial
  );
  rock.position.set(x, 2.5, z);
  rock.rotation.z = (index - 1) * 0.12;
  scene.add(rock);
});

// ---------------------------------------------------------------------------
// Orbit controls
// ---------------------------------------------------------------------------

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI;
controls.minDistance = 10;
controls.maxDistance = 800;

// ---------------------------------------------------------------------------
// Resize handler
// ---------------------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  water.update(elapsed);
  controls.update();

  renderer.render(scene, camera);
}

animate();
