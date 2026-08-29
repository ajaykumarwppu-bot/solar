import * as THREE from "three";
import { NOISE } from "./glsl";

/* ------------------------------------------------------------------ */
/* Shared vertex shader (spheres / generic surfaces)                   */
/* ------------------------------------------------------------------ */
const VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
void main() {
  vPos = position;
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const RING_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main() {
  vPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/* ------------------------------------------------------------------ */
/* Sun                                                                 */
/* ------------------------------------------------------------------ */
export function sunMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      void main() {
        vec3 p = normalize(vPos);
        float n1 = fbm(p * 2.1 + vec3(0.0, uTime * 0.10, uTime * 0.06));
        float n2 = fbm3(p * 5.6 - vec3(uTime * 0.13, 0.0, uTime * 0.09));
        float h = n1 * 0.62 + n2 * 0.38;
        vec3 col = mix(vec3(0.50, 0.07, 0.0), vec3(1.0, 0.40, 0.04), smoothstep(0.12, 0.50, h));
        col = mix(col, vec3(1.0, 0.76, 0.28), smoothstep(0.45, 0.74, h));
        col = mix(col, vec3(1.0, 0.97, 0.86), smoothstep(0.72, 0.95, h));
        float mu = max(dot(normalize(vNormalW), normalize(cameraPosition - vWorldPos)), 0.0);
        col *= 0.50 + 0.72 * pow(mu, 0.55);
        col *= 1.7;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function coronaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: VERT,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vPos;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - abs(dot(normalize(vNormalW), V)), 2.4);
        float flick = 0.65 + 0.35 * fbm3(normalize(vPos) * 3.2 + vec3(uTime * 0.25));
        vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.78, 0.38), fres);
        gl_FragColor = vec4(col * 1.3, fres * flick * uIntensity);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Rocky worlds (Mercury, Moon, Mars, custom params)                   */
/* ------------------------------------------------------------------ */
export interface RockyOpts {
  colA: number; // light terrain
  colB: number; // dark terrain
  colC: number; // accent mineral
  seed: number;
  crater: number; // 0..1
  cap: number; // polar cap strength
  capColor?: number;
}

export function rockyMaterial(o: RockyOpts): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColA: { value: new THREE.Color(o.colA) },
      uColB: { value: new THREE.Color(o.colB) },
      uColC: { value: new THREE.Color(o.colC) },
      uCapColor: { value: new THREE.Color(o.capColor ?? 0xf2f5f7) },
      uSeed: { value: Math.max(0.1, o.seed) },
      uCrater: { value: THREE.MathUtils.clamp(o.crater, 0, 1) },
      uCap: { value: THREE.MathUtils.clamp(o.cap, 0, 1) },
    },
    vertexShader: VERT,
    fragmentShader: NOISE + /* glsl */ `
      uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform vec3 uCapColor;
      uniform float uSeed; uniform float uCrater; uniform float uCap;
      varying vec3 vPos; varying vec3 vWorldPos; varying vec3 vNormalW;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 L = sunLightDir(vWorldPos);
        float diff = max(dot(N, L), 0.0);
        vec3 p = normalize(vPos);
        float base = fbm(p * (2.4 + uSeed) + uSeed);
        float detail = fbm(p * 7.5 + uSeed * 2.0);
        float craters = smoothstep(0.58, 0.88, fbm3(p * 15.0 + uSeed));
        vec3 col = mix(uColB, uColA, smoothstep(0.25, 0.78, base));
        col = mix(col, uColC, smoothstep(0.52, 0.92, detail) * 0.35);
        col *= 1.0 - craters * uCrater * 0.42;
        float capM = smoothstep(0.74, 0.92, abs(p.y) + (detail - 0.5) * 0.16);
        col = mix(col, uCapColor, capM * uCap);
        vec3 lit = col * (diff * 1.28 + 0.018);
        lit += col * pow(diff, 3.0) * 0.05;
        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Earth                                                               */
/* ------------------------------------------------------------------ */
export function earthMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: VERT,
    fragmentShader: NOISE + /* glsl */ `
      varying vec3 vPos; varying vec3 vWorldPos; varying vec3 vNormalW;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 L = sunLightDir(vWorldPos);
        float diff = max(dot(N, L), 0.0);
        vec3 p = normalize(vPos);
        float cont = fbm(p * 2.2 + 4.7) + 0.35 * (fbm(p * 6.0 + 9.2) - 0.5);
        float land = smoothstep(0.50, 0.545, cont);
        float shallow = smoothstep(0.455, 0.50, cont);
        vec3 ocean = mix(vec3(0.010, 0.045, 0.115), vec3(0.028, 0.155, 0.27), shallow);
        float terr = fbm(p * 8.0 + 2.0);
        vec3 landCol = mix(vec3(0.085, 0.225, 0.075), vec3(0.36, 0.30, 0.13), terr);
        landCol = mix(landCol, vec3(0.52, 0.47, 0.35), smoothstep(0.6, 0.95, fbm3(p * 17.0)) * 0.42);
        vec3 col = mix(ocean, landCol, land);
        float ice = smoothstep(0.80, 0.92, abs(p.y) + (terr - 0.5) * 0.10);
        col = mix(col, vec3(0.90, 0.94, 0.98), ice);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 46.0) * (1.0 - land) * (1.0 - ice) * diff;
        vec3 lit = col * (diff * 1.32 + 0.014) + vec3(1.0, 0.90, 0.70) * spec * 0.5;
        float night = 1.0 - smoothstep(0.0, 0.10, diff);
        float cities = smoothstep(0.56, 0.82, fbm3(p * 30.0)) * land * (1.0 - ice);
        lit += vec3(1.0, 0.70, 0.34) * cities * night * 0.5;
        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Cloud layer (Earth)                                                 */
/* ------------------------------------------------------------------ */
export function cloudMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.85 } },
    transparent: true,
    depthWrite: false,
    vertexShader: VERT,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime; uniform float uOpacity;
      varying vec3 vPos; varying vec3 vWorldPos; varying vec3 vNormalW;
      void main() {
        vec3 p = normalize(vPos);
        float c = fbm(p * 3.3 + vec3(uTime * 0.012, 0.0, uTime * 0.007) + 7.0);
        c = smoothstep(0.50, 0.80, c);
        float diff = max(dot(normalize(vNormalW), sunLightDir(vWorldPos)), 0.0);
        gl_FragColor = vec4(vec3(1.0) * (diff * 1.2 + 0.03), c * uOpacity);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Gas giants (Jupiter, Saturn, Uranus, Neptune, Venus-style clouds)   */
/* ------------------------------------------------------------------ */
export interface GasOpts {
  colA: number;
  colB: number;
  colC: number;
  colD: number;
  bandFreq: number;
  warp: number;
  turb: number;
  seed: number;
  spot?: boolean;
  spotLat?: number;
  spotLon?: number;
}

export function gasMaterial(o: GasOpts): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColA: { value: new THREE.Color(o.colA) },
      uColB: { value: new THREE.Color(o.colB) },
      uColC: { value: new THREE.Color(o.colC) },
      uColD: { value: new THREE.Color(o.colD) },
      uBandFreq: { value: Math.max(0.1, o.bandFreq) },
      uWarp: { value: Math.max(0, o.warp) },
      uTurb: { value: Math.max(0, o.turb) },
      uSeed: { value: Math.max(0.1, o.seed) },
      uSpot: { value: o.spot ? 1 : 0 },
      uSpotPos: { value: new THREE.Vector2(o.spotLat ?? -0.35, o.spotLon ?? 1.2) },
    },
    vertexShader: VERT,
    fragmentShader: NOISE + /* glsl */ `
      uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform vec3 uColD;
      uniform float uBandFreq; uniform float uWarp; uniform float uTurb; uniform float uSeed;
      uniform float uSpot; uniform vec2 uSpotPos;
      varying vec3 vPos; varying vec3 vWorldPos; varying vec3 vNormalW;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 L = sunLightDir(vWorldPos);
        float diff = max(dot(N, L), 0.0);
        vec3 p = normalize(vPos);
        float lat = p.y;
        float lon = atan(p.z, p.x);
        float w = fbm(p * (2.0 + uTurb) + uSeed) - 0.5;
        float band = sin((lat + w * uWarp) * uBandFreq + uSeed);
        float band2 = sin((lat + w * uWarp * 1.7) * uBandFreq * 2.7 + uSeed * 2.0);
        vec3 col = mix(uColA, uColB, smoothstep(0.12, 0.88, band * 0.5 + 0.5));
        col = mix(col, uColC, smoothstep(0.45, 1.0, band2 * 0.5 + 0.5) * 0.42);
        col = mix(col, uColD, smoothstep(0.56, 0.95, fbm(p * 5.2 + uSeed)) * 0.28);
        if (uSpot > 0.5) {
          float dLon = atan(sin(lon - uSpotPos.y), cos(lon - uSpotPos.y));
          float d = length(vec2(dLon * 0.5, (lat - uSpotPos.x) * 1.55));
          float spot = 1.0 - smoothstep(0.16, 0.42, d + (fbm3(p * 9.0 + uSeed) - 0.5) * 0.09);
          vec3 spotCol = mix(vec3(0.70, 0.22, 0.10), vec3(0.86, 0.42, 0.22), fbm3(p * 14.0));
          col = mix(col, spotCol, spot * 0.9);
        }
        float mu = max(dot(N, normalize(cameraPosition - vWorldPos)), 0.0);
        vec3 lit = col * (diff * 1.30 + 0.02) * (0.70 + 0.30 * pow(mu, 0.5));
        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Atmosphere rim                                                      */
/* ------------------------------------------------------------------ */
export function atmosphereMaterial(color: number, intensity: number, power = 3.2): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: Math.max(0, intensity) },
      uPower: { value: Math.max(0.5, power) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: VERT,
    fragmentShader: NOISE + /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity; uniform float uPower;
      varying vec3 vWorldPos; varying vec3 vNormalW;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = sunLightDir(vWorldPos);
        float fres = pow(1.0 - abs(dot(N, V)), uPower);
        float sunF = 0.22 + 0.78 * max(dot(N, L), 0.0);
        gl_FragColor = vec4(uColor, fres * sunF * uIntensity);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Rings (Saturn / Uranus)                                             */
/* ------------------------------------------------------------------ */
export interface RingOpts {
  inner: number;
  outer: number;
  colA: number;
  colB: number;
  opacity: number;
  seed: number;
  gaps: number[]; // normalized radial positions of gaps
  planetRadius: number;
}

export function ringMaterial(o: RingOpts): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInner: { value: Math.max(0.01, o.inner) },
      uOuter: { value: Math.max(o.inner + 0.01, o.outer) },
      uColA: { value: new THREE.Color(o.colA) },
      uColB: { value: new THREE.Color(o.colB) },
      uOpacity: { value: THREE.MathUtils.clamp(o.opacity, 0, 1) },
      uSeed: { value: Math.max(0.1, o.seed) },
      uGaps: { value: o.gaps.slice(0, 4) },
      uPlanetPos: { value: new THREE.Vector3() },
      uPlanetR: { value: Math.max(0.01, o.planetRadius) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: RING_VERT,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uInner; uniform float uOuter;
      uniform vec3 uColA; uniform vec3 uColB;
      uniform float uOpacity; uniform float uSeed;
      uniform float uGaps[4];
      uniform vec3 uPlanetPos; uniform float uPlanetR;
      varying vec3 vPos; varying vec3 vWorldPos; varying vec3 vNormalW;
      void main() {
        float r = length(vPos.xz);
        float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
        float n = fbm3(vec3(r * 5.5 + uSeed, r * 21.0, uSeed * 1.7));
        float fine = 0.75 + 0.25 * sin(r * 90.0 + n * 8.0);
        float density = (0.30 + 0.70 * n) * fine;
        for (int i = 0; i < 4; i++) {
          if (uGaps[i] > 0.001) {
            density *= smoothstep(0.012, 0.05, abs(t - uGaps[i]));
          }
        }
        density *= smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.95, 1.0, t));
        vec3 col = mix(uColA, uColB, n);
        vec3 L = normalize(-vWorldPos);
        float lam = abs(dot(normalize(vNormalW), L));
        vec3 sd = normalize(uPlanetPos);
        vec3 rel = vWorldPos - uPlanetPos;
        float along = dot(rel, sd);
        float perp = length(rel - sd * along);
        float occ = (1.0 - smoothstep(uPlanetR * 0.85, uPlanetR * 1.12, perp)) * step(0.0, along);
        float shadow = 1.0 - occ * 0.92;
        float alpha = density * uOpacity * (0.30 + 0.70 * lam) * (0.18 + 0.82 * shadow);
        gl_FragColor = vec4(col * (0.55 + 0.75 * lam) * shadow, alpha);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Engine exhaust                                                      */
/* ------------------------------------------------------------------ */
export function exhaustMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float a = pow(max(0.0, 1.0 - vUv.y), 1.7);
        float flick = 0.72 + 0.28 * sin(uTime * 43.0 + vUv.y * 26.0) * sin(uTime * 29.0 - vUv.y * 41.0);
        float core = smoothstep(0.5, 0.05, abs(vUv.x - 0.5));
        vec3 col = mix(vec3(1.0, 0.42, 0.10), vec3(0.85, 0.9, 1.0), core * (1.0 - vUv.y));
        gl_FragColor = vec4(col * 2.3, a * flick * uIntensity);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Background nebula dome                                              */
/* ------------------------------------------------------------------ */
export function nebulaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {},
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: VERT,
    fragmentShader: NOISE + /* glsl */ `
      varying vec3 vPos;
      void main() {
        vec3 d = normalize(vPos);
        float n = fbm3(d * 2.4 + 3.1);
        float n2 = fbm3(d * 5.6 - 7.7);
        vec3 col = mix(vec3(0.010, 0.017, 0.030), vec3(0.045, 0.032, 0.018), smoothstep(0.38, 0.82, n));
        col += vec3(0.016, 0.042, 0.040) * smoothstep(0.56, 0.92, n2) * 0.65;
        col += vec3(0.034, 0.020, 0.010) * smoothstep(0.62, 0.95, n) * 0.8;
        float band = exp(-pow(d.y * 2.1, 2.0));
        col += vec3(0.030, 0.027, 0.033) * band * (0.45 + 0.55 * n2);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Canvas-generated textures (glow sprites, star points)               */
/* ------------------------------------------------------------------ */
export function makeGlowTexture(size = 256, inner = "rgba(255,244,224,1)", mid = "rgba(255,170,80,0.45)"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = Math.max(16, size);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, mid);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeStarTexture(size = 64): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
