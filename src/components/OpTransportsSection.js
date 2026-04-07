import React, { useState } from 'react';
import { Plus, Trash2, X, Edit2 } from 'lucide-react';
import { searchVendors, createVendor } from '../services/api';

const genId = () => Math.random().toString(36).slice(2, 11);

const emptyTrip = () => ({
  id: genId(),
  leg: 'Outbound',           // Outbound | Inbound
  truckingVendorId: null,
  truckingVendorName: '',
  cost: '',
  markup: 20,
  allocationMode: 'manual',  // manual | by_value | by_qty
  partIds: [],               // for manual mode
  notes: '',
  poNumber: null,
  poSentAt: null
});

/**
 * Calculate per-part transport allocations from a list of trips and the order's parts.
 * Returns { partTransports: { [partId]: { cost, billed, profit, trips: [...] } } }
 *
 * Allocation modes:
 * - manual: split among checked partIds
 * - by_value: spread by part dollar value (partTotal)
 * - by_qty: spread evenly by part qty
 */
export function calculateTransportAllocations(trips, parts) {
  const partTransports = {};
  // Initialize per-part bucket
  (parts || []).forEach(p => {
    partTransports[p.id] = { cost: 0, billed: 0, profit: 0, trips: [] };
  });

  (trips || []).forEach(trip => {
    const cost = parseFloat(trip.cost) || 0;
    const markup = parseFloat(trip.markup) || 0;
    const billed = cost * (1 + markup / 100);
    const profit = billed - cost;
    if (cost <= 0) return;

    let targetPartIds = [];
    if (trip.allocationMode === 'manual') {
      targetPartIds = (trip.partIds || []).filter(id => partTransports[id]);
    } else {
      targetPartIds = (parts || []).map(p => p.id);
    }

    if (targetPartIds.length === 0) return;

    // Compute weights
    const weights = {};
    let totalWeight = 0;
    targetPartIds.forEach(pid => {
      const p = (parts || []).find(x => x.id === pid);
      if (!p) { weights[pid] = 0; return; }
      let w = 0;
      if (trip.allocationMode === 'by_value') {
        w = parseFloat(p.partTotal) || 0;
      } else if (trip.allocationMode === 'by_qty') {
        w = parseInt(p.quantity) || 1;
      } else {
        // manual: equal split
        w = 1;
      }
      weights[pid] = w;
      totalWeight += w;
    });

    if (totalWeight === 0) {
      // Fallback: equal split
      targetPartIds.forEach(pid => { weights[pid] = 1; });
      totalWeight = targetPartIds.length;
    }

    targetPartIds.forEach(pid => {
      const share = weights[pid] / totalWeight;
      const partCost = cost * share;
      const partBilled = billed * share;
      const partProfit = profit * share;
      partTransports[pid].cost += partCost;
      partTransports[pid].billed += partBilled;
      partTransports[pid].profit += partProfit;
      partTransports[pid].trips.push({
        tripId: trip.id,
        leg: trip.leg,
        truckingVendorName: trip.truckingVendorName,
        cost: partCost,
        billed: partBilled,
        profit: partProfit
      });
    });
  });

  return { partTransports };
}

export default function OpTransportsSection({ trips, onChange, parts, onGeneratePO, isWorkOrder }) {
  const [editingTrip, setEditingTrip] = useState(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorResults, setVendorResults] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const tripsList = trips || [];
  const opParts = (parts || []).filter(p => (p.outsideProcessing || []).length > 0);

  const updateTrips = (newTrips) => onChange(newTrips);

  const addTrip = () => {
    const newTrip = emptyTrip();
    setEditingTrip(newTrip);
    setShowAdd(true);
  };

  const saveTrip = (trip) => {
    const exists = tripsList.find(t => t.id === trip.id);
    if (exists) {
      updateTrips(tripsList.map(t => t.id === trip.id ? trip : t));
    } else {
      updateTrips([...tripsList, trip]);
    }
    setEditingTrip(null);
    setShowAdd(false);
  };

  const deleteTrip = (id) => {
    if (!window.confirm('Delete this transport trip?')) return;
    updateTrips(tripsList.filter(t => t.id !== id));
  };

  const handleVendorSearch = async (query) => {
    setVendorSearch(query);
    if (query.length >= 2) {
      try {
        const res = await searchVendors(query);
        setVendorResults(res.data.data || []);
      } catch {
        setVendorResults([]);
      }
    } else {
      setVendorResults([]);
    }
  };

  const allocations = calculateTransportAllocations(tripsList, parts || []);

  const totalCost = tripsList.reduce((sum, t) => sum + (parseFloat(t.cost) || 0), 0);
  const totalBilled = tripsList.reduce((sum, t) => {
    const c = parseFloat(t.cost) || 0;
    const m = parseFloat(t.markup) || 0;
    return sum + (c * (1 + m / 100));
  }, 0);
  const totalProfit = totalBilled - totalCost;

  return (
    <div style={{ marginTop: 16, padding: 12, background: '#FAFAFA', borderRadius: 8, border: '1px solid #ddd' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <strong style={{ color: '#555' }}>🚛 Outside Processing Transport</strong>
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#888' }}>(internal — split across parts, hidden in unit price)</span>
        </div>
        <button type="button" onClick={addTrip}
          style={{ background: '#E65100', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={14} /> Add Transport Trip
        </button>
      </div>

      {tripsList.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
          No transport trips configured.
        </div>
      ) : (
        <div>
          {tripsList.map(trip => {
            const cost = parseFloat(trip.cost) || 0;
            const markup = parseFloat(trip.markup) || 0;
            const billed = cost * (1 + markup / 100);
            const profit = billed - cost;
            const allocCount = trip.allocationMode === 'manual' ? (trip.partIds || []).length : opParts.length;
            return (
              <div key={trip.id} style={{ marginBottom: 8, padding: 10, background: 'white', borderRadius: 6, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem' }}>
                      <span style={{ background: trip.leg === 'Outbound' ? '#1976d2' : '#7b1fa2', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, marginRight: 6 }}>{trip.leg}</span>
                      <strong>{trip.truckingVendorName || '(no trucking vendor)'}</strong>
                      {trip.poNumber && <span style={{ marginLeft: 6, padding: '1px 6px', background: '#2e7d32', color: 'white', borderRadius: 3, fontSize: '0.7rem' }}>✓ {trip.poNumber}</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>
                      Cost: ${cost.toFixed(2)} + {markup}% = <strong style={{ color: '#E65100' }}>${billed.toFixed(2)}</strong>
                      <span style={{ marginLeft: 8, color: '#2e7d32' }}>profit ${profit.toFixed(2)}</span>
                      <span style={{ marginLeft: 8 }}>• {trip.allocationMode === 'manual' ? `Manual (${allocCount} parts)` : trip.allocationMode === 'by_value' ? 'Auto by value' : 'Auto by qty'}</span>
                    </div>
                    {trip.notes && <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2, fontStyle: 'italic' }}>{trip.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {isWorkOrder && !trip.poNumber && trip.truckingVendorId && (
                      <button onClick={() => onGeneratePO && onGeneratePO(trip)}
                        style={{ background: '#E65100', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>
                        🖨 Trucking PO
                      </button>
                    )}
                    <button onClick={() => { setEditingTrip(trip); setShowAdd(true); }}
                      style={{ background: 'none', border: '1px solid #ddd', borderRadius: 3, padding: 4, cursor: 'pointer', color: '#1976d2' }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => deleteTrip(trip.id)}
                      style={{ background: 'none', border: '1px solid #ddd', borderRadius: 3, padding: 4, cursor: 'pointer', color: '#d32f2f' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 8, background: '#FFF3E0', borderRadius: 4, fontSize: '0.85rem', marginTop: 8 }}>
            <span><strong>Total:</strong></span>
            <span>
              Cost: <strong>${totalCost.toFixed(2)}</strong>
              {' • '}
              Profit: <strong style={{ color: '#2e7d32' }}>${totalProfit.toFixed(2)}</strong>
              {' • '}
              Billed: <strong style={{ color: '#E65100' }}>${totalBilled.toFixed(2)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && editingTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setShowAdd(false); setEditingTrip(null); }}>
          <div style={{ background: 'white', borderRadius: 8, padding: 20, maxWidth: 600, width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#E65100' }}>🚛 Transport Trip</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Leg *</label>
                <select className="form-select" value={editingTrip.leg}
                  onChange={(e) => setEditingTrip({ ...editingTrip, leg: e.target.value })}>
                  <option value="Outbound">Outbound (to vendor)</option>
                  <option value="Inbound">Inbound (from vendor)</option>
                </select>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Trucking Vendor *</label>
                {editingTrip.truckingVendorName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#e8f5e9', borderRadius: 4, border: '1px solid #a5d6a7' }}>
                    <strong>{editingTrip.truckingVendorName}</strong>
                    <button type="button" onClick={() => setEditingTrip({ ...editingTrip, truckingVendorId: null, truckingVendorName: '' })}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f' }}><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <input type="text" className="form-input" placeholder="Search vendor..."
                      value={vendorSearch}
                      onChange={(e) => handleVendorSearch(e.target.value)} />
                    {vendorResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 150, overflow: 'auto', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                        {vendorResults.map(v => (
                          <div key={v.id} onClick={() => {
                            setEditingTrip({ ...editingTrip, truckingVendorId: v.id, truckingVendorName: v.name });
                            setVendorSearch('');
                            setVendorResults([]);
                          }}
                            style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                            <strong>{v.name}</strong>
                          </div>
                        ))}
                        {vendorSearch.length >= 2 && (
                          <div onClick={async () => {
                            try {
                              const res = await createVendor({ name: vendorSearch });
                              if (res.data.data) {
                                setEditingTrip({ ...editingTrip, truckingVendorId: res.data.data.id, truckingVendorName: res.data.data.name });
                                setVendorSearch('');
                                setVendorResults([]);
                              }
                            } catch {}
                          }} style={{ padding: 8, cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600, fontSize: '0.85rem' }}>
                            + Add "{vendorSearch}" as new vendor
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Lot Cost *</label>
                <input type="number" step="0.01" className="form-input" value={editingTrip.cost}
                  onChange={(e) => setEditingTrip({ ...editingTrip, cost: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Markup %</label>
                <input type="number" step="1" className="form-input" value={editingTrip.markup}
                  onChange={(e) => setEditingTrip({ ...editingTrip, markup: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="20" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Allocation Mode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { k: 'manual', l: 'Manual (pick parts)' },
                  { k: 'by_value', l: 'Auto: spread by part value' },
                  { k: 'by_qty', l: 'Auto: spread by qty' }
                ].map(o => (
                  <button key={o.k} type="button"
                    onClick={() => setEditingTrip({ ...editingTrip, allocationMode: o.k })}
                    style={{
                      padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem',
                      border: editingTrip.allocationMode === o.k ? '2px solid #E65100' : '1px solid #ccc',
                      background: editingTrip.allocationMode === o.k ? '#FFF3E0' : 'white',
                      color: editingTrip.allocationMode === o.k ? '#E65100' : '#666',
                      fontWeight: editingTrip.allocationMode === o.k ? 700 : 400
                    }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {editingTrip.allocationMode === 'manual' && (
              <div className="form-group">
                <label className="form-label">Apply to Parts ({(editingTrip.partIds || []).length} selected)</label>
                <div style={{ marginBottom: 6, display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setEditingTrip({ ...editingTrip, partIds: opParts.map(p => p.id) })}
                    style={{ background: 'none', border: '1px solid #ccc', borderRadius: 3, padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>Select All</button>
                  <button type="button" onClick={() => setEditingTrip({ ...editingTrip, partIds: [] })}
                    style={{ background: 'none', border: '1px solid #ccc', borderRadius: 3, padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>Clear</button>
                </div>
                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ddd', borderRadius: 4, padding: 4 }}>
                  {opParts.length === 0 ? (
                    <div style={{ padding: 8, color: '#999', fontSize: '0.85rem' }}>
                      No parts have outside processing configured. Add OP to parts first.
                    </div>
                  ) : opParts.map(part => {
                    const checked = (editingTrip.partIds || []).includes(part.id);
                    const ops = part.outsideProcessing || [];
                    return (
                      <label key={part.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: 6, marginBottom: 4,
                        background: checked ? '#FFF3E0' : '#fafafa', borderRadius: 4, cursor: 'pointer',
                        border: checked ? '1px solid #E65100' : '1px solid transparent'
                      }}>
                        <input type="checkbox" checked={checked}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...(editingTrip.partIds || []), part.id]
                              : (editingTrip.partIds || []).filter(id => id !== part.id);
                            setEditingTrip({ ...editingTrip, partIds: newIds });
                          }} />
                        <div style={{ flex: 1, fontSize: '0.85rem' }}>
                          <strong>#{part.partNumber}</strong> {part.clientPartNumber && <span style={{ color: '#1976d2' }}>{part.clientPartNumber}</span>}
                          <span style={{ color: '#666' }}> • Qty {part.quantity}</span>
                          <span style={{ color: '#888', fontSize: '0.75rem' }}> • {ops.map(o => `${o.serviceType} @ ${o.vendorName}`).join(', ')}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" rows={2} value={editingTrip.notes || ''}
                onChange={(e) => setEditingTrip({ ...editingTrip, notes: e.target.value })}
                placeholder="Optional notes about this trip" />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAdd(false); setEditingTrip(null); }} className="btn btn-secondary">Cancel</button>
              <button onClick={() => saveTrip(editingTrip)}
                disabled={!editingTrip.truckingVendorId || !editingTrip.cost}
                className="btn"
                style={{ background: '#E65100', color: 'white' }}>
                Save Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
