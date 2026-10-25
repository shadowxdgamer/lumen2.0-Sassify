import * as THREE from 'three';
import { fbm } from '../simulation/terrain';

// Procedural canvas textures — no image files are fetched.

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

export function regolithTexture(): THREE.CanvasTexture {
  const size = 512;
  const { c, ctx } = canvas(size, size);
  const img = ctx.createImageData(size, size);
  let seed = 1337;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tileable-ish multi-scale noise + fine speckle.
      const n = fbm(x * 0.02, y * 0.02, 5, 3) * 70 + fbm(x * 0.11, y * 0.11, 3, 9) * 40;
      const speck = rand() < 0.015 ? 50 : rand() * 18;
      const v = Math.max(0, Math.min(255, 118 + n + speck));
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v * 0.98;
      img.data[i + 2] = v * 0.95;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Radiator panel cell grid: light cells, dark frame lines. */
export function wingGridTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = '#b8c2cc';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#1a2330';
  ctx.lineWidth = 5;
  const cols = 6;
  const rows = 5;
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 256) / cols, 0);
    ctx.lineTo((i * 256) / cols, 256);
    ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    ctx.beginPath();
    ctx.moveTo(0, (j * 256) / rows);
    ctx.lineTo(256, (j * 256) / rows);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Glowing fuel-ring slots for the core band emissive map. */
export function coreSlotTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 64);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 16; i++) {
    const x = i * 32 + 6;
    const g = ctx.createLinearGradient(x, 0, x + 20, 0);
    g.addColorStop(0, '#552200');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(1, '#552200');
    ctx.fillStyle = g;
    ctx.fillRect(x, 10, 20, 44);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function softDotTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
