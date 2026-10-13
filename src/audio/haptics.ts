// Haptics through @capacitor/haptics, on the phone only. On the web this does nothing (no navigator.vibrate:
// desktop browsers ignore it and Android Chrome's buzz is too coarse for a calm game).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { HapticKind } from './logic';

let native: boolean | null = null;
export const isNative = (): boolean => (native ??= (() => { try { return Capacitor.isNativePlatform(); } catch { return false; } })());

export function buzz(kind: HapticKind): void {
  if (!isNative()) return;
  const p = kind === 'light' ? Haptics.impact({ style: ImpactStyle.Light })
    : kind === 'medium' ? Haptics.impact({ style: ImpactStyle.Medium })
    : Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Warning });
  p.catch(() => { /* a missing haptic never matters */ });
}
