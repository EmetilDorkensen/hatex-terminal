const fs = require('fs');
const src = fs.readFileSync('c:/Users/dorke/hatexcard/app/developer/page.tsx', 'utf8');
const lines = src.split(/\r?\n/);
let depth = 0;
const inCode = { js: false, php: false, curl: false };
const starts = []; // stack of {line, tag}
const skipLines = new Set();

// detect template literal regions for codeSnippets (lines 307-360)
let templateStart = -1;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/const codeSnippets = \{/.test(l)) templateStart = i;
  if (templateStart >= 0 && /^\s*\};/.test(l) && i > templateStart) {
    // end of snippets object
    break;
  }
  if (templateStart >= 0 && i > templateStart) skipLines.add(i);
}

for (let i = 0; i < lines.length; i++) {
  if (skipLines.has(i)) continue;
  const l = lines[i];
  const opens = (l.match(/<div/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  const mainO = (l.match(/<main/g) || []).length;
  const mainC = (l.match(/<\/main>/g) || []).length;
  const fragO = (l.match(/<>/g) || []).length;
  const fragC = (l.match(/<\/>/g) || []).length;
  const pO = (l.match(/<p[\s>]/g) || []).length;
  const pC = (l.match(/<\/p>/g) || []).length;
  const spanO = (l.match(/<span/g) || []).length;
  const spanC = (l.match(/<\/span>/g) || []).length;
  const codeO = (l.match(/<code/g) || []).length;
  const codeC = (l.match(/<\/code>/g) || []).length;
  const btnO = (l.match(/<button/g) || []).length;
  const btnC = (l.match(/<\/button>/g) || []).length;
  const labelO = (l.match(/<label/g) || []).length;
  const labelC = (l.match(/<\/label>/g) || []).length;
  const h2O = (l.match(/<h2/g) || []).length;
  const h2C = (l.match(/<\/h2>/g) || []).length;
  const liO = (l.match(/<li/g) || []).length;
  const liC = (l.match(/<\/li>/g) || []).length;
  const olO = (l.match(/<ol/g) || []).length;
  const olC = (l.match(/<\/ol>/g) || []).length;
  const thO = (l.match(/<th/g) || []).length;
  const thC = (l.match(/<\/th>/g) || []).length;
  const tdO = (l.match(/<td/g) || []).length;
  const tdC = (l.match(/<\/td>/g) || []).length;
  const trO = (l.match(/<tr/g) || []).length;
  const trC = (l.match(/<\/tr>/g) || []).length;
  const tableO = (l.match(/<table/g) || []).length;
  const tableC = (l.match(/<\/table>/g) || []).length;
  const theadO = (l.match(/<thead/g) || []).length;
  const theadC = (l.match(/<\/thead>/g) || []).length;
  const tbodyO = (l.match(/<tbody/g) || []).length;
  const tbodyC = (l.match(/<\/tbody>/g) || []).length;
  const asideO = (l.match(/<aside/g) || []).length;
  const asideC = (l.match(/<\/aside>/g) || []).length;
  const navO = (l.match(/<nav/g) || []).length;
  const navC = (l.match(/<\/nav>/g) || []).length;

  const net = opens - closes + mainO - mainC + fragO - fragC + pO - pC + spanO - spanC
    + codeO - codeC + btnO - btnC + labelO - labelC + h2O - h2C + liO - liC + olO - olC
    + thO - thC + tdO - tdC + trO - trC + tableO - tableC + theadO - theadC + tbodyO - tbodyC
    + asideO - asideC + navO - navC;
  if (net !== 0) {
    console.log(`L${i + 1} net=${net}: ${l.trim().slice(0, 100)}`);
  }
}
