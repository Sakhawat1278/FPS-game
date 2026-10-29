export interface Keybindings {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  crouch: string;
  sprint: string;
  reload: string;
  swapWeapon: string;
  slot1: string;
  slot2: string;
  scoreboard: string;
}

export interface CrosshairSettings {
  style: 'cross' | 'dot' | 'circle';
  color: string;
  size: number;
  thickness: number;
  gap: number;
  opacity: number;
}

export interface GameSettings {
  controls: {
    sensitivity: number;
    adsMultiplier: number;
    invertY: boolean;
    toggleAds: boolean;
    toggleCrouch: boolean;
    bindings: Keybindings;
  };
  video: {
    fov: number;
    preset: 'low' | 'medium' | 'high' | 'ultra' | 'auto';
    bloom: boolean;
    shadows: boolean;
  };
  audio: {
    master: number;
    sfx: number;
    footsteps: number;
    hit: number;
  };
  crosshair: CrosshairSettings;
  accessibility: {
    colorBlindMode: 'none' | 'deuteranopia' | 'protanopia';
    hudScale: number;
  };
}

export const DEFAULT_SETTINGS: GameSettings = {
  controls: {
    sensitivity: 2.2,
    adsMultiplier: 0.8,
    invertY: false,
    toggleAds: false,
    toggleCrouch: false,
    bindings: {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      jump: 'Space',
      crouch: 'ControlLeft',
      sprint: 'ShiftLeft',
      reload: 'KeyR',
      swapWeapon: 'KeyQ',
      slot1: 'Digit1',
      slot2: 'Digit2',
      scoreboard: 'Tab'
    }
  },
  video: {
    fov: 90,
    preset: 'high',
    bloom: true,
    shadows: true
  },
  audio: {
    master: 1.0,
    sfx: 0.9,
    footsteps: 0.75,
    hit: 0.9
  },
  crosshair: {
    style: 'cross',
    color: '#38bdf8',
    size: 14,
    thickness: 2,
    gap: 6,
    opacity: 1.0
  },
  accessibility: {
    colorBlindMode: 'none',
    hudScale: 1.0
  }
};

export class SettingsManager {
  private static STORAGE_KEY = 'warehouse_strike_game_settings';
  public current: GameSettings;
  private listeners: Array<(settings: GameSettings) => void> = [];

  constructor() {
    this.current = this.load();
  }

  public load(): GameSettings {
    try {
      const raw = localStorage.getItem(SettingsManager.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          controls: { ...DEFAULT_SETTINGS.controls, ...(parsed.controls || {}) },
          video: { ...DEFAULT_SETTINGS.video, ...(parsed.video || {}) },
          audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio || {}) },
          crosshair: { ...DEFAULT_SETTINGS.crosshair, ...(parsed.crosshair || {}) },
          accessibility: { ...DEFAULT_SETTINGS.accessibility, ...(parsed.accessibility || {}) }
        };
      }
    } catch (e) {
      console.warn('[SettingsManager] Failed to parse settings, using defaults');
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  public save() {
    try {
      localStorage.setItem(SettingsManager.STORAGE_KEY, JSON.stringify(this.current));
      this.notify();
    } catch (e) {
      console.error('[SettingsManager] Failed to save settings:', e);
    }
  }

  public resetDefaults() {
    this.current = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.save();
  }

  public subscribe(fn: (settings: GameSettings) => void) {
    this.listeners.push(fn);
    fn(this.current);
  }

  private notify() {
    for (const fn of this.listeners) {
      fn(this.current);
    }
  }
}

export const settingsManager = new SettingsManager();

