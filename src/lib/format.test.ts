import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byUrgency, formatDate, formatMiles, interval, isISODate, newestFirst, nextDue, parseNumber, parseSheet } from './format.ts';

const raw = {
  vehicles: [
    { Vehicle: 'Odyssey', Year: 2003, Make: 'Honda', Model: 'Odyssey', Trim: 'EX', 'Current miles': 201234, 'Miles updated': '2026-11-20', Notes: '' },
    { Vehicle: '', Year: '' },
  ],
  log: [
    { ID: 'a1', Date: '2026-05-01', Vehicle: 'Odyssey', Mileage: 196000, Service: 'Oil & filter', Cost: 45.5, 'Shop / who': 'Me', Notes: '' },
    { ID: 'a2', Date: '2026-11-01', Vehicle: 'Odyssey', Mileage: '', Service: 'Tire rotation', Cost: '', 'Shop / who': '', Notes: '' },
  ],
  schedule: [
    { Vehicle: 'Odyssey', Service: 'Coolant', 'Every (miles)': 60000, 'Every (months)': 60, 'Last done': '', 'Last miles': '', 'Next due date': '', 'Next due miles': '', Status: 'No record' },
    { Vehicle: 'Odyssey', Service: 'Oil & filter', 'Every (miles)': 5000, 'Every (months)': 6, 'Last done': '2026-05-01', 'Last miles': 196000, 'Next due date': '2026-11-01', 'Next due miles': 201000, Status: 'Overdue' },
    { Vehicle: 'Odyssey', Service: 'Tire rotation', 'Every (miles)': 7500, 'Every (months)': 6, 'Last done': '2026-11-01', 'Last miles': '', 'Next due date': '2027-05-01', 'Next due miles': '', Status: 'OK' },
  ],
  sheetUrl: 'https://example.com',
};

test('parseSheet reads rows by header and skips blanks', () => {
  const d = parseSheet(raw);
  assert.equal(d.vehicles.length, 1);
  assert.equal(d.vehicles[0].miles, 201234);
  assert.equal(d.log[1].mileage, null);
  assert.equal(d.log[0].cost, 45.5);
  assert.equal(d.schedule[1].nextMiles, 201000);
  assert.equal(d.schedule[0].status, 'No record');
});

test('unknown status falls back to No record', () => {
  const d = parseSheet({ schedule: [{ Vehicle: 'X', Service: 'Y', Status: '#REF!' }] });
  assert.equal(d.schedule[0].status, 'No record');
});

test('formatting', () => {
  assert.equal(formatDate('2026-11-20'), 'Nov 20, 2026');
  assert.equal(formatMiles(105000), '105,000 mi');
  assert.equal(formatMiles(null), '—');
  const d = parseSheet(raw);
  assert.equal(nextDue(d.schedule[1]), 'Nov 1, 2026 or 201,000 mi');
  assert.equal(nextDue(d.schedule[2]), 'May 1, 2027');
  assert.equal(interval(d.schedule[1]), 'every 5,000 mi or 6 months');
});

test('sorting', () => {
  const d = parseSheet(raw);
  assert.deepEqual(byUrgency(d.schedule).map((s) => s.service), ['Oil & filter', 'Tire rotation', 'Coolant']);
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
