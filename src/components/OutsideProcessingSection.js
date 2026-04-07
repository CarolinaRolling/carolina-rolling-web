import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { searchVendors, createVendor } from '../services/api';

const SERVICE_TYPES = [
  'Welding', 'Beveling', 'Plating', 'Painting', 'Galvanizing',
  'Heat Treating', 'Hot Rolling', 'Machining', 'Cutting',
  'Sandblasting', 'Pickling & Passivation', 'Other'
];

const genId = () => Math.random().toString(36).slice(2, 11);

const emptyTransport = () => ({
  vendorId: null, vendorName: '', cost: '', markup: 20
});

const emptyOp = () => ({
  id: genId(), serviceType: '', vendorId: null, vendorName: '',
  costPerPart: '', markup: 20, expediteCost: '', notes: '',
  outboundTransport: null, // null = not configured
  inboundTransport: null
});

export default function OutsideProcessingSection({ partData, setPartData }) {
  const [enabled, setEnabled] = useState((partData.outsideProcessing || []).length > 0);
  const [vendorSearches, setVendorSearches] = useState({});
  const [vendorResults, setVendorResults] = useState({});

  const ops = partData.outsideProcessing || [];
  const partQty = parseInt(partData.quantity) || 1;

  const updateOps = (newOps) => {
    setPartData(prev => ({ ...prev, outsideProcessing: newOps }));
  };

  const handleEnable = (e) => {
    const checked = e.target.checked;
    setEnabled(checked);
    if (checked && ops.length === 0) updateOps([emptyOp()]);
    if (!checked) updateOps([]);
  };

  const addOperation = () => updateOps([...ops, emptyOp()]);

  const removeOperation = (opId) => {
    const newOps = ops.filter(o => o.id !== opId);
    updateOps(newOps);
    if (newOps.length === 0) setEnabled(false);
  };

  const updateOperation = (opId, field, value) => {
    updateOps(ops.map(o => o.id === opId ? { ...o, [field]: value } : o));
  };

  const updateTransport = (opId, leg, field, value) => {
    updateOps(ops.map(o => {
      if (o.id !== opId) return o;
      const t = o[leg] || emptyTransport();
      return { ...o, [leg]: { ...t, [field]: value } };
    }));
  };

  const enableTransport = (opId, leg) => {
    updateOps(ops.map(o => o.id === opId ? { ...o, [leg]: emptyTransport() } : o));
  };

  const disableTransport = (opId, leg) => {
    updateOps(ops.map(o => o.id === opId ? { ...o, [leg]: null } : o));
  };

  const handleVendorSearch = async (key, query) => {
    setVendorSearches(prev => ({ ...prev, [key]: query }));
    if (query.length >= 2) {
      try {
        const res = await searchVendors(query);
        setVendorResults(prev => ({ ...prev, [key]: res.data.data || [] }));
      } catch {
        setVendorResults(prev => ({ ...prev, [key]: [] }));
      }
    } else {
      setVendorResults(prev => ({ ...prev, [key]: [] }));
    }
  };

  const calcOp = (op) => {
    const cost = parseFloat(op.costPerPart) || 0;
    const expedite = parseFloat(op.expediteCost) || 0;
    const markup = parseFloat(op.markup) || 0;

    // Vendor cost (per part) — gets marked up
    const costProfit = cost * (markup / 100);
    const vendorCostTotalLot = (cost + expedite) * partQty;
    const vendorBilledTotalLot = (cost + costProfit + expedite) * partQty;

    // Outbound transport (lot)
    const out = op.outboundTransport;
    const outCost = out ? (parseFloat(out.cost) || 0) : 0;
    const outMarkup = out ? (parseFloat(out.markup) || 0) : 0;
    const outBilled = outCost * (1 + outMarkup / 100);
    const outProfit = outBilled - outCost;

    // Inbound transport (lot)
    const inb = op.inboundTransport;
    const inCost = inb ? (parseFloat(inb.cost) || 0) : 0;
    const inMarkup = inb ? (parseFloat(inb.markup) || 0) : 0;
    const inBilled = inCost * (1 + inMarkup / 100);
    const inProfit = inBilled - inCost;

    // Totals
    const totalCostLot = vendorCostTotalLot + outCost + inCost;
    const totalBilledLot = vendorBilledTotalLot + outBilled + inBilled;
    const totalProfit = (costProfit * partQty) + outProfit + inProfit;
    const billedPerPart = partQty > 0 ? totalBilledLot / partQty : totalBilledLot;

    return {
      cost, expedite, markup,
      costProfit,
      outCost, outBilled, outProfit,
      inCost, inBilled, inProfit,
      vendorCostTotalLot,
      vendorBilledTotalLot,
      totalCostLot,
      totalBilledLot,
      totalProfit,
      billedPerPart
    };
  };

  // Roll-up totals for the entire part (all ops combined)
  const opsTotals = ops.reduce((acc, op) => {
    const c = calcOp(op);
    return {
      totalCostLot: acc.totalCostLot + c.totalCostLot,
      totalBilledLot: acc.totalBilledLot + c.totalBilledLot,
      totalProfit: acc.totalProfit + c.totalProfit
    };
  }, { totalCostLot: 0, totalBilledLot: 0, totalProfit: 0 });

  const billedPerPart = partQty > 0 ? opsTotals.totalBilledLot / partQty : opsTotals.totalBilledLot;

  // Vendor input renderer
  const renderVendorInput = (key, currentVendorName, onSelect, onClear) => {
    const searchVal = vendorSearches[key] || '';
    const results = vendorResults[key] || [];
    if (currentVendorName) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, background: '#e8f5e9', borderRadius: 4, border: '1px solid #a5d6a7', fontSize: '0.8rem' }}>
          <strong>{currentVendorName}</strong>
          <button type="button" onClick={onClear}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f' }}>
            <X size={14} />
          </button>
        </div>
      );
    }
    return (
      <div style={{ position: 'relative' }}>
        <input type="text" className="form-input" placeholder="Search vendor..."
          value={searchVal}
          style={{ fontSize: '0.8rem' }}
          onChange={(e) => handleVendorSearch(key, e.target.value)} />
        {results.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 150, overflow: 'auto', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            {results.map(v => (
              <div key={v.id} onClick={() => {
                onSelect(v);
                setVendorSearches(prev => ({ ...prev, [key]: '' }));
                setVendorResults(prev => ({ ...prev, [key]: [] }));
              }}
                style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.8rem' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                <strong>{v.name}</strong>
                {v.contactName && <span style={{ color: '#666', marginLeft: 6, fontSize: '0.7rem' }}>{v.contactName}</span>}
              </div>
            ))}
            {searchVal.length >= 2 && (
              <div onClick={async () => {
                try {
                  const res = await createVendor({ name: searchVal });
                  if (res.data.data) {
                    onSelect(res.data.data);
                    setVendorSearches(prev => ({ ...prev, [key]: '' }));
                    setVendorResults(prev => ({ ...prev, [key]: [] }));
                  }
                } catch {}
              }} style={{ padding: 8, cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600, fontSize: '0.8rem' }}>
                + Add "{searchVal}" as new vendor
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Transport leg block
  const renderTransportLeg = (op, leg, label) => {
    const t = op[leg];
    const isEnabled = !!t;
    const key = `${op.id}_${leg}`;

    if (!isEnabled) {
      return (
        <button type="button" onClick={() => enableTransport(op.id, leg)}
          style={{ background: '#fff', border: '1px dashed #ccc', borderRadius: 4, padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={12} /> {label}
        </button>
      );
    }

    return (
      <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, border: '1px solid #ddd', marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <strong style={{ fontSize: '0.75rem', color: '#444' }}>🚛 {label}</strong>
          <button type="button" onClick={() => disableTransport(op.id, leg)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', padding: 2 }}>
            <X size={12} />
          </button>
        </div>
        <div style={{ marginBottom: 6 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Trucking Vendor</label>
          {renderVendorInput(
            key,
            t.vendorName,
            (v) => updateOps(ops.map(o => o.id === op.id ? { ...o, [leg]: { ...t, vendorId: v.id, vendorName: v.name } } : o)),
            () => updateOps(ops.map(o => o.id === op.id ? { ...o, [leg]: { ...t, vendorId: null, vendorName: '' } } : o))
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Lot Cost</label>
            <input type="number" step="0.01" className="form-input" value={t.cost}
              onChange={(e) => updateTransport(op.id, leg, 'cost', e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0.00" style={{ fontSize: '0.8rem' }} />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Markup %</label>
            <input type="number" step="1" className="form-input" value={t.markup}
              onChange={(e) => updateTransport(op.id, leg, 'markup', e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="20" style={{ fontSize: '0.8rem' }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 12, padding: 10, background: enabled ? '#FFF3E0' : '#fafafa', borderRadius: 8, border: enabled ? '1.5px solid #FFB74D' : '1px solid #e0e0e0' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, color: '#E65100' }}>
        <input type="checkbox" checked={enabled} onChange={handleEnable} />
        🏭 Outside Processing Required <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#888' }}>(internal only — not shown to customer)</span>
        {ops.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#666', fontWeight: 500 }}>
          {ops.length} op{ops.length !== 1 ? 's' : ''} • Profit: ${opsTotals.totalProfit.toFixed(2)}
        </span>}
      </label>

      {enabled && ops.map((op, idx) => {
        const calc = calcOp(op);
        return (
          <div key={op.id} style={{ marginTop: 10, padding: 10, background: 'white', borderRadius: 6, border: '1px solid #FFE0B2' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ color: '#E65100', fontSize: '0.85rem' }}>Operation {idx + 1}</strong>
              <button type="button" onClick={() => removeOperation(op.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>

            {/* Service Type */}
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Service Type *</label>
              <select className="form-select" value={op.serviceType}
                onChange={(e) => updateOperation(op.id, 'serviceType', e.target.value)}>
                <option value="">— Select —</option>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Outside Vendor */}
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Outside Vendor *</label>
              {renderVendorInput(
                op.id + '_main',
                op.vendorName,
                (v) => {
                  updateOps(ops.map(o => o.id === op.id ? { ...o, vendorId: v.id, vendorName: v.name } : o));
                },
                () => updateOps(ops.map(o => o.id === op.id ? { ...o, vendorId: null, vendorName: '' } : o))
              )}
            </div>

            {/* Cost & Markup */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Cost/Part *</label>
                <input type="number" step="0.01" className="form-input" value={op.costPerPart}
                  onChange={(e) => updateOperation(op.id, 'costPerPart', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00" style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Markup %</label>
                <input type="number" step="1" className="form-input" value={op.markup}
                  onChange={(e) => updateOperation(op.id, 'markup', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="20" style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', color: '#c62828' }}>Expedite</label>
                <input type="number" step="0.01" className="form-input" value={op.expediteCost}
                  onChange={(e) => updateOperation(op.id, 'expediteCost', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00" style={{ fontSize: '0.85rem' }} />
              </div>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Notes (optional)</label>
              <input type="text" className="form-input" value={op.notes || ''}
                onChange={(e) => updateOperation(op.id, 'notes', e.target.value)}
                placeholder="Special instructions for vendor"
                style={{ fontSize: '0.85rem' }} />
            </div>

            {/* Transport Legs */}
            <div style={{ marginTop: 10, padding: 8, background: '#FAFAFA', borderRadius: 4, border: '1px dashed #ccc' }}>
              <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600, marginBottom: 6 }}>🚛 Transport (optional)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  {renderTransportLeg(op, 'outboundTransport', `Outbound (to ${op.vendorName || 'vendor'})`)}
                </div>
                <div>
                  {renderTransportLeg(op, 'inboundTransport', `Inbound (from ${op.vendorName || 'vendor'} to us)`)}
                </div>
              </div>
            </div>

            {/* Calculation breakdown */}
            <div style={{ background: '#FFF8E1', padding: 8, borderRadius: 4, fontSize: '0.75rem', color: '#666', marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Vendor work: ${calc.cost.toFixed(2)}/part × {partQty}</span>
                <span>${(calc.cost * partQty).toFixed(2)}</span>
              </div>
              {calc.expedite > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Expedite: ${calc.expedite.toFixed(2)}/part × {partQty}</span>
                  <span>${(calc.expedite * partQty).toFixed(2)}</span>
                </div>
              )}
              {calc.outCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Outbound transport (lot)</span>
                  <span>${calc.outCost.toFixed(2)}</span>
                </div>
              )}
              {calc.inCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Inbound transport (lot)</span>
                  <span>${calc.inCost.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FFE082', paddingTop: 4, marginTop: 4 }}>
                <strong>Our Cost</strong>
                <strong>${calc.totalCostLot.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32', fontWeight: 600 }}>
                <span>+ Total Profit (markups)</span>
                <span>+${calc.totalProfit.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FFE082', paddingTop: 4, marginTop: 4, fontWeight: 700, color: '#E65100' }}>
                <span>Total Billed (rolled into part price)</span>
                <span>${calc.totalBilledLot.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.7rem' }}>
                <span>÷ {partQty} parts =</span>
                <span>${calc.billedPerPart.toFixed(2)}/part hidden in unit price</span>
              </div>
            </div>
          </div>
        );
      })}

      {enabled && (
        <button type="button" onClick={addOperation}
          style={{ marginTop: 8, background: 'white', border: '1px dashed #FFB74D', color: '#E65100', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={14} /> Add Another Operation
        </button>
      )}

      {enabled && ops.length > 0 && (
        <div style={{ marginTop: 10, padding: 8, background: '#FFE0B2', borderRadius: 4, fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Cost (all ops):</span>
            <strong>${opsTotals.totalCostLot.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32' }}>
            <span>Total Profit:</span>
            <strong>+${opsTotals.totalProfit.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FFB74D', paddingTop: 4, marginTop: 4, fontWeight: 700, color: '#E65100' }}>
            <span>Hidden in unit price (per part):</span>
            <span>${billedPerPart.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Returns PER-PART totals. Transport is lot price split across qty.
// All OP costs and markups are rolled into the per-part price (hidden from customer).
export function calculateOpTotals(operations, qty = 1) {
  const ops = operations || [];
  const partQty = parseInt(qty) || 1;
  let totalCostLot = 0; // total $ we pay (not per-part)
  let totalProfit = 0;  // total $ markup profit
  let totalBilledLot = 0;

  ops.forEach(op => {
    const cost = parseFloat(op.costPerPart) || 0;
    const expedite = parseFloat(op.expediteCost) || 0;
    const markup = parseFloat(op.markup) || 0;

    const vendorCostLot = (cost + expedite) * partQty;
    const costProfitLot = cost * (markup / 100) * partQty;
    const vendorBilledLot = vendorCostLot + costProfitLot;

    const out = op.outboundTransport;
    const outCost = out ? (parseFloat(out.cost) || 0) : 0;
    const outMarkup = out ? (parseFloat(out.markup) || 0) : 0;
    const outBilled = outCost * (1 + outMarkup / 100);

    const inb = op.inboundTransport;
    const inCost = inb ? (parseFloat(inb.cost) || 0) : 0;
    const inMarkup = inb ? (parseFloat(inb.markup) || 0) : 0;
    const inBilled = inCost * (1 + inMarkup / 100);

    totalCostLot += vendorCostLot + outCost + inCost;
    totalBilledLot += vendorBilledLot + outBilled + inBilled;
    totalProfit += costProfitLot + (outBilled - outCost) + (inBilled - inCost);
  });

  // Per-part values for rolling into the part's unit price
  const totalCost = partQty > 0 ? totalCostLot / partQty : totalCostLot;
  const totalBilled = partQty > 0 ? totalBilledLot / partQty : totalBilledLot;
  const totalProfitPerPart = partQty > 0 ? totalProfit / partQty : totalProfit;

  return {
    totalCost,            // per-part vendor cost (rolled into material side)
    totalProfit: totalProfitPerPart,  // per-part profit (rolled into labor side)
    totalBilled,          // per-part billed = totalCost + totalProfit
    // Lot totals for display in OP tab and PO generation
    totalCostLot,
    totalProfitLot: totalProfit,
    totalBilledLot
  };
}
