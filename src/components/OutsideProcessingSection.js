import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { searchVendors, createVendor } from '../services/api';

const SERVICE_TYPES = [
  'Welding', 'Beveling', 'Plating', 'Painting', 'Galvanizing',
  'Heat Treating', 'Hot Rolling', 'Machining', 'Cutting',
  'Sandblasting', 'Pickling & Passivation', 'Other'
];

const genId = () => Math.random().toString(36).slice(2, 11);

export default function OutsideProcessingSection({ partData, setPartData }) {
  const [enabled, setEnabled] = useState((partData.outsideProcessing || []).length > 0);
  const [vendorSearches, setVendorSearches] = useState({});
  const [vendorResults, setVendorResults] = useState({});

  const ops = partData.outsideProcessing || [];

  const updateOps = (newOps) => {
    setPartData(prev => ({ ...prev, outsideProcessing: newOps }));
  };

  const handleEnable = (e) => {
    const checked = e.target.checked;
    setEnabled(checked);
    if (checked && ops.length === 0) {
      updateOps([{
        id: genId(), serviceType: '', vendorId: null, vendorName: '',
        costPerPart: '', transportCost: '', transportMarkup: 20,
        markup: 20, expediteCost: '', notes: ''
      }]);
    }
    if (!checked) updateOps([]);
  };

  const addOperation = () => {
    updateOps([...ops, {
      id: genId(), serviceType: '', vendorId: null, vendorName: '',
      costPerPart: '', transportCost: '', transportMarkup: 20,
      markup: 20, expediteCost: '', notes: ''
    }]);
  };

  const removeOperation = (opId) => {
    const newOps = ops.filter(o => o.id !== opId);
    updateOps(newOps);
    if (newOps.length === 0) setEnabled(false);
  };

  const updateOperation = (opId, field, value) => {
    updateOps(ops.map(o => o.id === opId ? { ...o, [field]: value } : o));
  };

  const handleVendorSearch = async (opId, query) => {
    setVendorSearches(prev => ({ ...prev, [opId]: query }));
    if (query.length >= 2) {
      try {
        const res = await searchVendors(query);
        setVendorResults(prev => ({ ...prev, [opId]: res.data.data || [] }));
      } catch {
        setVendorResults(prev => ({ ...prev, [opId]: [] }));
      }
    } else {
      setVendorResults(prev => ({ ...prev, [opId]: [] }));
    }
  };

  const selectVendor = (opId, vendor) => {
    updateOps(ops.map(o => o.id === opId ? { ...o, vendorId: vendor.id, vendorName: vendor.name } : o));
    setVendorSearches(prev => ({ ...prev, [opId]: '' }));
    setVendorResults(prev => ({ ...prev, [opId]: [] }));
  };

  const clearVendor = (opId) => {
    updateOps(ops.map(o => o.id === opId ? { ...o, vendorId: null, vendorName: '' } : o));
  };

  const calcOp = (op) => {
    const cost = parseFloat(op.costPerPart) || 0;
    const transport = parseFloat(op.transportCost) || 0;
    const expedite = parseFloat(op.expediteCost) || 0;
    const markup = parseFloat(op.markup) || 0;
    const transMarkup = parseFloat(op.transportMarkup) || 0;
    const subtotal = cost + transport + expedite;
    const profit = (cost * markup / 100) + (transport * transMarkup / 100);
    return { cost, transport, expedite, subtotal, totalProfit: profit, billed: subtotal + profit };
  };

  const totalOpProfit = ops.reduce((sum, op) => sum + calcOp(op).totalProfit, 0);
  const totalOpCost = ops.reduce((sum, op) => sum + calcOp(op).subtotal, 0);
  const totalOpBilled = ops.reduce((sum, op) => sum + calcOp(op).billed, 0);

  return (
    <div style={{ marginTop: 12, padding: 10, background: enabled ? '#FFF3E0' : '#fafafa', borderRadius: 8, border: enabled ? '1.5px solid #FFB74D' : '1px solid #e0e0e0' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, color: '#E65100' }}>
        <input type="checkbox" checked={enabled} onChange={handleEnable} />
        🏭 Outside Processing Required
        {ops.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#666', fontWeight: 500 }}>
          {ops.length} operation{ops.length !== 1 ? 's' : ''} • Profit: ${totalOpProfit.toFixed(2)}/ea
        </span>}
      </label>

      {enabled && ops.map((op, idx) => {
        const calc = calcOp(op);
        const searchVal = vendorSearches[op.id] || '';
        const results = vendorResults[op.id] || [];
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

            <div className="form-group" style={{ marginBottom: 8, position: 'relative' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Vendor *</label>
              {op.vendorName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#e8f5e9', borderRadius: 4, border: '1px solid #a5d6a7', fontSize: '0.85rem' }}>
                  <strong>{op.vendorName}</strong>
                  <button type="button" onClick={() => clearVendor(op.id)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <input type="text" className="form-input" placeholder="Search vendor..."
                    value={searchVal}
                    onChange={(e) => handleVendorSearch(op.id, e.target.value)} />
                  {results.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 150, overflow: 'auto', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      {results.map(v => (
                        <div key={v.id} onClick={() => selectVendor(op.id, v)}
                          style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                          <strong>{v.name}</strong>
                          {v.contactName && <span style={{ color: '#666', marginLeft: 6, fontSize: '0.75rem' }}>{v.contactName}</span>}
                        </div>
                      ))}
                      {searchVal.length >= 2 && (
                        <div onClick={async () => {
                          try {
                            const res = await createVendor({ name: searchVal });
                            if (res.data.data) selectVendor(op.id, res.data.data);
                          } catch {}
                        }} style={{ padding: 8, cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600, fontSize: '0.85rem' }}>
                          + Add "{searchVal}" as new vendor
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
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
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Transport</label>
                <input type="number" step="0.01" className="form-input" value={op.transportCost}
                  onChange={(e) => updateOperation(op.id, 'transportCost', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00" style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Trans Markup %</label>
                <input type="number" step="1" className="form-input" value={op.transportMarkup}
                  onChange={(e) => updateOperation(op.id, 'transportMarkup', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="20" style={{ fontSize: '0.85rem' }} />
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
                <span>Cost: ${calc.cost.toFixed(2)}{calc.transport > 0 && ` + Transport: $${calc.transport.toFixed(2)}`}</span>
                <span>${calc.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32', fontWeight: 600 }}>
                <span>+ Profit ({op.markup}% cost{calc.transport > 0 && ` + ${op.transportMarkup}% transport`})</span>
                <span>+${calc.totalProfit.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FFE082', paddingTop: 4, marginTop: 4, fontWeight: 700, color: '#E65100' }}>
                <span>Billed to Customer (per part)</span>
                <span>${calc.billed.toFixed(2)}</span>
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

      {enabled && ops.length > 1 && (
        <div style={{ marginTop: 10, padding: 8, background: '#FFE0B2', borderRadius: 4, fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Vendor Cost (per part):</span>
            <strong>${totalOpCost.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32' }}>
            <span>Total Profit (added to labor):</span>
            <strong>+${totalOpProfit.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FFB74D', paddingTop: 4, marginTop: 4, fontWeight: 700, color: '#E65100' }}>
            <span>Total OP Cost to Customer (per part):</span>
            <span>${totalOpBilled.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper exported for use in other components
export function calculateOpTotals(operations) {
  const ops = operations || [];
  let totalCost = 0;
  let totalProfit = 0;
  let totalBilled = 0;
  ops.forEach(op => {
    const cost = parseFloat(op.costPerPart) || 0;
    const transport = parseFloat(op.transportCost) || 0;
    const expedite = parseFloat(op.expediteCost) || 0;
    const markup = parseFloat(op.markup) || 0;
    const transMarkup = parseFloat(op.transportMarkup) || 0;
    const subtotal = cost + transport + expedite;
    const profit = (cost * markup / 100) + (transport * transMarkup / 100);
    totalCost += subtotal;
    totalProfit += profit;
    totalBilled += subtotal + profit;
  });
  return { totalCost, totalProfit, totalBilled };
}
