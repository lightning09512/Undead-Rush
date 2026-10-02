// ─── Ad Wrapper Module (Stubs) ───
// Easy to swap for CrazyGames / Poki SDK later.
// No actual ads during gameplay.

export type AdPlacement = 'revive' | 'double_gold' | 'reroll_upgrades';

export interface AdCallbacks {
  onRewarded: (placement: AdPlacement) => void;
  onSkipped: (placement: AdPlacement) => void;
  onError: (placement: AdPlacement, error: string) => void;
}

class AdWrapper {
  private initialized = false;
  private callbacks: AdCallbacks | null = null;

  /** Initialize the ad SDK (stub: always succeeds) */
  init(callbacks: AdCallbacks): void {
    this.callbacks = callbacks;
    this.initialized = true;
    console.log('[Ads] Ad wrapper initialized (stub mode)');
  }

  /** Check if ads are available */
  isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * Show a rewarded ad.
   * In stub mode, this immediately triggers the reward callback.
   * Replace the body of this method with actual SDK calls.
   */
  showRewarded(placement: AdPlacement): void {
    if (!this.initialized || !this.callbacks) {
      console.warn('[Ads] Not initialized');
      return;
    }

    console.log(`[Ads] Showing rewarded ad for: ${placement}`);

    // ─── STUB: Simulate ad completion after a short delay ───
    // In production, replace with:
    //   CrazyGames: window.CrazyGames.SDK.ad.requestAd('rewarded', ...)
    //   Poki: PokiSDK.rewardedBreak().then(...)
    setTimeout(() => {
      console.log(`[Ads] Rewarded ad completed for: ${placement}`);
      this.callbacks!.onRewarded(placement);
    }, 500);
  }

  /**
   * Notify the SDK that gameplay is starting (pause ads).
   * Called automatically when a run begins.
   */
  gameplayStart(): void {
    console.log('[Ads] Gameplay started - ads paused');
    // CrazyGames: window.CrazyGames.SDK.game.gameplayStart()
    // Poki: PokiSDK.gameplayStart()
  }

  /**
   * Notify the SDK that gameplay has stopped.
   * Called automatically on game over / pause.
   */
  gameplayStop(): void {
    console.log('[Ads] Gameplay stopped - ads enabled');
    // CrazyGames: window.CrazyGames.SDK.game.gameplayStop()
    // Poki: PokiSDK.gameplayStop()
  }

  /**
   * Show an interstitial ad (between runs).
   * Stub: does nothing.
   */
  showInterstitial(): void {
    console.log('[Ads] Interstitial ad requested (stub: skipped)');
    // CrazyGames: window.CrazyGames.SDK.ad.requestAd('midgame', ...)
    // Poki: PokiSDK.commercialBreak()
  }
}

// Singleton
export const adWrapper = new AdWrapper();
