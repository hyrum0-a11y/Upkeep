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
  itemIcon,
  entryLabel,
  itemTitle,
  monthlySpending,
  nameFor,
  isFeeName,
  policiesFor,
  kindOf,
  newestFirst,
  nextDue,
  parseNumber,
  perMonth,
  mileageAt,
  mileageChart,
  readingHistory,
  spendingByYear,
  statusLine,
  summarize,
} from './format.ts';
import { reminderPlan } from './remindersPlan.ts';

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
  assert.equal(formatDate('2026-11-20'), '2026-11-20');
  assert.equal(formatDate('2026-11-20T10:00:00Z'), '2026-11-20');
  assert.equal(formatReading(105000, 'miles'), '105,000 mi');
  assert.equal(formatReading(250, 'hours'), '250 hr');
  assert.equal(formatReading(null, 'miles'), '—');
  assert.equal(nextDue(d.schedule[1], 'miles'), '2026-11-01 or 201,000 mi');
  assert.equal(nextDue(d.schedule[2], ''), '2027-05-01');
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
  assert.ok(!s.readings.some((r) => r.item === 'Odyssey'));
  assert.ok(s.readings.some((r) => r.item === 'Van'));
});

test('readings: current reading shows in history and can be fixed in place', () => {
  // parseStore adds the item's existing reading as a history row.
  const start = store.readings.find((r) => r.item === 'Odyssey')!;
  assert.equal(start.reading, 201234);
  assert.equal(start.date, '2026-11-20');
  assert.ok(store.readings.some((r) => r.item === 'Mower' && r.reading === 87));
  assert.ok(!store.readings.some((r) => r.item === 'Water filter'));
  let s = D.updateReading(store, start.id, 200500, '2026-11-21');
  assert.equal(s.items[0].reading, 200500);
  assert.equal(s.items[0].readingUpdated, '2026-11-21');
  assert.equal(s.readings.filter((r) => r.item === 'Odyssey').length, 1);
  assert.throws(() => D.updateReading(s, 'nope', 1, TODAY), /not found/);
  // Stable across a save/load round trip (no duplicate start rows).
  s = D.parseStore(D.serializeStore(s));
  assert.equal(s.readings.filter((r) => r.item === 'Odyssey').length, 1);
});

test('spending: total and last 6 months; VIN parses', () => {
  const s = summarize(d.items[0], d, TODAY); // entries: 2026-05-01 $45.50, 2025-11-01 no cost
  assert.equal(s.spent, 45.5);
  assert.equal(s.spent6mo, 0); // May 1 is more than 6 months before Nov 21
  assert.equal(summarize(d.items[0], d, '2026-10-01').spent6mo, 45.5);
  assert.equal(D.parseStore(JSON.stringify({ items: [{ name: 'Car', vin: ' 1HGCM82633A004352 ' }] })).items[0].vin, '1HGCM82633A004352');
});

test('spending by year splits services, repairs and fees', () => {
  const s = D.compute(
    D.addEntries(
      store,
      [
        { item: 'Odyssey', date: '2026-08-01', reading: null, service: 'Engine trouble', cost: 300, shop: 'Shop', notes: '' },
        { item: 'Water filter', date: '2025-06-01', reading: null, service: 'Filter change', cost: 20, shop: '', notes: '' },
        { item: 'Odyssey', date: '2026-09-01', reading: null, service: 'Registration renewal', cost: 60, shop: '', notes: '' },
        { item: 'Odyssey', date: '2026-09-02', reading: null, service: 'Brake inspection', cost: 10, shop: '', notes: '', kind: 'Service' },
        { item: 'Odyssey', date: '2026-09-03', reading: null, service: 'Oil & filter', cost: 5, shop: '', notes: '', kind: 'Fee' },
      ],
      `${TODAY}T10:00:00Z`,
      () => Math.random().toString(36).slice(2, 10),
    ),
    TODAY,
  );
  assert.equal(kindOf(s.log.find((e) => e.service === 'Engine trouble')!, s), 'Repair');
  assert.equal(kindOf(s.log.find((e) => e.id === 'a1')!, s), 'Service');
  assert.equal(kindOf(s.log.find((e) => e.service === 'Registration renewal')!, s), 'Fee');
  assert.equal(isFeeName('Brake inspection'), false);
  assert.equal(isFeeName('Property tax'), true);
  const years = spendingByYear(s);
  assert.deepEqual(
    years.map((y) => [y.year, y.total, y.service, y.repair, y.fee]),
    [
      ['2026', 420.5, 55.5, 300, 65],
      ['2025', 20, 20, 0, 0],
    ],
  );
  // kind round-trips; junk kinds are dropped
  const rt = D.parseStore(D.serializeStore(s));
  assert.equal(rt.log.find((e) => e.service === 'Brake inspection')!.kind, 'Service');
  assert.equal(D.parseStore(JSON.stringify({ log: [{ item: 'A', service: 'B', kind: 'Nope' }] })).log[0].kind, undefined);
  assert.equal(years[0].items[0].item, 'Odyssey');
});

test('icons and reminders', () => {
  assert.equal(itemIcon({ ...store.items[0], model: 'Silverado', make: 'Chevrolet' }), '🛻');
  assert.equal(itemIcon(store.items[1]), '💧');
  assert.equal(itemIcon({ ...store.items[1], name: 'Living room fireplace' }), '🔥');
  const plan = reminderPlan(d, new Date(2026, 10, 21, 12));
  // Water filter is due 2027-05-01: a week before and on the day, 9 AM. Odyssey oil (due Nov 1) is past.
  assert.equal(plan.length, 2);
  assert.equal(plan[0].at, new Date(2027, 3, 24, 9).getTime());
  assert.match(plan[1].title, /Water filter: Filter change due today/);
});

test('older troubleshooting entries count as repairs and round-trip', () => {
  const s = D.addEntries(
    store,
    [
      {
        item: 'Odyssey',
        date: '2026-10-01',
        reading: null,
        service: 'Oil & filter',
        cost: 250,
        shop: '',
        notes: '',
        troubleshooting: true,
      },
    ],
    `${TODAY}T10:00:00Z`,
    () => 'tt',
  );
  const e = s.log.find((x) => x.id === 'tt')!;
  assert.equal(kindOf(e, s), 'Repair');
  assert.equal(entryLabel(e), 'Oil & filter *');
  assert.equal(D.parseStore(D.serializeStore(s)).log.find((x) => x.id === 'tt')!.troubleshooting, true);
  assert.equal(D.parseStore(D.serializeStore(s)).log.find((x) => x.id === 'a1')!.troubleshooting, undefined);
});

test('miles per month uses the last 12 months', () => {
  const s = D.parseStore(
    JSON.stringify({
      items: [{ name: 'Car', meter: 'miles' }],
      readings: [
        { id: '1', item: 'Car', date: '2020-01-01', reading: 10000 },
        { id: '2', item: 'Car', date: '2026-01-01', reading: 20000 },
        { id: '3', item: 'Car', date: '2026-11-01', reading: 30000 },
      ],
    }),
  );
  const pm = perMonth('Car', s)!;
  assert.ok(pm > 900 && pm < 1100, String(pm)); // 10,000 mi over 10 months, not 20,000 over ~6 years
});

test('monthly spending and display names', () => {
  const months = monthlySpending(d, 9, TODAY);
  assert.equal(months.length, 9);
  assert.equal(months[0].month, '2026-03');
  assert.equal(months[8].month, '2026-11');
  assert.equal(months.find((m) => m.month === '2026-05')!.byItem['Odyssey'], 45.5);
  assert.equal(nameFor('Odyssey', d), '2003 Honda Odyssey EX');
  assert.equal(nameFor('Water filter', d), 'Water filter');
});

test('reading history includes service mileages', () => {
  const h = readingHistory('Odyssey', d);
  // start reading (2026-11-20, 201,234) + two log readings
  assert.deepEqual(
    h.map((r) => [r.date, r.reading, r.service ?? null]),
    [
      ['2026-11-20', 201234, null],
      ['2026-05-01', 196000, 'Oil & filter'],
      ['2025-11-01', 191000, 'Oil & filter'],
    ],
  );
  assert.equal(h[1].entryId, 'a1');
});

test('mileage chart data', () => {
  const pts = [
    { date: '2026-01-01', reading: 1000 },
    { date: '2026-01-11', reading: 2000 },
  ];
  assert.equal(mileageAt('2026-01-06', pts), 1500);
  assert.equal(mileageAt('2025-01-01', pts), 1000);
  assert.equal(mileageAt('2027-01-01', pts), 2000);
  const c = mileageChart('Odyssey', d, '2026-01-01');
  assert.deepEqual(
    c.points.map((p) => p.date),
    ['2026-05-01', '2026-11-20'],
  );
  assert.equal(c.markers.length, 1); // only the $45.50 oil change has a cost
  assert.equal(c.markers[0].reading, 196000);
  assert.equal(mileageChart('Odyssey', d, '').points.length, 3);
});

test('plate parses and unknown fields survive a save', () => {
  const s = D.parseStore(
    JSON.stringify({
      items: [{ name: 'Van', plate: 'E1Y386', color: 'blue' }],
      schedule: [{ item: 'Van', service: 'Oil', everyMonths: 6, source: 'manual' }],
      log: [{ id: 'x', item: 'Van', service: 'Oil', date: '2026-01-01', receipt: 'r1' }],
      readings: [{ id: 'r', item: 'Van', date: '2026-01-01', reading: 5, photo: 'p' }],
    }),
  );
  assert.equal(s.items[0].plate, 'E1Y386');
  const back = JSON.parse(D.serializeStore(s));
  assert.equal(back.items[0].color, 'blue');
  assert.equal(back.items[0].plate, 'E1Y386');
  assert.equal(back.schedule[0].source, 'manual');
  assert.equal(back.log[0].receipt, 'r1');
  assert.equal(back.readings[0].photo, 'p');
});

test('policies: fields parse, covers follow renames, renewal is a fee', () => {
  let s = D.parseStore(
    JSON.stringify({
      items: [
        { name: 'Van', type: 'Vehicle', meter: 'miles' },
        { name: 'Auto insurance', type: 'Policy', company: 'Erie', policyNumber: 'Q1', covers: ['Van'] },
      ],
      schedule: [{ item: 'Auto insurance', service: 'Policy renewal', everyMonths: 12 }],
      log: [{ id: 'p', item: 'Auto insurance', service: 'Policy renewal', date: '2026-11-10', cost: 100 }],
    }),
  );
  assert.equal(s.items[1].company, 'Erie');
  assert.equal(s.items[0].company, undefined);
  assert.deepEqual(
    policiesFor('Van', s).map((p) => p.name),
    ['Auto insurance'],
  );
  assert.equal(itemIcon(s.items[1]), '🛡️');
  assert.equal(kindOf(s.log[0], s), 'Fee');
  s = D.saveItem(s, { ...s.items[0], name: 'Odyssey' }, 'Van');
  assert.deepEqual(s.items[1].covers, ['Odyssey']);
  s = D.deleteItem(s, 'Odyssey');
  assert.deepEqual(s.items[0].covers, []);
});
