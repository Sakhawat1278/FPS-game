import { PLAYER_PHYSICS_RULES } from '../config/rules';
import { PlayerInput } from '../types';

export interface CharacterState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  isGrounded: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
}

export function computeDesiredMovement(
  input: PlayerInput,
  currentState: CharacterState,
  dt: number
): { desiredVx: number; desiredVz: number; targetSpeed: number; canSprint: boolean } {
  // Can only sprint if moving forward (moveForward > 0.1) and not crouching
  const canSprint = input.isSprinting && input.moveForward > 0.1 && !input.isCrouching;

  // Determine target horizontal speed
  let targetSpeed = PLAYER_PHYSICS_RULES.walkSpeed;
  if (input.isCrouching) {
    targetSpeed = PLAYER_PHYSICS_RULES.crouchSpeed;
  } else if (canSprint) {
    targetSpeed = PLAYER_PHYSICS_RULES.sprintSpeed;
  }

  // Normalize input vector so diagonals don't move faster
  let inputX = input.moveRight;
  let inputZ = input.moveForward;
  const inputLen = Math.sqrt(inputX * inputX + inputZ * inputZ);
  if (inputLen > 1.0) {
    inputX /= inputLen;
    inputZ /= inputLen;
  }

  // Transform input from local player yaw to world space
  // yaw = 0 faces +Z (or -Z depending on convention; in FPS standard: 0 = +Z or -Z, let's use:
  // forward = (-sin(yaw), -cos(yaw)), right = (cos(yaw), -sin(yaw))
  const sinY = Math.sin(input.yaw);
  const cosY = Math.cos(input.yaw);

  // World movement direction
  // forward vector in Three.js coordinates (forward is -Z when looking forward at yaw 0):
  const worldForwardX = -sinY;
  const worldForwardZ = -cosY;
  const worldRightX = cosY;
  const worldRightZ = -sinY;

  const moveDirX = (worldForwardX * inputZ) + (worldRightX * inputX);
  const moveDirZ = (worldForwardZ * inputZ) + (worldRightZ * inputX);

  const desiredVx = moveDirX * targetSpeed;
  const desiredVz = moveDirZ * targetSpeed;

  return { desiredVx, desiredVz, targetSpeed, canSprint };
}

export function applyAcceleration(
  currentVx: number,
  currentVz: number,
  desiredVx: number,
  desiredVz: number,
  isGrounded: boolean,
  dt: number
): { vx: number; vz: number } {
  const accel = isGrounded 
    ? PLAYER_PHYSICS_RULES.acceleration 
    : PLAYER_PHYSICS_RULES.acceleration * PLAYER_PHYSICS_RULES.airControlMultiplier;

  const friction = isGrounded ? PLAYER_PHYSICS_RULES.friction : 0.0;

  // Linear interpolation / velocity approach towards desired velocity
  const dx = desiredVx - currentVx;
  const dz = desiredVz - currentVz;
  const dist = Math.sqrt(dx * dx + dz * dz);

  let newVx = currentVx;
  let newVz = currentVz;

  if (dist > 0.001) {
    const step = accel * dt;
    if (step >= dist) {
      newVx = desiredVx;
      newVz = desiredVz;
    } else {
      newVx += (dx / dist) * step;
      newVz += (dz / dist) * step;
    }
  }

  // Apply friction when no input is provided
  if (desiredVx === 0 && desiredVz === 0 && isGrounded) {
    const currentSpeed = Math.sqrt(newVx * newVx + newVz * newVz);
    if (currentSpeed > 0.001) {
      const drop = friction * dt;
      const newSpeed = Math.max(0, currentSpeed - drop);
      const ratio = newSpeed / currentSpeed;
      newVx *= ratio;
      newVz *= ratio;
    } else {
      newVx = 0;
      newVz = 0;
    }
  }

  return { vx: newVx, vz: newVz };
}

