import React, { useState, useEffect, useMemo } from 'react';
import { Upload } from 'lucide-react';
import { searchVendors } from '../services/api';

const THICKNESS_OPTIONS = [
  '24 ga', '20 ga', '16 ga', '14 ga', '12 ga', '11 ga', '10 ga',
  '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '7/8"',
  '1"', '1-1/4"', '1-1/2"', '2"', 'Custom'
];

const ANGLE_SIZE_OPTIONS = [
  '1x1', '2x2', '3x3', '4x4', '5x5', '6x6',
  '1x2', '2x3', '3x4', '4x5', '4x6', 'Custom'
];

const GRADE_OPTIONS = ['A36', '304 S/S', '316 S/S', 'AR400', 'Custom'];

// Parse angle size string like "3x4" into { leg1: 3, leg2: 4 }
function parseAngleSize(sizeStr) {
  if (!sizeStr || sizeStr === 'Custom') return null;
  const parts = sizeStr.split('x').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { leg1: parts[0], leg2: parts[1] };
  }
  return null;
}

// Calculate height of rise given a chord length and radius
// Using the sagitta formula: h = R - sqrt(R² - (c/2)²)
function calculateRise(radiusInches, chordInches) {
  if (!radiusInches || radiusInches <= 0) return null;
  const halfChord = chordInches / 2;
  if (halfChord >= radiusInches) return null; // chord too long for this radius
  const rise = radiusInches - Math.sqrt(radiusInches * radiusInches - halfChord * halfChord);
  return rise;
}

export default function AngleRollForm({ partData, setPartData, vendorSuggestions, setVendorSuggestions, showVendorSuggestions, setShowVendorSuggestions, showMessage, setError }) {
  const [customThickness, setCustomThickness] = useState('');
  const [customGrade, setCustomGrade] = useState('');
  const [customAngleSize, setCustomAngleSize] = useState('');
  const [rollValue, setRollValue] = useState(partData._rollValue || '');
  const [rollMeasureType, setRollMeasureType] = useState(partData._rollMeasureType || 'radius');

  // Sync roll fields from partData on mount (for editing)
  useEffect(() => {
    if (partData.radius && !partData.diameter) {
      setRollValue(partData.radius);
      setRollMeasureType('radius');
    } else if (partData.diameter) {
      setRollValue(partData.diameter);
      setRollMeasureType('diameter');
    }
    if (partData._rollMeasureType) setRollMeasureType(partData._rollMeasureType);
  }, []);

  // Update partData when roll fields change
  useEffect(() => {
    const updates = {
      _rollValue: rollValue,
      _rollMeasureType: rollMeasureType,
    };
    if (rollMeasureType === 'radius') {
      updates.radius = rollValue;
      updates.diameter = '';
    } else {
      updates.diameter = rollValue;
      updates.radius = '';
    }
    setPartData(prev => ({ ...prev, ...updates }));
  }, [rollValue, rollMeasureType]);

  // Determine if angle has unequal legs
  const parsedAngle = useMemo(() => parseAngleSize(partData._angleSize), [partData._angleSize]);
  const isUnequalLegs = parsedAngle && parsedAngle.leg1 !== parsedAngle.leg2;

  // Calculate the effective radius for rise calculation
  const effectiveRadius = useMemo(() => {
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return 0;
    return rollMeasureType === 'radius' ? rv : rv / 2;
  }, [rollValue, rollMeasureType]);

  // Calculate rise if radius/diameter > 120"
  const riseCalc = useMemo(() => {
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return null;
    const diameterValue = rollMeasureType === 'radius' ? rv * 2 : rv;
    const radiusValue = rollMeasureType === 'radius' ? rv : rv / 2;
    
    if (diameterValue > 120 || radiusValue > 120) {
      const rise = calculateRise(radiusValue, 60);
      if (rise !== null) {
        return { rise, chord: 60 };
      }
    }
    return null;
  }, [rollValue, rollMeasureType]);

  // Build material description string
  const materialDescription = useMemo(() => {
    const qty = parseInt(partData.quantity) || 1;
    const descParts = [];
    
    // Quantity
    descParts.push(`${qty}pc`);
    
    // Angle size
    if (partData._angleSize && partData._angleSize !== 'Custom') {
      const parsed = parseAngleSize(partData._angleSize);
      if (parsed) {
        descParts.push(`${parsed.leg1}" x ${parsed.leg2}"`);
      }
    } else if (partData._customAngleSize) {
      descParts.push(partData._customAngleSize);
    }
    
    // Thickness
    if (partData.thickness) {
      descParts.push(`x ${partData.thickness}`);
    }
    
    descParts.push('Angle');
    
    // Length
    if (partData.length) {
      descParts.push(`x ${partData.length} long`);
    }
    
    // Grade
    const grade = partData.material || '';
    if (grade) descParts.push(grade);
    
    // Origin
    const origin = partData._materialOrigin || '';
    if (origin) descParts.push(`(${origin})`);
    
    return descParts.join(' ');
  }, [partData._angleSize, partData._customAngleSize, partData.thickness, partData.length, partData.material, partData._materialOrigin, partData.quantity]);

  // Build rolling description
  const rollingDescription = useMemo(() => {
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return '';
    
    const lines = [];
    const typeLabel = rollMeasureType === 'radius' ? 'radius' : 'diameter';
    const ewHw = partData.rollType === 'easy_way' ? 'EW' : partData.rollType === 'hard_way' ? 'HW' : '';
    
    let rollLine = `Roll to ${rv}" ${typeLabel}`;
    if (ewHw) rollLine += ` ${ewHw}`;
    
    // Add leg orientation info for unequal legs
    if (isUnequalLegs && partData._legOrientation) {
      rollLine += ` (${partData._legOrientation}" leg ${partData.rollType === 'easy_way' ? 'out' : 'in'})`;
    }
    
    lines.push(rollLine);
    
    // Rise calculation
    if (riseCalc) {
      lines.push(`Rise: ${riseCalc.rise.toFixed(4)}" over ${riseCalc.chord}" chord`);
    }
    
    return lines.join('\n');
  }, [rollValue, rollMeasureType, partData.rollType, isUnequalLegs, partData._legOrientation, riseCalc]);

  // Auto-update material description
  useEffect(() => {
    setPartData(prev => ({ ...prev, materialDescription: materialDescription }));
  }, [materialDescription]);

  // Auto-update rolling description in special instructions
  useEffect(() => {
    if (rollingDescription) {
      setPartData(prev => ({ ...prev, _rollingDescription: rollingDescription }));
    }
  }, [rollingDescription]);

  // Calculate part total: material per-each × qty + flat charges
  const qty = parseInt(partData.quantity) || 1;
  const materialEach = parseFloat(partData.materialTotal) || 0;
  const lab = parseFloat(partData.laborTotal) || 0;
  const setup = parseFloat(partData.setupCharge) || 0;
  const other = parseFloat(partData.otherCharges) || 0;
  const calculatedTotal = (materialEach * qty) + lab + setup + other;

  // Auto-update part total
  useEffect(() => {
    setPartData(prev => ({ ...prev, partTotal: calculatedTotal.toFixed(2) }));
  }, [calculatedTotal]);

  const isCustomThickness = partData.thickness && !THICKNESS_OPTIONS.includes(partData.thickness) && partData.thickness !== 'Custom';
  const selectedThicknessOption = THICKNESS_OPTIONS.includes(partData.thickness) ? partData.thickness : (partData.thickness ? 'Custom' : '');

  const isCustomGrade = partData.material && !GRADE_OPTIONS.includes(partData.material);
  const selectedGradeOption = GRADE_OPTIONS.includes(partData.material) ? partData.material : (partData.material ? 'Custom' : '');

  const selectedAngleSizeOption = ANGLE_SIZE_OPTIONS.includes(partData._angleSize) ? partData._angleSize : (partData._angleSize ? 'Custom' : '');

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sectionTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  return (
    <>
      {/* === DIMENSIONS === */}
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity} onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} min="1" />
      </div>

      <div className="form-group">
        <label className="form-label">Angle Size *</label>
        <select className="form-select" value={selectedAngleSizeOption} onChange={(e) => {
          if (e.target.value === 'Custom') {
            setPartData({ ...partData, _angleSize: 'Custom', _legOrientation: '' });
          } else {
            setPartData({ ...partData, _angleSize: e.target.value, _legOrientation: '' });
            setCustomAngleSize('');
          }
        }}>
          <option value="">Select...</option>
          {ANGLE_SIZE_OPTIONS.map(s => {
            if (s === 'Custom') return <option key={s} value={s}>{s}</option>;
            const p = parseAngleSize(s);
            return <option key={s} value={s}>{p.leg1}" x {p.leg2}"</option>;
          })}
        </select>
        {(selectedAngleSizeOption === 'Custom') && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder='e.g. 3x5 or 3" x 5"'
            value={partData._customAngleSize || customAngleSize}
            onChange={(e) => { setCustomAngleSize(e.target.value); setPartData({ ...partData, _customAngleSize: e.target.value }); }} />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Thickness *</label>
        <select className="form-select" value={selectedThicknessOption} onChange={(e) => {
          if (e.target.value === 'Custom') {
            setPartData({ ...partData, thickness: customThickness || 'Custom' });
          } else {
            setPartData({ ...partData, thickness: e.target.value });
            setCustomThickness('');
          }
        }}>
          <option value="">Select...</option>
          {THICKNESS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(selectedThicknessOption === 'Custom' || isCustomThickness) && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter custom thickness"
            value={partData.thickness === 'Custom' ? customThickness : partData.thickness}
            onChange={(e) => { setCustomThickness(e.target.value); setPartData({ ...partData, thickness: e.target.value }); }} />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Length</label>
        <select className="form-select" value={partData._lengthOption || ''} onChange={(e) => {
          const val = e.target.value;
          if (val === 'Custom') {
            setPartData({ ...partData, _lengthOption: 'Custom', length: partData._customLength || '' });
          } else {
            setPartData({ ...partData, _lengthOption: val, length: val, _customLength: '' });
          }
        }}>
          <option value="">Select...</option>
          <option value="20'">20'</option>
          <option value="30'">30'</option>
          <option value="40'">40'</option>
          <option value="Custom">Custom</option>
        </select>
        {(partData._lengthOption === 'Custom') && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter length"
            value={partData._customLength || ''}
            onChange={(e) => { setPartData({ ...partData, _customLength: e.target.value, length: e.target.value }); }} />
        )}
      </div>

      {/* === ROLL INFO === */}
      <div style={sectionStyle}>
        {sectionTitle('🔄', 'Roll Information', '#1565c0')}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Roll Value *</label>
            <input className="form-input" value={rollValue} onChange={(e) => setRollValue(e.target.value)} placeholder="Enter value" type="number" step="0.001" />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={rollMeasureType} onChange={(e) => setRollMeasureType(e.target.value)}>
              <option value="radius">Radius</option>
              <option value="diameter">Diameter</option>
            </select>
          </div>
        </div>

        {/* Easy Way / Hard Way */}
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Roll Direction *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button"
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem',
                border: `2px solid ${partData.rollType === 'easy_way' ? '#2e7d32' : '#ccc'}`,
                background: partData.rollType === 'easy_way' ? '#e8f5e9' : '#fff',
                color: partData.rollType === 'easy_way' ? '#2e7d32' : '#666',
                cursor: 'pointer'
              }}
              onClick={() => setPartData({ ...partData, rollType: 'easy_way', _legOrientation: '' })}
            >
              Easy Way (EW)
            </button>
            <button type="button"
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem',
                border: `2px solid ${partData.rollType === 'hard_way' ? '#c62828' : '#ccc'}`,
                background: partData.rollType === 'hard_way' ? '#ffebee' : '#fff',
                color: partData.rollType === 'hard_way' ? '#c62828' : '#666',
                cursor: 'pointer'
              }}
              onClick={() => setPartData({ ...partData, rollType: 'hard_way', _legOrientation: '' })}
            >
              Hard Way (HW)
            </button>
          </div>
        </div>

        {/* Leg Orientation - Only show for unequal legs */}
        {isUnequalLegs && partData.rollType && (
          <div style={{
            padding: 12, borderRadius: 8, marginBottom: 12,
            background: '#fff3e0', border: '2px solid #ff9800'
          }}>
            <label className="form-label" style={{ color: '#e65100', fontWeight: 700, marginBottom: 8 }}>
              ⚠️ Unequal Legs — Which leg points {partData.rollType === 'easy_way' ? 'OUTWARD' : 'INWARD'}?
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button"
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600,
                  border: `2px solid ${partData._legOrientation === String(parsedAngle.leg1) ? '#1565c0' : '#ccc'}`,
                  background: partData._legOrientation === String(parsedAngle.leg1) ? '#e3f2fd' : '#fff',
                  color: partData._legOrientation === String(parsedAngle.leg1) ? '#1565c0' : '#666',
                  cursor: 'pointer'
                }}
                onClick={() => setPartData({ ...partData, _legOrientation: String(parsedAngle.leg1) })}
              >
                {parsedAngle.leg1}" leg
              </button>
              <button type="button"
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600,
                  border: `2px solid ${partData._legOrientation === String(parsedAngle.leg2) ? '#1565c0' : '#ccc'}`,
                  background: partData._legOrientation === String(parsedAngle.leg2) ? '#e3f2fd' : '#fff',
                  color: partData._legOrientation === String(parsedAngle.leg2) ? '#1565c0' : '#666',
                  cursor: 'pointer'
                }}
                onClick={() => setPartData({ ...partData, _legOrientation: String(parsedAngle.leg2) })}
              >
                {parsedAngle.leg2}" leg
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 6 }}>
              {partData.rollType === 'easy_way' 
                ? 'Easy Way: Select which leg points outward (away from center of roll)' 
                : 'Hard Way: Select which leg points inward (toward center of roll)'}
            </div>
          </div>
        )}

        {/* Rise Calculation Display */}
        {riseCalc && (
          <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2e7d32', marginBottom: 4 }}>
              📐 Height of Rise Calculation
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              <span style={{ color: '#666' }}>Based on {riseCalc.chord}" chord: </span>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{riseCalc.rise.toFixed(4)}"</span>
              <span style={{ color: '#666', marginLeft: 4 }}>({(riseCalc.rise * 25.4).toFixed(2)} mm)</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}>
              Shown because {rollMeasureType === 'radius' ? 'radius' : 'diameter'} ({rollValue}") exceeds 120"
            </div>
          </div>
        )}

        {/* Rolling Description Preview */}
        {rollingDescription && (
          <div style={{ background: '#f3e5f5', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#6a1b9a', marginBottom: 6 }}>Rolling Description Preview:</div>
            <pre style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#333' }}>
              {materialDescription}{'\n'}{rollingDescription}
            </pre>
          </div>
        )}
      </div>

      {/* === EASY/HARD WAY DIAGRAM === */}
      <div style={sectionStyle}>
        <div className="form-group">
          <label className="form-label">Custom Shape (PDF)</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
            <Upload size={16} /> Upload drawing...
            <input type="file" accept=".pdf,.png,.jpg" style={{ display: 'none' }} onChange={(e) => {
              if (e.target.files[0]) setPartData({ ...partData, _shapeFile: e.target.files[0] });
            }} />
          </label>
          {partData._shapeFile && <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: 2 }}>📎 {partData._shapeFile.name}</div>}
        </div>
      </div>

      {/* === SPECIAL INSTRUCTIONS === */}
      <div style={sectionStyle}>
        <div className="form-group">
          <label className="form-label">Special Instructions</label>
          <textarea className="form-textarea" value={partData.specialInstructions || ''} onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} rows={2} />
        </div>
      </div>

      {/* === MATERIAL INFO === */}
      <div style={sectionStyle}>
        {sectionTitle('📦', 'Material Information', '#e65100')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Grade</label>
            <select className="form-select" value={selectedGradeOption} onChange={(e) => {
              if (e.target.value === 'Custom') {
                setPartData({ ...partData, material: customGrade || '' });
              } else {
                setPartData({ ...partData, material: e.target.value });
                setCustomGrade('');
              }
            }}>
              <option value="">Select...</option>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {(selectedGradeOption === 'Custom' || isCustomGrade) && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter grade"
                value={isCustomGrade ? partData.material : customGrade}
                onChange={(e) => { setCustomGrade(e.target.value); setPartData({ ...partData, material: e.target.value }); }} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Origin</label>
            <select className="form-select" value={partData._materialOrigin || ''} onChange={(e) => setPartData({ ...partData, _materialOrigin: e.target.value })}>
              <option value="">Select...</option>
              <option value="Domestic">Domestic</option>
              <option value="Import">Import</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Material Source</label>
            <select className="form-select" value={partData.materialSource || 'customer_supplied'} onChange={(e) => setPartData({ ...partData, materialSource: e.target.value })}>
              <option value="customer_supplied">Client Supplies</option>
              <option value="we_order">We Order</option>
            </select>
          </div>
        </div>

        {/* Vendor Selector */}
        {partData.materialSource === 'we_order' && (
          <div className="form-group" style={{ position: 'relative', marginTop: 8 }}>
            <label className="form-label">Vendor</label>
            <input className="form-input"
              value={partData._vendorSearch !== undefined ? partData._vendorSearch : (partData.vendor?.name || partData.supplierName || '')}
              onChange={async (e) => {
                const value = e.target.value;
                setPartData({ ...partData, _vendorSearch: value });
                if (value.length >= 1) {
                  try { const res = await searchVendors(value); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch { setVendorSuggestions([]); }
                } else {
                  setPartData({ ...partData, _vendorSearch: value, vendorId: null, supplierName: '' }); setVendorSuggestions([]); setShowVendorSuggestions(false);
                }
              }}
              onFocus={async () => { try { const res = await searchVendors(''); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch {} }}
              onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)}
              placeholder="Search or add vendor..." autoComplete="off"
            />
            {showVendorSuggestions && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {vendorSuggestions.map(v => (
                  <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                    onMouseDown={() => { setPartData({ ...partData, vendorId: v.id, supplierName: v.name, _vendorSearch: undefined }); setShowVendorSuggestions(false); }}>
                    <strong>{v.name}</strong>
                    {v.contactPhone && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{v.contactPhone}</span>}
                  </div>
                ))}
                {partData._vendorSearch && partData._vendorSearch.length >= 2 && !vendorSuggestions.some(v => v.name.toLowerCase() === (partData._vendorSearch || '').toLowerCase()) && (
                  <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                    onMouseDown={async () => {
                      try {
                        const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/vendors`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ name: partData._vendorSearch }) });
                        const data = await res.json();
                        if (data.data) { setPartData({ ...partData, vendorId: data.data.id, supplierName: data.data.name, _vendorSearch: undefined }); showMessage(`Vendor "${data.data.name}" created`); }
                      } catch { setError('Failed to create vendor'); }
                      setShowVendorSuggestions(false);
                    }}>
                    + Add "{partData._vendorSearch}" as new vendor
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Material Description for email */}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Material Description (for ordering)</label>
          <textarea className="form-textarea" value={partData.materialDescription || ''} onChange={(e) => setPartData({ ...partData, materialDescription: e.target.value })} rows={2}
            style={{ fontFamily: 'monospace', fontSize: '0.9rem' }} />
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>Auto-generated from dimensions — edit as needed for supplier email</div>
        </div>
      </div>

      {/* === PRICING === */}
      <div style={sectionStyle}>
        {sectionTitle('💰', 'Pricing', '#1976d2')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Material Price (each)</label>
            <input type="number" step="0.01" className="form-input" value={partData.materialTotal || ''} onChange={(e) => setPartData({ ...partData, materialTotal: e.target.value })} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Labor Price</label>
            <input type="number" step="0.01" className="form-input" value={partData.laborTotal || ''} onChange={(e) => setPartData({ ...partData, laborTotal: e.target.value })} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Setup Charge</label>
            <input type="number" step="0.01" className="form-input" value={partData.setupCharge || ''} onChange={(e) => setPartData({ ...partData, setupCharge: e.target.value })} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Other Charges</label>
            <input type="number" step="0.01" className="form-input" value={partData.otherCharges || ''} onChange={(e) => setPartData({ ...partData, otherCharges: e.target.value })} placeholder="0.00" />
          </div>
        </div>

        {/* Pricing Summary */}
        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginTop: 12 }}>
          {materialEach > 0 && qty > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: '0.85rem', color: '#666' }}>
              <span>Material: ${materialEach.toFixed(2)} × {qty} pcs</span>
              <span>${(materialEach * qty).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: materialEach > 0 && qty > 1 ? '1px solid #ddd' : 'none', paddingTop: materialEach > 0 && qty > 1 ? 8 : 0 }}>
            <span style={{ fontWeight: 600 }}>Part Total:</span>
            <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#2e7d32' }}>${calculatedTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* === TRACKING === */}
      <div style={sectionStyle}>
        {sectionTitle('🏷️', 'Tracking', '#616161')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Client Part Number</label>
            <input type="text" className="form-input" value={partData.clientPartNumber || ''} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label className="form-label">Heat Number</label>
            <input type="text" className="form-input" value={partData.heatNumber || ''} onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </div>
    </>
  );
}
