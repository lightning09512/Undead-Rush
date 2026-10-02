// ─── Input: Keyboard + Touch Joystick ───

export class Input {
  // Movement direction (normalized)
  dirX = 0;
  dirY = 0;

  // Raw keyboard state
  private keys: Set<string> = new Set();

  // Touch joystick
  private touchId: number | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchCurrentX = 0;
  private touchCurrentY = 0;
  private joystickActive = false;
  readonly joystickRadius = 60;
  readonly joystickDeadZone = 8;

  // Public joystick position for rendering
  joystickBaseX = 0;
  joystickBaseY = 0;
  joystickKnobX = 0;
  joystickKnobY = 0;
  get isJoystickVisible(): boolean {
    return this.joystickActive;
  }

  // UI click/tap
  private _uiClick: { x: number; y: number } | null = null;
  get uiClick() {
    const c = this._uiClick;
    this._uiClick = null;
    return c;
  }

  // Pause
  private _pausePressed = false;
  get pausePressed() {
    const p = this._pausePressed;
    this._pausePressed = false;
    return p;
  }

  constructor(canvas: HTMLCanvasElement) {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this._pausePressed = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (this.touchId === null) {
          this.touchId = touch.identifier;
          this.touchStartX = touch.clientX;
          this.touchStartY = touch.clientY;
          this.touchCurrentX = touch.clientX;
          this.touchCurrentY = touch.clientY;
          this.joystickActive = true;
          this.joystickBaseX = touch.clientX;
          this.joystickBaseY = touch.clientY;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.touchId) {
          this.touchCurrentX = touch.clientX;
          this.touchCurrentY = touch.clientY;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.touchId) {
          this.touchId = null;
          this.joystickActive = false;
        }
      }
    }, { passive: false });

    // Mouse click for UI
    canvas.addEventListener('mousedown', (e) => {
      this._uiClick = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this._uiClick = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });
  }

  update(): void {
    // Keyboard input
    let kx = 0, ky = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;

    // Touch joystick input
    let jx = 0, jy = 0;
    if (this.joystickActive && this.touchId !== null) {
      const dx = this.touchCurrentX - this.touchStartX;
      const dy = this.touchCurrentY - this.touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this.joystickDeadZone) {
        jx = dx / dist;
        jy = dy / dist;
        // Clamp knob position
        const clampedDist = Math.min(dist, this.joystickRadius);
        this.joystickKnobX = this.joystickBaseX + jx * clampedDist;
        this.joystickKnobY = this.joystickBaseY + jy * clampedDist;
      } else {
        this.joystickKnobX = this.joystickBaseX;
        this.joystickKnobY = this.joystickBaseY;
      }
    }

    // Combine - keyboard takes priority
    if (kx !== 0 || ky !== 0) {
      const len = Math.sqrt(kx * kx + ky * ky);
      this.dirX = kx / len;
      this.dirY = ky / len;
    } else if (jx !== 0 || jy !== 0) {
      this.dirX = jx;
      this.dirY = jy;
    } else {
      this.dirX = 0;
      this.dirY = 0;
    }
  }
}
