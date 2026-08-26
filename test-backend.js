// Test backend Ms Glow POS pakai fetch bawaan Node (redirect otomatis, seperti browser)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXjCuKssaWyvzDk2k7WEzq_uKO4DlIqIOwM1SoZ0NUMTEtH0Y5J_z_dwznlCGxgqOP/exec';

async function api(action, payload, token) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // sama seperti di index.html
    body: JSON.stringify({ action, payload, token }),
    redirect: 'follow'
  });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text), text }; }
  catch (e) { return { status: res.status, json: null, text }; }
}

(async () => {
  console.log('=== TES 1: LOGIN admin/1234 shift pagi ===');
  const r1 = await api('login', { username: 'admin', pin: '1234', shift: 'pagi' });
  console.log('HTTP:', r1.status);
  if (!r1.json || !r1.json.success) {
    console.log('[FAIL]', r1.json ? r1.json.error : r1.text.slice(0, 200));
    return;
  }
  const token = r1.json.token;
  console.log('[OK] Login sukses! role=' + r1.json.role + ', shift=' + r1.json.shift);

  const tests = [
    ['TES 2: GET PRODUCTS',        'get-products',       {},               d => '[OK] Jumlah produk: ' + d.products.length],
    ['TES 3: STOCK SUMMARY',       'get-stock-summary',  {},               d => '[OK] Item stok: ' + d.summary.length],
    ['TES 4: DASHBOARD STATS',     'get-dashboard-stats',{},               d => '[OK] Total hari ini: Rp ' + d.totalToday + ', trx: ' + d.trxCount],
    ['TES 5: REKAPITULASI HARIAN', 'get-rekapitulasi',   { range:'harian' }, d => '[OK] Grand total: Rp ' + d.totals.grandTotal],
  ];
  for (const [label, action, payload, ok] of tests) {
    process.stdout.write('\n=== ' + label + ' ===\n');
    try {
      const r = await api(action, payload, token);
      if (r.json && r.json.success) console.log(ok(r.json));
      else console.log('[FAIL]', r.json ? r.json.error : r.text.slice(0, 150));
    } catch (e) { console.log('[ERROR]', e.message); }
  }
  console.log('\n=== SELESAI ===');
})();

