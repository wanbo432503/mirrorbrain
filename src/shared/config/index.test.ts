import { describe, expect, it } from 'vitest';

import { getMirrorBrainConfig } from './index.js';

describe('getMirrorBrainConfig', () => {
  it('returns default sync interval and initial backfill window', () => {
    expect(getMirrorBrainConfig()).toMatchObject({
      sync: {
        pollingIntervalMs: 60 * 60 * 1000,
        initialBackfillHours: 24,
      },
      activityWatch: {
        baseUrl: 'http://127.0.0.1:5600',
      },
      openViking: {
        baseUrl: 'http://127.0.0.1:1933',
      },
    });
  });
});
