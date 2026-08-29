// Shared GLSL noise chunk — injected into every procedural surface shader.
export const NOISE = /* glsl */ `
float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i + vec3(0.,0.,0.)), hash13(i + vec3(1.,0.,0.)), u.x),
        mix(hash13(i + vec3(0.,1.,0.)), hash13(i + vec3(1.,1.,0.)), u.x), u.y),
    mix(mix(hash13(i + vec3(0.,0.,1.)), hash13(i + vec3(1.,0.,1.)), u.x),
        mix(hash13(i + vec3(0.,1.,1.)), hash13(i + vec3(1.,1.,1.)), u.x), u.y),
    u.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(11.7, 5.1, 7.7);
    a *= 0.5;
  }
  return s;
}
float fbm3(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.11 + vec3(3.3, 9.1, 1.7);
    a *= 0.5;
  }
  return s;
}
// lighting helper: sun sits at origin
vec3 sunLightDir(vec3 worldPos) {
  return normalize(-worldPos);
}
`;
