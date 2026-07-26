import React, { useState } from 'react';
import { COUNTRIES, isUsmcaCountry } from '../constants/countries';

/**
 * Heat Number Input with optional multi-heat breakdown, each heat carrying its own
 * country of origin.
 *
 * Country of origin here means where the material was PRODUCED (melted and poured), not
 * where it was purchased. Material bought from a local service center that imported it is
 * NOT domestic. Since rolling a bar into a ring does not change its origin, whatever is
 * entered here is what flows onto the USMCA certificate.
 *
 * A split part can legitimately come from two mills in two countries, so each row in the
 * breakdown gets its own country rather than one country for the whole part.
 *
 * Props:
 *   partData - the part form data object
 *   setPartData - setter for partData
 *   gridColumn - optional CSS gridColumn (e.g. 'span 2' for full width in multi mode)
 */

function CountrySelect({ value, onChange, style, ariaLabel }) {
  const nonUsmca = value && !isUsmcaCountry(value);
  return (
    <select
      className="form-select"
      aria-label={ariaLabel || 'Country of origin'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...style,
        // Non-USMCA origin is not an error — it just cannot support a USMCA claim, and it is
        // worth being visible at a glance when someone is entering heats.
        color: nonUsmca ? '#e65100' : undefined,
        fontWeight: nonUsmca ? 600 : undefined,
      }}
    >
      <option value="">Origin…</option>
      <optgroup label="USMCA">
        {COUNTRIES.filter(c => c.usmca).map(c => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </optgroup>
      <optgroup label="Other">
        {COUNTRIES.filter(c => !c.usmca).map(c => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </optgroup>
    </select>
  );
}

export default function HeatNumberInput({ partData, setPartData, gridColumn }) {
  const breakdown = partData.heatBreakdown || [];
  const [multiMode, setMultiMode] = useState(breakdown.length > 0);

  const toggleMulti = () => {
    if (!multiMode) {
      // Switch to multi — seed from existing single heat, carrying its country across
      const initial = partData.heatNumber
        ? [{ heat: partData.heatNumber, qty: partData.quantity || 1, country: partData.heatCountry || '' }]
        : [{ heat: '', qty: '', country: partData.heatCountry || '' }];
      setPartData({ ...partData, heatBreakdown: initial, heatNumber: '' });
      setMultiMode(true);
    } else {
      // Switch back to single — take the first heat and its country
      const first = breakdown[0] || {};
      setPartData({
        ...partData,
        heatBreakdown: null,
        heatNumber: first.heat || '',
        heatCountry: first.country || partData.heatCountry || '',
      });
      setMultiMode(false);
    }
  };

  const updateRow = (index, field, value) => {
    const updated = [...breakdown];
    updated[index] = { ...updated[index], [field]: field === 'qty' ? value.replace(/[^0-9]/g, '') : value };
    setPartData({ ...partData, heatBreakdown: updated });
  };

  const addRow = () => {
    // Default a new row to the country already in use — most splits are the same mill
    const lastCountry = breakdown.length ? (breakdown[breakdown.length - 1].country || '') : '';
    setPartData({ ...partData, heatBreakdown: [...breakdown, { heat: '', qty: '', country: lastCountry }] });
  };

  const removeRow = (index) => {
    const updated = breakdown.filter((_, i) => i !== index);
    if (updated.length === 0) {
      setPartData({ ...partData, heatBreakdown: null, heatNumber: '' });
      setMultiMode(false);
    } else {
      setPartData({ ...partData, heatBreakdown: updated });
    }
  };

  // ---------- Single heat mode ----------
  if (!multiMode) {
    return (
      <div className="form-group" style={gridColumn ? { gridColumn } : {}}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Heat Number
          <button type="button" onClick={toggleMulti}
            style={{ background: 'none', border: 'none', color: '#795548', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            + Multiple Heats
          </button>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8 }}>
          <input type="text" className="form-input" value={partData.heatNumber || ''}
            onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })}
            placeholder="Optional" />
          <CountrySelect
            value={partData.heatCountry || ''}
            ariaLabel="Material country of origin"
            onChange={(v) => setPartData({ ...partData, heatCountry: v })}
          />
        </div>
        <div style={{ fontSize: '0.7rem', color: '#8d6e63', marginTop: 4 }}>
          Origin = where the material was made, not where it was bought.
        </div>
      </div>
    );
  }

  // ---------- Multi-heat mode ----------
  const totalQty = breakdown.reduce((s, r) => s + (parseInt(r.qty) || 0), 0);
  const partQty = parseInt(partData.quantity) || 1;
  const qtyMatch = totalQty === partQty;

  const entered = breakdown.filter(r => r.heat);
  const missingCountry = entered.filter(r => !r.country).length;
  const countries = [...new Set(entered.map(r => r.country).filter(Boolean))];
  const mixedOrigin = countries.length > 1;
  const anyNonUsmca = countries.some(c => !isUsmcaCountry(c));

  return (
    <div className="form-group" style={{ gridColumn: gridColumn || 'span 2' }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>🔥 Heat Numbers ({breakdown.length})</span>
        <button type="button" onClick={toggleMulti}
          style={{ background: 'none', border: 'none', color: '#795548', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
          ← Single Heat
        </button>
      </label>

      <div style={{ background: '#fff8f0', border: '1px solid #ffe0b2', borderRadius: 8, padding: 12 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 140px 32px', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#795548' }}>Heat #</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#795548' }}>Qty</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#795548' }}>Origin</span>
          <span></span>
        </div>

        {breakdown.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 140px 32px', gap: 8, marginBottom: 6 }}>
            <input type="text" className="form-input" value={row.heat || ''}
              onChange={(e) => updateRow(i, 'heat', e.target.value)}
              placeholder="e.g. ER34" style={{ padding: '4px 8px', fontSize: '0.9rem' }} />
            <input type="text" inputMode="numeric" className="form-input" value={row.qty || ''}
              onChange={(e) => updateRow(i, 'qty', e.target.value)}
              placeholder="#" style={{ padding: '4px 8px', fontSize: '0.9rem', textAlign: 'center' }} />
            <CountrySelect
              value={row.country || ''}
              ariaLabel={'Country of origin for heat ' + (i + 1)}
              onChange={(v) => updateRow(i, 'country', v)}
              style={{ padding: '4px 8px', fontSize: '0.9rem' }}
            />
            <button type="button" onClick={() => removeRow(i)}
              style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}>
              ✕
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <button type="button" onClick={addRow}
            style={{ background: 'none', border: 'none', color: '#795548', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: 0 }}>
            + Add Heat
          </button>
          {entered.length > 0 && (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: qtyMatch ? '#2e7d32' : '#e65100' }}>
              Total: {totalQty} / {partQty} pcs {!qtyMatch && '⚠️'}
            </span>
          )}
        </div>

        {/* Origin notices — informational, never blocking */}
        {missingCountry > 0 && (
          <div style={{ fontSize: '0.75rem', color: '#e65100', marginTop: 6 }}>
            ⚠️ {missingCountry} heat{missingCountry > 1 ? 's' : ''} missing country of origin — needed for USMCA.
          </div>
        )}
        {mixedOrigin && (
          <div style={{ fontSize: '0.75rem', color: '#e65100', marginTop: 4 }}>
            ⚠️ Mixed origin across heats ({countries.join(', ')}) — the certificate will list this part per-heat.
          </div>
        )}
        {anyNonUsmca && (
          <div style={{ fontSize: '0.75rem', color: '#c62828', marginTop: 4 }}>
            ⚠️ Non-USMCA material present. Rolling does not confer origin, so those pieces cannot be certified as originating.
          </div>
        )}
      </div>
    </div>
  );
}
