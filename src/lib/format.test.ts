import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from './data.ts';
import {
  byUrgency,
  formatDate,
  formatReading,
  interval,
  isISODate,
  isVehicle,
  itemTitle,
  newestFirst,
  nextDue,
  parseNumber,
  statusLine,
  summarize,
} from './format.ts';

const TODAY = '2026-11-21';

const json = JSON.stringify({
  version: 1,
  items: [
    {
      name: 'Odyssey',
      type: 'Vehicle',
      year: 2003,
      make: 'Honda',
      model: 'Odyssey EX',
      meter: 'miles',
      reading: '201,234',
      readingUpdated: '2026-11-20',
      purchased: '2026-10-10',
    },
    { name: 'Water filter', type: 'Equipment', meter: '' },
    { name: 'Mower', meter: 'Hours', reading: 87 },
    { name: '' },
  ],
  schedule: [
    { item: 'Odyssey', service: 'Coolant', every: 60000, everyMonths: 60 },
    { item: 'Odyssey', service: 'Oil & filter', every: 5000, everyMonths: 6, part: '5W-20' },
    { item: 'Water filter', service: 'Filter change', everyMonths: 6 },
  ],
  log: [
    { id: 'a1', date: '2026-05-01', item: 'Odyssey', reading: 196000, service: 'Oil & filter', cost: 45.5, shop: 'Me' },
    { id: 'a0', date: '2025-11-01', item: 'Odyssey', reading: 191000, service: 'Oil & filter' },
    { id: 'a2', date: '2026-11-01', item: 'Water filter', service: 'Filter change' },
  ],
});

const store = D.parseStore(json);
const d = D.compute(store, TODAY);

test('parseStore tolerates hand edits and skips blank rows', () => {
  assert.equal(store.items.length, 3);
  assert.equal(store.items[0].reading, 201234);
  assert.equal(store.items[0].year, '2003');
  assert.equal(store.items[0].purchased, '2026-10-10');
  assert.equal(store.items[1].meter, '');
  assert.equal(store.items[2].meter, 'hours');
  assert.equal(store.items[2].type, 'Equipment');
  assert.ok(isVehicle(store.items[0]) && !isVehicle(store.items[1]));
  assert.equal(itemTitle(store.items[0]), '2003 Honda Odyssey EX');
  assert.equal(store.log[2].reading, null);
  assert.equal(store.schedule[2].every, null);
  assert.throws(() => D.parseStore('{ nope'), /valid JSON/);
});

test('serialize round-trips', () => {
  assert.deepEqual(D.parseStore(D.serializeStore(store)), store);
  assert.deepEqual(D.parseStore(D.serializeStore(D.emptyStore())), D.emptyStore());
});

test('compute works out last done, next due and status', () => {
  const [coolant, oil, filter] = d.schedule;
  assert.equal(coolant.status, 'No record');
  assert.equal(oil.lastDone, '2026-05-01');
  assert.equal(oil.lastReading, 196000);
  assert.equal(oil.nextDate, '2026-11-01');
  assert.equal(oil.nextReading, 201000);
  assert.equal(oil.status, 'Overdue');
  assert.equal(oil.part, '5W-20');
  assert.equal(filter.nextDate, '2027-05-01');
  assert.equal(filter.status, 'OK');
});

test('due soon by miles and by date', () => {
  const s = D.parseStore(
    JSON.stringify({
      items: [{ name: 'Car', meter: 'miles', reading: 100600 }],
      schedule: [
        { item: 'Car', service: 'Oil', every: 5000, everyMonths: 12 },
        { item: 'Car', service: 'Wipers', everyMonths: 12 },
      ],
      log: [
        { id: '1', date: '2026-06-01', item: 'Car', service: 'Oil', reading: 96000 },
        { id: '2', date: '2025-12-10', item: 'Car', service: 'Wipers' },
      ],
    }),
  );
  const [oil, wipers] = D.compute(s, TODAY).schedule;
  assert.equal(oil.status, 'Due soon'); // 400 miles left of 5,000
  assert.equal(wipers.status, 'Due soon'); // due Dec 10, 19 days away
});

test('addMonths clamps like EDATE', () => {
  assert.equal(D.addMonths('2026-08-31', 6), '2027-02-28');
  assert.equal(D.addMonths('2026-11-15', 2), '2027-01-15');
});

test('changes', () => {
  let s = D.addEntries(
    store,
    [{ item: 'Odyssey', date: TODAY, reading: 202000, service: 'Oil & filter', cost: null, shop: '', notes: '' }],
    `${TODAY}T10:00:00Z`,
    () => 'new',
  );
  assert.equal(s.items[0].reading, 202000);
  assert.equal(D.compute(s, TODAY).schedule[1].status, 'OK');
  s = D.deleteEntry(s, 'new');
  assert.equal(s.log.length, 3);
  assert.throws(() => D.deleteEntry(s, 'zzz'));

  s = D.saveItem(s, { ...s.items[0], name: 'Van' }, 'Odyssey');
  assert.equal(s.schedule[0].item, 'Van');
  assert.ok(s.log.filter((e) => e.item === 'Van').length === 2);
  assert.throws(() => D.saveItem(s, { ...s.items[1], name: 'van' }), /already/);

  s = D.saveSchedule(s, { item: 'Van', service: 'Oil change', every: 5000, everyMonths: 6, part: '' }, 'Oil & filter');
  assert.equal(D.compute(s, TODAY).schedule.find((r) => r.service === 'Oil change')?.lastDone, '2026-05-01');
  assert.throws(() => D.saveSchedule(s, { item: 'Van', service: 'X', every: null, everyMonths: null, part: '' }), /how often/);
  s = D.deleteSchedule(s, 'Van', 'Coolant');
  assert.equal(s.schedule.length, 2);
  s = D.deleteItem(s, 'Van');
  assert.equal(s.items.length, 2);
  assert.equal(s.log.length, 3); // history stays
});

test('base64 handles UTF-8', () => {
  const t = 'Claire\'s Hyundai · 2/32" — ✓ 🚗';
  assert.equal(D.fromBase64(D.toBase64(t)), t);
  assert.equal(D.toBase64('hello'), Buffer.from('hello').toString('base64'));
  assert.equal(
    D.fromBase64(
      Buffer.from(t)
        .toString('base64')
        .replace(/(.{10})/g, '$1\n'),
    ),
    t,
  );
});

test('formatting follows the meter', () => {
  assert.equal(formatDate('2026-11-20'), 'Nov 20, 2026');
  assert.equal(formatReading(105000, 'miles'), '105,000 mi');
  assert.equal(formatReading(250, 'hours'), '250 hr');
  assert.equal(formatReading(null, 'miles'), '—');
  assert.equal(nextDue(d.schedule[1], 'miles'), 'Nov 1, 2026 or 201,000 mi');
  assert.equal(nextDue(d.schedule[2], ''), 'May 1, 2027');
  assert.equal(interval(d.schedule[1], 'miles'), 'every 5,000 mi or 6 months');
  assert.equal(interval(d.schedule[2], ''), 'every 6 months');
});

test('sorting', () => {
  assert.deepEqual(
    byUrgency(d.schedule).map((s) => s.service),
    ['Oil & filter', 'Filter change', 'Coolant'],
  );
  assert.deepEqual(
    newestFirst(d.log).map((e) => e.id),
    ['a2', 'a1', 'a0'],
  );
});

test('input parsing', () => {
  assert.equal(parseNumber(' 123,456 '), 123456);
  assert.equal(parseNumber('$45.10'), 45.1);
  assert.equal(parseNumber(''), null);
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(isISODate('2026-02-28'));
  assert.ok(!isISODate('2026-02-30'));
  assert.ok(!isISODate('11/20/2026'));
});

test('summarize counts statuses and finds next and last', () => {
  const s = summarize(d.items[0], d);
  assert.equal(s.overdue, 1);
  assert.equal(s.noRecord, 1);
  assert.equal(s.next?.service, 'Oil & filter');
  assert.equal(s.last?.id, 'a1');
  assert.equal(s.spent, 45.5);
  assert.equal(statusLine(s), '1 overdue');
  assert.equal(statusLine(summarize(d.items[1], d)), 'All up to date');
  assert.equal(statusLine(summarize(d.items[2], d)), 'Nothing scheduled');
});

test('updateEntry fixes an entry and keeps entered', () => {
  const s = D.updateEntry(
    store,
    'a1',
    { item: 'Odyssey', date: '2026-05-02', reading: 205000, service: 'Oil & filter', cost: 50, shop: 'Shop', notes: 'fixed' },
    `${TODAY}T10:00:00Z`,
  );
  const e = s.log.find((x) => x.id === 'a1')!;
  assert.equal(e.date, '2026-05-02');
  assert.equal(e.cost, 50);
  assert.equal(e.entered, store.log[0].entered);
  assert.equal(s.items[0].reading, 205000);
  assert.throws(() => D.updateEntry(store, 'nope', e, TODAY), /not found/);
});

test('readings: dated history sets the current reading by latest date', async () => {
  const { perMonth } = await import('./format.ts');
  let n = 0;
  const id = () => `r${++n}`;
  let s = D.setReading(store, 'Odyssey', 202000, '2026-11-21', id);
  assert.equal(s.items[0].reading, 202000);
  s = D.setReading(s, 'Odyssey', 199000, '2026-09-01', id); // back-dated: current stays
  assert.equal(s.items[0].reading, 202000);
  assert.equal(s.items[0].readingUpdated, '2026-11-21');
  s = D.setReading(s, 'Odyssey', 201500, '2026-11-21', id); // same day fix: last one wins
  assert.equal(s.items[0].reading, 201500);
  s = D.deleteReading(s, 'r3');
  assert.equal(s.items[0].reading, 202000);
  assert.deepEqual(D.parseStore(D.serializeStore(s)), s);
  const usage = perMonth('Odyssey', D.compute(s, TODAY));
  assert.ok(usage !== null && usage > 800 && usage < 950); // 11,000 miles over 385 days ≈ 870/month
  assert.equal(perMonth('Water filter', D.compute(s, TODAY)), null);
  s = D.saveItem(s, { ...s.items[0], name: 'Van' }, 'Odyssey');
  assert.ok(s.readings.every((r) => r.item === 'Van'));
});
