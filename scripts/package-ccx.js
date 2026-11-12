/**
 * package-ccx.js - Adobe Premiere Pro UXP Packaging Script
 * Bundles production dist files and manifest.json into com.prismex.editor.ccx
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pluginDir = path.resolve(rootDir, 'plugin');
const distDir = path.resolve(pluginDir, 'dist');
const bundleDir = path.resolve(pluginDir, 'bundle');
const targetCcx = path.resolve(rootDir, 'com.prismex.editor.ccx');

console.log('--- Packaging Prismex UXP Extension (.ccx) ---');

// 1. Ensure plugin is built
if (!fs.existsSync(distDir)) {
  console.log('Building plugin assets...');
  execSync('npm run build', { cwd: pluginDir, stdio: 'inherit' });
}

// 2. Prepare staging bundle folder
if (fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

// Copy manifest.json
fs.copyFileSync(
  path.join(pluginDir, 'manifest.json'),
  path.join(bundleDir, 'manifest.json')
);

// Copy dist contents (index.html & assets)
fs.cpSync(distDir, bundleDir, { recursive: true });

// Copy icons
const iconsTarget = path.join(bundleDir, 'assets', 'icons');
fs.mkdirSync(iconsTarget, { recursive: true });
fs.cpSync(path.join(pluginDir, 'assets', 'icons'), iconsTarget, { recursive: true });

// 3. Zip into .ccx
if (fs.existsSync(targetCcx)) {
  fs.unlinkSync(targetCcx);
}

execSync(`zip -r -q "${targetCcx}" .`, { cwd: bundleDir });

// Clean up staging folder
fs.rmSync(bundleDir, { recursive: true, force: true });

const stats = fs.statSync(targetCcx);
console.log(`✓ Packaging complete!`);
console.log(`✓ Created: com.prismex.editor.ccx (${(stats.size / 1024).toFixed(1)} KB)`);
