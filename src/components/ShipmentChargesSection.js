import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Edit, Trash2, Truck, X, Check } from 'lucide-react';
import { searchVendors } from '../services/api';

const SHOP_ADDRESS = '9152 Sonrisa St., Bellflower, CA 90706';
const PLACES_KEY = process.env.REACT_APP_GOOGLE_PLACES_KEY;

// Load Google Places script once
function loadPlacesScript() {
  if (!PLACES_KEY) return;
  if (window.google?.maps?.places) return;
  if (document.getElementById('google-places-script')) return;
  const s = document.createElement('script');
  s.id = 'google-places-script';
  s.src = `https://maps.googleapis.com/maps/api/js?key=${PLACES_KEY}&libraries=places`;
  s.async = true;
  document.head.appendChild(s);
}

// Address input with Google Places autocomplete
function AddressInput({ value, onChange, disabled, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const sessionTokenRef = useRef(null);

  useEffect(() => { loadPlacesScript(); }, []);

  const fetchSuggestions = useCallback((text) => {
    if (!text || text.length < 3 || disabled || !window.google?.maps?.places) {
      setSuggestions([]); return;
    }
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
    const svc = new window.google.maps.places.AutocompleteService();
    svc.getPlacePredictions(
      { input: text, sessionToken: sessionTokenRef.current, types: ['address'], componentRestrictions: { country: 'us' } },
      (preds, status) => {
        if (status === 'OK' && preds) { setSuggestions(preds); setShowDrop(true); }
        else setSuggestions([]);
      }
    );
  }, [disabled]);

  const pick = (desc) => {
    sessionTokenRef.current = null;
    onChange(desc);
    setSuggestions([]);
    setShowDrop(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input className="form-input"
        value={value} disabled={disabled}
        placeholder={placeholder || 'Start typing an address...'}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); fetchSuggestions(e.target.value); }}
        onBlur={() => setTimeout(() => setShowDrop(false), 200)}
      />
      {showDrop && suggestions.length > 0 && !disabled && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, background: 'white', border: '1px solid #ddd', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 220, overflowY: 'auto' }}>
          {suggestions.map((s, i) => (
            <div key={s.place_id} onMouseDown={() => pick(s.description)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none', fontSize: '0.85rem' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f0ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}>
              <div style={{ fontWeight: 500, color: '#333' }}>{s.structured_formatting?.main_text || s.description}</div>
              {s.structured_formatting?.secondary_text && <div style={{ fontSize: '0.73rem', color: '#888' }}>{s.structured_formatting.secondary_text}</div>}
            </div>
          ))}
          <div style={{ padding: '4px 10px', textAlign: 'right', borderTop: '1px solid #f0f0f0' }}>
            <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" style={{ height: 13, opacity: 0.6 }} />
          </div>
        </div>
      )}
    </div>
  );
}

const emptyCharge = { carrierType: 'contracted', vendorId: null, vendorName: '', pickupLocation: '', pickupIsShop: false, dropoffLocation: '', dropoffIsShop: false, shippingCost: '', shippingMarkup: '0', materialsCost: '', materialsMarkup: '0', notes: '' };

function calcLine(c) {
  const s = (parseFloat(c.shippingCost) || 0) * (1 + (parseFloat(c.shippingMarkup) || 0) / 100);
  const m = (parseFloat(c.materialsCost) || 0) * (1 + (parseFloat(c.materialsMarkup) || 0) / 100);
  return { shipping: s, materials: m, total: s + m };
}
const fmt = n => '$' + (parseFloat(n) || 0).toFixed(2);

export default function ShipmentChargesSection({ charges = [], onAdd, onUpdate, onDelete, readOnly = false }) {
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [showVendorDrop, setShowVendorDrop] = useState(false);

  const openAdd = () => { setVendorSearch(''); setEditModal({ data: { ...emptyCharge }, chargeId: null }); };
  const openEdit = c => {
    setVendorSearch(c.vendor?.name || c.vendorName || '');
    setEditModal({ chargeId: c.id, data: { carrierType: c.carrierType || 'contracted', vendorId: c.vendorId || null, vendorName: c.vendor?.name || c.vendorName || '', pickupLocation: c.pickupLocation || '', pickupIsShop: !!c.pickupIsShop, dropoffLocation: c.dropoffLocation || '', dropoffIsShop: !!c.dropoffIsShop, shippingCost: c.shippingCost != null ? String(c.shippingCost) : '', shippingMarkup: c.shippingMarkup != null ? String(c.shippingMarkup) : '0', materialsCost: c.materialsCost != null ? String(c.materialsCost) : '', materialsMarkup: c.materialsMarkup != null ? String(c.materialsMarkup) : '0', notes: c.notes || '' } });
  };
  const set = (k, v) => setEditModal(p => ({ ...p, data: { ...p.data, [k]: v } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const d = editModal.data;
      const payload = { ...d, shippingCost: parseFloat(d.shippingCost) || 0, shippingMarkup: parseFloat(d.shippingMarkup) || 0, materialsCost: parseFloat(d.materialsCost) || 0, materialsMarkup: parseFloat(d.materialsMarkup) || 0 };
      editModal.chargeId ? await onUpdate(editModal.chargeId, payload) : await onAdd(payload);
      setEditModal(null); setVendorSearch('');
    } finally { setSaving(false); }
  };

  const grandTotal = charges.reduce((s, c) => s + calcLine(c).total, 0);
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
        {!readOnly && <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#7b5ea7', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}><Plus size={14} /> Add Shipment</button>}
      </div>

      {charges.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {charges.map((c, idx) => {
            const line = calcLine(c);
            return (
              <div key={c.id} style={{ background: idx % 2 === 0 ? '#faf8ff' : 'white', border: '1px solid #e8e0f5', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: c.carrierType === 'our_truck' ? '#e8f5e9' : '#e3f2fd', color: c.carrierType === 'our_truck' ? '#2e7d32' : '#1565c0' }}>{c.carrierType === 'our_truck' ? '🚚 Our Truck' : '📦 Contracted'}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#333' }}>{c.carrierType === 'contracted' ? (c.vendor?.name || c.vendorName || 'No vendor') : 'Our Truck'}</span>
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
                      <button onClick={() => { if (window.confirm('Remove this shipment charge?')) onDelete(c.id); }} style={{ background: 'none', border: '1px solid #fcc', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: '#d32f2f', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
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

      {editModal && f && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editModal.chargeId ? '✏️ Edit Shipment' : '+ Add Shipment'}</h3>
              <button className="btn-icon" onClick={() => setEditModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Carrier Type</label>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd' }}>
                  {['contracted', 'our_truck'].map(type => (
                    <button key={type} onClick={() => set('carrierType', type)}
                      style={{ flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: f.carrierType === type ? '#7b5ea7' : 'white', color: f.carrierType === type ? 'white' : '#555' }}>
                      {type === 'contracted' ? '📦 Contracted' : '🚚 Our Truck'}
                    </button>
                  ))}
                </div>
              </div>

              {f.carrierType === 'contracted' && (
                <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                  <label className="form-label">Vendor (Carrier)</label>
                  <input className="form-input" value={vendorSearch} autoComplete="off"
                    onChange={async e => { setVendorSearch(e.target.value); set('vendorName', e.target.value); set('vendorId', null); try { const r = await searchVendors(e.target.value); setVendorSuggestions(r.data.data || []); setShowVendorDrop(true); } catch { setVendorSuggestions([]); } }}
                    onFocus={async () => { try { const r = await searchVendors(''); setVendorSuggestions(r.data.data || []); setShowVendorDrop(true); } catch {} }}
                    onBlur={() => setTimeout(() => setShowVendorDrop(false), 200)}
                    placeholder="Search vendors (UPS, FedEx, trucking company...)" />
                  {showVendorDrop && vendorSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                      {vendorSuggestions.map(v => (
                        <div key={v.id} onMouseDown={() => { set('vendorId', v.id); set('vendorName', v.name); setVendorSearch(v.name); setShowVendorDrop(false); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f5f0ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}>{v.name}</div>
                      ))}
                    </div>
                  )}
                  {f.vendorId && <div style={{ fontSize: '0.72rem', color: '#2e7d32', marginTop: 3 }}>✓ Linked to vendor record</div>}
                </div>
              )}

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  Pickup Location
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 400, color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.pickupIsShop} onChange={e => { set('pickupIsShop', e.target.checked); if (e.target.checked) set('pickupLocation', SHOP_ADDRESS); else set('pickupLocation', ''); }} />
                    Our shop
                  </label>
                </label>
                <AddressInput value={f.pickupIsShop ? SHOP_ADDRESS : f.pickupLocation} onChange={v => set('pickupLocation', v)} disabled={f.pickupIsShop} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  Dropoff / Destination
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 400, color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.dropoffIsShop} onChange={e => { set('dropoffIsShop', e.target.checked); if (e.target.checked) set('dropoffLocation', SHOP_ADDRESS); else set('dropoffLocation', ''); }} />
                    Our shop
                  </label>
                </label>
                <AddressInput value={f.dropoffIsShop ? SHOP_ADDRESS : f.dropoffLocation} onChange={v => set('dropoffLocation', v)} disabled={f.dropoffIsShop} />
              </div>

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

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Box size, pallet count, special handling…" />
              </div>

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
                {saving ? '⏳ Saving...' : <><Check size={15} style={{ marginRight: 5 }} />{editModal.chargeId ? 'Save Changes' : 'Add Shipment'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
