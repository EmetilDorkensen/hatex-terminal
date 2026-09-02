const fs = require('fs');
const src = fs.readFileSync('c:/Users/dorke/hatexcard/app/developer/page.tsx', 'utf8');

// Skip the top part (imports/component defs/state/handlers) up to the main `return (`
const startIdx = src.indexOf('return (');
if (startIdx === -1) { console.log('return not found'); process.exit(1); }
const body = src.slice(startIdx);
const baseLine = (src.slice(0, startIdx).match(/\n/g) || []).length + 1;

// Advance past a quoted string (single/double) or template literal or {..} expr.
// Returns the index just past the closing token.
function skipStrOrTemplate(str, idx) {
  const c = str[idx];
  if (c === "'" || c === '"') {
    const q = c;
    let j = idx + 1;
    while (j < str.length) {
      if (str[j] === '\\') { j += 2; continue; }
      if (str[j] === q) return j + 1;
      j++;
    }
    return str.length;
  }
  if (c === '`') {
    let j = idx + 1;
    while (j < str.length) {
      if (str[j] === '\\') { j += 2; continue; }
      if (str[j] === '`') return j + 1;
      if (str[j] === '$' && str[j + 1] === '{') {
        j = skipExpr(str, j + 1);
        continue;
      }
      j++;
    }
    return str.length;
  }
  // { expression } — must skip nested braces, strings and templates inside
  return skipExpr(str, idx);
}

function skipExpr(str, idx) {
  // idx points at '{'
  let d = 1;
  let j = idx + 1;
  while (j < str.length && d > 0) {
    const c = str[j];
    if (c === "'" || c === '"' || c === '`') {
      j = skipStrOrTemplate(str, j);
      continue;
    }
    if (c === '{') d++;
    else if (c === '}') { d--; }
    j++;
  }
  return j;
}

// Given index at '<', return index just past the matching '>' that ends the tag.
// Skips quoted attribute values, template literals and {..} attribute expressions.
function findTagEnd(str, idx) {
  let j = idx + 1;
  while (j < str.length) {
    const c = str[j];
    if (c === "'" || c === '"' || c === '`') {
      j = skipStrOrTemplate(str, j);
      continue;
    }
    if (c === '{') {
      j = skipExpr(str, j);
      continue;
    }
    if (c === '>') return j + 1;
    j++;
  }
  return str.length;
}

let depth = 0;
let i = 0;
while (i < body.length) {
  const c = body[i];
  if (c === "'" || c === '"' || c === '`' || c === '{') {
    i = skipStrOrTemplate(body, i);
    continue;
  }
  if (c === '<') {
    const closeM = body.slice(i).match(/^<\/(div)\s*>/);
    if (closeM) {
      depth--;
      const lineNo = baseLine + (body.slice(0, i).match(/\n/g) || []).length;
      if (lineNo >= 770) console.log(`L${lineNo} </div> depth=${depth}`);
      i += closeM[0].length;
      continue;
    }
    const openM = body.slice(i).match(/^<div\b/);
    if (openM) {
      depth++;
      const lineNo = baseLine + (body.slice(0, i).match(/\n/g) || []).length;
      if (lineNo <= 400 || lineNo === 440) console.log(`L${lineNo} <div> depth=${depth}`);
      i = findTagEnd(body, i);
      continue;
    }
    // not a div — advance by one char (could be another tag; skip fast by finding tag end if possible)
    const anyM = body.slice(i).match(/^<\/?[A-Za-z]/);
    if (anyM) {
      i = findTagEnd(body, i);
      continue;
    }
    i++;
    continue;
  }
  i++;
}
console.log('Final div depth (should be 0):', depth);
