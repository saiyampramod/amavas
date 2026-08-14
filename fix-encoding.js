// One-off repair: a PowerShell round-trip read these UTF-8 files as Windows-1252,
// turning "—" into "â€”" and every emoji into 4 stray characters.
// Reverses only runs that decode back to VALID UTF-8, so correctly-encoded
// characters elsewhere in the file are left untouched.  node fix-encoding.js <file...>
const fs = require('fs');

const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B,
  0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94,
  0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A,
  0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };

const toByte = ch => {
  const c = ch.codePointAt(0);
  if (c in CP1252) return CP1252[c];
  if (c <= 0xFF) return c;
  return null;
};

const strict = new TextDecoder('utf-8', { fatal: true });

function repair(text) {
  let out = '', run = '';
  const flush = () => {
    if (!run) return;
    const bytes = [...run].map(toByte);
    if (run.length > 1 && bytes.every(b => b !== null)) {
      try { out += strict.decode(Uint8Array.from(bytes)); run = ''; return; } catch { /* not mojibake */ }
    }
    out += run; run = '';
  };
  for (const ch of text) {
    const b = toByte(ch);
    if (b !== null && b >= 0x80) run += ch;
    else { flush(); out += ch; }
  }
  flush();
  return out;
}

for (const file of process.argv.slice(2)) {
  let t = fs.readFileSync(file, 'utf8');
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);          // strip BOM
  const fixed = repair(t);
  fs.writeFileSync(file, fixed, 'utf8');
  const left = (fixed.match(/Â|â€|ð[ŸŒ]/g) || []).length;
  console.log(`${file}: repaired, ${left} suspicious sequence(s) remaining`);
}
