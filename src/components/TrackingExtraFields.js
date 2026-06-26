import React from 'react';

// Extra per-part tracking fields (Rev, PO Line #, Lot #).
// Rendered as a fragment so the three inputs flow into the parent Tracking grid,
// alongside Client Part Number and Heat Number.
export default function TrackingExtraFields({ partData, setPartData }) {
  const set = (k, v) => setPartData({ ...partData, [k]: v });
  return (
    <>
      <div className="form-group">
        <label className="form-label">Rev</label>
        <input type="text" className="form-input" value={partData.rev || ''} onChange={(e) => set('rev', e.target.value)} placeholder="Optional" />
      </div>
      <div className="form-group">
        <label className="form-label">PO Line #</label>
        <input type="text" className="form-input" value={partData.poLineNumber || ''} onChange={(e) => set('poLineNumber', e.target.value)} placeholder="Optional" />
      </div>
      <div className="form-group">
        <label className="form-label">Lot #</label>
        <input type="text" className="form-input" value={partData.lotNumber || ''} onChange={(e) => set('lotNumber', e.target.value)} placeholder="Auto: DR#-line (editable)" />
      </div>
    </>
  );
}
