/**
 * SMARTEK INVENTORY - GOOGLE APPS SCRIPT BACKEND
 * =========================================================
 * Fitur:
 * 1. Penyimpanan Data Utama (Key-Value Database) di Tab Pertama
 * 2. Tab Baru: 'Aktivitas_Pengguna' (Riwayat Pendaftaran, Login, Logout)
 * 3. Tab Baru: 'Sesi_Aktif' (Monitoring Live Session Real-time & Status Online)
 */

var SHEET_DB_NAME = "Database_Storage";
var SHEET_LOG_NAME = "Aktivitas_Pengguna";
var SHEET_SESSION_NAME = "Sesi_Aktif";

// Helper mendapatkan sheet database utama
function getDatabaseSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_DB_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    try {
      sheet.setName(SHEET_DB_NAME);
    } catch(e) {}
  }
  return sheet;
}

// Helper mendapatkan / membuat sheet Aktivitas Pengguna
function getActivitySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOG_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LOG_NAME);
    var headers = ["Waktu (WIB)", "Tipe Aktivitas", "Nama Pengguna", "Email", "Peran (Role)", "Perangkat / Browser", "Session ID", "Catatan"];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#DC2626"); // Smartek Red
    headerRange.setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 170); // Waktu
    sheet.setColumnWidth(2, 130); // Aktivitas
    sheet.setColumnWidth(3, 180); // Nama
    sheet.setColumnWidth(4, 220); // Email
    sheet.setColumnWidth(5, 130); // Role
    sheet.setColumnWidth(6, 200); // Device
    sheet.setColumnWidth(7, 180); // Session ID
    sheet.setColumnWidth(8, 150); // Catatan
  }
  return sheet;
}

// Helper mendapatkan / membuat sheet Sesi Aktif
function getSessionSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SESSION_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SESSION_NAME);
    var headers = ["Session ID", "Nama Pengguna", "Email", "Peran (Role)", "Waktu Mulai Login (WIB)", "Detak Terakhir / Ping (WIB)", "Status Sesi", "Perangkat / Browser"];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1E293B"); // Slate Dark
    headerRange.setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 180); // Session ID
    sheet.setColumnWidth(2, 180); // Nama
    sheet.setColumnWidth(3, 220); // Email
    sheet.setColumnWidth(4, 130); // Role
    sheet.setColumnWidth(5, 170); // Waktu Mulai
    sheet.setColumnWidth(6, 170); // Detak Terakhir
    sheet.setColumnWidth(7, 130); // Status
    sheet.setColumnWidth(8, 200); // Device
  }
  return sheet;
}

/* ==================== GET HANDLER ==================== */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  
  if (action === 'get') {
    var key = e.parameter.key;
    var sheet = getDatabaseSheet();
    var data = sheet.getDataRange().getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        var rawVal = data[i][1];
        var parsed = null;
        try { parsed = JSON.parse(rawVal); } catch(err) { parsed = rawVal; }
        return respondJson({ ok: true, value: parsed });
      }
    }
    return respondJson({ ok: true, value: null });
  }
  
  if (action === 'getAll') {
    var sheet = getDatabaseSheet();
    var data = sheet.getDataRange().getValues();
    var result = {};
    for (var i = 0; i < data.length; i++) {
      var k = data[i][0];
      if (k) {
        var rawVal = data[i][1];
        try { result[k] = JSON.parse(rawVal); } catch(err) { result[k] = rawVal; }
      }
    }
    return respondJson({ ok: true, data: result });
  }
  
  if (action === 'getMeta') {
    var props = PropertiesService.getScriptProperties();
    var latest = props.getProperty('latestUpdate') || '0';
    return respondJson({ ok: true, latestUpdate: parseInt(latest, 10) });
  }
  
  return respondJson({ ok: true, message: 'Smartek Backend API is active.' });
}

/* ==================== POST HANDLER ==================== */
function doPost(e) {
  try {
    var rawBody = e.postData.contents;
    var body = JSON.parse(rawBody);
    var action = body.action || '';
    
    // 1. SET KEY-VALUE DI DATABASE UTAMA
    if (action === 'set') {
      var key = body.key;
      var valueStr = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);
      var sheet = getDatabaseSheet();
      var data = sheet.getDataRange().getValues();
      var rowIndex = -1;
      
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] === key) {
          rowIndex = i + 1;
          break;
        }
      }
      
      var now = Date.now();
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 2).setValue(valueStr);
        sheet.getRange(rowIndex, 3).setValue(now);
      } else {
        sheet.appendRow([key, valueStr, now]);
      }
      
      PropertiesService.getScriptProperties().setProperty('latestUpdate', now.toString());
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
        // Update sesi yang ada
        sessionSheet.getRange(rowIndex, 6).setValue(timeStr); // Detak Terakhir
        sessionSheet.getRange(rowIndex, 7).setValue(statusText); // Status
      } else if (isOnline) {
        // Tambahkan sesi aktif baru
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
