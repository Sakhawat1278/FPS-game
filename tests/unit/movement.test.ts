import { describe, it, expect } from 'vitest';
import {
  PLAYER_PHYSICS_RULES,
  computeDesiredMovement,
  applyAcceleration,
  PlayerInput
} from '../../packages/shared/src/index';

describe('Player Physics and Kinematics Rules', () => {
  it('defines correct movement speeds and jump height according to specifications', () => {
    expect(PLAYER_PHYSICS_RULES.walkSpeed).toBe(4.2);
    expect(PLAYER_PHYSICS_RULES.sprintSpeed).toBe(6.5);
    expect(PLAYER_PHYSICS_RULES.crouchSpeed).toBe(2.2);
    expect(PLAYER_PHYSICS_RULES.jumpHeight).toBe(1.1);
    expect(PLAYER_PHYSICS_RULES.gravity).toBe(24.0);
    expect(PLAYER_PHYSICS_RULES.stepHeight).toBe(0.35);
  });

  it('computes forward walking speed when not sprinting', () => {
    const input: PlayerInput = {
      seq: 1,
      tick: 1,
      timestamp: Date.now(),
      moveForward: 1,
      moveRight: 0,
      yaw: 0,
      pitch: 0,
      isSprinting: false,
      isCrouching: false,
      isJumping: false,
      isShooting: false,
      isAiming: false
    };

    const state = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      isGrounded: true,
      isCrouching: false,
      isSprinting: false
    };

    const res = computeDesiredMovement(input, state, 1 / 60);
    expect(res.canSprint).toBe(false);
    expect(Math.hypot(res.desiredVx, res.desiredVz)).toBeCloseTo(PLAYER_PHYSICS_RULES.walkSpeed, 3);
  });

  it('allows sprinting only when moving forward and not crouching', () => {
    const sprintInput: PlayerInput = {
      seq: 2,
      tick: 2,
      timestamp: Date.now(),
      moveForward: 1,
      moveRight: 0,
      yaw: 0,
      pitch: 0,
      isSprinting: true,
      isCrouching: false,
      isJumping: false,
      isShooting: false,
      isAiming: false
    };

    const state = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      isGrounded: true,
      isCrouching: false,
      isSprinting: true
    };

    const res = computeDesiredMovement(sprintInput, state, 1 / 60);
    expect(res.canSprint).toBe(true);
    expect(Math.hypot(res.desiredVx, res.desiredVz)).toBeCloseTo(PLAYER_PHYSICS_RULES.sprintSpeed, 3);

    // If crouching, cannot sprint
    sprintInput.isCrouching = true;
    state.isCrouching = true;
    const crouchRes = computeDesiredMovement(sprintInput, state, 1 / 60);
    expect(crouchRes.canSprint).toBe(false);
    expect(Math.hypot(crouchRes.desiredVx, crouchRes.desiredVz)).toBeCloseTo(PLAYER_PHYSICS_RULES.crouchSpeed, 3);
  });

  it('accelerates player velocity towards desired velocity based on ground acceleration', () => {
    const dt = 1 / 60;
    const { vx, vz } = applyAcceleration(0, 0, 0, -4.2, true, dt);
    expect(vz).toBeLessThan(0);
    expect(Math.abs(vz)).toBeGreaterThan(0);
  });
});
