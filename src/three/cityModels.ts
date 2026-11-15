import * as THREE from 'three';
import { pickVehicleColor, type VehicleType } from '../shared/parkingLogic.ts';

export { pickVehicleColor };

export interface VehicleAppearance {
  bodyColor: number;
  accentColor: number;
}

/**
 * Builds a composite 9-part stylized smart-city vehicle grounded at y = 0.
 * Faces +Z by default.
 */
export function createVehicleMesh(
  type: VehicleType,
  bodyHex: number,
  shadowTexture: THREE.Texture,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();

  const dims =
    type === 'suv'
      ? { len: 3.7, wid: 1.66, bodyH: 0.62, cabH: 0.56, cabLen: 2.05, cabOffset: -0.18 }
      : type === 'compact'
        ? { len: 3.05, wid: 1.5, bodyH: 0.52, cabH: 0.48, cabLen: 1.65, cabOffset: -0.1 }
        : type === 'ev_hatch'
          ? { len: 3.35, wid: 1.58, bodyH: 0.54, cabH: 0.5, cabLen: 1.95, cabOffset: -0.15 }
          : { len: 3.65, wid: 1.58, bodyH: 0.5, cabH: 0.44, cabLen: 1.85, cabOffset: -0.12 };

  // 1. Grounded contact shadow disc
  const shadowGeo = new THREE.PlaneGeometry(dims.wid * 1.45, dims.len * 1.18);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  group.add(shadowPlane);

  // 2. Sculpted beveled lower chassis (ExtrudeGeometry side silhouette rotated to +Z)
  const halfL = dims.len / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfL + 0.08, 0.22);
  shape.lineTo(halfL - 0.14, 0.22);
  shape.lineTo(halfL, 0.36);
  shape.lineTo(halfL - 0.08, dims.bodyH + 0.18);
  shape.lineTo(halfL * 0.42, dims.bodyH + 0.24);
  shape.lineTo(-halfL * 0.68, dims.bodyH + 0.24);
  shape.lineTo(-halfL + 0.04, dims.bodyH + 0.16);
  shape.lineTo(-halfL, 0.34);
  shape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: dims.wid - 0.12,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  bodyGeo.center();
  // Extrude was in XY with Z depth -> rotate Y +90deg so length runs along Z, width along X
  bodyGeo.rotateY(Math.PI / 2);

  const paintMat = new THREE.MeshStandardMaterial({
    color: bodyHex,
    roughness: 0.26,
    metalness: 0.45,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.position.y = 0.22 + dims.bodyH / 2;
  bodyMesh.castShadow = !isSoftwareGl;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 3. Matte dark lower rocker trim / bumper skirt
  const skirtGeo = new THREE.BoxGeometry(dims.wid + 0.02, 0.14, dims.len - 0.08);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x161b22,
    roughness: 0.82,
    metalness: 0.1,
  });
  const skirt = new THREE.Mesh(skirtGeo, trimMat);
  skirt.position.y = 0.24;
  group.add(skirt);

  // 4. Glossy dark glasshouse cabin
  const cabShape = new THREE.Shape();
  const cHalf = dims.cabLen / 2;
  cabShape.moveTo(-cHalf, 0);
  cabShape.lineTo(cHalf, 0);
  cabShape.lineTo(cHalf * 0.62, dims.cabH);
  cabShape.lineTo(-cHalf * 0.72, dims.cabH);
  cabShape.closePath();

  const cabGeo = new THREE.ExtrudeGeometry(cabShape, {
    depth: dims.wid - 0.34,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  cabGeo.center();
  cabGeo.rotateY(Math.PI / 2);

  const glassMat = isSoftwareGl
    ? new THREE.MeshStandardMaterial({
        color: 0x101c2c,
        roughness: 0.12,
        metalness: 0.85,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0x0f1b2d,
        roughness: 0.08,
        metalness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });

  const cabin = new THREE.Mesh(cabGeo, glassMat);
  cabin.position.set(0, dims.bodyH + 0.22 + dims.cabH * 0.46, dims.cabOffset);
  cabin.castShadow = !isSoftwareGl;
  group.add(cabin);

  // 5. Roof cap panel (body paint contrast over glasshouse)
  const roofCapGeo = new THREE.BoxGeometry(dims.wid - 0.38, 0.05, dims.cabLen * 0.62);
  const roofCap = new THREE.Mesh(roofCapGeo, paintMat);
  roofCap.position.set(0, dims.bodyH + 0.22 + dims.cabH - 0.01, dims.cabOffset - 0.06);
  group.add(roofCap);

  // 6. Front LED lightbar & Rear red taillight bar
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const headlight = new THREE.Mesh(
    new THREE.BoxGeometry(dims.wid - 0.28, 0.08, 0.06),
    headlightMat,
  );
  headlight.position.set(0, 0.48, halfL + 0.01);
  group.add(headlight);

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xfca5a5,
    emissive: 0xef4444,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const taillight = new THREE.Mesh(
    new THREE.BoxGeometry(dims.wid - 0.26, 0.08, 0.06),
    taillightMat,
  );
  taillight.position.set(0, 0.52, -halfL - 0.01);
  group.add(taillight);

  // 7-10. Four wheels (rubber tire + alloy rim cap)
  const wheelZ = halfL * 0.62;
  const wheelX = dims.wid / 2 - 0.04;
  const wheelRadius = type === 'suv' ? 0.3 : 0.26;
  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.2, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.56, wheelRadius * 0.56, 0.21, 14);
  rimGeo.rotateZ(Math.PI / 2);

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });

  const positions: Array<[number, number]> = [
    [-wheelX, wheelZ],
    [wheelX, wheelZ],
    [-wheelX, -wheelZ],
    [wheelX, -wheelZ],
  ];

  for (const [wx, wz] of positions) {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(wx, wheelRadius, wz);
    tire.castShadow = !isSoftwareGl;
    group.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(wx, wheelRadius, wz);
    group.add(rim);
  }

  return group;
}

/**
 * 6-part DC Fast Charger pedestal for EV bays.
 */
export function createEvChargerPedestal(isSoftwareGl: boolean): {
  group: THREE.Group;
  statusMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85, metalness: 0.08 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.32, metalness: 0.55 });
  const darkPanelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.4 });
  const statusMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  // 1. Concrete plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.14, 0.48), plinthMat);
  plinth.position.y = 0.07;
  group.add(plinth);

  // 2. Main aluminum tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.55, 0.26), housingMat);
  tower.position.y = 0.14 + 1.55 / 2;
  tower.castShadow = !isSoftwareGl;
  group.add(tower);

  // 3. Recessed OLED screen face
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.04), darkPanelMat);
  screen.position.set(0, 1.15, 0.13);
  group.add(screen);

  // 4. Top illuminated status crown
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.28), statusMat);
  crown.position.y = 1.72;
  group.add(crown);

  // 5. Cable loop via TubeGeometry
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.22, 1.25, 0.02),
    new THREE.Vector3(0.34, 0.92, 0.08),
    new THREE.Vector3(0.28, 0.58, 0.02),
    new THREE.Vector3(0.22, 0.98, -0.04),
  ]);
  const cableGeo = new THREE.TubeGeometry(curve, 16, 0.028, 8, false);
  const cable = new THREE.Mesh(cableGeo, darkPanelMat);
  group.add(cable);

  // 6. Charger plug holster
  const holster = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), darkPanelMat);
  holster.position.set(0.23, 1.0, -0.02);
  group.add(holster);

  return { group, statusMat };
}

/**
 * 9-part Automated Entry/Exit Gate Plaza with articulated barrier arm.
 */
export function createGatePlaza(
  kind: 'entry' | 'exit',
  isSoftwareGl: boolean,
): {
  group: THREE.Group;
  armPivot: THREE.Group;
  signalMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.05 });
  const kioskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.12, metalness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: kind === 'entry' ? 0x0ea5e9 : 0xf59e0b,
    roughness: 0.35,
    metalness: 0.3,
  });
  const signalMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  // 1. Concrete island median
  const island = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 1.2), concreteMat);
  island.position.set(0, 0.09, -1.65);
  island.receiveShadow = true;
  group.add(island);

  // 2. Gate reader pedestal / kiosk
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.65), kioskMat);
  kiosk.position.set(-0.35, 0.88, -1.65);
  kiosk.castShadow = !isSoftwareGl;
  group.add(kiosk);

  // 3. Illuminated visor strip on kiosk
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.68), accentMat);
  visor.position.set(-0.35, 1.52, -1.65);
  group.add(visor);

  // 4. ANPR Gantry arch spanning across the lane (Z = -1.65 to +1.65)
  const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 12), kioskMat);
  postA.position.set(0.55, 1.6, -1.85);
  postA.castShadow = !isSoftwareGl;
  group.add(postA);

  const postB = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 12), kioskMat);
  postB.position.set(0.55, 1.6, 1.85);
  postB.castShadow = !isSoftwareGl;
  group.add(postB);

  const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 4.1), kioskMat);
  crossbeam.position.set(0.55, 3.18, 0);
  crossbeam.castShadow = !isSoftwareGl;
  group.add(crossbeam);

  // 5. LPR Camera pod + Traffic signal indicator
  const camPod = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.45), glassMat);
  camPod.position.set(0.45, 2.94, 0);
  group.add(camPod);

  const signalBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), signalMat);
  signalBeacon.position.set(0.55, 3.45, -1.4);
  group.add(signalBeacon);

  // 6. Barrier Motor Housing + Articulated Barrier Boom Arm
  const motorBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.42), accentMat);
  motorBox.position.set(0.38, 0.7, -1.42);
  motorBox.castShadow = !isSoftwareGl;
  group.add(motorBox);

  const armPivot = new THREE.Group();
  armPivot.position.set(0.38, 1.02, -1.25);

  const armRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
  const armWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  // Striped boom arm extending +Z across the 2.7m lane
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.44),
      i % 2 === 0 ? armRedMat : armWhiteMat,
    );
    seg.position.set(0, 0, 0.24 + i * 0.45);
    seg.castShadow = !isSoftwareGl;
    armPivot.add(seg);
  }
  group.add(armPivot);

  return { group, armPivot, signalMat };
}

/**
 * 10-part Smart Terminal & Skybridge Pavilion with live occupancy totem.
 */
export function createTerminalPavilion(
  totemCanvas: HTMLCanvasElement,
  isSoftwareGl: boolean,
): {
  group: THREE.Group;
  totemTexture: THREE.CanvasTexture;
} {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78, metalness: 0.05 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.32, metalness: 0.72 });
  const glassMat = isSoftwareGl
    ? new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.8 })
    : new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.78,
      });
  const warmInsideMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.35,
    roughness: 0.6,
  });

  // 1. Stepped architectural plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.24, 4.2), stoneMat);
  plinth.position.y = 0.12;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 2. Interior glowing core (visible through glass atrium)
  const core = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.5, 2.2), warmInsideMat);
  core.position.y = 1.48;
  group.add(core);

  // 3. Glazed atrium facade
  const facade = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.75, 3.1), glassMat);
  facade.position.y = 1.62;
  facade.castShadow = !isSoftwareGl;
  group.add(facade);

  // 4. Exterior structural steel columns (4 corner mullions)
  const colGeo = new THREE.BoxGeometry(0.22, 3.1, 0.22);
  for (const cx of [-2.95, 2.95]) {
    for (const cz of [-1.6, 1.6]) {
      const col = new THREE.Mesh(colGeo, steelMat);
      col.position.set(cx, 1.79, cz);
      col.castShadow = !isSoftwareGl;
      group.add(col);
    }
  }

  // 5. Cantilevered aerodynamic aluminum roof deck
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.28, 4.5), steelMat);
  roof.position.y = 3.35;
  roof.castShadow = !isSoftwareGl;
  group.add(roof);

  // 6. Roof skylight louver accent
  const skylight = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 1.8), glassMat);
  skylight.position.y = 3.55;
  group.add(skylight);

  // 7. Rooftop telemetry radar/sensor dome
  const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.3, 14), stoneMat);
  domeBase.position.set(2.3, 3.64, -1.1);
  group.add(domeBase);

  const domeOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.2 }),
  );
  domeOrb.position.set(2.3, 3.9, -1.1);
  group.add(domeOrb);

  // 8. Live Digital Occupancy Totem standing beside entrance (angled toward overview camera)
  const totemGroup = new THREE.Group();
  totemGroup.position.set(4.55, 0, 0.2);
  totemGroup.rotation.y = 0.48;

  const totemBody = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.75, 0.28), steelMat);
  totemBody.position.set(0, 1.38, 0);
  totemBody.castShadow = !isSoftwareGl;
  totemGroup.add(totemBody);

  const totemTexture = new THREE.CanvasTexture(totemCanvas);
  totemTexture.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: totemTexture });
  const screenFront = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.86), screenMat);
  screenFront.position.set(0, 1.56, 0.15);
  totemGroup.add(screenFront);

  const screenBack = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.86), screenMat);
  screenBack.position.set(0, 1.56, -0.15);
  screenBack.rotation.y = Math.PI;
  totemGroup.add(screenBack);

  group.add(totemGroup);

  return { group, totemTexture };
}

/**
 * 8-part Solar Canopy spanning Zone A (A1-A4) and EV (E1-E4) north wing.
 */
export function createSolarCanopy(
  solarTexture: THREE.Texture,
  isSoftwareGl: boolean,
): { group: THREE.Group; underGlowMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.38, metalness: 0.72 });
  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTexture,
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.45,
  });
  const underGlowMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x7dd3fc,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });

  // 5 angled steel support columns along the north edge (z = -13.5)
  for (const x of [-13.8, -7.8, -1.8, 4.2, 10.6]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), steelMat);
    col.position.set(x, 1.7, -13.5);
    col.castShadow = !isSoftwareGl;
    group.add(col);

    // Angled cantilever strut
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 4.8), steelMat);
    strut.position.set(x, 3.45, -11.2);
    strut.rotation.x = -0.08;
    group.add(strut);
  }

  // Tilted photovoltaic canopy deck over bays
  const deck = new THREE.Mesh(new THREE.BoxGeometry(25.8, 0.14, 5.0), solarMat);
  deck.position.set(-1.5, 3.65, -11.1);
  deck.rotation.x = -0.08;
  deck.castShadow = !isSoftwareGl;
  group.add(deck);

  // Anodized perimeter fascia trim
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(26.0, 0.2, 0.16), steelMat);
  fascia.position.set(-1.5, 3.46, -8.65);
  group.add(fascia);

  // Under-canopy linear LED luminaire bar
  const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(24.6, 0.06, 0.16), underGlowMat);
  lightStrip.position.set(-1.5, 3.48, -9.85);
  group.add(lightStrip);

  return { group, underGlowMat };
}

/**
 * 5-part Smart City LED Streetlamp.
 */
export function createSmartStreetlamp(): {
  group: THREE.Group;
  lampBulbMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfde68a,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.35, 10), poleMat);
  base.position.y = 0.175;
  group.add(base);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 4.1, 10), poleMat);
  mast.position.y = 2.2;
  group.add(mast);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.1), poleMat);
  arm.position.set(0.45, 4.2, 0);
  group.add(arm);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.22), poleMat);
  head.position.set(0.85, 4.18, 0);
  group.add(head);

  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.16), lampBulbMat);
  lens.position.set(0.85, 4.12, 0);
  group.add(lens);

  return { group, lampBulbMat };
}

/**
 * 5-part Architectural Planter & Multi-canopy Urban Tree.
 */
export function createUrbanTree(scale = 1, tintHex = 0x2d6a4f): THREE.Group {
  const group = new THREE.Group();
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ color: tintHex, roughness: 0.82, metalness: 0.02 });

  const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.62, 0.42, 12), planterMat);
  planter.position.y = 0.21;
  group.add(planter);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.35, 8), trunkMat);
  trunk.position.y = 0.95;
  group.add(trunk);

  const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), leafMat);
  crown1.position.set(0, 2.05, 0);
  group.add(crown1);

  const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), leafMat);
  crown2.position.set(0.38, 1.78, 0.22);
  group.add(crown2);

  const crown3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), leafMat);
  crown3.position.set(-0.34, 1.85, -0.2);
  group.add(crown3);

  group.scale.setScalar(scale);
  return group;
}
