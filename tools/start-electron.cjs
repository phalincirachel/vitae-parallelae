const { spawn } = require('child_process');
const path = require('path');

const electronBinary = require('electron');
const projectRoot = path.resolve(__dirname, '..');
const args = [projectRoot, ...process.argv.slice(2)];
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, args, {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  windowsHide: false
});

child.on('error', (error) => {
  console.error('[Electron start] Failed to launch Electron:', error);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (code === null) {
    console.error('[Electron start] Electron exited with signal', signal);
    process.exit(1);
  }
  process.exit(code);
});
