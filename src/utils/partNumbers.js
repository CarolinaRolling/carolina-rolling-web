// Display numbering for parts + their services (mirrors backend/src/services/partNumbering.js).
// Production parts get whole numbers (1, 2, 3...); each linked service gets parent.N (1.1, 1.2...).
// Derived at render time only — stored partNumber and links are untouched, so existing
// work orders/estimates keep working and just render with the cleaner numbering.

export const SERVICE_TYPES = ['fab_service', 'shop_rate', 'rush_service', 'inspection'];

const linkOf = (p) =>
  (p && (p._linkedPartId || (p.formData && (p.formData._linkedPartId || p.formData.linkedPartId)))) || null;

export function computeDisplayNumbers(parts) {
  const sorted = [...(parts || [])].sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0));
  const display = {};
  const prodInt = {};
  let counter = 0;
  for (const p of sorted) {
    if (!SERVICE_TYPES.includes(p.partType)) {
      counter += 1;
      prodInt[p.id] = counter;
      display[p.id] = String(counter);
    }
  }
  const svcCount = {};
  for (const p of sorted) {
    if (SERVICE_TYPES.includes(p.partType)) {
      const parent = linkOf(p);
      if (parent && prodInt[parent] != null) {
        svcCount[parent] = (svcCount[parent] || 0) + 1;
        display[p.id] = `${prodInt[parent]}.${svcCount[parent]}`;
      } else {
        counter += 1;
        display[p.id] = String(counter);
      }
    }
  }
  return { display, prodInt };
}
