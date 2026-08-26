// Verify live deployment has the fixes
(async () => {
  const t = await (await fetch('https://ms-glow-pos.vercel.app/')).text();
  console.log('nav Barang  (products) :', t.includes('data-nav="products"') ? 'ADA' : 'BELUM');
  console.log('nav Riwayat (sales)    :', t.includes('data-nav="sales"') ? 'ADA' : 'BELUM');
  console.log('8 tab navigasi         :', (t.match(/data-nav=/g) || []).length >= 8 ? 'YA (' + (t.match(/data-nav=/g)).length + ')' : 'KURANG');
  console.log('SCRIPT_URL backend     :', t.includes('AKfycbwXjCuKssaWyvzDk2k7WEzq_uKO4DlIqIOwM1SoZ0NUMTEtH0Y5J_z_dwznlCGxgqOP') ? 'BENAR' : 'SALAH!');
  const s = await (await fetch('https://ms-glow-pos.vercel.app/sw.js')).text();
  console.log('Service Worker cache   :', s.includes('ms-glow-pos-v2') ? 'v2 (fresh)' : s.includes('v1') ? 'v1 (LAMA)' : '?');
})();
