import * as THREE from 'three';

export class TextureGenerator {
  // Industrial Polished Concrete (with expansion joints & subtle speckles)
  public static createConcrete(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base concrete tone - Bright realistic sunlit concrete
    ctx.fillStyle = '#8f9aa6';
    ctx.fillRect(0, 0, size, size);

    // Subtle noise & speckles
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Concrete expansion joints grid
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;

    // Roughness map (smooth with occasional puddles)
    const rCanvas = document.createElement('canvas');
    rCanvas.width = size;
    rCanvas.height = size;
    const rCtx = rCanvas.getContext('2d')!;
    rCtx.fillStyle = '#b0b0b0'; // mostly rough
    rCtx.fillRect(0, 0, size, size);

    // Smooth reflective water puddles
    rCtx.fillStyle = '#303030';
    rCtx.beginPath();
    rCtx.ellipse(140, 180, 60, 35, 0.4, 0, Math.PI * 2);
    rCtx.fill();
    rCtx.beginPath();
    rCtx.ellipse(360, 340, 75, 40, -0.3, 0, Math.PI * 2);
    rCtx.fill();

    const roughnessMap = new THREE.CanvasTexture(rCanvas);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;

    return { map, roughnessMap };
  }

  // Corrugated Metal (for Shipping Containers & Roll-up doors)
  public static createCorrugatedMetal(baseColor: string): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Corrugated vertical ribs
    const ribWidth = 16;
    for (let x = 0; x < size; x += ribWidth) {
      const grad = ctx.createLinearGradient(x, 0, x + ribWidth, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.4)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
      grad.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, ribWidth, size);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Weathered Wood (for Pallets & Cargo Crates)
  public static createWood(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Wood base
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(0, 0, size, size);

    // Wood grain lines
    ctx.fillStyle = '#713f12';
    for (let y = 0; y < size; y += 4) {
      if (Math.random() > 0.4) {
        ctx.fillRect(0, y, size, 2);
      }
    }

    // Plank borders
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 4;
    for (let x = 0; x < size; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Diamond Steel Grating (for Catwalk)
  public static createSteelGrating(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    for (let i = -size; i < size * 2; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i + size, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Industrial Yellow/Black Hazard Stripes
  public static createHazardStripes(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#eab308'; // Bright safety yellow
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#18181b'; // Black hazard stripes
    const stripeWidth = 24;
    for (let i = -size; i < size * 2; i += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + stripeWidth, 0);
      ctx.lineTo(i + stripeWidth + size, size);
      ctx.lineTo(i + size, size);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Warehouse Signboard Texture (e.g. "WAREHOUSE LOGISTICS — BAY 01")
  public static createSignboard(title: string, sub: string, color: string = '#0284c7'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 116);

    ctx.fillStyle = color;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 56);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(sub, 256, 96);

    return new THREE.CanvasTexture(canvas);
  }

  // Procedural 360-degree Sunrise Sky with Rising Sun & Atmospheric Horizon
  public static createSunriseSky(): THREE.CanvasTexture {
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 1. Sky Gradient: Deep Morning Blue at zenith to fiery sunrise glow at horizon
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0.0, '#1d4ed8'); // Zenith crisp blue
    skyGrad.addColorStop(0.35, '#38bdf8'); // Upper daylight blue
    skyGrad.addColorStop(0.58, '#f472b6'); // Sunrise morning rose
    skyGrad.addColorStop(0.75, '#fb923c'); // Warm radiant orange
    skyGrad.addColorStop(0.88, '#f59e0b'); // Golden horizon
    skyGrad.addColorStop(1.0, '#78350f'); // Distant earth
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Radiant Rising Sun (positioned at x = 650, y = 390 - sunrise elevation)
    const sunX = 650;
    const sunY = 385;

    // Wide atmospheric golden flare
    const coronaGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 260);
    coronaGrad.addColorStop(0, 'rgba(255, 254, 235, 0.95)');
    coronaGrad.addColorStop(0.15, 'rgba(254, 240, 138, 0.85)');
    coronaGrad.addColorStop(0.4, 'rgba(251, 146, 60, 0.45)');
    coronaGrad.addColorStop(0.7, 'rgba(244, 114, 182, 0.2)');
    coronaGrad.addColorStop(1.0, 'rgba(244, 114, 182, 0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 260, 0, Math.PI * 2);
    ctx.fill();

    // Blazing Core Sun Disc
    const sunDisc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 32);
    sunDisc.addColorStop(0, '#ffffff');
    sunDisc.addColorStop(0.7, '#fffbeb');
    sunDisc.addColorStop(1.0, '#fde047');
    ctx.fillStyle = sunDisc;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 32, 0, Math.PI * 2);
    ctx.fill();

    // 3. Gentle Distant Mountain & Harbor Silhouette along the horizon
    ctx.fillStyle = '#451a03'; // Warm silhouette
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, 440);
    for (let x = 0; x <= width; x += 30) {
      const y = 435 + Math.sin(x * 0.02) * 12 + Math.cos(x * 0.05) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 4. Distant industrial cranes / gantries on horizon
    ctx.strokeStyle = 'rgba(69, 26, 3, 0.7)';
    ctx.lineWidth = 2;
    for (const cx of [180, 320, 820, 920]) {
      ctx.beginPath();
      ctx.moveTo(cx, 440);
      ctx.lineTo(cx, 400);
      ctx.lineTo(cx + 40, 395);
      ctx.moveTo(cx, 405);
      ctx.lineTo(cx - 20, 410);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
}

