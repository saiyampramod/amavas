/* AMAVAS — cartoon-spooky character portraits.
   One shared template (thick ink outlines, flat fills, team-tinted glow) with
   per-role hair, eyes, facial hair and props so all 15 read as one cast.
   window.portraitSVG(roleName, {size}) -> svg string
   window.genericAvatar(name, {size}) -> svg string (unknown player, roles are secret) */
(function () {
  const INK = '#12101c';
  const GOOD = '#98cbff';
  const EVIL = '#ff6f5f';

  const S = {
    light: '#e9bd96', mid: '#cb9260', deep: '#a06a3e',
    ash: '#c3bccb', green: '#93c48d', demon: '#8e3350', pale: '#d8cfc4',
  };

  const ln = (d, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w || 3}" stroke-linecap="round"/>`;
  const fl = (d, f, w) => `<path d="${d}" fill="${f}" stroke="${INK}" stroke-width="${w || 3}" stroke-linejoin="round"/>`;

  // ---------- shared body parts ----------
  const ears = s => `<ellipse cx="31" cy="56" rx="6" ry="8" fill="${s}" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="89" cy="56" rx="6" ry="8" fill="${s}" stroke="${INK}" stroke-width="3"/>`;

  const head = s => fl('M60 20 C79 20 91 33 91 53 C91 75 79 89 60 89 C41 89 29 75 29 53 C29 33 41 20 60 20 Z', s);

  const shoulders = c => fl('M22 120 C22 102 38 92 60 92 C82 92 98 102 98 120 Z', c);

  const nose = () => ln('M60 56 C57 64 57 68 60 70');

  // ---------- eyes ----------
  const E = {
    normal: () => `<ellipse cx="48" cy="53" rx="8" ry="6.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="72" cy="53" rx="8" ry="6.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="49" cy="54" r="3.2" fill="${INK}"/><circle cx="73" cy="54" r="3.2" fill="${INK}"/>`,
    glow: c => `<ellipse cx="48" cy="53" rx="8" ry="6.5" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="72" cy="53" rx="8" ry="6.5" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="48" cy="53" rx="2.6" ry="5" fill="${INK}"/><ellipse cx="72" cy="53" rx="2.6" ry="5" fill="${INK}"/>`,
    tired: () => `<ellipse cx="48" cy="53" rx="8" ry="5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="72" cy="53" rx="8" ry="5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="48" cy="54" r="2.6" fill="${INK}"/><circle cx="72" cy="54" r="2.6" fill="${INK}"/>
      ${ln('M40 45 C44 42 52 42 56 45', 2.5)}${ln('M64 45 C68 42 76 42 80 45', 2.5)}`,
    drunk: () => `<ellipse cx="48" cy="53" rx="8" ry="6.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="72" cy="53" rx="8" ry="6.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="45" cy="56" r="3" fill="${INK}"/><circle cx="76" cy="51" r="3" fill="${INK}"/>`,
    wide: () => `<circle cx="48" cy="53" r="9" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="72" cy="53" r="9" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="48" cy="53" r="3" fill="${INK}"/><circle cx="72" cy="53" r="3" fill="${INK}"/>`,
    shades: () => `${fl('M36 47 H84 V56 C84 62 78 64 72 64 C66 64 63 60 62 55 H58 C57 60 54 64 48 64 C42 64 36 62 36 56 Z', '#1b2430', 3)}
      ${ln('M40 51 C44 49 48 49 51 51', 2)}`,
    sly: () => `<ellipse cx="48" cy="53" rx="8" ry="5.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="72" cy="53" rx="8" ry="5.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="51" cy="54" r="3" fill="${INK}"/><circle cx="75" cy="54" r="3" fill="${INK}"/>
      ${ln('M39 44 C45 40 53 41 57 45', 3)}${ln('M63 45 C67 41 75 40 81 44', 3)}`,
    lashes: () => `<ellipse cx="48" cy="53" rx="8.5" ry="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="72" cy="53" rx="8.5" ry="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="48" cy="54" r="3.2" fill="${INK}"/><circle cx="72" cy="54" r="3.2" fill="${INK}"/>
      ${ln('M38 48 L34 45', 2.5)}${ln('M82 48 L86 45', 2.5)}`,
    closedDream: () => `${ln('M40 54 C44 49 52 49 56 54', 3)}${ln('M64 54 C68 49 76 49 80 54', 3)}
      ${ln('M84 40 C88 36 88 32 84 30', 2)}${ln('M90 46 C94 42 94 38 90 36', 2)}`,
  };

  const brows = (d1, d2) => ln(d1) + ln(d2);
  const angryBrows = () => brows('M39 43 C45 39 53 40 57 44', 'M81 43 C75 39 67 40 63 44');
  const calmBrows = () => brows('M40 43 C45 40 52 40 56 42', 'M80 43 C75 40 68 40 64 42');

  // ---------- mouths ----------
  const M = {
    smile: () => ln('M50 75 C56 80 64 80 70 75'),
    flat: () => ln('M52 76 H68'),
    frown: () => ln('M50 78 C56 73 64 73 70 78'),
    smirk: () => ln('M50 76 C57 80 66 78 70 73'),
    fangs: () => `${fl('M45 72 C52 82 68 82 75 72 C72 86 48 86 45 72 Z', '#3a1020', 3)}
      <path d="M50 74 L54 82 L58 74 Z" fill="#fff8e7"/><path d="M62 74 L66 82 L70 74 Z" fill="#fff8e7"/>`,
    open: () => fl('M52 73 C56 71 64 71 68 73 C68 82 52 82 52 73 Z', '#3a1020', 3),
  };

  // ---------- hair / headwear ----------
  const H = {
    bun: c => `<circle cx="60" cy="16" r="10" fill="${c}" stroke="${INK}" stroke-width="3"/>
      ${fl('M29 50 C29 28 43 18 60 18 C77 18 91 28 91 50 C86 38 74 33 60 33 C46 33 34 38 29 50 Z', c)}`,
    long: c => `${fl('M27 54 C22 26 40 15 60 15 C80 15 98 26 93 54 L93 84 C93 66 84 60 84 44 C74 50 46 50 36 44 C36 60 27 66 27 84 Z', c)}`,
    short: c => fl('M30 50 C30 28 44 17 60 17 C76 17 90 28 90 50 C84 37 72 32 60 32 C48 32 36 37 30 50 Z', c),
    slick: c => `${fl('M30 48 C30 26 44 16 60 16 C76 16 90 26 90 48 C82 40 74 30 58 32 C48 33 36 38 30 48 Z', c)}
      ${ln('M44 30 C52 24 66 24 76 30', 2)}`,
    hood: c => `${fl('M22 92 C16 50 34 16 60 16 C86 16 104 50 98 92 C90 66 84 40 60 40 C36 40 30 66 22 92 Z', c)}`,
    cap: c => `${fl('M30 44 C30 24 44 15 60 15 C76 15 90 24 90 44 Z', c)}
      ${fl('M28 44 H96 C96 51 88 52 82 51 L28 50 Z', c)}`,
    tophat: c => `${fl('M40 42 H80 L78 8 H42 Z', c)}${fl('M28 42 H92 V50 H28 Z', c)}
      <rect x="41" y="30" width="38" height="6" fill="#ff6f5f" stroke="${INK}" stroke-width="2"/>`,
    dread: c => `${fl('M28 52 C24 24 42 14 60 14 C78 14 96 24 92 52 C86 40 72 34 60 34 C48 34 34 40 28 52 Z', c)}
      ${ln('M32 50 L26 78', 4)}${ln('M42 44 L36 74', 4)}${ln('M88 50 L94 78', 4)}${ln('M78 44 L84 74', 4)}`,
    horns: () => `${fl('M34 44 C22 30 22 14 32 4 C34 20 40 30 48 36 Z', '#e8c86a')}
      ${fl('M86 44 C98 30 98 14 88 4 C86 20 80 30 72 36 Z', '#e8c86a')}`,
    owl: c => `${fl('M28 50 C26 26 42 16 60 16 C78 16 94 26 92 50 C88 34 78 30 60 30 C42 30 32 34 28 50 Z', c)}
      ${fl('M30 34 L22 14 L44 24 Z', c)}${fl('M90 34 L98 14 L76 24 Z', c)}`,
    bald: () => '',
  };

  // ---------- props ----------
  const P = {
    orb: () => `<circle cx="97" cy="98" r="14" fill="#b98cff" stroke="${INK}" stroke-width="3" opacity="0.95"/>
      <circle cx="92" cy="93" r="4" fill="#fff" opacity="0.7"/>`,
    candle: () => `<rect x="90" y="88" width="10" height="28" fill="#f4e3c1" stroke="${INK}" stroke-width="3"/>
      ${fl('M95 86 C90 80 92 74 95 68 C98 74 100 80 95 86 Z', '#ffd23f')}`,
    blade: () => `${fl('M92 116 L84 60 L96 56 L104 114 Z', '#cfd8e3')}${ln('M84 62 L96 58', 2.5)}`,
    phone: () => `<rect x="86" y="86" width="20" height="30" rx="3" fill="#1b2430" stroke="${INK}" stroke-width="3"/>
      <rect x="89" y="90" width="14" height="20" fill="${GOOD}" opacity="0.85"/>`,
    snake: () => `${ln('M24 104 C40 90 52 110 68 96 C78 88 88 94 92 102', 5)}
      <circle cx="93" cy="103" r="5" fill="#93c48d" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="95" cy="102" r="1.3" fill="${INK}"/>`,
    keys: () => `<circle cx="94" cy="96" r="7" fill="none" stroke="#e8c86a" stroke-width="4"/>
      ${ln('M94 103 L94 116', 4)}${ln('M94 110 L101 110', 4)}`,
    bottle: () => `${fl('M86 92 H98 V116 H86 Z', '#4a3218')}<rect x="89" y="82" width="6" height="12" fill="#4a3218" stroke="${INK}" stroke-width="3"/>
      <rect x="87" y="99" width="10" height="8" fill="#f4e3c1"/>`,
    trishul: () => `${ln('M96 116 L96 62', 4)}${ln('M88 74 L88 60', 4)}${ln('M104 74 L104 60', 4)}${ln('M88 74 H104', 4)}`,
    grave: () => `${fl('M84 116 V88 C84 80 104 80 104 88 V116 Z', '#5d6672')}${ln('M94 94 V106', 3)}${ln('M88 99 H100', 3)}`,
    auto: () => `${fl('M80 116 C80 100 92 96 100 100 L106 116 Z', '#f5c542')}<circle cx="88" cy="114" r="6" fill="#2b2b33" stroke="${INK}" stroke-width="2.5"/>`,
    chain: () => `${ln('M44 96 C52 108 68 108 76 96', 4)}<circle cx="60" cy="106" r="5" fill="#e8c86a" stroke="${INK}" stroke-width="2.5"/>`,
    ringlight: () => `<circle cx="60" cy="54" r="52" fill="none" stroke="#fff2c2" stroke-width="5" opacity="0.55"/>`,
    scroll: () => `${fl('M84 88 H108 V116 H84 Z', '#e8dcc0')}${ln('M88 96 H104', 2)}${ln('M88 102 H104', 2)}${ln('M88 108 H100', 2)}`,
    briefcase: () => `${fl('M82 94 H110 V116 H82 Z', '#3a2a1e')}${fl('M92 88 H100 V94 H92 Z', '#3a2a1e')}
      <rect x="93" y="102" width="8" height="5" fill="#e8c86a" stroke="${INK}" stroke-width="2"/>`,
    whistle: () => `${fl('M88 96 C96 96 102 100 102 105 C102 110 96 113 90 111 L86 104 Z', '#cfd8e3')}
      ${ln('M86 104 L74 100', 3)}`,
    none: () => '',
  };

  const facialHair = {
    moustache: () => fl('M46 70 C52 66 56 68 60 71 C64 68 68 66 74 70 C68 74 64 73 60 74 C56 73 52 74 46 70 Z', INK, 2),
    beard: c => fl('M33 60 C33 88 45 96 60 96 C75 96 87 88 87 60 C84 80 72 86 60 86 C48 86 36 80 33 60 Z', c, 3),
    ash: () => `${ln('M36 62 H84', 2)}${ln('M38 68 H82', 2)}`,
    none: () => '',
  };

  // ---------- role definitions ----------
  const R = {
    'Tarot Aunty':    { team: 'good', skin: S.mid,   hair: H.bun('#3a3340'),   eyes: E.sly,    brows: calmBrows, mouth: M.smirk, prop: P.orb,       fh: 'none', extra: bindi },
    'Exorcist':       { team: 'good', skin: S.light, hair: H.hood('#2b3550'),  eyes: E.normal, brows: calmBrows, mouth: M.flat,  prop: P.candle,    fh: 'beardDark' },
    'Auto Anna':      { team: 'good', skin: S.deep,  hair: H.cap('#8a7a52'),   eyes: E.normal, brows: calmBrows, mouth: M.smile, prop: P.auto,      fh: 'moustache' },
    'Undertaker':     { team: 'good', skin: S.pale,  hair: H.tophat('#23232b'),eyes: E.tired,  brows: calmBrows, mouth: M.flat,  prop: P.grave,     fh: 'none' },
    'Slayer':         { team: 'good', skin: S.mid,   hair: H.short('#241d16'), eyes: E.sly,    brows: angryBrows,mouth: M.smirk, prop: P.blade,     fh: 'none', extra: scar },
    'Big Boss':       { team: 'good', skin: S.mid,   hair: H.slick('#1d1a20'), eyes: E.shades, brows: null,      mouth: M.smirk, prop: P.chain,     fh: 'none' },
    'Night Owl':      { team: 'good', skin: S.light, hair: H.owl('#6b5a44'),   eyes: E.wide,   brows: null,      mouth: M.flat,  prop: P.none,      fh: 'none', extra: specs },
    'Aam Aadmi':      { team: 'good', skin: S.mid,   hair: H.cap('#4d5a6b'),   eyes: E.normal, brows: calmBrows, mouth: M.smile, prop: P.none,      fh: 'none' },
    'Old Monk':       { team: 'good', skin: S.light, hair: H.short('#5a4632'), eyes: E.drunk,  brows: calmBrows, mouth: M.open,  prop: P.bottle,    fh: 'none', extra: blush },
    'Aghori':         { team: 'good', skin: S.ash,   hair: H.dread('#2a2430'), eyes: E.wide,   brows: angryBrows,mouth: M.flat,  prop: P.trishul,   fh: 'ash', extra: thirdEye },
    'Vishkanya':      { team: 'evil', skin: S.green, hair: H.long('#1f2a24'),  eyes: E.lashes, brows: calmBrows, mouth: M.smirk, prop: P.snake,     fh: 'none' },
    'Influencer':     { team: 'evil', skin: S.light, hair: H.long('#6b4a2f'),  eyes: E.lashes, brows: calmBrows, mouth: M.smile, prop: P.phone,     fh: 'none', under: P.ringlight },
    'WhatsApp Admin': { team: 'evil', skin: S.mid,   hair: H.short('#2b2b33'), eyes: E.sly,    brows: angryBrows,mouth: M.smirk, prop: P.phone,     fh: 'moustache' },
    'Landlord':       { team: 'evil', skin: S.deep,  hair: H.short('#3b3038'), eyes: E.sly,    brows: angryBrows,mouth: M.frown, prop: P.keys,      fh: 'moustache' },
    'Rakshasa':       { team: 'evil', skin: S.demon, hair: H.horns(),          eyes: E.glow,   brows: angryBrows,mouth: M.fangs, prop: P.none,      fh: 'moustache', extra: tilak },

    // --- Monsoon Blood ---
    'Ammamma':        { team: 'good', skin: S.pale,  hair: H.bun('#cfc9d6'),   eyes: E.sly,    brows: calmBrows, mouth: M.smile, prop: P.none,      fh: 'none', extra: specsSmall },
    'Pehelwan':       { team: 'good', skin: S.deep,  hair: H.bald(),           eyes: E.wide,   brows: angryBrows,mouth: M.flat,  prop: P.none,      fh: 'moustache', extra: gada },
    'Traffic Cop':    { team: 'good', skin: S.mid,   hair: H.cap('#3d4b6b'),   eyes: E.normal, brows: calmBrows, mouth: M.flat,  prop: P.whistle,   fh: 'moustache' },
    'Sadhu':          { team: 'good', skin: S.mid,   hair: H.dread('#7a5a2f'), eyes: E.tired,  brows: calmBrows, mouth: M.flat,  prop: P.candle,    fh: 'beardDark', extra: tilak },
    'Tantrik':        { team: 'evil', skin: S.ash,   hair: H.hood('#3a2540'),  eyes: E.glow,   brows: angryBrows,mouth: M.smirk, prop: P.candle,    fh: 'beardDark' },
    'Kasai':          { team: 'evil', skin: S.mid,   hair: H.short('#2b2118'), eyes: E.sly,    brows: angryBrows,mouth: M.smirk, prop: P.blade,     fh: 'moustache' },
    'Pishach':        { team: 'evil', skin: S.demon, hair: H.dread('#1d1520'), eyes: E.glow,   brows: angryBrows,mouth: M.fangs, prop: P.none,      fh: 'none', extra: bloodDrip },

    // --- Maya ---
    'Sapnewali':      { team: 'good', skin: S.light, hair: H.long('#4a3a63'),  eyes: E.closedDream, brows: calmBrows, mouth: M.smile, prop: P.orb,  fh: 'none', extra: bindi },
    'Guru':           { team: 'good', skin: S.mid,   hair: H.bald(),           eyes: E.tired,  brows: calmBrows, mouth: M.flat,  prop: P.none,      fh: 'beardDark', extra: thirdEye },
    'Kavi':           { team: 'good', skin: S.light, hair: H.short('#3b2f24'), eyes: E.sly,    brows: calmBrows, mouth: M.smirk, prop: P.scroll,    fh: 'none' },
    'Pagal':          { team: 'good', skin: S.light, hair: H.horns(),          eyes: E.drunk,  brows: angryBrows,mouth: M.open,  prop: P.none,      fh: 'none', extra: blush },
    'Naqab':          { team: 'evil', skin: S.ash,   hair: H.hood('#231c33'),  eyes: E.shades, brows: null,      mouth: M.flat,  prop: P.none,      fh: 'none' },
    'Chhaya':         { team: 'evil', skin: '#2a2438', hair: H.hood('#171226'),eyes: E.glow,   brows: null,      mouth: M.flat,  prop: P.none,      fh: 'none' },

    // --- Society AGM ---
    'Secretary':      { team: 'good', skin: S.light, hair: H.bun('#2f2a33'),   eyes: E.normal, brows: calmBrows, mouth: M.flat,  prop: P.scroll,    fh: 'none', extra: specsSmall },
    'Auditor':        { team: 'good', skin: S.mid,   hair: H.short('#3a3138'), eyes: E.tired,  brows: calmBrows, mouth: M.frown, prop: P.scroll,    fh: 'moustache', extra: specsSmall },
    'Chamcha':        { team: 'good', skin: S.mid,   hair: H.slick('#241d16'), eyes: E.wide,   brows: calmBrows, mouth: M.smile, prop: P.none,      fh: 'none', extra: blush },
    'Broker':         { team: 'evil', skin: S.light, hair: H.slick('#2b2b33'), eyes: E.shades, brows: null,      mouth: M.smirk, prop: P.briefcase, fh: 'none' },
    'Netaji':         { team: 'evil', skin: S.mid,   hair: H.cap('#e8e2ea'),   eyes: E.sly,    brows: angryBrows,mouth: M.smirk, prop: P.chain,     fh: 'moustache', extra: sash },
  };
  function bindi() { return `<circle cx="60" cy="34" r="3.4" fill="${EVIL}" stroke="${INK}" stroke-width="1.6"/>`; }
  function tilak() { return fl('M60 26 C57 34 57 40 60 46 C63 40 63 34 60 26 Z', '#ffb347', 2); }
  function thirdEye() { return `<ellipse cx="60" cy="36" rx="6" ry="4" fill="#ffd23f" stroke="${INK}" stroke-width="2"/><circle cx="60" cy="36" r="1.8" fill="${INK}"/>`; }
  function scar() { return ln('M78 40 L84 52', 2.5); }
  function blush() { return `<ellipse cx="40" cy="66" rx="7" ry="4" fill="${EVIL}" opacity="0.4"/><ellipse cx="80" cy="66" rx="7" ry="4" fill="${EVIL}" opacity="0.4"/>`; }
  function specsSmall() {
    return `<circle cx="48" cy="53" r="10" fill="none" stroke="${INK}" stroke-width="2.5" opacity="0.9"/>
      <circle cx="72" cy="53" r="10" fill="none" stroke="${INK}" stroke-width="2.5" opacity="0.9"/>${ln('M58 53 H62', 2.5)}`;
  }
  function gada() { // wrestler's mace over the shoulder
    return `${ln('M22 116 L30 78', 5)}<circle cx="31" cy="72" r="11" fill="#8a6a3a" stroke="${INK}" stroke-width="3"/>`;
  }
  function bloodDrip() {
    return `${fl('M46 84 C44 90 44 94 46 97 C48 94 48 90 46 84 Z', '#b3243c', 2)}
      ${fl('M70 86 C68 91 68 94 70 96 C72 94 72 91 70 86 Z', '#b3243c', 2)}`;
  }
  function sash() {
    return `${fl('M40 96 L58 120 L74 120 L52 92 Z', '#e8734a', 2.5)}`;
  }
  function specs() {
    return `<circle cx="48" cy="53" r="12" fill="none" stroke="${INK}" stroke-width="3"/>
      <circle cx="72" cy="53" r="12" fill="none" stroke="${INK}" stroke-width="3"/>${ln('M56 53 H64', 3)}`;
  }

  let uid = 0;

  function portraitSVG(role, opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const r = R[role];
    const id = 'p' + (++uid);
    if (!r) return genericAvatar(role || '?', opts);
    const tint = r.team === 'evil' ? EVIL : GOOD;
    const fh = r.fh === 'moustache' ? facialHair.moustache()
      : r.fh === 'beardDark' ? facialHair.beard('#2b2318')
      : r.fh === 'ash' ? facialHair.ash() : '';

    return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${role}">
  <defs>
    <radialGradient id="g${id}" cx="50%" cy="42%" r="62%">
      <stop offset="0" stop-color="${tint}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="${tint}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="c${id}"><circle cx="60" cy="60" r="59"/></clipPath>
  </defs>
  <g clip-path="url(#c${id})">
    <circle cx="60" cy="60" r="59" fill="#191b22"/>
    <circle cx="60" cy="60" r="59" fill="url(#g${id})"/>
    ${r.under ? r.under() : ''}
    ${shoulders(r.team === 'evil' ? '#2a2030' : '#28303f')}
    ${ears(r.skin)}
    ${head(r.skin)}
    ${r.hair}
    ${r.extra ? r.extra() : ''}
    ${r.brows ? r.brows() : ''}
    ${r.eyes(tint)}
    ${nose()}
    ${fh}
    ${r.mouth()}
    ${r.prop()}
  </g>
  <circle cx="60" cy="60" r="57.5" fill="none" stroke="${tint}" stroke-width="3" opacity="0.5"/>
</svg>`;
  }

  // Unknown player — roles are secret, so never leak art. Deterministic hue per name.
  function genericAvatar(name, opts) {
    opts = opts || {};
    const size = opts.size || 48;
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    const id = 'a' + (++uid);
    const initials = name.slice(0, 2).toUpperCase();
    return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}">
  <defs><linearGradient id="l${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${h},22%,34%)"/><stop offset="1" stop-color="#0c0e14"/>
  </linearGradient></defs>
  <circle cx="60" cy="60" r="59" fill="url(#l${id})" stroke="#30363d" stroke-width="3"/>
  <text x="60" y="72" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="34"
        font-weight="700" fill="#bec7d4" opacity="0.85">${initials}</text>
</svg>`;
  }

  window.portraitSVG = portraitSVG;
  window.genericAvatar = genericAvatar;
  window.ROLE_ART = R;
})();
