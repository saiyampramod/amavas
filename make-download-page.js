// Wraps the generated PDF in a self-contained page with a download button,
// so it can be published as an artifact and saved from a phone.
// node make-download-page.js  ->  download-page.html
const fs = require('fs');
const path = require('path');

const PDF = path.join(__dirname, 'AMAVAS-story-modes.pdf');
const pdf = fs.readFileSync(PDF);
const b64 = pdf.toString('base64');
const mb = (pdf.length / 1024 / 1024).toFixed(1);

const html = `<title>AMAVAS &mdash; Download the rulebook</title>
<style>
:root{
  --ground:#0b0d12; --panel:#141720; --line:#272d3a;
  --ink:#e6e8f0; --dim:#8d95a8; --good:#98cbff; --evil:#ff6f5f;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{
  background:var(--ground); color:var(--ink); min-height:100dvh;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  line-height:1.6; padding:34px 20px 60px;
  display:flex; align-items:center; justify-content:center;
}
.card{width:100%;max-width:460px;text-align:center}
.moon{
  width:118px;height:118px;margin:0 auto 20px;border-radius:50%;
  background:radial-gradient(circle at 50% 42%, rgba(255,111,95,.34), transparent 66%), var(--panel);
  border:1px solid var(--line); display:grid; place-items:center; font-size:56px;
}
h1{font-size:38px;font-weight:800;letter-spacing:-.035em;color:var(--good);line-height:1.05}
.sub{
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;
  letter-spacing:.3em;text-transform:uppercase;color:var(--dim);margin-top:8px;
}
p.lede{color:var(--dim);margin-top:18px;font-size:16px}
.meta{
  display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:20px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;
  letter-spacing:.12em;text-transform:uppercase;
}
.meta span{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 12px;color:var(--dim)}
a.btn,button.btn{
  display:flex;align-items:center;justify-content:center;gap:9px;width:100%;
  margin-top:26px;padding:17px 20px;border-radius:14px;border:0;cursor:pointer;
  background:var(--good);color:#00243f;font:inherit;font-size:17px;font-weight:700;
  text-decoration:none;-webkit-appearance:none;
}
a.ghost{
  background:transparent;color:var(--ink);border:1px solid var(--line);
  font-size:15px;font-weight:600;margin-top:11px;
}
a.btn:active,button.btn:active{transform:scale(.99)}
a:focus-visible,button:focus-visible{outline:2px solid var(--good);outline-offset:3px}
.note{color:var(--dim);font-size:13.5px;margin-top:22px}
.note b{color:var(--ink);font-weight:600}
</style>

<div class="card">
  <div class="moon">&#x1F311;</div>
  <h1>AMAVAS</h1>
  <p class="sub">The rulebook</p>
  <p class="lede">Four story modes, 33 roles, and how a night runs &mdash; the whole thing as a PDF you can keep.</p>
  <div class="meta"><span>PDF</span><span>22 pages</span><span>${mb} MB</span></div>

  <button class="btn" id="dl">&#x2B07;&#xFE0F; Download the PDF</button>
  <a class="btn ghost" id="open" href="#" rel="noopener">Open it here instead</a>

  <p class="note">On iPhone the file lands in <b>Files &rarr; Downloads</b>. If it opens in a viewer
  instead of saving, use the share button and pick <b>Save to Files</b>.</p>
</div>

<script type="text/plain" id="pdfdata">${b64}</script>
<script>
(function(){
  var b64 = document.getElementById('pdfdata').textContent.trim();
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var blob = new Blob([bytes], { type: 'application/pdf' });
  var url = URL.createObjectURL(blob);
  var name = 'AMAVAS-story-modes.pdf';

  document.getElementById('open').href = url;
  document.getElementById('open').target = '_blank';

  document.getElementById('dl').addEventListener('click', function(){
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
</script>
`;

fs.writeFileSync(path.join(__dirname, 'download-page.html'), html);
console.log(`wrote download-page.html (${Math.round(Buffer.byteLength(html) / 1024 / 1024 * 10) / 10} MB, wrapping a ${mb} MB PDF)`);
