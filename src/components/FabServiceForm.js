import React, { useState, useEffect, useMemo } from 'react';
import { getSettings } from '../services/api';

const SERVICE_TYPES = [
  { key: 'weld_100', label: '100% Weld', icon: '🔥', color: '#c62828', hasWeldCalc: true },
  { key: 'tack_weld', label: 'Tack Weld', icon: '⚡', color: '#e65100', hasWeldCalc: false },
  { key: 'fit', label: 'Fit Only', icon: '🔧', color: '#1565c0', hasWeldCalc: false },
  { key: 'cut_to_fit', label: 'Cut to Fit', icon: '✂️', color: '#2e7d32', hasWeldCalc: false },
  { key: 'other', label: 'Other Service', icon: '🛠️', color: '#616161', hasWeldCalc: false },
];

/**
 * Extract dimensions from a part's formData or direct fields.
 * Returns { thickness, seamOptions: [{ label, lengthInches }], grade }
 */
function extractPartInfo(part) {
  const fd = part.formData || {};
  const info = {
    thickness: 0,
    thicknessLabel: '',
    grade: '',
    seamOptions: [],
    partLabel: '',
  };

  // Thickness
  const thkStr = fd.thickness || part.thickness || '';
  info.thicknessLabel = thkStr;
  info.thickness = parseThickness(thkStr);

  // Grade
  info.grade = fd.material || part.material || '';

  // Part label
  const matDesc = fd._materialDescription || fd.materialDescription || part.materialDescription || '';
  info.partLabel = matDesc || `Part #${part.partNumber || '?'}`;

  const ptype = part.partType;

  if (ptype === 'plate_roll') {
    // Cylinder: longitudinal seam = width (height of cylinder)
    const w = parseFloat(fd.width || part.width) || 0;
    if (w > 0) info.seamOptions.push({ label: `Longitudinal Seam (${w}")`, lengthInches: w });
    // Circumferential seam (for welding caps to cylinder) = π × diameter
    const rollVal = parseFloat(fd._rollValue || part.diameter || part.radius) || 0;
    const measureType = fd._rollMeasureType || 'diameter';
    const measurePoint = fd._rollMeasurePoint || 'outside';
    let dia = rollVal;
    if (measureType === 'radius') dia = rollVal * 2;
    if (dia > 0) {
      const circ = Math.PI * dia;
      info.seamOptions.push({ label: `Circumferential Seam (${measurePoint} Ø${dia}" = ${circ.toFixed(2)}")`, lengthInches: circ });
    }
  } else if (ptype === 'flat_stock') {
    const shape = fd._plateShape || '';
    const stockType = fd._stockType || '';
    if (stockType === 'plate' && shape === 'round') {
      const plateDia = parseFloat(fd._plateDiameter) || 0;
      if (plateDia > 0) {
        const circ = Math.PI * plateDia;
        info.seamOptions.push({ label: `Circumference (Ø${plateDia}" = ${circ.toFixed(2)}")`, lengthInches: circ });
      }
    } else if (stockType === 'plate' && shape === 'donut') {
      const od = parseFloat(fd._plateOD) || 0;
      const id = parseFloat(fd._plateID) || 0;
      if (od > 0) info.seamOptions.push({ label: `OD Circumference (Ø${od}" = ${(Math.PI * od).toFixed(2)}")`, lengthInches: Math.PI * od });
      if (id > 0) info.seamOptions.push({ label: `ID Circumference (Ø${id}" = ${(Math.PI * id).toFixed(2)}")`, lengthInches: Math.PI * id });
    } else if (stockType === 'plate' && shape === 'rectangular') {
      const w = parseFloat(fd.width || part.width) || 0;
      const l = parseFloat(fd.length || part.length) || 0;
      if (w > 0 && l > 0) {
        info.seamOptions.push({ label: `Width seam (${w}")`, lengthInches: w });
        info.seamOptions.push({ label: `Length seam (${l}")`, lengthInches: l });
        info.seamOptions.push({ label: `Perimeter (${(2 * (w + l)).toFixed(2)}")`, lengthInches: 2 * (w + l) });
      }
    }
  } else if (ptype === 'pipe_roll' || ptype === 'tube_roll') {
    const od = parseFloat(fd.outerDiameter || part.outerDiameter) || 0;
    if (od > 0) {
      const circ = Math.PI * od;
      info.seamOptions.push({ label: `Circumference (OD ${od}" = ${circ.toFixed(2)}")`, lengthInches: circ });
    }
  } else if (ptype === 'angle_roll' || ptype === 'channel_roll' || ptype === 'beam_roll' || ptype === 'flat_bar' || ptype === 'tee_bar') {
    // For structural rolls, circumference from roll diameter
    const rollVal = parseFloat(fd._rollValue || part.diameter || part.radius) || 0;
    const measureType = fd._rollMeasureType || 'diameter';
    let dia = rollVal;
    if (measureType === 'radius') dia = rollVal * 2;
    if (dia > 0) {
      const circ = Math.PI * dia;
      info.seamOptions.push({ label: `Circumference (Ø${dia}" = ${circ.toFixed(2)}")`, lengthInches: circ });
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
    const [whole, frac] = clean.split('-');
    const [n, d] = frac.split('/').map(Number);
    return Number(whole) + (n / d);
  }
  if (clean.includes('/')) {
    const [n, d] = clean.split('/').map(Number);
    return n / d;
  }
  return parseFloat(clean) || 0;
}

export default function FabServiceForm({ partData, setPartData, estimateParts = [], showMessage, setError }) {
  const [weldRates, setWeldRates] = useState({});

  useEffect(() => {
    const loadRates = async () => {
      try {
        const resp = await getSettings('weld_rates');
        if (resp.data.data?.value) setWeldRates(resp.data.data.value);
      } catch {}
    };
    loadRates();
  }, []);

  const serviceType = partData._serviceType || '';
  const serviceConfig = SERVICE_TYPES.find(s => s.key === serviceType);
  const linkedPartId = partData._linkedPartId ? parseInt(partData._linkedPartId) : null;

  // Available parts (exclude self and other fab services)
  const availableParts = estimateParts.filter(p => p.partType !== 'fab_service' && p.id !== partData.id);

  // Linked part info
  const linkedPart = linkedPartId ? availableParts.find(p => p.id === linkedPartId) : null;
  const partInfo = linkedPart ? extractPartInfo(linkedPart) : null;

  // Selected seam
  const selectedSeamIdx = parseInt(partData._seamOptionIdx) || 0;
  const selectedSeam = partInfo?.seamOptions[selectedSeamIdx] || null;
  const isCustomSeam = selectedSeam?.label === 'Custom Length';
  const seamLength = isCustomSeam ? (parseFloat(partData._customSeamLength) || 0) : (selectedSeam?.lengthInches || 0);

  // Auto-load weld rate when grade changes
  const autoRate = useMemo(() => {
    if (!partInfo?.grade || !weldRates) return null;
    // Try exact match, then partial
    const grade = partInfo.grade;
    if (weldRates[grade] !== undefined) return weldRates[grade];
    const key = Object.keys(weldRates).find(k => grade.toLowerCase().includes(k.toLowerCase()));
    return key ? weldRates[key] : weldRates['default'] || null;
  }, [partInfo?.grade, weldRates]);

  // Weld price per foot (user can override)
  const weldPricePerFoot = parseFloat(partData._weldPricePerFoot) || 0;

  // Auto-set price when linked part changes
  useEffect(() => {
    if (autoRate !== null && !partData._weldPriceManualOverride) {
      setPartData(prev => ({ ...prev, _weldPricePerFoot: autoRate.toString() }));
    }
  }, [autoRate]);

  // Weld calculation: (thickness / 0.125) × (seamLength / 2) × pricePerFoot
  const weldCalc = useMemo(() => {
    if (!serviceConfig?.hasWeldCalc || !partInfo) return null;
    const thickness = partInfo.thickness;
    if (thickness <= 0 || seamLength <= 0 || weldPricePerFoot <= 0) return null;
    const passes = thickness / 0.125;
    const halfSeam = seamLength / 2;
    const total = passes * halfSeam * weldPricePerFoot;
    return { passes, halfSeam, total, thickness, seamLength, pricePerFoot: weldPricePerFoot };
  }, [serviceConfig, partInfo, seamLength, weldPricePerFoot]);

  // Service description
  const serviceDescription = useMemo(() => {
    const parts = [];
    if (serviceConfig) parts.push(serviceConfig.label);
    if (linkedPart) parts.push(`Part #${linkedPart.partNumber || '?'}`);
    if (selectedSeam && !isCustomSeam) parts.push(selectedSeam.label);
    if (isCustomSeam && partData._customSeamLength) parts.push(`Custom Seam: ${partData._customSeamLength}"`);
    if (partData._serviceNotes) parts.push(partData._serviceNotes);
    return parts.join(' — ');
  }, [serviceConfig, linkedPart, selectedSeam, isCustomSeam, partData._customSeamLength, partData._serviceNotes]);

  // Pricing - for weld use calc, for others use manual labor
  const qty = parseInt(partData.quantity) || 1;
  const laborEach = weldCalc ? weldCalc.total : (parseFloat(partData.laborTotal) || 0);
  const lineTotal = laborEach * qty;

  // Sync to partData
  useEffect(() => {
    setPartData(prev => ({
      ...prev,
      partTotal: lineTotal.toFixed(2),
      laborTotal: laborEach.toFixed(2),
      materialDescription: serviceDescription,
      _materialDescription: serviceDescription,
      _rollingDescription: serviceConfig ? serviceConfig.label : '',
    }));
  }, [lineTotal, serviceDescription, serviceConfig]);

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sectionTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  return (
    <>
      {/* Quantity */}
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity}
          onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} min="1" />
      </div>

      {/* Service Type */}
      <div className="form-group" style={{ gridColumn: 'span 2' }}>
        <label className="form-label">Service Type *</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {SERVICE_TYPES.map(st => (
            <button key={st.key} type="button"
              onClick={() => setPartData({ ...partData, _serviceType: st.key })}
              style={{
                padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${serviceType === st.key ? st.color : '#ccc'}`,
                background: serviceType === st.key ? `${st.color}15` : '#fff',
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
            <select className="form-select" value={linkedPartId || ''}
              onChange={(e) => setPartData({ ...partData, _linkedPartId: e.target.value, _seamOptionIdx: '0', _weldPriceManualOverride: false })}>
              <option value="">Select a part...</option>
              {availableParts.map(p => {
                const fd = p.formData || {};
                const desc = fd._materialDescription || fd.materialDescription || p.materialDescription || p.partType;
                return <option key={p.id} value={p.id}>Part #{p.partNumber} — {desc}</option>;
              })}
            </select>
          )}
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
              <div><span style={{ color: '#666' }}>Thickness:</span> <strong>{partInfo.thicknessLabel || '—'}</strong> ({partInfo.thickness.toFixed(4)}")</div>
              <div><span style={{ color: '#666' }}>Grade:</span> <strong>{partInfo.grade || '—'}</strong></div>
              <div><span style={{ color: '#666' }}>Type:</span> <strong>{linkedPart.partType.replace(/_/g, ' ')}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Seam Selection (for weld services) */}
      {linkedPart && partInfo && (serviceType === 'weld_100' || serviceType === 'tack_weld') && (
        <div style={{ ...sectionStyle }}>
          {sectionTitle('📏', 'Seam / Weld Length', '#283593')}
          <div className="form-group">
            <label className="form-label">Seam Type</label>
            <select className="form-select" value={selectedSeamIdx}
              onChange={(e) => setPartData({ ...partData, _seamOptionIdx: e.target.value })}>
              {partInfo.seamOptions.map((opt, idx) => (
                <option key={idx} value={idx}>{opt.label}{opt.lengthInches > 0 ? ` — ${opt.lengthInches.toFixed(2)}"` : ''}</option>
              ))}
            </select>
          </div>
          {isCustomSeam && (
            <div className="form-group">
              <label className="form-label">Custom Seam Length (inches)</label>
              <input type="number" step="0.01" className="form-input" value={partData._customSeamLength || ''}
                onChange={(e) => setPartData({ ...partData, _customSeamLength: e.target.value })} placeholder="Enter length in inches" />
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

      {/* Weld Pricing (100% Weld) */}
      {serviceType === 'weld_100' && linkedPart && partInfo && (
        <div style={{ ...sectionStyle }}>
          {sectionTitle('💰', 'Weld Pricing', '#c62828')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Weld Price Per Foot</label>
              <div style={{ position: 'relative' }}>
                <input type="number" step="0.01" className="form-input" value={partData._weldPricePerFoot || ''}
                  onChange={(e) => setPartData({ ...partData, _weldPricePerFoot: e.target.value, _weldPriceManualOverride: true })}
                  placeholder="0.00" style={{ paddingLeft: 20 }} />
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#666', fontWeight: 600 }}>$</span>
              </div>
              {autoRate !== null && (
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>
                  Default for {partInfo.grade}: ${autoRate.toFixed(2)}/ft
                  {partData._weldPriceManualOverride && (
                    <button type="button" onClick={() => setPartData({ ...partData, _weldPricePerFoot: autoRate.toString(), _weldPriceManualOverride: false })}
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
                onChange={(e) => setPartData({ ...partData, _bevelNotes: e.target.value })} placeholder="e.g. 37.5° bevel, V-groove, etc." />
            </div>
          </div>

          {/* Formula breakdown */}
          {weldCalc && (
            <div style={{ background: '#fce4ec', padding: 14, borderRadius: 8, marginTop: 12, border: '1px solid #ef9a9a' }}>
              <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 10, fontSize: '0.9rem' }}>🔥 Weld Cost Calculation</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#333', lineHeight: 1.8 }}>
                <div>
                  <span style={{ color: '#888' }}>Passes:</span>{' '}
                  {weldCalc.thickness.toFixed(4)}" ÷ 0.125" = <strong>{weldCalc.passes.toFixed(2)} passes</strong>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Half Seam:</span>{' '}
                  {weldCalc.seamLength.toFixed(2)}" ÷ 2 = <strong>{weldCalc.halfSeam.toFixed(2)}"</strong>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Rate:</span>{' '}
                  <strong>${weldCalc.pricePerFoot.toFixed(2)}/ft</strong>
                </div>
                <div style={{ borderTop: '1px solid #ef9a9a', marginTop: 8, paddingTop: 8, fontSize: '1rem' }}>
                  <span style={{ color: '#888' }}>Formula:</span>{' '}
                  {weldCalc.passes.toFixed(2)} × {weldCalc.halfSeam.toFixed(2)} × ${weldCalc.pricePerFoot.toFixed(2)} ={' '}
                  <strong style={{ color: '#c62828', fontSize: '1.15rem' }}>${weldCalc.total.toFixed(2)}</strong>
                  <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: 8 }}>(per piece)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Pricing (Tack Weld, Fit, Cut, Other) */}
      {serviceType && !serviceConfig?.hasWeldCalc && linkedPart && (
        <div style={{ ...sectionStyle }}>
          {sectionTitle('💰', 'Pricing', serviceConfig?.color || '#1976d2')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Labor Cost (per piece)</label>
              <input type="number" step="0.01" className="form-input" value={partData.laborTotal || ''}
                onChange={(e) => setPartData({ ...partData, laborTotal: e.target.value })} placeholder="0.00" />
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
              onChange={(e) => setPartData({ ...partData, _serviceNotes: e.target.value, specialInstructions: e.target.value })}
              rows={3} placeholder="Bevel details, weld symbols, fit-up requirements, etc." />
          </div>
        </div>
      )}

      {/* Pricing Summary */}
      {serviceType && linkedPart && (
        <div style={{ ...sectionStyle }}>
          <div style={{ background: '#f0f7ff', padding: 14, borderRadius: 8, border: '1px solid #bbdefb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
              <span>{serviceConfig?.label || 'Service'} (per piece)</span>
              <span>${laborEach.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9', marginTop: 4 }}>
              <strong>Line Total ({qty} × ${laborEach.toFixed(2)})</strong>
              <strong style={{ fontSize: '1.15rem', color: '#2e7d32' }}>${lineTotal.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Tracking */}
      {serviceType && (
        <div style={{ ...sectionStyle }}>
          {sectionTitle('🏷️', 'Tracking', '#616161')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Client Part Number</label>
              <input type="text" className="form-input" value={partData.clientPartNumber || ''}
                onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} placeholder="Optional" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
