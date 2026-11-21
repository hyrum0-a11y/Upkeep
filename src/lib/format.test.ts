import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  parseSheet,
} from './format.ts';

const raw = {
  items: [
    { Item: 'Odyssey', Type: 'Vehicle', Year: 2003, Make: 'Honda', Model: 'Odyssey EX', Meter: 'miles', 'Current reading': 201234, 'Reading updated': '2026-11-20', Notes: '' },
    { Item: 'Water filter', Type: 'Equipment', Year: '', Make: '', Model: '', Meter: '', 'Current reading': '', 'Reading updated': '', Notes: '' },
    { Item: 'Mower', Type: '', Meter: 'Hours', 'Current reading': 87 },
    { Item: '', Type: '' },
  ],
  log: [
    { ID: 'a1', Date: '2026-05-01', Item: 'Odyssey', Reading: 196000, Service: 'Oil & filter', Cost: 45.5, 'Shop / who': 'Me', Notes: '' },
    { ID: 'a2', Date: '2026-11-01', Item: 'Water filter', Reading: '', Service: 'Filter change', Cost: '', 'Shop / who': '', Notes: '' },
  ],
  schedule: [
    { Item: 'Odyssey', Service: 'Coolant', 'Every (mi/hr)': 60000, 'Every (months)': 60, Status: 'No record' },
    { Item: 'Odyssey', Service: 'Oil & filter', 'Every (mi/hr)': 5000, 'Every (months)': 6, 'Last done': '2026-05-01', 'Last reading': 196000, 'Next due date': '2026-11-01', 'Next due reading': 201000, Status: 'Overdue', 'Part / spec': '5W-20' },
    { Item: 'Water filter', Service: 'Filter change', 'Every (mi/hr)': '', 'Every (months)': 6, 'Last done': '2026-11-01', 'Next due date': '2027-05-01', 'Next due reading': '', Status: 'OK' },
  ],
  sheetUrl: 'https://example.com',
};

test('parseSheet reads rows by header and skips blanks', () => {
  const d = parseSheet(raw);
  assert.equal(d.items.length, 3);
  assert.equal(d.items[0].reading, 201234);
  assert.equal(d.items[0].meter, 'miles');
  assert.equal(d.items[1].meter, '');
  assert.equal(d.items[2].meter, 'hours');
  assert.equal(d.items[2].type, 'Equipment');
  assert.ok(isVehicle(d.items[0]) && !isVehicle(d.items[1]));
  assert.equal(itemTitle(d.items[0]), '2003 Honda Odyssey EX');
  assert.equal(d.log[1].reading, null);
  assert.equal(d.log[0].cost, 45.5);
  assert.equal(d.schedule[1].nextReading, 201000);
  assert.equal(d.schedule[0].status, 'No record');
  assert.equal(d.schedule[1].part, '5W-20');
  assert.equal(d.schedule[0].part, '');
});

test('unknown status falls back to No record', () => {
  const d = parseSheet({ schedule: [{ Item: 'X', Service: 'Y', Status: '#REF!' }] });
  assert.equal(d.schedule[0].status, 'No record');
});

test('formatting follows the meter', () => {
  assert.equal(formatDate('2026-11-20'), 'Nov 20, 2026');
  assert.equal(formatReading(105000, 'miles'), '105,000 mi');
  assert.equal(formatReading(250, 'hours'), '250 hr');
  assert.equal(formatReading(null, 'miles'), '—');
  const d = parseSheet(raw);
  assert.equal(nextDue(d.schedule[1], 'miles'), 'Nov 1, 2026 or 201,000 mi');
  assert.equal(nextDue(d.schedule[2], ''), 'May 1, 2027');
  assert.equal(interval(d.schedule[1], 'miles'), 'every 5,000 mi or 6 months');
  assert.equal(interval(d.schedule[2], ''), 'every 6 months');
});

test('sorting', () => {
  const d = parseSheet(raw);
  assert.deepEqual(byUrgency(d.schedule).map((s) => s.service), ['Oil & filter', 'Filter change', 'Coolant']);
  assert.deepEqual(newestFirst(d.log).map((e) => e.id), ['a2', 'a1']);
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
