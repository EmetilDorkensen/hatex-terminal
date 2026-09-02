/**
 * scripts/fix-kreyol.cjs
 * Kore mojibake (karaktè double-ankode) ak òtograf kreyòl
 * nan app/developer/page.tsx.
 *
 * Mojibake = karaktè UTF-8 ki te li janm CP-1252/Latin-1 epi
 * re-ankode an UTF-8. Egz. "è" vin "Ã¨", "—" vin "â€”".
 * Nou sèvi ak kòd \uXXXX pou garanti matche egzak.
 *
 * Kòmand:  node scripts/fix-kreyol.cjs
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app', 'developer', 'page.tsx');

if (!fs.existsSync(file)) {
  console.error('Fichye pa jwenn: ' + file);
  process.exit(1);
}

let s = fs.readFileSync(file, 'utf8');

// ============================================================
// 1) RESTORASYON MOJIBAKE — sekans yo dwe egziste nan fichye a
// ============================================================
const mojibake = [
  { from: '\u00C3\u00B2', to: '\u00F2', label: 'Ã² -> ò (mòd/kòd/ankò)' },
  { from: '\u00C3\u00A8', to: '\u00E8', label: 'Ã¨ -> è (sèkè/Erè...) ' },
  { from: '\u00C3\u00A9', to: '\u00E9', label: 'Ã© -> é (Développeurs)' },
  { from: '\u00C3\u02C6', to: '\u00C8', label: 'Ã+ˆ -> È (SÈVÈ)' },
  { from: '\u00E2\u20AC\u201D', to: '\u2014', label: 'â€" -> — (em dash)' },
  { from: '\u00E2\u2020\u2019', to: '\u2192', label: 'â†\' -> → (flèch)' },
  { from: '\u00E2\u0161\u00A0\u00EF\u00B8\u008F', to: '\u26A0\uFE0F', label: 'emoji avètisman -> ⚠️' },
  { from: '\u00C2\u00B7', to: '\u00B7', label: 'Â· -> · (pwen milye)' },
];

// ============================================================
// 2) KREYÒL — koreksyon òtograf ak fraz
// ============================================================
const kreyol = [
  { from: 's\u00E8tten', to: 's\u00E8ten', label: 'sètten -> sèten (ti pèpè òtograf)' },
  { from: 'D\u00E9marrer rapidement', to: 'K\u00F2manse fasilman', label: 'Franse -> Kreyòl (tibò heading)' },
  { from: 'Poko gen okenn pwen webhook.', to: 'Ou poko gen okenn pwen webhook.', label: 'Poko -> Ou poko (sijè)' },
  { from: 'Poko gen okenn delivrans webhook.', to: 'Ou poko gen okenn delivrans webhook.', label: 'Poko -> Ou poko (delivrans)' },
  { from: 'janm gen aks\u00E8 modifikasyon.', to: 'li pa janm gen aks\u00E8 pou modifikasyon.', label: 'janm gen -> li pa janm gen' },
  { from: 'Nouvo kle API jenere.', to: 'Yo jenere yon nouvo kle API.', label: 'vwa pasif -> vwa aktif' },
  { from: 'Secret key a bay aks\u00E8 total sou API a.', to: 'Kle sekr\u00E8 a bay aks\u00E8 total sou API a.', label: 'Secret key -> Kle sekrè' },
];

let failed = false;

for (const fix of [...mojibake, ...kreyol]) {
  const count = s.split(fix.from).length - 1;
  if (count === 0) {
    console.error('PA JWENN: "' + fix.label + '"  ([' + [...fix.from].map((c) => c.codePointAt(0).toString(16)).join(' ') + '])');
    failed = true;
    continue;
  }
  s = s.split(fix.from).join(fix.to);
  console.log(count + 'x  ' + fix.label);
}

if (failed) {
  console.error('\nSTOP: gen kèk ranplasman ki pa t jwenn. Fichye pa ekri.');
  process.exit(1);
}

// ============================================================
// 3) VERIFIKASYON FINAL — dwe pa gen lòt karaktè ki sispèk
// ============================================================
const allow = new Set([
  0xFEFF, // BOM
  0xE8, 0xE9, 0xF2, 0xC8, 0xB7, 0x2014, 0x2192, 0x26A0, 0xFE0F, // karaktè korek yo
  0x2019, 0x2020, 0x201C, 0x201D, 0x20AC, // quotes/dash ki ka vin kòrèk si yo te deja byen ankode
]);
const restants = [];
for (let i = 0; i < s.length; i++) {
  const code = s.charCodeAt(i);
  if (code > 127 && !allow.has(code)) {
    restants.push('U+' + code.toString(16).toUpperCase() + ' a pozisyon ' + i);
  }
}
if (restants.length) {
  console.error('\nATANSYON: karaktè non-ASCII ki rete (pa nan lis):');
  for (const r of restants.slice(0, 20)) console.error('  ' + r);
  process.exit(1);
}

// Konsève BOM si li te la
if (!s.startsWith('\uFEFF') && fs.readFileSync(file, 'utf8').startsWith('\uFEFF')) {
  s = '\uFEFF' + s;
}

fs.writeFileSync(file, s, 'utf8');
console.log('\nOK: fichye korije epi ekri (' + file + ')');
