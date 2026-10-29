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

    const containerBlue = TextureGenerator.createCorrugatedMetal('#2563eb');
    containerBlue.repeat.set(4, 2);

    const containerOrange = TextureGenerator.createCorrugatedMetal('#ea580c');
    containerOrange.repeat.set(4, 2);

    const containerGreen = TextureGenerator.createCorrugatedMetal('#16a34a');
    containerGreen.repeat.set(4, 2);

    const wallTex = TextureGenerator.createCorrugatedMetal('#475569');
    wallTex.repeat.set(8, 2);

    const materials = {
      floor: new THREE.MeshStandardMaterial({
        map: concreteTex,
        roughnessMap: concreteRough,
        roughness: 0.65,
        metalness: 0.05
      }),
      ceiling: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.8,
        metalness: 0.2
      }),
      wall: new THREE.MeshStandardMaterial({
        map: wallTex,
        roughness: 0.65,
        metalness: 0.25
      }),
      wood: new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.75,
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
        roughness: 0.45,
        metalness: 0.4
      }),
      containerOrange: new THREE.MeshStandardMaterial({
        map: containerOrange,
        roughness: 0.45,
        metalness: 0.4
      }),
      containerGreen: new THREE.MeshStandardMaterial({
        map: containerGreen,
        roughness: 0.45,
        metalness: 0.4
      }),
      pillar: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.7,
        metalness: 0.1
      }),
      rackFrame: new THREE.MeshStandardMaterial({
        color: 0xf97316, // Bright safety orange pallet rack
        roughness: 0.4,
        metalness: 0.6
      }),
      railing: new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.3,
        metalness: 0.8
      })
    };

    const baseBox = new THREE.BoxGeometry(1, 1, 1);

    // 2. Build Rapier Static Collision Rigidbody & Three.js Meshes
    const staticBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const staticBody = this.rapierWorld.createRigidBody(staticBodyDesc);

    for (const c of WAREHOUSE_MAP.colliders) {
      // Rapier Collider (all colliders including ceiling are preserved in physics)
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

      // In the visual scene, skip rendering the solid opaque ceiling to open the view to the sunrise sky
      if (c.id === 'ceiling') {
        continue;
      }

      // Material assignment based on ID / type
      let mat: THREE.Material = materials.wall;
      if (c.id === 'floor') mat = materials.floor;
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

      mesh.castShadow = c.type !== 'floor';
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
    // 1. Procedural 360-degree Sunrise Sky Dome (Open-Air Setting)
    const skyGeo = new THREE.SphereGeometry(260, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: TextureGenerator.createSunriseSky(),
      side: THREE.BackSide,
      depthWrite: false
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.renderOrder = -100;
    this.scene.add(skyMesh);

    // 2. Open-Air Structural Gantry Trusses across the top
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    for (let x = -32; x <= 32; x += 8) {
      // Main cross beam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 45), trussMat);
      beam.position.set(x, 10.0, 0);
      this.mapGroup.add(beam);

      // Angled diagonal support struts
      const strut1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 15), trussMat);
      strut1.position.set(x, 8.8, -15);
      strut1.rotation.x = 0.42;
      this.mapGroup.add(strut1);

      const strut2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 15), trussMat);
      strut2.position.set(x, 8.8, 15);
      strut2.rotation.x = -0.42;
      this.mapGroup.add(strut2);
    }

    // 3. Industrial Bay Signboards
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
  }

  private setupLighting() {
    // 1. Natural sunrise ambient light with shadow contrast
    const ambient = new THREE.AmbientLight(0xffedd5, 0.45);
    this.scene.add(ambient);

    // 2. Hemisphere light: clear blue morning sky down, warm terrain bounce up
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x92400e, 0.5);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 3. Golden Rising Sun Directional Light (low sunrise angle, high-contrast shadows)
    const sunLight = new THREE.DirectionalLight(0xffb74d, 2.2);
    sunLight.position.set(45, 26, -30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1.0;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 35;
    sunLight.shadow.camera.bottom = -35;
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);

    // 4. Soft sky fill light from opposite horizon
    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.4);
    fillLight.position.set(-35, 20, 25);
    this.scene.add(fillLight);

    // 5. Warm industrial high-bay lamps
    const lampPositions = [
      { x: -20, z: -10, color: 0xfef08a },
      { x: -20, z: 10, color: 0xfef08a },
      { x: 0, z: 0, color: 0xffedd5 },
      { x: 20, z: -10, color: 0xfb923c },
      { x: 20, z: 10, color: 0xfb923c },
      { x: 0, z: 19.5, color: 0x38bdf8 } // Catwalk lamp
    ];

    for (const lp of lampPositions) {
      const spot = new THREE.SpotLight(lp.color, 1.4, 30, Math.PI / 3.5, 0.45, 1.2);
      spot.position.set(lp.x, 9.6, lp.z);
      spot.target.position.set(lp.x, 0, lp.z);
      this.scene.add(spot);
      this.scene.add(spot.target);

      // Visible lamp hood & bulb
      const hood = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.8, 0.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 })
      );
      hood.position.set(lp.x, 9.8, lp.z);
      this.mapGroup.add(hood);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      bulb.position.set(lp.x, 9.6, lp.z);
      this.mapGroup.add(bulb);
    }
  }
}

