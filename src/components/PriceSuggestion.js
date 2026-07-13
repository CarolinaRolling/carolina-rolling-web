import React, { useState, useEffect } from 'react';
import { getPriceSuggestion } from '../services/api';

/**
 * Shows a recommended labor price based on comparable WON jobs.
 *
 * Deliberately honest about its own data:
 *  - only learns from jobs that were actually won (we have no reliable loss data)
 *  - leads with the proven-high end of the range, not the median
 *  - labels thin data as thin instead of faking precision
 */
export default function PriceSuggestion({ partType, material, thickness, width, length, diameter, clientName, onApply }) {
  const [sug, setSug] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!partType) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getPriceSuggestion({ partType, material, thickness, width, length, diameter, clientName });
        if (!cancelled) setSug(res.data.data);
      } catch { if (!cancelled) setSug(null); }
      finally { if (!cancelled) setLoading(false); }
    }, 400); // debounce while they're typing dimensions
    return () => { cancelled = true; clearTimeout(t); };
  }, [partType, material, thickness, width, length, diameter, clientName]);

  if (loading) return <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 4 }}>checking past jobs…</div>;
  if (!sug) return null;

  const craneWarning = sug.overCrane ? (
    <div style={{ marginTop: 5, fontSize: '0.75rem', background: '#ffebee', border: '1px solid #ef5350', borderRadius: 8, padding: '6px 10px', color: '#b71c1c' }}>
      🏗️ <strong>~{sug.estWeightLbs.toLocaleString()} lb per piece — over your {sug.craneCapacityLbs.toLocaleString()} lb crane limit.</strong> You can't lift this as one piece; plan rigging/splitting before quoting.
    </div>
  ) : null;

  if (sug.oversize) {
    return (
      <>
        {craneWarning}
        <div style={{ marginTop: 5, fontSize: '0.75rem', background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 8, padding: '6px 10px', color: '#e65100' }}>
          ⚠️ <strong>Over 120" wide</strong> — confirm machine clearance before quoting. Price accordingly (this is expensive if it clears at all).
        </div>
      </>
    );
  }
  if (!sug.found) {
    return (
      <>
        {craneWarning}
        <div style={{ marginTop: 5, fontSize: '0.72rem', color: '#999' }}>
          No comparable won jobs yet{sug.widthBand ? ` at ${sug.widthBand} width` : ''}.
        </div>
      </>
    );
  }

  const conf = sug.confidence;
  const confColor = conf === 'good' ? '#2e7d32' : conf === 'fair' ? '#ef6c00' : '#9e9e9e';
  const confLabel = conf === 'good' ? `${sug.found} similar won jobs`
    : conf === 'fair' ? `only ${sug.found} similar jobs`
    : `⚠️ thin data — just ${sug.found} job${sug.found === 1 ? '' : 's'}`;

  return (
    <div style={{ marginTop: 5 }}>
      {craneWarning}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onApply && onApply(sug.suggested)}
          title="Click to use this price"
          style={{
            background: '#e8f5e9', border: '1px solid #a5d6a7', color: '#1b5e20',
            borderRadius: 14, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
          }}>
          💡 Recommended ${sug.suggested.toFixed(2)}
        </button>
        {sug.isNewClient && sug.upliftPct > 0 && (
          <span title="New client — no price anchor, so the new-client uplift is applied"
            style={{ fontSize: '0.7rem', background: '#ede7f6', color: '#4527a0', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
            ✨ new client +{sug.upliftPct}%
          </span>
        )}
        <span style={{ fontSize: '0.7rem', color: confColor }}>{confLabel}{sug.widthBand ? ` @ ${sug.widthBand}` : ''}</span>
        <button type="button" onClick={() => setOpen(!open)}
          style={{ background: 'none', border: 'none', color: '#1565c0', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          {open ? 'hide' : 'why?'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 6, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 10, fontSize: '0.75rem', color: '#555' }}>
          <div style={{ marginBottom: 6 }}>
            You typically charge <strong>${sug.median.toFixed(2)}</strong>
            {sug.recentMedian != null && <> (recently <strong>${sug.recentMedian.toFixed(2)}</strong>)</>},
            and you have <strong>already won</strong> jobs like this at up to <strong>${sug.provenHigh.toFixed(2)}</strong>.
            Range: ${sug.low.toFixed(2)} – ${sug.provenHigh.toFixed(2)}.
          </div>
          <div style={{ color: '#777', marginBottom: 6 }}>
            Based only on quotes you actually <strong>won</strong>{sug.widthBand ? ` at ${sug.widthBand} width` : ''} — recent jobs weighted more heavily.
            {sug.estWeightLbs != null && <> Est. weight <strong>{sug.estWeightLbs.toLocaleString()} lb</strong>/pc.</>}
          </div>
          {sug.samples?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <tbody>
                {sug.samples.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '3px 4px', fontWeight: 700, color: '#2e7d32' }}>${parseFloat(s.labor).toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: '#777' }}>{s.material || '—'}</td>
                    <td style={{ padding: '3px 4px', color: '#777' }}>
                      {s.thickness ? `${s.thickness}"` : ''}{s.width ? ` × ${s.width}"w` : ''}{s.diameter ? ` × ${s.diameter}"⌀` : ''}
                    </td>
                    <td style={{ padding: '3px 4px', color: '#999' }}>{s.client}</td>
                    <td style={{ padding: '3px 4px', color: '#bbb', textAlign: 'right' }}>{s.ageDays}d ago</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
