// What the controller's parts (session, tutorial) need from the app around them. Kept apart from controller.ts so
// the pieces depend on a small interface instead of on each other.
import type {
  AdsApi, AnalyticsApi, AudioApi, BoosterKey, ContentApi, GameSceneApi, MetaApi, Point, RewardedPlacement, Settings, UiApi,
} from './contracts';

/** The UI as the app sees it. */
export type AppUi = UiApi;

export interface SessionHost {
  readonly content: ContentApi;
  readonly meta: MetaApi;
  readonly ads: AdsApi;
  readonly analytics: AnalyticsApi;
  readonly audio: AudioApi;
  readonly ui: AppUi;
  readonly scene: GameSceneApi;
  /** Engine steps per second (remote config `beltStepsPerSec`). */
  readonly stepsPerSec: number;
  /** A loss happened since the last win: the interstitial policy never shows an ad right after a loss. */
  lostRecently: boolean;
  now(): number;
  /** Resolves after `sec` of foreground frame time (stops while the app is in the background). */
  wait(sec: number): Promise<void>;
  /** Opens a modal and keeps track of it (back button, debug state). */
  ask<T>(name: string, open: () => Promise<T>): Promise<T>;
  /** Shows a rewarded video; true only when the reward was earned. */
  rewarded(p: RewardedPlacement): Promise<boolean>;
  /** Shows an interstitial if one is loaded; true when one showed. */
  interstitial(): Promise<boolean>;
  offer(kind: 'starter' | 'removeAds'): Promise<void>;
  shop(): Promise<void>;
  settingsChanged(p: Partial<Settings>): void;
  /** Extras for the pause / settings card (the "Privacy choices" button). */
  pauseOptions(): { privacy?: () => void };
  /** Push coins and lives to the HUD. */
  syncHud(): void;
  boosterPoint(k: BoosterKey): Point | null;
  /** Middle of the screen (fallback origin for flying coins). */
  center(): Point;
}
