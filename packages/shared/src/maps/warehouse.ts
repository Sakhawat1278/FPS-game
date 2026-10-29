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
    width: number;
    length: number;
    height: number;
  };
  killY: number; // out of bounds kill threshold (-5m)
  colliders: BoxColliderDesc[];
  spawns: SpawnPoint[];
}

export const WAREHOUSE_MAP: MapData = {
  id: 'big_map_pvp',
  name: 'Big Map PvP / PvE / FPS',
  dimensions: {
    width: 70,
    length: 70,
    height: 12
  },
  killY: -5,
  colliders: [
    // Outer perimeter boundary walls and ceiling to prevent physics escape
    { id: 'boundary_south', x: 0, y: 5.0, z: -12.5, hx: 35.0, hy: 8.0, hz: 0.5, type: 'wall' },
    { id: 'boundary_north', x: 0, y: 5.0, z: 55.5, hx: 35.0, hy: 8.0, hz: 0.5, type: 'wall' },
    { id: 'boundary_west', x: -34.0, y: 5.0, z: 21.5, hx: 0.5, hy: 8.0, hz: 35.0, type: 'wall' },
    { id: 'boundary_east', x: 34.0, y: 5.0, z: 21.5, hx: 0.5, hy: 8.0, hz: 35.0, type: 'wall' },
    { id: 'boundary_ceiling', x: 0, y: 12.0, z: 21.5, hx: 35.0, hy: 0.5, hz: 35.0, type: 'ceiling' }
  ],
  spawns: [
    // Alpha Spawns (South Yard / Blue Base, Z ~ 1.0, facing North yaw = 0)
    { id: 'alpha_spawn_1', team: 'alpha', x: -8.0, y: 1.9, z: 1.0, yaw: 0 },
    { id: 'alpha_spawn_2', team: 'alpha', x: -4.0, y: 1.9, z: 1.0, yaw: 0 },
    { id: 'alpha_spawn_3', team: 'alpha', x: 0.0, y: 1.9, z: 1.0, yaw: 0 },
    { id: 'alpha_spawn_4', team: 'alpha', x: 4.0, y: 1.9, z: 1.0, yaw: 0 },
    { id: 'alpha_spawn_5', team: 'alpha', x: 8.0, y: 1.9, z: 1.0, yaw: 0 },

    // Bravo Spawns (North Yard / Red Base, Z ~ 41.0, facing South yaw = Math.PI)
    { id: 'bravo_spawn_1', team: 'bravo', x: -8.0, y: 1.9, z: 41.0, yaw: Math.PI },
    { id: 'bravo_spawn_2', team: 'bravo', x: -4.0, y: 1.9, z: 41.0, yaw: Math.PI },
    { id: 'bravo_spawn_3', team: 'bravo', x: 0.0, y: 1.9, z: 41.0, yaw: Math.PI },
    { id: 'bravo_spawn_4', team: 'bravo', x: 4.0, y: 1.9, z: 41.0, yaw: Math.PI },
    { id: 'bravo_spawn_5', team: 'bravo', x: 8.0, y: 1.9, z: 41.0, yaw: Math.PI },

    // Neutral Fallback Spawns (Midfield flanks & center)
    { id: 'neutral_spawn_1', team: 'neutral', x: -15.0, y: 1.9, z: 21.5, yaw: 0 },
    { id: 'neutral_spawn_2', team: 'neutral', x: 15.0, y: 1.9, z: 21.5, yaw: Math.PI },
    { id: 'neutral_spawn_3', team: 'neutral', x: 0.0, y: 1.9, z: 21.5, yaw: 0 }
  ]
};
