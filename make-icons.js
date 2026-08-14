// Builds the app icon (home-screen / PWA) from the Rakshasa portrait.
// Writes public/icon.svg, then renders PNGs with headless Chrome.
// node make-icons.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

global.window = {};
require('./public/art/portraits.js');
const { portraitSVG } = global.window;

const inner = portraitSVG('Rakshasa', { size: 512 })
  .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

// full-bleed square so maskable icons don't crop the face
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="512" height="512">
  <rect width="120" height="120" fill="#111319"/>
  <g transform="translate(60,60) scale(0.82) translate(-60,-60)">${inner}</g>
</svg>`;

const pub = path.join(__dirname, 'public');
fs.writeFileSync(path.join(pub, 'icon.svg'), svg);
console.log('wrote public/icon.svg');

const chrome = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));

if (!chrome) { console.log('Chrome not found — PNG icons skipped (SVG icon still works on Android).'); process.exit(0); }

for (const size of [192, 512, 180]) {
  const out = path.join(pub, size === 180 ? 'icon-180.png' : `icon-${size}.png`);
  execFileSync(chrome, [
    '--headless', '--disable-gpu', '--default-background-color=00000000',
    `--screenshot=${out}`, `--window-size=${size},${size}`,
    'file:///' + path.join(pub, 'icon.svg').replace(/\\/g, '/'),
  ], { stdio: 'ignore' });
  console.log('wrote', path.basename(out), fs.statSync(out).size + ' bytes');
}
