// Validate index.html structure + JS syntax for Ms Glow POS
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.html');
const html = fs.readFileSync(file, 'utf8');

console.log('=== VALIDASI index.html ===');
console.log('Total karakter:', html.length);

// 1. Basic structure checks
const checks = [
  ['<!DOCTYPE html>', html.includes('<!DOCTYPE html>')],
  ['</html> closing', html.includes('</html>')],
  ['<script> main block', (html.match(/<script>/g) || []).length],
  ['</script> closing', (html.match(/<\/script>/g) || []).length],
  ['manifest link', html.includes('manifest.json')],
    ['screen-login terpisah', html.includes('id="screen-login"')],
  ['app wrapper hidden', html.includes('<div id="app" hidden>')],
  ['enterApp function', html.includes('function enterApp')],
  ['showLoginScreen function', html.includes('function showLoginScreen')],
  ['view-dashboard', html.includes('id="view-dashboard"')],
  ['view-pos', html.includes('id="view-pos"')],
  ['view-sales', html.includes('id="view-sales"')],
  ['view-warehouse', html.includes('id="view-warehouse"')],
  ['view-gallery', html.includes('id="view-gallery"')],
  ['view-products', html.includes('id="view-products"')],
  ['view-report', html.includes('id="view-report"')],
  ['view-settings', html.includes('id="view-settings"')],
  ['nav-bottom', html.includes('nav-bottom')],
  ['receipt-modal', html.includes('receipt-modal')],
  ['scanner-overlay', html.includes('scanner-overlay')],
  ['adjust-modal', html.includes('adjust-modal')],
];
let fail = 0;
checks.forEach(([name, val]) => {
  const ok = val === true || (typeof val === 'number' && val > 0);
  if (!ok) fail++;
  console.log((ok ? '[OK]' : '[FAIL]'), name, typeof val === 'number' ? '(' + val + ')' : '');
});

// 2. Extract and syntax-check inline scripts
console.log('\n=== CEK SINTAKS JAVASCRIPT ===');
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
scriptMatches.forEach((m, i) => {
  const code = m[1];
  try {
    new Function(code); // syntax check only (not executed)
    console.log('[OK] Script blok #' + (i + 1) + ' — sintaks valid (' + code.length + ' chars)');
  } catch (e) {
    fail++;
    console.log('[FAIL] Script blok #' + (i + 1) + ':', e.message);
    // find approximate error location
    const lines = code.split('\n');
    console.log('   Total baris di blok ini:', lines.length);
  }
});

// 3. Check balanced braces in main script (rough)
if (scriptMatches.length) {
  const code = scriptMatches[0][1];
  const open = (code.match(/{/g) || []).length;
  const close = (code.match(/}/g) || []).length;
  console.log('\nKurung kurawal: { =' + open + '  } =' + close + (open === close ? ' [BALANCE]' : ' [TIDAK BALANCE!]'));
}

// 4. Duplicate function definitions (info)
['function showView', 'function initPos', 'async function checkout'].forEach(fn => {
  const count = (code => { return 0; })(0); // placeholder
});
const dupShowView = (html.match(/function showView/g) || []).length;
console.log('\nDefinisi showView:', dupShowView, dupShowView > 1 ? '(duplikat — definisi terakhir yang dipakai)' : '');

console.log(fail === 0 ? '\n✅ SEMUA CEK LOLOS' : '\n❌ Ada ' + fail + ' masalah');
process.exit(fail === 0 ? 0 : 1);
