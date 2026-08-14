// Builds a single self-contained HTML page: the four story modes and every role,
// with portraits and fonts inlined so it works offline and on a phone.
// node make-cast-page.js  ->  cast-page.html
const fs = require('fs');
const path = require('path');
const { ROLES, SCRIPTS, FILLER } = require('./roles.js');

global.window = {};
require('./public/art/portraits.js');
const { portraitSVG } = global.window;

// ---- inline only the latin subset of each face (keeps the page small) ----
const cssPath = path.join(__dirname, 'public', 'vendor', 'fonts.css');
const raw = fs.readFileSync(cssPath, 'utf8');
const wantFamilies = ['Epilogue', 'Inter', 'JetBrains Mono'];
let fontCss = '';
for (const block of raw.split('@font-face').slice(1)) {
  const fam = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
  const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
  const src = (block.match(/url\(([^)]+)\)/) || [])[1];
  const weight = (block.match(/font-weight:\s*([^;]+);/) || [])[1] || '400';
  if (!wantFamilies.includes(fam) || !src) continue;
  if (!/U\+0000-00FF/i.test(range)) continue;            // latin subset only
  const file = path.join(__dirname, 'public', 'vendor', src.replace(/['"]/g, ''));
  if (!fs.existsSync(file)) continue;
  const b64 = fs.readFileSync(file).toString('base64');
  fontCss += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${weight.trim()};font-display:swap;`
    + `src:url(data:font/woff2;base64,${b64}) format('woff2');}\n`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MODE_HUE = { amavas: '#98cbff', monsoon: '#e0555f', maya: '#b98cff', agm: '#f5c542' };
const GROUPS = [
  ['Residents', 'villager', 'Good. Each has a power that leaks a little truth — except the Aam Aadmi, who fills out bigger tables.'],
  ['Outsiders', 'outsider', 'Good, and actively inconvenient.'],
  ['Minions', 'minion', 'Evil. They know each other, and the demon.'],
  ['The demon', 'demon', 'Evil. Kill it and good wins.'],
];

function roleCard(name) {
  const r = ROLES[name];
  const evil = r.team === 'evil';
  return `<article class="role ${evil ? 'evil' : 'good'}">
    <div class="pic">${portraitSVG(name, { size: 76 })}</div>
    <div class="txt">
      <h4>${esc(r.icon)} ${esc(name)}</h4>
      <p>${esc(r.blurb)}</p>
    </div>
  </article>`;
}

function modeSection(id, sc, index) {
  const hue = MODE_HUE[id] || '#98cbff';
  // FILLER is dealt in every mode once the table outgrows the unique resident roles,
  // so players really can draw it — it belongs in the rulebook.
  const roster = [...sc.villagers, FILLER, ...sc.outsiders, ...sc.minions, sc.demon];
  const groups = GROUPS.map(([label, kind, note]) => {
    const names = roster.filter(n => ROLES[n].kind === kind);
    if (!names.length) return '';
    return `<section class="group">
      <div class="grouphead"><h3>${label}</h3><p>${esc(note)}</p></div>
      <div class="roles">${names.map(roleCard).join('')}</div>
    </section>`;
  }).join('');
  return `<section class="mode" style="--hue:${hue}" id="${id}">
    <header class="modehead">
      <div class="modemeta">
        <span class="eyebrow">Story mode ${index}</span>
        <h2>${esc(sc.name)}</h2>
        <p class="tag">${esc(sc.tag)}</p>
        <p class="blurb">${esc(sc.blurb)}</p>
        <ul class="facts">
          <li><span>Villain</span><b>${esc(ROLES[sc.demon].icon)} ${esc(sc.demon)}</b></li>
          <li><span>Feel</span><b>${esc(sc.difficulty)}</b></li>
          <li><span>Roles</span><b>${roster.length}</b></li>
        </ul>
      </div>
      <div class="villain">${portraitSVG(sc.demon, { size: 148 })}</div>
    </header>
    ${groups}
  </section>`;
}

const modes = Object.entries(SCRIPTS)
  .map(([id, sc], i) => modeSection(id, sc, i + 1)).join('');

const nav = Object.entries(SCRIPTS).map(([id, sc]) =>
  `<a href="#${id}" style="--hue:${MODE_HUE[id]}"><b>${esc(sc.name)}</b><span>${esc(sc.difficulty)}</span></a>`).join('');

const styleBlock = `<style>
${fontCss}
:root{
  --ground:#0b0d12; --panel:#141720; --panel2:#1b1f2a; --line:#272d3a;
  --ink:#e6e8f0; --dim:#8d95a8; --good:#98cbff; --evil:#ff6f5f; --hue:#98cbff;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{
  background:var(--ground); color:var(--ink);
  font-family:Inter,system-ui,sans-serif; font-size:16px; line-height:1.6;
  padding:0 18px 80px; overflow-x:hidden;
}
body::before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:99;opacity:.5;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
}
.wrap{max-width:680px;margin:0 auto}
.eyebrow{
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:700;
  letter-spacing:.18em;text-transform:uppercase;color:var(--hue);
}
h1,h2,h3,h4{font-family:Epilogue,Georgia,serif;text-wrap:balance;line-height:1.1}

/* hero */
.hero{padding:56px 0 40px;text-align:center;position:relative}
.hero .moon{
  width:150px;height:150px;margin:0 auto 22px;border-radius:50%;
  filter:drop-shadow(0 0 34px rgba(255,111,95,.28));
}
.hero h1{font-size:clamp(44px,15vw,74px);font-weight:800;letter-spacing:-.045em;color:var(--good)}
.hero .sub{
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:700;
  letter-spacing:.34em;text-transform:uppercase;color:var(--dim);margin-top:6px;
}
.hero p.lede{margin:20px auto 0;max-width:44ch;color:var(--dim);font-size:17px}

/* mode nav */
.nav{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:34px 0 8px}
.nav a{
  display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:12px;
  background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--hue);
  text-decoration:none;color:var(--ink);
}
.nav a b{font-family:Epilogue,serif;font-size:16px}
.nav a span{
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;font-weight:700;
  letter-spacing:.14em;text-transform:uppercase;color:var(--hue);
}
.nav a:focus-visible{outline:2px solid var(--hue);outline-offset:3px}

/* how it works */
.how{margin:34px 0 10px;padding:20px;background:var(--panel);border:1px solid var(--line);border-radius:14px}
.how h3{font-size:19px;margin-bottom:10px}
.how ol{list-style:none;display:flex;flex-direction:column;gap:12px;counter-reset:s}
/* grid items are ::before + .step only: a bare text node would become a third
   item and get squeezed into the 26px number column */
.how li{counter-increment:s;display:grid;grid-template-columns:26px minmax(0,1fr);gap:12px;align-items:start}
.how li::before{
  content:counter(s);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:700;
  color:var(--good);border:1px solid var(--line);border-radius:7px;
  display:grid;place-items:center;height:26px;
}
.how .step{color:var(--dim);font-size:15px;min-width:0}
.how b{color:var(--ink);font-weight:600}

/* mode */
.mode{margin-top:64px;scroll-margin-top:16px}
.modehead{
  display:flex;gap:16px;align-items:flex-start;
  padding:22px;border-radius:16px;border:1px solid var(--line);
  background:var(--panel); /* fallback if color-mix is unsupported */
  background:
    radial-gradient(120% 130% at 88% 0%, color-mix(in srgb, var(--hue) 16%, transparent), transparent 62%),
    var(--panel);
}
.modemeta{flex:1;min-width:0}
.modehead h2{font-size:clamp(30px,8vw,40px);font-weight:800;letter-spacing:-.03em;margin-top:6px}
.tag{
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--hue);margin-top:6px;
}
.blurb{margin-top:12px;color:var(--dim);font-size:15.5px}
.villain{
  width:104px;flex:0 0 104px;border-radius:50%;
  filter:drop-shadow(0 0 22px color-mix(in srgb, var(--hue) 34%, transparent));
}
.villain svg{width:100%;height:auto;display:block}
.facts{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.facts li{
  display:flex;flex-direction:column;padding:7px 11px;border-radius:9px;
  background:var(--panel2);border:1px solid var(--line);
}
.facts span{
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;font-weight:700;
  letter-spacing:.14em;text-transform:uppercase;color:var(--dim);
}
.facts b{font-size:14px;font-weight:600}

/* role groups */
.group{margin-top:28px}
.grouphead{border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:14px}
.grouphead h3{
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:700;
  letter-spacing:.18em;text-transform:uppercase;color:var(--ink);
}
.grouphead p{font-size:13px;color:var(--dim);margin-top:3px}
.roles{display:flex;flex-direction:column;gap:10px}
.role{
  display:grid;grid-template-columns:60px 1fr;gap:14px;align-items:start;
  padding:13px;border-radius:13px;background:var(--panel);
  border:1px solid var(--line);border-left:3px solid var(--good);
}
.role.evil{border-left-color:var(--evil)}
.pic{width:60px;border-radius:50%;overflow:hidden}
.pic svg{width:100%;height:auto;display:block}
.role h4{font-size:18px;font-weight:700;color:var(--good)}
.role.evil h4{color:var(--evil)}
.role p{font-size:14.5px;color:var(--dim);margin-top:4px}

footer{
  margin-top:70px;padding-top:22px;border-top:1px solid var(--line);
  text-align:center;color:var(--dim);font-size:13.5px;
}
footer code{
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12.5px;
  color:var(--good);background:var(--panel);padding:2px 7px;border-radius:6px;
}
@media(min-width:620px){
  .modehead{gap:26px;padding:28px}
  .villain{width:148px;flex:0 0 148px}
  .role{grid-template-columns:76px 1fr}
  .pic{width:76px}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

/* PDF export. A narrow page (phone proportions) rather than A4, so the text is
   already the right size when the PDF is opened full-width on a phone. */
@media print{
  @page{size:115mm 200mm;margin:8mm}
  body{
    padding:0;background:var(--ground);
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  body::before{display:none}          /* fixed grain would repeat on every page */
  .wrap{max-width:none}
  .nav{display:none}                  /* jump links earn nothing in a PDF */
  .hero{padding:8px 0 20px}
  .hero .moon{width:120px;height:120px}
  .mode{break-before:page;margin-top:0}
  .role,.modehead,.how li,.facts{break-inside:avoid}
  .grouphead,.modehead{break-after:avoid}
  footer{break-inside:avoid}
}
</style>`;

const bodyHtml = `<title>AMAVAS — Story Modes &amp; Cast</title>
<div class="wrap">
  <header class="hero">
    <div class="moon">${portraitSVG('Rakshasa', { size: 150 })}</div>
    <h1>AMAVAS</h1>
    <p class="sub">The moonless night</p>
    <p class="lede">A social deduction game for 5–20 people in one room. Four story modes,
      ${Object.keys(ROLES).length} roles, one liar you cannot see.</p>
    <nav class="nav">${nav}</nav>
  </header>

  <section class="how">
    <h3>How a game runs</h3>
    <ol>
      <li><span class="step"><b>Everyone joins</b> from their own phone on the house WiFi. The host picks a story mode.</span></li>
      <li><span class="step"><b>Night.</b> Phones down, nobody speaks. Anyone with a night power gets a private prompt.</span></li>
      <li><span class="step"><b>Day.</b> Talk out loud, face to face. Accuse someone; half the living must agree to put them on the block.</span></li>
      <li><span class="step"><b>Dusk.</b> Whoever is on the block is cast out. The dead keep talking, and keep one ghost vote.</span></li>
      <li><span class="step"><b>It ends</b> when the demon dies (good wins) or evil can no longer be stopped.</span></li>
    </ol>
  </section>

  ${modes}

  <footer>
    Run it with <code>node server.js</code>, then open the address it prints on every phone.<br>
    Roles are secret — this page is the rulebook, not a cheat sheet. Read it before you play, not during.
  </footer>
</div>
`;

// The artifact host supplies its own <head>, so this page cannot declare a charset.
// Escaping every non-ASCII character to a numeric entity makes the markup pure ASCII,
// which renders identically no matter what encoding the viewer assumes.
// CSS does not parse HTML entities, so the <style> block is left untouched (it is already ASCII).
const asciify = s => Array.from(s).map(ch => {
  const c = ch.codePointAt(0);
  return c > 127 ? '&#x' + c.toString(16).toUpperCase() + ';' : ch;
}).join('');

const nonAsciiInCss = (styleBlock.match(/[^\x00-\x7F]/g) || []).length;
if (nonAsciiInCss) throw new Error(`style block has ${nonAsciiInCss} non-ASCII chars — entity escaping cannot cover CSS`);

const html = `${styleBlock}\n${asciify(bodyHtml)}`;

fs.writeFileSync(path.join(__dirname, 'cast-page.html'), html);

// site/ is the deployable copy — push it anywhere static (GitHub Pages, Netlify, …)
const site = path.join(__dirname, 'site');
fs.mkdirSync(site, { recursive: true });
fs.writeFileSync(path.join(site, 'index.html'), html);

const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`pure ASCII: ${!/[^\x00-\x7F]/.test(html)}`);
console.log('also wrote site/index.html (deployable)');
console.log(`wrote cast-page.html (${kb} KB, ${Object.keys(ROLES).length} roles, ${Object.keys(SCRIPTS).length} story modes)`);
