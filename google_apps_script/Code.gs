/**
 * =========================================================================
 * SMARTEK INVENTORY - BACKEND GOOGLE APPS SCRIPT (HYBRID TABULAR DATABASE)
 * =========================================================================
 * 
 * Sistem ini membaca & menulis langsung ke tab-tab spreadsheet rapi:
 * 1. [Data_Barang]         : Master katalog barang, stok, satuan, harga, lokasi
 * 2. [Riwayat_Stok]        : Seluruh transaksi Stock In & Out lengkap dengan akun petugas
 * 3. [Data_Supplier]       : Daftar kontak pemasok
 * 4. [Pengguna_Sistem]     : Daftar user & peran
 * 5. [Aktivitas_Pengguna]  : Log audit pendaftaran, login, logout
 * 6. [Sesi_Aktif]          : Live monitoring status online / offline real-time
 * 7. [_System_Storage]     : Tab teknis konfigurasi & credentials di posisi paling belakang
 */

var SHEET_SYSTEM    = "_System_Storage";
var SHEET_ITEMS     = "Data_Barang";
var SHEET_MOVEMENTS = "Riwayat_Stok";
var SHEET_SUPPLIERS = "Data_Supplier";
var SHEET_USERS     = "Pengguna_Sistem";
var SHEET_LOG       = "Aktivitas_Pengguna";
var SHEET_SESSION   = "Sesi_Aktif";

/**
 * Menu kustom di Google Sheets agar bisa merapikan data kapan saja dengan 1 klik
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📦 Smartek Inventory")
    .addItem("✨ Rapikan Semua Data ke Tab Baru", "RAPIKAN_SEMUA_DATA")
    .addToUi();
}

/**
 * Helper: Ambil sheet sistem (_System_Storage) dengan aman tanpa salah ambil tab Data_Barang
 */
function getDatabaseSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Cari sheet bernama "_System_Storage"
  var sheet = ss.getSheetByName(SHEET_SYSTEM);
  if (sheet) return sheet;
  
  // 2. Cari sheet bernama "Database_Storage"
  sheet = ss.getSheetByName("Database_Storage");
  if (sheet) {
    try { sheet.setName(SHEET_SYSTEM); } catch(e) {}
    return sheet;
  }
  
  // 3. Cari sheet yang baris A1 nya bertuliskan 'key'
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var name = s.getName();
    if (name === SHEET_ITEMS || name === SHEET_MOVEMENTS || name === SHEET_SUPPLIERS || name === SHEET_USERS || name === SHEET_LOG || name === SHEET_SESSION) {
      continue; // Lewati tab tabular tampilan
    }
    var firstCell = String(s.getRange("A1").getValue() || '').trim().toLowerCase();
    if (firstCell === 'key' || firstCell.indexOf('inv:') === 0) {
      try { s.setName(SHEET_SYSTEM); } catch(e) {}
      return s;
    }
  }
  
  // 4. Jika belum ada, buat sheet _System_Storage baru di posisi paling belakang
  var newSheet = ss.insertSheet(SHEET_SYSTEM, ss.getNumSheets());
  newSheet.appendRow(["key", "value", "updatedAt"]);
  newSheet.setTabColor("#64748B");
  return newSheet;
}

/**
 * Helper: Ambil atau buat sheet bertabel dengan header berwarna & rapi
 */
function getOrCreateSheet(sheetName, headers, headerColor) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground(headerColor || "#1E293B");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 32);
  }
  return sheet;
}

/* ==================== PARSER DARI TAB SPREADSHEET KE OBJEK WEB ==================== */

/**
 * Membaca seluruh data barang dari tab [Data_Barang]
 */
function getItemsFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_ITEMS);
  if (!sheet) return { index: [], items: {} };
  var data = sheet.getDataRange().getValues();
  var index = [];
  var items = {};
  
  // Baris 0 adalah Header: No, ID Barang, Nama Barang, Kategori, Qty Stok, Satuan, Min. Ambang, Harga Satuan, Lokasi / Gudang, Status Stok, Terakhir Diperbarui
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = String(row[1] || '').trim();
    if (!id || id === 'ID Barang') continue;
    
    var name = String(row[2] || '').trim();
    var category = String(row[3] || '').trim();
    var qty = Number(row[4]) || 0;
    var unit = String(row[5] || 'pcs').trim();
    var desc = String(row[8] || '').trim();
    var detail = String(row[9] || '').trim();
    // Jika kolom 9 adalah status (misal data format lama tanpa kolom detail)
    if (['AMAN', 'RENDAH', 'HABIS'].includes(detail.toUpperCase())) {
      detail = '';
    }
    
    index.push(id);
    items['inv:item:' + id] = {
      id: id,
      name: name,
      category: category,
      qty: qty,
      unit: unit,
      min: min,
      price: price,
      desc: desc,
      detail: detail,
      photo: null
    };
  }
  return { index: index, items: items };
}

/**
 * Membaca seluruh catatan pergerakan stok dari tab [Riwayat_Stok]
 */
function getMovementsFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_MOVEMENTS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var movements = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var docNo = String(row[1] || '').trim();
    if (!docNo || docNo === 'No. Dokumen') continue;
    
    var date = String(row[2] || '').trim();
    var tipeRaw = String(row[3] || '').toLowerCase();
    var type = tipeRaw.indexOf('keluar') >= 0 ? 'out' : 'in';
    var itemName = String(row[4] || '').trim();
    var qtyStr = String(row[5] || '').replace(/[^0-9]/g, '');
    var qty = Number(qtyStr) || 0;
    var party = String(row[6] || '').trim();
    var operator = String(row[7] || '').trim();
    var operatorEmail = String(row[8] || '').trim();
    var operatorRole = String(row[9] || '').trim();
    
    movements.push({
      id: 'mov_' + i,
      docNo: docNo,
      date: date,
      type: type,
      itemName: itemName,
      qty: qty,
      party: party,
      operator: operator,
      operatorEmail: operatorEmail,
      operatorRole: operatorRole,
      createdAt: Date.now() - (i * 1000)
    });
  }
  return movements;
}

/**
 * Membaca data supplier dari tab [Data_Supplier]
 */
function getSuppliersFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_SUPPLIERS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var suppliers = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = String(row[1] || '').trim();
    var name = String(row[2] || '').trim();
    if (!name || name === 'Nama Supplier') continue;
    
    var contact = String(row[3] || '').trim();
    var phone = String(row[4] || '').trim();
    var status = String(row[5] || 'aktif').trim().toLowerCase();
    
    suppliers.push({
      id: id || ('sup_' + i),
      name: name,
      contact: contact,
      phone: phone,
      status: status,
      createdAt: Date.now()
    });
  }
  return suppliers;
}

/**
 * Membaca data pengguna dari tab [Pengguna_Sistem]
 */
function getUsersFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var users = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = String(row[1] || '').trim();
    var name = String(row[2] || '').trim();
    var email = String(row[3] || '').trim();
    if (!email || email === 'Email') continue;
    
    var role = String(row[4] || 'Pengguna').trim();
    
    users.push({
      id: id || ('user_' + i),
      name: name,
      email: email,
      role: role,
      lastLogin: Date.now()
    });
  }
  return users;
}

/* ==================== SINKRONISASI DARI WEB KE TAB SPREADSHEET ==================== */

/**
 * Update 1 item di tab 'Data_Barang'
 */
function syncItemToSheet(item) {
  if (!item || !item.id) return;
  var sheet = getOrCreateSheet(SHEET_ITEMS, [
    "No", "ID Barang", "Nama Barang", "Kategori", "Qty Stok", "Satuan", "Min. Ambang", "Harga Satuan (Rp)", "Lokasi / Gudang", "Detail / Spesifikasi", "Status Stok", "Terakhir Diperbarui (WIB)"
  ], "#DC2626");

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(item.id)) {
      rowIndex = i + 1;
      break;
    }
  }

  var qty = Number(item.qty) || 0;
  var min = Number(item.min) || 0;
  var status = qty <= 0 ? "HABIS" : (qty <= min ? "RENDAH" : "AMAN");
  var timeStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
  var price = Number(item.price) || 0;

  var rowData = [
    rowIndex > 0 ? (rowIndex - 1) : (data.length === 1 && data[0][0] === "No" ? 1 : data.length),
    item.id,
    item.name || "-",
    item.category || "-",
    qty,
    item.unit || "pcs",
    min,
    price,
    item.desc || "-",
    item.detail || "-",
    status,
    timeStr
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
    var newRow = sheet.getLastRow();
    sheet.getRange(newRow, 8).setNumberFormat('"Rp"#,##0');
    sheet.getRange(newRow, 5).setHorizontalAlignment("center");
    sheet.getRange(newRow, 7).setHorizontalAlignment("center");
    sheet.getRange(newRow, 10).setHorizontalAlignment("center");
  }
}

/**
 * Hapus baris item dari Data_Barang jika ID tidak ada lagi di index
 */
function cleanItemsNotInIndex(activeIds) {
  if (!activeIds || !Array.isArray(activeIds)) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ITEMS);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var id = String(data[i][1] || '').trim();
    if (id && activeIds.indexOf(id) === -1) {
      sheet.deleteRow(i + 1);
    }
  }
  // Renumber No
  var updatedData = sheet.getDataRange().getValues();
  for (var r = 1; r < updatedData.length; r++) {
    sheet.getRange(r + 1, 1).setValue(r);
  }
}

/**
 * Format ulang seluruh data di tab 'Riwayat_Stok'
 */
function syncMovementsToSheet(movements) {
  if (!movements || !Array.isArray(movements)) return;
  var sheet = getOrCreateSheet(SHEET_MOVEMENTS, [
    "No", "No. Dokumen", "Tanggal Transaksi", "Tipe", "Nama Barang", "Jumlah", "Supplier / Tujuan", "Petugas", "Email Petugas", "Peran (Role)", "Waktu Dicatat (WIB)"
  ], "#2563EB");

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 11).clearContent();
  }

  var rows = [];
  for (var i = 0; i < movements.length; i++) {
    var m = movements[i];
    var tipeStr = (m.type === 'in') ? '🟢 MASUK' : '🔴 KELUAR';
    var qtyStr = (m.type === 'in' ? '+' : '-') + (m.qty || 0);
    var recordedAt = m.createdAt ? Utilities.formatDate(new Date(m.createdAt), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss") : '-';

    rows.push([
      i + 1,
      m.docNo || '-',
      m.date || '-',
      tipeStr,
      m.itemName || '-',
      qtyStr,
      m.party || '-',
      m.operator || 'Administrator',
      m.operatorEmail || '-',
      m.operatorRole || '-',
      recordedAt
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 11).setValues(rows);
    sheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 4, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 6, rows.length, 1).setHorizontalAlignment("center");
  }
}

/**
 * Format ulang data di tab 'Data_Supplier'
 */
function syncSuppliersToSheet(suppliers) {
  if (!suppliers || !Array.isArray(suppliers)) return;
  var sheet = getOrCreateSheet(SHEET_SUPPLIERS, [
    "No", "ID Supplier", "Nama Supplier", "Kontak Person", "No. Telepon / WA", "Status", "Waktu Terdaftar (WIB)"
  ], "#059669");

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
  }

  var rows = [];
  for (var i = 0; i < suppliers.length; i++) {
    var s = suppliers[i];
    var createdAt = s.createdAt ? Utilities.formatDate(new Date(s.createdAt), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss") : '-';
    rows.push([
      i + 1,
      s.id || '-',
      s.name || '-',
      s.contact || '-',
      s.phone || '-',
      (s.status === 'aktif' ? 'Aktif' : 'Nonaktif'),
      createdAt
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
    sheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 6, rows.length, 1).setHorizontalAlignment("center");
  }
}

/**
 * Format ulang data di tab 'Pengguna_Sistem'
 */
function syncUsersToSheet(users) {
  if (!users || !Array.isArray(users)) return;
  var sheet = getOrCreateSheet(SHEET_USERS, [
    "No", "ID", "Nama Pengguna", "Email", "Peran (Role)", "Terakhir Login (WIB)"
  ], "#4F46E5");

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 6).clearContent();
  }

  var rows = [];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var lastLogin = u.lastLogin ? Utilities.formatDate(new Date(u.lastLogin), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss") : '-';
    rows.push([
      i + 1,
      u.id || '-',
      u.name || '-',
      u.email || '-',
      u.role || 'Staf',
      lastLogin
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
    sheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment("center");
  }
}

/* ==================== FUNGSI UTAMA: RAPIKAN SEMUA DATA ==================== */
function RAPIKAN_SEMUA_DATA() {
  return RAPAPIKAN_SEMUA_DATA();
}

function RAPAPIKAN_SEMUA_DATA() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sysSheet = getDatabaseSheet();
  var data = sysSheet.getDataRange().getValues();

  var rawMap = {};
  for (var i = 0; i < data.length; i++) {
    var k = data[i][0];
    if (k) {
      try { rawMap[k] = JSON.parse(data[i][1]); } catch(e) { rawMap[k] = data[i][1]; }
    }
  }

  // 1. Rapikan Data_Barang jika data mentah masih ada di storage
  var index = rawMap['inv:index'] || [];
  var items = [];
  for (var j = 0; j < index.length; j++) {
    var it = rawMap['inv:item:' + index[j]];
    if (it) items.push(it);
  }
  if (items.length === 0) {
    for (var key in rawMap) {
      if (key.indexOf('inv:item:') === 0) items.push(rawMap[key]);
    }
  }

  if (items.length > 0) {
    var itemSheet = getOrCreateSheet(SHEET_ITEMS, [
      "No", "ID Barang", "Nama Barang", "Kategori", "Qty Stok", "Satuan", "Min. Ambang", "Harga Satuan (Rp)", "Lokasi / Gudang", "Detail / Spesifikasi", "Status Stok", "Terakhir Diperbarui (WIB)"
    ], "#DC2626");
    
    var lastRow = itemSheet.getLastRow();
    if (lastRow > 1) {
      itemSheet.getRange(2, 1, lastRow - 1, 12).clearContent();
    }

    var itemRows = [];
    for (var x = 0; x < items.length; x++) {
      var item = items[x];
      var qty = Number(item.qty) || 0;
      var min = Number(item.min) || 0;
      var status = qty <= 0 ? "HABIS" : (qty <= min ? "RENDAH" : "AMAN");
      var timeStr = item.createdAt ? Utilities.formatDate(new Date(item.createdAt), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss") : '-';
      itemRows.push([
        x + 1,
        item.id || '-',
        item.name || '-',
        item.category || '-',
        qty,
        item.unit || 'pcs',
        min,
        Number(item.price) || 0,
        item.desc || '-',
        item.detail || '-',
        status,
        timeStr
      ]);
    }
    if (itemRows.length > 0) {
      itemSheet.getRange(2, 1, itemRows.length, 12).setValues(itemRows);
      itemSheet.getRange(2, 1, itemRows.length, 1).setHorizontalAlignment("center");
      itemSheet.getRange(2, 5, itemRows.length, 1).setHorizontalAlignment("center");
      itemSheet.getRange(2, 7, itemRows.length, 1).setHorizontalAlignment("center");
      itemSheet.getRange(2, 8, itemRows.length, 1).setNumberFormat('"Rp"#,##0');
      itemSheet.getRange(2, 11, itemRows.length, 1).setHorizontalAlignment("center");
    }
    for (var c = 1; c <= 12; c++) { itemSheet.autoResizeColumn(c); }
  }

  // 2. Rapikan Riwayat_Stok
  if (rawMap['inv:movements']) {
    syncMovementsToSheet(rawMap['inv:movements']);
    var movSheet = ss.getSheetByName(SHEET_MOVEMENTS);
    if (movSheet) { for (var mc = 1; mc <= 11; mc++) { movSheet.autoResizeColumn(mc); } }
  }

  // 3. Rapikan Data_Supplier
  if (rawMap['inv:suppliers']) {
    syncSuppliersToSheet(rawMap['inv:suppliers']);
    var supSheet = ss.getSheetByName(SHEET_SUPPLIERS);
    if (supSheet) { for (var sc = 1; sc <= 7; sc++) { supSheet.autoResizeColumn(sc); } }
  }

  // 4. Rapikan Pengguna_Sistem
  if (rawMap['inv:settings:users']) {
    syncUsersToSheet(rawMap['inv:settings:users']);
    var userSheet = ss.getSheetByName(SHEET_USERS);
    if (userSheet) { for (var uc = 1; uc <= 6; uc++) { userSheet.autoResizeColumn(uc); } }
  }

  // 5. Pastikan Sheet Log & Session sudah ada
  getActivitySheet();
  getSessionSheet();

  // 6. Pindahkan tab _System_Storage ke urutan paling akhir
  try {
    sysSheet.setName(SHEET_SYSTEM);
    sysSheet.setTabColor("#64748B");
    ss.setActiveSheet(sysSheet);
    ss.moveActiveSheet(ss.getNumSheets());
    var topItemSheet = ss.getSheetByName(SHEET_ITEMS);
    if (topItemSheet) ss.setActiveSheet(topItemSheet);
  } catch(e) {}

  return "Database berhasil dirapikan ke dalam tab-tab spreadsheet yang rapi!";
}

/* ==================== AUDIT LOG & LIVE SESSION ==================== */
function getActivitySheet() {
  return getOrCreateSheet(SHEET_LOG, [
    "Waktu (WIB)", "Tipe Aktivitas", "Nama Pengguna", "Email", "Peran (Role)", "Perangkat / Browser", "Session ID", "Catatan"
  ], "#B91C1C");
}

function getSessionSheet() {
  return getOrCreateSheet(SHEET_SESSION, [
    "Session ID", "Nama Pengguna", "Email", "Peran (Role)", "Waktu Mulai Login (WIB)", "Detak Terakhir / Ping (WIB)", "Status Sesi", "Perangkat / Browser"
  ], "#0F172A");
}

/* ==================== GET HANDLER (API) ==================== */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. GET ALL DATA: Gabungkan data dari Tabular Master + Storage
  if (action === 'getAll') {
    var result = {};
    
    // a. Baca setting & credentials dari sheet sistem
    var sysSheet = getDatabaseSheet();
    var sysData = sysSheet.getDataRange().getValues();
    for (var i = 0; i < sysData.length; i++) {
      var k = String(sysData[i][0] || '').trim();
      if (k && k !== 'key' && k !== 'No') {
        var rawVal = sysData[i][1];
        try { result[k] = JSON.parse(rawVal); } catch(err) { result[k] = rawVal; }
      }
    }
    
    // b. Baca master barang langsung dari tab [Data_Barang]
    var itemRes = getItemsFromSheet(ss);
    if (itemRes.index.length > 0) {
      result['inv:index'] = itemRes.index;
      for (var itemId in itemRes.items) {
        if (result[itemId] && result[itemId].photo) {
          itemRes.items[itemId].photo = result[itemId].photo;
        }
        result[itemId] = itemRes.items[itemId];
      }
    }
    
    // c. Baca pergerakan stok dari tab [Riwayat_Stok] jika ada
    var movs = getMovementsFromSheet(ss);
    if (movs.length > 0 && (!result['inv:movements'] || result['inv:movements'].length === 0)) {
      result['inv:movements'] = movs;
    }
    
    // d. Baca supplier dari tab [Data_Supplier] jika ada
    var sups = getSuppliersFromSheet(ss);
    if (sups.length > 0 && (!result['inv:suppliers'] || result['inv:suppliers'].length === 0)) {
      result['inv:suppliers'] = sups;
    }
    
    // e. Baca pengguna dari tab [Pengguna_Sistem] jika ada
    var usrs = getUsersFromSheet(ss);
    if (usrs.length > 0 && (!result['inv:settings:users'] || result['inv:settings:users'].length === 0)) {
      result['inv:settings:users'] = usrs;
    }
    
    return respondJson({ ok: true, data: result });
  }

  // 2. GET SPECIFIC KEY
  if (action === 'get') {
    var key = e.parameter.key;
    if (key === 'inv:index') {
      var itemRes = getItemsFromSheet(ss);
      return respondJson({ ok: true, value: itemRes.index });
    }
    if (key.indexOf('inv:item:') === 0) {
      var itemRes = getItemsFromSheet(ss);
      if (itemRes.items[key]) {
        return respondJson({ ok: true, value: itemRes.items[key] });
      }
    }
    if (key === 'inv:movements') {
      var movs = getMovementsFromSheet(ss);
      if (movs.length > 0) return respondJson({ ok: true, value: movs });
    }
    if (key === 'inv:suppliers') {
      var sups = getSuppliersFromSheet(ss);
      if (sups.length > 0) return respondJson({ ok: true, value: sups });
    }
    
    // Fallback ke system storage
    var sheet = getDatabaseSheet();
    var data = sheet.getDataRange().getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(key)) {
        var rawVal = data[i][1];
        var parsed = null;
        try { parsed = JSON.parse(rawVal); } catch(err) { parsed = rawVal; }
        return respondJson({ ok: true, value: parsed });
      }
    }
    return respondJson({ ok: true, value: null });
  }
  
  // 3. GET META (LATEST UPDATE TIME)
  if (action === 'getMeta') {
    var props = PropertiesService.getScriptProperties();
    var latest = props.getProperty('latestUpdate') || '0';
    return respondJson({ ok: true, latestUpdate: parseInt(latest, 10) });
  }

  // 4. DEBUG INFO
  if (action === 'debug') {
    var allSheets = ss.getSheets().map(function(s){ return s.getName(); });
    var itemRes = getItemsFromSheet(ss);
    return respondJson({
      ok: true,
      sheets: allSheets,
      itemCount: itemRes.index.length,
      sampleItems: itemRes.index.slice(0, 5)
    });
  }
  
  return respondJson({ ok: true, message: 'Smartek Backend API is active.' });
}

/* ==================== POST HANDLER (API) ==================== */
function doPost(e) {
  try {
    var rawBody = e.postData.contents;
    var body = JSON.parse(rawBody);
    var action = body.action || '';
    
    // 1. SET DATA (Simpan di Key-Value Storage & Update Tab Terkait Secara Real-time)
    if (action === 'set') {
      var key = body.key;
      var valueObj = body.value;
      var valueStr = typeof valueObj === 'string' ? valueObj : JSON.stringify(valueObj);
      var sysSheet = getDatabaseSheet();
      var data = sysSheet.getDataRange().getValues();
      var rowIndex = -1;
      
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][0]) === String(key)) {
          rowIndex = i + 1;
          break;
        }
      }
      
      var now = Date.now();
      if (rowIndex > 0) {
        sysSheet.getRange(rowIndex, 2).setValue(valueStr);
        sysSheet.getRange(rowIndex, 3).setValue(now);
      } else {
        sysSheet.appendRow([key, valueStr, now]);
      }
      
      PropertiesService.getScriptProperties().setProperty('latestUpdate', now.toString());

      // SINKRONKAN KE TAB TABULAR RAPI SESUAI KATEGORI
      try {
        if (key.indexOf('inv:item:') === 0) {
          var itemData = (typeof valueObj === 'string') ? JSON.parse(valueObj) : valueObj;
          syncItemToSheet(itemData);
        } else if (key === 'inv:index') {
          var activeIds = (typeof valueObj === 'string') ? JSON.parse(valueObj) : valueObj;
          cleanItemsNotInIndex(activeIds);
        } else if (key === 'inv:movements') {
          var movData = (typeof valueObj === 'string') ? JSON.parse(valueObj) : valueObj;
          syncMovementsToSheet(movData);
        } else if (key === 'inv:suppliers') {
          var supData = (typeof valueObj === 'string') ? JSON.parse(valueObj) : valueObj;
          syncSuppliersToSheet(supData);
        } else if (key === 'inv:settings:users') {
          var userData = (typeof valueObj === 'string') ? JSON.parse(valueObj) : valueObj;
          syncUsersToSheet(userData);
        }
      } catch(syncErr) {}

      return respondJson({ ok: true, updatedAt: now });
    }
    
    // 2. LOG AKTIVITAS (DAFTAR, LOGIN, LOGOUT)
    if (action === 'logActivity') {
      var logSheet = getActivitySheet();
      var timeStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      
      logSheet.appendRow([
        timeStr,
        body.actionType || 'LOGIN',
        body.userName || '-',
        body.email || '-',
        body.role || '-',
        body.device || 'Browser',
        body.sessionId || '-',
        body.note || '-'
      ]);
      
      return respondJson({ ok: true, loggedAt: timeStr });
    }
    
    // 3. LIVE SESSION (PING / HEARTBEAT & STATUS ONLINE)
    if (action === 'liveSession') {
      var sessionSheet = getSessionSheet();
      var timeStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      var data = sessionSheet.getDataRange().getValues();
      var rowIndex = -1;
      var sessionId = body.sessionId || '';
      
      if (sessionId) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === sessionId) {
            rowIndex = i + 1;
            break;
          }
        }
      }
      
      var isOnline = (body.isOnline !== false);
      var statusText = isOnline ? "🟢 ONLINE" : "⚪ OFFLINE";
      
      if (rowIndex > 0) {
        sessionSheet.getRange(rowIndex, 6).setValue(timeStr);
        sessionSheet.getRange(rowIndex, 7).setValue(statusText);
      } else if (isOnline) {
        sessionSheet.appendRow([
          sessionId,
          body.userName || '-',
          body.email || '-',
          body.role || '-',
          timeStr,
          timeStr,
          statusText,
          body.device || 'Browser'
        ]);
      }
      
      return respondJson({ ok: true, sessionId: sessionId, status: statusText });
    }
    
    return respondJson({ ok: false, error: 'Unknown action' });
  } catch(err) {
    return respondJson({ ok: false, error: err.toString() });
  }
}

function respondJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
