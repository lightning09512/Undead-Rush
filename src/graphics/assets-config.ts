export interface AssetConfig {
  name: string;
  path: string;
  scale: number;
  frames?: number; // Number of animation frames
}

export const ASSETS_CONFIG: Record<string, AssetConfig> = {
  // Zombie visuals are drawn by the active procedural renderers. There are no
  // bitmap zombie assets to preload into the CrazyGames build.
};

export class SpriteLoader {
  private images: Map<string, HTMLImageElement> = new Map();
  private whiteImages: Map<string, HTMLCanvasElement> = new Map();
  private loadPromise: Promise<void> | null = null;
  public ready = false;

  /** Start sprite decoding only when the player enters a run. */
  load(): void {
    if (this.ready || this.loadPromise) return;
    this.loadPromise = this.preloadAll();
  }

  private preloadAll(): Promise<void> {
    const loadPromises: Promise<void>[] = [];
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
      loadPromises.push(p);
    }

    return Promise.all(loadPromises).then(() => {
      this.ready = true;
      console.info('Undead Rush sprites ready.');
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
