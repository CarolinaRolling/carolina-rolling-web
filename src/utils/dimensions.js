// Append an inch mark to a dimension value only if it doesn't already have one, so a value stored
// WITH a quote (e.g. "5 3/8\"" read off a drawing) doesn't render doubled ("5 3/8\"\"").
export function inch(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  return s.endsWith('"') ? s : s + '"';
}

// Collapse any doubled inch marks already present in a free-text string (safety net for stored
// descriptions built before the fix).
export function dedupeInch(s) {
  return (s || '').replace(/""+/g, '"');
}
