export const pacificDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// Keep whole Sunday–Saturday rows. Only the current month can hide elapsed weeks.
export function calendarDays(month, today, showPastWeeks = false) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const end = new Date(month.getFullYear(), month.getMonth()+1, 0, 12);
  end.setDate(end.getDate() + 6 - end.getDay());
  const currentMonth = dateKey(first).slice(0,7) === today.slice(0,7);
  let hiddenWeeks = 0;
  if (currentMonth && !showPastWeeks) {
    const currentWeek = new Date(`${today}T12:00:00`);
    currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());
    while (start < currentWeek) {
      start.setDate(start.getDate()+7);
      hiddenWeeks++;
    }
  }
  const days = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate()+1)) days.push(new Date(d));
  return {days, hiddenWeeks};
}
