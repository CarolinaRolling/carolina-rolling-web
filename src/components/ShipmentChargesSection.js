import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Truck, X, Check } from 'lucide-react';
import { searchVendors } from '../services/api';

const SHOP_ADDRESS = '9152 Sonrisa St., Bellflower, CA 90706';

const emptyCharge = {
  carrierType: 'contracted',
  vendorId: null,
  vendorName: '',
  pickupLocation: '',
  pickupIsShop: false,
  dropoffLocation: '',
  dropoffIsShop: false,
  shippingCost: '',
  shippingMarkup: '0',
  materialsCost: '',
  materialsMarkup: '0',
  notes: '',
};

function calcLine(charge) {
  const sc = parseFloat(charge.shippingCost) || 0;
  const sm = parseFloat(charge.shippingMarkup) || 0;
  const mc = parseFloat(charge.materialsCost) || 0;
  const mm = parseFloat(charge.materialsMarkup) || 0;
  const shipping = sc * (1 + sm / 100);
  const materials = mc * (1 + mm / 100);
  return { shipping, materials, total: shipping + materials };
}

function fmt(n) { return '$' + (parseFloat(n) || 0).toFixed(2); }

export default function ShipmentChargesSection({ charges = [], onAdd, onUpdate, onDelete, readOnly = false }) {
  const [editModal, setEditModal] = useState(null); // null | { data, chargeId (null=new) }
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [showVendorDrop, setShowVendorDrop] = useState(false);

  useEffect(() => {
    searchVendors('').then(r => setVendors(r.data.data || [])).catch(() => {});
  }, []);

  const openAdd = () => setEditModal({ data: { ...emptyCharge }, chargeId: null });
  const openEdit = (c) => {
    setVendorSearch(c.vendor?.name || c.vendorName || '');
    setEditModal({ data: {
      carrierType: c.carrierType || 'contracted',
      vendorId: c.vendorId || null,
      vendorName: c.vendor?.name || c.vendorName || '',
      pickupLocation: c.pickupLocation || '',
      pickupIsShop: c.pickupIsShop || false,
      dropoffLocation: c.dropoffLocation || '',
      dropoffIsShop: c.dropoffIsShop || false,
      shippingCost: c.shippingCost != null ? String(c.shippingCost) : '',
      shippingMarkup: c.shippingMarkup != null ? String(c.shippingMarkup) : '0',
      materialsCost: c.materialsCost != null ? String(c.materialsCost) : '',
      materialsMarkup: c.materialsMarkup != null ? String(c.materialsMarkup) : '0',
      notes: c.notes || '',
    }, chargeId: c.id });
  };

  const set = (k, v) => setEditModal(prev => ({ ...prev, data: { ...prev.data, [k]: v } }));

  const handleSave = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const d = editModal.data;
      const payload = {
        ...d,
        shippingCost: parseFloat(d.shippingCost) || 0,
        shippingMarkup: parseFloat(d.shippingMarkup) || 0,
        materialsCost: parseFloat(d.materialsCost) || 0,
        materialsMarkup: parseFloat(d.materialsMarkup) || 0,
      };
      if (editModal.chargeId) {
        await onUpdate(editModal.chargeId, payload);
      } else {
        await onAdd(payload);
      }
      setEditModal(null);
      setVendorSearch('');
    } finally { setSaving(false); }
  };

  const handleDelete = async (chargeId) => {
    if (!window.confirm('Remove this shipment charge?')) return;
    await onDelete(chargeId);
  };

  const grandTotal = charges.reduce((sum, c) => sum + calcLine(c).total, 0);

  const f = editModal?.data;
  const preview = f ? calcLine(f) : null;

  return (
    <div className="card" style={{ marginTop: 16, border: '2px solid #7b5ea7', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: charges.length > 0 ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={18} style={{ color: '#7b5ea7' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#7b5ea7' }}>Shipping & Handling</div>
            {charges.length > 0 && <div style={{ fontSize: '0.78rem', color: '#888' }}>{charges.length} shipment{charges.length !== 1 ? 's' : ''} — Total: <strong style={{ color: '#333' }}>{fmt(grandTotal)}</strong></div>}
          </div>
        </div>
        {!readOnly && (
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#7b5ea7', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <Plus size={14} /> Add Shipment
          </button>
        )}
      </div>

      {charges.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {charges.map((c, idx) => {
            const line = calcLine(c);
            const vendorLabel = c.carrierType === 'contracted' ? (c.vendor?.name || c.vendorName || 'No vendor') : 'Our Truck';
            return (
              <div key={c.id} style={{ background: idx % 2 === 0 ? '#faf8ff' : 'white', border: '1px solid #e8e0f5', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: c.carrierType === 'our_truck' ? '#e8f5e9' : '#e3f2fd', color: c.carrierType === 'our_truck' ? '#2e7d32' : '#1565c0' }}>
                        {c.carrierType === 'our_truck' ? '🚚 Our Truck' : '📦 Contracted'}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#333' }}>{vendorLabel}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#555' }}>
                      <span style={{ color: '#888' }}>From:</span> {c.pickupIsShop ? SHOP_ADDRESS : (c.pickupLocation || '—')}
                      <span style={{ margin: '0 8px', color: '#ccc' }}>→</span>
                      <span style={{ color: '#888' }}>To:</span> {c.dropoffIsShop ? SHOP_ADDRESS : (c.dropoffLocation || '—')}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: '0.78rem', color: '#777' }}>
                      {line.shipping > 0 && <span>Shipping: <strong style={{ color: '#333' }}>{fmt(line.shipping)}</strong></span>}
                      {line.materials > 0 && <span>Materials: <strong style={{ color: '#333' }}>{fmt(line.materials)}</strong></span>}
                      <span style={{ fontWeight: 700, color: '#7b5ea7' }}>Total: {fmt(line.total)}</span>
                    </div>
                    {c.notes && <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 3, fontStyle: 'italic' }}>{c.notes}</div>}
                  </div>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => openEdit(c)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center' }}><Edit size={13} /></button>
                      <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: '1px solid #fcc', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: '#d32f2f', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ textAlign: 'right', padding: '6px 12px', fontSize: '0.88rem', fontWeight: 700, color: '#7b5ea7', borderTop: '1px solid #e8e0f5' }}>
            Shipping & Handling Total: {fmt(grandTotal)}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editModal.chargeId ? '✏️ Edit Shipment' : '+ Add Shipment'}</h3>
              <button className="btn-icon" onClick={() => setEditModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Carrier type */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Carrier Type</label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd' }}>
                  {['contracted', 'our_truck'].map(type => (
                    <button key={type} onClick={() => set('carrierType', type)}
                      style={{ flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        background: f.carrierType === type ? '#7b5ea7' : 'white',
                        color: f.carrierType === type ? 'white' : '#555' }}>
                      {type === 'contracted' ? '📦 Contracted' : '🚚 Our Truck'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vendor — only for contracted */}
              {f.carrierType === 'contracted' && (
                <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                  <label className="form-label">Vendor (Carrier)</label>
                  <input className="form-input" value={vendorSearch}
                    onChange={async (e) => {
                      setVendorSearch(e.target.value);
                      set('vendorName', e.target.value);
                      set('vendorId', null);
                      if (e.target.value.length >= 1) {
                        try { const r = await searchVendors(e.target.value); setVendorSuggestions(r.data.data || []); setShowVendorDrop(true); }
                        catch { setVendorSuggestions([]); }
                      } else {
                        try { const r = await searchVendors(''); setVendorSuggestions(r.data.data || []); setShowVendorDrop(true); }
                        catch { setVendorSuggestions([]); }
                      }
                    }}
                    onFocus={async () => {
                      try { const r = await searchVendors(''); setVendorSuggestions(r.data.data || []); setShowVendorDrop(true); }
                      catch {}
                    }}
                    onBlur={() => setTimeout(() => setShowVendorDrop(false), 200)}
                    placeholder="Search vendors (UPS, FedEx, trucking company...)"
                    autoComplete="off"
                  />
                  {showVendorDrop && vendorSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                      {vendorSuggestions.map(v => (
                        <div key={v.id} onMouseDown={() => { set('vendorId', v.id); set('vendorName', v.name); setVendorSearch(v.name); setShowVendorDrop(false); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                          {v.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {f.vendorId && <div style={{ fontSize: '0.72rem', color: '#2e7d32', marginTop: 3 }}>✓ Linked to vendor record</div>}
                </div>
              )}

              {/* Pickup */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  Pickup Location
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 400, color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.pickupIsShop} onChange={e => { set('pickupIsShop', e.target.checked); if (e.target.checked) set('pickupLocation', SHOP_ADDRESS); }} />
                    Our shop
                  </label>
                </label>
                <input className="form-input" value={f.pickupIsShop ? SHOP_ADDRESS : f.pickupLocation} onChange={e => set('pickupLocation', e.target.value)} disabled={f.pickupIsShop} placeholder="Street, City, State ZIP" />
              </div>

              {/* Dropoff */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  Dropoff / Destination
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 400, color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.dropoffIsShop} onChange={e => { set('dropoffIsShop', e.target.checked); if (e.target.checked) set('dropoffLocation', SHOP_ADDRESS); }} />
                    Our shop
                  </label>
                </label>
                <input className="form-input" value={f.dropoffIsShop ? SHOP_ADDRESS : f.dropoffLocation} onChange={e => set('dropoffLocation', e.target.value)} disabled={f.dropoffIsShop} placeholder="Street, City, State ZIP" />
              </div>

              {/* Shipping cost */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Shipping Cost (our cost)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={f.shippingCost} onChange={e => set('shippingCost', e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Markup %</label>
                  <input className="form-input" type="number" step="1" min="0" value={f.shippingMarkup} onChange={e => set('shippingMarkup', e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* Materials cost */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Shipping Materials (box, pallet…)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={f.materialsCost} onChange={e => set('materialsCost', e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Markup %</label>
                  <input className="form-input" type="number" step="1" min="0" value={f.materialsMarkup} onChange={e => set('materialsMarkup', e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* Notes */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Box size, pallet count, special handling…" />
              </div>

              {/* Live total preview */}
              {preview && (preview.shipping > 0 || preview.materials > 0) && (
                <div style={{ background: '#f3f0ff', border: '1px solid #d4c8f5', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  {preview.shipping > 0 && <span>Shipping: <strong>{fmt(preview.shipping)}</strong></span>}
                  {preview.materials > 0 && <span>Materials: <strong>{fmt(preview.materials)}</strong></span>}
                  <span style={{ fontWeight: 700, color: '#7b5ea7' }}>Line Total: {fmt(preview.total)}</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: '#7b5ea7', borderColor: '#7b5ea7' }} disabled={saving} onClick={handleSave}>
                {saving ? '⏳ Saving...' : <><Check size={15} /> {editModal.chargeId ? 'Save Changes' : 'Add Shipment'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
