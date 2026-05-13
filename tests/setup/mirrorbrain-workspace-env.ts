import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.MIRRORBRAIN_WORKSPACE_DIR ??= mkdtempSync(
  join(tmpdir(), 'mirrorbrain-vitest-workspace-'),
);
