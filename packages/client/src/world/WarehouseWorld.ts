import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WAREHOUSE_MAP } from '@warehouse-strike/shared';

export class WarehouseWorld {
  public scene: THREE.Scene;
  public rapierWorld: RAPIER.World;
  public mapGroup: THREE.Group;

  constructor(scene: THREE.Scene, rapierWorld: RAPIER.World) {
    this.scene = scene;
    this.rapierWorld = rapierWorld;
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
  }

  public async build() {
    console.log('[WarehouseWorld] Building 70m x 45m warehouse geometry & Rapier colliders...');

    // Material library for greybox/prototype stage
    const materials: Record<string, THREE.Material> = {
      floor: new THREE.MeshStandardMaterial({
        color: 0x1a1f26,
        roughness: 0.85,
        metalness: 0.15
      }),
      ceiling: new THREE.MeshStandardMaterial({
        color: 0x111317,
        roughness: 0.9,
        metalness: 0.1
      }),
      wall: new THREE.MeshStandardMaterial({
        color: 0x2d3748,
        roughness: 0.7,
        metalness: 0.2
      }),
      prop: new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.5,
        metalness: 0.5
      }),
      cover: new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.6,
        metalness: 0.3
      }),
      catwalk: new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.5,
        metalness: 0.7
      }),
      ramp: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.6,
        metalness: 0.5
      })
    };

    // Shared Box Geometry for performance
    const baseBox = new THREE.BoxGeometry(1, 1, 1);

    // Create a static rigid body in Rapier to hold all static colliders
    const staticBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const staticBody = this.rapierWorld.createRigidBody(staticBodyDesc);

    for (const c of WAREHOUSE_MAP.colliders) {
      // 1. Create Rapier Collider
      const colliderDesc = RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz)
        .setTranslation(c.x, c.y, c.z);

      if (c.rotationY) {
        colliderDesc.setRotation({
          x: 0,
          y: Math.sin(c.rotationY / 2),
          z: 0,
          w: Math.cos(c.rotationY / 2)
        });
      }

      this.rapierWorld.createCollider(colliderDesc, staticBody);

      // 2. Create Three.js Visual Mesh
      let mat = materials[c.type] || materials.wall;
      if (c.color) {
        mat = new THREE.MeshStandardMaterial({
          color: c.color,
          roughness: 0.7,
          metalness: 0.3
        });
      }

      const mesh = new THREE.Mesh(baseBox, mat);
      mesh.scale.set(c.hx * 2, c.hy * 2, c.hz * 2);
      mesh.position.set(c.x, c.y, c.z);
      if (c.rotationY) {
        mesh.rotation.y = c.rotationY;
      }

      mesh.castShadow = c.type !== 'floor' && c.type !== 'ceiling';
      mesh.receiveShadow = true;

      this.mapGroup.add(mesh);
    }

    // Add warehouse industrial lights & skylights
    this.addLighting();

    console.log(`[WarehouseWorld] Built ${WAREHOUSE_MAP.colliders.length} map colliders successfully!`);
  }

  private addLighting() {
    // Ambient warehouse glow
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambient);

    // Main angled warehouse skylight sun
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    sunLight.position.set(15, 22, -10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Warehouse hanging spotlights
    const spotPositions = [
      { x: -18, z: 0, color: 0x93c5fd },
      { x: 0, z: 0, color: 0xfef08a },
      { x: 18, z: 0, color: 0xfda4af },
      { x: 0, z: 16, color: 0x67e8f9 } // Catwalk spotlight
    ];

    for (const sp of spotPositions) {
      const spot = new THREE.SpotLight(sp.color, 1.8, 30, Math.PI / 4, 0.4, 1.2);
      spot.position.set(sp.x, 9.5, sp.z);
      spot.target.position.set(sp.x, 0, sp.z);
      this.scene.add(spot);
      this.scene.add(spot.target);

      // Visible lamp fixture
      const fixtureGeo = new THREE.CylinderGeometry(0.5, 0.7, 0.4, 8);
      const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(sp.x, 9.7, sp.z);
      this.scene.add(fixture);
    }
  }
}

