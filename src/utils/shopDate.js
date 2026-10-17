// Shop-calendar dates (audit R31). The shop is in Bellflower, CA, so "today" is the Pacific day.
// new Date().toISOString().slice(0, 10) is the UTC day — tomorrow from ~5 pm Pacific — and
// new Date('YYYY-MM-DD') is midnight UTC, which displays as the previous day in California.

const SHOP_TZ = 'America/Los_Angeles';

const ymdFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Today's date on the shop's calendar, 'YYYY-MM-DD'.
export function shopToday() {
  return ymdFormatter.format(new Date());
}

// 'YYYY-MM-DD' plus (or minus) a number of calendar days, 'YYYY-MM-DD'. Pure calendar math (no DST shifts).
export function shopDateAdd(ymd, days) {
  const m = DATE_ONLY.exec(String(ymd || '').slice(0, 10));
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (Number(days) || 0)));
  return d.toISOString().slice(0, 10);
}

// The browser's local 'YYYY-MM-DD' for a Date (for Date objects built with local-time math).
export function localYmd(date = new Date()) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const da = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

// Value for an <input type="datetime-local"> set to the current local time ('YYYY-MM-DDTHH:mm').
export function localDateTimeInputNow() {
  const d = new Date();
  return `${localYmd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Display a date. A pure 'YYYY-MM-DD' is the calendar day it names (parsed as a local date);
// anything else (a timestamp) falls back to new Date(value). opts are toLocaleDateString options;
// pass { locale } to choose the locale (default 'en-US') and { fallback } for empty/invalid input.
export function formatDateOnly(value, opts = {}) {
  const { locale = 'en-US', fallback = '', ...fmt } = opts || {};
  if (value === null || value === undefined || value === '') return fallback;
  let d;
  const m = typeof value === 'string' ? DATE_ONLY.exec(value) : null;
  if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  else d = new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(locale, Object.keys(fmt).length ? fmt : undefined);
}

const shopDate = { shopToday, shopDateAdd, formatDateOnly, localYmd, localDateTimeInputNow };
export default shopDate;
