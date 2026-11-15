import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { BayCategory, FacilityState, ParkingBay } from '../shared/parkingLogic.ts';
import { computeFacilityMetrics } from '../shared/parkingLogic.ts';
import {
  createEvChargerPedestal,
  createGatePlaza,
  createSmartStreetlamp,
  createSolarCanopy,
  createTerminalPavilion,
  createUrbanTree,
  createVehicleMesh,
  pickVehicleColor,
} from './cityModels.ts';
import {
  createAsphaltTextures,
  createBayDecalTexture,
  createCityFacadeTexture,
  createContactShadowTexture,
  createRoadArrowTexture,
  createSolarPanelTexture,
  getStatusHex,
  updateTotemCanvas,
} from './textures.ts';

export type CameraPresetId = 'overview' | 'entry_gate' | 'ev_wing' | 'terminal';
export type LightingMode = 'day' | 'dusk';

interface BayVisual {
  bay: ParkingBay;
  decalMesh: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
  highlightMesh: THREE.Mesh;
  highlightMat: THREE.MeshBasicMaterial;
  hitMesh: THREE.Mesh;
  vehicleGroup: THREE.Group | null;
  reservedPad: THREE.Mesh;
  evStatusMat?: THREE.MeshStandardMaterial;
}

interface DrivingVehicle {
  bayId: string;
  kind: 'arrival' | 'departure';
  group: THREE.Group;
  waypoints: THREE.Vector3[];
  progress: number;
  speed: number;
  onArrive?: () => void;
}

const CAMERA_PRESETS: Record<CameraPresetId, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [24, 21.5, 29.5], target: [0, 0.5, 0] },
  entry_gate: { pos: [-25, 9.5, 16.5], target: [-14, 1.2, 6.85] },
  ev_wing: { pos: [12, 10.5, -18.5], target: [4.5, 1.0, -7.0] },
  terminal: { pos: [-16, 8.5, 21.5], target: [-9.5, 1.6, 10.5] },
};

// Reusable scratch math objects (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class ParkingSceneManager {
  private container: HTMLElement;
  private onSelectBay: (bayId: string) => void;
  private onHoverBay: (bayId: string | null) => void;
  private onContextLost?: () => void;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private pointer = new THREE.Vector2();

  private bayVisuals = new Map<string, BayVisual>();
  private hitMeshes: THREE.Object3D[] = [];
  private contactShadowTexture: THREE.CanvasTexture;
  private totemCanvas: HTMLCanvasElement;
  private totemTexture: THREE.CanvasTexture;

  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private canopyGlowMat!: THREE.MeshStandardMaterial;

  private entryGate!: { group: THREE.Group; armPivot: THREE.Group; signalMat: THREE.MeshStandardMaterial };
  private exitGate!: { group: THREE.Group; armPivot: THREE.Group; signalMat: THREE.MeshStandardMaterial };
  private entryGateTimer = 0;
  private exitGateTimer = 0;
  private drivingVehicles: DrivingVehicle[] = [];

  private selectedBayId: string | null = null;
  private hoveredBayId: string | null = null;
  private activeCategory: BayCategory | 'all' = 'all';
  private lastState: FacilityState | null = null;

  private cameraTransition: {
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
  } = {
    active: false,
    targetPos: new THREE.Vector3(),
    targetLook: new THREE.Vector3(),
  };

  private frameId = 0;
  private loopActive = false;
  private renderBusy = false;
  private renderDirty = false;
  private lastTickMs = 0;
  private lastHoverRaycastMs = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private lastWidth = 0;
  private lastHeight = 0;
  private pendingResize = false;
  private disposed = false;

  private resizeObserver: ResizeObserver;

  constructor(options: {
    container: HTMLElement;
    initialState: FacilityState;
    onSelectBay: (bayId: string) => void;
    onHoverBay: (bayId: string | null) => void;
    onContextLost?: () => void;
  }) {
    this.container = options.container;
    this.onSelectBay = options.onSelectBay;
    this.onHoverBay = options.onHoverBay;
    this.onContextLost = options.onContextLost;

    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    this.lastWidth = width;
    this.lastHeight = height;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 220);
    this.camera.position.set(...CAMERA_PRESETS.overview.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...CAMERA_PRESETS.overview.target);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.minPolarAngle = 0.18;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 64;
    this.controls.enablePan = true;
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.cameraTransition.active = false;
    });
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(1);

    this.contactShadowTexture = createContactShadowTexture();
    this.totemCanvas = document.createElement('canvas');
    this.totemCanvas.width = 256;
    this.totemCanvas.height = 320;
    const initialMetrics = computeFacilityMetrics(options.initialState);
    updateTotemCanvas(
      this.totemCanvas,
      initialMetrics.availableBays,
      initialMetrics.evAvailable,
      initialMetrics.totalBays,
    );

    const terminalRes = createTerminalPavilion(this.totemCanvas, this.isSoftwareGl);
    this.totemTexture = terminalRes.totemTexture;

    this.setupLighting();
    this.buildEnvironmentAndArchitecture(terminalRes.group);
    this.buildParkingBays(options.initialState);
    this.applyLightingMode('day');
    this.syncState(options.initialState, false);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    // Draw initial frame on mount so first paint is never blank
    this.renderer.render(this.scene, this.camera);
  }

  private setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.75);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    this.keyLight.position.set(20, 28, 16);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -24;
    this.keyLight.shadow.camera.right = 24;
    this.keyLight.shadow.camera.top = 20;
    this.keyLight.shadow.camera.bottom = -20;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 75;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    this.rimLight.position.set(-18, 12, -16);
    this.scene.add(this.rimLight);
  }

  private buildEnvironmentAndArchitecture(terminalGroup: THREE.Group) {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const asphaltTex = createAsphaltTextures(maxAniso);
    const solarTex = createSolarPanelTexture(maxAniso);
    const arrowTex = createRoadArrowTexture(maxAniso);

    // Outer urban district ground plane
    const districtGround = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.92, metalness: 0.02 }),
    );
    districtGround.rotation.x = -Math.PI / 2;
    districtGround.position.y = -0.18;
    districtGround.receiveShadow = true;
    this.scene.add(districtGround);

    // Concrete sidewalk plinth
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(44.5, 0.2, 33.5),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.86, metalness: 0.04 }),
    );
    sidewalk.position.set(-0.5, -0.11, 0);
    sidewalk.receiveShadow = true;
    this.scene.add(sidewalk);

    // Main parking asphalt deck at y = 0
    const asphaltDeck = new THREE.Mesh(
      new THREE.PlaneGeometry(40.0, 29.0),
      new THREE.MeshStandardMaterial({
        map: asphaltTex.map,
        roughnessMap: asphaltTex.roughnessMap,
        color: 0xffffff,
        roughness: 0.88,
        metalness: 0.05,
      }),
    );
    asphaltDeck.rotation.x = -Math.PI / 2;
    asphaltDeck.position.set(-0.5, 0, 0);
    asphaltDeck.receiveShadow = true;
    this.scene.add(asphaltDeck);

    // Approach avenues (West Entry & East Exit aligned to South Aisle z = 6.85)
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex.map,
      color: 0xd1d5db,
      roughness: 0.9,
      metalness: 0.04,
    });
    const westRoad = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.8), roadMat);
    westRoad.rotation.x = -Math.PI / 2;
    westRoad.position.set(-33, 0.005, 6.85);
    westRoad.receiveShadow = true;
    this.scene.add(westRoad);

    const eastRoad = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.8), roadMat);
    eastRoad.rotation.x = -Math.PI / 2;
    eastRoad.position.set(32, 0.005, 6.85);
    eastRoad.receiveShadow = true;
    this.scene.add(eastRoad);

    // Central landscaped island curb dividing North & South center bay rows at z = 0
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8, metalness: 0.05 });
    const centerCurb = new THREE.Mesh(new THREE.BoxGeometry(23.5, 0.16, 0.7), curbMat);
    centerCurb.position.set(-2.5, 0.08, 0);
    centerCurb.receiveShadow = true;
    this.scene.add(centerCurb);

    // Directional driving lane arrows (y = 0.025 + polygonOffset) along z = ±6.85 aisles
    const arrowMat = new THREE.MeshBasicMaterial({
      map: arrowTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const arrowPlacements: Array<{ x: number; z: number; rotY: number }> = [
      { x: -13.0, z: 6.85, rotY: -Math.PI / 2 },
      { x: -4.5, z: 6.85, rotY: -Math.PI / 2 },
      { x: 9.5, z: 6.85, rotY: -Math.PI / 2 },
      { x: 13.5, z: 0, rotY: 0 },
      { x: 7.5, z: -6.85, rotY: Math.PI / 2 },
      { x: -4.5, z: -6.85, rotY: Math.PI / 2 },
      { x: -15.5, z: 0, rotY: Math.PI },
    ];
    const arrowGeo = new THREE.PlaneGeometry(1.3, 1.3);
    for (const ap of arrowPlacements) {
      const m = new THREE.Mesh(arrowGeo, arrowMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = ap.rotY;
      m.position.set(ap.x, 0.025, ap.z);
      this.scene.add(m);
    }

    // Pedestrian zebra crosswalk connecting Terminal Pavilion across South Aisle to Accessible Bays
    const stripeMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const stripeGeo = new THREE.PlaneGeometry(0.45, 2.6);
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-11.8 + i * 0.9, 0.025, 6.85);
      this.scene.add(stripe);
    }

    // Hero Structure 1: Smart Terminal & Occupancy Totem on South-West Promenade
    terminalGroup.position.set(-10.2, 0, 11.4);
    this.scene.add(terminalGroup);

    // Hero Structure 2: Solar Canopy over North Outer Wing (A1-A4 & E1-E4)
    const canopy = createSolarCanopy(solarTex, this.isSoftwareGl);
    this.canopyGlowMat = canopy.underGlowMat;
    this.scene.add(canopy.group);

    // Hero Structure 3 & 4: Automated Entry & Exit Gate Plazas along South Aisle (z = 6.85)
    this.entryGate = createGatePlaza('entry', this.isSoftwareGl);
    this.entryGate.group.position.set(-17.8, 0, 6.85);
    this.scene.add(this.entryGate.group);

    this.exitGate = createGatePlaza('exit', this.isSoftwareGl);
    this.exitGate.group.position.set(16.2, 0, 6.85);
    this.scene.add(this.exitGate.group);

    // Smart Streetlamps along perimeter
    const lampCoords: Array<[number, number, number]> = [
      [-17.5, -14.2, -Math.PI / 2],
      [-4.0, -14.2, -Math.PI / 2],
      [10.5, -14.2, -Math.PI / 2],
      [-17.5, 14.2, Math.PI / 2],
      [-2.0, 14.2, Math.PI / 2],
      [12.5, 14.2, Math.PI / 2],
    ];
    for (const [lx, lz, rot] of lampCoords) {
      const lamp = createSmartStreetlamp();
      lamp.group.position.set(lx, 0, lz);
      lamp.group.rotation.y = rot;
      this.lampMats.push(lamp.lampBulbMat);
      this.scene.add(lamp.group);
    }

    // Landscaped Urban Trees in planters
    const treeCoords: Array<[number, number, number, number]> = [
      [-19.5, -13.8, 0.95, 0x2d6a4f],
      [17.5, -13.8, 1.05, 0x40916c],
      [-19.5, 13.6, 0.9, 0x2d6a4f],
      [17.5, 13.6, 1.0, 0x52b788],
      [-4.8, 12.6, 0.85, 0x40916c],
      [15.2, -6.5, 0.88, 0x2d6a4f],
    ];
    for (const [tx, tz, sc, tint] of treeCoords) {
      const tree = createUrbanTree(sc, tint);
      tree.position.set(tx, 0, tz);
      this.scene.add(tree);
    }

    // Subtle Smart-City Context Massing ONLY behind/flanking the facility (never occluding +Z camera)
    const facadeTex = createCityFacadeTexture(maxAniso);
    const contextMatA = new THREE.MeshStandardMaterial({
      map: facadeTex,
      color: 0xe2e8f0,
      roughness: 0.72,
      metalness: 0.15,
    });
    const contextMatB = new THREE.MeshStandardMaterial({
      map: facadeTex,
      color: 0xcbd5e1,
      roughness: 0.65,
      metalness: 0.22,
    });
    const cityBlocks: Array<[number, number, number, number, number]> = [
      [-34, -24, 13, 12, 10],
      [-14, -27, 16, 16, 10],
      [6, -26, 14, 10, 11],
      [27, -24, 13, 19, 12],
      [34, -5, 10, 13, 11],
      [-35, -3, 11, 10, 12],
    ];
    cityBlocks.forEach(([bx, bz, w, h, d], idx) => {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        idx % 2 === 0 ? contextMatA : contextMatB,
      );
      b.position.set(bx, h / 2 - 0.18, bz);
      this.scene.add(b);
    });
  }

  private buildParkingBays(state: FacilityState) {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
    const beaconGeo = new THREE.SphereGeometry(0.14, 12, 12);

    for (const bay of state.bays) {
      const stallW = bay.category === 'accessible' ? 3.05 : 2.55;
      const stallL = 4.2;

      // 1. Bay Painted Decal (flip text when rotationY !== 0 so labels read upright)
      const decalTex = createBayDecalTexture(
        bay.id,
        bay.category,
        maxAniso,
        bay.coords.rotationY !== 0,
      );
      const decalMat = new THREE.MeshBasicMaterial({
        map: decalTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const decalMesh = new THREE.Mesh(new THREE.PlaneGeometry(stallW, stallL), decalMat);
      decalMesh.rotation.x = -Math.PI / 2;
      decalMesh.rotation.z = bay.coords.rotationY;
      decalMesh.position.set(bay.coords.x, 0.02, bay.coords.z);
      this.scene.add(decalMesh);

      // 2. Selection / Hover Highlight Outline Pad
      const highlightMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const highlightMesh = new THREE.Mesh(new THREE.PlaneGeometry(stallW + 0.25, stallL + 0.25), highlightMat);
      highlightMesh.rotation.x = -Math.PI / 2;
      highlightMesh.rotation.z = bay.coords.rotationY;
      highlightMesh.position.set(bay.coords.x, 0.03, bay.coords.z);
      this.scene.add(highlightMesh);

      // 3. Reserved Holographic Pad Marker (visible when status === 'reserved')
      const reservedPad = new THREE.Mesh(
        new THREE.BoxGeometry(stallW * 0.75, 0.08, stallL * 0.75),
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.32,
          roughness: 0.3,
        }),
      );
      reservedPad.position.set(bay.coords.x, 0.06, bay.coords.z);
      reservedPad.visible = false;
      this.scene.add(reservedPad);

      // 4. Overhead / Curb Sensor Beacon
      const beaconMat = new THREE.MeshStandardMaterial({
        color: getStatusHex(bay.status),
        emissive: getStatusHex(bay.status),
        emissiveIntensity: 1.5,
        roughness: 0.2,
      });

      const backSign = bay.coords.rotationY === 0 ? -1 : 1;
      const sensorZ = Math.abs(bay.coords.z) < 4 ? 0 : bay.coords.z + backSign * (stallL / 2 + 0.35);

      if (bay.zone === 'A' && ['A1', 'A2', 'A3', 'A4'].includes(bay.id)) {
        const pod = new THREE.Mesh(beaconGeo, beaconMat);
        pod.position.set(bay.coords.x, 3.35, bay.coords.z);
        this.scene.add(pod);
      } else if (bay.zone === 'E' && ['E1', 'E2', 'E3', 'E4'].includes(bay.id)) {
        const pod = new THREE.Mesh(beaconGeo, beaconMat);
        pod.position.set(bay.coords.x, 3.35, bay.coords.z);
        this.scene.add(pod);
      } else {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(bay.coords.x, 1.1, sensorZ);
        this.scene.add(pole);

        const bulb = new THREE.Mesh(beaconGeo, beaconMat);
        bulb.position.set(bay.coords.x, 2.25, sensorZ);
        this.scene.add(bulb);
      }

      // 5. EV Fast-Charge Pedestal for EV bays
      let evStatusMat: THREE.MeshStandardMaterial | undefined;
      if (bay.category === 'ev') {
        const charger = createEvChargerPedestal(this.isSoftwareGl);
        const chargerZ = Math.abs(bay.coords.z) < 4 ? -0.1 : sensorZ;
        charger.group.position.set(bay.coords.x + 0.88, 0, chargerZ);
        charger.group.rotation.y = bay.coords.rotationY;
        evStatusMat = charger.statusMat;
        this.scene.add(charger.group);
      }

      // 6. Layer 1 Invisible Hit Proxy Box for fast raycasting
      const hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stallW, 1.8, stallL),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitMesh.position.set(bay.coords.x, 0.9, bay.coords.z);
      hitMesh.layers.set(1);
      hitMesh.userData.bayId = bay.id;
      this.scene.add(hitMesh);
      this.hitMeshes.push(hitMesh);

      this.bayVisuals.set(bay.id, {
        bay,
        decalMesh,
        beaconMat,
        highlightMesh,
        highlightMat,
        hitMesh,
        vehicleGroup: null,
        reservedPad,
        evStatusMat,
      });
    }
  }

  private hasPendingArrival(bayId: string): boolean {
    return this.drivingVehicles.some((dv) => dv.bayId === bayId && dv.kind === 'arrival');
  }

  private cancelDrivingForBay(bayId: string, kind?: 'arrival' | 'departure') {
    for (let i = this.drivingVehicles.length - 1; i >= 0; i--) {
      const dv = this.drivingVehicles[i];
      if (dv.bayId === bayId && (!kind || dv.kind === kind)) {
        this.scene.remove(dv.group);
        this.drivingVehicles.splice(i, 1);
      }
    }
  }

  private updateBayIndicators(vis: BayVisual, status: ParkingBay['status']) {
    const hex = getStatusHex(status);
    vis.beaconMat.color.setHex(hex);
    vis.beaconMat.emissive.setHex(hex);
    if (vis.evStatusMat) {
      const evHex = status === 'available' ? 0x10b981 : status === 'reserved' ? 0xf59e0b : 0x38bdf8;
      vis.evStatusMat.color.setHex(evHex);
      vis.evStatusMat.emissive.setHex(evHex);
    }
    vis.reservedPad.visible = status === 'reserved';
  }

  private updateContainerTelemetry() {
    let parked = 0;
    for (const vis of this.bayVisuals.values()) {
      if (vis.vehicleGroup) parked += 1;
    }
    this.container.dataset.parkedCount = String(parked);
    this.container.dataset.drivingCount = String(this.drivingVehicles.length);
  }

  public syncState(nextState: FacilityState, animateTransitions = true) {
    if (this.lastState && this.lastState.lastUpdated === nextState.lastUpdated) {
      return;
    }

    const prevMap = new Map<string, ParkingBay>();
    if (this.lastState) {
      for (const b of this.lastState.bays) prevMap.set(b.id, b);
    }

    for (const bay of nextState.bays) {
      const vis = this.bayVisuals.get(bay.id);
      if (!vis) continue;

      const prev = prevMap.get(bay.id);
      const statusChanged = Boolean(prev && prev.status !== bay.status);

      vis.bay = bay;

      if (animateTransitions && statusChanged) {
        if (bay.status === 'occupied') {
          this.cancelDrivingForBay(bay.id);
          // Keep bay visually open/reserved until the arriving vehicle physically parks
          this.updateBayIndicators(vis, prev?.status ?? 'available');
          this.entryGateTimer = 2.8;
          this.spawnArrivalAnimation(vis);
        } else if (prev?.status === 'occupied' && bay.status === 'available') {
          if (this.hasPendingArrival(bay.id)) {
            this.cancelDrivingForBay(bay.id, 'arrival');
            this.updateBayIndicators(vis, bay.status);
            this.reconcileStaticVehicle(vis);
          } else {
            this.updateBayIndicators(vis, bay.status);
            this.exitGateTimer = 2.8;
            this.spawnDepartureAnimation(vis, prev);
          }
        } else {
          this.cancelDrivingForBay(bay.id, 'arrival');
          this.updateBayIndicators(vis, bay.status);
          this.reconcileStaticVehicle(vis);
        }
      } else {
        if (!animateTransitions) {
          this.cancelDrivingForBay(bay.id);
        }
        if (!this.hasPendingArrival(bay.id)) {
          this.updateBayIndicators(vis, bay.status);
        }
        this.reconcileStaticVehicle(vis);
      }
    }

    const metrics = computeFacilityMetrics(nextState);
    updateTotemCanvas(this.totemCanvas, metrics.availableBays, metrics.evAvailable, metrics.totalBays);
    this.totemTexture.needsUpdate = true;

    this.lastState = nextState;
    this.refreshHighlights();
    this.updateContainerTelemetry();
    this.ensureLoopOrRender();
  }

  private reconcileStaticVehicle(vis: BayVisual) {
    const { bay } = vis;
    if (bay.status === 'occupied') {
      // Never spawn a static car in the stall while an arrival animation is still en route
      if (this.hasPendingArrival(bay.id)) {
        return;
      }
      if (!vis.vehicleGroup) {
        const vType = bay.vehicleType ?? 'sedan';
        const color = pickVehicleColor(vType, bay.licensePlate);
        const mesh = createVehicleMesh(vType, color, this.contactShadowTexture, this.isSoftwareGl);
        mesh.position.set(bay.coords.x, 0, bay.coords.z);
        mesh.rotation.y = bay.coords.rotationY;
        this.scene.add(mesh);
        vis.vehicleGroup = mesh;
      }
    } else if (vis.vehicleGroup) {
      this.scene.remove(vis.vehicleGroup);
      vis.vehicleGroup = null;
    }
  }

  private spawnArrivalAnimation(vis: BayVisual) {
    if (vis.vehicleGroup) {
      this.scene.remove(vis.vehicleGroup);
      vis.vehicleGroup = null;
    }
    const { bay } = vis;
    const vType = bay.vehicleType ?? 'sedan';
    const color = pickVehicleColor(vType, bay.licensePlate);
    const car = createVehicleMesh(vType, color, this.contactShadowTexture, this.isSoftwareGl);

    const useNorthAisle = bay.coords.z < 0;
    const waypoints = !useNorthAisle
      ? [
          new THREE.Vector3(-23, 0, 6.85),
          new THREE.Vector3(-15, 0, 6.85),
          new THREE.Vector3(bay.coords.x, 0, 6.85),
          new THREE.Vector3(bay.coords.x, 0, bay.coords.z),
        ]
      : [
          new THREE.Vector3(-23, 0, 6.85),
          new THREE.Vector3(-15.5, 0, 6.85),
          new THREE.Vector3(-15.5, 0, -6.85),
          new THREE.Vector3(bay.coords.x, 0, -6.85),
          new THREE.Vector3(bay.coords.x, 0, bay.coords.z),
        ];

    car.position.copy(waypoints[0]);
    this.scene.add(car);

    this.drivingVehicles.push({
      bayId: bay.id,
      kind: 'arrival',
      group: car,
      waypoints,
      progress: 0,
      speed: 0.55,
      onArrive: () => {
        if (vis.bay.status === 'occupied') {
          car.position.set(vis.bay.coords.x, 0, vis.bay.coords.z);
          car.rotation.y = vis.bay.coords.rotationY;
          vis.vehicleGroup = car;
          this.updateBayIndicators(vis, 'occupied');
        } else {
          this.scene.remove(car);
        }
        this.updateContainerTelemetry();
      },
    });
  }

  private spawnDepartureAnimation(vis: BayVisual, prevBay: ParkingBay) {
    let car = vis.vehicleGroup;
    vis.vehicleGroup = null;
    if (!car) {
      const vType = prevBay.vehicleType ?? 'sedan';
      const color = pickVehicleColor(vType, prevBay.licensePlate);
      car = createVehicleMesh(vType, color, this.contactShadowTexture, this.isSoftwareGl);
      car.position.set(prevBay.coords.x, 0, prevBay.coords.z);
      this.scene.add(car);
    }

    const useNorthAisle = prevBay.coords.z < 0;
    const waypoints = !useNorthAisle
      ? [
          new THREE.Vector3(prevBay.coords.x, 0, prevBay.coords.z),
          new THREE.Vector3(prevBay.coords.x, 0, 6.85),
          new THREE.Vector3(16.2, 0, 6.85),
          new THREE.Vector3(24, 0, 6.85),
        ]
      : [
          new THREE.Vector3(prevBay.coords.x, 0, prevBay.coords.z),
          new THREE.Vector3(prevBay.coords.x, 0, -6.85),
          new THREE.Vector3(13.5, 0, -6.85),
          new THREE.Vector3(13.5, 0, 6.85),
          new THREE.Vector3(24, 0, 6.85),
        ];

    this.drivingVehicles.push({
      bayId: prevBay.id,
      kind: 'departure',
      group: car,
      waypoints,
      progress: 0,
      speed: 0.62,
      onArrive: () => {
        this.scene.remove(car!);
        this.updateContainerTelemetry();
      },
    });
  }

  public setSelectedBay(bayId: string | null) {
    this.selectedBayId = bayId;
    this.refreshHighlights();
    this.requestRender();
  }

  public setCategoryFilter(category: BayCategory | 'all') {
    this.activeCategory = category;
    this.refreshHighlights();
    this.requestRender();
  }

  public setCameraPreset(preset: CameraPresetId) {
    const cfg = CAMERA_PRESETS[preset];
    this.cameraTransition.targetPos.set(...cfg.pos);
    this.cameraTransition.targetLook.set(...cfg.target);
    this.cameraTransition.active = true;
    this.ensureLoopOrRender();
  }

  public focusBay(bayId: string) {
    const vis = this.bayVisuals.get(bayId);
    if (!vis) return;
    const { x, z } = vis.bay.coords;
    this.cameraTransition.targetLook.set(x, 0.5, z);
    this.cameraTransition.targetPos.set(x + 7.5, 8.2, z + 9.5);
    this.cameraTransition.active = true;
    this.ensureLoopOrRender();
  }

  public applyLightingMode(mode: LightingMode) {
    if (mode === 'day') {
      const skyColor = new THREE.Color(0xdbeafe);
      this.scene.background = skyColor;
      this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.0085);
      this.keyLight.color.setHex(0xfff7ed);
      this.keyLight.intensity = 1.9;
      this.keyLight.position.set(20, 28, 16);
      this.hemiLight.color.setHex(0xe0f2fe);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 0.85;
      this.rimLight.intensity = 0.65;
      this.renderer.toneMappingExposure = 1.05;
      this.canopyGlowMat.emissiveIntensity = 0.35;
      for (const m of this.lampMats) m.emissiveIntensity = 0.25;
    } else {
      const skyColor = new THREE.Color(0x0b1324);
      this.scene.background = skyColor;
      this.scene.fog = new THREE.FogExp2(0x0b1324, 0.011);
      this.keyLight.color.setHex(0x93c5fd);
      this.keyLight.intensity = 0.95;
      this.keyLight.position.set(-16, 24, 18);
      this.hemiLight.color.setHex(0x38bdf8);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.55;
      this.rimLight.intensity = 0.9;
      this.renderer.toneMappingExposure = 1.15;
      this.canopyGlowMat.emissiveIntensity = 1.4;
      for (const m of this.lampMats) m.emissiveIntensity = 2.0;
    }
    this.requestRender();
  }

  private refreshHighlights() {
    for (const [id, vis] of this.bayVisuals) {
      const isSelected = id === this.selectedBayId;
      const isHovered = id === this.hoveredBayId;
      const matchesFilter =
        this.activeCategory === 'all' || vis.bay.category === this.activeCategory;

      if (isSelected) {
        vis.highlightMat.color.setHex(0x38bdf8);
        vis.highlightMat.opacity = 0.65;
      } else if (isHovered) {
        vis.highlightMat.color.setHex(0xf8fafc);
        vis.highlightMat.opacity = 0.42;
      } else if (this.activeCategory !== 'all' && matchesFilter) {
        vis.highlightMat.color.setHex(getStatusHex(vis.bay.status));
        vis.highlightMat.opacity = 0.28;
      } else {
        vis.highlightMat.opacity = 0;
      }

      (vis.decalMesh.material as THREE.MeshBasicMaterial).opacity = matchesFilter ? 1 : 0.3;
    }
  }

  private hasActiveAnimations(): boolean {
    return (
      this.cameraTransition.active ||
      this.drivingVehicles.length > 0 ||
      this.entryGateTimer > 0 ||
      this.exitGateTimer > 0 ||
      Math.abs(this.entryGate.armPivot.rotation.x) > 0.01 ||
      Math.abs(this.exitGate.armPivot.rotation.x) > 0.01
    );
  }

  private ensureLoopOrRender() {
    if (this.disposed) return;
    if (this.hasActiveAnimations()) {
      if (!this.loopActive) {
        this.loopActive = true;
        this.lastTickMs = performance.now();
        this.scheduleNextTick();
      }
    } else {
      this.requestRender();
    }
  }

  private scheduleNextTick() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private requestRender() {
    if (this.disposed || this.loopActive) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      const done = () => {
        this.renderBusy = false;
        if (this.pendingResize && !this.disposed) {
          this.pendingResize = false;
          this.applyContainerSize();
          this.requestRender();
          return;
        }
        if (this.renderDirty && !this.disposed) this.requestRender();
      };
      if (this.isSoftwareGl) this.afterDraw(done);
      else done();
    });
  }

  private tick() {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTickMs) / 1000, 0.1);
    this.lastTickMs = now;

    // 1. Exponential camera preset damping
    if (this.cameraTransition.active) {
      const k = 6.5;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.cameraTransition.targetPos.x, k, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.cameraTransition.targetPos.y, k, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.cameraTransition.targetPos.z, k, dt);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.cameraTransition.targetLook.x, k, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.cameraTransition.targetLook.y, k, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.cameraTransition.targetLook.z, k, dt);

      if (
        this.camera.position.distanceTo(this.cameraTransition.targetPos) < 0.08 &&
        this.controls.target.distanceTo(this.cameraTransition.targetLook) < 0.05
      ) {
        this.cameraTransition.active = false;
      }
    }

    // 2. Entry/Exit Barrier Arms
    if (this.entryGateTimer > 0) this.entryGateTimer = Math.max(0, this.entryGateTimer - dt);
    if (this.exitGateTimer > 0) this.exitGateTimer = Math.max(0, this.exitGateTimer - dt);

    const entryTargetRot = this.entryGateTimer > 0 ? -1.42 : 0;
    const exitTargetRot = this.exitGateTimer > 0 ? -1.42 : 0;
    this.entryGate.armPivot.rotation.x = THREE.MathUtils.damp(this.entryGate.armPivot.rotation.x, entryTargetRot, 8, dt);
    this.exitGate.armPivot.rotation.x = THREE.MathUtils.damp(this.exitGate.armPivot.rotation.x, exitTargetRot, 8, dt);

    this.entryGate.signalMat.emissive.setHex(this.entryGateTimer > 0 ? 0x10b981 : 0x38bdf8);
    this.exitGate.signalMat.emissive.setHex(this.exitGateTimer > 0 ? 0xf59e0b : 0x10b981);

    // 3. Driving Vehicles along waypoint polylines
    for (let i = this.drivingVehicles.length - 1; i >= 0; i--) {
      const dv = this.drivingVehicles[i];
      const segCount = dv.waypoints.length - 1;
      dv.progress += dt * dv.speed;
      if (dv.progress >= 1) {
        this.drivingVehicles.splice(i, 1);
        dv.onArrive?.();
        continue;
      }
      const scaled = dv.progress * segCount;
      const segIdx = Math.min(Math.floor(scaled), segCount - 1);
      const localT = scaled - segIdx;
      _v1.copy(dv.waypoints[segIdx]).lerp(dv.waypoints[segIdx + 1], localT);
      dv.group.position.copy(_v1);

      _v2.copy(dv.waypoints[segIdx + 1]).sub(dv.waypoints[segIdx]);
      if (_v2.lengthSq() > 0.001) {
        const yaw = Math.atan2(_v2.x, _v2.z);
        dv.group.rotation.y = yaw;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    if (this.hasActiveAnimations()) {
      this.scheduleNextTick();
    } else {
      this.loopActive = false;
    }
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerMove = (e: PointerEvent) => {
    const now = performance.now();
    if (now - this.lastHoverRaycastMs < 48) return;
    this.lastHoverRaycastMs = now;

    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    const nextHover = hits.length > 0 ? String(hits[0].object.userData.bayId ?? '') : null;

    if (nextHover !== this.hoveredBayId) {
      this.hoveredBayId = nextHover;
      this.renderer.domElement.style.cursor = nextHover ? 'pointer' : 'grab';
      this.refreshHighlights();
      this.onHoverBay(nextHover);
      this.requestRender();
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) return; // Ignore drags

    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length > 0) {
      const bayId = String(hits[0].object.userData.bayId ?? '');
      if (bayId) {
        this.onSelectBay(bayId);
      }
    }
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLost?.();
  };

  private bindEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
  }

  private applyContainerSize() {
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    if (width === this.lastWidth && height === this.lastHeight) return;
    this.lastWidth = width;
    this.lastHeight = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private handleResize() {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    if (width === this.lastWidth && height === this.lastHeight) return;
    if (this.renderBusy) {
      this.pendingResize = true;
      return;
    }
    this.applyContainerSize();
    this.requestRender();
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);

    this.controls.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.contactShadowTexture.dispose();
    this.totemTexture.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
