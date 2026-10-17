// U31: a copy of the server's invoice calculation (backend/src/services/pricing.js calculatePartTotal and
// backend/src/services/invoiceTotals.js computeInvoiceTotals) so the work-order page's preview while
// editing follows the same rules as the invoice, the PDF and QuickBooks. When not editing, the page shows
// the server's own numbers (GET /workorders/:id/invoice-totals). Keep in step with those server files.
import { minimumInfo, expediteLaborBase } from './laborMinimum';

export const SERVICE_TYPES = ['fab_service', 'shop_rate', 'rush_service'];
const EMERGENCY_FEES = { 'Saturday': 600, 'Saturday Night': 800, 'Sunday': 600, 'Sunday Night': 800 };
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fdOf = (p) => (p && p.formData && typeof p.formData === 'object') ? p.formData : {};

export function roundUpMaterial(value, rounding) {
  if (!rounding || rounding === 'none' || !value || value <= 0) return value;
  if (rounding === 'dollar') return Math.ceil(value);
  if (rounding === 'five') return Math.ceil(value / 5) * 5;
  return value;
}

/** pricing.basePartLaborEach */
export function basePartLaborEach(part) {
  const fd = fdOf(part);
  const stored = parseFloat(fd._baseLaborTotal);
  if (!isNaN(stored) && stored > 0) return stored;
  return parseFloat(part.laborTotal) || parseFloat(fd.laborTotal)
      || parseFloat(part.rollingCost) || parseFloat(fd.rollingCost) || 0;
}

/** pricing.calculatePartTotal — a line's billed total (the stored partTotal when set) */
export function calculatePartTotal(part) {
  const fd = fdOf(part);
  const stored = parseFloat(part.partTotal);
  if (stored && stored > 0) return stored;
  const matCost = parseFloat(part.materialTotal) || parseFloat(fd.materialTotal) || 0;
  const matMarkupRaw = parseFloat(part.materialMarkupPercent);
  const matMarkup = isNaN(matMarkupRaw) ? (parseFloat(fd.materialMarkupPercent) || (matCost > 0 ? 20 : 0)) : matMarkupRaw;
  const matEach = roundUpMaterial(matCost * (1 + matMarkup / 100), fd._materialRounding);
  const labEach = basePartLaborEach(part);
  const setup = parseFloat(part.setupCharge) || parseFloat(fd.setupCharge) || 0;
  const other = parseFloat(part.otherCharges) || parseFloat(fd.otherCharges) || 0;
  const opCost = parseFloat(part.outsideProcessingCost) || 0;
  const opMarkup = parseFloat(part.outsideProcessingMarkupPercent) || 0;
  const opEach = Math.round(opCost * (1 + opMarkup / 100) * 100) / 100;
  const opTransport = parseFloat(part.outsideProcessingTransportCost) || 0;
  const opTransportMarkup = parseFloat(part.outsideProcessingTransportMarkupPercent) || 0;
  const opTransportEach = Math.round(opTransport * (1 + opTransportMarkup / 100) * 100) / 100;
  const qty = parseInt(part.quantity) || 1;
  return Math.round((matEach + labEach + setup + other + opEach + opTransportEach) * qty * 100) / 100;
}

export function chargeBilled(c) {
  return (parseFloat(c.shippingCost) || 0) * (1 + (parseFloat(c.shippingMarkup) || 0) / 100)
       + (parseFloat(c.materialsCost) || 0) * (1 + (parseFloat(c.materialsMarkup) || 0) / 100);
}

function opTransportBilled(wo) {
  const trips = Array.isArray(wo && wo.opTransports) ? wo.opTransports : [];
  let total = 0;
  for (const t of trips) {
    if (!t || typeof t !== 'object') continue;
    total += round2((parseFloat(t.cost) || 0) * (1 + (parseFloat(t.markup) || 0) / 100));
  }
  return round2(total);
}

export function isTaxExempt(wo, client) {
  const s = (client?.taxStatus || '').toLowerCase();
  return s === 'resale' || s === 'exempt' || wo?.taxExempt === true || wo?.taxExempt === 'true';
}

function rushFee(rushPart, parts, minInfo) {
  const fd = fdOf(rushPart);
  let amount = 0;
  const labels = [];
  if (fd._expediteEnabled) {
    if (fd._expediteType === 'custom_amt') {
      amount += parseFloat(fd._expediteCustomAmt) || 0;
      labels.push('Expedite Fee');
    } else {
      let pct = parseFloat(fd._expediteType) || 0;
      if (fd._expediteType === 'custom_pct') pct = parseFloat(fd._expediteCustomPct) || 0;
      const base = expediteLaborBase(parts, minInfo, calculatePartTotal);
      amount += round2(base * (pct / 100));
      labels.push(`Expedite Service (${pct}% of labor)`);
    }
  }
  let emergency = 0;
  if (fd._emergencyEnabled) {
    emergency = EMERGENCY_FEES[fd._emergencyDay] || 0;
    if (emergency > 0) { amount += emergency; labels.push(`Emergency Off-Hours (${fd._emergencyDay})`); }
  }
  return { amount: amount > 0 ? round2(amount) : 0, emergency, label: labels.join(' + ') || 'Rush / Emergency Service' };
}

/** invoiceTotals.computeInvoiceTotals — same fields as GET /workorders/:id/invoice-totals (plus minInfo) */
export function computeInvoiceTotals({ wo, parts = [], client = null, shipmentCharges = [], laborMinimums = [] }) {
  wo = wo || {};
  const sorted = [...(parts || [])].sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0));
  const regular = sorted.filter(p => !SERVICE_TYPES.includes(p.partType));
  const services = sorted.filter(p => SERVICE_TYPES.includes(p.partType));

  let partsSubtotal = 0;
  for (const p of regular) partsSubtotal += calculatePartTotal(p);
  for (const svc of services) {
    const fd = fdOf(svc);
    let linked = false;
    if (fd._linkedPartId && regular.some(p => String(p.id) === String(fd._linkedPartId))) linked = true;
    if (!linked && regular.some(p => (p.partNumber || 0) < (svc.partNumber || 0))) linked = true;
    const amt = calculatePartTotal(svc);
    if (linked || amt > 0) partsSubtotal += amt;
  }

  const minInfo = minimumInfo(sorted, wo.minimumOverride, laborMinimums || []);
  const rushPart = sorted.find(p => p.partType === 'rush_service' && calculatePartTotal(p) <= 0) || null;
  const rush = rushPart ? rushFee(rushPart, parts, minInfo) : { amount: 0, emergency: 0, label: '' };

  const activeCharges = (shipmentCharges || []).filter(c => chargeBilled(c) > 0);
  let shippingTotal = 0;
  let usesLegacyTrucking = false;
  if (activeCharges.length > 0) {
    for (const c of activeCharges) shippingTotal += round2(chargeBilled(c));
  } else if ((parseFloat(wo.truckingCost) || 0) > 0) {
    shippingTotal = parseFloat(wo.truckingCost);
    usesLegacyTrucking = true;
  }

  const opTransportTotal = opTransportBilled(wo);
  let running = partsSubtotal + rush.amount + opTransportTotal + shippingTotal;
  const minimumAdjustment = minInfo.applies ? minInfo.adjustment : 0;
  running += minimumAdjustment;

  const discountPercent = parseFloat(wo.discountPercent) || 0;
  const discountAmountField = parseFloat(wo.discountAmount) || 0;
  let discountTotal = 0;
  if (discountPercent > 0) discountTotal = round2((running - shippingTotal) * Math.min(100, discountPercent) / 100);
  else if (discountAmountField > 0) discountTotal = discountAmountField;
  discountTotal = Math.min(discountTotal, Math.max(0, round2(running - shippingTotal)));
  running -= discountTotal;

  const exempt = isTaxExempt(wo, client);
  const taxRate = exempt ? 0 : (parseFloat(wo.taxRate) || 0);
  const taxableAmount = exempt ? 0 : round2(running - shippingTotal);
  const taxAmount = round2(taxableAmount * taxRate / 100);
  const preTaxTotal = round2(running);
  const grandTotal = round2(preTaxTotal + taxAmount);

  return {
    partsSubtotal: round2(partsSubtotal),
    rushAmount: rush.amount,
    rushLabel: rush.label,
    emergencyAmount: rush.emergency,
    rushPartId: rushPart ? rushPart.id : null,
    opTransportTotal,
    minimumAdjustment: round2(minimumAdjustment),
    discountPercent,
    discountTotal: round2(discountTotal),
    shippingTotal: round2(shippingTotal),
    usesLegacyTrucking,
    isTaxExempt: exempt,
    taxRate,
    taxableAmount,
    partsAfterDiscount: round2(preTaxTotal - shippingTotal),
    taxAmount,
    preTaxTotal,
    grandTotal,
    amount: grandTotal,
    minInfo,
  };
}
