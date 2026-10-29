import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ActiveTracer {
  line: THREE.Line;
  bulletMesh?: THREE.Object3D;
  start: THREE.Vector3;
  target: THREE.Vector3;
  progress: number;
  speed: number;
}

interface ActiveCasing {
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  age: number;
  maxAge: number;
  bounces: number;
  isResting: boolean;
}

interface ActiveBloodSplash {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  droplets?: THREE.Points;
  dropletVelocities: THREE.Vector3[];
  age: number;
  maxAge: number;
  baseScale: number;
}

interface ActiveImpact {
  points: THREE.Points;
  velocities: THREE.Vector3[];
  age: number;
  maxAge: number;
}

export class VFXManager {
  private scene: THREE.Scene;

  // 3D Bullet & Spent Casing Models
  private bulletTemplate?: THREE.Object3D;
  private shellTemplate?: THREE.Object3D;
  private bulletPool: THREE.Object3D[] = [];
  private shellPool: THREE.Object3D[] = [];
  private activeCasings: ActiveCasing[] = [];
  public onShellBounce?: () => void;

  // 3D Blood & Flesh Impact Splashes (Cavitation Rings, Fluid Crown & Droplets)
  private activeBloodSplashes: ActiveBloodSplash[] = [];
  private bloodSplashPool: ActiveBloodSplash[] = [];

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

    // Load authentic 3D 9mm Bullet & Shell Casing model
    this.loadBulletModels();

    // Tracer aerodynamic luminous streak
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    this.tracerGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0.9) // 0.9m long tracer tail behind projectile
    ]);

    // Impact sparks/dust
    this.impactMaterial = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.08,
      transparent: true,
      opacity: 0.9
    });

    // Muzzle light (tight radius and subtle intensity for natural flash without blinding glare)
    this.muzzleLight = new THREE.PointLight(0xfef08a, 0, 2.2);
    this.scene.add(this.muzzleLight);
  }

  private loadBulletModels() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/bullet/bullet.glb',
      (gltf) => {
        console.log('[VFXManager] Loaded authentic 3D bullet and shell casing models!');
        let bulletMesh: THREE.Mesh | null = null;
        let shellMesh: THREE.Mesh | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (child.name.includes('Bullet') || (mat && mat.name === 'bullet')) {
              bulletMesh = mesh;
            } else if (child.name.includes('Shell') || (mat && mat.name === 'shell')) {
              shellMesh = mesh;
            }
          }
        });

        if (bulletMesh) {
          const group = new THREE.Group();
          const bClone = (bulletMesh as THREE.Mesh).clone();
          // Point the copper bullet tip forward along +Z (trajectory direction)
          bClone.rotation.x = Math.PI / 2;
          bClone.scale.set(1.5, 1.5, 1.5); // Scaled for clean visibility in supersonic flight
          const mat = bClone.material as THREE.MeshStandardMaterial;
          if (mat) {
            mat.metalness = 0.88;
            mat.roughness = 0.28;
            mat.envMapIntensity = 0.9;
          }
          group.add(bClone);
          this.bulletTemplate = group;
        }

        if (shellMesh) {
          const group = new THREE.Group();
          const sClone = (shellMesh as THREE.Mesh).clone();
          sClone.scale.set(1.3, 1.3, 1.3);
          const mat = sClone.material as THREE.MeshStandardMaterial;
          if (mat) {
            mat.metalness = 0.92;
            mat.roughness = 0.22;
            mat.envMapIntensity = 1.0;
          }
          group.add(sClone);
          this.shellTemplate = group;
        }
      },
      undefined,
      (err) => {
        console.warn('[VFXManager] Fallback to procedural bullet geometry:', err);
      }
    );
  }

  public triggerMuzzleFlash(position: THREE.Vector3) {
    this.muzzleLight.position.copy(position);
    this.muzzleLight.intensity = 0.6;
    this.muzzleFlashTimer = 0.03; // 30ms snappy flash
  }

  public spawnTracer(start: THREE.Vector3, target: THREE.Vector3) {
    const dir = target.clone().sub(start).normalize();
    const spawnPos = start.clone().addScaledVector(dir, 0.35); // Offset forward from muzzle to prevent camera near clipping
    const line = this.tracerPool.pop() || new THREE.Line(this.tracerGeometry, this.tracerMaterial);
    line.position.copy(spawnPos);
    line.lookAt(target);
    if (!line.parent) this.scene.add(line);
    line.visible = true;

    // Attach 3D Bullet Projectile to head of tracer
    let bMesh: THREE.Object3D | undefined;
    if (this.bulletPool.length > 0) {
      bMesh = this.bulletPool.pop();
    } else if (this.bulletTemplate) {
      bMesh = this.bulletTemplate.clone();
    } else {
      // Procedural copper projectile fallback
      const geo = new THREE.CylinderGeometry(0.007, 0.009, 0.026, 10);
      const mat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.3 });
      bMesh = new THREE.Mesh(geo, mat);
      bMesh.rotation.x = Math.PI / 2;
    }

    if (bMesh) {
      bMesh.position.copy(spawnPos);
      bMesh.lookAt(target);
      if (!bMesh.parent) this.scene.add(bMesh);
      bMesh.visible = true;
    }

    this.activeTracers.push({
      line,
      bulletMesh: bMesh,
      start: spawnPos,
      target: target.clone(),
      progress: 0,
      speed: 160 // 160 m/s visual tracer travel
    });
  }

  public spawnCasing(position: THREE.Vector3, dir: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3) {
    let mesh: THREE.Object3D;
    if (this.shellPool.length > 0) {
      mesh = this.shellPool.pop()!;
    } else if (this.shellTemplate) {
      mesh = this.shellTemplate.clone();
    } else {
      // Procedural brass casing fallback
      const geo = new THREE.CylinderGeometry(0.006, 0.006, 0.022, 10);
      const mat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.25 });
      mesh = new THREE.Mesh(geo, mat);
    }

    mesh.position.copy(position);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    if (!mesh.parent) this.scene.add(mesh);
    mesh.visible = true;

    // Ejection impulse: pop to the right, slightly upward and backward
    const vel = right.clone().multiplyScalar(2.2 + Math.random() * 0.8)
      .addScaledVector(up, 1.2 + Math.random() * 0.5)
      .addScaledVector(dir, -0.4 - Math.random() * 0.3);

    // Fast tumbling 3D spin
    const angVel = new THREE.Vector3(
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35
    );

    this.activeCasings.push({
      mesh,
      position: position.clone(),
      velocity: vel,
      angularVelocity: angVel,
      age: 0,
      maxAge: 4.0, // 4 seconds before recycling
      bounces: 0,
      isResting: false
    });
  }

  private createBloodSplashGroup(): { group: THREE.Group; materials: THREE.MeshStandardMaterial[]; droplets: THREE.Points; dropletVelocities: THREE.Vector3[] } {
    const group = new THREE.Group();
    const materials: THREE.MeshStandardMaterial[] = [];

    // Deep ruby liquid blood material (high specular glossiness like fluid splash)
    const bloodMat = new THREE.MeshStandardMaterial({
      color: 0x990000,
      roughness: 0.15,
      metalness: 0.12,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
    materials.push(bloodMat);

    // Bright scarlet core accent
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
    materials.push(coreMat);

    // 1. Concentric Cavitation Rings along bullet penetration axis (like reference design)
    for (let i = 0; i < 4; i++) {
      const ringRadius = 0.04 + i * 0.055;
      const tubeRadius = 0.006 + (3 - i) * 0.002;
      const ringGeo = new THREE.TorusGeometry(ringRadius, tubeRadius, 6, 16);
      const ringMesh = new THREE.Mesh(ringGeo, bloodMat);
      ringMesh.position.z = -i * 0.085;
      group.add(ringMesh);
    }

    // 2. Main jagged conical splash crown
    const crownGeo = new THREE.ConeGeometry(0.24, 0.35, 14, 2, true);
    const crownMesh = new THREE.Mesh(crownGeo, bloodMat);
    crownMesh.rotation.x = Math.PI / 2;
    crownMesh.position.z = -0.14;
    group.add(crownMesh);

    // 3. Radial fluid spikes / tendrils radiating around the crown
    for (let j = 0; j < 10; j++) {
      const spikeGeo = new THREE.ConeGeometry(0.014, 0.24, 5);
      const spikeMesh = new THREE.Mesh(spikeGeo, coreMat);
      const angle = (j / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      spikeMesh.position.set(Math.cos(angle) * 0.16, Math.sin(angle) * 0.16, -0.20);
      spikeMesh.rotation.z = angle - Math.PI / 2;
      spikeMesh.rotation.x = Math.PI / 3;
      group.add(spikeMesh);
    }

    // 4. Dynamic fluid droplets bursting outward
    const count = 16;
    const positions = new Float32Array(count * 3);
    const dropletVelocities: THREE.Vector3[] = [];
    const dropletGeo = new THREE.BufferGeometry();
    dropletGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const dropletMat = new THREE.PointsMaterial({
      color: 0x8b0000,
      size: 0.07,
      transparent: true,
      opacity: 0.95
    });

    const droplets = new THREE.Points(dropletGeo, dropletMat);
    group.add(droplets);

    return { group, materials, droplets, dropletVelocities };
  }

  public spawnBloodSplash(hitPoint: THREE.Vector3, bulletDir: THREE.Vector3, isHeadshot: boolean = false) {
    let splashItem: ActiveBloodSplash;

    if (this.bloodSplashPool.length > 0) {
      splashItem = this.bloodSplashPool.pop()!;
    } else {
      const created = this.createBloodSplashGroup();
      splashItem = {
        group: created.group,
        materials: created.materials,
        droplets: created.droplets,
        dropletVelocities: created.dropletVelocities,
        age: 0,
        maxAge: 0.35,
        baseScale: isHeadshot ? 1.6 : 1.0
      };
    }

    splashItem.age = 0;
    splashItem.baseScale = isHeadshot ? 1.6 : 1.0;

    // Position at hit point
    splashItem.group.position.copy(hitPoint);

    // Orient along bullet trajectory (shockwave & spray blossom along and outward from bullet vector)
    splashItem.group.lookAt(hitPoint.clone().add(bulletDir));

    // Reset material opacities
    for (const mat of splashItem.materials) {
      mat.opacity = 0.95;
    }

    // Reset droplets
    if (splashItem.droplets) {
      const posAttr = splashItem.droplets.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      splashItem.dropletVelocities.length = 0;

      for (let i = 0; i < 16; i++) {
        arr[i * 3] = 0;
        arr[i * 3 + 1] = 0;
        arr[i * 3 + 2] = 0;

        // Radiating spray velocities
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 4.5,
          (Math.random() - 0.5) * 4.5,
          -Math.random() * 5.0 - 2.0 // Flying forward along penetration vector
        );
        splashItem.dropletVelocities.push(vel);
      }
      posAttr.needsUpdate = true;
      (splashItem.droplets.material as THREE.PointsMaterial).opacity = 0.95;
    }

    splashItem.group.scale.set(0.05, 0.05, 0.05);

    if (!splashItem.group.parent) {
      this.scene.add(splashItem.group);
    }
    splashItem.group.visible = true;

    this.activeBloodSplashes.push(splashItem);
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

    // 2. Tracers update with pooling & bullet mesh synchronization
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const t = this.activeTracers[i];
      const totalDist = t.start.distanceTo(t.target);
      t.progress += (t.speed * dt) / Math.max(1, totalDist);

      if (t.progress >= 1.0) {
        t.line.visible = false;
        if (t.bulletMesh) {
          t.bulletMesh.visible = false;
          if (this.bulletPool.length < 32) {
            this.bulletPool.push(t.bulletMesh);
          } else {
            this.scene.remove(t.bulletMesh);
          }
        }
        this.activeTracers.splice(i, 1);
        if (this.tracerPool.length < 32) {
          this.tracerPool.push(t.line);
        } else {
          this.scene.remove(t.line);
        }
      } else {
        const curPos = t.line.position.lerpVectors(t.start, t.target, t.progress);
        if (t.bulletMesh) {
          t.bulletMesh.position.copy(curPos);
          t.bulletMesh.rotateZ(dt * 60); // High-speed rifling spin!
        }
      }
    }

    // 3. Ejected Brass Casings physics & ground bounce
    const floorY = 0.98; // Map grass floor level
    for (let i = this.activeCasings.length - 1; i >= 0; i--) {
      const c = this.activeCasings[i];
      c.age += dt;

      if (c.age >= c.maxAge) {
        c.mesh.visible = false;
        this.activeCasings.splice(i, 1);
        if (this.shellPool.length < 32) {
          this.shellPool.push(c.mesh);
        } else {
          this.scene.remove(c.mesh);
        }
        continue;
      }

      if (!c.isResting) {
        // Gravity acceleration
        c.velocity.y -= 14.0 * dt;
        c.position.addScaledVector(c.velocity, dt);

        // Tumbling rotation
        c.mesh.rotation.x += c.angularVelocity.x * dt;
        c.mesh.rotation.y += c.angularVelocity.y * dt;
        c.mesh.rotation.z += c.angularVelocity.z * dt;

        // Ground collision & bouncing on grass floor
        if (c.position.y <= floorY) {
          c.position.y = floorY;
          c.bounces++;

          if (c.velocity.y < -0.8 && c.bounces < 3) {
            c.velocity.y = -c.velocity.y * 0.35; // Restitution bounce
            c.velocity.x *= 0.65;
            c.velocity.z *= 0.65;
            c.angularVelocity.multiplyScalar(0.45);
            if (this.onShellBounce) this.onShellBounce();
          } else {
            // Settle on grass
            c.velocity.set(0, 0, 0);
            c.angularVelocity.set(0, 0, 0);
            c.mesh.rotation.x = Math.PI / 2; // Lie flat on floor
            c.isResting = true;
          }
        }

        c.mesh.position.copy(c.position);
      }
    }

    // 4. Impacts update
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

    // 5. Update 3D Blood & Flesh Impact Splashes (Cavitation, Crown & Droplets)
    for (let i = this.activeBloodSplashes.length - 1; i >= 0; i--) {
      const s = this.activeBloodSplashes[i];
      s.age += dt;
      const progress = s.age / s.maxAge;

      if (progress >= 1.0) {
        s.group.visible = false;
        this.activeBloodSplashes.splice(i, 1);
        if (this.bloodSplashPool.length < 24) {
          this.bloodSplashPool.push(s);
        } else {
          this.scene.remove(s.group);
        }
        continue;
      }

      // Expansion phase (rapid blossoming from 0 -> 0.25, then stretch & dissipation)
      let scaleMult = 1.0;
      if (progress < 0.25) {
        scaleMult = (progress / 0.25) * s.baseScale;
      } else {
        scaleMult = s.baseScale * (1.0 + (progress - 0.25) * 0.4);
      }
      s.group.scale.set(scaleMult, scaleMult, scaleMult * (1.0 + progress * 0.8));

      // Fade opacity over lifetime
      const fade = Math.max(0, 1.0 - Math.pow(progress, 1.5));
      for (const mat of s.materials) {
        mat.opacity = fade * 0.95;
      }

      // Update fluid droplets with velocity & gravity
      if (s.droplets) {
        const posAttr = s.droplets.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let j = 0; j < s.dropletVelocities.length; j++) {
          arr[j * 3] += s.dropletVelocities[j].x * dt;
          arr[j * 3 + 1] += s.dropletVelocities[j].y * dt;
          arr[j * 3 + 2] += s.dropletVelocities[j].z * dt;
          s.dropletVelocities[j].y -= 9.8 * dt;
        }
        posAttr.needsUpdate = true;
        (s.droplets.material as THREE.PointsMaterial).opacity = fade * 0.95;
      }
    }
  }
}

