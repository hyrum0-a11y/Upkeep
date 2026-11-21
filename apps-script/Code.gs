/**
 * Upkeep connector: lets the Upkeep app read and write this Google Sheet
 * (vehicles, equipment, service log, schedule).
 *
 * One-time setup (easiest on a computer):
 *  1. In the sheet: Extensions → Apps Script. Replace everything with this file and Save.
 *  2. Pick "setup" in the function menu at the top and press Run. Allow access when asked
 *     (Advanced → Go to project, since it's your own script).
 *     It lays out the tabs (only if there's no Equipment tab yet) and prints your key
 *     in the Execution log. Copy the key; you'll paste it into the app.
 *  3. Deploy → New deployment → gear icon → Web app.
 *     Execute as: Me.  Who has access: Anyone.  Deploy, then copy the Web app URL.
 *  4. In the app: Settings → paste the URL and the key → Test & save.
 *
 * After pasting a newer version of this file: pick "upgrade" and Run (it only adds things, never deletes),
 * then Deploy → Manage deployments → pencil → Version: New version → Deploy.
 * (The URL stays the same.) Run "newKey" if you ever want to replace the key.
 *
 * Columns are found by their header names, so you can reorder them or add your own.
 */

var SHEETS = { due: 'Due', items: 'Equipment', log: 'Service Log', schedule: 'Schedule', readme: 'Read me' };

var ITEM_HEADERS = ['Item', 'Type', 'Year', 'Make', 'Model', 'Meter', 'Current reading', 'Reading updated', 'Notes', 'Purchase date'];
var LOG_HEADERS = ['ID', 'Date', 'Item', 'Reading', 'Service', 'Cost', 'Shop / who', 'Notes', 'Entered'];
// Formulas fill columns E–J, so new columns go after Status.
var SCHEDULE_HEADERS = ['Item', 'Service', 'Every (mi/hr)', 'Every (months)', 'Last done', 'Last reading',
  'Current reading', 'Next due date', 'Next due reading', 'Status', 'Part / spec'];
var DUE_HEADERS = ['Status', 'Item', 'Service', 'Next due date', 'Next due reading', 'Current reading', 'Part / spec'];

// Meter: "miles", "hours", or blank for things without one (like a water filter).
var START_ITEMS = [
  ['Odyssey', 'Vehicle', 2003, 'Honda', 'Odyssey EX', 'miles', '', '', '', ''],
  ['Sentra', 'Vehicle', 2020, 'Nissan', 'Sentra SV', 'miles', '', '', '', ''],
  ['Silverado', 'Vehicle', 2000, 'Chevrolet', 'Silverado', 'miles', '', '', '', ''],
  ["Claire's Hyundai", 'Vehicle', '', 'Hyundai', '', 'miles', '', '', 'Add the year and model', ''],
  ['Water filter', 'Equipment', '', '', '', '', '', '', 'Add the filter type or part number', ''],
];

// Recommended schedule [item, service, every miles/hours, every months, part / spec].
// From the owner's manuals where available; "(check manual)" marks numbers not confirmed from one.
// Shorter intervals than "normal" on purpose for the high-mileage vehicles.
var COMMON = function (item, brakeFluid) {
  return [
    [item, 'Fuel injector cleaner', 3000, 4, 'One bottle in a full tank'],
    [item, 'Brake fluid', brakeFluid[0], brakeFluid[1], 'DOT 3'],
    [item, 'Battery', '', 60, 'Test yearly; replace about every 5 years'],
    [item, 'Wiper blades', '', 12, ''],
    [item, 'Tires (replace by age)', '', 72, 'Replace at 6 years or 2/32" tread'],
  ];
};
var START_SCHEDULE = [
  ['Odyssey', 'Oil & filter', 5000, 6, '5W-20'],
  ['Odyssey', 'Tire rotation', 7500, 6, ''],
  ['Odyssey', 'Engine air filter', 15000, 12, ''],
  ['Odyssey', 'Cabin air filter', 15000, 12, ''],
  ['Odyssey', 'Brake inspection', 15000, 12, ''],
  ['Odyssey', 'Transmission fluid', 30000, 24, 'Honda ATF DW-1, drain & fill. This transmission is fragile; keep it fresh'],
  ['Odyssey', 'Coolant', 60000, 60, 'Honda Type 2 (blue)'],
  ['Odyssey', 'Spark plugs', 105000, 84, ''],
  ['Odyssey', 'Timing belt & water pump', 105000, 84, 'Next around 210,000 mi if it was done near 105,000'],
].concat(COMMON('Odyssey', ['', 36]), [
  ['Sentra', 'Oil & filter', 5000, 6, '0W-20 synthetic'],
  ['Sentra', 'Tire rotation', 5000, 6, ''],
  ['Sentra', 'Engine air filter', 30000, 36, ''],
  ['Sentra', 'Cabin air filter', 15000, 18, ''],
  ['Sentra', 'Brake inspection', 15000, 12, ''],
  ['Sentra', 'CVT fluid', 60000, 72, 'Nissan NS-3 CVT fluid'],
  ['Sentra', 'Coolant', 105000, 84, 'Nissan Long Life (blue). After the first change: every 75,000 mi / 60 months'],
  ['Sentra', 'Spark plugs', 105000, 126, ''],
], COMMON('Sentra', [20000, 24]), [
  ['Silverado', 'Oil & filter', 5000, 6, '5W-30'],
  ['Silverado', 'Tire rotation', 6000, 6, ''],
  ['Silverado', 'Engine air filter', 15000, 12, ''],
  ['Silverado', 'Brake inspection', 15000, 12, ''],
  ['Silverado', 'Transmission fluid', 30000, 30, 'Fluid & filter, DEXRON-VI'],
  ['Silverado', 'Fuel filter', 30000, 30, ''],
  ['Silverado', 'Coolant', 100000, 60, 'DEX-COOL (orange)'],
  ['Silverado', 'Spark plugs', 100000, 60, ''],
], COMMON('Silverado', [30000, 30]), [
  ["Claire's Hyundai", 'Oil & filter', 5000, 6, ''],
  ["Claire's Hyundai", 'Tire rotation', 7500, 6, ''],
  ["Claire's Hyundai", 'Engine air filter', 15000, 12, ''],
  ["Claire's Hyundai", 'Cabin air filter', 15000, 12, ''],
  ["Claire's Hyundai", 'Brake inspection', 15000, 12, ''],
  ["Claire's Hyundai", 'Timing belt', 60000, 60, 'Important on the 1.6 engine. Ask when it was last done (check manual)'],
  ["Claire's Hyundai", 'Coolant', 60000, 60, ''],
  ["Claire's Hyundai", 'Spark plugs', 30000, 36, '(check manual)'],
], COMMON("Claire's Hyundai", ['', 36]), [
  ['Water filter', 'Filter change', '', 6, 'Add the part number'],
]);

// The intervals the first version started with. upgrade() only replaces an interval that still has
// this exact value, so anything you changed by hand is kept.
var OLD_DEFAULTS = {
  'Sentra|Tire rotation': [7500, 6], 'Sentra|Engine air filter': [15000, 12], 'Sentra|Cabin air filter': [15000, 12],
  'Sentra|CVT fluid': [60000, 48], 'Sentra|Coolant': [60000, 60], 'Sentra|Spark plugs': [105000, 84],
  'Silverado|Tire rotation': [7500, 6], 'Silverado|Transmission fluid': [50000, 48], 'Silverado|Spark plugs': [100000, 84],
  "Claire's Hyundai|Spark plugs": [100000, 84],
};

var README = [
  'Maintenance Log',
  '',
  'Due: everything that is Overdue or Due soon, most urgent first. Start here.',
  'Equipment: one row per vehicle or piece of equipment. "Item" is the short name used everywhere else.',
  '  Type: Vehicle or Equipment.  Meter: miles, hours, or blank if it has no meter (like a water filter).',
  'Service Log: every oil change, filter change, repair, or check. The app adds rows; you can type them in too.',
  'Schedule: how often each service is due. Last done, next due and Status fill in by themselves from the Service Log.',
  '  Status: OK, Due soon (within about 10% of the interval, at most 30 days), Overdue, or No record yet.',
  '  A log entry counts only when its Item and Service match the Schedule exactly.',
  '  Part / spec: what to buy (oil type, filter part number). Fill it in as you learn it.',
  '  No record means nothing is logged yet. In the app, use "Set starting points" to enter roughly when each was last done.',
  'Intervals come from the owner\'s manuals where we could find them; "(check manual)" means not confirmed. Adjust freely.',
  'Equipment like the fridge filter, furnace filter or water heater: add a row on Equipment (Meter blank), then its services on Schedule.',
];

// ---------- setup ----------

/** Run once from the editor: lays out the tabs (only if there is no Equipment tab yet) and prints the key. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName(SHEETS.items)) {
    Logger.log('The tabs already exist, so they were left as they are. Run "upgrade" to add new features.');
  } else {
    buildSheet_(ss);
    Logger.log('Tabs are set up: Due, Read me, Equipment, Service Log, Schedule.');
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
  header_(items, ITEM_HEADERS, [140, 90, 60, 100, 110, 70, 120, 120, 280, 110]);
  items.getRange(2, 1, START_ITEMS.length, ITEM_HEADERS.length).setValues(START_ITEMS);
  items.getRange('G2:G').setNumberFormat('#,##0');
  items.getRange('H2:H').setNumberFormat('mmm d, yyyy');
  items.getRange('J2:J').setNumberFormat('mmm d, yyyy');
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
  header_(sch, SCHEDULE_HEADERS, [140, 190, 100, 105, 100, 100, 115, 110, 125, 90, 320]);
  sch.getRange(2, 1, START_SCHEDULE.length, 4).setValues(START_SCHEDULE.map(function (r) { return r.slice(0, 4); }));
  sch.getRange(2, 11, START_SCHEDULE.length, 1).setValues(START_SCHEDULE.map(function (r) { return [r[4]]; }));
  for (var r = 2; r < START_SCHEDULE.length + 2; r++) setScheduleFormulas_(sch, r);
  sch.getRange('C2:C').setNumberFormat('#,##0');
  sch.getRange('F2:G').setNumberFormat('#,##0');
  sch.getRange('I2:I').setNumberFormat('#,##0');
  sch.getRange('E2:E').setNumberFormat('mmm d, yyyy');
  sch.getRange('H2:H').setNumberFormat('mmm d, yyyy');
  sch.getRange('A2:A').setDataValidation(itemList);
  statusColors_(sch, 'J2:J');

  buildDue_(ss);
  old.forEach(function (sh) { ss.deleteSheet(sh); });
  ss.setActiveSheet(ss.getSheetByName(SHEETS.due));
}

// ---------- upgrade (safe to run any time) ----------

/**
 * Run from the editor after pasting a new version of this file. Only adds things:
 * the Due tab, the Part / spec column, recommended Schedule rows that are missing, and status colors.
 * Intervals are updated only where they still have the old starting value. Nothing is deleted.
 */
function upgrade() {
  var ss = SpreadsheetApp.getActive();
  var sch = sheet_(SHEETS.schedule);
  var notes = [];

  // Part / spec column after the last header.
  var headers = sch.getRange(1, 1, 1, sch.getLastColumn()).getValues()[0].map(String);
  if (headers.indexOf('Part / spec') < 0) {
    var c = headers.length + 1;
    sch.getRange(1, c).setValue('Part / spec').setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1F4E8C').setWrap(true);
    sch.setColumnWidth(c, 320);
    notes.push('Added the Part / spec column.');
  }
  // Purchase date column on Equipment.
  var eqs = sheet_(SHEETS.items);
  var eqHeaders = eqs.getRange(1, 1, 1, eqs.getLastColumn()).getValues()[0].map(String);
  if (eqHeaders.indexOf('Purchase date') < 0) {
    var pc = eqHeaders.length + 1;
    eqs.getRange(1, pc).setValue('Purchase date').setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1F4E8C').setWrap(true);
    eqs.getRange(2, pc, eqs.getMaxRows() - 1, 1).setNumberFormat('mmm d, yyyy');
    eqs.setColumnWidth(pc, 110);
    notes.push('Added the Purchase date column on Equipment.');
  }

  var col = { item: colOf_(sch, 'Item'), service: colOf_(sch, 'Service'), every: colOf_(sch, 'Every (mi/hr)'),
    months: colOf_(sch, 'Every (months)'), part: colOf_(sch, 'Part / spec') };

  var items = {};
  table_(SHEETS.items).forEach(function (r) { items[String(r['Item'])] = r; });

  // Existing rows: fill blank Part / spec, update untouched intervals.
  var rows = sch.getLastRow() > 1 ? sch.getRange(2, 1, sch.getLastRow() - 1, sch.getLastColumn()).getValues() : [];
  var have = {};
  var rec = {};
  START_SCHEDULE.forEach(function (r) { rec[r[0] + '|' + r[1]] = r; });
  var changed = 0;
  rows.forEach(function (row, i) {
    var k = String(row[col.item - 1]) + '|' + String(row[col.service - 1]);
    have[k] = true;
    var r = rec[k];
    if (!r) return;
    var line = i + 2;
    if (r[4] && row[col.part - 1] === '') sch.getRange(line, col.part).setValue(r[4]);
    var old = OLD_DEFAULTS[k];
    if (old && row[col.every - 1] === old[0] && row[col.months - 1] === old[1]) {
      sch.getRange(line, col.every).setValue(r[2]);
      sch.getRange(line, col.months).setValue(r[3]);
      changed++;
    }
  });
  if (changed) notes.push('Updated ' + changed + ' intervals from the owner\'s manuals.');

  // Missing recommended rows, for items that are on the Equipment tab.
  var added = 0;
  START_SCHEDULE.forEach(function (r) {
    var k = r[0] + '|' + r[1];
    if (have[k] || !items[r[0]]) return;
    append_(SHEETS.schedule, { 'Item': r[0], 'Service': r[1], 'Every (mi/hr)': r[2], 'Every (months)': r[3], 'Part / spec': r[4] });
    setScheduleFormulas_(sch, sch.getLastRow());
    added++;
  });
  if (added) notes.push('Added ' + added + ' schedule rows (fuel injector cleaner, brake fluid, battery, wipers, tires, and more).');

  // Keep rows grouped by item, in Equipment order, so the tab stays easy to read.
  if (added) sortSchedule_(sch, Object.keys(items));
  sch.getRange('C2:D').setNumberFormat('#,##0');
  statusColors_(sch, 'J2:J');

  // The water filter has no meter.
  var wf = items['Water filter'];
  if (wf && String(wf['Meter']).toLowerCase() === 'hours' && (wf['Current reading'] === '' || wf['Current reading'] == null)) {
    var eq = sheet_(SHEETS.items);
    var names = eq.getRange(2, colOf_(eq, 'Item'), eq.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (names[i][0] === 'Water filter') eq.getRange(i + 2, colOf_(eq, 'Meter')).setValue('');
    }
    notes.push('Cleared the water filter\'s Meter (it has no hour meter).');
  }

  if (!ss.getSheetByName(SHEETS.due)) {
    buildDue_(ss);
    notes.push('Added the Due tab.');
  }

  var readme = sheet_(SHEETS.readme);
  readme.getRange('A:A').clearContent();
  readme.getRange(1, 1, README.length, 1).setValues(README.map(function (l) { return [l]; }));
  readme.getRange('A1').setFontSize(14).setFontWeight('bold');

  SpreadsheetApp.flush();
  Logger.log(notes.length ? notes.join('\n') : 'Already up to date.');
}

/** Sort Schedule rows by item (Equipment order), keeping the service order within each item. */
function sortSchedule_(sch, order) {
  var n = sch.getLastRow() - 1;
  if (n < 2) return;
  var w = 4; // only the typed columns; formulas in E–J are re-made below
  var partCol = colOf_(sch, 'Part / spec');
  var typed = sch.getRange(2, 1, n, w).getValues();
  var parts = sch.getRange(2, partCol, n, 1).getValues();
  var rows = typed.map(function (r, i) { return { r: r, p: parts[i][0], i: i }; });
  var rank = function (name) { var k = order.indexOf(String(name)); return k < 0 ? order.length : k; };
  rows.sort(function (a, b) { return rank(a.r[0]) - rank(b.r[0]) || a.i - b.i; });
  sch.getRange(2, 1, n, w).setValues(rows.map(function (x) { return x.r; }));
  sch.getRange(2, partCol, n, 1).setValues(rows.map(function (x) { return [x.p]; }));
  for (var r = 2; r < n + 2; r++) setScheduleFormulas_(sch, r);
}

/** The Due tab: one formula that lists Overdue and Due soon rows from the Schedule, most urgent first. */
function buildDue_(ss) {
  var due = ss.insertSheet(SHEETS.due, 0);
  header_(due, DUE_HEADERS, [90, 140, 190, 110, 125, 115, 320]);
  var S = 'Schedule!';
  var sch = sheet_(SHEETS.schedule);
  var part = colLetter_(colOf_(sch, 'Part / spec'));
  due.getRange('A2').setFormula(
    '=IFERROR(SORT(FILTER({' + S + 'J2:J,' + S + 'A2:B,' + S + 'H2:I,' + S + 'G2:G,' + S + part + '2:' + part + '},' +
    '(' + S + 'J2:J="Overdue")+(' + S + 'J2:J="Due soon")),1,FALSE,4,TRUE),"Nothing is due. Rows with no record yet are not listed.")');
  due.getRange('D2:D').setNumberFormat('mmm d, yyyy');
  due.getRange('E2:F').setNumberFormat('#,##0');
  statusColors_(due, 'A2:A');
}

/** Red for Overdue, amber for Due soon, green for OK, gray for No record. */
function statusColors_(sh, a1) {
  var range = sh.getRange(a1);
  var keep = sh.getConditionalFormatRules().filter(function (rule) {
    return !rule.getRanges().some(function (r) { return r.getA1Notation() === range.getA1Notation(); });
  });
  var rule = function (text, bg, fg) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text).setBackground(bg).setFontColor(fg)
      .setRanges([range]).build();
  };
  sh.setConditionalFormatRules(keep.concat([
    rule('Overdue', '#F8D7DA', '#842029'),
    rule('Due soon', '#FFF3CD', '#664D03'),
    rule('OK', '#D1E7DD', '#0F5132'),
    rule('No record', '#EEEEEE', '#666666'),
  ]));
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
      case 'addServices': // several at once, e.g. starting points
        (req.entries || []).forEach(addService_);
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
    'Part / spec': String(req.part || ''),
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

/** 11 → "K". */
function colLetter_(n) {
  var s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
