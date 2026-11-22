// Types and display helpers (no React Native imports, so they run in unit tests).

export type Status = 'Overdue' | 'Due soon' | 'OK' | 'No record';
/** What the item's reading counts: odometer miles, engine hours, or nothing (e.g. a water filter). */
export type Meter = 'miles' | 'hours' | '';

export type Item = {
  name: string; // short name used everywhere, e.g. "Odyssey"
  type: string; // "Vehicle" or "Equipment" (anything else is shown as equipment)
  year: string;
  make: string;
  model: string;
  meter: Meter;
  reading: number | null;
  readingUpdated: string; // yyyy-MM-dd or ''
  notes: string;
  purchased: string; // yyyy-MM-dd or ''
  vin: string;
};

export type ServiceEntry = {
  id: string;
  date: string; // yyyy-MM-dd
  item: string;
  reading: number | null;
  service: string;
  cost: number | null;
  shop: string;
  notes: string;
};

/** A schedule row with its worked-out last done / next due / status (see compute in data.ts). */
export type ScheduleItem = {
  item: string;
  service: string;
  every: number | null; // miles or hours, matching the item's meter
  everyMonths: number | null;
  part: string; // what to buy: oil type, filter part number…
  lastDone: string;
  lastReading: number | null;
  nextDate: string;
  nextReading: number | null;
  status: Status;
};

/** An odometer / hour meter reading on a date, for tracking how much an item is used. */
export type Reading = { id: string; item: string; date: string; reading: number };

export type SheetData = {
  items: Item[];
  log: ServiceEntry[];
  schedule: ScheduleItem[];
  readings: Reading[];
};

/** Average use per month from the readings and log, e.g. 850 (miles/month). Needs 30+ days of span. */
export function perMonth(item: string, data: SheetData): number | null {
  const pts = [
    ...data.readings.filter((r) => r.item === item),
    ...data.log.filter((e) => e.item === item && e.reading !== null).map((e) => ({ date: e.date, reading: e.reading as number })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const days = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  if (!(days >= 30) || last.reading <= first.reading) return null;
  return ((last.reading - first.reading) / days) * 30.44;
}

export const isVehicle = (it: Item) => it.type.toLowerCase() === 'vehicle';

/** "Odometer" / "Hour meter" for the reading's label. */
export function meterLabel(m: Meter): string {
  return m === 'hours' ? 'Hour meter' : 'Odometer';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-20" → "Nov 20, 2026". Anything else is returned as-is. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** 123456 → "123,456 mi"; 250 hours → "250 hr". */
export function formatReading(n: number | null, m: Meter): string {
  if (n === null) return '—';
  const s = Math.round(n).toLocaleString('en-US');
  return m === 'hours' ? `${s} hr` : m === 'miles' ? `${s} mi` : s;
}

export function formatCost(n: number | null): string {
  if (n === null) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Local date as yyyy-MM-dd. */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isISODate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** Parse a typed number like "123,456" or "$45.10". Empty → null; junk → NaN. */
export function parseNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** What's coming up next: "Mar 3, 2027 or 45,000 mi". */
export function nextDue(s: ScheduleItem, m: Meter): string {
  const parts: string[] = [];
  if (s.nextDate) parts.push(formatDate(s.nextDate));
  if (s.nextReading !== null && m) parts.push(formatReading(s.nextReading, m));
  return parts.join(' or ');
}

/** How often: "every 5,000 mi or 6 months". */
export function interval(s: ScheduleItem, m: Meter): string {
  const parts: string[] = [];
  if (s.every && m) parts.push(formatReading(s.every, m));
  if (s.everyMonths) parts.push(`${s.everyMonths} month${s.everyMonths === 1 ? '' : 's'}`);
  return parts.length ? `every ${parts.join(' or ')}` : '';
}

const RANK: Record<Status, number> = { Overdue: 0, 'Due soon': 1, OK: 2, 'No record': 3 };

/** Most urgent first; ties keep the sheet's order. */
export function byUrgency(items: ScheduleItem[]): ScheduleItem[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => RANK[a.it.status] - RANK[b.it.status] || a.i - b.i)
    .map((x) => x.it);
}

/** Newest first (by date, then by reading). */
export function newestFirst(log: ServiceEntry[]): ServiceEntry[] {
  return [...log].sort((a, b) => b.date.localeCompare(a.date) || (b.reading ?? 0) - (a.reading ?? 0));
}

/** Counts and highlights for an item's summary. */
export function summarize(it: Item, data: SheetData, today: string = toISODate(new Date())) {
  const [y, mo, d] = today.split('-').map(Number);
  const sixMonthsAgo = toISODate(new Date(y, mo - 1 - 6, d));
  const schedule = data.schedule.filter((s) => s.item === it.name);
  const log = newestFirst(data.log.filter((e) => e.item === it.name));
  const count = (st: Status) => schedule.filter((s) => s.status === st).length;
  const upcoming = byUrgency(schedule.filter((s) => s.status !== 'No record' && (s.nextDate || s.nextReading !== null)));
  return {
    overdue: count('Overdue'),
    dueSoon: count('Due soon'),
    ok: count('OK'),
    noRecord: count('No record'),
    next: upcoming[0] ?? null,
    last: log[0] ?? null,
    spent: log.reduce((sum, e) => sum + (e.cost ?? 0), 0),
    spent6mo: log.filter((e) => e.date > sixMonthsAgo && e.date <= today).reduce((sum, e) => sum + (e.cost ?? 0), 0),
  };
}

/** One line for a list: "2 overdue · 1 due soon", "All up to date", or "No records yet". */
export function statusLine(s: ReturnType<typeof summarize>): string {
  if (s.overdue || s.dueSoon)
    return [s.overdue && `${s.overdue} overdue`, s.dueSoon && `${s.dueSoon} due soon`].filter(Boolean).join(' · ');
  if (s.ok) return s.noRecord ? `Up to date · ${s.noRecord} with no record` : 'All up to date';
  return s.noRecord ? 'No records yet' : 'Nothing scheduled';
}

/** "2003 Honda Odyssey EX". */
export function itemTitle(it: Item): string {
  return [it.year, it.make, it.model].filter(Boolean).join(' ');
}

/** A simple icon for an item, guessed from its type and name. */
export function itemIcon(it: Item): string {
  const s = `${it.name} ${it.make} ${it.model}`.toLowerCase();
  if (isVehicle(it)) {
    if (/silverado|truck|pickup|f-?150|ram|tacoma|tundra|sierra/.test(s)) return '🛻';
    if (/odyssey|van|sienna|caravan|pacifica/.test(s)) return '🚐';
    if (/motorcycle|bike/.test(s)) return '🏍️';
    return '🚗';
  }
  if (/water|filter|fridge|refrigerator/.test(s)) return '💧';
  if (/fireplace|gas log|stove/.test(s)) return '🔥';
  if (/furnace|hvac|heat|air/.test(s)) return '🌡️';
  if (/mower|lawn|yard/.test(s)) return '🌱';
  return '🔧';
}

export type Kind = 'Routine' | 'Repair';

/** Routine when the entry matches a scheduled service for that item, otherwise a repair / one-off. */
export function kindOf(e: ServiceEntry, data: SheetData): Kind {
  return data.schedule.some((s) => s.item === e.item && s.service === e.service) ? 'Routine' : 'Repair';
}

/** Spending grouped by year (newest first), with per-item and routine/repair totals. */
export function spendingByYear(data: SheetData) {
  const years = new Map<
    string,
    { total: number; routine: number; repair: number; items: Map<string, { total: number; routine: number; repair: number }> }
  >();
  for (const e of data.log) {
    if (!e.cost) continue;
    const y = e.date.slice(0, 4) || '—';
    const yr = years.get(y) ?? { total: 0, routine: 0, repair: 0, items: new Map() };
    const it = yr.items.get(e.item) ?? { total: 0, routine: 0, repair: 0 };
    const k = kindOf(e, data) === 'Routine' ? 'routine' : 'repair';
    yr.total += e.cost;
    yr[k] += e.cost;
    it.total += e.cost;
    it[k] += e.cost;
    yr.items.set(e.item, it);
    years.set(y, yr);
  }
  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, v]) => ({
      year,
      total: v.total,
      routine: v.routine,
      repair: v.repair,
      items: [...v.items.entries()].map(([item, t]) => ({ item, ...t })).sort((a, b) => b.total - a.total),
    }));
}
