export interface BoxColliderDesc {
  id: string;
  x: number;
  y: number;
  z: number;
  hx: number; // half extents X
  hy: number; // half extents Y
  hz: number; // half extents Z
  rotationY?: number; // radians
  type: 'wall' | 'floor' | 'ceiling' | 'prop' | 'ramp' | 'catwalk' | 'cover';
  color?: number; // color tint for greybox visualization
}

export interface SpawnPoint {
  id: string;
  team: 'alpha' | 'bravo' | 'neutral';
  x: number;
  y: number;
  z: number;
  yaw: number; // radians facing direction
}

export interface MapData {
  id: string;
  name: string;
  dimensions: {
    width: number; // X: 70m (-35 to +35)
    length: number; // Z: 45m (-22.5 to +22.5)
    height: number; // Y: 10m (0 to 10)
  };
  killY: number; // out of bounds kill threshold (-5m)
  colliders: BoxColliderDesc[];
  spawns: SpawnPoint[];
}

export const WAREHOUSE_MAP: MapData = {
  id: 'warehouse',
  name: 'Industrial Warehouse',
  dimensions: {
    width: 70,
    length: 45,
    height: 10
  },
  killY: -5,
  colliders: [
    // -------------------------------------------------------------
    // PERIMETER BOUNDS (Floor, Ceiling, Outer Walls)
    // -------------------------------------------------------------
    // Floor
    { id: 'floor', x: 0, y: -0.25, z: 0, hx: 35, hy: 0.25, hz: 22.5, type: 'floor', color: 0x1f242d },
    // Ceiling
    { id: 'ceiling', x: 0, y: 10.25, z: 0, hx: 35, hy: 0.25, hz: 22.5, type: 'ceiling', color: 0x111317 },
    // North Wall (Z = -22.5)
    { id: 'wall_north', x: 0, y: 5, z: -22.75, hx: 35, hy: 5, hz: 0.25, type: 'wall', color: 0x282f3a },
    // South Wall (Z = +22.5)
    { id: 'wall_south', x: 0, y: 5, z: 22.75, hx: 35, hy: 5, hz: 0.25, type: 'wall', color: 0x282f3a },
    // West Wall (Alpha End, X = -35)
    { id: 'wall_west', x: -35.25, y: 5, z: 0, hx: 0.25, hy: 5, hz: 22.5, type: 'wall', color: 0x222731 },
    // East Wall (Bravo End, X = +35)
    { id: 'wall_east', x: 35.25, y: 5, z: 0, hx: 0.25, hy: 5, hz: 22.5, type: 'wall', color: 0x222731 },

    // -------------------------------------------------------------
    // TEAM SPAWN ROOMS / CORNERS (X = -35..-25 and X = 25..35)
    // -------------------------------------------------------------
    // Alpha Spawn Partition Wall (protects direct line of sight)
    { id: 'alpha_spawn_wall_1', x: -25, y: 3, z: -10, hx: 0.3, hy: 3, hz: 8, type: 'wall', color: 0x1e3a5f },
    { id: 'alpha_spawn_wall_2', x: -25, y: 3, z: 10, hx: 0.3, hy: 3, hz: 8, type: 'wall', color: 0x1e3a5f },

    // Bravo Spawn Partition Wall
    { id: 'bravo_spawn_wall_1', x: 25, y: 3, z: -10, hx: 0.3, hy: 3, hz: 8, type: 'wall', color: 0x5a2d18 },
    { id: 'bravo_spawn_wall_2', x: 25, y: 3, z: 10, hx: 0.3, hy: 3, hz: 8, type: 'wall', color: 0x5a2d18 },

    // -------------------------------------------------------------
    // LANE 1: LEFT FLANK (Z = -22.5 to -8) — Tight offices & corridors
    // -------------------------------------------------------------
    // Office corridor walls
    { id: 'office_wall_1', x: -10, y: 2.5, z: -14, hx: 6, hy: 2.5, hz: 0.25, type: 'wall', color: 0x374151 },
    { id: 'office_wall_2', x: 10, y: 2.5, z: -14, hx: 6, hy: 2.5, hz: 0.25, type: 'wall', color: 0x374151 },
    { id: 'office_divider_1', x: -16, y: 2.5, z: -18, hx: 0.25, hy: 2.5, hz: 4, type: 'wall', color: 0x374151 },
    { id: 'office_divider_2', x: 0, y: 2.5, z: -18, hx: 0.25, hy: 2.5, hz: 4, type: 'wall', color: 0x374151 },
    { id: 'office_divider_3', x: 16, y: 2.5, z: -18, hx: 0.25, hy: 2.5, hz: 4, type: 'wall', color: 0x374151 },
    // Office desks & cover
    { id: 'office_desk_1', x: -8, y: 0.5, z: -19, hx: 1.5, hy: 0.5, hz: 0.8, type: 'cover', color: 0x4b5563 },
    { id: 'office_desk_2', x: 8, y: 0.5, z: -19, hx: 1.5, hy: 0.5, hz: 0.8, type: 'cover', color: 0x4b5563 },

    // -------------------------------------------------------------
    // LANE 2: CENTER AISLE (Z = -8 to +8) — Shelves, Pallets, Pillars
    // -------------------------------------------------------------
    // Heavy Structural Pillars
    { id: 'pillar_1', x: -18, y: 5, z: -5, hx: 0.75, hy: 5, hz: 0.75, type: 'prop', color: 0x4b5563 },
    { id: 'pillar_2', x: -18, y: 5, z: 5, hx: 0.75, hy: 5, hz: 0.75, type: 'prop', color: 0x4b5563 },
    { id: 'pillar_3', x: 0, y: 5, z: -5, hx: 0.75, hy: 5, hz: 0.75, type: 'prop', color: 0x4b5563 },
    { id: 'pillar_4', x: 0, y: 5, z: 5, hx: 0.75, hy: 5, hz: 0.75, type: 'prop', color: 0x4b5563 },
    { id: 'pillar_5', x: 18, y: 5, z: -5, hx: 0.75, hy: 5, hz: 0.75, type: 'prop', color: 0x4b5563 },
    { id: 'pillar_6', x: 18, y: 5, z: 5, hx: 0.75, hy: 5, hz: 0.75, type: 'prop', color: 0x4b5563 },

    // Pallet Racks (Industrial shelves, 7m high, 1.2m deep)
    { id: 'rack_west_1', x: -12, y: 3.5, z: -2, hx: 3.5, hy: 3.5, hz: 0.6, type: 'prop', color: 0xd97706 },
    { id: 'rack_west_2', x: -12, y: 3.5, z: 2, hx: 3.5, hy: 3.5, hz: 0.6, type: 'prop', color: 0xd97706 },
    { id: 'rack_east_1', x: 12, y: 3.5, z: -2, hx: 3.5, hy: 3.5, hz: 0.6, type: 'prop', color: 0xd97706 },
    { id: 'rack_east_2', x: 12, y: 3.5, z: 2, hx: 3.5, hy: 3.5, hz: 0.6, type: 'prop', color: 0xd97706 },

    // Center Cross-Cover / Stacked Wooden Pallets & Crates (breaks center 40m sightline)
    { id: 'center_crate_stack_1', x: 0, y: 1.25, z: 0, hx: 2.0, hy: 1.25, hz: 1.8, type: 'cover', color: 0x92400e },
    { id: 'center_crate_stack_2', x: -5, y: 0.8, z: 3, hx: 1.2, hy: 0.8, hz: 1.2, type: 'cover', color: 0x78350f },
    { id: 'center_crate_stack_3', x: 5, y: 0.8, z: -3, hx: 1.2, hy: 0.8, hz: 1.2, type: 'cover', color: 0x78350f },

    // -------------------------------------------------------------
    // LANE 3: RIGHT FLANK (Z = +8 to +22.5) — Loading Dock & Elevated Catwalk
    // -------------------------------------------------------------
    // Shipping Containers (Length 6m, Width 2.4m, Height 2.6m)
    { id: 'container_alpha', x: -16, y: 1.3, z: 14, hx: 3.0, hy: 1.3, hz: 1.2, type: 'cover', color: 0x0369a1 },
    { id: 'container_bravo', x: 16, y: 1.3, z: 14, hx: 3.0, hy: 1.3, hz: 1.2, type: 'cover', color: 0xb45309 },
    { id: 'container_center', x: 0, y: 1.3, z: 12, hx: 1.2, hy: 1.3, hz: 3.0, type: 'cover', color: 0x15803d },

    // Elevated Catwalk / Mezzanine (Y = 3.6m, Z = 18.5m, Length 40m, Width 2.5m)
    { id: 'catwalk_floor', x: 0, y: 3.5, z: 19.5, hx: 20, hy: 0.15, hz: 1.5, type: 'catwalk', color: 0x475569 },
    // Catwalk Railings (Waist height 1.0m, allows firing while crouching)
    { id: 'catwalk_rail_front', x: 0, y: 4.15, z: 18.0, hx: 20, hy: 0.5, hz: 0.08, type: 'cover', color: 0x64748b },

    // Catwalk Support Pillars
    { id: 'catwalk_support_1', x: -15, y: 1.75, z: 19.5, hx: 0.3, hy: 1.75, hz: 0.3, type: 'prop', color: 0x334155 },
    { id: 'catwalk_support_2', x: -5, y: 1.75, z: 19.5, hx: 0.3, hy: 1.75, hz: 0.3, type: 'prop', color: 0x334155 },
    { id: 'catwalk_support_3', x: 5, y: 1.75, z: 19.5, hx: 0.3, hy: 1.75, hz: 0.3, type: 'prop', color: 0x334155 },
    { id: 'catwalk_support_4', x: 15, y: 1.75, z: 19.5, hx: 0.3, hy: 1.75, hz: 0.3, type: 'prop', color: 0x334155 },

    // West Access Ramp to Catwalk (Alpha side)
    // Stepped ramp boxes allowing Rapier character auto-stepping (step height 0.35m)
    { id: 'ramp_w_step_1', x: -21.5, y: 0.35, z: 19.5, hx: 1.0, hy: 0.35, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_w_step_2', x: -23.0, y: 0.95, z: 19.5, hx: 0.8, hy: 0.95, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_w_step_3', x: -24.5, y: 1.55, z: 19.5, hx: 0.8, hy: 1.55, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_w_step_4', x: -26.0, y: 2.15, z: 19.5, hx: 0.8, hy: 2.15, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_w_step_5', x: -27.5, y: 2.75, z: 19.5, hx: 0.8, hy: 2.75, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_w_step_6', x: -29.0, y: 3.35, z: 19.5, hx: 0.8, hy: 3.35, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_w_landing', x: -31.0, y: 3.5, z: 19.5, hx: 1.2, hy: 0.15, hz: 1.4, type: 'catwalk', color: 0x475569 },

    // East Access Ramp to Catwalk (Bravo side)
    { id: 'ramp_e_step_1', x: 21.5, y: 0.35, z: 19.5, hx: 1.0, hy: 0.35, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_e_step_2', x: 23.0, y: 0.95, z: 19.5, hx: 0.8, hy: 0.95, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_e_step_3', x: 24.5, y: 1.55, z: 19.5, hx: 0.8, hy: 1.55, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_e_step_4', x: 26.0, y: 2.15, z: 19.5, hx: 0.8, hy: 2.15, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_e_step_5', x: 27.5, y: 2.75, z: 19.5, hx: 0.8, hy: 2.75, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_e_step_6', x: 29.0, y: 3.35, z: 19.5, hx: 0.8, hy: 3.35, hz: 1.4, type: 'ramp', color: 0x64748b },
    { id: 'ramp_e_landing', x: 31.0, y: 3.5, z: 19.5, hx: 1.2, hy: 0.15, hz: 1.4, type: 'catwalk', color: 0x475569 }
  ],
  spawns: [
    // 8 Alpha Spawns (West side, X ~ -30, facing East yaw = 0)
    { id: 'alpha_spawn_1', team: 'alpha', x: -30, y: 0.9, z: -18, yaw: 0 },
    { id: 'alpha_spawn_2', team: 'alpha', x: -30, y: 0.9, z: -14, yaw: 0 },
    { id: 'alpha_spawn_3', team: 'alpha', x: -30, y: 0.9, z: -8, yaw: 0 },
    { id: 'alpha_spawn_4', team: 'alpha', x: -30, y: 0.9, z: -4, yaw: 0 },
    { id: 'alpha_spawn_5', team: 'alpha', x: -30, y: 0.9, z: 2, yaw: 0 },
    { id: 'alpha_spawn_6', team: 'alpha', x: -30, y: 0.9, z: 6, yaw: 0 },
    { id: 'alpha_spawn_7', team: 'alpha', x: -30, y: 0.9, z: 12, yaw: 0 },
    { id: 'alpha_spawn_8', team: 'alpha', x: -30, y: 0.9, z: 16, yaw: 0 },

    // 8 Bravo Spawns (East side, X ~ +30, facing West yaw = Math.PI)
    { id: 'bravo_spawn_1', team: 'bravo', x: 30, y: 0.9, z: -18, yaw: Math.PI },
    { id: 'bravo_spawn_2', team: 'bravo', x: 30, y: 0.9, z: -14, yaw: Math.PI },
    { id: 'bravo_spawn_3', team: 'bravo', x: 30, y: 0.9, z: -8, yaw: Math.PI },
    { id: 'bravo_spawn_4', team: 'bravo', x: 30, y: 0.9, z: -4, yaw: Math.PI },
    { id: 'bravo_spawn_5', team: 'bravo', x: 30, y: 0.9, z: 2, yaw: Math.PI },
    { id: 'bravo_spawn_6', team: 'bravo', x: 30, y: 0.9, z: 6, yaw: Math.PI },
    { id: 'bravo_spawn_7', team: 'bravo', x: 30, y: 0.9, z: 12, yaw: Math.PI },
    { id: 'bravo_spawn_8', team: 'bravo', x: 30, y: 0.9, z: 16, yaw: Math.PI },

    // 6 Neutral Fallback Spawns
    { id: 'neutral_spawn_1', team: 'neutral', x: -15, y: 0.9, z: -12, yaw: 0 },
    { id: 'neutral_spawn_2', team: 'neutral', x: 15, y: 0.9, z: -12, yaw: Math.PI },
    { id: 'neutral_spawn_3', team: 'neutral', x: -8, y: 0.9, z: 8, yaw: 0 },
    { id: 'neutral_spawn_4', team: 'neutral', x: 8, y: 0.9, z: 8, yaw: Math.PI },
    { id: 'neutral_spawn_5', team: 'neutral', x: -10, y: 4.5, z: 19.5, yaw: 0 }, // on catwalk
    { id: 'neutral_spawn_6', team: 'neutral', x: 10, y: 4.5, z: 19.5, yaw: Math.PI } // on catwalk
  ]
};

