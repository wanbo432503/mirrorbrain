import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup/mirrorbrain-workspace-env.ts'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**', '.worktrees/**'],
  },
});
