import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WAREHOUSE_MAP } from '@warehouse-strike/shared';
import { TextureGenerator } from '../rendering/TextureGenerator';

export class RealisticWarehouse {
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
    console.log('[RealisticWarehouse] Generating realistic PBR warehouse world...');

    // 1. Generate PBR Materials
    const { map: concreteTex, roughnessMap: concreteRough } = TextureGenerator.createConcrete();
    concreteTex.repeat.set(14, 9);
    concreteRough.repeat.set(14, 9);

    const woodTex = TextureGenerator.createWood();
    woodTex.repeat.set(2, 2);

    const metalGratingTex = TextureGenerator.createSteelGrating();
    metalGratingTex.repeat.set(10, 2);

    const hazardTex = TextureGenerator.createHazardStripes();
    hazardTex.repeat.set(8, 1);

    const containerBlue = TextureGenerator.createCorrugatedMetal('#1d4ed8');
    containerBlue.repeat.set(4, 2);

    const containerOrange = TextureGenerator.createCorrugatedMetal('#c2410c');
    containerOrange.repeat.set(4, 2);

    const containerGreen = TextureGenerator.createCorrugatedMetal('#15803d');
    containerGreen.repeat.set(4, 2);

    const wallTex = TextureGenerator.createCorrugatedMetal('#334155');
    wallTex.repeat.set(8, 2);

    const materials = {
      floor: new THREE.MeshStandardMaterial({
        map: concreteTex,
        roughnessMap: concreteRough,
        roughness: 0.6,
        metalness: 0.15
      }),
      ceiling: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.9,
        metalness: 0.3
      }),
      wall: new THREE.MeshStandardMaterial({
        map: wallTex,
        roughness: 0.65,
        metalness: 0.4
      }),
      wood: new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.8,
        metalness: 0.05
      }),
      catwalk: new THREE.MeshStandardMaterial({
        map: metalGratingTex,
        roughness: 0.4,
        metalness: 0.8
      }),
      hazard: new THREE.MeshStandardMaterial({
        map: hazardTex,
        roughness: 0.5,
        metalness: 0.2
      }),
      containerBlue: new THREE.MeshStandardMaterial({
        map: containerBlue,
        roughness: 0.5,
        metalness: 0.5
      }),
      containerOrange: new THREE.MeshStandardMaterial({
        map: containerOrange,
        roughness: 0.5,
        metalness: 0.5
      }),
      containerGreen: new THREE.MeshStandardMaterial({
        map: containerGreen,
        roughness: 0.5,
        metalness: 0.5
      }),
      pillar: new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.7,
        metalness: 0.2
      }),
      rackFrame: new THREE.MeshStandardMaterial({
        color: 0xea580c, // Safety orange pallet rack
        roughness: 0.4,
        metalness: 0.6
      }),
      railing: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.3,
        metalness: 0.8
      })
    };

    const baseBox = new THREE.BoxGeometry(1, 1, 1);

    // 2. Build Rapier Static Collision Rigidbody & Three.js Meshes
    const staticBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const staticBody = this.rapierWorld.createRigidBody(staticBodyDesc);

    for (const c of WAREHOUSE_MAP.colliders) {
      // Rapier Collider
      const colliderDesc = RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z);
      if (c.rotationY) {
        colliderDesc.setRotation({
          x: 0,
          y: Math.sin(c.rotationY / 2),
          z: 0,
          w: Math.cos(c.rotationY / 2)
        });
      }
      this.rapierWorld.createCollider(colliderDesc, staticBody);

      // Material assignment based on ID / type
      let mat: THREE.Material = materials.wall;
      if (c.id === 'floor') mat = materials.floor;
      else if (c.id === 'ceiling') mat = materials.ceiling;
      else if (c.id.includes('catwalk_floor') || c.id.includes('ramp')) mat = materials.catwalk;
      else if (c.id.includes('rail')) mat = materials.railing;
      else if (c.id.includes('container_alpha')) mat = materials.containerBlue;
      else if (c.id.includes('container_bravo')) mat = materials.containerOrange;
      else if (c.id.includes('container_center')) mat = materials.containerGreen;
      else if (c.id.includes('rack')) mat = materials.rackFrame;
      else if (c.id.includes('pillar') || c.id.includes('support')) mat = materials.pillar;
      else if (c.id.includes('crate') || c.id.includes('desk')) mat = materials.wood;

      const mesh = new THREE.Mesh(baseBox, mat);
      mesh.scale.set(c.hx * 2, c.hy * 2, c.hz * 2);
      mesh.position.set(c.x, c.y, c.z);
      if (c.rotationY) mesh.rotation.y = c.rotationY;

      mesh.castShadow = c.type !== 'floor' && c.type !== 'ceiling';
      mesh.receiveShadow = true;
      this.mapGroup.add(mesh);
    }

    // 3. Add Warehouse Props & Signage Details
    this.addDetails(materials);

    // 4. Industrial Realistic Lighting
    this.setupLighting();

    console.log('[RealisticWarehouse] Warehouse world generation complete!');
  }

  private addDetails(materials: any) {
    // Structural Roof I-Beams (Trusses along ceiling)
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.4 });
    for (let x = -30; x <= 30; x += 10) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 45), beamMat);
      beam.position.set(x, 9.8, 0);
      this.mapGroup.add(beam);
    }

    // Industrial Bay Signboards
    const sign1 = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map: TextureGenerator.createSignboard('LOGISTICS BAY 01', 'ALPHA SECTOR', '#38bdf8'), side: THREE.DoubleSide })
    );
    sign1.position.set(-25, 7, -22.4);
    this.mapGroup.add(sign1);

    const sign2 = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map: TextureGenerator.createSignboard('SHIPPING DOCK 02', 'BRAVO SECTOR', '#f97316'), side: THREE.DoubleSide })
    );
    sign2.position.set(25, 7, -22.4);
    this.mapGroup.add(sign2);

    const signCatwalk = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map: TextureGenerator.createSignboard('OVERHEAD CATWALK', 'AUTHORIZED ACCESS ONLY', '#eab308'), side: THREE.DoubleSide })
    );
    signCatwalk.position.set(0, 5.5, 17.9);
    this.mapGroup.add(signCatwalk);

    // Skylight Glass Panes in Ceiling
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbfdbfe,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6
    });
    for (let x = -20; x <= 20; x += 15) {
      const skylight = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), glassMat);
      skylight.rotation.x = Math.PI / 2;
      skylight.position.set(x, 9.9, 0);
      this.mapGroup.add(skylight);
    }
  }

  private setupLighting() {
    // Ambient warehouse gloom
    const ambient = new THREE.AmbientLight(0x94a3b8, 0.4);
    this.scene.add(ambient);

    // Warm dramatic warehouse sunlight angled through skylights
    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.6);
    sunLight.position.set(25, 30, -15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1.0;
    sunLight.shadow.camera.far = 75;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    // High-bay industrial hanging pendant lamps
    const lampPositions = [
      { x: -20, z: -10, color: 0x38bdf8 },
      { x: -20, z: 10, color: 0x38bdf8 },
      { x: 0, z: 0, color: 0xfef08a },
      { x: 20, z: -10, color: 0xfb923c },
      { x: 20, z: 10, color: 0xfb923c },
      { x: 0, z: 19.5, color: 0x67e8f9 } // Catwalk lamp
    ];

    for (const lp of lampPositions) {
      const spot = new THREE.SpotLight(lp.color, 1.8, 35, Math.PI / 3.5, 0.45, 1.2);
      spot.position.set(lp.x, 9.2, lp.z);
      spot.target.position.set(lp.x, 0, lp.z);
      this.scene.add(spot);
      this.scene.add(spot.target);

      // Visible lamp hood & bulb
      const hood = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.8, 0.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 })
      );
      hood.position.set(lp.x, 9.4, lp.z);
      this.scene.add(hood);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      bulb.position.set(lp.x, 9.2, lp.z);
      this.scene.add(bulb);
    }
  }
}
