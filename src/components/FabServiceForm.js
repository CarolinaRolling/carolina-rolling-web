import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getSettings, searchVendors, createVendor } from '../services/api';
import OutsideProcessingSection, { calculateOpTotals } from './OutsideProcessingSection';

const SERVICE_TYPES = [
  { key: 'weld_100', label: '100% Weld', icon: '🔥', color: '#c62828', hasWeldCalc: true },
  { key: 'tack_weld', label: 'Tack Weld', icon: '⚡', color: '#e65100', hasWeldCalc: false },
  { key: 'bevel', label: 'Bevel', icon: '📐', color: '#4527a0', hasWeldCalc: false },
  { key: 'bracing', label: 'Bracing', icon: '🔩', color: '#00695c', hasWeldCalc: false },
  { key: 'fit', label: 'Fit Only', icon: '🔧', color: '#1565c0', hasWeldCalc: false },
  { key: 'cut_to_size', label: 'Cut to Size', icon: '✂️', color: '#2e7d32', hasWeldCalc: false },
  { key: 'finishing', label: 'Finishing', icon: '✨', color: '#6a1b9a', hasWeldCalc: false },
  { key: 'other', label: 'Other Service', icon: '🛠️', color: '#616161', hasWeldCalc: false },
];

const FINISH_TYPES = [
  '#1 Finish (Hot Rolled)',
  '#2B Finish (Cold Rolled)',
  '#3 Finish (Intermediate Polish)',
  '#4 Finish (Brushed/Satin)',
  '#6 Finish (Fine Satin)',
  '#7 Finish (Reflective)',
  '#8 Finish (Mirror)',
  'Bead Blast',
  'Grain Finish',
  'Custom',
];

/**
 * Extract dimensions from a part's fields (formData is already merged by API).
 */
function extractPartInfo(part) {
  const info = {
    thickness: 0,
    thicknessLabel: '',
    grade: '',
    seamOptions: [],
    partLabel: '',
  };

  // Thickness
  const thkStr = part.thickness || '';
  info.thicknessLabel = thkStr;
  info.thickness = parseThickness(thkStr);

  // Grade
  info.grade = part.material || '';

  // Part label
  const matDesc = part._materialDescription || part.materialDescription || '';
  info.partLabel = matDesc || ('Part #' + (part.partNumber || '?'));

  const ptype = part.partType;

  if (ptype === 'plate_roll') {
    const w = parseFloat(part.width) || 0;
    if (w > 0) info.seamOptions.push({ label: 'Longitudinal Seam (' + w + '")', lengthInches: w });
    const rollVal = parseFloat(part._rollValue || part.diameter || part.radius) || 0;
    const measureType = part._rollMeasureType || 'diameter';
    const measurePoint = part._rollMeasurePoint || 'outside';
    let dia = rollVal;
    if (measureType === 'radius') dia = rollVal * 2;
    if (dia > 0) {
      const circ = Math.PI * dia;
      info.seamOptions.push({ label: 'Circumferential Seam (' + measurePoint + ' \u00d8' + dia + '" = ' + circ.toFixed(2) + '")', lengthInches: circ });
    }
  } else if (ptype === 'flat_stock') {
    const shape = part._plateShape || '';
    const stockType = part._stockType || '';
    if (stockType === 'plate' && shape === 'round') {
      const plateDia = parseFloat(part._plateDiameter) || 0;
      if (plateDia > 0) {
        const circ = Math.PI * plateDia;
        info.seamOptions.push({ label: 'Circumference (\u00d8' + plateDia + '" = ' + circ.toFixed(2) + '")', lengthInches: circ });
      }
    } else if (stockType === 'plate' && shape === 'donut') {
      const od = parseFloat(part._plateOD) || 0;
      const id = parseFloat(part._plateID) || 0;
      if (od > 0) info.seamOptions.push({ label: 'OD Circumference (\u00d8' + od + '" = ' + (Math.PI * od).toFixed(2) + '")', lengthInches: Math.PI * od });
      if (id > 0) info.seamOptions.push({ label: 'ID Circumference (\u00d8' + id + '" = ' + (Math.PI * id).toFixed(2) + '")', lengthInches: Math.PI * id });
    } else if (stockType === 'plate') {
      const w = parseFloat(part.width) || 0;
      const l = parseFloat(part.length) || 0;
      if (w > 0 && l > 0) {
        info.seamOptions.push({ label: 'Width seam (' + w + '")', lengthInches: w });
        info.seamOptions.push({ label: 'Length seam (' + l + '")', lengthInches: l });
        info.seamOptions.push({ label: 'Perimeter (' + (2 * (w + l)).toFixed(2) + '")', lengthInches: 2 * (w + l) });
      }
    }
  } else if (ptype === 'pipe_roll' || ptype === 'tube_roll') {
    const od = parseFloat(part.outerDiameter) || 0;
    if (od > 0) {
      const circ = Math.PI * od;
      info.seamOptions.push({ label: 'Circumference (OD ' + od + '" = ' + circ.toFixed(2) + '")', lengthInches: circ });
    }
  } else if (['angle_roll', 'channel_roll', 'beam_roll', 'flat_bar', 'tee_bar'].includes(ptype)) {
    const rollVal = parseFloat(part._rollValue || part.diameter || part.radius) || 0;
    const measureType = part._rollMeasureType || 'diameter';
    let dia = rollVal;
    if (measureType === 'radius') dia = rollVal * 2;
    if (dia > 0) {
      const circ = Math.PI * dia;
      info.seamOptions.push({ label: 'Circumference (\u00d8' + dia + '" = ' + circ.toFixed(2) + '")', lengthInches: circ });
    }
  }

  // Always add manual/custom option
  info.seamOptions.push({ label: 'Custom Length', lengthInches: 0 });

  return info;
}

function parseThickness(t) {
  if (!t) return 0;
  const gaugeMap = {
    '24 ga': 0.0239, '20 ga': 0.0359, '16 ga': 0.0598, '14 ga': 0.0747,
    '12 ga': 0.1046, '11 ga': 0.1196, '10 ga': 0.1345
  };
  if (gaugeMap[t]) return gaugeMap[t];
  const clean = t.replace(/"/g, '').trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    const frac = parts[1].split('/').map(Number);
    return Number(parts[0]) + (frac[0] / frac[1]);
  }
  if (clean.includes('/')) {
    const parts = clean.split('/').map(Number);
    return parts[0] / parts[1];
  }
  return parseFloat(clean) || 0;
}

export default function FabServiceForm({ partData, setPartData, estimateParts = [], showMessage, setError }) {
  const [weldRates, setWeldRates] = useState({});
  const prevSyncRef = useRef('');
  const isEditingPriceRef = useRef(false);

  useEffect(() => {
    const loadRates = async () => {
      try {
        const resp = await getSettings('weld_rates');
        if (resp.data.data?.value) setWeldRates(resp.data.data.value);
      } catch (e) { /* no rates configured yet */ }
    };
    loadRates();
  }, []);

  const serviceType = partData._serviceType || '';
  const serviceConfig = SERVICE_TYPES.find(s => s.key === serviceType);
  
  // Keep linkedPartId as string to match select values
  const linkedPartIdStr = partData._linkedPartId ? String(partData._linkedPartId) : '';

  // Available parts (exclude fab services)
  const availableParts = useMemo(() => {
    return estimateParts.filter(p => p.partType !== 'fab_service' && p.partType !== 'shop_rate');
  }, [estimateParts]);

  // Find linked part using string comparison
  const linkedPart = useMemo(() => {
    if (!linkedPartIdStr) return null;
    return availableParts.find(p => String(p.id) === linkedPartIdStr) || null;
  }, [linkedPartIdStr, availableParts]);

  const partInfo = useMemo(() => {
    if (!linkedPart) return null;
    try {
      return extractPartInfo(linkedPart);
    } catch (e) {
      console.error('extractPartInfo error:', e);
      return null;
    }
  }, [linkedPart]);

  // Selected seam
  const selectedSeamIdx = parseInt(partData._seamOptionIdx) || 0;
  const selectedSeam = partInfo && partInfo.seamOptions ? partInfo.seamOptions[selectedSeamIdx] : null;
  const isCustomSeam = selectedSeam ? selectedSeam.label === 'Custom Length' : false;
  const seamLength = isCustomSeam ? (parseFloat(partData._customSeamLength) || 0) : (selectedSeam ? selectedSeam.lengthInches : 0);

  // Auto weld rate lookup
  const autoRate = useMemo(() => {
    if (!partInfo || !partInfo.grade || !weldRates || Object.keys(weldRates).length === 0) return null;
    const grade = partInfo.grade;
    if (weldRates[grade] !== undefined) return Number(weldRates[grade]);
    const key = Object.keys(weldRates).find(k => k !== 'default' && grade.toLowerCase().includes(k.toLowerCase()));
    if (key) return Number(weldRates[key]);
    if (weldRates['default'] !== undefined) return Number(weldRates['default']);
    return null;
  }, [partInfo, weldRates]);

  const weldPricePerFoot = parseFloat(partData._weldPricePerFoot) || 0;

  // Weld calc
  const weldCalc = useMemo(() => {
    if (!serviceConfig || !serviceConfig.hasWeldCalc || !partInfo) return null;
    const thickness = partInfo.thickness;
    if (thickness <= 0 || seamLength <= 0 || weldPricePerFoot <= 0) return null;
    const passesRaw = thickness / 0.125;
    const passes = Math.ceil(passesRaw);
    const seamFeetRaw = seamLength / 12;
    const seamFeet = Math.ceil(seamFeetRaw);
    const total = passes * seamFeet * weldPricePerFoot;
    return { passesRaw: passesRaw, passes: passes, seamFeetRaw: seamFeetRaw, seamFeet: seamFeet, total: total, thickness: thickness, seamLength: seamLength, pricePerFoot: weldPricePerFoot };
  }, [serviceConfig, partInfo, seamLength, weldPricePerFoot]);

  // Description
  const serviceDescription = useMemo(() => {
    const d = [];
    if (serviceConfig) d.push(serviceConfig.label);
    if (linkedPart) d.push('Part #' + (linkedPart.partNumber || '?'));
    if (serviceType === 'finishing') {
      if (partData._finishType) d.push(partData._finishType === 'Custom' ? (partData._finishTypeCustom || 'Custom Finish') : partData._finishType);
      if (partData._finishSide) {
        const sideLabel = partData._finishSide === 'one' ? 'One Side' : 'Both Sides';
        d.push(sideLabel);
      }
    } else if (serviceType === 'bevel') {
      if (partData._bevelType) d.push(partData._bevelType);
      if (partData._bevelEdge) d.push(partData._bevelEdge);
      if (partData._bevelNotes) d.push(partData._bevelNotes);
    } else if (serviceType === 'bracing') {
      if (partData._bracingSize) d.push(partData._bracingSize + ' Angle Iron');
      if (partData._bracingMaterial) d.push(partData._bracingMaterial);
      if (partData._bracingNotes) d.push(partData._bracingNotes);
    } else {
      if (selectedSeam && !isCustomSeam) d.push(selectedSeam.label);
      if (isCustomSeam && partData._customSeamLength) d.push('Custom Seam: ' + partData._customSeamLength + '"');
      if (partData._bevelNotes) d.push('Bevel: ' + partData._bevelNotes);
    }
    if (partData._serviceNotes) d.push(partData._serviceNotes);
    return d.join(' \u2014 ');
  }, [serviceConfig, serviceType, linkedPart, selectedSeam, isCustomSeam, partData._customSeamLength, partData._bevelNotes, partData._serviceNotes, partData._finishType, partData._finishTypeCustom, partData._finishSide, partData._bevelType, partData._bevelEdge, partData._bracingSize, partData._bracingMaterial, partData._bracingNotes]);

  // Pricing
  const qty = parseInt(partData.quantity) || 1;
  const baseLaborEach = weldCalc ? weldCalc.total : (parseFloat(partData._baseLaborTotal) || parseFloat(partData.laborTotal) || 0);
  const opTotals = calculateOpTotals(partData.outsideProcessing, partData.quantity);
  const opEnabled = (partData.outsideProcessing || []).length > 0;
  // When OP enabled, in-house labor is $0 (vendor does the work). OP markup IS the profit.
  const effectiveBaseLabor = opEnabled ? 0 : baseLaborEach;
  const laborEach = effectiveBaseLabor + opTotals.totalProfit;
  const opCostEach = opTotals.totalCost;

  // Outside vendor cost fields (Commit 1 additions)
  // These are used when the Fab Service is subbed out to a vendor (welding shop, waterjet, etc.)
  const vendorMaterialCostPerPart = parseFloat(partData._fsVendorMaterialCost) || 0; // material portion of vendor bill, per part
  const vendorLaborCostPerPart = parseFloat(partData._fsVendorLaborCost) || 0; // labor portion of vendor bill, per part (if they break it down)
  const vendorMarkupPercent = parseFloat(partData._fsVendorMarkup) || 0; // markup applied to vendor's total (material+labor)
  const outboundTruckingLot = parseFloat(partData._fsOutboundTrucking) || 0; // per-order, not per-part
  const inboundTruckingLot = parseFloat(partData._fsInboundTrucking) || 0; // per-order, not per-part
  const truckingMarkupPercent = parseFloat(partData._fsTruckingMarkup) || 0;
  const hiddenFromCustomer = !!partData._fsHiddenFromCustomer;

  // Vendor total cost (what we pay the OP vendor, per part)
  const vendorTotalCostPerPart = vendorMaterialCostPerPart + vendorLaborCostPerPart;
  // Vendor billed to customer (cost + markup), per part
  const vendorBilledPerPart = vendorTotalCostPerPart * (1 + vendorMarkupPercent / 100);
  // Vendor lot totals
  const vendorTotalCostLot = vendorTotalCostPerPart * qty;
  const vendorBilledLot = vendorBilledPerPart * qty;

  // Trucking (lot-level cost, spread evenly across parts for per-part display)
  const truckingCostLot = outboundTruckingLot + inboundTruckingLot;
  const truckingBilledLot = truckingCostLot * (1 + truckingMarkupPercent / 100);
  const truckingCostPerPart = qty > 0 ? truckingCostLot / qty : 0;
  const truckingBilledPerPart = qty > 0 ? truckingBilledLot / qty : 0;

  // Line total (what gets billed to customer, per lot, not hidden)
  // = base labor + vendor billed + trucking billed, all × qty and + op stuff
  const lineTotal = hiddenFromCustomer
    ? 0 // hidden parts don't contribute to customer total
    : ((laborEach + opCostEach) * qty) + vendorBilledLot + truckingBilledLot;
  // Actual cost for internal reporting (what we paid out)
  const lineCost = (effectiveBaseLabor * qty) + (opCostEach * qty) + vendorTotalCostLot + truckingCostLot;
  // Profit (revenue - cost)
  const lineProfit = lineTotal - lineCost;

  // Vendor search state (Commit 1)
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorResults, setVendorResults] = useState([]);
  const handleVendorSearch = async (query) => {
    setVendorSearch(query);
    if (query.length >= 2) {
      try {
        const res = await searchVendors(query);
        setVendorResults(res.data.data || []);
      } catch { setVendorResults([]); }
    } else {
      setVendorResults([]);
    }
  };

  // Auto-set weld rate on part link
  useEffect(() => {
    if (autoRate !== null && linkedPartIdStr && !partData._weldPriceManualOverride && !partData._weldPricePerFoot) {
      setPartData(prev => ({ ...prev, _weldPricePerFoot: autoRate.toString() }));
    }
  }, [autoRate, linkedPartIdStr]);

  // Sync computed values — use ref to prevent infinite loops
  useEffect(() => {
    if (isEditingPriceRef.current) return;
    const syncKey = lineTotal.toFixed(2) + '|' + serviceDescription + '|' + (serviceConfig ? serviceConfig.label : '') + '|' + (opEnabled ? '1' : '0') + '|' + vendorTotalCostLot.toFixed(2) + '|' + truckingCostLot.toFixed(2) + '|' + (hiddenFromCustomer ? '1' : '0');
    if (syncKey !== prevSyncRef.current) {
      prevSyncRef.current = syncKey;
      const updates = {
        partTotal: lineTotal.toFixed(2),
        // laborTotal is the customer-billed labor: base (or 0 if OP) + OP profit
        laborTotal: laborEach.toFixed(2),
        // _baseLaborTotal is the in-house base labor before OP markup
        _baseLaborTotal: baseLaborEach.toFixed(2),
        // Material cost (vendor-supplied material portion, if any)
        materialTotal: vendorMaterialCostPerPart.toFixed(2),
        materialMarkupPercent: vendorMarkupPercent,
        materialDescription: serviceDescription,
        _materialDescription: serviceDescription,
        _rollingDescription: serviceConfig ? serviceConfig.label : '',
      };
      // Store weld calc inputs so save safety net can recalculate
      if (weldCalc) {
        updates._weldCalcTotal = weldCalc.total.toFixed(2);
        updates._weldCalcThickness = weldCalc.thickness;
        updates._weldCalcSeamLength = weldCalc.seamLength;
      }
      setPartData(prev => ({ ...prev, ...updates }));
    }
  }, [lineTotal, laborEach, baseLaborEach, serviceDescription, serviceConfig, weldCalc, opEnabled, vendorTotalCostLot, truckingCostLot, hiddenFromCustomer, vendorMaterialCostPerPart, vendorMarkupPercent]);

  const update = (fields) => {
    setPartData(prev => ({ ...prev, ...fields }));
  };

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color: color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  return (
    <>
      {/* Quantity */}
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity || '1'}
          onChange={(e) => update({ quantity: e.target.value })} onFocus={(e) => e.target.select()} min="1" />
      </div>

      {/* Service Type */}
      <div className="form-group" style={{ gridColumn: 'span 2' }}>
        <label className="form-label">Service Type *</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {SERVICE_TYPES.map(st => (
            <button key={st.key} type="button"
              onClick={() => update({ _serviceType: st.key })}
              style={{
                padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                border: '2px solid ' + (serviceType === st.key ? st.color : '#ccc'),
                background: serviceType === st.key ? st.color + '15' : '#fff',
                color: serviceType === st.key ? st.color : '#666',
                fontWeight: serviceType === st.key ? 700 : 500, fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}>
              <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>{st.icon}</div>
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Part Selector */}
      {serviceType && (
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Link to Part *</label>
          {availableParts.length === 0 ? (
            <div style={{ padding: 12, background: '#fff3e0', borderRadius: 8, fontSize: '0.9rem', color: '#e65100' }}>
              ⚠️ Add parts to the estimate first, then link a service to them.
            </div>
          ) : (
            <select className="form-select" value={linkedPartIdStr}
              onChange={(e) => update({ _linkedPartId: e.target.value, _seamOptionIdx: '0', _weldPriceManualOverride: false, _weldPricePerFoot: '' })}>
              <option value="">Select a part...</option>
              {availableParts.map(p => {
                const desc = p._materialDescription || p.materialDescription || (p.partType || '').replace(/_/g, ' ');
                return <option key={p.id} value={String(p.id)}>Part #{p.partNumber} — {desc}</option>;
              })}
            </select>
          )}
        </div>
      )}

      {/* Debug — remove after confirming */}
      {serviceType && linkedPartIdStr && !linkedPart && (
        <div style={{ gridColumn: 'span 2', padding: 12, background: '#ffebee', borderRadius: 8, fontSize: '0.8rem', color: '#c62828' }}>
          ⚠️ Part ID "{linkedPartIdStr}" not found in {availableParts.length} available parts.
          IDs available: [{availableParts.map(p => String(p.id)).join(', ')}]
        </div>
      )}

      {/* Linked Part Info Card */}
      {linkedPart && partInfo && (
        <div style={{ ...sectionStyle }}>
          <div style={{ background: '#e8eaf6', padding: 14, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: '#283593', fontSize: '0.95rem', marginBottom: 8 }}>
              📋 Part #{linkedPart.partNumber} Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: '0.85rem' }}>
              <div><span style={{ color: '#666' }}>Thickness:</span> <strong>{partInfo.thicknessLabel || '—'}</strong>{partInfo.thickness > 0 ? ' (' + partInfo.thickness.toFixed(4) + '")' : ''}</div>
              <div><span style={{ color: '#666' }}>Grade:</span> <strong>{partInfo.grade || '—'}</strong></div>
              <div><span style={{ color: '#666' }}>Type:</span> <strong>{(linkedPart.partType || '').replace(/_/g, ' ')}</strong></div>
            </div>
            {partInfo.seamOptions.length > 1 && (
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#666' }}>
                {partInfo.seamOptions.filter(s => s.label !== 'Custom Length').map((s, i) => (
                  <span key={i} style={{ marginRight: 12 }}>📏 {s.label}: <strong>{s.lengthInches.toFixed(2)}"</strong></span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seam Selection (for weld services) */}
      {linkedPart && partInfo && (serviceType === 'weld_100' || serviceType === 'tack_weld') && (
        <div style={{ ...sectionStyle }}>
          {sTitle('📏', 'Seam / Weld Length', '#283593')}
          <div className="form-group">
            <label className="form-label">Seam Type</label>
            <select className="form-select" value={selectedSeamIdx}
              onChange={(e) => update({ _seamOptionIdx: e.target.value })}>
              {partInfo.seamOptions.map((opt, idx) => (
                <option key={idx} value={idx}>{opt.label}{opt.lengthInches > 0 ? ' — ' + opt.lengthInches.toFixed(2) + '"' : ''}</option>
              ))}
            </select>
          </div>
          {isCustomSeam && (
            <div className="form-group">
              <label className="form-label">Custom Seam Length (inches)</label>
              <input type="number" step="0.01" className="form-input" value={partData._customSeamLength || ''}
                onChange={(e) => update({ _customSeamLength: e.target.value })} placeholder="Enter length in inches" />
            </div>
          )}
          {seamLength > 0 && (
            <div style={{ background: '#e8f5e9', padding: 10, borderRadius: 8, fontSize: '0.85rem', marginTop: 8 }}>
              <strong style={{ color: '#2e7d32' }}>Seam Length: {seamLength.toFixed(2)}"</strong>
              <span style={{ color: '#666', marginLeft: 12 }}>({(seamLength / 12).toFixed(4)} ft)</span>
            </div>
          )}
        </div>
      )}

      {/* Finishing Options */}
      {linkedPart && serviceType === 'finishing' && (
        <div style={{ ...sectionStyle }}>
          {sTitle('✨', 'Finish Details', '#6a1b9a')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Finish Type *</label>
              <select className="form-select" value={partData._finishType || ''}
                onChange={(e) => update({ _finishType: e.target.value })}>
                <option value="">Select finish...</option>
                {FINISH_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
              </select>
              {partData._finishType === 'Custom' && (
                <input className="form-input" style={{ marginTop: 6 }}
                  value={partData._finishTypeCustom || ''}
                  onChange={(e) => update({ _finishTypeCustom: e.target.value })}
                  placeholder="Describe custom finish..." />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Apply To *</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {[
                  { key: 'one', label: 'One Side', icon: '▬' },
                  { key: 'both', label: 'Both Sides', icon: '▣' },
                ].map(opt => (
                  <button key={opt.key} type="button"
                    onClick={() => update({ _finishSide: opt.key })}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                      border: '2px solid ' + (partData._finishSide === opt.key ? '#6a1b9a' : '#ccc'),
                      background: partData._finishSide === opt.key ? '#f3e5f5' : '#fff',
                      color: partData._finishSide === opt.key ? '#6a1b9a' : '#666',
                      fontWeight: partData._finishSide === opt.key ? 700 : 500,
                      fontSize: '0.85rem'
                    }}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {partData._finishType && partData._finishSide && (
            <div style={{ background: '#f3e5f5', padding: 10, borderRadius: 8, fontSize: '0.85rem', marginTop: 8, border: '1px solid #ce93d8' }}>
              <strong style={{ color: '#6a1b9a' }}>
                ✨ {partData._finishType === 'Custom' ? (partData._finishTypeCustom || 'Custom Finish') : partData._finishType} — {partData._finishSide === 'one' ? 'One Side' : 'Both Sides'}
              </strong>
              <span style={{ color: '#888', marginLeft: 8 }}>(Part #{linkedPart.partNumber})</span>
            </div>
          )}
        </div>
      )}

      {/* Bevel Options */}
      {linkedPart && serviceType === 'bevel' && (
        <div style={{ ...sectionStyle }}>
          {sTitle('📐', 'Bevel Details', '#4527a0')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Bevel Type</label>
              <select className="form-select" value={partData._bevelType || ''}
                onChange={(e) => update({ _bevelType: e.target.value })}>
                <option value="">Select type...</option>
                <option value="Single Bevel">Single Bevel</option>
                <option value="Double Bevel">Double Bevel</option>
                <option value="V-Groove">V-Groove</option>
                <option value="J-Groove">J-Groove</option>
                <option value="U-Groove">U-Groove</option>
                <option value="Bevel per print">Bevel per print</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Edge Location</label>
              <select className="form-select" value={partData._bevelEdge || ''}
                onChange={(e) => update({ _bevelEdge: e.target.value })}>
                <option value="">Select edge...</option>
                <option value="ID">ID (Inside Diameter)</option>
                <option value="OD">OD (Outside Diameter)</option>
                <option value="Both Edges">Both Edges</option>
                <option value="Top Edge">Top Edge</option>
                <option value="Bottom Edge">Bottom Edge</option>
                <option value="All Edges">All Edges</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">Bevel Notes</label>
            <input type="text" className="form-input" value={partData._bevelNotes || ''}
              onChange={(e) => update({ _bevelNotes: e.target.value })} placeholder="e.g. 37.5° bevel, land 1/16, etc." />
          </div>
        </div>
      )}

      {/* Bracing Options */}
      {linkedPart && serviceType === 'bracing' && (
        <div style={{ ...sectionStyle }}>
          {sTitle('🔩', 'Bracing Details', '#00695c')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Angle Iron Size</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {['2x2', '3x3'].map(sz => (
                  <button key={sz} type="button"
                    onClick={() => update({ _bracingSize: sz })}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                      border: '2px solid ' + (partData._bracingSize === sz ? '#00695c' : '#ccc'),
                      background: partData._bracingSize === sz ? '#e0f2f1' : '#fff',
                      color: partData._bracingSize === sz ? '#00695c' : '#666',
                      fontWeight: partData._bracingSize === sz ? 700 : 500,
                      fontSize: '0.9rem'
                    }}>
                    {sz}" Angle
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Bracing Material</label>
              <select className="form-select" value={partData._bracingMaterial || ''}
                onChange={(e) => update({ _bracingMaterial: e.target.value })}>
                <option value="">Select material...</option>
                <option value="A36 CS">A36 Carbon Steel</option>
                <option value="304 SS">304 Stainless Steel</option>
                <option value="316 SS">316 Stainless Steel</option>
                <option value="Customer Supplied">Customer Supplied</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">Bracing Notes</label>
            <input type="text" className="form-input" value={partData._bracingNotes || ''}
              onChange={(e) => update({ _bracingNotes: e.target.value })} placeholder="e.g. 4 braces equally spaced, tack welded, etc." />
          </div>
          {partData._bracingSize && (
            <div style={{ background: '#e0f2f1', padding: 10, borderRadius: 8, fontSize: '0.85rem', marginTop: 8, border: '1px solid #80cbc4' }}>
              <strong style={{ color: '#00695c' }}>
                🔩 {partData._bracingSize}" Angle Iron Bracing
                {partData._bracingMaterial ? ` — ${partData._bracingMaterial}` : ''}
              </strong>
              {partData._bracingMaterial && partData._bracingMaterial !== 'Customer Supplied' && (
                <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 4 }}>Material required — include cost in service price</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Weld Pricing (100% Weld) */}
      {serviceType === 'weld_100' && linkedPart && partInfo && (
        <div style={{ ...sectionStyle }}>
          {sTitle('💰', 'Weld Pricing', '#c62828')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Weld Price Per Foot</label>
              <div style={{ position: 'relative' }}>
                <input type="number" step="any" className="form-input" value={partData._weldPricePerFoot || ''}
                  onChange={(e) => update({ _weldPricePerFoot: e.target.value, _weldPriceManualOverride: true })}
                  onFocus={(e) => { isEditingPriceRef.current = true; }}
                  onBlur={() => { isEditingPriceRef.current = false; }}
                  placeholder="0.00" style={{ paddingLeft: 20 }} />
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#666', fontWeight: 600 }}>$</span>
              </div>
              {autoRate !== null && (
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>
                  Default for {partInfo.grade}: ${autoRate.toFixed(2)}/ft
                  {partData._weldPriceManualOverride && (
                    <button type="button" onClick={() => update({ _weldPricePerFoot: autoRate.toString(), _weldPriceManualOverride: false })}
                      style={{ marginLeft: 8, fontSize: '0.7rem', color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Reset to default
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Bevel / Weld Notes</label>
              <input type="text" className="form-input" value={partData._bevelNotes || ''}
                onChange={(e) => update({ _bevelNotes: e.target.value })} placeholder="e.g. 37.5° bevel, V-groove, etc." />
            </div>
          </div>

          {weldCalc && (
            <div style={{ background: '#fce4ec', padding: 14, borderRadius: 8, marginTop: 12, border: '1px solid #ef9a9a' }}>
              <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 10, fontSize: '0.9rem' }}>🔥 Weld Cost Calculation</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#333', lineHeight: 1.8 }}>
                <div>
                  <span style={{ color: '#888' }}>Passes:</span>{' '}
                  {weldCalc.thickness.toFixed(4)}" ÷ 0.125" = {weldCalc.passesRaw % 1 !== 0 ? <>{weldCalc.passesRaw.toFixed(2)} → <strong>↑ {weldCalc.passes} passes</strong></> : <strong>{weldCalc.passes} passes</strong>}
                </div>
                <div>
                  <span style={{ color: '#888' }}>Seam (ft):</span>{' '}
                  {weldCalc.seamLength.toFixed(2)}" ÷ 12 = {weldCalc.seamFeetRaw.toFixed(2)} ft → <strong>↑ {weldCalc.seamFeet} ft</strong>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Rate:</span>{' '}
                  <strong>${weldCalc.pricePerFoot.toFixed(2)}/ft</strong>
                </div>
                <div style={{ borderTop: '1px solid #ef9a9a', marginTop: 8, paddingTop: 8, fontSize: '1rem' }}>
                  <span style={{ color: '#888' }}>Formula:</span>{' '}
                  {weldCalc.passes} × {weldCalc.seamFeet} × ${weldCalc.pricePerFoot.toFixed(2)} ={' '}
                  <strong style={{ color: '#c62828', fontSize: '1.15rem' }}>${weldCalc.total.toFixed(2)}</strong>
                  <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: 8 }}>(per piece)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Pricing (Tack Weld, Fit, Cut, Other) */}
      {serviceType && serviceConfig && !serviceConfig.hasWeldCalc && linkedPart && (
        <div style={{ ...sectionStyle }}>
          {sTitle('💰', 'Pricing', serviceConfig.color || '#1976d2')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label" style={{ color: opEnabled ? '#999' : undefined }}>Labor Cost (per piece){opEnabled && <span style={{ marginLeft: 4, fontSize: '0.7rem', color: '#E65100' }}>(disabled — outsourced)</span>}</label>
              <div style={{ position: 'relative' }}>
                <input type="number" step="any" className="form-input"
                  value={partData._baseLaborTotal !== undefined && partData._baseLaborTotal !== null && partData._baseLaborTotal !== '' ? partData._baseLaborTotal : (partData.laborTotal || '')}
                  onChange={(e) => update({ _baseLaborTotal: e.target.value, laborTotal: e.target.value })}
                  onFocus={(e) => { isEditingPriceRef.current = true; e.target.select(); }}
                  onBlur={() => { isEditingPriceRef.current = false; }}
                  placeholder="0.00" style={{ paddingLeft: 20, background: opEnabled ? '#f5f5f5' : undefined, color: opEnabled ? '#999' : undefined }}
                  disabled={opEnabled} />
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#666', fontWeight: 600 }}>$</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Special Notes */}
      {serviceType && (
        <div style={{ ...sectionStyle }}>
          <div className="form-group">
            <label className="form-label">Service Notes / Special Instructions</label>
            <textarea className="form-textarea" value={partData._serviceNotes || ''}
              onChange={(e) => update({ _serviceNotes: e.target.value, specialInstructions: e.target.value })}
              rows={3} placeholder="Bevel details, weld symbols, fit-up requirements, etc." />
          </div>
        </div>
      )}

      {/* Outside Processing */}
      {serviceType && linkedPart && (
        <OutsideProcessingSection partData={partData} setPartData={setPartData} />
      )}

      {/* Outside Vendor (Commit 1 — new) */}
      {serviceType && linkedPart && (
        <div style={{ ...sectionStyle }}>
          <div style={{ padding: 12, background: hiddenFromCustomer ? '#FFEBEE' : '#FFF3E0', borderRadius: 8, border: '2px solid ' + (hiddenFromCustomer ? '#EF5350' : '#FFB74D') }}>
            <h4 style={{ marginBottom: 10, color: hiddenFromCustomer ? '#c62828' : '#E65100', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>🏭 Outside Vendor (optional)</span>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: hiddenFromCustomer ? '#c62828' : '#666' }}>
                <input type="checkbox" checked={hiddenFromCustomer}
                  onChange={(e) => update({ _fsHiddenFromCustomer: e.target.checked })} />
                <strong>Hide from customer (internal cost only)</strong>
              </label>
            </h4>
            {hiddenFromCustomer && (
              <div style={{ fontSize: '0.75rem', color: '#c62828', marginBottom: 10, padding: 6, background: 'white', borderRadius: 4, border: '1px dashed #EF5350' }}>
                ⚠ This part will be excluded from the customer-facing estimate and PDF. It will show as an internal cost on the summary tab only.
                Use for rolling assist or other subbed work you don't want the customer to see.
              </div>
            )}
            <p style={{ fontSize: '0.75rem', color: '#666', margin: '0 0 10px' }}>
              Fill this in if this service is being subcontracted. Leave blank if you're doing the work in-house.
            </p>

            {/* Vendor search */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label" style={{ fontSize: '0.85rem' }}>Vendor</label>
              {partData.supplierName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#E8F5E9', borderRadius: 4, border: '1px solid #A5D6A7' }}>
                  <strong>{partData.supplierName}</strong>
                  <button type="button" onClick={() => update({ vendorId: null, supplierName: '' })}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', fontSize: '0.8rem' }}>Clear</button>
                </div>
              ) : (
                <>
                  <input type="text" className="form-input" placeholder="Search vendor..."
                    value={vendorSearch}
                    onChange={(e) => handleVendorSearch(e.target.value)}
                    style={{ fontSize: '0.85rem' }} />
                  {vendorResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflow: 'auto', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                      {vendorResults.map(v => (
                        <div key={v.id}
                          onClick={() => {
                            update({ vendorId: v.id, supplierName: v.name });
                            setVendorSearch('');
                            setVendorResults([]);
                          }}
                          style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                          <strong>{v.name}</strong>
                          {v.contactName && <span style={{ color: '#666', marginLeft: 6, fontSize: '0.75rem' }}>{v.contactName}</span>}
                        </div>
                      ))}
                      {vendorSearch.length >= 2 && (
                        <div onClick={async () => {
                          try {
                            const res = await createVendor({ name: vendorSearch });
                            if (res.data.data) {
                              update({ vendorId: res.data.data.id, supplierName: res.data.data.name });
                              setVendorSearch('');
                              setVendorResults([]);
                            }
                          } catch {}
                        }} style={{ padding: 8, cursor: 'pointer', background: '#E8F5E9', color: '#2e7d32', fontWeight: 600, fontSize: '0.85rem' }}>
                          + Add "{vendorSearch}" as new vendor
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Vendor cost inputs */}
            {partData.supplierName && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Vendor Material Cost (per part)</label>
                    <input type="number" step="any" className="form-input"
                      value={partData._fsVendorMaterialCost || ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => update({ _fsVendorMaterialCost: e.target.value })}
                      placeholder="0.00" style={{ fontSize: '0.85rem' }} />
                    <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 2 }}>If the vendor supplies material</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Vendor Labor Cost (per part)</label>
                    <input type="number" step="any" className="form-input"
                      value={partData._fsVendorLaborCost || ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => update({ _fsVendorLaborCost: e.target.value })}
                      placeholder="0.00" style={{ fontSize: '0.85rem' }} />
                    <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 2 }}>Vendor's labor charge</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Markup %</label>
                    <input type="number" step="1" className="form-input"
                      value={partData._fsVendorMarkup ?? 20}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => update({ _fsVendorMarkup: e.target.value })}
                      placeholder="20" style={{ fontSize: '0.85rem' }} />
                  </div>
                </div>

                {/* Trucking */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #FFB74D' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#E65100', marginBottom: 6 }}>🚛 Trucking (optional)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Outbound (to vendor)</label>
                      <input type="number" step="any" className="form-input"
                        value={partData._fsOutboundTrucking || ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => update({ _fsOutboundTrucking: e.target.value })}
                        placeholder="0.00" style={{ fontSize: '0.85rem' }} />
                      <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 2 }}>Lot cost</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Inbound (return)</label>
                      <input type="number" step="any" className="form-input"
                        value={partData._fsInboundTrucking || ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => update({ _fsInboundTrucking: e.target.value })}
                        placeholder="0.00" style={{ fontSize: '0.85rem' }} />
                      <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 2 }}>Lot cost</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Trucking Markup %</label>
                      <input type="number" step="1" className="form-input"
                        value={partData._fsTruckingMarkup ?? 30}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => update({ _fsTruckingMarkup: e.target.value })}
                        placeholder="30" style={{ fontSize: '0.85rem' }} />
                    </div>
                  </div>
                </div>

                {/* Vendor summary */}
                <div style={{ marginTop: 10, padding: 8, background: 'white', borderRadius: 4, fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Vendor cost (per part):</span>
                    <strong>${vendorTotalCostPerPart.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Vendor cost (lot):</span>
                    <strong>${vendorTotalCostLot.toFixed(2)}</strong>
                  </div>
                  {truckingCostLot > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Trucking cost (lot):</span>
                      <strong>${truckingCostLot.toFixed(2)}</strong>
                    </div>
                  )}
                  {!hiddenFromCustomer && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32' }}>
                        <span>+ Markup profit:</span>
                        <strong>+${(lineTotal - (effectiveBaseLabor * qty) - (opCostEach * qty) - vendorTotalCostLot - truckingCostLot).toFixed(2)}</strong>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pricing Summary */}
      {serviceType && linkedPart && (
        <div style={{ ...sectionStyle }}>
          <div style={{ background: hiddenFromCustomer ? '#FFEBEE' : '#f0f7ff', padding: 14, borderRadius: 8, border: '1px solid ' + (hiddenFromCustomer ? '#EF5350' : '#bbdefb') }}>
            {hiddenFromCustomer && (
              <div style={{ fontSize: '0.75rem', color: '#c62828', fontWeight: 700, marginBottom: 8 }}>
                🔒 INTERNAL COST — NOT BILLED TO CUSTOMER
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: opEnabled ? '#999' : '#555' }}>
              <span>{serviceConfig ? serviceConfig.label : 'Service'} (per piece){opEnabled && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(outsourced)</span>}</span>
              <span style={opEnabled ? { textDecoration: 'line-through' } : {}}>${baseLaborEach.toFixed(2)}</span>
            </div>
            {opCostEach > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#E65100' }}>
                  <span>🏭 Outside Processing (vendor cost)</span>
                  <span>${opCostEach.toFixed(2)}</span>
                </div>
                {opTotals.totalProfit > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#2e7d32' }}>
                    <span>+ OP Markup (rolled into labor)</span>
                    <span>${opTotals.totalProfit.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            {vendorTotalCostLot > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#E65100' }}>
                <span>🏭 {partData.supplierName} (vendor lot cost)</span>
                <span>${vendorTotalCostLot.toFixed(2)}</span>
              </div>
            )}
            {truckingCostLot > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#616161' }}>
                <span>🚛 Trucking (lot cost)</span>
                <span>${truckingCostLot.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid ' + (hiddenFromCustomer ? '#EF9A9A' : '#90caf9'), marginTop: 4 }}>
              <strong>{hiddenFromCustomer ? 'Internal Cost' : 'Line Total'}</strong>
              <strong style={{ fontSize: '1.15rem', color: hiddenFromCustomer ? '#c62828' : '#2e7d32' }}>
                ${(hiddenFromCustomer ? lineCost : lineTotal).toFixed(2)}
              </strong>
            </div>
            {!hiddenFromCustomer && lineCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.75rem', color: '#888' }}>
                <span>Our cost / profit:</span>
                <span>${lineCost.toFixed(2)} / <strong style={{ color: lineProfit >= 0 ? '#2e7d32' : '#c62828' }}>${lineProfit.toFixed(2)}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tracking */}
      {serviceType && (
        <div style={{ ...sectionStyle }}>
          {sTitle('🏷️', 'Tracking', '#616161')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Client Part Number</label>
              <input type="text" className="form-input" value={partData.clientPartNumber || ''}
                onChange={(e) => update({ clientPartNumber: e.target.value })} placeholder="Optional" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
