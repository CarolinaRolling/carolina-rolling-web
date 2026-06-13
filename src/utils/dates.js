// Central date formatting — single source of truth for the app.
// Use these so dates render consistently as Month/Day/Year (MM/DD/YYYY) everywhere.

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

const dateUtils = { formatDate, formatDateTime };
export default dateUtils;
