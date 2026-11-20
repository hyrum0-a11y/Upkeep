/**
 * Upkeep connector: lets the Upkeep app read and write this Google Sheet
 * (vehicles, equipment, service log, schedule).
 *
 * One-time setup (easiest on a computer):
 *  1. In the sheet: Extensions → Apps Script. Replace everything with this file and Save.
 *  2. Pick "setup" in the function menu at the top and press Run. Allow access when asked
 *     (Advanced → Go to project, since it's your own script).
 *     It lays out the tabs (only while the Service Log is still empty) and prints your key
 *     in the Execution log. Copy the key; you'll paste it into the app.
 *  3. Deploy → New deployment → gear icon → Web app.
 *     Execute as: Me.  Who has access: Anyone.  Deploy, then copy the Web app URL.
 *  4. In the app: Settings → paste the URL and the key → Test & save.
 *
 * After editing this script later: Deploy → Manage deployments → pencil → Version: New version → Deploy.
 * (The URL stays the same.) Run "newKey" if you ever want to replace the key.
 *
 * Columns are found by their header names, so you can reorder them or add your own.
 */

var SHEETS = { items: 'Equipment', log: 'Service Log', schedule: 'Schedule', readme: 'Read me' };

var ITEM_HEADERS = ['Item', 'Type', 'Year', 'Make', 'Model', 'Meter', 'Current reading', 'Reading updated', 'Notes'];
var LOG_HEADERS = ['ID', 'Date', 'Item', 'Reading', 'Service', 'Cost', 'Shop / who', 'Notes', 'Entered'];
var SCHEDULE_HEADERS = ['Item', 'Service', 'Every (mi/hr)', 'Every (months)', 'Last done', 'Last reading',
  'Current reading', 'Next due date', 'Next due reading', 'Status'];

// Meter: "miles", "hours", or blank for things without one (like a water filter).
var START_ITEMS = [
  ['Odyssey', 'Vehicle', 2003, 'Honda', 'Odyssey EX', 'miles', '', '', ''],
  ['Sentra', 'Vehicle', 2020, 'Nissan', 'Sentra SV', 'miles', '', '', ''],
  ['Silverado', 'Vehicle', 2000, 'Chevrolet', 'Silverado', 'miles', '', '', ''],
  ["Claire's Hyundai", 'Vehicle', '', 'Hyundai', '', 'miles', '', '', 'Add the year and model'],
  ['Water filter', 'Equipment', '', '', '', '', '', '', 'Add the filter type or part number'],
];

// Starting-point intervals [item, service, every miles/hours, every months]. Check each owner's manual.
var START_SCHEDULE = [
  ['Odyssey', 'Oil & filter', 5000, 6],
  ['Odyssey', 'Tire rotation', 7500, 6],
  ['Odyssey', 'Engine air filter', 15000, 12],
  ['Odyssey', 'Cabin air filter', 15000, 12],
  ['Odyssey', 'Brake inspection', 15000, 12],
  ['Odyssey', 'Transmission fluid', 30000, 24],
  ['Odyssey', 'Coolant', 60000, 60],
  ['Odyssey', 'Spark plugs', 105000, 84],
  ['Odyssey', 'Timing belt & water pump', 105000, 84],
  ['Sentra', 'Oil & filter', 5000, 6],
  ['Sentra', 'Tire rotation', 7500, 6],
  ['Sentra', 'Engine air filter', 15000, 12],
  ['Sentra', 'Cabin air filter', 15000, 12],
  ['Sentra', 'Brake inspection', 15000, 12],
  ['Sentra', 'CVT fluid', 60000, 48],
  ['Sentra', 'Coolant', 60000, 60],
  ['Sentra', 'Spark plugs', 105000, 84],
  ['Silverado', 'Oil & filter', 5000, 6],
  ['Silverado', 'Tire rotation', 7500, 6],
  ['Silverado', 'Engine air filter', 15000, 12],
  ['Silverado', 'Brake inspection', 15000, 12],
  ['Silverado', 'Transmission fluid', 50000, 48],
  ['Silverado', 'Coolant', 100000, 60],
  ['Silverado', 'Spark plugs', 100000, 84],
  ["Claire's Hyundai", 'Oil & filter', 5000, 6],
  ["Claire's Hyundai", 'Tire rotation', 7500, 6],
  ["Claire's Hyundai", 'Engine air filter', 15000, 12],
  ["Claire's Hyundai", 'Cabin air filter', 15000, 12],
  ["Claire's Hyundai", 'Brake inspection', 15000, 12],
  ["Claire's Hyundai", 'Coolant', 60000, 60],
  ["Claire's Hyundai", 'Spark plugs', 100000, 84],
  ['Water filter', 'Filter change', '', 6],
];

var README = [
  'Maintenance Log',
  '',
  'Equipment: one row per vehicle or piece of equipment. "Item" is the short name used everywhere else.',
  '  Type: Vehicle or Equipment.  Meter: miles, hours, or blank if it has no meter (like a water filter).',
  'Service Log: every oil change, filter change, repair, or check. The app adds rows; you can type them in too.',
  'Schedule: how often each service is due. Last done, next due and Status fill in by themselves from the Service Log.',
  '  Status: OK, Due soon (within about 10% of the interval, at most 30 days), Overdue, or No record yet.',
  '  A log entry counts only when its Item and Service match the Schedule exactly.',
  'The starting intervals are general guesses. Check each owner\'s manual and adjust "Every (mi/hr)" and "Every (months)".',
];

// ---------- setup ----------

/** Run once from the editor: lays out the tabs (if no service is logged yet) and prints the key. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var log = ss.getSheetByName(SHEETS.log);
  if (log && log.getLastRow() > 1) {
    Logger.log('The Service Log already has entries, so the tabs were left as they are.');
  } else {
    buildSheet_(ss);
    Logger.log('Tabs are set up: Read me, Equipment, Service Log, Schedule.');
  }
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('API_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('API_KEY', key);
  }
  Logger.log('Your Upkeep key (paste it into the app): ' + key);
}

/** Replace the key (the app will need the new one). */
function newKey() {
  var key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_KEY', key);
  Logger.log('New Upkeep key: ' + key);
}

function buildSheet_(ss) {
  var old = ss.getSheets();
  // Temporary names so the new tabs can take the real ones.
  old.forEach(function (sh, i) { sh.setName('old-' + i + '-' + Date.now()); });

  var readme = ss.insertSheet(SHEETS.readme, 0);
  readme.getRange(1, 1, README.length, 1).setValues(README.map(function (l) { return [l]; }));
  readme.getRange('A1').setFontSize(14).setFontWeight('bold');
  readme.setColumnWidth(1, 900);

  var items = ss.insertSheet(SHEETS.items, 1);
  header_(items, ITEM_HEADERS, [140, 90, 60, 100, 110, 70, 120, 120, 280]);
  items.getRange(2, 1, START_ITEMS.length, ITEM_HEADERS.length).setValues(START_ITEMS);
  items.getRange('G2:G').setNumberFormat('#,##0');
  items.getRange('H2:H').setNumberFormat('mmm d, yyyy');
  items.getRange('B2:B').setDataValidation(list_(['Vehicle', 'Equipment']));
  items.getRange('F2:F').setDataValidation(list_(['miles', 'hours']));

  var itemList = SpreadsheetApp.newDataValidation()
    .requireValueInRange(items.getRange('A2:A'), true).setAllowInvalid(true).build();

  var log = ss.insertSheet(SHEETS.log, 2);
  header_(log, LOG_HEADERS, [80, 100, 140, 90, 190, 80, 130, 280, 140]);
  log.getRange('B2:B').setNumberFormat('mmm d, yyyy');
  log.getRange('D2:D').setNumberFormat('#,##0');
  log.getRange('F2:F').setNumberFormat('$#,##0.00');
  log.getRange('C2:C').setDataValidation(itemList);

  var sch = ss.insertSheet(SHEETS.schedule, 3);
  header_(sch, SCHEDULE_HEADERS, [140, 190, 100, 105, 100, 100, 115, 110, 125, 90]);
  sch.getRange(2, 1, START_SCHEDULE.length, 4).setValues(START_SCHEDULE);
  for (var r = 2; r < START_SCHEDULE.length + 2; r++) setScheduleFormulas_(sch, r);
  sch.getRange('C2:C').setNumberFormat('#,##0');
  sch.getRange('F2:G').setNumberFormat('#,##0');
  sch.getRange('I2:I').setNumberFormat('#,##0');
  sch.getRange('E2:E').setNumberFormat('mmm d, yyyy');
  sch.getRange('H2:H').setNumberFormat('mmm d, yyyy');
  sch.getRange('A2:A').setDataValidation(itemList);

  old.forEach(function (sh) { ss.deleteSheet(sh); });
  ss.setActiveSheet(items);
}

function header_(sh, headers, widths) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1F4E8C').setWrap(true);
  sh.setFrozenRows(1);
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function list_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(true).build();
}

/** Columns E–J of a Schedule row: worked out from the Service Log and Equipment tabs. */
function setScheduleFormulas_(sh, r) {
  var L = "'Service Log'";
  sh.getRange(r, 5, 1, 6).setFormulas([[
    '=IF(COUNTIFS(' + L + '!$C:$C,$A' + r + ',' + L + '!$E:$E,$B' + r + ')=0,"",MAXIFS(' + L + '!$B:$B,' + L + '!$C:$C,$A' + r + ',' + L + '!$E:$E,$B' + r + '))',
    '=IF(E' + r + '="","",IF(MAXIFS(' + L + '!$D:$D,' + L + '!$C:$C,$A' + r + ',' + L + '!$E:$E,$B' + r + ')=0,"",MAXIFS(' + L + '!$D:$D,' + L + '!$C:$C,$A' + r + ',' + L + '!$E:$E,$B' + r + ')))',
    '=IFERROR(IF(VLOOKUP($A' + r + ',Equipment!$A:$G,7,FALSE)="","",VLOOKUP($A' + r + ',Equipment!$A:$G,7,FALSE)),"")',
    '=IF(OR(E' + r + '="",D' + r + '=""),"",EDATE(E' + r + ',D' + r + '))',
    '=IF(OR(F' + r + '="",C' + r + '=""),"",F' + r + '+C' + r + ')',
    '=IF(E' + r + '="","No record",' +
      'IF(OR(AND(H' + r + '<>"",H' + r + '<=TODAY()),AND(I' + r + '<>"",G' + r + '<>"",G' + r + '>=I' + r + ')),"Overdue",' +
      'IF(OR(AND(H' + r + '<>"",H' + r + '-TODAY()<=MIN(30,D' + r + '*3)),AND(I' + r + '<>"",G' + r + '<>"",I' + r + '-G' + r + '<=C' + r + '*0.1)),"Due soon","OK")))',
  ]]);
}

// ---------- web app ----------

/** Opening the URL in a browser just shows that it's running. No data without the key. */
function doGet() {
  return json_({ ok: true, message: 'Upkeep connector is running.' });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Bad request.' });
  }
  var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key) return json_({ ok: false, error: 'No key set yet. Run setup in Apps Script.' });
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
      case 'setReading':
        setReading_(String(req.item || ''), Number(req.reading), true);
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
    items: table_(SHEETS.items),
    log: table_(SHEETS.log),
    schedule: table_(SHEETS.schedule),
    sheetUrl: SpreadsheetApp.getActive().getUrl(),
  };
}

/** Rows as objects keyed by header. Dates become "yyyy-MM-dd". Blank rows are skipped. */
function table_(name) {
  var values = sheet_(name).getDataRange().getValues();
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
  var item = String(req.item || '').trim();
  var service = String(req.service || '').trim();
  if (!item || !service) throw new Error('Item and service are required.');
  var reading = req.reading === '' || req.reading == null ? '' : Number(req.reading);
  append_(SHEETS.log, {
    'ID': Utilities.getUuid().slice(0, 8),
    'Date': parseDate_(req.date),
    'Item': item,
    'Reading': reading,
    'Service': service,
    'Cost': req.cost === '' || req.cost == null ? '' : Number(req.cost),
    'Shop / who': String(req.shop || ''),
    'Notes': String(req.notes || ''),
    'Entered': new Date(),
  });
  if (reading !== '' && !isNaN(reading)) setReading_(item, reading, false);
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

/** Update an item's odometer / hour meter. Unless forced, only moves it forward. */
function setReading_(item, reading, force) {
  if (isNaN(reading)) throw new Error('The reading must be a number.');
  var sh = sheet_(SHEETS.items);
  var nameCol = colOf_(sh, 'Item');
  var readCol = colOf_(sh, 'Current reading');
  var dateCol = colOf_(sh, 'Reading updated');
  var names = sh.getRange(2, nameCol, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0]) === item) {
      var cell = sh.getRange(i + 2, readCol);
      var current = Number(cell.getValue()) || 0;
      if (force || reading > current) {
        cell.setValue(reading);
        sh.getRange(i + 2, dateCol).setValue(new Date());
      }
      return;
    }
  }
  throw new Error('Item not found: ' + item);
}

/** New Schedule row with its calculated columns. */
function addScheduleItem_(req) {
  append_(SHEETS.schedule, {
    'Item': String(req.item || ''),
    'Service': String(req.service || ''),
    'Every (mi/hr)': req.every ? Number(req.every) : '',
    'Every (months)': req.months ? Number(req.months) : '',
  });
  var sh = sheet_(SHEETS.schedule);
  setScheduleFormulas_(sh, sh.getLastRow());
}

// ---------- helpers ----------

function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing tab: ' + name + '. Run setup in Apps Script.');
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
