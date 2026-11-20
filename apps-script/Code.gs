/**
 * Car Care connector: lets the Car Care app read and write this Google Sheet.
 *
 * One-time setup (easiest on a computer):
 *  1. In the sheet: Extensions → Apps Script. Replace everything with this file and Save.
 *  2. Pick "makeKey" in the function menu at the top and press Run. Allow access when asked.
 *     Open "Execution log" and copy the key it prints. You'll paste it into the app.
 *  3. Deploy → New deployment → gear icon → Web app.
 *     Execute as: Me.  Who has access: Anyone.  Deploy, then copy the Web app URL.
 *  4. In the app: Settings → paste the URL and the key → Test connection.
 *
 * After editing this script later: Deploy → Manage deployments → pencil → Version: New version → Deploy.
 * (The URL stays the same.)
 *
 * The sheet is matched by column header names, so you can reorder columns or add your own.
 */

var SHEETS = { vehicles: 'Vehicles', log: 'Service Log', schedule: 'Schedule' };

/** Run once from the editor. Creates a random key, saves it, and prints it. */
function makeKey() {
  var key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_KEY', key);
  Logger.log('Your Car Care key (paste it into the app): ' + key);
}

/** Opening the URL in a browser just shows that it's running. No data without the key. */
function doGet() {
  return json_({ ok: true, message: 'Car Care connector is running.' });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Bad request.' });
  }
  var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key) return json_({ ok: false, error: 'No key set yet. Run makeKey in Apps Script.' });
  if (req.key !== key) return json_({ ok: false, error: 'Wrong key.' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (req.action) {
      case 'all':
        return json_({ ok: true, data: all_() });
      case 'addService':
        addService_(req);
        break;
      case 'deleteService':
        deleteService_(req.id);
        break;
      case 'setMileage':
        setMileage_(req.vehicle, Number(req.mileage), true);
        break;
      case 'addScheduleItem':
        addScheduleItem_(req);
        break;
      default:
        return json_({ ok: false, error: 'Unknown action: ' + req.action });
    }
    SpreadsheetApp.flush(); // let the formulas recalculate before reading
    return json_({ ok: true, data: all_() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- reading ----------

function all_() {
  return {
    vehicles: table_(SHEETS.vehicles),
    log: table_(SHEETS.log),
    schedule: table_(SHEETS.schedule),
    sheetUrl: SpreadsheetApp.getActive().getUrl(),
  };
}

/** Rows as objects keyed by header. Dates become "yyyy-MM-dd". Blank rows are skipped. */
function table_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(String);
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (v) { return v === '' || v === null; })) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = row[c];
      obj[headers[c]] = v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v;
    }
    out.push(obj);
  }
  return out;
}

// ---------- writing ----------

function addService_(req) {
  var vehicle = String(req.vehicle || '').trim();
  var service = String(req.service || '').trim();
  if (!vehicle || !service) throw new Error('Vehicle and service are required.');
  var mileage = req.mileage === '' || req.mileage == null ? '' : Number(req.mileage);
  append_(SHEETS.log, {
    'ID': Utilities.getUuid().slice(0, 8),
    'Date': parseDate_(req.date),
    'Vehicle': vehicle,
    'Mileage': mileage,
    'Service': service,
    'Cost': req.cost === '' || req.cost == null ? '' : Number(req.cost),
    'Shop / who': String(req.shop || ''),
    'Notes': String(req.notes || ''),
    'Entered': new Date(),
  });
  if (mileage !== '' && !isNaN(mileage)) setMileage_(vehicle, mileage, false);
}

function deleteService_(id) {
  var sh = sheet_(SHEETS.log);
  var col = colOf_(sh, 'ID');
  var ids = sh.getRange(2, col, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sh.deleteRow(i + 2);
      return;
    }
  }
  throw new Error('Entry not found.');
}

/** Update a vehicle's current miles. Unless forced, only moves it forward. */
function setMileage_(vehicle, miles, force) {
  if (isNaN(miles)) throw new Error('Mileage must be a number.');
  var sh = sheet_(SHEETS.vehicles);
  var nameCol = colOf_(sh, 'Vehicle');
  var milesCol = colOf_(sh, 'Current miles');
  var dateCol = colOf_(sh, 'Miles updated');
  var names = sh.getRange(2, nameCol, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0]) === vehicle) {
      var cell = sh.getRange(i + 2, milesCol);
      var current = Number(cell.getValue()) || 0;
      if (force || miles > current) {
        cell.setValue(miles);
        sh.getRange(i + 2, dateCol).setValue(new Date());
      }
      return;
    }
  }
  throw new Error('Vehicle not found: ' + vehicle);
}

/** New schedule row; the calculated columns are copied from the row above. */
function addScheduleItem_(req) {
  var sh = sheet_(SHEETS.schedule);
  var last = sh.getLastRow();
  append_(SHEETS.schedule, {
    'Vehicle': String(req.vehicle || ''),
    'Service': String(req.service || ''),
    'Every (miles)': req.miles ? Number(req.miles) : '',
    'Every (months)': req.months ? Number(req.months) : '',
  });
  if (last >= 2) {
    var first = colOf_(sh, 'Last done');
    var width = sh.getLastColumn() - first + 1;
    sh.getRange(last, first, 1, width).copyTo(sh.getRange(last + 1, first, 1, width));
  }
}

// ---------- helpers ----------

function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing tab: ' + name);
  return sh;
}

function colOf_(sh, header) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var i = headers.indexOf(header);
  if (i < 0) throw new Error('Missing column "' + header + '" in ' + sh.getName());
  return i + 1;
}

function append_(name, obj) {
  var sh = sheet_(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(headers.map(function (h) { return h in obj ? obj[h] : ''; }));
}

/** "2026-11-20" → a Date at local midnight. Missing → today. */
function parseDate_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
