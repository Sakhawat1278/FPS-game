import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  PLAYER_PHYSICS_RULES,
  PlayerInput,
  computeDesiredMovement,
  applyAcceleration,
  WAREHOUSE_MAP
} from '@warehouse-strike/shared';

export class CharacterController {
  private rapierWorld: RAPIER.World;
  private camera: THREE.Camera;

  // Rapier physics objects
  public characterController: RAPIER.KinematicCharacterController;
  public collider: RAPIER.Collider;
  public rigidBody: RAPIER.RigidBody;

  // Stance colliders
  private standingColliderDesc: RAPIER.ColliderDesc;
  private crouchingColliderDesc: RAPIER.ColliderDesc;

  // Kinematic state
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public isGrounded: boolean = false;
  public isCrouched: boolean = false;
  public isSprinting: boolean = false;

  // Camera eye heights
  private standingEyeHeight = 1.65;
  private crouchingEyeHeight = 1.05;
  private currentEyeHeight = 1.65;

  constructor(rapierWorld: RAPIER.World, camera: THREE.Camera, startX = -28, startY = 1.0, startZ = -12) {
    this.rapierWorld = rapierWorld;
    this.camera = camera;
    this.position.set(startX, startY, startZ);

    // 1. Create Kinematic Rigid Body
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(this.position.x, this.position.y, this.position.z);
    this.rigidBody = this.rapierWorld.createRigidBody(bodyDesc);

    // 2. Create Capsule Colliders (Standing: 1.8m total, Crouch: 1.2m total)
    const radius = PLAYER_PHYSICS_RULES.capsuleRadius; // 0.38
    const standingHalfHeight = (PLAYER_PHYSICS_RULES.standingCapsuleHeight - 2 * radius) / 2; // 0.52
    const crouchingHalfHeight = (PLAYER_PHYSICS_RULES.crouchingCapsuleHeight - 2 * radius) / 2; // 0.22

    this.standingColliderDesc = RAPIER.ColliderDesc.capsule(standingHalfHeight, radius)
      .setTranslation(0, standingHalfHeight + radius, 0);
    this.crouchingColliderDesc = RAPIER.ColliderDesc.capsule(crouchingHalfHeight, radius)
      .setTranslation(0, crouchingHalfHeight + radius, 0);

    // Attach initial standing collider
    this.collider = this.rapierWorld.createCollider(this.standingColliderDesc, this.rigidBody);

    // 3. Create Rapier Kinematic Character Controller
    const offset = 0.02;
    this.characterController = this.rapierWorld.createCharacterController(offset);
    this.characterController.enableAutostep(PLAYER_PHYSICS_RULES.stepHeight, 0.2, true);
    this.characterController.enableSnapToGround(PLAYER_PHYSICS_RULES.stepHeight);
    this.characterController.setSlideEnabled(true);
    this.characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((50 * Math.PI) / 180);
  }

  public update(input: PlayerInput, dt: number) {
    // 1. Handle Crouching Capsule & Stance transitions
    const wantsCrouch = input.isCrouching;
    if (wantsCrouch !== this.isCrouched) {
      this.isCrouched = wantsCrouch;
      // Re-create collider shape with crouch / standing extents
      this.rapierWorld.removeCollider(this.collider, false);
      const desc = this.isCrouched ? this.crouchingColliderDesc : this.standingColliderDesc;
      this.collider = this.rapierWorld.createCollider(desc, this.rigidBody);
    }

    // Smooth eye height interpolation (8.0 rate)
    const targetEyeHeight = this.isCrouched ? this.crouchingEyeHeight : this.standingEyeHeight;
    this.currentEyeHeight += (targetEyeHeight - this.currentEyeHeight) * Math.min(1.0, 12.0 * dt);

    // 2. Horizontal Acceleration / Movement
    const { desiredVx, desiredVz, canSprint } = computeDesiredMovement(
      input,
      {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
        vx: this.velocity.x,
        vy: this.velocity.y,
        vz: this.velocity.z,
        yaw: input.yaw,
        pitch: input.pitch,
        isGrounded: this.isGrounded,
        isCrouching: this.isCrouched,
        isSprinting: this.isSprinting
      },
      dt
    );

    this.isSprinting = canSprint;

    const { vx, vz } = applyAcceleration(
      this.velocity.x,
      this.velocity.z,
      desiredVx,
      desiredVz,
      this.isGrounded,
      dt
    );
    this.velocity.x = vx;
    this.velocity.z = vz;

    // 3. Vertical Physics (Gravity & Jumping)
    if (this.isGrounded) {
      this.velocity.y = 0;
      if (input.isJumping) {
        // v0 = sqrt(2 * g * h)
        this.velocity.y = Math.sqrt(2 * PLAYER_PHYSICS_RULES.gravity * PLAYER_PHYSICS_RULES.jumpHeight);
        this.isGrounded = false;
      }
    } else {
      this.velocity.y -= PLAYER_PHYSICS_RULES.gravity * dt;
      // Terminal velocity clamp
      this.velocity.y = Math.max(-50.0, this.velocity.y);
    }

    // 4. Compute movement with Rapier Character Controller
    const desiredMovement = {
      x: this.velocity.x * dt,
      y: this.velocity.y * dt,
      z: this.velocity.z * dt
    };

    this.characterController.computeColliderMovement(this.collider, desiredMovement);
    const corrected = this.characterController.computedMovement();
    this.isGrounded = this.characterController.computedGrounded();

    // 5. Update position
    const currentTranslation = this.rigidBody.translation();
    const newX = currentTranslation.x + corrected.x;
    const newY = currentTranslation.y + corrected.y;
    const newZ = currentTranslation.z + corrected.z;

    this.rigidBody.setNextKinematicTranslation({ x: newX, y: newY, z: newZ });
    this.position.set(newX, newY, newZ);

    // 6. Out of Bounds Kill Volume Check
    if (this.position.y < WAREHOUSE_MAP.killY) {
      this.respawnAt(WAREHOUSE_MAP.spawns[0].x, WAREHOUSE_MAP.spawns[0].y, WAREHOUSE_MAP.spawns[0].z);
    }

    // 7. Update Camera transform
    this.camera.position.set(this.position.x, this.position.y + this.currentEyeHeight, this.position.z);
    
    // Euler rotation: Pitch (X), Yaw (Y) in 'YXZ' order
    const euler = new THREE.Euler(input.pitch, input.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  public respawnAt(x: number, y: number, z: number) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.rigidBody.setTranslation({ x, y, z }, true);
  }

  public get horizontalSpeed(): number {
    return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
  }
}
