import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays, dateKey, pacificDay} from '../src/calendar-dates.js';

test('mid-month calendar begins with the current week and retains every remaining day', () => {
  const month = new Date('2026-10-01T12:00:00');
  const {days, hiddenWeeks} = calendarDays(month, '2026-10-19');
  assert.equal(hiddenWeeks, 3);
  assert.equal(dateKey(days[0]), '2026-10-18');
  assert.equal(dateKey(days.at(-1)), '2026-10-31');
  assert.equal(days.length, 14);
  assert.ok(days.some(d => dateKey(d) === '2026-10-19'));
  const full = calendarDays(month, '2026-10-19', true);
  assert.equal(dateKey(full.days[0]), '2026-09-27');
  assert.equal(full.days.length, 35);
});

test('all month lengths, week boundaries and year transitions keep complete aligned rows', () => {
  for (const year of [2026, 2027, 2028]) for (let m = 0; m < 12; m++) {
    const month = new Date(year,m,1,12), last = new Date(year,m+1,0,12).getDate();
    for (let day = 1; day <= last; day++) {
      const today = dateKey(new Date(year,m,day,12));
      const {days} = calendarDays(month,today);
      assert.equal(days[0].getDay(),0);
      assert.equal(days.at(-1).getDay(),6);
      assert.equal(days.length%7,0);
      assert.ok(days.some(d=>dateKey(d)===today));
      assert.equal(days.filter(d=>d.getMonth()===m && dateKey(d)>=today).length,last-day+1);
    }
    const full = calendarDays(month,'2025-01-01');
    assert.equal(full.hiddenWeeks,0);
    assert.equal(full.days.filter(d=>d.getMonth()===m).length,last);
  }
});

test('today uses Pacific time on both sides of midnight and daylight saving boundaries', () => {
  assert.equal(pacificDay(new Date('2026-10-20T06:59:00Z')),'2026-10-19');
  assert.equal(pacificDay(new Date('2026-10-20T07:00:00Z')),'2026-10-20');
  assert.equal(pacificDay(new Date('2026-11-01T08:30:00Z')),'2026-11-01');
  assert.equal(pacificDay(new Date('2026-11-01T09:30:00Z')),'2026-11-01');
});
