const fs = require('fs');
const src = fs.readFileSync('c:/Users/dorke/hatexcard/app/developer/page.tsx', 'utf8');

// Find the return ( ... ) JSX block start (start of the tag, not mid-attribute)
const startIdx = src.indexOf('return (');
if (startIdx === -1) { console.log('start not found'); process.exit(1); }

const jsx = src.slice(startIdx);
const startLine = (src.slice(0, startIdx).match(/\n/g) || []).length + 1;

// Manual scanner: walk the JSX, finding each tag, skipping over {...} expressions
// (which may contain > inside arrows) and string literals.
const stack = [];
let i = 0;

function skipStrOrTemplate(s, idx) {
  // Skip a quoted string or template literal, returning index just past it.
  const c = s[idx];
  if (c === "'" || c === '"') {
    let k = idx + 1;
    while (k < s.length) {
      if (s[k] === '\\') { k += 2; continue; }
      if (s[k] === c) return k + 1;
      k++;
    }
    return s.length;
  }
  if (c === '`') {
    let k = idx + 1;
    while (k < s.length) {
      if (s[k] === '\\') { k += 2; continue; }
      if (s[k] === '`') return k + 1;
      if (s[k] === '$' && s[k + 1] === '{') { k = skipExpr(s, k + 1); continue; }
      k++;
    }
    return s.length;
  }
  return skipExpr(s, idx);
}

function skipExpr(s, idx) {
  // idx points at '{'; return index just past matching '}' (handles nesting,
  // strings and template literals inside the expression).
  let depth = 1;
  let k = idx + 1;
  while (k < s.length && depth > 0) {
    const c = s[k];
    if (c === "'" || c === '"' || c === '`') { k = skipStrOrTemplate(s, k); continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    k++;
  }
  return k;
}

function findTagEnd(s, idx) {
  // idx points at '<'; returns index just past the closing '>'.
  for (let k = idx + 1; k < s.length; k++) {
    const c = s[k];
    if (c === "'" || c === '"' || c === '`') { k = skipStrOrTemplate(s, k) - 1; continue; }
    if (c === '{') { k = skipExpr(s, k) - 1; continue; }
    if (c === '>') return k + 1;
  }
  return s.length;
}

function lineOf(s, idx) {
  return startLine + (s.slice(0, idx).match(/\n/g) || []).length;
}

while (i < jsx.length) {
  const lt = jsx.indexOf('<', i);
  if (lt === -1) break;

  // Skip plain text/whitespace regions: ensure this is a tag (next char is letter, /, or >)
  const next = jsx[lt + 1];
  if (next && (next === '/' || /[A-Za-z]/.test(next))) {
    const end = findTagEnd(jsx, lt);
    if (end === -1) break;
    const raw = jsx.slice(lt, end);
    i = end;

    // skip comments
    if (raw.startsWith('<!--')) continue;

    const closeMatch = raw.match(/^<\/([\w.]+)\s*>/);
    // Self-closing ONLY when the raw tag itself ends with "/>" (plus optional
    // trailing whitespace). Because findTagEnd correctly skips template
    // literals / {...} expressions, a "/>" at the end means this tag truly is
    // self-closing (e.g. multi-line <input ... />).
    const selfClose = /\/>\s*$/.test(raw);
    if (closeMatch) {
      const tag = closeMatch[1];
      if (stack.length === 0) {
        console.log(`Extra closing </${tag}> at line ${lineOf(jsx, lt)}`);
        continue;
      }
      const top = stack[stack.length - 1];
      if (top.tag !== tag) {
        console.log(`Mismatch: expected </${top.tag}> (opened line ${top.line}) but got </${tag}> at line ${lineOf(jsx, lt)}`);
        let found = -1;
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k].tag === tag) { found = k; break; }
        }
        if (found >= 0) stack.length = found;
      } else {
        stack.pop();
      }
    } else if (!selfClose) {
      const tag = raw.match(/^<([\w.]+)/);
      if (tag) stack.push({ tag: tag[1], line: lineOf(jsx, lt) });
    }
    continue;
  }
  i = lt + 1;
}

console.log('Remaining open tags (should be empty):');
stack.forEach(s => console.log(`  <${s.tag}> opened at line ${s.line}`));
