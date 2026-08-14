// Renders every role portrait into one standalone SVG for review.
// node make-cast-sheet.js  ->  public/art/cast-sheet.svg
const fs = require('fs');
const path = require('path');

global.window = {};
require(path.join(__dirname, 'public', 'art', 'portraits.js'));
const { portraitSVG, ROLE_ART } = global.window;

const OUTSIDERS = ['Old Monk', 'Aghori'];
const groups = [
  ['GOOD — RESIDENTS', Object.keys(ROLE_ART).filter(n => ROLE_ART[n].team === 'good' && !OUTSIDERS.includes(n))],
  ['GOOD — OUTSIDERS', OUTSIDERS],
  ['EVIL', Object.keys(ROLE_ART).filter(n => ROLE_ART[n].team === 'evil')],
];

const COLS = 4, CELL = 190, TOP = 96, HEAD = 54;
let y = TOP, body = '';

for (const [title, names] of groups) {
  body += `<text x="40" y="${y}" fill="#8b949e" font-family="JetBrains Mono, monospace" font-size="14"
    letter-spacing="4" font-weight="700">${title}</text>`;
  y += 24;
  names.forEach((n, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = 40 + col * CELL, cy = y + row * CELL;
    const inner = portraitSVG(n, { size: 140 }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    body += `<g transform="translate(${x},${cy})">
      <rect x="-8" y="-8" width="156" height="186" rx="14" fill="#1e1f26" stroke="#30363d" stroke-width="2"/>
      <svg x="0" y="0" width="140" height="140" viewBox="0 0 120 120">${inner}</svg>
      <text x="70" y="162" text-anchor="middle" fill="#e1e4e8" font-family="Epilogue, Georgia, serif"
        font-size="15" font-weight="700">${n}</text></g>`;
  });
  y += Math.ceil(names.length / COLS) * CELL + HEAD;
}

const H = y + 20;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${40 + COLS * CELL + 20}" height="${H}"
  viewBox="0 0 ${40 + COLS * CELL + 20} ${H}">
  <rect width="100%" height="100%" fill="#111319"/>
  <text x="40" y="52" fill="#98cbff" font-family="Epilogue, Georgia, serif" font-size="34"
    font-weight="800" letter-spacing="-1">AMAVAS — the cast</text>
  <text x="40" y="74" fill="#8b949e" font-family="JetBrains Mono, monospace" font-size="12"
    letter-spacing="2">CARTOON-SPOOKY · 15 ROLES</text>
  ${body}
</svg>`;

fs.writeFileSync(path.join(__dirname, 'public', 'art', 'cast-sheet.svg'), svg);
console.log('wrote public/art/cast-sheet.svg');
