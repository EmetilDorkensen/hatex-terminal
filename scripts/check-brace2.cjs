const fs = require('fs');
const lines = fs.readFileSync('c:/Users/dorke/hatexcard/app/developer/page.tsx', 'utf8').split(/\r?\n/);
let depth = 0;
let inT = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '`') { inT = inT ? 0 : 1; continue; }
    if (inT) continue;
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  if (i + 1 >= 306 && i + 1 <= 335) console.log((i + 1) + ' d=' + depth + ' ' + line.trim().slice(0, 60));
}
