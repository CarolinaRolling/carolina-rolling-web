import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { searchClients, createRefund } from '../services/api';

const METHODS = [
  { key: 'check', label: 'Check' },
  { key: 'cash', label: 'Cash' },
  { key: 'ach', label: 'ACH / Wire' },
  { key: 'credit_card', label: 'Card Reversal' },
  { key: 'other', label: 'Other' },
];

export default function RefundModal({ onClose, onSaved, initialClient }) {
  const [clientSearch, setClientSearch] = useState(initialClient?.name || '');
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [selectedClient, setSelectedClient] = useState(initialClient || null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('check');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!selectedClient) { setError('Select a client'); return; }
    if (!parseFloat(amount) || parseFloat(amount) <= 0) { setError('Enter an amount'); return; }
    if (!reason.trim()) { setError('Reason is required for refunds'); return; }
    setSaving(true); setError('');
    try {
      await createRefund({ clientId: selectedClient.id, clientName: selectedClient.name, date, amount: parseFloat(amount), method, reference, reason });
      onSaved?.();
      onClose();
    } catch(e) { setError(e.response?.data?.error?.message || e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#b71c1c', color: 'white', borderRadius: '8px 8px 0 0' }}>
          <h3 className="modal-title" style={{ color: 'white' }}>↩ Record Refund</h3>
          <button className="btn-icon" onClick={onClose} style={{ color: 'white' }}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#ffebee', borderRadius: 6, padding: '8px 12px', color: '#c62828', fontSize: '0.85rem' }}>{error}</div>}
          <div style={{ background: '#ffebee', borderRadius: 6, padding: '10px 14px', fontSize: '0.82rem', color: '#b71c1c' }}>
            A refund records money going back to the client. This reduces your revenue. For credits staying on account, use Credit Memo instead.
          </div>
          <div className="form-group" style={{ margin: 0, position: 'relative' }}>
            <label className="form-label">Client</label>
            <input className="form-input" value={clientSearch} autoComplete="off"
              onChange={async e => { setClientSearch(e.target.value); try { const r = await searchClients(e.target.value); setClientSuggestions(r.data.data||[]); setShowDrop(true); } catch {} }}
              onFocus={async () => { try { const r = await searchClients(''); setClientSuggestions(r.data.data||[]); setShowDrop(true); } catch {} }}
              onBlur={() => setTimeout(() => setShowDrop(false), 200)}
              placeholder="Search client..." />
            {showDrop && clientSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {clientSuggestions.map(c => (
                  <div key={c.id} onMouseDown={() => { setSelectedClient(c); setClientSearch(c.name); setShowDrop(false); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ffebee'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>{c.name}</div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Refund Amount</label>
              <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Refund Method</label>
            <select className="form-select" value={method} onChange={e => setMethod(e.target.value)}>
              {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Reference</label>
            <input className="form-input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Check number, confirmation #..." />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Reason <span style={{ color: '#c62828' }}>*</span></label>
            <textarea className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this refund being issued?" style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || !selectedClient || !amount || !reason} style={{ background: '#b71c1c', borderColor: '#b71c1c' }} onClick={handleSave}>
            {saving ? '⏳ Recording...' : <><Check size={15} style={{ marginRight: 5 }} />Record Refund</>}
          </button>
        </div>
      </div>
    </div>
  );
}
