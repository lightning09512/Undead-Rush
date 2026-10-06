// ─── Ad Wrapper ───
// The project has no configured ad provider. Rewarded placements stay unavailable
// until a real SDK is integrated; never simulate a completed ad or grant rewards.

export type AdPlacement = 'revive';

export interface AdCallbacks {
  onRewarded: (placement: AdPlacement) => void;
  onSkipped: (placement: AdPlacement) => void;
  onError: (placement: AdPlacement, error: string) => void;
}

class AdWrapper {
  private initialized = false;
  private callbacks: AdCallbacks | null = null;

  /** Register callbacks. This does not imply that an ad provider is configured. */
  init(callbacks: AdCallbacks): void {
    this.callbacks = callbacks;
    this.initialized = true;
  }

  /** No ad SDK is configured in this build. */
  isAvailable(): boolean {
    return false;
  }

  /** Fail closed until a real rewarded-ad provider is integrated. */
  showRewarded(placement: AdPlacement): void {
    if (!this.initialized || !this.callbacks) {
      console.warn('[Ads] Rewarded ad requested before initialization');
      return;
    }
    this.callbacks.onError(placement, 'not_configured');
  }

  /** Provider lifecycle hooks are intentionally inert until an SDK is configured. */
  gameplayStart(): void {}
  gameplayStop(): void {}
  showInterstitial(): void {}
}

// Singleton
export const adWrapper = new AdWrapper();
