import * as THREE from 'three';
import type { BayCategory, BayStatus } from '../shared/parkingLogic.ts';

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(5, 10, 20, 0.72)');
  grad.addColorStop(0.55, 'rgba(5, 10, 20, 0.32)');
  grad.addColorStop(1, 'rgba(5, 10, 20, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAsphaltTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  cCtx.fillStyle = '#262d38';
  cCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#d4d4d4';
  rCtx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random asphalt aggregate grain
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 4200; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const v = Math.floor(28 + rand() * 34);
    cCtx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 10})`;
    cCtx.fillRect(x, y, 2, 2);

    const rv = Math.floor(175 + rand() * 65);
    rCtx.fillStyle = `rgb(${rv}, ${rv}, ${rv})`;
    rCtx.fillRect(x, y, 2, 2);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 6);
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(8, 6);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap };
}

export function createSolarPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#112240';
  ctx.fillRect(0, 0, size, size);

  // Cell grid
  ctx.strokeStyle = '#38598b';
  ctx.lineWidth = 2;
  const step = 32;
  for (let x = 0; x <= size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Subtle metallic busbars
  ctx.strokeStyle = 'rgba(148, 197, 255, 0.25)';
  ctx.lineWidth = 1;
  for (let x = 16; x < size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBayDecalTexture(
  bayId: string,
  category: BayCategory,
  maxAnisotropy: number,
  flipText = false,
): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  // Subtle surface tint for special bays
  if (category === 'ev') {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fillRect(14, 14, w - 28, h - 28);
  } else if (category === 'accessible') {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
    ctx.fillRect(14, 14, w - 28, h - 28);
  } else if (category === 'vip') {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.13)';
    ctx.fillRect(14, 14, w - 28, h - 28);
  }

  // Painted parking stall border (open at entry end)
  const lineColor =
    category === 'ev'
      ? '#34d399'
      : category === 'accessible'
        ? '#60a5fa'
        : category === 'vip'
          ? '#fbbf24'
          : '#e2e8f0';

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(14, h - 18);
  ctx.lineTo(14, 14);
  ctx.lineTo(w - 14, 14);
  ctx.lineTo(w - 14, h - 18);
  ctx.stroke();

  // Category emblem in center
  ctx.save();
  ctx.translate(w / 2, h * 0.45);
  if (flipText) ctx.rotate(Math.PI);
  ctx.fillStyle = lineColor;
  ctx.strokeStyle = lineColor;
  if (category === 'ev') {
    // Lightning bolt icon
    ctx.beginPath();
    ctx.moveTo(8, -42);
    ctx.lineTo(-22, 6);
    ctx.lineTo(0, 6);
    ctx.lineTo(-10, 44);
    ctx.lineTo(24, -6);
    ctx.lineTo(2, -6);
    ctx.closePath();
    ctx.fill();
  } else if (category === 'accessible') {
    // Wheelchair mobility symbol
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(0, -34, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, -20);
    ctx.lineTo(-4, 10);
    ctx.lineTo(22, 10);
    ctx.lineTo(30, 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-6, 16, 24, 0.3, Math.PI * 1.45);
    ctx.stroke();
  } else if (category === 'vip') {
    // Architectural chevron mark
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-30, 12);
    ctx.lineTo(0, -18);
    ctx.lineTo(30, 12);
    ctx.moveTo(-30, -8);
    ctx.lineTo(0, -38);
    ctx.lineTo(30, -8);
    ctx.stroke();
  }
  ctx.restore();

  // Bay ID stencil at stall mouth (always upright toward viewer)
  ctx.save();
  ctx.translate(w / 2, h - 74);
  if (flipText) ctx.rotate(Math.PI);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 54px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bayId, 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRoadArrowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
  ctx.beginPath();
  ctx.moveTo(64, 16);
  ctx.lineTo(106, 60);
  ctx.lineTo(80, 60);
  ctx.lineTo(80, 112);
  ctx.lineTo(48, 112);
  ctx.lineTo(48, 60);
  ctx.lineTo(22, 60);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function updateTotemCanvas(
  canvas: HTMLCanvasElement,
  available: number,
  evAvailable: number,
  total: number,
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#09111f';
  ctx.fillRect(0, 0, w, h);

  // Subtle frame border
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // Header
  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPTMS HUB', w / 2, 54);

  // Divider
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(28, 72, w - 56, 3);

  // Available count
  ctx.fillStyle = available > 0 ? '#34d399' : '#f87171';
  ctx.font = '700 84px "JetBrains Mono", monospace';
  ctx.fillText(String(available).padStart(2, '0'), w / 2, 162);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 22px "DM Sans", sans-serif';
  ctx.fillText(`OF ${total} BAYS OPEN`, w / 2, 206);

  // EV line
  ctx.fillStyle = '#0f2922';
  ctx.fillRect(24, 232, w - 48, 56);
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '700 24px "JetBrains Mono", monospace';
  ctx.fillText(`EV FAST: ${evAvailable} FREE`, w / 2, 268);
}

export function getStatusHex(status: BayStatus): number {
  if (status === 'available') return 0x10b981;
  if (status === 'reserved') return 0xf59e0b;
  return 0xef4444;
}

export function createCityFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, w, h);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let row = 12; row < h - 12; row += 18) {
    for (let col = 10; col < w - 10; col += 18) {
      const lit = rand() > 0.62;
      ctx.fillStyle = lit ? 'rgba(224, 242, 254, 0.55)' : 'rgba(15, 23, 42, 0.65)';
      ctx.fillRect(col, row, 10, 10);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}
