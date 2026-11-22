// Which reminders to schedule (plain TypeScript so it runs in unit tests).
import type { SheetData } from './format';

export type PlannedReminder = { at: number; title: string; body: string };

const DAYS_BEFORE = 7;
const HOUR = 9; // 9 AM local time
const MAX = 60;

/** A week-before and a due-day reminder for each service with a future due date. */
export function reminderPlan(data: SheetData, now: Date): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const s of data.schedule) {
    if (!s.nextDate) continue;
    const [y, m, d] = s.nextDate.split('-').map(Number);
    const due = new Date(y, m - 1, d, HOUR);
    const before = new Date(y, m - 1, d - DAYS_BEFORE, HOUR);
    const name = `${s.item}: ${s.service}`;
    if (before > now) out.push({ at: before.getTime(), title: `${name} due in a week`, body: `Due ${s.nextDate}.` });
    if (due > now) out.push({ at: due.getTime(), title: `${name} due today`, body: 'Open Upkeep to log it when it is done.' });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX);
}
