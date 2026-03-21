import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Hash, Receipt, Users, BarChart3, Plus, X, Check, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { getLiabilities, getLiabilitySummary, createLiability, updateLiability, payLiability, deleteLiability } from '../services/api';
import InvoiceCenterPage from './InvoiceCenterPage';
import DRNumbersPage from './DRNumbersPage';
import PONumbersPage from './PONumbersPage';
import InvoiceNumbersPage from './InvoiceNumbersPage';

const LIABILITY_CATEGORIES = [
  { key: 'materials', label: 'Materials', icon: '🧱', color: '#E65100' },
  { key: 'insurance', label: 'Insurance', icon: '🛡️', color: '#1565C0' },
  { key: 'supplies', label: 'Supplies', icon: '🔧', color: '#2E7D32' },
  { key: 'utilities', label: 'Utilities', icon: '💡', color: '#F9A825' },
  { key: 'rent', label: 'Rent/Lease', icon: '🏭', color: '#6A1B9A' },
  { key: 'equipment', label: 'Equipment', icon: '⚙️', color: '#00838F' },
  { key: 'payroll', label: 'Payroll', icon: '👥', color: '#C62828' },
  { key: 'other', label: 'Other', icon: '📎', color: '#616161' }
];

function BusinessPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'invoicing';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  // Liabilities state
  const [liabilities, setLiabilities] = useState([]);
  const [liabSummary, setLiabSummary] = useState(null);
  const [liabLoading, setLiabLoading] = useState(false);
  const [liabFilter, setLiabFilter] = useState('unpaid');
  const [liabCategoryFilter, setLiabCategoryFilter] = useState('all');
  const [showAddBill, setShowAddBill] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [billForm, setBillForm] = useState({ name: '', category: 'other', amount: '', dueDate: '', recurring: false, recurringInterval: 'monthly', vendor: '', notes: '', referenceNumber: '' });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeTab === 'liabilities') loadLiabilities();
  }, [activeTab, liabFilter, liabCategoryFilter]);

  const loadLiabilities = async () => {
    try {
      setLiabLoading(true);
      const [liabRes, summRes] = await Promise.all([
        getLiabilities({ status: liabFilter, category: liabCategoryFilter }),
        getLiabilitySummary()
      ]);
      setLiabilities(liabRes.data.data || []);
      setLiabSummary(summRes.data.data);
    } catch { setError('Failed to load bills'); }
    finally { setLiabLoading(false); }
  };

  const handleSaveBill = async () => {
    try {
      if (!billForm.name || !billForm.amount) { setError('Name and amount required'); return; }
      if (editingBill) {
        await updateLiability(editingBill.id, billForm);
      } else {
        await createLiability(billForm);
      }
      setShowAddBill(false);
      setEditingBill(null);
      setBillForm({ name: '', category: 'other', amount: '', dueDate: '', recurring: false, recurringInterval: 'monthly', vendor: '', notes: '', referenceNumber: '' });
      setMessage(editingBill ? 'Bill updated' : 'Bill added');
      setTimeout(() => setMessage(null), 3000);
      await loadLiabilities();
    } catch { setError('Failed to save bill'); }
  };

  const handlePayBill = async (bill) => {
    if (!window.confirm(`Mark "${bill.name}" ($${parseFloat(bill.amount).toFixed(2)}) as paid?`)) return;
    try {
      await payLiability(bill.id);
      setMessage(`"${bill.name}" marked as paid${bill.recurring ? ' — next occurrence created' : ''}`);
      setTimeout(() => setMessage(null), 3000);
      await loadLiabilities();
    } catch { setError('Failed'); }
  };

  const handleDeleteBill = async (bill) => {
    if (!window.confirm(`Delete "${bill.name}"?`)) return;
    try {
      await deleteLiability(bill.id);
      await loadLiabilities();
    } catch { setError('Failed'); }
  };

  const openEditBill = (bill) => {
    setEditingBill(bill);
    setBillForm({
      name: bill.name, category: bill.category, amount: bill.amount,
      dueDate: bill.dueDate || '', recurring: bill.recurring,
      recurringInterval: bill.recurringInterval || 'monthly',
      vendor: bill.vendor || '', notes: bill.notes || '',
      referenceNumber: bill.referenceNumber || ''
    });
    setShowAddBill(true);
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatCurrency = (v) => '$' + (parseFloat(v) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const TABS = [
    { key: 'invoicing', label: 'Invoicing', icon: <FileText size={16} /> },
    { key: 'liabilities', label: 'Bills & Liabilities', icon: <Receipt size={16} /> },
    { key: 'dr-po', label: 'DR & PO Numbers', icon: <Hash size={16} /> },
    { key: 'employees', label: 'Employees', icon: <Users size={16} /> },
    { key: 'health', label: 'Company Health', icon: <BarChart3 size={16} /> }
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1 className="page-title">💼 Business Center</h1>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}
      {message && <div className="alert alert-success" style={{ marginBottom: 12 }}>{message}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0', marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? '#1976d2' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#555',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: '0.9rem', borderRadius: '8px 8px 0 0',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== INVOICING TAB ===== */}
      {activeTab === 'invoicing' && <InvoiceCenterPage embedded={true} />}

      {/* ===== LIABILITIES TAB ===== */}
      {activeTab === 'liabilities' && (
        <div>
          {/* Summary Cards */}
          {liabSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: liabSummary.totalOverdue > 0 ? '#ffebee' : '#e8f5e9', padding: 16, borderRadius: 10, border: `1px solid ${liabSummary.totalOverdue > 0 ? '#ef9a9a' : '#c8e6c9'}` }}>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Overdue</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: liabSummary.totalOverdue > 0 ? '#c62828' : '#2e7d32' }}>
                  {formatCurrency(liabSummary.totalOverdue)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>{liabSummary.overdueCount} bill{liabSummary.overdueCount !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ background: '#fff3e0', padding: 16, borderRadius: 10, border: '1px solid #FFE0B2' }}>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Due This Week</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E65100' }}>{formatCurrency(liabSummary.totalDueThisWeek)}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>{liabSummary.dueThisWeekCount} bill{liabSummary.dueThisWeekCount !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 10, border: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Total Unpaid</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#333' }}>{formatCurrency(liabSummary.totalUnpaid)}</div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['unpaid', 'paid', 'all'].map(s => (
                <button key={s} onClick={() => setLiabFilter(s)}
                  style={{ padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                    background: liabFilter === s ? '#1976d2' : '#f0f0f0', color: liabFilter === s ? 'white' : '#555' }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="form-select" value={liabCategoryFilter} onChange={(e) => setLiabCategoryFilter(e.target.value)} style={{ width: 160 }}>
                <option value="all">All Categories</option>
                {LIABILITY_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
              </select>
              <button className="btn btn-primary" onClick={() => { setEditingBill(null); setBillForm({ name: '', category: 'other', amount: '', dueDate: '', recurring: false, recurringInterval: 'monthly', vendor: '', notes: '', referenceNumber: '' }); setShowAddBill(true); }}>
                <Plus size={16} /> Add Bill
              </button>
            </div>
          </div>

          {/* Bills List */}
          {liabLoading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div> : (
            liabilities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                <Receipt size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div>No bills found</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {liabilities.map(bill => {
                  const cat = LIABILITY_CATEGORIES.find(c => c.key === bill.category) || LIABILITY_CATEGORIES[7];
                  const days = getDaysUntilDue(bill.dueDate);
                  const isOverdue = days !== null && days < 0 && bill.status === 'unpaid';
                  const isDueSoon = days !== null && days >= 0 && days <= 7 && bill.status === 'unpaid';
                  return (
                    <div key={bill.id} style={{
                      padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12,
                      background: bill.status === 'paid' ? '#f9f9f9' : isOverdue ? '#ffebee' : isDueSoon ? '#fff8e1' : 'white',
                      border: `1px solid ${isOverdue ? '#ef9a9a' : isDueSoon ? '#ffe082' : '#e0e0e0'}`,
                      opacity: bill.status === 'paid' ? 0.7 : 1
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: cat.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                        {cat.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {bill.name}
                          {bill.recurring && <span style={{ fontSize: '0.7rem', background: '#e3f2fd', color: '#1565c0', padding: '1px 6px', borderRadius: 4 }}>🔄 {bill.recurringInterval}</span>}
                          {isOverdue && <span style={{ fontSize: '0.7rem', background: '#c62828', color: 'white', padding: '1px 6px', borderRadius: 4 }}>⚠ OVERDUE</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {bill.vendor && <span>{bill.vendor}</span>}
                          {bill.dueDate && <span>Due: {new Date(bill.dueDate + 'T12:00:00').toLocaleDateString()}</span>}
                          {days !== null && bill.status === 'unpaid' && (
                            <span style={{ color: isOverdue ? '#c62828' : isDueSoon ? '#E65100' : '#888', fontWeight: isOverdue || isDueSoon ? 600 : 400 }}>
                              {isOverdue ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days left`}
                            </span>
                          )}
                          {bill.referenceNumber && <span>Ref: {bill.referenceNumber}</span>}
                          {bill.status === 'paid' && bill.paidAt && <span style={{ color: '#2e7d32' }}>Paid {new Date(bill.paidAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: bill.status === 'paid' ? '#888' : '#333', whiteSpace: 'nowrap' }}>
                        {formatCurrency(bill.amount)}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {bill.status === 'unpaid' && (
                          <button onClick={() => handlePayBill(bill)}
                            style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                            ✓ Pay
                          </button>
                        )}
                        <button onClick={() => openEditBill(bill)}
                          style={{ background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                        <button onClick={() => handleDeleteBill(bill)}
                          style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#c62828', fontSize: '0.8rem' }}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Add/Edit Bill Modal */}
          {showAddBill && (
            <div className="modal-overlay" onClick={() => setShowAddBill(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 550 }}>
                <div className="modal-header">
                  <h3 className="modal-title">{editingBill ? 'Edit Bill' : 'Add Bill'}</h3>
                  <button className="modal-close" onClick={() => setShowAddBill(false)}>&times;</button>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Bill Name *</label>
                    <input className="form-input" value={billForm.name} onChange={(e) => setBillForm({ ...billForm, name: e.target.value })} placeholder="e.g. Electric Bill, Steel Supply Invoice" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Category</label>
                      <select className="form-select" value={billForm.category} onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}>
                        {LIABILITY_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Amount *</label>
                      <input type="number" step="0.01" className="form-input" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Due Date</label>
                      <input type="date" className="form-input" value={billForm.dueDate} onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Vendor</label>
                      <input className="form-input" value={billForm.vendor} onChange={(e) => setBillForm({ ...billForm, vendor: e.target.value })} placeholder="e.g. Duke Energy" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={billForm.recurring} onChange={(e) => setBillForm({ ...billForm, recurring: e.target.checked })} style={{ width: 18, height: 18 }} />
                      <span style={{ fontWeight: 500 }}>Recurring</span>
                    </label>
                    {billForm.recurring && (
                      <select className="form-select" value={billForm.recurringInterval} onChange={(e) => setBillForm({ ...billForm, recurringInterval: e.target.value })} style={{ width: 140 }}>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    )}
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Reference # (optional)</label>
                    <input className="form-input" value={billForm.referenceNumber} onChange={(e) => setBillForm({ ...billForm, referenceNumber: e.target.value })} placeholder="Invoice or account number" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" value={billForm.notes} onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })} rows={2} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowAddBill(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveBill}>{editingBill ? 'Update' : 'Add Bill'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== DR & PO NUMBERS TAB ===== */}
      {activeTab === 'dr-po' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><DRNumbersPage embedded={true} /></div>
            <div><PONumbersPage embedded={true} /></div>
          </div>
          <div style={{ marginTop: 16 }}><InvoiceNumbersPage embedded={true} /></div>
        </div>
      )}

      {/* ===== EMPLOYEES TAB (placeholder) ===== */}
      {activeTab === 'employees' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Users size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <h3>Employee Center</h3>
          <p style={{ color: '#888' }}>Employee management and weekly payroll — coming soon</p>
        </div>
      )}

      {/* ===== COMPANY HEALTH TAB (placeholder) ===== */}
      {activeTab === 'health' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <h3>Company Health</h3>
          <p style={{ color: '#888' }}>Revenue, expenses, profit analysis — coming soon</p>
        </div>
      )}
    </div>
  );
}

export default BusinessPage;
