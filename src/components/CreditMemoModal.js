import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { searchClients, createCreditMemo } from '../services/api';

export default function CreditMemoModal({ onClose, onSaved, initialClient }) {
  const [clientSearch, setClientSearch] = useState(initialClient?.name || '');
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [selectedClient, setSelectedClient] = useState(initialClient || null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!selectedClient) { setError('Select a client'); return; }
    if (!parseFloat(amount) || parseFloat(amount) <= 0) { setError('Enter an amount'); return; }
    setSaving(true); setError('');
    try {
      await createCreditMemo({ clientId: selectedClient.id, clientName: selectedClient.name, date, amount: parseFloat(amount), reason });
      onSaved?.();
      onClose();
    } catch(e) { setError(e.response?.data?.error?.message || e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#1565c0', color: 'white', borderRadius: '8px 8px 0 0' }}>
          <h3 className="modal-title" style={{ color: 'white' }}>📋 Create Credit Memo</h3>
          <button className="btn-icon" onClick={onClose} style={{ color: 'white' }}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#ffebee', borderRadius: 6, padding: '8px 12px', color: '#c62828', fontSize: '0.85rem' }}>{error}</div>}
          <div style={{ background: '#e3f2fd', borderRadius: 6, padding: '10px 14px', fontSize: '0.82rem', color: '#1565c0' }}>
            Credit memos stay on the client's account and are applied automatically to their next payment.
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
                    onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
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
              <label className="form-label">Credit Amount</label>
              <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Reason</label>
            <textarea className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Overpayment, discount, returned material..." style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || !selectedClient || !amount} style={{ background: '#1565c0', borderColor: '#1565c0' }} onClick={handleSave}>
            {saving ? '⏳ Creating...' : <><Check size={15} style={{ marginRight: 5 }} />Create Credit Memo</>}
          </button>
        </div>
      </div>
    </div>
  );
}
