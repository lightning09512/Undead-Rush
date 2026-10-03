import playerImg from '../assets/hero.png';
import zombieNormalImg from '../assets/normal_zombie-removebg-preview.png';
import zombieRunnerImg from '../assets/runner-removebg-preview.png';
import zombieTankImg from '../assets/Tank-removebg-preview.png';
import zombieBossImg from '../assets/Boss-removebg-preview.png';
import zombieExploderImg from '../assets/Exploder-removebg-preview.png';
import zombieSpitterImg from '../assets/Spitter-removebg-preview.png';
import zombieGlowingImg from '../assets/Glowing-removebg-preview.png';

export interface AssetConfig {
  name: string;
  path: string;
  scale: number;
  frames?: number; // Number of animation frames
}

export const ASSETS_CONFIG: Record<string, AssetConfig> = {
  // Entities
  'player': { name: 'player', path: playerImg, scale: 64 },
  'zombie_normal': { name: 'zombie_normal', path: zombieNormalImg, scale: 64 },
  'zombie_runner': { name: 'zombie_runner', path: zombieRunnerImg, scale: 54 },
  'zombie_tank': { name: 'zombie_tank', path: zombieTankImg, scale: 105 },
  'zombie_boss': { name: 'zombie_boss', path: zombieBossImg, scale: 195 },
  'zombie_exploder': { name: 'zombie_exploder', path: zombieExploderImg, scale: 75 },
  'zombie_spitter': { name: 'zombie_spitter', path: zombieSpitterImg, scale: 64 },
  'zombie_glowing': { name: 'zombie_glowing', path: zombieGlowingImg, scale: 64 },

  // Props
  'crate': { name: 'crate', path: '/assets/crate.png', scale: 40 },
  'rock': { name: 'rock', path: '/assets/rock.png', scale: 35 },
  'log': { name: 'log', path: '/assets/log.png', scale: 50 },
  'bush': { name: 'bush', path: '/assets/bush.png', scale: 60 },

  // Pickups
  'gem_blue': { name: 'gem_blue', path: '/assets/gem_blue.png', scale: 15 },
  'gem_green': { name: 'gem_green', path: '/assets/gem_green.png', scale: 18 },
  'gem_yellow': { name: 'gem_yellow', path: '/assets/gem_yellow.png', scale: 22 },
  'chest': { name: 'chest', path: '/assets/chest.png', scale: 30 },
  'medkit': { name: 'medkit', path: '/assets/medkit.png', scale: 25 },
  'magnet': { name: 'magnet', path: '/assets/magnet.png', scale: 25 },
};

export class SpriteLoader {
  private images: Map<string, HTMLImageElement> = new Map();
  private whiteImages: Map<string, HTMLCanvasElement> = new Map();
  private loadPromises: Promise<void>[] = [];
  public ready = false;

  constructor() {
    this.preloadAll();
  }

  private preloadAll() {
    for (const key in ASSETS_CONFIG) {
      const config = ASSETS_CONFIG[key];
      const img = new Image();
      const p = new Promise<void>((resolve) => {
        img.onload = () => {
          this.images.set(key, img);

          // Pre-cache white silhouette canvas for crisp damage flash
          try {
            const wCanvas = document.createElement('canvas');
            wCanvas.width = img.width;
            wCanvas.height = img.height;
            const wctx = wCanvas.getContext('2d');
            if (wctx) {
              wctx.drawImage(img, 0, 0);
              wctx.globalCompositeOperation = 'source-in';
              wctx.fillStyle = '#ffffff';
              wctx.fillRect(0, 0, img.width, img.height);
              this.whiteImages.set(key, wCanvas);
            }
          } catch {
            // In case of CORS or canvas security restrictions, silently fallback
          }

          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load sprite: ${config.path}`);
          resolve(); // Resolve anyway so we can fallback
        };
        img.src = config.path;
      });
      this.loadPromises.push(p);
    }

    Promise.all(this.loadPromises).then(() => {
      this.ready = true;
      console.log('All sprites loaded (or failed gracefully).');
    });
  }

  getImage(key: string): HTMLImageElement | null {
    return this.images.get(key) || null;
  }

  getWhiteImage(key: string): HTMLCanvasElement | null {
    return this.whiteImages.get(key) || null;
  }
}

export const spriteLoader = new SpriteLoader();
