import React, { useRef, useState, useEffect } from 'react';

// Capture (or replace) an operator's stored signature. Draw with mouse/finger/stylus.
export default function OperatorSignatureModal({ operatorName, existing, onSave, onClose }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(!!existing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext('2d');
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = existing;
    }
  }, [existing]);

  const pos = (e) => { const c = canvasRef.current; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }; };
  const start = (e) => { e.preventDefault(); const c = canvasRef.current; if (!c) return; c.setPointerCapture?.(e.pointerId); drawing.current = true; const ctx = c.getContext('2d'); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#111'; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); if (!hasSig) setHasSig(true); };
  const end = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height); setHasSig(false); };
  const save = async () => {
    if (!hasSig) return;
    setSaving(true);
    try { await onSave(canvasRef.current.toDataURL('image/png')); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 10, padding: 20, width: 480, maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px' }}>Signature — {operatorName}</h3>
        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#666' }}>Have {operatorName} sign below. This is applied automatically to their inspection reports.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button onClick={clear} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}>Clear</button>
        </div>
        <canvas ref={canvasRef} width={520} height={160}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
          style={{ width: '100%', height: 160, border: `1.5px dashed ${hasSig ? '#4caf50' : '#bbb'}`, borderRadius: 8, background: '#fafafa', touchAction: 'none', display: 'block' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={save} disabled={!hasSig || saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save Signature'}</button>
        </div>
      </div>
    </div>
  );
}
