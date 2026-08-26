// Verify live deployment has the fixes
(async () => {
  const t = await (await fetch('https://ms-glow-pos.vercel.app/')).text();
  console.log('URL backend BARU di live :', t.includes('AKfycbwEAY5yI5t') ? 'SUDAH ✅' : 'BELUM ⏳');
  console.log('URL backend LAMA         :', t.includes('AKfycbwXjCuKssaWyvzDk2k7WEzq') ? 'MASIH ADA (salah) ❌' : 'sudah hilang ✅');
  const s = await (await fetch('https://ms-glow-pos.vercel.app/sw.js')).text();
  console.log('SW cache                 :', s.includes('v4') ? 'v4 fresh ✅' : s.includes('v3') ? 'v3 ⏳' : '?');
})();


