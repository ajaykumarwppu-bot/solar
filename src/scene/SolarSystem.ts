import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { PLANETS, ALL_INFO, SUN_INFO, MOON_INFO } from "./bodies";
import type { BodyInfo } from "./bodies";
import {
  sunMaterial, coronaMaterial, rockyMaterial, earthMaterial, gasMaterial,
  cloudMaterial, atmosphereMaterial, ringMaterial, nebulaMaterial,
  makeGlowTexture, makeStarTexture,
} from "./materials";
import { createShip } from "./ship";
import type { Ship } from "./ship";
import { audio } from "../audio";

export type FlightMode = "flight" | "orbit";
export type CameraRig = "chase" | "cockpit";

export interface Telemetry {
  speed: number;
  throttle: number;
  boost: boolean;
  distSunAU: number;
  nearestName: string;
  nearestDistM: number;
  fps: number;
  simDaysPerSec: number;
}

interface Callbacks {
  onTelemetry: (t: Telemetry) => void;
  onSelect: (b: BodyInfo | null) => void;
}

interface Body {
  id: string;
  info: BodyInfo;
  radius: number;
  orbitR: number;
  angSpeed: number;
  phase: number;
  rotSpeed: number;
  node: THREE.Object3D;
  plane: THREE.Group | null;
  mesh: THREE.Mesh;
  worldPos: THREE.Vector3;
  label: HTMLDivElement;
  orbitMat: THREE.LineBasicMaterial | null;
  ringMats: THREE.ShaderMaterial[];
  cloudMat: THREE.ShaderMaterial | null;
  parent: Body | null;
}

const ROCKY_LOOKS: Record<string, Parameters<typeof rockyMaterial>[0]> = {
  mercury: { colA: 0x9c9186, colB: 0x55504a, colC: 0x77695c, seed: 1.7, crater: 1.0, cap: 0 },
  moon: { colA: 0xb9bcc2, colB: 0x6d7076, colC: 0x8f9298, seed: 5.1, crater: 1.0, cap: 0 },
  mars: { colA: 0xc96b3d, colB: 0x7e3a1f, colC: 0x4d2a1a, seed: 3.3, crater: 0.55, cap: 0.9, capColor: 0xf4ede2 },
};

const GAS_LOOKS: Record<string, Parameters<typeof gasMaterial>[0]> = {
  venus: { colA: 0xe6cf9f, colB: 0xc8a268, colC: 0xf4e6c4, colD: 0xb98d55, bandFreq: 4.2, warp: 1.5, turb: 2.6, seed: 8.2 },
  jupiter: { colA: 0xd9b98a, colB: 0xa67b52, colC: 0xf0e0bd, colD: 0x8a6242, bandFreq: 13.5, warp: 0.22, turb: 1.6, seed: 4.4, spot: true, spotLat: -0.32, spotLon: 1.1 },
  saturn: { colA: 0xe2cf9f, colB: 0xc3a877, colC: 0xf2e7c6, colD: 0xb39468, bandFreq: 10.5, warp: 0.14, turb: 1.2, seed: 9.7 },
  uranus: { colA: 0x9fd4d6, colB: 0x86c2c6, colC: 0xb8e4e4, colD: 0x79b6bb, bandFreq: 6.0, warp: 0.1, turb: 0.8, seed: 6.1 },
  neptune: { colA: 0x3d63bd, colB: 0x2b4794, colC: 0x6f92d8, colD: 0x243c7e, bandFreq: 8.0, warp: 0.2, turb: 1.4, seed: 2.9, spot: true, spotLat: 0.3, spotLon: -0.8 },
};

const ATMOS: Record<string, { color: number; intensity: number }> = {
  venus: { color: 0xf0dca8, intensity: 1.05 },
  earth: { color: 0x7fc4ff, intensity: 0.85 },
  mars: { color: 0xd9a066, intensity: 0.3 },
  jupiter: { color: 0xd9b98a, intensity: 0.38 },
  saturn: { color: 0xe8dcb8, intensity: 0.34 },
  uranus: { color: 0x9fd6d9, intensity: 0.5 },
  neptune: { color: 0x7fa8e8, intensity: 0.55 },
};

const AU_UNITS = 28;
const KM_PER_UNIT = 5.36e6;

export class SolarSystem {
  private container: HTMLElement;
  private cbs: Callbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;

  private bodies: Body[] = [];
  private bodyById = new Map<string, Body>();
  private sun!: Body;
  private ship!: Ship;
  private reticle!: THREE.Mesh;
  private belt!: THREE.Group;
  private sunMats: THREE.ShaderMaterial[] = [];
  private labelLayer: HTMLDivElement;

  private mode: FlightMode = "flight";
  private rig: CameraRig = "chase";
  private timeScale = 1;
  private simTime = 0;
  private throttle = 0;
  private vel = 0;
  private keys = new Set<string>();
  private dragging = false;
  private downX = 0;
  private downY = 0;
  private moved = 0;
  private selected: Body | null = null;
  private focused: Body;
  private camPos = new THREE.Vector3();
  private fps = 60;
  private telemetryAcc = 0;
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpE = new THREE.Euler();
  private raycaster = new THREE.Raycaster();
  private pickables: THREE.Mesh[] = [];

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;

  constructor(container: HTMLElement, cbs: Callbacks) {
    this.container = container;
    this.cbs = cbs;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 4000);
    this.camera.position.set(40, 26, 62);

    this.labelLayer = document.createElement("div");
    this.labelLayer.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5;";
    container.appendChild(this.labelLayer);

    // ---------- lights ----------
    const sunLight = new THREE.PointLight(0xfff1dc, 3.2, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0x2a3644, 0.5));

    // ---------- background ----------
    this.buildBackground();

    // ---------- sun ----------
    this.buildSun();

    // ---------- planets ----------
    for (const p of PLANETS) this.buildPlanet(p.scene.id, p.info);

    // ---------- moon ----------
    this.buildMoon();

    // ---------- asteroid + kuiper belts ----------
    this.buildBelts();

    this.focused = this.sun;

    // sync world positions once so the ship spawns at Earth's true location
    this.updateBodies(0);

    // ---------- ship ----------
    this.ship = createShip();
    this.scene.add(this.ship.group);
    this.resetShipPosition(this.bodyById.get("earth") ?? this.sun);

    // ---------- selection reticle ----------
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0x5fe0c4, transparent: true, opacity: 0.75,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.reticle.visible = false;
    this.reticle.renderOrder = 6;
    this.scene.add(this.reticle);

    // ---------- post-processing ----------
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.7, 0.82);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    // ---------- orbit controls (orbit mode) ----------
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 900;
    this.controls.enabled = false;

    // ---------- events ----------
    this.onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "KeyR") this.resetShipPosition(this.focused);
      const digits: Record<string, string> = { Digit0: "sun", Digit1: "mercury", Digit2: "venus", Digit3: "earth", Digit4: "mars", Digit5: "jupiter", Digit6: "saturn", Digit7: "uranus", Digit8: "neptune" };
      if (digits[e.code]) this.selectBody(digits[e.code]);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onPointerDown = (e) => {
      this.dragging = true;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.moved = 0;
    };
    this.onPointerMove = (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.downX;
      const dy = e.clientY - this.downY;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.mode === "flight") {
        const k = 0.0026;
        this.tmpE.set(-dy * k, -dx * k, 0, "XYZ");
        this.tmpQ.setFromEuler(this.tmpE);
        this.ship.group.quaternion.multiply(this.tmpQ);
      }
    };
    this.onPointerUp = (e) => {
      this.dragging = false;
      if (this.moved < 7) this.pick(e);
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.clock.start();
    this.loop();
  }

  /* ================= construction ================= */

  private buildBackground() {
    const nebula = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 24), nebulaMaterial());
    nebula.renderOrder = -2;
    this.scene.add(nebula);

    const starTex = makeStarTexture(64);
    const makeStars = (count: number, size: number, bright: number) => {
      const n = Math.max(16, Math.floor(count));
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(1250 + Math.random() * 180);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        const t = Math.random();
        if (t < 0.72) c.setHSL(0.58, 0.12, 0.62 + Math.random() * 0.38);
        else if (t < 0.9) c.setHSL(0.1, 0.35, 0.6 + Math.random() * 0.4);
        else c.setHSL(0.02, 0.55, 0.55 + Math.random() * 0.3);
        c.multiplyScalar(bright * (0.55 + Math.random() * 0.45));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const m = new THREE.PointsMaterial({
        size, map: starTex, vertexColors: true, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false,
      });
      const pts = new THREE.Points(g, m);
      pts.renderOrder = -1;
      this.scene.add(pts);
    };
    makeStars(3600, 1.7, 0.8);
    makeStars(280, 3.4, 1.0);
  }

  private makeLabel(name: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "body-label";
    el.innerHTML = `<i></i><span>${name}</span>`;
    this.labelLayer.appendChild(el);
    return el;
  }

  private addAtmosphere(parent: THREE.Object3D, radius: number, id: string) {
    const a = ATMOS[id];
    if (!a) return;
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.1, radius * 1.09), 48, 32),
      atmosphereMaterial(a.color, a.intensity)
    );
    shell.renderOrder = 3;
    parent.add(shell);
  }

  private buildSun() {
    const R = 5.5;
    const node = new THREE.Object3D();
    this.scene.add(node);
    const mat = sunMaterial();
    this.sunMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), mat);
    mesh.userData.bodyId = "sun";
    node.add(mesh);

    const corona = new THREE.Mesh(new THREE.SphereGeometry(R * 1.45, 48, 32), coronaMaterial());
    corona.renderOrder = 4;
    this.sunMats.push(corona.material as THREE.ShaderMaterial);
    node.add(corona);

    const glowTex = makeGlowTexture(256);
    const mkSprite = (scale: number, color: number, opacity: number) => {
      const sm = new THREE.SpriteMaterial({
        map: glowTex, color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const s = new THREE.Sprite(sm);
      s.scale.set(scale, scale, 1);
      s.renderOrder = 4;
      node.add(s);
    };
    mkSprite(36, 0xffb066, 0.9);
    mkSprite(110, 0xff7a1a, 0.32);

    const body: Body = {
      id: "sun", info: SUN_INFO, radius: R, orbitR: 0, angSpeed: 0, phase: 0,
      rotSpeed: 0.12, node, plane: null, mesh, worldPos: new THREE.Vector3(),
      label: this.makeLabel("SOL"), orbitMat: null, ringMats: [], cloudMat: null, parent: null,
    };
    this.bodies.push(body);
    this.bodyById.set("sun", body);
    this.sun = body;
    this.pickables.push(mesh);
  }

  private buildPlanet(id: string, info: BodyInfo) {
    const p = PLANETS.find((x) => x.scene.id === id)!.scene;
    const plane = new THREE.Group();
    plane.rotation.x = THREE.MathUtils.degToRad(p.inclination);
    this.scene.add(plane);

    const node = new THREE.Object3D();
    plane.add(node);

    const tilt = new THREE.Group();
    tilt.rotation.z = THREE.MathUtils.degToRad(p.axialTilt);
    node.add(tilt);

    let mesh: THREE.Mesh;
    let cloudMat: THREE.ShaderMaterial | null = null;
    const ringMats: THREE.ShaderMaterial[] = [];

    if (p.kind === "earth") {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 48, 32), earthMaterial());
      const cm = cloudMaterial();
      cloudMat = cm;
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.035, 48, 32), cm);
      clouds.renderOrder = 2;
      tilt.add(clouds);
      this.cloudSpin = clouds;
    } else if (p.kind === "gas") {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 48, 32), gasMaterial(GAS_LOOKS[id]));
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 48, 32), rockyMaterial(ROCKY_LOOKS[id]));
    }
    mesh.userData.bodyId = id;
    tilt.add(mesh);

    this.addAtmosphere(tilt, p.radius, id);

    // rings
    if (id === "saturn") {
      const inner = p.radius * 1.35;
      const outer = p.radius * 2.35;
      const rm = ringMaterial({
        inner, outer, colA: 0xd8c39a, colB: 0x8a7355, opacity: 0.96,
        seed: 3.7, gaps: [0.63, 0.3], planetRadius: p.radius,
      });
      const geo = new THREE.RingGeometry(inner, outer, 160, 1);
      geo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(geo, rm);
      ring.renderOrder = 4;
      tilt.add(ring);
      ringMats.push(rm);
    }
    if (id === "uranus") {
      const inner = p.radius * 1.5;
      const outer = p.radius * 1.9;
      const rm = ringMaterial({
        inner, outer, colA: 0x9fb8ba, colB: 0x6f8a8c, opacity: 0.3,
        seed: 7.9, gaps: [0.5], planetRadius: p.radius,
      });
      const geo = new THREE.RingGeometry(inner, outer, 128, 1);
      geo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(geo, rm);
      ring.renderOrder = 4;
      tilt.add(ring);
      ringMats.push(rm);
    }

    // orbit line
    const segs = 180;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * p.orbitR, 0, -Math.sin(a) * p.orbitR));
    }
    const orbitMat = new THREE.LineBasicMaterial({ color: 0xf5a942, transparent: true, opacity: 0.14 });
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), orbitMat);
    plane.add(orbit);

    const body: Body = {
      id, info, radius: p.radius, orbitR: p.orbitR,
      angSpeed: 0.09 / Math.pow(Math.max(0.05, p.periodY), 0.72),
      phase: p.phase, rotSpeed: p.rotSpeed, node, plane, mesh,
      worldPos: new THREE.Vector3(), label: this.makeLabel(info.name),
      orbitMat, ringMats, cloudMat, parent: null,
    };
    this.bodies.push(body);
    this.bodyById.set(id, body);
    this.pickables.push(mesh);
  }

  private cloudSpin: THREE.Object3D | null = null;

  private buildMoon() {
    const earth = this.bodyById.get("earth");
    if (!earth) return;
    const plane = new THREE.Group();
    plane.rotation.x = THREE.MathUtils.degToRad(5.1);
    earth.node.add(plane);
    const node = new THREE.Object3D();
    plane.add(node);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 24), rockyMaterial(ROCKY_LOOKS.moon));
    mesh.userData.bodyId = "moon";
    node.add(mesh);

    const body: Body = {
      id: "moon", info: MOON_INFO, radius: 0.27, orbitR: 2.3, angSpeed: 0.55,
      phase: 1.2, rotSpeed: 0.55, node, plane, mesh,
      worldPos: new THREE.Vector3(), label: this.makeLabel("LUNA"),
      orbitMat: null, ringMats: [], cloudMat: null, parent: earth,
    };
    this.bodies.push(body);
    this.bodyById.set("moon", body);
    this.pickables.push(mesh);
  }

  private buildBelts() {
    // asteroid belt (instanced)
    this.belt = new THREE.Group();
    const COUNT = 850;
    const geo = new THREE.DodecahedronGeometry(0.14, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.95, metalness: 0.04 });
    const inst = new THREE.InstancedMesh(geo, mat, COUNT);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    for (let i = 0; i < COUNT; i++) {
      const r = 38 + Math.pow(Math.random(), 0.8) * 8;
      const a = Math.random() * Math.PI * 2;
      pos.set(Math.cos(a) * r, (Math.random() - 0.5) * 1.6, -Math.sin(a) * r);
      e.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      q.setFromEuler(e);
      const k = 0.3 + Math.random() * 1.4;
      s.set(k, k * (0.6 + Math.random() * 0.7), k);
      m4.compose(pos, q, s);
      inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.belt.add(inst);
    this.scene.add(this.belt);

    // kuiper belt (points)
    const N = 900;
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 124 + Math.random() * 30;
      const a = Math.random() * Math.PI * 2;
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 1] = (Math.random() - 0.5) * 4;
      p[i * 3 + 2] = -Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const pm = new THREE.PointsMaterial({
      color: 0x9fb4c4, size: 1.5, sizeAttenuation: false,
      transparent: true, opacity: 0.5, depthWrite: false,
    });
    this.scene.add(new THREE.Points(g, pm));
  }

  /* ================= public API ================= */

  setMode(m: FlightMode) {
    if (this.mode === m) return;
    this.mode = m;
    if (m === "orbit") {
      this.controls.enabled = true;
      this.controls.target.copy(this.focused.worldPos);
      // dolly in if the body would be a speck from the ship's position
      const d = this.camera.position.distanceTo(this.focused.worldPos);
      const want = this.focused.radius * 5.5 + 2.5;
      if (d > want) {
        this.tmpV.copy(this.camera.position).sub(this.focused.worldPos).normalize();
        this.camera.position.copy(this.focused.worldPos).addScaledVector(this.tmpV, want);
      }
    } else {
      this.controls.enabled = false;
    }
  }

  setRig(r: CameraRig) {
    this.rig = r;
    this.ship.group.visible = r === "chase";
  }

  setTimeScale(v: number) {
    this.timeScale = THREE.MathUtils.clamp(Number.isFinite(v) ? v : 1, 0, 20);
  }

  focusBody(id: string) {
    const b = this.bodyById.get(id);
    if (b) this.focused = b;
  }

  selectBody(id: string | null) {
    const b = id ? this.bodyById.get(id) ?? null : null;
    this.selected = b;
    this.reticle.visible = !!b;
    for (const body of this.bodies) {
      body.label.classList.toggle("sel", body === b);
      if (body.orbitMat) body.orbitMat.opacity = body === b ? 0.55 : 0.14;
    }
    this.cbs.onSelect(b ? b.info : null);
  }

  resetShipPosition(near?: Body) {
    const target = near ?? this.sun;
    const off = this.tmpV.set(target.radius * 3 + 5, target.radius * 1.2 + 2, target.radius * 3 + 6);
    this.ship.group.position.copy(target.worldPos).add(off);
    this.ship.group.lookAt(target.worldPos);
    this.vel = 0;
    this.throttle = 0;
    this.camPos.copy(this.ship.group.position).add(this.tmpV2.set(0, 2.3, 8.2).applyQuaternion(this.ship.group.quaternion));
    this.camera.position.copy(this.camPos);
  }

  /* ================= per-frame ================= */

  private updateBodies(dt: number) {
    const ts = this.timeScale;
    this.simTime += dt * ts;
    for (const b of this.bodies) {
      if (b.id === "sun") {
        b.node.rotation.y += b.rotSpeed * dt * ts;
        b.worldPos.set(0, 0, 0);
        continue;
      }
      const a = b.phase + this.simTime * b.angSpeed;
      b.node.position.set(Math.cos(a) * b.orbitR, 0, -Math.sin(a) * b.orbitR);
      b.mesh.rotation.y += b.rotSpeed * dt * ts;
      b.mesh.getWorldPosition(b.worldPos);
      for (const rm of b.ringMats) rm.uniforms.uPlanetPos.value.copy(b.worldPos);
    }
    if (this.cloudSpin) this.cloudSpin.rotation.y += 0.05 * dt * ts;
    this.belt.rotation.y += 0.016 * dt * ts;

    const t = this.simTime * 0.25 + performance.now() * 0.00012;
    for (const m of this.sunMats) m.uniforms.uTime.value = t;
    for (const b of this.bodies) if (b.cloudMat) b.cloudMat.uniforms.uTime.value = this.simTime * 0.7;
  }

  private updateShip(dt: number, realT: number) {
    const k = this.keys;
    const boost = k.has("ShiftLeft") || k.has("ShiftRight");

    if (this.mode === "flight") {
      if (k.has("KeyW")) this.throttle += dt * 0.55;
      if (k.has("KeyS")) this.throttle -= dt * 0.7;
      if (k.has("Space")) this.throttle *= Math.max(0, 1 - dt * 2.5);
      this.throttle = THREE.MathUtils.clamp(this.throttle, 0, 1);

      // keyboard steering
      const rot = 1.5 * dt;
      let pitch = 0, yaw = 0, roll = 0;
      if (k.has("ArrowUp")) pitch += rot;
      if (k.has("ArrowDown")) pitch -= rot;
      if (k.has("ArrowLeft")) yaw += rot;
      if (k.has("ArrowRight")) yaw -= rot;
      if (k.has("KeyA")) roll += rot * 0.9;
      if (k.has("KeyD")) roll -= rot * 0.9;
      if (pitch || yaw || roll) {
        this.tmpE.set(pitch, yaw, roll, "XYZ");
        this.tmpQ.setFromEuler(this.tmpE);
        this.ship.group.quaternion.multiply(this.tmpQ);
      }

      const maxSpeed = boost ? 48 : 16;
      const target = this.throttle * maxSpeed;
      this.vel += (target - this.vel) * Math.min(1, dt * (boost ? 2.1 : 1.35));
      const fwd = this.tmpV.set(0, 0, -1).applyQuaternion(this.ship.group.quaternion);
      this.ship.group.position.addScaledVector(fwd, this.vel * dt);

      // soft collisions
      for (const b of this.bodies) {
        const minD = b.radius + 0.7;
        const d = this.ship.group.position.distanceTo(b.worldPos);
        if (d < minD && d > 0.0001) {
          const push = this.tmpV2.copy(this.ship.group.position).sub(b.worldPos).normalize();
          this.ship.group.position.copy(b.worldPos).addScaledVector(push, minD);
          this.vel *= 0.45;
          this.throttle *= 0.55;
        }
      }
    }

    this.ship.setThrottle(this.throttle, boost);
    this.ship.update(dt, realT);
    audio.setEngine(this.mode === "flight" ? this.vel / 48 : 0, boost && this.throttle > 0.05);
  }

  private updateCamera(dt: number) {
    if (this.mode === "orbit") {
      this.controls.target.lerp(this.focused.worldPos, 1 - Math.exp(-dt * 4));
      this.controls.update();
      return;
    }
    const q = this.ship.group.quaternion;
    const p = this.ship.group.position;
    if (this.rig === "cockpit") {
      this.tmpV.set(0, 0.3, -0.85).applyQuaternion(q);
      this.camera.position.copy(p).add(this.tmpV);
      this.camera.quaternion.copy(q);
    } else {
      const boost = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
      this.tmpV.set(0, 2.3, 8.4).applyQuaternion(q);
      if (boost && this.throttle > 0.3) {
        this.tmpV.x += (Math.random() - 0.5) * 0.12;
        this.tmpV.y += (Math.random() - 0.5) * 0.12;
      }
      this.camPos.copy(p).add(this.tmpV);
      this.camera.position.lerp(this.camPos, 1 - Math.exp(-dt * 6));
      const fwd = this.tmpV2.set(0, 0.4, -14).applyQuaternion(q);
      this.camera.lookAt(this.tmpV2.add(p));
    }
  }

  private updateLabels() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const b of this.bodies) {
      this.tmpV.copy(b.worldPos);
      this.tmpV.y += b.radius * 1.35 + 0.55;
      this.tmpV.project(this.camera);
      const el = b.label;
      if (this.tmpV.z > 1 || this.tmpV.z < -1) {
        el.style.opacity = "0";
        continue;
      }
      const x = (this.tmpV.x * 0.5 + 0.5) * w;
      const y = (-this.tmpV.y * 0.5 + 0.5) * h;
      const dist = this.camera.position.distanceTo(b.worldPos);
      const op = THREE.MathUtils.clamp(1.25 - dist / 650, 0, 1) * (dist < b.radius * 1.6 ? 0 : 1);
      el.style.opacity = op.toFixed(2);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -140%)`;
    }
  }

  private updateReticle(realT: number) {
    if (!this.selected) return;
    const b = this.selected;
    this.reticle.position.copy(b.worldPos);
    const s = b.radius * (2.3 + Math.sin(realT * 2.4) * 0.12);
    this.reticle.scale.setScalar(Math.max(0.2, s));
    this.reticle.lookAt(this.camera.position);
    this.reticle.rotation.z += 0.004;
  }

  private emitTelemetry(dt: number) {
    this.telemetryAcc += dt;
    if (this.telemetryAcc < 0.12) return;
    this.telemetryAcc = 0;

    let nearest: Body | null = null;
    let nearestD = Infinity;
    for (const b of this.bodies) {
      const d = this.ship.group.position.distanceTo(b.worldPos) - b.radius;
      if (d < nearestD) { nearestD = d; nearest = b; }
    }
    this.cbs.onTelemetry({
      speed: this.vel * 2.8,
      throttle: this.throttle,
      boost: (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && this.throttle > 0.05,
      distSunAU: this.ship.group.position.length() / AU_UNITS,
      nearestName: nearest ? nearest.info.name : "—",
      nearestDistM: Math.max(0, nearestD) * KM_PER_UNIT / 1e6,
      fps: this.fps,
      simDaysPerSec: this.timeScale * 5.23,
    });
  }

  private pick(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (hits.length > 0) {
      const id = hits[0].object.userData.bodyId as string;
      this.selectBody(id);
      audio.blip(920, 0.08, 0.05);
    }
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const realT = performance.now() * 0.001;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;

    this.updateBodies(dt);
    this.updateShip(dt, realT);
    this.updateCamera(dt);
    this.updateLabels();
    this.updateReticle(realT);
    this.emitTelemetry(dt);

    this.composer.render();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => this.disposeMat(m));
      else if (mat) this.disposeMat(mat);
    });
    this.composer.dispose();
    this.renderer.dispose();
    el.remove();
    this.labelLayer.remove();
  }

  private disposeMat(m: THREE.Material) {
    const anyM = m as THREE.Material & { map?: THREE.Texture | null };
    if (anyM.map) anyM.map.dispose();
    m.dispose();
  }
}

export { ALL_INFO };
