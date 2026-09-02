const fs = require('fs');
const path = 'c:/Users/dorke/hatexcard/app/developer/page.tsx';
const src = fs.readFileSync(path, 'utf8');
const lines = src.split(/\r?\n/);

let depth = 0;
let inTemplate = 0; // depth of backtick template literal
let inStringChar = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    const prev = line[j - 1];
    if (inStringChar) {
      if (ch === inStringChar && prev !== '\\') inStringChar = null;
      continue;
    }
    if (ch === '`') { inTemplate = inTemplate ? 0 : 1; continue; }
    if (inTemplate) continue;
    if (ch === "'" || ch === '"') { inStringChar = ch; continue; }
    if (ch === '/' && line[j+1] === '/') break; // line comment
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  if (i + 1 === 35) console.log(`After line 35: depth=${depth}`);
  if ((i + 1) % 50 === 0) console.log(`After line ${i+1}: depth=${depth}`);
}
console.log('Final depth:', depth);
