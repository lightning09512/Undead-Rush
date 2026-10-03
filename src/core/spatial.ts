// ─── Spatial Hash Grid for fast collision queries ───

export interface Bounded {
  x: number;
  y: number;
  size: number; // radius
}

export class SpatialGrid<T extends Bounded> {
  private cellSize: number;
  private cells: Map<number, T[]> = new Map();
  private _queryResult: T[] = [];
  private bucketPool: T[][] = [];
  private seen = new Set<T>();

  constructor(cellSize = 64) {
    this.cellSize = cellSize;
  }

  clear(): void {
    // Recycle the cell arrays: the grid is rebuilt every frame, so clearing the
    // map alone used to allocate hundreds of fresh arrays on every update.
    for (const cell of this.cells.values()) {
      cell.length = 0;
      this.bucketPool.push(cell);
    }
    this.cells.clear();
  }

  private key(cx: number, cy: number): number {
    // Cantor pairing - works for negative coords too with offset
    const a = cx + 10000;
    const b = cy + 10000;
    return a * 20001 + b;
  }

  insert(obj: T): void {
    const r = obj.size;
    const minCX = Math.floor((obj.x - r) / this.cellSize);
    const maxCX = Math.floor((obj.x + r) / this.cellSize);
    const minCY = Math.floor((obj.y - r) / this.cellSize);
    const maxCY = Math.floor((obj.y + r) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const k = this.key(cx, cy);
        let cell = this.cells.get(k);
        if (!cell) {
          cell = this.bucketPool.pop() || [];
          this.cells.set(k, cell);
        }
        cell.push(obj);
      }
    }
  }

  /** Query all objects that could overlap with the circle (x,y,radius) */
  query(x: number, y: number, radius: number): T[] {
    this._queryResult.length = 0;
    this.seen.clear();

    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (cell) {
          for (const obj of cell) {
            if (!this.seen.has(obj)) {
              this.seen.add(obj);
              this._queryResult.push(obj);
            }
          }
        }
      }
    }

    return this._queryResult;
  }

  /** Circle vs circle collision test */
  static circlesOverlap(a: Bounded, b: Bounded): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = dx * dx + dy * dy;
    const radii = a.size + b.size;
    return dist < radii * radii;
  }

  static distance(a: Bounded, b: Bounded): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
