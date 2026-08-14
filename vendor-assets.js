// Downloads Tailwind + fonts into public/vendor so AMAVAS works with NO INTERNET.
// Game night runs on a house WiFi that may have no uplink — the app must not depend on CDNs.
// Run once (needs internet):  node vendor-assets.js
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const OUT = path.join(__dirname, 'public', 'vendor');
const FONTS = path.join(OUT, 'fonts');
fs.mkdirSync(FONTS, { recursive: true });

const get = async (url, asText) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return asText ? r.text() : Buffer.from(await r.arrayBuffer());
};

async function fontCss(url, label) {
  let css = await get(url, true);
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])];
  console.log(`  ${label}: ${urls.length} font files`);
  for (const u of urls) {
    const name = u.split('/').slice(-3).join('-').replace(/[^\w.-]/g, '');
    fs.writeFileSync(path.join(FONTS, name), await get(u));
    css = css.split(u).join('fonts/' + name);
  }
  return css;
}

(async () => {
  console.log('Vendoring Tailwind…');
  fs.writeFileSync(path.join(OUT, 'tailwind.js'),
    await get('https://cdn.tailwindcss.com/3.4.16?plugins=forms', true));

  console.log('Vendoring fonts…');
  const a = await fontCss('https://fonts.googleapis.com/css2?family=Epilogue:wght@600;700;800&family=Inter:wght@400;500&family=JetBrains+Mono:wght@500;700&display=swap', 'text');
  const b = await fontCss('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block', 'icons');
  fs.writeFileSync(path.join(OUT, 'fonts.css'), a + '\n' + b);

  console.log('Done — public/vendor is self-contained. AMAVAS now runs offline.');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
