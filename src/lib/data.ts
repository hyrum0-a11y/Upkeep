// The data file (upkeep.json in the private data repo) and everything worked out from it.
// Plain TypeScript, no React Native imports, so it runs in unit tests.

import type { FuelEntry, Item, Kind, Meter, Reading, ScheduleItem, ServiceEntry, SheetData, Status } from './format';

export const DATA_FILE = 'upkeep.json';

/** A schedule row as stored: how often. Last done / next due / status are worked out by `compute`. */
export type StoredSchedule = {
  item: string;
  service: string;
  every: number | null; // miles or hours, matching the item's meter
  everyMonths: number | null;
  part: string;
};

export type StoredEntry = ServiceEntry & { entered: string };

export type StoredFuel = FuelEntry & { entered: string };

export type Store = {
  version: 1;
  items: Item[];
  schedule: StoredSchedule[];
  log: StoredEntry[];
  readings: Reading[]; // mileage / hours history
  fuel: StoredFuel[]; // fill-ups, kept apart from the service log
};

export function emptyStore(): Store {
  return { version: 1, items: [], schedule: [], log: [], readings: [], fuel: [] };
}

// ---------- reading the file ----------

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const meter = (v: unknown): Meter => {
  const s = str(v).toLowerCase();
  if (s.startsWith('mi')) return 'miles';
  if (s.startsWith('h')) return 'hours';
  return '';
};
type Obj = Record<string, unknown>;
const list = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Obj[]) : []);
/** Fields this version doesn't know about, kept so saving from the app never erases data added by hand or by a newer version. */
const extras = (r: Obj, known: string[]): Obj => Object.fromEntries(Object.entries(r).filter(([k]) => !known.includes(k)));
const ITEM_KEYS = [
  'name',
  'type',
  'year',
  'make',
  'model',
  'meter',
  'reading',
  'readingUpdated',
  'purchased',
  'vin',
  'plate',
  'notes',
  'company',
  'policyNumber',
  'agent',
  'phone',
  'covers',
];
const SCHEDULE_KEYS = ['item', 'service', 'every', 'everyMonths', 'part'];
const LOG_KEYS = ['id', 'date', 'item', 'reading', 'service', 'cost', 'shop', 'notes', 'entered', 'troubleshooting', 'kind'];
const READING_KEYS = ['id', 'item', 'date', 'reading'];
const FUEL_KEYS = ['id', 'item', 'date', 'gallons', 'cost', 'reading', 'full', 'entered'];

/** Bill fields (company, account #, agent…), only when present so other items stay lean. */
function policyFields(r: Obj) {
  const out: { company?: string; policyNumber?: string; agent?: string; phone?: string; covers?: string[] } = {};
  for (const k of ['company', 'policyNumber', 'agent', 'phone'] as const) if (str(r[k])) out[k] = str(r[k]);
  if (Array.isArray(r.covers)) out.covers = r.covers.map(str).filter(Boolean);
  return out;
}

/** Parse upkeep.json, tolerating hand edits (missing fields, numbers typed as text). */
export function parseStore(json: string): Store {
  let raw: Obj;
  try {
    raw = JSON.parse(json) as Obj;
  } catch {
    throw new Error(`${DATA_FILE} isn't valid JSON. If you edited it on GitHub, check for a missing comma or quote.`);
  }
  const store: Store = {
    version: 1,
    items: list(raw.items)
      .map((r) => ({
        ...extras(r, ITEM_KEYS),
        name: str(r.name),
        type: str(r.type) || 'Equipment',
        year: str(r.year),
        make: str(r.make),
        model: str(r.model),
        meter: meter(r.meter),
        reading: num(r.reading),
        readingUpdated: str(r.readingUpdated),
        purchased: str(r.purchased),
        vin: str(r.vin),
        plate: str(r.plate),
        notes: str(r.notes),
        ...policyFields(r),
      }))
      .filter((i) => i.name),
    schedule: list(raw.schedule)
      .map((r) => ({
        ...extras(r, SCHEDULE_KEYS),
        item: str(r.item),
        service: str(r.service),
        every: num(r.every),
        everyMonths: num(r.everyMonths),
        part: str(r.part),
      }))
      .filter((s) => s.item && s.service),
    log: list(raw.log)
      .map((r) => ({
        ...extras(r, LOG_KEYS),
        id: str(r.id),
        date: str(r.date),
        item: str(r.item),
        reading: num(r.reading),
        service: str(r.service),
        cost: num(r.cost),
        shop: str(r.shop),
        notes: str(r.notes),
        entered: str(r.entered),
        ...(r.troubleshooting === true ? { troubleshooting: true } : {}),
        ...(r.kind === 'Service' || r.kind === 'Repair' || r.kind === 'Fee' ? { kind: r.kind as Kind } : {}),
      }))
      .filter((e) => e.item && e.service),
    readings: list(raw.readings)
      .map((r) => ({ ...extras(r, READING_KEYS), id: str(r.id), item: str(r.item), date: str(r.date), reading: num(r.reading) }))
      .filter((r): r is Reading => !!(r.item && r.date && r.reading !== null)),
    fuel: list(raw.fuel)
      .map((r) => ({
        ...extras(r, FUEL_KEYS),
        id: str(r.id),
        item: str(r.item),
        date: str(r.date),
        gallons: num(r.gallons) ?? 0,
        cost: num(r.cost),
        reading: num(r.reading),
        full: r.full !== false,
        entered: str(r.entered),
      }))
      .filter((f) => f.item && f.date),
  };
  // An item's current reading should always appear in its history so it can be fixed later.
  for (const it of store.items) {
    if (it.reading !== null && !store.readings.some((r) => r.item === it.name)) {
      store.readings.push({
        id: `start-${it.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        item: it.name,
        date: it.readingUpdated || '2026-01-01',
        reading: it.reading,
      });
    }
  }
  return store;
}

/** Pretty JSON with one log entry per line, so GitHub diffs stay readable. */
export function serializeStore(s: Store): string {
  const block = (rows: unknown[]) => (rows.length ? `[\n    ${rows.map((r) => JSON.stringify(r)).join(',\n    ')}\n  ]` : '[]');
  return `{\n  "version": 1,\n  "items": ${block(s.items)},\n  "schedule": ${block(s.schedule)},\n  "log": ${block(s.log)},\n  "readings": ${block(s.readings)},\n  "fuel": ${block(s.fuel)}\n}\n`;
}

// ---------- due math ----------

/** "2026-05-31" + 6 months → "2026-11-30" (clamped to the month's last day, like a spreadsheet's EDATE). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(ny, nm + 1, 0).getDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ny}-${p(nm + 1)}-${p(Math.min(d, last))}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(toIso) - t(fromIso)) / 86_400_000);
}

/**
 * Last done, next due and status for each schedule row.
 * Due soon: within 10% of the mileage interval, or within min(30 days, 3 days per month of interval).
 */
export function compute(store: Store, today: string): SheetData {
  const reading = new Map(store.items.map((i) => [i.name, i.reading]));
  const schedule: ScheduleItem[] = store.schedule.map((s) => {
    const done = store.log.filter((e) => e.item === s.item && e.service === s.service);
    const lastDone = done.reduce((max, e) => (e.date > max ? e.date : max), '');
    const readings = done.map((e) => e.reading).filter((r): r is number => r !== null);
    const lastReading = readings.length ? Math.max(...readings) : null;
    const nextDate = lastDone && s.everyMonths ? addMonths(lastDone, s.everyMonths) : '';
    const nextReading = lastReading !== null && s.every ? lastReading + s.every : null;
    const current = reading.get(s.item) ?? null;
    let status: Status = 'OK';
    if (!lastDone) status = 'No record';
    else if ((nextDate && nextDate <= today) || (nextReading !== null && current !== null && current >= nextReading)) status = 'Overdue';
    else if (
      (nextDate && daysBetween(today, nextDate) <= Math.min(30, (s.everyMonths ?? 0) * 3)) ||
      (nextReading !== null && current !== null && s.every && nextReading - current <= s.every * 0.1)
    )
      status = 'Due soon';
    return { ...s, lastDone, lastReading, nextDate, nextReading, status };
  });
  return { items: store.items, log: store.log, schedule, readings: store.readings, fuel: store.fuel };
}

// ---------- changes (each returns a new Store) ----------

export type NewEntry = Omit<ServiceEntry, 'id'>;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Add service entries. Moves the item's reading forward when an entry's reading is higher. */
export function addEntries(s: Store, entries: NewEntry[], now: string, id: () => string = newId): Store {
  let items = s.items;
  for (const e of entries) {
    if (!e.item || !e.service) throw new Error('Item and service are required.');
    if (e.reading !== null)
      items = items.map((i) =>
        i.name === e.item && (i.reading === null || e.reading! > i.reading)
          ? { ...i, reading: e.reading, readingUpdated: now.slice(0, 10) }
          : i,
      );
  }
  return { ...s, items, log: [...s.log, ...entries.map((e) => ({ ...e, id: id(), entered: now }))] };
}

/** Fix an existing entry (date, reading, cost…). Moves the item's reading forward if the new reading is higher. */
export function updateEntry(s: Store, id: string, e: NewEntry, now: string): Store {
  const old = s.log.find((x) => x.id === id);
  if (!old) throw new Error('Entry not found. It may have been deleted.');
  if (!e.item || !e.service) throw new Error('Item and service are required.');
  const items = s.items.map((i) =>
    i.name === e.item && e.reading !== null && (i.reading === null || e.reading > i.reading)
      ? { ...i, reading: e.reading, readingUpdated: now.slice(0, 10) }
      : i,
  );
  return { ...s, items, log: s.log.map((x) => (x.id === id ? { ...e, id, entered: x.entered } : x)) };
}

export function deleteEntry(s: Store, id: string): Store {
  if (!s.log.some((e) => e.id === id)) throw new Error('Entry not found. It may already be deleted.');
  return { ...s, log: s.log.filter((e) => e.id !== id) };
}

/**
 * Record a reading on a date (default today). The item's current reading becomes the one with the
 * latest date, so back-dating an old reading doesn't overwrite today's.
 */
export function setReading(s: Store, item: string, reading: number, date: string, id: () => string = newId): Store {
  if (!s.items.some((i) => i.name === item)) throw new Error(`Item not found: ${item}`);
  return syncCurrent({ ...s, readings: [...s.readings, { id: id(), item, date, reading }] }, item);
}

/** Replace a reading's value and/or date. */
export function updateReading(s: Store, id: string, reading: number, date: string): Store {
  const r = s.readings.find((x) => x.id === id);
  if (!r) throw new Error('Reading not found. It may have been deleted.');
  return syncCurrent({ ...s, readings: s.readings.map((x) => (x.id === id ? { ...x, reading, date } : x)) }, r.item);
}

export function deleteReading(s: Store, id: string): Store {
  const r = s.readings.find((x) => x.id === id);
  if (!r) throw new Error('Reading not found. It may already be deleted.');
  if (s.readings.filter((x) => x.item === r.item).length === 1)
    throw new Error("That's the only reading, so it's the current one. Edit it instead.");
  return syncCurrent({ ...s, readings: s.readings.filter((x) => x.id !== id) }, r.item);
}

/** Item's current reading = latest-dated reading (ties: the one added last). */
function syncCurrent(s: Store, item: string): Store {
  const mine = s.readings.filter((r) => r.item === item);
  if (!mine.length) return s;
  const latest = mine.reduce((a, b) => (b.date >= a.date ? b : a));
  return { ...s, items: s.items.map((i) => (i.name === item ? { ...i, reading: latest.reading, readingUpdated: latest.date } : i)) };
}

/** Add or update an item. Renaming also renames it in the schedule and log. */
export function saveItem(s: Store, item: Item, oldName?: string): Store {
  const name = item.name.trim();
  if (!name) throw new Error('Give it a name.');
  const clash = s.items.some((i) => i.name.toLowerCase() === name.toLowerCase() && i.name !== oldName);
  if (clash) throw new Error(`There's already an item called ${name}.`);
  const next = { ...item, name };
  if (!oldName) return { ...s, items: [...s.items, next] };
  if (!s.items.some((i) => i.name === oldName)) throw new Error(`Item not found: ${oldName}`);
  const rename = <T extends { item: string }>(r: T): T => (r.item === oldName ? { ...r, item: name } : r);
  return {
    ...s,
    items: s.items.map((i) =>
      i.name === oldName ? next : i.covers?.includes(oldName) ? { ...i, covers: i.covers.map((c) => (c === oldName ? name : c)) } : i,
    ),
    schedule: s.schedule.map(rename),
    log: s.log.map(rename),
    readings: s.readings.map(rename),
    fuel: s.fuel.map(rename),
  };
}

export type NewFuel = Omit<FuelEntry, 'id'>;

/** Moves the item's current reading forward when a fill-up's mileage is higher. */
function bumpReading(s: Store, item: string, reading: number | null, now: string): Item[] {
  return s.items.map((i) =>
    i.name === item && reading !== null && (i.reading === null || reading > i.reading)
      ? { ...i, reading, readingUpdated: now.slice(0, 10) }
      : i,
  );
}

function checkFuel(f: NewFuel) {
  if (!f.item || !f.date) throw new Error('Vehicle and date are required.');
  if (!(f.gallons > 0)) throw new Error('Gallons must be more than 0.');
}

export function addFuel(s: Store, f: NewFuel, now: string, id: () => string = newId): Store {
  checkFuel(f);
  return { ...s, items: bumpReading(s, f.item, f.reading, now), fuel: [...s.fuel, { ...f, id: id(), entered: now }] };
}

export function updateFuel(s: Store, id: string, f: NewFuel, now: string): Store {
  checkFuel(f);
  const old = s.fuel.find((x) => x.id === id);
  if (!old) throw new Error('Fill-up not found. It may have been deleted.');
  return { ...s, items: bumpReading(s, f.item, f.reading, now), fuel: s.fuel.map((x) => (x.id === id ? { ...old, ...f, id } : x)) };
}

export function deleteFuel(s: Store, id: string): Store {
  return { ...s, fuel: s.fuel.filter((x) => x.id !== id) };
}

/** Remove an item and its schedule. Its log entries stay, so history isn't lost. */
export function deleteItem(s: Store, name: string): Store {
  return {
    ...s,
    items: s.items
      .filter((i) => i.name !== name)
      .map((i) => (i.covers?.includes(name) ? { ...i, covers: i.covers.filter((c) => c !== name) } : i)),
    schedule: s.schedule.filter((r) => r.item !== name),
  };
}

/** Add or update a schedule row. `oldService` is its current name when editing. */
export function saveSchedule(s: Store, row: StoredSchedule, oldService?: string): Store {
  const service = row.service.trim();
  if (!service) throw new Error('Give the service a name.');
  if (row.every === null && row.everyMonths === null) throw new Error('Add how often: miles/hours, months, or both.');
  const clash = s.schedule.some(
    (r) => r.item === row.item && r.service.toLowerCase() === service.toLowerCase() && r.service !== oldService,
  );
  if (clash) throw new Error(`${row.item} already has ${service}.`);
  const next = { ...row, service };
  if (!oldService) return { ...s, schedule: [...s.schedule, next] };
  return {
    ...s,
    schedule: s.schedule.map((r) => (r.item === row.item && r.service === oldService ? next : r)),
    // Keep past entries counting toward the renamed service.
    log: s.log.map((e) => (e.item === row.item && e.service === oldService ? { ...e, service } : e)),
  };
}

export function deleteSchedule(s: Store, item: string, service: string): Store {
  return { ...s, schedule: s.schedule.filter((r) => !(r.item === item && r.service === service)) };
}

// ---------- base64 for the GitHub contents API (UTF-8 safe, no globals needed) ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Encode(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function utf8Decode(b: number[]): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(cp);
  }
  return s;
}

export function toBase64(s: string): string {
  const b = utf8Encode(s);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out +=
      B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return out;
}

export function fromBase64(s: string): string {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const b: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2]) & 63) << 6) |
      (B64.indexOf(clean[i + 3]) & 63);
    b.push((n >> 16) & 255);
    if (i + 2 < clean.length) b.push((n >> 8) & 255);
    if (i + 3 < clean.length) b.push(n & 255);
  }
  return utf8Decode(b);
}
