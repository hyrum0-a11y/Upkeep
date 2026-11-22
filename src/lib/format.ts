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
  plate?: string; // license plate
  // Policies (type "Policy"): insurance and the like. One policy can cover several items.
  company?: string;
  policyNumber?: string;
  agent?: string;
  phone?: string;
  covers?: string[]; // item names this policy covers
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
  /** Done while chasing a problem, not because it was due. Still counts as done. Works with any kind. */
  troubleshooting?: boolean;
  /** Service, Repair or Fee. Older entries have none; kindOf works it out. */
  kind?: Kind;
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

/**
 * Recent use per month from the readings and log, e.g. 850 (miles/month).
 * Uses the last 12 months of readings when they span 30+ days, otherwise all of them.
 */
export function perMonth(item: string, data: SheetData): number | null {
  const pts = [
    ...data.readings.filter((r) => r.item === item),
    ...data.log.filter((e) => e.item === item && e.reading !== null).map((e) => ({ date: e.date, reading: e.reading as number })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const yearBefore = toISODate(new Date(Date.parse(last.date) - 365 * 86_400_000));
  const recent = pts.filter((p) => p.date >= yearBefore);
  const span = (a: { date: string }) => (Date.parse(last.date) - Date.parse(a.date)) / 86_400_000;
  const first = recent.length >= 2 && span(recent[0]) >= 30 ? recent[0] : pts[0];
  const days = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  if (!(days >= 30) || last.reading <= first.reading) return null;
  return ((last.reading - first.reading) / days) * 30.44;
}

export const isVehicle = (it: Item) => it.type.toLowerCase() === 'vehicle';
export const isPolicy = (it: Item) => it.type.toLowerCase() === 'policy';
/** Policies that list this item under covers. */
export const policiesFor = (name: string, data: { items: Item[] }) => data.items.filter((p) => isPolicy(p) && p.covers?.includes(name));

/** "Odometer" / "Hour meter" for the reading's label. */
export function meterLabel(m: Meter): string {
  return m === 'hours' ? 'Hour meter' : 'Odometer';
}

/** Dates show as yyyy-mm-dd ("2026-11-20"); a longer timestamp is cut to the date. */
export function formatDate(iso: string): string {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(iso);
  return m ? m[0] : iso;
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

/** What's coming up next: "2027-03-03 or 45,000 mi". */
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
  const yearAgo = toISODate(new Date(y - 1, mo - 1, d));
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
    spent12mo: log.filter((e) => e.date > yearAgo && e.date <= today).reduce((sum, e) => sum + (e.cost ?? 0), 0),
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
  if (isPolicy(it)) return '🛡️';
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

export const KINDS = ['Service', 'Repair', 'Fee'] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (v: unknown): v is Kind => typeof v === 'string' && (KINDS as readonly string[]).includes(v);

/** Common fees offered when logging a Fee (alongside any fee-like scheduled rows such as Registration renewal). */
export const FEE_NAMES = ['Registration renewal', 'Insurance', 'Property tax', 'Inspection', 'Title'];

/** Names that read as a tax or fee rather than work done. ("Brake inspection" is work; "State inspection" is a fee.) */
export const isFeeName = (name: string) =>
  /registration|insurance|\btax|\btitle\b|license|emissions|state inspection|\bfees?\b|\bpolicy\b|premium/i.test(name);

/**
 * Service, Repair or Fee. Uses the entry's own kind when set. Older entries: fee-like names are fees,
 * troubleshooting entries are repairs, scheduled services are services, anything else is a repair.
 */
export function kindOf(e: ServiceEntry, data: SheetData): Kind {
  if (e.kind) return e.kind;
  if (isFeeName(e.service)) return 'Fee';
  if (e.troubleshooting) return 'Repair';
  return data.schedule.some((s) => s.item === e.item && s.service === e.service) ? 'Service' : 'Repair';
}

export type KindTotals = { total: number; service: number; repair: number; fee: number };
const KEY = { Service: 'service', Repair: 'repair', Fee: 'fee' } as const;

/** Spending grouped by year (newest first), with per-item and service/repair/fee totals. */
export function spendingByYear(data: SheetData) {
  const years = new Map<string, KindTotals & { items: Map<string, KindTotals> }>();
  for (const e of data.log) {
    if (!e.cost) continue;
    const y = e.date.slice(0, 4) || '—';
    const yr = years.get(y) ?? { total: 0, service: 0, repair: 0, fee: 0, items: new Map() };
    const it = yr.items.get(e.item) ?? { total: 0, service: 0, repair: 0, fee: 0 };
    const k = KEY[kindOf(e, data)];
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
      service: v.service,
      repair: v.repair,
      fee: v.fee,
      items: [...v.items.entries()].map(([item, t]) => ({ item, ...t })).sort((a, b) => b.total - a.total),
    }));
}

/** The service name as shown in lists: troubleshooting entries get an asterisk. */
export const entryLabel = (e: ServiceEntry) => (e.troubleshooting ? `${e.service} *` : e.service);

/** How an item is shown everywhere: its description (year make model), or its short name if those are blank. */
export const displayName = (it: Item) => itemTitle(it) || it.name;

/** displayName for an item referred to by its short name (log entries, schedule rows). */
export function nameFor(name: string, data: SheetData): string {
  const it = data.items.find((i) => i.name === name);
  return it ? displayName(it) : name;
}

/** Spending per calendar month for the last `months` months (oldest first), split by item. */
export function monthlySpending(data: SheetData, months: number, today: string = toISODate(new Date())) {
  const [y, m] = today.split('-').map(Number);
  const out: { month: string; total: number; byItem: Record<string, number> }[] = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(y, m - 1 - k, 1);
    out.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, total: 0, byItem: {} });
  }
  for (const e of data.log) {
    if (!e.cost) continue;
    const row = out.find((r) => e.date.startsWith(r.month));
    if (!row) continue;
    row.total += e.cost;
    row.byItem[e.item] = (row.byItem[e.item] ?? 0) + e.cost;
  }
  return out;
}

/** A row in an item's reading history: a manual reading, or the mileage recorded on a service entry. */
export type HistoryReading = { id: string; date: string; reading: number; service?: string; entryId?: string };

/** Manual readings plus service mileages for an item, newest first. A service reading that matches a manual one (same date and value) is left out. */
export function readingHistory(item: string, data: SheetData): HistoryReading[] {
  const manual: HistoryReading[] = data.readings.filter((r) => r.item === item).map((r) => ({ ...r }));
  const fromLog: HistoryReading[] = data.log
    .filter((e) => e.item === item && e.reading !== null && !manual.some((r) => r.date === e.date && r.reading === e.reading))
    .map((e) => ({
      id: `svc-${e.id || e.date + e.service}`,
      date: e.date,
      reading: e.reading as number,
      service: e.service,
      entryId: e.id,
    }));
  return [...manual, ...fromLog].sort((a, b) => b.date.localeCompare(a.date) || b.reading - a.reading);
}

/** Mileage on a date, interpolated between the nearest readings (clamped at the ends). */
export function mileageAt(date: string, pts: { date: string; reading: number }[]): number | null {
  if (!pts.length) return null;
  const t = Date.parse(date);
  const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date));
  if (t <= Date.parse(sorted[0].date)) return sorted[0].reading;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const ta = Date.parse(a.date);
    const tb = Date.parse(b.date);
    if (t <= tb) return tb === ta ? b.reading : a.reading + ((b.reading - a.reading) * (t - ta)) / (tb - ta);
  }
  return sorted[sorted.length - 1].reading;
}

export type ChartMarker = { entry: ServiceEntry; reading: number };

/** Mileage line points (oldest first) and cost markers for an item from `start` (yyyy-mm-dd, or '' for all). */
export function mileageChart(item: string, data: SheetData, start: string) {
  const all = readingHistory(item, data).reverse();
  const points = all.filter((p) => !start || p.date >= start);
  const markers: ChartMarker[] = data.log
    .filter((e) => e.item === item && e.cost && (!start || e.date >= start))
    .map((e) => ({ entry: e, reading: e.reading ?? mileageAt(e.date, all) ?? 0 }))
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  return { points, markers };
}
