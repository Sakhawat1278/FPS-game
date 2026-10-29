import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { WAREHOUSE_MAP, HAZMOB_COLLISION } from '@warehouse-strike/shared';
import { TextureGenerator } from '../rendering/TextureGenerator';

export class RealisticWarehouse {
  public scene: THREE.Scene;
  public rapierWorld: RAPIER.World;
  public mapGroup: THREE.Group;
  public isLoaded: boolean = false;

  constructor(scene: THREE.Scene, rapierWorld: RAPIER.World) {
    this.scene = scene;
    this.rapierWorld = rapierWorld;
    this.mapGroup = new THREE.Group();
    this.mapGroup.name = 'big_map_pvp_group';
    this.scene.add(this.mapGroup);
  }

  public async build(): Promise<void> {
    console.log('[RealisticWarehouse] Initializing Big Map PvP Arena...');

    // 1. Build Static Rapier Physics Colliders (1:1 with Server)
    const staticBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const staticBody = this.rapierWorld.createRigidBody(staticBodyDesc);

    // 1a. Exact Trimesh Collider for entire map geometry
    const trimeshDesc = RAPIER.ColliderDesc.trimesh(
      HAZMOB_COLLISION.vertices,
      HAZMOB_COLLISION.indices
    );
    this.rapierWorld.createCollider(trimeshDesc, staticBody);

    // 1b. Boundary Colliders around perimeter
    for (const c of WAREHOUSE_MAP.colliders) {
      const desc = RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z);
      if (c.rotationY) {
        desc.setRotation({
          x: 0,
          y: Math.sin(c.rotationY / 2),
          z: 0,
          w: Math.cos(c.rotationY / 2)
        });
      }
      this.rapierWorld.createCollider(desc, staticBody);
    }

    // 2. Open-Air Sunrise Sky Dome
    this.addSkyDome();

    // 3. Balanced Eye-Friendly Lighting
    this.setupLighting();

    // 4. Load Visual Big Map 3D GLTF Model
    await this.loadMapModel();

    console.log('[RealisticWarehouse] Big Map PvP world generation complete!');
  }

  private loadMapModel(): Promise<void> {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        '/models/map/big_map_pvp.glb',
        (gltf) => {
          console.log('[RealisticWarehouse] Big Map GLB loaded successfully!');
          const model = gltf.scene;

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // The arena ground floor is the 'Plane' mesh
              if (mesh.name === 'Plane' || child.name === 'Plane') {
                const grassPBR = TextureGenerator.createGrass();
                grassPBR.map.repeat.set(28, 28);
                grassPBR.normalMap.repeat.set(28, 28);
                grassPBR.roughnessMap.repeat.set(28, 28);

                const grassMat = new THREE.MeshStandardMaterial({
                  map: grassPBR.map,
                  normalMap: grassPBR.normalMap,
                  normalScale: new THREE.Vector2(1.2, 1.2),
                  roughnessMap: grassPBR.roughnessMap,
                  roughness: 0.88,
                  metalness: 0.02,
                  envMapIntensity: 0.25,
                  color: 0xffffff
                });
                mesh.material = grassMat;
                mesh.receiveShadow = true;
                mesh.castShadow = false;
              } else {
                // Tune materials to a clean matte finish (no blinding mirror reflections)
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat) {
                  mat.roughness = 0.76;
                  mat.metalness = 0.15;
                  mat.envMapIntensity = 0.35;
                  mat.needsUpdate = true;
                }
              }
            }
          });

          this.mapGroup.add(model);
          this.isLoaded = true;
          resolve();
        },
        undefined,
        (error) => {
          console.error('[RealisticWarehouse] Failed to load big_map_pvp.glb, falling back:', error);
          resolve();
        }
      );
    });
  }

  private addSkyDome() {
    // 360-degree Sunrise Sky Dome centered on Map Center (0, 1.0, 21.5)
    const skyGeo = new THREE.SphereGeometry(280, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: TextureGenerator.createSunriseSky(),
      side: THREE.BackSide,
      depthWrite: false
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(0, 1.0, 21.5);
    skyMesh.renderOrder = -100;
    this.scene.add(skyMesh);
  }

  private setupLighting() {
    // Map center anchor
    const mapCenter = new THREE.Vector3(0, 1.0, 21.5);

    // 1. Soft natural daylight ambient light
    const ambient = new THREE.AmbientLight(0xffedd5, 0.55);
    this.scene.add(ambient);

    // 2. Clear morning sky dome fill (cool blue sky above, lush green grass bounce below)
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x2d5a1b, 0.45);
    hemiLight.position.set(0, 50, 21.5);
    this.scene.add(hemiLight);

    // 3. Soft morning sun directional light (moderate intensity to eliminate over-exposure)
    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.0);
    sunLight.position.set(30, 35, 0);
    sunLight.target.position.copy(mapCenter);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1.0;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);
    this.scene.add(sunLight.target);

    // 4. Subtle fill directional light from opposite side to soften shadows
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    fillLight.position.set(-30, 25, 45);
    fillLight.target.position.copy(mapCenter);
    this.scene.add(fillLight);
    this.scene.add(fillLight.target);
  }
}
