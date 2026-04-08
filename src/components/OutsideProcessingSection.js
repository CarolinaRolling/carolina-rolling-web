import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { searchVendors, createVendor } from '../services/api';

const SERVICE_TYPES = [
  'Finishing', 'Cutting', 'Beveling', 'Welding', 'Forming',
  'Heat Treating', 'Machining', 'Galvanizing', 'Powder Coating',
  'Passivating', 'Sandblasting', 'Other'
];

const genId = () => Math.random().toString(36).slice(2, 11);

const emptyOp = () => ({
  id: genId(),
  serviceType: '',
  vendorId: null,
  vendorName: '',
  costPerPart: '',
  markup: 20,
  expediteCost: '',
  notes: ''
});

export default function OutsideProcessingSection({ partData, setPartData, allowHideFromCustomer = false, showTrucking = false }) {
  const [enabled, setEnabled] = useState((partData.outsideProcessing || []).length > 0);
  const [vendorSearches, setVendorSearches] = useState({});
  const [vendorResults, setVendorResults] = useState({});

  const ops = partData.outsideProcessing || [];
  const partQty = parseInt(partData.quantity) || 1;
  const hiddenFromCustomer = !!partData._fsHiddenFromCustomer;
  const outboundTrucking = parseFloat(partData._fsOutboundTrucking) || 0;
  const inboundTrucking = parseFloat(partData._fsInboundTrucking) || 0;
  const truckingMarkup = partData._fsTruckingMarkup !== undefined && partData._fsTruckingMarkup !== '' ? parseFloat(partData._fsTruckingMarkup) : 30;
  const truckingCostLot = outboundTrucking + inboundTrucking;
  const truckingProfitLot = truckingCostLot * (truckingMarkup / 100);

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
    const costProfitPerPart = cost * (markup / 100);
    const vendorCostLot = (cost + expedite) * partQty;
    const vendorBilledLot = (cost + expedite + costProfitPerPart) * partQty;
    return {
      cost, expedite, markup,
      costProfitPerPart,
      vendorCostLot,
      vendorBilledLot,
      totalProfitLot: costProfitPerPart * partQty,
      billedPerPart: cost + expedite + costProfitPerPart
    };
  };

  const opsTotals = ops.reduce((acc, op) => {
    const c = calcOp(op);
    return {
      totalCostLot: acc.totalCostLot + c.vendorCostLot,
      totalBilledLot: acc.totalBilledLot + c.vendorBilledLot,
      totalProfitLot: acc.totalProfitLot + c.totalProfitLot
    };
  }, { totalCostLot: 0, totalBilledLot: 0, totalProfitLot: 0 });

  const billedPerPart = partQty > 0 ? opsTotals.totalBilledLot / partQty : opsTotals.totalBilledLot;

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

  return (
    <div style={{ marginTop: 12, padding: 10, background: hiddenFromCustomer ? '#FFEBEE' : (enabled ? '#FFF3E0' : '#fafafa'), borderRadius: 8, border: hiddenFromCustomer ? '2px solid #EF5350' : (enabled ? '1.5px solid #FFB74D' : '1px solid #e0e0e0'), gridColumn: 'span 2' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, color: hiddenFromCustomer ? '#c62828' : '#E65100' }}>
        <input type="checkbox" checked={enabled} onChange={handleEnable} />
        🏭 Outside Processing Required <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#888' }}>(internal only — not shown to customer)</span>
        {ops.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#666', fontWeight: 500 }}>
          {ops.length} op{ops.length !== 1 ? 's' : ''} • Profit: ${opsTotals.totalProfitLot.toFixed(2)}
        </span>}
      </label>

      {/* Hide from customer checkbox (Fab Service only, when allowed) */}
      {enabled && allowHideFromCustomer && (
        <div style={{ marginTop: 8, padding: 8, background: hiddenFromCustomer ? '#FFCDD2' : '#FFF8E1', borderRadius: 4, border: hiddenFromCustomer ? '1px solid #EF5350' : '1px dashed #FFB74D' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={hiddenFromCustomer}
              style={{ marginTop: 2 }}
              onChange={(e) => setPartData(prev => ({ ...prev, _fsHiddenFromCustomer: e.target.checked }))}
            />
            <div style={{ flex: 1 }}>
              <strong style={{ color: hiddenFromCustomer ? '#c62828' : '#E65100' }}>
                🔒 Hide from customer (internal cost only — Rolling Assist mode)
              </strong>
              <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 2 }}>
                Check this when you need to sub out the work but don't want the customer to see it.
                This line will show as a cost on the internal summary but be excluded from the customer-facing estimate and PDF.
                Use for rolling assist or similar hidden subcontracted work.
              </div>
            </div>
          </label>
        </div>
      )}

      {enabled && !showTrucking && (
        <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#888', fontStyle: 'italic' }}>
          Note: Transport (trucking) is configured at the order level under "🚛 Outside Processing Transport".
        </div>
      )}

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

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Service Type *</label>
              <select className="form-select" value={op.serviceType}
                onChange={(e) => updateOperation(op.id, 'serviceType', e.target.value)}>
                <option value="">— Select —</option>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Outside Vendor *</label>
              {renderVendorInput(
                op.id + '_main',
                op.vendorName,
                (v) => updateOps(ops.map(o => o.id === op.id ? { ...o, vendorId: v.id, vendorName: v.name } : o)),
                () => updateOps(ops.map(o => o.id === op.id ? { ...o, vendorId: null, vendorName: '' } : o))
              )}
            </div>

            {/* Vendor-supplies-material checkbox */}
            {op.vendorName && (
              <div style={{ marginBottom: 8, padding: 8, background: op.vendorSuppliesMaterial ? '#E8F5E9' : '#FAFAFA', borderRadius: 4, border: op.vendorSuppliesMaterial ? '1.5px solid #66BB6A' : '1px dashed #ccc' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: '0.8rem' }}>
                  <input
                    type="checkbox"
                    checked={!!op.vendorSuppliesMaterial}
                    style={{ marginTop: 2 }}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      // Update this op AND set/unset materialSource on the part
                      const newOps = ops.map(o => o.id === op.id ? { ...o, vendorSuppliesMaterial: checked } : o);
                      setPartData(prev => ({
                        ...prev,
                        outsideProcessing: newOps,
                        materialSource: checked ? 'op_vendor_mat_supplied' : 'we_order',
                        // Zero out material cost when vendor supplies it (everything is in OP cost)
                        ...(checked ? { materialUnitCost: 0, materialTotal: 0, materialMarkupPercent: 0 } : {})
                      }));
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: op.vendorSuppliesMaterial ? '#2e7d32' : '#444' }}>
                      ☑ {op.vendorName} will supply the material
                    </strong>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 2 }}>
                      Check this if the outside processing vendor will source the material themselves.
                      The material order button will skip this part, and the OP cost should include both material and labor.
                      MTRs will be requested with shipment.
                    </div>
                  </div>
                </label>
              </div>
            )}

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

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Notes (optional)</label>
              <input type="text" className="form-input" value={op.notes || ''}
                onChange={(e) => updateOperation(op.id, 'notes', e.target.value)}
                placeholder="Special instructions for vendor"
                style={{ fontSize: '0.85rem' }} />
            </div>

            <div style={{ background: '#FFF8E1', padding: 8, borderRadius: 4, fontSize: '0.75rem', color: '#666' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Vendor cost: ${calc.cost.toFixed(2)}/part × {partQty}</span>
                <span>${(calc.cost * partQty).toFixed(2)}</span>
              </div>
              {calc.expedite > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Expedite: ${calc.expedite.toFixed(2)}/part × {partQty}</span>
                  <span>${(calc.expedite * partQty).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32', fontWeight: 600 }}>
                <span>+ Profit ({op.markup}%)</span>
                <span>+${calc.totalProfitLot.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FFE082', paddingTop: 4, marginTop: 4, fontWeight: 700, color: '#E65100' }}>
                <span>Hidden in unit price</span>
                <span>${calc.billedPerPart.toFixed(2)}/part</span>
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

      {/* Trucking (lot-level, only when showTrucking prop true) */}
      {enabled && showTrucking && (
        <div style={{ marginTop: 10, padding: 10, background: 'white', borderRadius: 6, border: '1px solid #FFE0B2' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E65100', marginBottom: 8 }}>
            🚛 Trucking (lot total — not per part)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Outbound (to vendor)</label>
              <input type="number" step="any" className="form-input"
                value={partData._fsOutboundTrucking || ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPartData(prev => ({ ...prev, _fsOutboundTrucking: e.target.value }))}
                placeholder="0.00" style={{ fontSize: '0.85rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Inbound (return)</label>
              <input type="number" step="any" className="form-input"
                value={partData._fsInboundTrucking || ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPartData(prev => ({ ...prev, _fsInboundTrucking: e.target.value }))}
                placeholder="0.00" style={{ fontSize: '0.85rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Markup %</label>
              <input type="number" step="1" className="form-input"
                value={partData._fsTruckingMarkup ?? 30}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPartData(prev => ({ ...prev, _fsTruckingMarkup: e.target.value }))}
                placeholder="30" style={{ fontSize: '0.85rem' }} />
            </div>
          </div>
          {truckingCostLot > 0 && (
            <div style={{ marginTop: 8, padding: 6, background: '#FFF8E1', borderRadius: 4, fontSize: '0.75rem', color: '#666' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Trucking cost (lot):</span>
                <strong>${truckingCostLot.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32' }}>
                <span>+ Markup ({truckingMarkup}%):</span>
                <strong>+${truckingProfitLot.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FFE082', paddingTop: 4, marginTop: 4, fontWeight: 700, color: '#E65100' }}>
                <span>Billed (lot):</span>
                <span>${(truckingCostLot + truckingProfitLot).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {enabled && ops.length > 1 && (
        <div style={{ marginTop: 10, padding: 8, background: '#FFE0B2', borderRadius: 4, fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Vendor Cost (all ops):</span>
            <strong>${opsTotals.totalCostLot.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32' }}>
            <span>Total Profit:</span>
            <strong>+${opsTotals.totalProfitLot.toFixed(2)}</strong>
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

// Returns PER-PART totals. All OP costs and markups are rolled into the per-part price.
// Optionally accepts a partData object to include lot-level trucking.
export function calculateOpTotals(operations, qty = 1, partData = null) {
  const ops = operations || [];
  const partQty = parseInt(qty) || 1;
  let totalCostLot = 0;
  let totalProfitLot = 0;

  ops.forEach(op => {
    const cost = parseFloat(op.costPerPart) || 0;
    const expedite = parseFloat(op.expediteCost) || 0;
    const markup = parseFloat(op.markup) || 0;
    totalCostLot += (cost + expedite) * partQty;
    totalProfitLot += cost * (markup / 100) * partQty;
  });

  // Include trucking if partData provided
  if (partData) {
    const outbound = parseFloat(partData._fsOutboundTrucking) || 0;
    const inbound = parseFloat(partData._fsInboundTrucking) || 0;
    const truckMarkup = partData._fsTruckingMarkup !== undefined && partData._fsTruckingMarkup !== '' ? parseFloat(partData._fsTruckingMarkup) : 30;
    const truckCostLot = outbound + inbound;
    const truckProfitLot = truckCostLot * (truckMarkup / 100);
    totalCostLot += truckCostLot;
    totalProfitLot += truckProfitLot;
  }

  const totalCost = partQty > 0 ? totalCostLot / partQty : totalCostLot;
  const totalProfit = partQty > 0 ? totalProfitLot / partQty : totalProfitLot;

  return {
    totalCost,
    totalProfit,
    totalBilled: totalCost + totalProfit,
    totalCostLot,
    totalProfitLot,
    totalBilledLot: totalCostLot + totalProfitLot
  };
}

// Helper: returns true if part has any OP operations configured
export function isOutsideProcessed(partData) {
  return (partData?.outsideProcessing || []).length > 0;
}
