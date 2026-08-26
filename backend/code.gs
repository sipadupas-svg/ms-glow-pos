/**
 * ============================================================
 *  GOOGLE APPS SCRIPT BACKEND — Ms Glow POS
 *  Frontend : index.html (hosting Vercel / statis, PWA)
 *  Database : Google Sheets
 *
 *  Sheets: Users, Products, Sales, WarehouseStock, GalleryStock
 *  Fitur: Login, 2 Shift (pagi/siang), POS, Stok Gudang/Rak,
 *         Rekapitulasi (harian/mingguan/bulanan/custom), User mgmt
 *
 *  SETUP: 1. Ganti SPREADSHEET_ID. 2. Run setupSheets() SEKALI.
 *         3. Deploy > New deployment > Web app (Anyone, Execute as Me)
 *         4. Salin URL ke GOOGLE_SCRIPT_URL di index.html
 *  ============================================================
 */

const SPREADSHEET_ID  = 'YOUR_SPREADSHEET_ID_HERE';
const APP_NAME        = 'Ms Glow POS';
const TOKEN_TTL_MS    = 30 * 60 * 1000;        // 30 menit
const MAX_LOGIN_FAILS = 5;
const LOCKOUT_MS      = 15 * 60 * 1000;
const MAX_REQ_PER_MIN = 120;

/* ==================== HTTP ENTRY POINTS ==================== */

function doGet(e) {
  return ContentService.createTextOutput(
    '<h1>' + APP_NAME + ' — Backend Online</h1>'
  ).setMimeType(ContentService.MimeType.HTML);
}

function doPost(e) {
  try {
    if (!checkRateLimit()) {
      return json({ success: false, error: 'Terlalu banyak permintaan. Coba lagi beberapa saat.' });
    }
    const request = JSON.parse(e.postData.contents);
    const action  = request.action  || '';
    const payload = request.payload || {};
    const token   = request.token   || null;
    let res;
    switch (action) {
      case 'login':                 res = handleLogin(payload); break;
      case 'get-products':          res = handleGetProducts(token); break;
      case 'save-product':          res = handleSaveProduct(payload, token); break;
      case 'get-stock-summary':     res = handleGetStockSummary(token); break;
      case 'adjust-warehouse':      res = handleAdjustWarehouse(payload, token); break;
      case 'adjust-gallery':        res = handleAdjustGallery(payload, token); break;
      case 'get-warehouse-log':     res = handleGetWarehouseLog(payload, token); break;
      case 'get-gallery-log':       res = handleGetGalleryLog(payload, token); break;
      case 'save-sale':             res = handleSaveSale(payload, token); break;
      case 'get-sales':             res = handleGetSales(payload, token); break;
      case 'get-dashboard-stats':   res = handleGetDashboardStats(payload, token); break;
      case 'get-rekapitulasi':      res = handleGetRekapitulasi(payload, token); break;
      case 'get-users':             res = handleGetUsers(token); break;
      case 'manage-user':           res = handleManageUser(payload, token); break;
      case 'change-pin':            res = handleChangePin(payload, token); break;
      default:                      throw new Error('Action tidak dikenal: ' + action);
    }
    return json(res);
  } catch (error) {
    return json({ success: false, error: String(error.message || error) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(
    JSON.stringify(obj)
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ==================== RATE LIMITING ==================== */

function checkRateLimit() {
  const cache = CacheService.getScriptCache();
  let arr = [];
  const raw = cache.get('rl');
  if (raw) { try { arr = JSON.parse(raw); } catch (e) { arr = []; } }
  const now = Date.now();
  arr = arr.filter(t => now - t < 60000);
  if (arr.length >= MAX_REQ_PER_MIN) return false;
  arr.push(now);
  cache.put('rl', JSON.stringify(arr), 60);
  return true;
}

/* ==================== TOKEN & AUTH ==================== */

function decodeToken(token) {
  if (!token) return null;
  try {
    const jsonStr = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const d = JSON.parse(jsonStr);
    return (d && d.u && d.exp > Date.now()) ? d : null;
  } catch (e) { return null; }
}

function requireAuth(token) {
  const t = decodeToken(token);
  if (!t) throw new Error('Sesi tidak valid atau sudah berakhir.');
  const users = getSheetData('Users');
  const u = users.find(x => String(x.Username).trim().toLowerCase() === String(t.u).trim().toLowerCase());
  if (!u) throw new Error('User tidak ditemukan.');
  return { username: u.Username, role: u.Role, shift: t.s || '', raw: t };
}

function requireAdmin(token) {
  const a = requireAuth(token);
  if (a.role !== 'admin') throw new Error('Hak akses admin diperlukan.');
  return a;
}

function makeToken(username, shift) {
  const payload = { u: username, s: shift || '', exp: Date.now() + TOKEN_TTL_MS };
  return Utilities.base64EncodeWebSafe(JSON.stringify(payload));
}

/* ==================== LOGIN ==================== */

function handleLogin(payload) {
  const username = String(payload.username || '').trim().toLowerCase();
  const pin      = String(payload.pin || '').trim();

  if (!/^\d{4}$/.test(pin)) throw new Error('PIN harus 4 digit angka.');

  const cache = CacheService.getScriptCache();
  const lockKey = 'lock_' + username;
  if (cache.get(lockKey)) {
    throw new Error('Akun terkunci 15 menit karena terlalu banyak percobaan salah.');
  }

  const users = getSheetData('Users');
  const user  = users.find(x => String(x.Username).trim().toLowerCase() === username && String(x.PIN).trim() === pin);

  if (!user) {
    let fails = 0;
    const rfKey = 'rf_' + username;
    const raw = cache.get(rfKey);
    if (raw) { try { fails = parseInt(raw, 10) || 0; } catch(e){} }
    fails++;
    cache.put(rfKey, String(fails), 15 * 60);
    if (fails >= MAX_LOGIN_FAILS) cache.put(lockKey, '1', 15 * 60);
    throw new Error('Username atau PIN salah.');
  }

  const shift = payload.shift
    ? String(payload.shift).toLowerCase().trim()
    : isPagiHours() ? 'pagi' : 'siang';

  cache.remove('rf_' + username);
  const token = makeToken(username, shift);
  return {
    success: true, token: token,
    username: username, role: user.Role || 'operator', shift: shift
  };
}

function isPagiHours() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 14;
}

/* ==================== MASTER BARANG (PRODUCTS) ==================== */

function handleGetProducts(token) {
  requireAuth(token);
  const products = getSheetData('Products');
  return { success: true, products: products };
}

function handleSaveProduct(payload, token) {
  requireAdmin(token);
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Products');

  const incomingID = String(payload.productID || '').trim();
  const productID  = incomingID || ('P-' + Date.now());
  const isUpdate   = !!incomingID;
  const sku        = String(payload.sku || '').trim();
  const name       = String(payload.name || '').trim();
  const barcode    = String(payload.barcode || '').trim();
  const price      = Number(payload.price || 0);
  const category   = String(payload.category || '').trim();
  const stockMin   = Number(payload.stockMin || 0);
  if (!name) throw new Error('Nama barang wajib diisi.');

  const headers = ['ProductID','SKU','Name','Barcode','Price','Category','StockMin','CreatedAt'];
  if (!sheet.getLastRow()) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  }

  const existing = getSheetData('Products');
  const rowIndex = existing.findIndex(p => String(p.ProductID).trim() === productID);

  /* UPDATE — hanya jika client mengirim productID yang benar-benar ada */
  if (isUpdate && rowIndex >= 0) {
    const excelRow = rowIndex + 2; // +1 header, +1 index mulai 0
    sheet.getRange(excelRow, 2, 1, 6).setValues([[sku, name, barcode, price, category, stockMin]]);
    return { success: true, message: 'Produk diperbarui.', productID: productID };
  }

  /* TAMBAH BARU — cegah barcode ganda supaya tidak saling menimpa */
  if (barcode) {
    const dup = existing.find(p => String(p.Barcode).trim() === barcode);
    if (dup) throw new Error('Barcode sudah dipakai oleh: ' + (dup.Name || '-'));
  }
  sheet.appendRow([productID, sku, name, barcode, price, category, stockMin, new Date()]);
  return { success: true, message: 'Produk ditambahkan.', productID: productID };
}

/* ==================== STOK GUDANG ==================== */

function handleAdjustWarehouse(payload, token) {
  requireAuth(token);
  const auth = requireAuth(token);
  const productID = String(payload.productID || '').trim();
  const type      = String(payload.type || '').trim().toLowerCase();
  const qty       = Number(payload.qty || 0);
  const note      = String(payload.note || '').trim();
  if (!productID) throw new Error('ProductID wajib.');
  if (type !== 'in' && type !== 'out') throw new Error('Type harus IN atau OUT.');
  if (qty <= 0) throw new Error('Qty harus > 0.');
  appendRowRaw('WarehouseStock', ['LogID','ProductID','Type','Qty','Note','Timestamp','User','Shift'], [
    'WH-' + Date.now() + '-' + Math.floor(Math.random()*1000),
    productID, type, qty, note, new Date(), auth.username, auth.shift || 'pagi'
  ]);
  return { success: true, message: 'Stok gudang tercatat (' + type.toUpperCase() + ' ' + qty + ').' };
}

function handleGetWarehouseLog(payload, token) {
  requireAuth(token);
  const logs = getSheetData('WarehouseStock');
  const productID = String(payload.productID || '').trim();
  const rows = productID
    ? logs.filter(l => String(l.ProductID) === productID)
    : logs;
  return { success: true, logs: rows };
}

/* ==================== STOK RAK PAJANG (GALERI) ==================== */

function handleAdjustGallery(payload, token) {
  requireAuth(token);
  const auth = requireAuth(token);
  const productID = String(payload.productID || '').trim();
  const type      = String(payload.type || '').trim().toLowerCase();
  const qty       = Number(payload.qty || 0);
  const note      = String(payload.note || '').trim();
  if (!productID) throw new Error('ProductID wajib.');
  if (type !== 'in' && type !== 'out') throw new Error('Type harus IN atau OUT.');
  if (qty <= 0) throw new Error('Qty harus > 0.');
  appendRowRaw('GalleryStock', ['LogID','ProductID','Type','Qty','Note','Timestamp','User','Shift'], [
    'GL-' + Date.now() + '-' + Math.floor(Math.random()*1000),
    productID, type, qty, note, new Date(), auth.username, auth.shift || 'pagi'
  ]);
  return { success: true, message: 'Stok rak pajang tercatat (' + type.toUpperCase() + ' ' + qty + ').' };
}

function handleGetGalleryLog(payload, token) {
  requireAuth(token);
  const logs = getSheetData('GalleryStock');
  const productID = String(payload.productID || '').trim();
  const rows = productID
    ? logs.filter(l => String(l.ProductID) === productID)
    : logs;
  return { success: true, logs: rows };
}



/* ==================== STOK SUMMARY ==================== */

function handleGetStockSummary(token) {
  requireAuth(token);
  const products = getSheetData('Products');
  const whLogs   = getSheetData('WarehouseStock');
  const galLogs  = getSheetData('GalleryStock');

  const summary = products.map(p => {
    const pid = String(p.ProductID);
    const whIn   = whLogs.filter(l => String(l.ProductID) === pid && String(l.Type).toLowerCase() === 'in').reduce((s, l) => s + Number(l.Qty), 0);
    const whOut  = whLogs.filter(l => String(l.ProductID) === pid && String(l.Type).toLowerCase() === 'out').reduce((s, l) => s + Number(l.Qty), 0);
    const whTotal = whIn - whOut;
    const galIn  = galLogs.filter(l => String(l.ProductID) === pid && String(l.Type).toLowerCase() === 'in').reduce((s, l) => s + Number(l.Qty), 0);
    const galOut = galLogs.filter(l => String(l.ProductID) === pid && String(l.Type).toLowerCase() === 'out').reduce((s, l) => s + Number(l.Qty), 0);
    const galTotal = galIn - galOut;
    return {
      ProductID: pid, SKU: p.SKU, Name: p.Name, Barcode: p.Barcode,
      Price: Number(p.Price), Category: p.Category, StockMin: Number(p.StockMin),
      Gudang_IN: whIn, Gudang_OUT: whOut, Gudang_Total: whTotal,
      Rak_IN: galIn, Rak_OUT: galOut, Rak_Total: galTotal,
      TOTAL_STOK: whTotal + galTotal,
      IsBelowMin: (whTotal + galTotal) < Number(p.StockMin)
    };
  });
  return { success: true, summary: summary };
}


/* ==================== PENJUALAN (SALES / POS) ==================== */

function handleSaveSale(payload, token) {
  requireAuth(token);
  const auth = requireAuth(token);
  const saleID    = String(payload.saleID || ('S-' + Date.now() + '-' + Math.floor(Math.random()*1000)));
  const receiptNo = String(payload.receiptNo || '');
  const cashier   = auth.username;
  const shift     = auth.shift || 'pagi';
  const items     = payload.items || [];
  const total     = Number(payload.total || 0);
  if (!items.length) throw new Error('Keranjang kosong.');

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName('Sales');
  const headers = ['SaleID','ReceiptNo','ProductID','SKU','Name','Qty','Price','Subtotal','Cashier','Shift','Timestamp'];
  if (!sheet) {
    sheet = ss.insertSheet('Sales');
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  }
  items.forEach(it => {
    sheet.appendRow([ saleID, receiptNo, it.productID, it.sku, it.name,
      Number(it.qty), Number(it.price), Number(it.qty) * Number(it.price),
      cashier, shift, new Date() ]);
  });

  // auto-reduce gallery stock (OUT) — sold display items
  items.forEach(it => {
    appendRowRaw('GalleryStock', ['LogID','ProductID','Type','Qty','Note','Timestamp','User','Shift'], [
      'GL-SALE-' + Date.now() + '-' + Math.floor(Math.random()*1000),
      String(it.productID), 'out', Number(it.qty), 'Jual #' + receiptNo, new Date(), cashier, shift
    ]);
  });
  return { success: true, message: 'Penjualan tersimpan.', saleID: saleID, receiptNo: receiptNo, total: total };
}

function handleGetSales(payload, token) {
  requireAuth(token);
  const start = payload.start || '';
  const end   = payload.end   || '';
  const shift = payload.shift || '';
  const cashier = payload.cashier || '';
  const sales = getSheetData('Sales');
  let filtered = sales;
  if (start && end) {
    const sd = new Date(start); const ed = new Date(end + 'T23:59:59');
    filtered = filtered.filter(s => { const t = new Date(s.Timestamp); return t >= sd && t <= ed; });
  }
  if (shift) filtered = filtered.filter(s => String(s.Shift) === shift.toLowerCase());
  if (cashier) filtered = filtered.filter(s => String(s.Cashier) === cashier);

  const grouped = {};
  filtered.forEach(s => {
    const key = String(s.SaleID) + '|' + String(s.ReceiptNo);
    if (!grouped[key]) grouped[key] = { SaleID: s.SaleID, ReceiptNo: s.ReceiptNo, items: [], Cashier: s.Cashier, Shift: s.Shift, Timestamp: s.Timestamp, grandTotal: 0 };
    grouped[key].items.push(s);
    grouped[key].grandTotal += Number(s.Subtotal) || 0;
  });
  const result = Object.values(grouped).sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
  const totalQty = filtered.reduce((s, r) => s + Number(r.Qty), 0);
    const grandTotal = filtered.reduce((s, r) => s + Number(r.Subtotal), 0);
  return { success: true, sales: result, summary: { totalQty: totalQty, grandTotal: grandTotal, count: result.length } };
}

/* ==================== DASHBOARD STATS ==================== */

function handleGetDashboardStats(payload, token) {
  requireAuth(token);
  const date     = payload.date || formatDateYYYYMMDD(new Date());
  const sales    = getSheetData('Sales');
  const products = getSheetData('Products');
  const whLogs   = getSheetData('WarehouseStock');
  const galLogs  = getSheetData('GalleryStock');

  const sd = new Date(date + 'T00:00:00');
  const ed = new Date(date + 'T23:59:59');
  const todaySales = sales.filter(s => {
    const t = new Date(s.Timestamp);
    return t >= sd && t <= ed;
  });
  const totalToday = todaySales.reduce((s, r) => s + Number(r.Subtotal), 0);
  const qtyToday   = todaySales.reduce((s, r) => s + Number(r.Qty), 0);
  const trxCount   = (new Set(todaySales.map(s => s.SaleID))).size;

  const shiftSummary = {
    pagi:  todaySales.filter(s => String(s.Shift) === 'pagi').reduce((s, r) => s + Number(r.Subtotal), 0),
    siang: todaySales.filter(s => String(s.Shift) === 'siang').reduce((s, r) => s + Number(r.Subtotal), 0)
  };

  const belowMin = products.map(p => {
    const pid = String(p.ProductID);
    const wh  = whLogs.filter(l => String(l.ProductID) === pid).reduce((s, l) => s + (String(l.Type).toLowerCase() === 'in' ? Number(l.Qty) : -Number(l.Qty)), 0);
    const gal = galLogs.filter(l => String(l.ProductID) === pid).reduce((s, l) => s + (String(l.Type).toLowerCase() === 'in' ? Number(l.Qty) : -Number(l.Qty)), 0);
    const total = wh + gal;
    return { Name: p.Name, TOTAL_STOK: total, StockMin: Number(p.StockMin), Below: total < Number(p.StockMin) };
  }).filter(x => x.Below);

    return { success: true, date: date, totalToday: totalToday, qtyToday: qtyToday,
        trxCount: trxCount, shiftSummary: shiftSummary, belowMin: belowMin };
}


/* ==================== REKAPITULASI ==================== */

function handleGetRekapitulasi(payload, token) {
  requireAuth(token);
  const range   = String(payload.range || 'harian');
  const date    = payload.date   || formatDateYYYYMMDD(new Date());
  const start   = payload.start  || '';
  const end     = payload.end    || '';
  const shift   = payload.shift  || '';
  const cashier = payload.cashier || '';

  let sd, ed;
  [sd, ed] = computeDateRange(range, date, start, end);

  const sales = getSheetData('Sales');
  let filtered = sales.filter(s => {
    const t = new Date(s.Timestamp);
    return t >= new Date(sd + 'T00:00:00') && t <= new Date(ed + 'T23:59:59');
  });
  if (shift) filtered = filtered.filter(s => String(s.Shift) === shift.toLowerCase());
  if (cashier) filtered = filtered.filter(s => String(s.Cashier) === cashier);

  // aggregate per product
  const productAgg = {};
  filtered.forEach(s => {
    const key = String(s.ProductID);
    if (!productAgg[key]) productAgg[key] = { ProductID: s.ProductID, SKU: s.SKU, Name: s.Name, Qty: 0, Total: 0 };
    productAgg[key].Qty   += Number(s.Qty);
    productAgg[key].Total += Number(s.Subtotal);
  });

  // aggregate per shift
  const shiftAgg = { pagi: { Qty: 0, Total: 0 }, siang: { Qty: 0, Total: 0 } };
  filtered.forEach(s => {
    const sh = String(s.Shift || 'pagi');
    if (!shiftAgg[sh]) shiftAgg[sh] = { Qty: 0, Total: 0 };
    shiftAgg[sh].Qty   += Number(s.Qty);
    shiftAgg[sh].Total += Number(s.Subtotal);
  });

  // daily buckets for chart
  const dailyBuckets = {};
  filtered.forEach(s => {
    const d = formatDateYYYYMMDD(new Date(s.Timestamp));
    if (!dailyBuckets[d]) dailyBuckets[d] = { Qty: 0, Total: 0 };
    dailyBuckets[d].Qty   += Number(s.Qty);
    dailyBuckets[d].Total += Number(s.Subtotal);
  });

  const grandTotal = filtered.reduce((s, r) => s + Number(r.Subtotal), 0);
  const grandQty   = filtered.reduce((s, r) => s + Number(r.Qty), 0);

  return {
    success: true, range: range, dateRange: { start: sd, end: ed },
    totals: { totalQty: grandQty, grandTotal: grandTotal, trxCount: (new Set(filtered.map(s => s.SaleID))).size },
    byProduct: Object.values(productAgg),
    byShift:   shiftAgg,
                byDay:     Object.keys(dailyBuckets).map(d => ({ date: d, qty: dailyBuckets[d].Qty, total: dailyBuckets[d].Total }))
                        .sort((a, b) => a.date.localeCompare(b.date))
  };
}


/* ==================== USER MANAGEMENT ==================== */

function handleGetUsers(token) {
  requireAdmin(token);
  const users = getSheetData('Users').map(u => ({
    Username: u.Username, Role: u.Role || 'operator', CreatedAt: u.CreatedAt || ''
  }));
  return { success: true, users: users };
}

function handleManageUser(payload, token) {
  requireAdmin(token);
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const headers = ['Username','PIN','Role','CreatedAt'];
  if (!sheet) {
    const s = ss.insertSheet('Users');
    s.getRange(1,1,1,headers.length).setValues([headers]);
  }
    const username = String(payload.username || '').trim();
  const pin      = String(payload.pin || '').trim();
  const role     = String(payload.role || 'operator').trim();
  const method   = String(payload.method || 'add').trim().toLowerCase();
  if (!username) throw new Error('Username wajib.');
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN harus 4 digit angka.');

  const users = getSheetData('Users');
  if (method === 'add') {
    if (users.find(u => u.Username === username)) throw new Error('Username sudah ada.');
    sheet.appendRow([username, pin, role, new Date()]);
    return { success: true, message: 'User ditambahkan.' };
  }
  if (method === 'edit') {
    const idx = users.findIndex(u => u.Username === username);
    if (idx < 0) throw new Error('User tidak ditemukan.');
    sheet.getRange(idx + 2, 1, 1, headers.length).setValues([[username, pin, role, users[idx].CreatedAt || new Date()]]);
    return { success: true, message: 'User diperbarui.' };
  }
  if (method === 'delete') {
    const idx = users.findIndex(u => u.Username === username);
    if (idx < 0) throw new Error('User tidak ditemukan.');
    sheet.deleteRow(idx + 2);
    return { success: true, message: 'User dihapus.' };
  }
  throw new Error('Method user tidak dikenal: ' + method);
}

function handleChangePin(payload, token) {
  const auth = requireAuth(token);
  const oldPin = String(payload.oldPin || '').trim();
  const newPin = String(payload.newPin || '').trim();
  if (oldPin.length < 1) throw new Error('PIN lama wajib.');
  if (!/^\d{4}$/.test(newPin)) throw new Error('PIN baru harus 4 digit angka.');
  const users = getSheetData('Users');
  const user  = users.find(u => u.Username === auth.username);
  if (!user) throw new Error('User tidak ditemukan.');
  if (String(user.PIN) !== oldPin) throw new Error('PIN lama salah.');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  const rows  = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idxCol  = headers.indexOf('Username');
  const idxPin  = headers.indexOf('PIN');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxCol]) === auth.username) {
      sheet.getRange(i + 1, idxPin + 1).setValue(newPin);
      break;
    }
  }
    return { success: true, message: 'PIN berhasil diganti.' };
}

/* ==================== HELPER SHEET ==================== */

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function appendRowRaw(sheetName, expectedHeaders, rowData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }
  const curHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const missing = expectedHeaders.filter(h => !curHeaders.includes(h));
  if (missing.length) {
    const merged = curHeaders.concat(missing);
    sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
  }
  sheet.appendRow(rowData);
  return sheet;
}

function updateRowByPrimaryKey(sheetName, keyCol, keyValue, rowObj) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const idx = headers.indexOf(keyCol);
    if (String(row[idx]) === String(keyValue)) {
      const newRow = headers.map(h => (rowObj[h] !== undefined ? rowObj[h] : row[headers.indexOf(h)]));
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
      return;
    }
  }
  sheet.appendRow(headers.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
}

/* ==================== DATE / FORMAT HELPERS ==================== */

function formatDateYYYYMMDD(d) {
  if (!(d instanceof Date)) d = new Date(d);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function computeDateRange(range, date, start, end) {
  if (range === 'custom' && start && end) return [start, end];
  if (range === 'harian') { const d = date || formatDateYYYYMMDD(new Date()); return [d, d]; }
  if (range === 'mingguan') {
    const now = new Date(date || new Date());
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return [formatDateYYYYMMDD(monday), formatDateYYYYMMDD(sunday)];
  }
  if (range === 'bulanan') {
    const now = new Date(date || new Date());
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [formatDateYYYYMMDD(first), formatDateYYYYMMDD(last)];
  }
  const d = formatDateYYYYMMDD(new Date());
  return [d, d];
}

/* ==================== SETUP — JALANKAN SEKALI ==================== */

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupSheet(ss, 'Products',
    ['ProductID','SKU','Name','Barcode','Price','Category','StockMin','CreatedAt']);
  setupSheet(ss, 'Sales',
    ['SaleID','ReceiptNo','ProductID','SKU','Name','Qty','Price','Subtotal','Cashier','Shift','Timestamp']);
  setupSheet(ss, 'WarehouseStock',
    ['LogID','ProductID','Type','Qty','Note','Timestamp','User','Shift']);
  setupSheet(ss, 'GalleryStock',
    ['LogID','ProductID','Type','Qty','Note','Timestamp','User','Shift']);

  let userSheet = ss.getSheetByName('Users');
  if (!userSheet) {
    userSheet = ss.insertSheet('Users');
    userSheet.getRange(1,1,1,4).setValues([['Username','PIN','Role','CreatedAt']]);
    userSheet.appendRow(['admin','1234','admin', new Date()]);
  }
  Logger.log('Setup Ms Glow POS selesai. Login default: admin / 1234');
}

function setupSheet(ss, name, headers) {
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  if (s.getLastRow() === 0) {
    s.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    const existing = s.getRange(1,1,1, s.getLastColumn()).getValues()[0].map(String);
    const missing = headers.filter(h => !existing.includes(h));
    if (missing.length) {
      const merged = existing.concat(missing);
      s.getRange(1,1,1, merged.length).setValues([merged]);
    }
  }
}

/* ==================== RESET DARURAT — JALANKAN DARI EDITOR ====================
 * Pilih fungsi resetAdminPin1234 lalu klik Run.
 * Fungsi ini: (1) membersihkan kunci login/lockout, (2) mengembalikan PIN
 * user "admin" menjadi 1234. Hanya pemilik spreadsheet yang bisa menjalankan. */
function resetAdminPin1234() {
  const cache = CacheService.getScriptCache();
  cache.remove('lock_admin');
  cache.remove('rf_admin');

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  if (!sheet) { ss.insertSheet('Users'); }

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0] || ['Username','PIN','Role','CreatedAt'];
  const iu = headers.indexOf('Username'), ip = headers.indexOf('PIN');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iu]).trim().toLowerCase() === 'admin') {
      sheet.getRange(i + 1, ip + 1).setValue('1234');
      Logger.log('OK: PIN admin direset ke 1234 dan kunci login dibersihkan.');
      return;
    }
  }
  sheet.appendRow(['admin', '1234', 'admin', new Date()]);
  Logger.log('OK: User admin dibuat ulang (PIN 1234). Kunci login dibersihkan.');
}
