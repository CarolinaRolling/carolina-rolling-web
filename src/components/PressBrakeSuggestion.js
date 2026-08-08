import React, { useState, useEffect } from 'react';
import { getPressBrakeConfig } from '../services/api';

/**
 * Recommended press-brake labor cost. Mirrors the PriceSuggestion UI pattern (a clickable
 * "Recommended $X" chip below the labor input, plus a "why?" breakdown), but the number comes
 * from a transparent FORMULA rather than won-job history:
 *
 *   total_time = setup + (bendCount × secPerBend × handlingMult × qty)
 *   recommended = max(total_time_hours × shopRate, minimumCharge)
 *
 * All constants come from editable config (AppSettings 'press_brake_config'), never hardcoded.
 * Also shows a capacity warning (Step 3) — warns, never blocks.
 *
 * Inputs are plain values, so they can come from manual entry OR a future STEP-file auto-fill
 * with no change to this calculation.
 */
export default function PressBrakeSuggestion({ thickness, width, length, material, bendCount, handlingClass, quantity, onApply }) {
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPressBrakeConfig()
      .then(res => { if (!cancelled) setConfig(res.data.data); })
      .catch(() => { if (!cancelled) setConfig(null); });
    return () => { cancelled = true; };
  }, []);

  if (!config) return null;

  const qty = parseInt(quantity) || 1;
  const bends = parseInt(bendCount) || 0;

  // ---- parse dimensions (inches). Reuse simple gauge + fraction handling. ----
  const GAUGE = { '3':0.2391,'4':0.2242,'5':0.2092,'6':0.1943,'7':0.1793,'8':0.1644,'9':0.1495,
    '10':0.1345,'11':0.1196,'12':0.1046,'13':0.0897,'14':0.0747,'16':0.0598,'18':0.0478,'20':0.0359,
    '22':0.0299,'24':0.0239,'26':0.0179 };
  const parseInches = (v) => {
    if (v === null || v === undefined || v === '') return null;
    let s = String(v).replace(/["\u2033]|in\.?|inch(es)?/gi, ' ').trim();
    const g = s.match(/(\d+)\s*ga\b/i);
    if (g && GAUGE[g[1]] !== undefined) return GAUGE[g[1]];
    let m = s.match(/(\d+)[\s-]+(\d+)\s*\/\s*(\d+)/); // mixed number 1-1/2
    if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]);
    m = s.match(/(\d+)\s*\/\s*(\d+)/); // fraction
    if (m) return parseInt(m[1]) / parseInt(m[2]);
    // feet like 4' -> inches
    m = s.match(/(\d*\.?\d+)\s*'/);
    if (m) return parseFloat(m[1]) * 12;
    m = s.match(/(\d*\.?\d+)/);
    if (m) return parseFloat(m[1]);
    return null;
  };

  const t = parseInches(thickness);
  // bend length = the longer of width/length (the dimension being bent along)
  const w = parseInches(width);
  const l = parseInches(length);
  const bendLenIn = Math.max(w || 0, l || 0);
  const bendLenFt = bendLenIn / 12;

  // ---- recommended labor ----
  const handlingMult = (config.handlingMultipliers && config.handlingMultipliers[handlingClass]) || 1;
  const secPerBend = Number(config.secondsPerBend) || 0;
  const setupSec = Number(config.setupTimeSec) || 0;
  const shopRate = Number(config.shopRate) || 0;          // $/hr
  const minCharge = Number(config.minimumCharge) || 0;

  const runSec = bends * secPerBend * handlingMult * qty;
  const totalSec = setupSec + runSec;
  const totalHours = totalSec / 3600;
  const rawLabor = totalHours * shopRate;
  const recommended = Math.max(rawLabor, minCharge);
  const hitMinimum = rawLabor < minCharge;

  // ---- capacity warning (Step 3) ----
  const warnings = [];
  const maxBendFt = Number(config.maxBendLengthFt) || 12;
  if (bendLenFt > maxBendFt) {
    warnings.push(`Bend length ~${bendLenFt.toFixed(1)} ft exceeds the ${maxBendFt} ft machine capacity.`);
  }
  // tonnage: (575 × t²)/V per foot × length × material factor
  const matFactor = (() => {
    const m = String(material || '').toLowerCase();
    if (/stainless|\b3\d{2}\b|s\/s|\bss\b/.test(m)) return Number(config.materialFactors?.stainless) || 1.5;
    if (/alum|5052|6061|3003/.test(m)) return Number(config.materialFactors?.aluminum) || 0.5;
    return Number(config.materialFactors?.mild) || 1.0;
  })();
  // V-die opening from config table keyed by thickness (nearest at or above)
  let vDie = null;
  if (t && Array.isArray(config.vDieTable) && config.vDieTable.length) {
    const sorted = [...config.vDieTable].sort((a, b) => a.thickness - b.thickness);
    const match = sorted.find(r => t <= Number(r.thickness)) || sorted[sorted.length - 1];
    vDie = Number(match.vOpening);
  }
  let requiredTons = null;
  if (t && vDie && bendLenFt > 0) {
    const tonsPerFoot = (575 * t * t) / vDie;
    requiredTons = tonsPerFoot * bendLenFt * matFactor;
    const maxTons = Number(config.maxTonnage) || 350;
    if (requiredTons > maxTons) {
      warnings.push(`Est. ~${Math.round(requiredTons)} tons needed (${matFactor}× ${material || 'mild'}) exceeds the ${maxTons}-ton machine at a ${vDie}" die.`);
    }
  }

  const canRecommend = bends > 0 && shopRate > 0;

  return (
    <div style={{ marginTop: 5 }}>
      {warnings.map((wn, i) => (
        <div key={i} style={{ marginTop: 5, fontSize: '0.75rem', background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 8, padding: '6px 10px', color: '#e65100' }}>
          ⚠️ <strong>Capacity:</strong> {wn} <span style={{ color: '#999' }}>(warning only — you can still quote it)</span>
        </div>
      ))}

      {canRecommend ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onApply && onApply(Number(recommended.toFixed(2)))}
            title="Click to use this labor price"
            style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', color: '#1b5e20', borderRadius: 14, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
            💡 Recommended ${recommended.toFixed(2)}{qty > 1 ? ' /ea' : ''}
          </button>
          {hitMinimum && (
            <span style={{ fontSize: '0.7rem', background: '#fff8e1', color: '#8d6e63', padding: '2px 8px', borderRadius: 12 }}>
              at minimum charge
            </span>
          )}
          <button type="button" onClick={() => setOpen(!open)}
            style={{ background: 'none', border: 'none', color: '#1565c0', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            {open ? 'hide' : 'why?'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 5, fontSize: '0.72rem', color: '#999' }}>
          Enter bend count{shopRate <= 0 ? ' and set the shop rate in Settings' : ''} to see a recommendation.
        </div>
      )}

      {open && canRecommend && (
        <div style={{ marginTop: 6, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 10, fontSize: '0.75rem', color: '#555' }}>
          <div style={{ marginBottom: 5 }}>
            <strong>Setup</strong> {(setupSec/60).toFixed(1)} min + <strong>{bends} bend{bends===1?'':'s'}</strong> ×
            {' '}{secPerBend}s × {handlingMult}× handling{qty>1?<> × {qty} pcs</>:null}
            {' '}= <strong>{(totalSec/60).toFixed(1)} min</strong> total.
          </div>
          <div style={{ marginBottom: 5 }}>
            {(totalHours).toFixed(2)} hr × <strong>${shopRate}/hr</strong> = ${rawLabor.toFixed(2)}
            {hitMinimum && <> → raised to <strong>${minCharge.toFixed(2)}</strong> minimum</>}.
          </div>
          {requiredTons != null && (
            <div style={{ color: '#777' }}>
              Est. tonnage: ~{Math.round(requiredTons)} tons at {vDie}" die ({matFactor}× {material || 'mild'}), bend length {bendLenFt.toFixed(1)} ft.
            </div>
          )}
          <div style={{ color: '#999', marginTop: 5 }}>
            Formula-based suggestion from your press-brake config. Adjust constants in Settings → Press Brake.
          </div>
        </div>
      )}
    </div>
  );
}
