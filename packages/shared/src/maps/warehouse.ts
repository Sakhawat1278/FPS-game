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
  id: 'hazmob_pvp',
  name: 'Hazmob PvP Arena',
  dimensions: {
    width: 34,
    length: 30,
    height: 8
  },
  killY: -5,
  colliders: [
    // Outer perimeter boundary walls and ceiling to prevent physics escape
    { id: 'boundary_west', x: -27.0, y: 4.0, z: 0, hx: 0.5, hy: 6.0, hz: 15.0, type: 'wall' },
    { id: 'boundary_east', x: 6.5, y: 4.0, z: 0, hx: 0.5, hy: 6.0, hz: 15.0, type: 'wall' },
    { id: 'boundary_north', x: -10.25, y: 4.0, z: -14.5, hx: 18.0, hy: 6.0, hz: 0.5, type: 'wall' },
    { id: 'boundary_south', x: -10.25, y: 4.0, z: 14.5, hx: 18.0, hy: 6.0, hz: 0.5, type: 'wall' },
    { id: 'boundary_ceiling', x: -10.25, y: 10.0, z: 0, hx: 18.0, hy: 0.5, hz: 15.0, type: 'ceiling' }
  ],
  spawns: [
    // Alpha Spawns (West Yard, X ~ -21, facing East yaw = 0)
    { id: 'alpha_spawn_1', team: 'alpha', x: -21.0, y: 1.0, z: -6.0, yaw: 0 },
    { id: 'alpha_spawn_2', team: 'alpha', x: -21.0, y: 1.0, z: -3.0, yaw: 0 },
    { id: 'alpha_spawn_3', team: 'alpha', x: -21.0, y: 1.0, z: 0.0, yaw: 0 },
    { id: 'alpha_spawn_4', team: 'alpha', x: -21.0, y: 1.0, z: 3.0, yaw: 0 },
    { id: 'alpha_spawn_5', team: 'alpha', x: -21.0, y: 1.0, z: 6.0, yaw: 0 },

    // Bravo Spawns (East Yard, X ~ 1.5, facing West yaw = Math.PI)
    { id: 'bravo_spawn_1', team: 'bravo', x: 1.5, y: 1.0, z: -4.0, yaw: Math.PI },
    { id: 'bravo_spawn_2', team: 'bravo', x: 1.5, y: 1.0, z: -2.0, yaw: Math.PI },
    { id: 'bravo_spawn_3', team: 'bravo', x: 1.5, y: 1.0, z: 0.0, yaw: Math.PI },
    { id: 'bravo_spawn_4', team: 'bravo', x: 1.5, y: 1.0, z: 2.0, yaw: Math.PI },
    { id: 'bravo_spawn_5', team: 'bravo', x: 1.5, y: 1.0, z: 4.0, yaw: Math.PI },

    // Neutral Fallback Spawns
    { id: 'neutral_spawn_1', team: 'neutral', x: -15.0, y: 1.0, z: -8.0, yaw: 0 },
    { id: 'neutral_spawn_2', team: 'neutral', x: -5.0, y: 1.0, z: 8.0, yaw: Math.PI },
    { id: 'neutral_spawn_3', team: 'neutral', x: -10.0, y: 1.0, z: 0.0, yaw: 0 }
  ]
};
