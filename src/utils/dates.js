// Central date formatting — single source of truth for the app.
// Use these so dates render consistently as Month/Day/Year (MM/DD/YYYY) everywhere.

import { shopToday } from './shopDate';

const PACIFIC = 'America/Los_Angeles';

// MM/DD/YYYY  e.g. 06/13/2026
export function formatDate(value, { fallback = 'N/A' } = {}) {
  if (!value) return fallback;
  // Treat bare YYYY-MM-DD as local noon so it doesn't shift a day across time zones
  const v = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value;
  const d = new Date(v);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// MM/DD/YYYY, h:mm AM/PM  e.g. 06/13/2026, 2:30 PM
export function formatDateTime(value, { fallback = 'N/A' } = {}) {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleString('en-US', {
    timeZone: PACIFIC,
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// Today's date on the shop's calendar, 'YYYY-MM-DD' (audit R31) — lives in ./shopDate, re-exported here.
export { shopToday };

// A "day" stored in a timestamp column (payment date, invoice date). Days saved from a date picker
// arrive as midnight UTC, which new Date(...) shows as the PREVIOUS day in California (R31): those
// are shown as the calendar day they name; real timestamps as the Pacific day they happened.
export function formatDay(value, { fallback = 'N/A', style = 'short' } = {}) {
  if (!value) return fallback;
  const str = typeof value === 'string' ? value : (value instanceof Date ? value.toISOString() : String(value));
  const opts = style === 'long' ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: '2-digit', day: '2-digit', year: 'numeric' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?(Z|\+00:00)$/.test(str)) {
    const [y, m, d] = str.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', opts);
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', { ...opts, timeZone: PACIFIC });
}

// The 'YYYY-MM-DD' calendar day of a stored day value (same rules as formatDay) — for date inputs
export function dayValue(value) {
  if (!value) return '';
  const str = typeof value === 'string' ? value : (value instanceof Date ? value.toISOString() : String(value));
  if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?(Z|\+00:00)$/.test(str)) return str.slice(0, 10);
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const dateUtils = { formatDate, formatDateTime, shopToday, formatDay, dayValue };
export default dateUtils;
