// Verify live deployment has the fixes
(async () => {
  const t = await (await fetch('https://ms-glow-pos.vercel.app/')).text();
  const cek = (label, val) => console.log(label, ':', val ? 'ADA ✅' : 'BELUM ❌');
  cek('screen-login terpisah ', t.includes('id="screen-login"'));
  cek('app hidden attribute  ', t.includes('<div id="app" hidden>'));
  cek('shift-toggle baru     ', t.includes('shift-opt'));
  cek('fungsi enterApp       ', t.includes('function enterApp'));
  console.log('view-login lama       :', t.includes('view-login') ? 'MASIH ADA (harusnya tidak) ⚠️' : 'SUDAH HILANG ✅');
  const s = await (await fetch('https://ms-glow-pos.vercel.app/sw.js')).text();
  console.log('SW cache              :', s.includes('v3') ? 'v3 fresh ✅' : s.includes('v2') ? 'v2 (belum update) ⏳' : '?');
})();

