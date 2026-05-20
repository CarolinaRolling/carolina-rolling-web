import React, { useState, useEffect, useRef } from 'react';
import { X, Check, CreditCard, DollarSign, FileText } from 'lucide-react';
import { searchClients, getClientOpenInvoices, recordClientPayment } from '../services/api';

const METHODS = [
  { key: 'check', label: 'Check', icon: '🏦' },
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'credit_card', label: 'Credit Card', icon: '💳' },
  { key: 'ach', label: 'ACH / Wire', icon: '🔄' },
  { key: 'other', label: 'Other', icon: '📋' },
];

const fmt = n => '$' + (parseFloat(n)||0).toFixed(2);

export default function TakePaymentModal({ onClose, onSaved, initialClient }) {
  const [step, setStep] = useState(initialClient ? 2 : 1); // 1=client, 2=payment
  const [clientSearch, setClientSearch] = useState(initialClient?.name || '');
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [selectedClient, setSelectedClient] = useState(initialClient || null);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedWOs, setSelectedWOs] = useState({}); // woId -> amount (string)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('check');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [createCredit, setCreateCredit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (initialClient) loadInvoices(initialClient);
  }, []);

  const loadInvoices = async (client) => {
    if (!client?.id) return;
    setLoadingInvoices(true);
    try {
      const r = await getClientOpenInvoices(client.id);
      const invoices = r.data.data || [];
      setOpenInvoices(invoices);
      // Pre-select all, pre-fill amounts with balance
      const sel = {};
      invoices.forEach(inv => { sel[inv.wo.id] = inv.balance.toFixed(2); });
      setSelectedWOs(sel);
      // Pre-fill total amount
      const total = invoices.reduce((s, inv) => s + inv.balance, 0);
      setAmount(total.toFixed(2));
    } catch(e) { setError('Failed to load invoices'); }
    finally { setLoadingInvoices(false); }
  };

  const selectClient = async (client) => {
    setSelectedClient(client);
    setClientSearch(client.name);
    setShowClientDrop(false);
    setStep(2);
    await loadInvoices(client);
  };

  // Allocation logic — distributes entered amount across selected WOs oldest-first
  const totalEntered = parseFloat(amount) || 0;
  const allocations = (() => {
    const selected = openInvoices.filter(inv => selectedWOs[inv.wo.id] !== undefined);
    let remaining = totalEntered;
    return selected.map(inv => {
      const balance = inv.balance;
      const applied = Math.min(remaining, balance);
      remaining = Math.max(0, remaining - applied);
      return { inv, applied: Math.round(applied * 100) / 100, leftOnWO: Math.round((balance - applied) * 100) / 100 };
    });
  })();

  const totalApplied = allocations.reduce((s, a) => s + a.applied, 0);
  const remainder = Math.round((totalEntered - totalApplied) * 100) / 100;
  const stillOwed = allocations.reduce((s, a) => s + a.leftOnWO, 0);

  const toggleWO = (woId) => {
    const next = { ...selectedWOs };
    if (next[woId] !== undefined) delete next[woId];
    else {
      const inv = openInvoices.find(i => i.wo.id === woId);
      if (inv) next[woId] = inv.balance.toFixed(2);
    }
    setSelectedWOs(next);
  };

  const handleSave = async () => {
    if (!selectedClient) { setError('Select a client'); return; }
    if (!totalEntered || totalEntered <= 0) { setError('Enter a payment amount'); return; }
    if (allocations.length === 0) { setError('Select at least one invoice to apply payment to'); return; }
    setSaving(true); setError('');
    try {
      await recordClientPayment({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        paymentDate, amount: totalEntered, method, reference, notes,
        applications: allocations.filter(a => a.applied > 0).map(a => ({
          workOrderId: a.inv.wo.id, amount: a.applied
        })),
        creditMemoRemainder: createCredit && remainder > 0.01
      });
      onSaved?.();
      onClose();
    } catch(e) {
      setError(e.response?.data?.error?.message || e.message || 'Failed to record payment');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#1b5e20', color: 'white', borderRadius: '8px 8px 0 0' }}>
          <h3 className="modal-title" style={{ color: 'white' }}>💵 Take Payment</h3>
          <button className="btn-icon" onClick={onClose} style={{ color: 'white' }}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '8px 12px', color: '#c62828', fontSize: '0.85rem' }}>{error}</div>}

          {/* Client selection */}
          <div className="form-group" style={{ margin: 0, position: 'relative' }}>
            <label className="form-label">Client</label>
            <input className="form-input" ref={searchRef} value={clientSearch} autoComplete="off"
              onChange={async e => {
                setClientSearch(e.target.value);
                if (e.target.value.length >= 1) {
                  try { const r = await searchClients(e.target.value); setClientSuggestions(r.data.data || []); setShowClientDrop(true); } catch {}
                }
              }}
              onFocus={async () => {
                try { const r = await searchClients(''); setClientSuggestions(r.data.data || []); setShowClientDrop(true); } catch {}
              }}
              onBlur={() => setTimeout(() => setShowClientDrop(false), 200)}
              placeholder="Search client name..." />
            {showClientDrop && clientSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {clientSuggestions.map(c => (
                  <div key={c.id} onMouseDown={() => selectClient(c)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '0.9rem' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e8f5e9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.email && <div style={{ fontSize: '0.75rem', color: '#888' }}>{c.email}</div>}
                  </div>
                ))}
              </div>
            )}
            {selectedClient && <div style={{ fontSize: '0.72rem', color: '#2e7d32', marginTop: 3 }}>✓ {selectedClient.name}</div>}
          </div>

          {/* Payment details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Payment Date</label>
              <input className="form-input" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Amount Received</label>
              <input className="form-input" type="number" step="0.01" min="0" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.00"
                style={{ fontWeight: 700, fontSize: '1.1rem' }} />
            </div>
          </div>

          {/* Method */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Payment Method</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {METHODS.map(m => (
                <button key={m.key} onClick={() => setMethod(m.key)}
                  style={{ padding: '6px 14px', border: `1px solid ${method === m.key ? '#2e7d32' : '#ddd'}`, borderRadius: 20, cursor: 'pointer', background: method === m.key ? '#e8f5e9' : 'white', color: method === m.key ? '#1b5e20' : '#555', fontWeight: method === m.key ? 700 : 400, fontSize: '0.85rem' }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Reference {method === 'check' ? '(Check #)' : method === 'credit_card' ? '(Last 4)' : ''}</label>
              <input className="form-input" value={reference} onChange={e => setReference(e.target.value)} placeholder={method === 'check' ? 'Check number' : method === 'ach' ? 'Confirmation #' : 'Reference'} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." />
            </div>
          </div>

          {/* Open invoices */}
          {selectedClient && (
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#333', marginBottom: 8 }}>
                Apply to Open Invoices {loadingInvoices && '(loading...)'}
              </div>
              {!loadingInvoices && openInvoices.length === 0 && (
                <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: 6, fontSize: '0.85rem', color: '#888', textAlign: 'center' }}>No open invoices for this client</div>
              )}
              {openInvoices.length > 0 && (
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '8px', width: 36 }}></th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Work Order</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Balance</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Apply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openInvoices.map((inv, idx) => {
                        const isSelected = selectedWOs[inv.wo.id] !== undefined;
                        const alloc = allocations.find(a => a.inv.wo.id === inv.wo.id);
                        return (
                          <tr key={inv.wo.id} style={{ borderTop: '1px solid #f0f0f0', background: isSelected ? '#f1f8f1' : 'white' }}>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleWO(inv.wo.id)} />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ fontWeight: 600, color: '#1565c0' }}>{inv.wo.drNumber ? `DR-${inv.wo.drNumber}` : inv.wo.orderNumber}</div>
                              {inv.wo.invoiceNumber && <div style={{ fontSize: '0.75rem', color: '#888' }}>#{inv.wo.invoiceNumber}</div>}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#555' }}>{fmt(inv.total)}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#e65100' }}>{fmt(inv.balance)}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              {isSelected && alloc
                                ? <span style={{ fontWeight: 700, color: '#2e7d32' }}>{fmt(alloc.applied)}</span>
                                : <span style={{ color: '#ccc' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {totalEntered > 0 && allocations.length > 0 && (
            <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '4px 0' }}>
                <span>Payment received</span><span style={{ fontWeight: 700 }}>{fmt(totalEntered)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '4px 0' }}>
                <span>Applied to invoices</span><span style={{ fontWeight: 700, color: '#2e7d32' }}>-{fmt(totalApplied)}</span>
              </div>
              {stillOwed > 0.01 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '4px 0', color: '#e65100' }}>
                  <span>Still owed on invoices</span><span style={{ fontWeight: 700 }}>{fmt(stillOwed)}</span>
                </div>
              )}
              {remainder > 0.01 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '4px 0 8px', borderTop: '1px solid #ddd', marginTop: 6, color: '#1565c0' }}>
                    <span>Credit remaining</span><span style={{ fontWeight: 700 }}>{fmt(remainder)}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={createCredit} onChange={e => setCreateCredit(e.target.checked)} />
                    Create credit memo for {fmt(remainder)} — apply to next invoice
                  </label>
                </>
              )}
              {remainder < -0.01 && (
                <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4, padding: '6px 10px', marginTop: 6, fontSize: '0.82rem', color: '#c62828' }}>
                  ⚠️ Payment amount is {fmt(Math.abs(remainder))} short of selected invoices
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || !selectedClient || !totalEntered}
            style={{ background: '#2e7d32', borderColor: '#2e7d32' }}
            onClick={handleSave}>
            {saving ? '⏳ Recording...' : <><Check size={15} style={{ marginRight: 5 }} />Record Payment</>}
          </button>
        </div>
      </div>
    </div>
  );
}
