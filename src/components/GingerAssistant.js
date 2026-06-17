import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGingerFindings, markGingerFindingsRead, runGingerScan } from '../services/api';

const SEVERITY = {
  overdue:  { color: '#c62828', label: 'Overdue' },
  capacity: { color: '#e65100', label: 'At Risk' },
  material: { color: '#6a1b9a', label: 'Material' },
  due_soon: { color: '#f9a825', label: 'Due Soon' },
};

function GingerAssistant() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  const goToWorkOrder = (id) => {
    if (!id) return;
    setOpen(false);
    navigate(`/workorders/${id}`);
  };

  const load = useCallback(async () => {
    try {
      const res = await getGingerFindings();
      setData(res.data.data);
    } catch {
      // stay quiet on failure — Ginger just won't bark
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(t);
  }, [load]);

  const total = data?.total || 0;
  const unread = !!data && data.read === false && total > 0;

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      // Opening the panel = reading the findings → calm the icon
      try {
        await markGingerFindingsRead();
        setData((d) => (d ? { ...d, read: true } : d));
      } catch {}
    }
  };

  const handleRescan = async () => {
    setScanning(true);
    try {
      const res = await runGingerScan();
      setData(res.data.data);
    } catch {} finally {
      setScanning(false);
    }
  };

  const lastChecked = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'never';

  return (
    <>
      {/* Ginger icon — bottom right, to the left of Walter */}
      <div
        onClick={handleOpen}
        title={unread ? 'Ginger has new findings!' : 'Ask Ginger what needs doing'}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 76,
          width: 48,
          height: 48,
          cursor: 'pointer',
          zIndex: 1100,
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {/* Round photo (clipped) */}
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box',
          border: `3px solid ${unread ? '#c62828' : '#e67e22'}`,
          boxShadow: unread ? '0 0 0 0 rgba(198,40,40,0.6)' : '0 2px 8px rgba(0,0,0,0.3)',
          animation: unread ? 'gingerPulse 1.6s infinite' : 'none',
        }}>
          <img
            src={unread ? '/ginger-alert.jpg' : '/ginger.jpg'}
            alt="Ginger"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        {/* Count badge — overlaid on top of the icon, never clipped */}
        {unread && total > 0 && (
          <div style={{
            position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20,
            background: '#c62828', color: 'white', borderRadius: 10, fontSize: 11,
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px', border: '2px solid white', boxSizing: 'border-box',
            boxShadow: '0 1px 3px rgba(0,0,0,0.35)', lineHeight: 1, zIndex: 2,
          }}>{total > 99 ? '99+' : total}</div>
        )}
      </div>

      {/* Panel — above Ginger */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 76, right: 16, zIndex: 1100, width: 360, maxWidth: '92vw',
          animation: 'gingerFadeIn 0.25s ease-out',
        }}>
          <div style={{
            background: 'white', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            border: '2px solid #e67e22', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
              background: '#fff3e0', borderBottom: '1px solid #ffe0b2',
            }}>
              <img src="/ginger.jpg" alt="Ginger" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e67e22' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#e65100', fontSize: '0.95rem' }}>Ginger's List</div>
                <div style={{ fontSize: '0.7rem', color: '#999' }}>Last checked {lastChecked}</div>
              </div>
              <button onClick={handleRescan} disabled={scanning} title="Re-scan now"
                style={{ background: 'none', border: '1px solid #e67e22', color: '#e65100', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>
                {scanning ? '...' : '↻ Re-scan'}
              </button>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999', lineHeight: 1 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: 12 }}>
              {total === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: '#555' }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>🦴</div>
                  <div style={{ fontWeight: 600 }}>All caught up.</div>
                  <div style={{ fontSize: '0.82rem', color: '#888', marginTop: 4 }}>Nothing's at risk right now. Keep it that way.</div>
                </div>
              ) : (
                (data.findings || []).map((f, i) => {
                  const sev = SEVERITY[f.severity] || SEVERITY.due_soon;
                  return (
                    <div key={f.workOrderId || i} style={{
                      display: 'flex', gap: 10, padding: '10px 8px',
                      borderBottom: i < data.findings.length - 1 ? '1px solid #f0f0f0' : 'none',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sev.color, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', color: '#333', lineHeight: 1.4 }}>{f.gingerSays}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: sev.color, background: `${sev.color}15`, padding: '1px 6px', borderRadius: 4 }}>{sev.label}</span>
                          <span style={{ fontSize: '0.72rem', color: '#888' }}>
                            <button
                              onClick={() => goToWorkOrder(f.workOrderId)}
                              disabled={!f.workOrderId}
                              title={f.workOrderId ? 'Open this work order' : ''}
                              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.72rem', fontWeight: 700, color: f.workOrderId ? '#1565c0' : '#888', textDecoration: f.workOrderId ? 'underline' : 'none', cursor: f.workOrderId ? 'pointer' : 'default' }}
                            >DR {f.drNumber}</button>
                            {' · '}{f.clientName}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes gingerFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gingerPulse {
          0%   { box-shadow: 0 0 0 0 rgba(198,40,40,0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(198,40,40,0); }
          100% { box-shadow: 0 0 0 0 rgba(198,40,40,0); }
        }
      `}</style>
    </>
  );
}

export default GingerAssistant;
