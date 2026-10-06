import { describe, expect, it, vi } from 'vitest';
import { ads, analytics, platform, purchases, remoteConfig } from '../../src/services';

describe('services index (web build)', () => {
  it('wires the web mocks', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(platform.native).toBe(false);
    expect(platform.os).toBe('web');
    expect(purchases.mode).toBe('mock');
    await remoteConfig.init();
    expect(remoteConfig.get('beltStepsPerSec', 0)).toBe(36);
    expect(remoteConfig.get('interstitialEnabled', false)).toBe(true);
    await ads.init();
    await purchases.init();
    expect((await purchases.products()).length).toBe(7);
    expect(typeof analytics.setSink).toBe('function');
    vi.restoreAllMocks();
  });
});
