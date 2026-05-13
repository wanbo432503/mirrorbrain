import type { MirrorBrainConfig } from '../types/index.js';

const DEFAULT_CONFIG: MirrorBrainConfig = {
  sync: {
    pollingIntervalMs: 60 * 60 * 1000,
    initialBackfillHours: 24,
  },
  activityWatch: {
    baseUrl: 'http://127.0.0.1:5600',
  },
  service: {
    host: '127.0.0.1',
    port: 3007,
  },
};

export function getMirrorBrainConfig(): MirrorBrainConfig {
  return DEFAULT_CONFIG;
}
