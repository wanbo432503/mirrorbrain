import { spawn } from 'node:child_process';
import { join } from 'node:path';

const projectDir = process.cwd();
const reactAppDir = join(projectDir, 'src', 'apps', 'mirrorbrain-web-react');
const vitePath = join(reactAppDir, 'node_modules', '.bin', 'vite');

console.log('Building React webui for production...');

const buildProcess = spawn(vitePath, ['build'], {
  cwd: reactAppDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
  },
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✓ React webui built successfully');
    console.log('Output: src/apps/mirrorbrain-web-react/dist/');
  } else {
    console.error('✗ Build failed with exit code:', code);
    process.exit(code ?? 1);
  }
});