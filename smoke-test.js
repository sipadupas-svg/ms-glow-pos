// Verify live deployment has the fixes
(async () => {
  const t = await (await fetch('https://ms-glow-pos.vercel.app/')).text();
  console.log('nav Barang  (products) :', t.includes('data-nav="products"') ? 'ADA' : 'BELUM');
  console.log('nav Riwayat (sales)    :', t.includes('data-nav="sales"') ? 'ADA' : 'BELUM');
  console.log('SCRIPT_URL backend     :', t.includes('AKfycbwXjCuKssaWyvzDk2k7WEzq_uKO4DlIqIOwM1SoZ0NUMTEtH0Y5J_z_dwznlCGxgqOP') ? 'BENAR' : 'SALAH!');
  const s = await (await fetch('https://ms-glow-pos.vercel.app/sw.js')).text();
  console.log('Service Worker cache   :', s.includes('ms-glow-pos-v2') ? 'v2 (fresh)' : s.includes('v1') ? 'v1 (LAMA)' : '?');
})();

const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(root, decodeURIComponent(urlPath));
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + urlPath); return; }
    const ext = path.extname(filePath).toLowerCase();
    const mime = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.css':'text/css' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(8123, async () => {
  console.log('Server jalan di http://localhost:8123');
  // fetch tests
  const tests = ['/index.html', '/manifest.json', '/sw.js', '/icons/icon-192.png', '/icons/icon-512.png'];
  let pass = 0;
  for (const t of tests) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get('http://localhost:8123' + t, r => {
          let body = [];
          r.on('data', c => body.push(c));
          r.on('end', () => resolve({ status: r.statusCode, size: Buffer.concat(body).length, type: r.headers['content-type'] }));
        }).on('error', reject);
      });
      const ok = res.status === 200 && res.size > 0;
      if (ok) pass++;
      console.log((ok ? '[OK]' : '[FAIL]'), t, '→', res.status, res.size + ' bytes', res.type);
    } catch (e) {
      console.log('[FAIL]', t, e.message);
    }
  }
  console.log(pass === tests.length ? '\n✅ SMOKE TEST LOLOS (' + pass + '/' + tests.length + ')' : '\n❌ GAGAL');
  server.close();
  process.exit(pass === tests.length ? 0 : 1);
});
