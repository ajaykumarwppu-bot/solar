import * as THREE from "three";
import { exhaustMaterial } from "./materials";

export interface Ship {
  group: THREE.Group;
  setThrottle: (v: number, boost: boolean) => void;
  update: (dt: number, time: number) => void;
  engineLight: THREE.PointLight;
  intensity: { value: number };
}

export function createShip(): Ship {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xd7dde3, metalness: 0.88, roughness: 0.34 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x262d36, metalness: 0.62, roughness: 0.5 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x123134, metalness: 0.95, roughness: 0.12,
    emissive: 0x0d4a44, emissiveIntensity: 0.55,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x3a2f1c, emissive: 0xf5a942, emissiveIntensity: 1.8, metalness: 0.4, roughness: 0.4,
  });

  // Fuselage (forward = -Z)
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.15, 2.3, 10), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.85, 10), hullMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.55;
  group.add(nose);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 1.7), darkMat);
  spine.position.set(0, 0.2, 0.25);
  group.add(spine);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), canopyMat);
  canopy.scale.set(0.75, 0.6, 1.25);
  canopy.position.set(0, 0.17, -0.62);
  group.add(canopy);

  // Wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.055, 0.92), darkMat);
  wing.position.set(0, -0.06, 0.42);
  group.add(wing);

  const wingEdgeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.95), accentMat);
  wingEdgeL.position.set(-1.17, -0.06, 0.42);
  const wingEdgeR = wingEdgeL.clone();
  wingEdgeR.position.x = 1.17;
  group.add(wingEdgeL, wingEdgeR);

  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.62), hullMat);
  finL.position.set(-1.12, 0.22, 0.5);
  finL.rotation.z = 0.22;
  const finR = finL.clone();
  finR.position.x = 1.12;
  finR.rotation.z = -0.22;
  group.add(finL, finR);

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.72), hullMat);
  tailFin.position.set(0, 0.46, 0.85);
  group.add(tailFin);
  const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.74), accentMat);
  tailTip.position.set(0, 0.76, 0.85);
  group.add(tailTip);

  // Engines
  const nozzleGeo = new THREE.TorusGeometry(0.13, 0.028, 8, 20);
  const engineGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.95, 10);
  const exhausts: THREE.Mesh[] = [];
  const exMats: THREE.ShaderMaterial[] = [];
  for (const sx of [-1, 1]) {
    const eng = new THREE.Mesh(engineGeo, darkMat);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(0.38 * sx, -0.02, 0.98);
    group.add(eng);

    const nozzle = new THREE.Mesh(nozzleGeo, accentMat);
    nozzle.position.set(0.38 * sx, -0.02, 1.44);
    group.add(nozzle);

    const exGeo = new THREE.ConeGeometry(0.115, 1.35, 12, 1, true);
    exGeo.rotateX(Math.PI / 2);
    const mat = exhaustMaterial();
    const flame = new THREE.Mesh(exGeo, mat);
    flame.position.set(0.38 * sx, -0.02, 2.1);
    flame.renderOrder = 5;
    group.add(flame);
    exhausts.push(flame);
    exMats.push(mat);
  }

  // Nav lights
  const navRedMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3b30, emissiveIntensity: 2 });
  const navGreenMat = new THREE.MeshStandardMaterial({ color: 0x00221a, emissive: 0x35e0b0, emissiveIntensity: 2 });
  const navWhiteMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 2 });
  const dotGeo = new THREE.SphereGeometry(0.035, 8, 8);
  const navL = new THREE.Mesh(dotGeo, navRedMat);
  navL.position.set(-1.17, -0.02, 0.05);
  const navR = new THREE.Mesh(dotGeo, navGreenMat);
  navR.position.set(1.17, -0.02, 0.05);
  const navT = new THREE.Mesh(dotGeo, navWhiteMat);
  navT.position.set(0, 0.8, 1.0);
  group.add(navL, navR, navT);

  const engineLight = new THREE.PointLight(0xffa050, 0, 14, 2);
  engineLight.position.set(0, 0, 2.0);
  group.add(engineLight);

  const intensity = { value: 0 };
  let target = 0;
  let boosting = false;

  return {
    group,
    engineLight,
    intensity,
    setThrottle(v: number, boost: boolean) {
      target = THREE.MathUtils.clamp(v, 0, 1);
      boosting = boost;
    },
    update(dt: number, time: number) {
      const desired = boosting ? Math.min(1, target + 0.35) : target * 0.75;
      intensity.value += (desired - intensity.value) * Math.min(1, dt * 6);
      const k = intensity.value;
      for (let i = 0; i < exMats.length; i++) {
        exMats[i].uniforms.uTime.value = time;
        exMats[i].uniforms.uIntensity.value = k * 1.15 + (boosting ? 0.25 : 0);
        exhausts[i].scale.set(1, 1, 0.35 + k * (boosting ? 1.5 : 1.05));
      }
      engineLight.intensity = k * (boosting ? 26 : 12);
      // nav light blink
      const blink = Math.sin(time * 5.2) > 0 ? 2.4 : 0.15;
      navRedMat.emissiveIntensity = blink;
      navGreenMat.emissiveIntensity = blink;
      navWhiteMat.emissiveIntensity = Math.sin(time * 9.0) > 0.6 ? 3 : 0.1;
    },
  };
}
