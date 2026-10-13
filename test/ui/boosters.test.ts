// Booster copy: every booster explains itself on the help page in plain, short sentences.
import { describe, expect, it } from 'vitest';
import { BOOSTER_KEYS } from '../../src/app/contracts';
import { BOOSTER_INFO } from '../../src/ui/boosters';
import { UNLOCKS } from '../../src/content';

describe('BOOSTER_INFO', () => {
  it.each(BOOSTER_KEYS)('%s has help text and a "Use it when" ending', k => {
    const b = BOOSTER_INFO[k];
    expect(b.key).toBe(k);
    expect(b.help).toMatch(/^[A-Z].*\.$/);
    expect(b.help.length).toBeLessThanOrEqual(160);
    // finishes "Use it when …": starts lower case, one sentence
    expect(b.when).toMatch(/^[a-z][^.!?]*\.$/);
    expect(b.when.length).toBeLessThanOrEqual(60);
  });

  it('unlock levels match the level content', () => {
    const fromContent = Object.fromEntries(Object.entries(UNLOCKS).map(([n, k]) => [k, Number(n)]));
    for (const k of BOOSTER_KEYS) expect(BOOSTER_INFO[k].unlock).toBe(fromContent[k]);
  });
});
