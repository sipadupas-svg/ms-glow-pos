// Verify live deployment has the fixes
(async () => {
  const t = await (await fetch('https://ms-glow-pos.vercel.app/')).text();
  const cek = (l, v) => console.log(l, ':', v ? 'YA ✅' : 'BELUM ❌');
  cek('html5-qrcode CDN      ', t.includes('html5-qrcode'));
  cek('scanner-reader div    ', t.includes('id="scanner-reader"'));
  cek('zxing lama hilang     ', !t.includes('@zxing/browser'));
  cek('hero-card dashboard   ', t.includes('hero-card'));
  cek('aksi cepat (qa-grid)  ', t.includes('qa-grid'));
  cek('stat-card shift       ', t.includes('stat-card'));
  cek('table-wrap            ', t.includes('table-wrap'));
  cek('kamera form barang    ', t.includes('scanNewProduct'));
  const s = await (await fetch('https://ms-glow-pos.vercel.app/sw.js')).text();
  console.log('SW cache              :', s.includes('v6') ? 'v6 fresh ✅' : s.includes('v5') ? 'v5 ⏳' : '?');
})();



