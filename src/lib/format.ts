// Plain data helpers (no React Native imports, so they run in unit tests).

export type Status = 'Overdue' | 'Due soon' | 'OK' | 'No record';

export type Vehicle = {
  name: string; // short name used everywhere, e.g. "Odyssey"
  year: string;
  make: string;
  model: string;
  trim: string;
  miles: number | null;
  milesUpdated: string; // yyyy-MM-dd or ''
  notes: string;
};

export type ServiceEntry = {
  id: string;
  date: string; // yyyy-MM-dd
  vehicle: string;
  mileage: number | null;
  service: string;
  cost: number | null;
  shop: string;
  notes: string;
};

export type ScheduleItem = {
  vehicle: string;
  service: string;
  everyMiles: number | null;
  everyMonths: number | null;
  lastDone: string;
  lastMiles: number | null;
  nextDate: string;
  nextMiles: number | null;
  status: Status;
};

export type SheetData = {
  vehicles: Vehicle[];
  log: ServiceEntry[];
  schedule: ScheduleItem[];
  sheetUrl: string;
};

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const STATUSES: Status[] = ['Overdue', 'Due soon', 'OK', 'No record'];
const status = (v: unknown): Status => {
  const s = str(v);
  return (STATUSES as string[]).includes(s) ? (s as Status) : 'No record';
};

/** Turn the rows the Apps Script returns (keyed by column header) into typed data. */
export function parseSheet(raw: { vehicles?: Row[]; log?: Row[]; schedule?: Row[]; sheetUrl?: string }): SheetData {
  return {
    vehicles: (raw.vehicles ?? [])
      .map((r) => ({
        name: str(r['Vehicle']),
        year: str(r['Year']),
        make: str(r['Make']),
        model: str(r['Model']),
        trim: str(r['Trim']),
        miles: num(r['Current miles']),
        milesUpdated: str(r['Miles updated']),
        notes: str(r['Notes']),
      }))
      .filter((v) => v.name),
    log: (raw.log ?? [])
      .map((r) => ({
        id: str(r['ID']),
        date: str(r['Date']),
        vehicle: str(r['Vehicle']),
        mileage: num(r['Mileage']),
        service: str(r['Service']),
        cost: num(r['Cost']),
        shop: str(r['Shop / who']),
        notes: str(r['Notes']),
      }))
      .filter((e) => e.vehicle && e.service),
    schedule: (raw.schedule ?? [])
      .map((r) => ({
        vehicle: str(r['Vehicle']),
        service: str(r['Service']),
        everyMiles: num(r['Every (miles)']),
        everyMonths: num(r['Every (months)']),
        lastDone: str(r['Last done']),
        lastMiles: num(r['Last miles']),
        nextDate: str(r['Next due date']),
        nextMiles: num(r['Next due miles']),
        status: status(r['Status']),
      }))
      .filter((s) => s.vehicle && s.service),
    sheetUrl: str(raw.sheetUrl),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-20" → "Nov 20, 2026". Anything else is returned as-is. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** 123456 → "123,456 mi". */
export function formatMiles(n: number | null): string {
  if (n === null) return '—';
  return `${Math.round(n).toLocaleString('en-US')} mi`;
}

export function formatCost(n: number | null): string {
  if (n === null) return '';
  return `$${n.toFixed(2)}`;
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
export function nextDue(item: ScheduleItem): string {
  const parts: string[] = [];
  if (item.nextDate) parts.push(formatDate(item.nextDate));
  if (item.nextMiles !== null) parts.push(formatMiles(item.nextMiles));
  return parts.join(' or ');
}

/** How often: "every 5,000 mi or 6 months". */
export function interval(item: ScheduleItem): string {
  const parts: string[] = [];
  if (item.everyMiles) parts.push(formatMiles(item.everyMiles));
  if (item.everyMonths) parts.push(`${item.everyMonths} month${item.everyMonths === 1 ? '' : 's'}`);
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

/** Newest first (by date, then by mileage). */
export function newestFirst(log: ServiceEntry[]): ServiceEntry[] {
  return [...log].sort((a, b) => b.date.localeCompare(a.date) || (b.mileage ?? 0) - (a.mileage ?? 0));
}

export function vehicleTitle(v: Vehicle): string {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');
}
