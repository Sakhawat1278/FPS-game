import * as THREE from 'three';

interface ActiveTracer {
  line: THREE.Line;
  start: THREE.Vector3;
  target: THREE.Vector3;
  progress: number;
  speed: number;
}

interface ActiveImpact {
  points: THREE.Points;
  velocities: THREE.Vector3[];
  age: number;
  maxAge: number;
}

export class VFXManager {
  private scene: THREE.Scene;

  // Tracers
  private activeTracers: ActiveTracer[] = [];
  private tracerPool: THREE.Line[] = [];
  private tracerMaterial: THREE.LineBasicMaterial;
  private tracerGeometry: THREE.BufferGeometry;

  // Impacts
  private activeImpacts: ActiveImpact[] = [];
  private impactMaterial: THREE.PointsMaterial;

  // Muzzle flash light
  public muzzleLight: THREE.PointLight;
  private muzzleFlashTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Tracer line
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    this.tracerGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -2.5) // 2.5m long tracer slug
    ]);

    // Impact sparks/dust
    this.impactMaterial = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.08,
      transparent: true,
      opacity: 0.9
    });

    // Muzzle light
    this.muzzleLight = new THREE.PointLight(0xfef08a, 0, 10);
    this.scene.add(this.muzzleLight);
  }

  public triggerMuzzleFlash(position: THREE.Vector3) {
    this.muzzleLight.position.copy(position);
    this.muzzleLight.intensity = 4.0;
    this.muzzleFlashTimer = 0.04; // 40ms flash
  }

  public spawnTracer(start: THREE.Vector3, target: THREE.Vector3) {
    const line = this.tracerPool.pop() || new THREE.Line(this.tracerGeometry, this.tracerMaterial);
    line.position.copy(start);
    line.lookAt(target);
    if (!line.parent) this.scene.add(line);
    line.visible = true;

    this.activeTracers.push({
      line,
      start: start.clone(),
      target: target.clone(),
      progress: 0,
      speed: 160 // 160 m/s visual tracer travel
    });
  }

  public spawnImpact(hitPoint: THREE.Vector3, normal: THREE.Vector3) {
    // Limit max active impacts for performance
    if (this.activeImpacts.length > 16) {
      const oldest = this.activeImpacts.shift();
      if (oldest) {
        this.scene.remove(oldest.points);
        oldest.points.geometry.dispose();
      }
    }

    const count = 12;
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = hitPoint.x;
      positions[i * 3 + 1] = hitPoint.y;
      positions[i * 3 + 2] = hitPoint.z;

      // Cone around surface normal
      const vel = normal.clone().multiplyScalar(Math.random() * 3 + 1);
      vel.x += (Math.random() - 0.5) * 2;
      vel.y += (Math.random() - 0.5) * 2;
      vel.z += (Math.random() - 0.5) * 2;
      velocities.push(vel);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const points = new THREE.Points(geo, this.impactMaterial);
    this.scene.add(points);

    this.activeImpacts.push({
      points,
      velocities,
      age: 0,
      maxAge: 0.35 // 350ms duration
    });
  }

  public update(dt: number) {
    // 1. Muzzle light decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleLight.intensity = 0;
      }
    }

    // 2. Tracers update with pooling
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const t = this.activeTracers[i];
      const totalDist = t.start.distanceTo(t.target);
      t.progress += (t.speed * dt) / Math.max(1, totalDist);

      if (t.progress >= 1.0) {
        t.line.visible = false;
        this.activeTracers.splice(i, 1);
        if (this.tracerPool.length < 32) {
          this.tracerPool.push(t.line);
        } else {
          this.scene.remove(t.line);
        }
      } else {
        t.line.position.lerpVectors(t.start, t.target, t.progress);
      }
    }

    // 3. Impacts update
    for (let i = this.activeImpacts.length - 1; i >= 0; i--) {
      const imp = this.activeImpacts[i];
      imp.age += dt;

      if (imp.age >= imp.maxAge) {
        this.scene.remove(imp.points);
        imp.points.geometry.dispose();
        this.activeImpacts.splice(i, 1);
      } else {
        const posAttr = imp.points.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let j = 0; j < imp.velocities.length; j++) {
          arr[j * 3] += imp.velocities[j].x * dt;
          arr[j * 3 + 1] += imp.velocities[j].y * dt;
          arr[j * 3 + 2] += imp.velocities[j].z * dt;
          // Apply light gravity to spark particles
          imp.velocities[j].y -= 9.8 * dt;
        }
        posAttr.needsUpdate = true;
      }
    }
  }
}

