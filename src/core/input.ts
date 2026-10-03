// ─── Input: Keyboard + Mouse Aim/Fire + Mobile Twin-Stick ───

import { getTouchActionButtons, type TouchAction } from '../ui/touch-controls';

export class Input {
  touchButtonsEnabled = false;
  // Movement direction (normalized)
  dirX = 0;
  dirY = 0;

  // Raw keyboard state
  private keys: Set<string> = new Set();

  // Mouse aim & fire
  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;
  isMouseDown = false;

  // Left Touch joystick (Movement)
  private leftTouchId: number | null = null;
  private leftStartX = 0;
  private leftStartY = 0;
  private leftCurX = 0;
  private leftCurY = 0;
  private leftActive = false;
  readonly joystickRadius = 55;
  readonly joystickDeadZone = 6;

  // Public joystick position for rendering
  joystickBaseX = 0;
  joystickBaseY = 0;
  joystickKnobX = 0;
  joystickKnobY = 0;
  get isJoystickVisible(): boolean {
    return this.leftActive;
  }

  // Right Touch joystick (Aim & Fire for mobile)
  private rightTouchId: number | null = null;
  private rightStartX = 0;
  private rightStartY = 0;
  private rightCurX = 0;
  private rightCurY = 0;
  rightAimX = 0;
  rightAimY = 0;
  hasTouchAim = false;
  rightTouchActive = false;

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

  // Dash
  private _dashPressed = false;
  get dashPressed() {
    const d = this._dashPressed;
    this._dashPressed = false;
    return d;
  }

  // Reload (Key R)
  private _reloadPressed = false;
  get reloadPressed() {
    const r = this._reloadPressed;
    this._reloadPressed = false;
    return r;
  }

  // Grenade (Key G or Right Click)
  private _grenadePressed = false;
  get grenadePressed() {
    const g = this._grenadePressed;
    this._grenadePressed = false;
    return g;
  }

  // Rage / Overdrive (Key F or Key E)
  private _ragePressed = false;
  get ragePressed() {
    const r = this._ragePressed;
    this._ragePressed = false;
    return r;
  }

  // Weapon slot selection (1, 2, 3)
  private _weaponSelect: number | null = null;
  get weaponSelect(): number | null {
    const w = this._weaponSelect;
    this._weaponSelect = null;
    return w;
  }

  // Mouse wheel weapon cycle (-1 = prev, 1 = next)
  private _wheelDelta = 0;
  get wheelDelta(): number {
    const d = this._wheelDelta;
    this._wheelDelta = 0;
    return d;
  }

  // Active Firing check (Continuous spray: holds true while user clicks or holds fire)
  get isFiring(): boolean {
    return (
      this.isMouseDown ||
      this.rightTouchActive ||
      this.keys.has('Space') ||
      this.keys.has('KeyJ') ||
      this.keys.has('KeyZ')
      || this.fireButtonHeld
    );
  }

  private fireButtonHeld = false;
  private actionTouchId: number | null = null;

  private findActionButton(x: number, y: number): TouchAction | null {
    if (!this.touchButtonsEnabled) return null;
    const buttons = getTouchActionButtons(window.innerWidth, window.innerHeight);
    const button = buttons.find((b) => x >= b.x && x <= b.x + b.size && y >= b.y && y <= b.y + b.size);
    return button?.id || null;
  }

  private activateAction(action: TouchAction): void {
    if (action === 'fire') this.fireButtonHeld = true;
    if (action === 'reload') this._reloadPressed = true;
    if (action === 'grenade') this._grenadePressed = true;
    if (action === 'dash') this._dashPressed = true;
  }

  constructor(canvas: HTMLCanvasElement) {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this._pausePressed = true;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this._dashPressed = true;
      }
      if (e.code === 'KeyR') {
        this._reloadPressed = true;
      }
      if (e.code === 'KeyG') {
        this._grenadePressed = true;
      }
      if (e.code === 'KeyF' || e.code === 'KeyE') {
        this._ragePressed = true;
      }
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        this._weaponSelect = 0;
      }
      if (e.code === 'Digit2' || e.code === 'Numpad2') {
        this._weaponSelect = 1;
      }
      if (e.code === 'Digit3' || e.code === 'Numpad3') {
        this._weaponSelect = 2;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Mouse wheel weapon switching
    window.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY > 0) this._wheelDelta = 1;
        else if (e.deltaY < 0) this._wheelDelta = -1;
      },
      { passive: true }
    );

    // Mouse movement & aiming
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    canvas.addEventListener('mousedown', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (e.button === 0) {
        const action = this.findActionButton(e.clientX, e.clientY);
        if (action) {
          this.activateAction(action);
          return;
        }
        this.isMouseDown = true;
        this._uiClick = { x: e.clientX, y: e.clientY };
      } else if (e.button === 2) {
        // Right click throws grenade
        this._grenadePressed = true;
      }
    });

    // Prevent browser right click menu on game canvas
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
        this.fireButtonHeld = false;
      }
    });

    // Touch: Split screen twin-stick (Left = Move, Right = Aim & Shoot)
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const halfW = window.innerWidth / 2;

      for (const touch of Array.from(e.changedTouches)) {
        const action = this.findActionButton(touch.clientX, touch.clientY);
        if (action && this.actionTouchId === null) {
          this.actionTouchId = touch.identifier;
          this.activateAction(action);
          continue;
        }
        if (touch.clientX < halfW && this.leftTouchId === null) {
          // Left stick: Movement
          this.leftTouchId = touch.identifier;
          this.leftStartX = touch.clientX;
          this.leftStartY = touch.clientY;
          this.leftCurX = touch.clientX;
          this.leftCurY = touch.clientY;
          this.leftActive = true;
          this.joystickBaseX = touch.clientX;
          this.joystickBaseY = touch.clientY;
        } else if (touch.clientX >= halfW && this.rightTouchId === null) {
          // Right stick: Aim & Fire
          this.rightTouchId = touch.identifier;
          this.rightStartX = touch.clientX;
          this.rightStartY = touch.clientY;
          this.rightCurX = touch.clientX;
          this.rightCurY = touch.clientY;
          this.rightTouchActive = true;
          this.mouseX = touch.clientX;
          this.mouseY = touch.clientY;
          this._uiClick = { x: touch.clientX, y: touch.clientY };
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.actionTouchId) {
          this.actionTouchId = null;
          this.fireButtonHeld = false;
        } else if (touch.identifier === this.leftTouchId) {
          this.leftCurX = touch.clientX;
          this.leftCurY = touch.clientY;
        } else if (touch.identifier === this.rightTouchId) {
          this.rightCurX = touch.clientX;
          this.rightCurY = touch.clientY;
          this.mouseX = touch.clientX;
          this.mouseY = touch.clientY;

          const dx = this.rightCurX - this.rightStartX;
          const dy = this.rightCurY - this.rightStartY;
          const dist = Math.hypot(dx, dy);
          if (dist > 8) {
            this.rightAimX = dx / dist;
            this.rightAimY = dy / dist;
            this.hasTouchAim = true;
          }
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.actionTouchId) {
          this.actionTouchId = null;
          this.fireButtonHeld = false;
        } else if (touch.identifier === this.leftTouchId) {
          this.leftTouchId = null;
          this.leftActive = false;
        } else if (touch.identifier === this.rightTouchId) {
          this.rightTouchId = null;
          this.rightTouchActive = false;
          this.hasTouchAim = false;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.leftTouchId = null;
      this.leftActive = false;
      this.actionTouchId = null;
      this.fireButtonHeld = false;
      this.rightTouchId = null;
      this.rightTouchActive = false;
      this.hasTouchAim = false;
    }, { passive: false });
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
    if (this.leftActive && this.leftTouchId !== null) {
      const dx = this.leftCurX - this.leftStartX;
      const dy = this.leftCurY - this.leftStartY;
      const dist = Math.hypot(dx, dy);
      if (dist > this.joystickDeadZone) {
        jx = dx / dist;
        jy = dy / dist;
        const clampedDist = Math.min(dist, this.joystickRadius);
        this.joystickKnobX = this.joystickBaseX + jx * clampedDist;
        this.joystickKnobY = this.joystickBaseY + jy * clampedDist;
      } else {
        this.joystickKnobX = this.joystickBaseX;
        this.joystickKnobY = this.joystickBaseY;
      }
    }

    // Combine
    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
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
