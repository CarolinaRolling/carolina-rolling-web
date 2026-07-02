import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ShoppingCart, Receipt, Mail, ChevronRight, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';
import { getEstimates, getPendingOrders, getCommBills, getCommCoverage, getMonitoredClients, updateBillStatus, updateCommEmailCategory } from '../services/api';
import { formatDate } from '../utils/dates';

// One hub for everything waiting on a human decision, split into tabs:
// Estimates to review, Emails awaiting reply, Client orders to approve, Bills to approve.
// Estimates/emails from "email monitor" clients are prioritized to the top and color-coded.
const PRIORITY_COLOR = '#E65100';

export default function ReviewCenterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('estimates');
  const [estimates, setEstimates] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [monitored, setMonitored] = useState(new Set());

  const load = async () => {
    setRefreshing(true);
    const [est, ord, bil, cov, mon] = await Promise.allSettled([
      getEstimates({ status: 'draft' }),
      getPendingOrders('pending'),
      getCommBills(),
      getCommCoverage({ quotesOnly: true }),
      getMonitoredClients(),
    ]);
    if (mon.status === 'fulfilled') setMonitored(new Set((mon.value.data.data || []).map(c => (c.name || '').trim().toLowerCase()).filter(Boolean)));
    if (est.status === 'fulfilled') setEstimates((est.value.data.data || []).filter(e => e.status === 'draft'));
    if (ord.status === 'fulfilled') setOrders(ord.value.data.data || []);
    if (bil.status === 'fulfilled') setBills((bil.value.data.data || []).filter(b => (b.billStatus || 'pending') === 'pending'));
    if (cov.status === 'fulfilled') setQuotes((cov.value.data.data || []).filter(e => !e.commResponded && !e.commHandledManually));
    setLoading(false); setRefreshing(false);
    window.dispatchEvent(new Event('reviewcount:refresh')); // keep sidebar badge in sync
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const money = (n, c) => (n == null || isNaN(n)) ? '' : `${c === 'CAD' ? 'C$' : '$'}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const byDateAsc = (a, b) => new Date(a) - new Date(b);
  const isMonitored = (name) => monitored.has((name || '').trim().toLowerCase());

  // A bill leaves the queue once approved, rejected, or marked "not a bill".
  const actOnBill = async (id, apiCall) => {
    setBills(prev => prev.filter(b => b.id !== id));
    try { await apiCall(); } catch { /* optimistic; next refresh reconciles */ }
    window.dispatchEvent(new Event('reviewcount:refresh'));
  };

  const estimateItems = [...estimates]
    .sort((a, b) => (Number(isMonitored(b.clientName)) - Number(isMonitored(a.clientName))) || byDateAsc(a.createdAt, b.createdAt))
    .map(e => ({ id: e.id, label: e.estimateNumber || 'Estimate', sub: e.clientName || 'Unknown client', date: e.createdAt, priority: isMonitored(e.clientName), onClick: () => navigate(`/estimates/${e.id}`) }));

  const orderItems = [...orders].sort((a, b) => byDateAsc(a.createdAt, b.createdAt))
    .map(o => ({ id: o.id, label: o.clientName || 'Client order', sub: o.poNumber ? `PO ${o.poNumber}` : 'Client-submitted order', date: o.createdAt, onClick: () => navigate('/pending-orders') }));

  const quoteItems = [...quotes].sort((a, b) => byDateAsc(a.commLastMessageAt || a.receivedAt, b.commLastMessageAt || b.receivedAt))
    .map(e => ({ id: e.id, label: e.subject || '(no subject)', sub: e.fromName || e.fromEmail || '', date: e.commLastMessageAt || e.receivedAt, priority: isMonitored(e.fromName) || isMonitored(e.clientName), onClick: () => navigate('/com-center') }));

  // Order requested: estimates, email, orders, bills
  const tabs = [
    { key: 'estimates', title: 'Estimates', icon: FileText, color: '#1565c0', items: estimateItems },
    { key: 'email', title: 'Email', icon: Mail, color: '#2e7d32', items: quoteItems },
    { key: 'orders', title: 'Orders', icon: ShoppingCart, color: '#e65100', items: orderItems },
    { key: 'bills', title: 'Bills', icon: Receipt, color: '#6a1b9a', items: bills },
  ];
  const total = tabs.reduce((n, t) => n + t.items.length, 0);
  const active = tabs.find(t => t.key === activeTab) || tabs[0];

  const solidBtn = { border: 'none', color: 'white', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 };
  const ghostBtn = { border: '1px solid #ccc', background: 'white', color: '#555', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem' };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Review Center</h1>
          <p style={{ color: '#777', margin: '4px 0 0' }}>
            {loading ? 'Loading…' : total === 0 ? 'Nothing waiting on you right now.' : `${total} item${total === 1 ? '' : 's'} waiting for review`}
          </p>
        </div>
        <button onClick={load} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: '#555' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #eee', flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const Icon = t.icon; const on = t.key === activeTab;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', borderBottom: on ? `3px solid ${t.color}` : '3px solid transparent', padding: '9px 16px', marginBottom: -2, cursor: 'pointer', color: on ? '#111' : '#888', fontWeight: on ? 700 : 500, fontSize: '0.9rem' }}>
              <Icon size={16} style={{ color: on ? t.color : '#aaa' }} />
              {t.title}
              {t.items.length > 0 && <span style={{ background: on ? t.color : '#bbb', color: 'white', borderRadius: 10, padding: '0px 7px', fontSize: '0.72rem', fontWeight: 700 }}>{t.items.length}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading review items…</div>
      ) : active.items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 50, color: '#2e7d32' }}>
          <CheckCircle2 size={36} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 600, fontSize: '1.02rem' }}>All clear.</div>
          <div style={{ fontSize: '0.85rem', color: '#888', marginTop: 4 }}>Nothing in {active.title.toLowerCase()} needs review right now.</div>
        </div>
      ) : activeTab === 'bills' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {bills.map(b => {
            const d = b.billData || {}; const err = d.error;
            return (
              <div key={b.id} className="card" style={{ padding: 14, borderLeft: '4px solid #6a1b9a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.vendorName || b.fromName || b.fromEmail || 'Vendor bill'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.subject}</div>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#aaa', whiteSpace: 'nowrap' }}>{formatDate(b.receivedAt)}</span>
                </div>
                {err ? (
                  <div style={{ fontSize: '0.8rem', color: '#c62828', marginTop: 8 }}>
                    {err === 'no_pdf' ? 'No amount found automatically — open the email to check.' : 'Could not read this invoice automatically — open it to review.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', marginTop: 10, fontSize: '0.82rem' }}>
                    {d.invoiceNumber && <span><span style={{ color: '#999' }}>Invoice #</span> <b>{d.invoiceNumber}</b></span>}
                    {d.amount != null && <span><span style={{ color: '#999' }}>Amount</span> <b>{money(d.amount, d.currency)}</b></span>}
                    {d.dueDate && <span><span style={{ color: '#999' }}>Due</span> <b>{d.dueDate}</b></span>}
                    {d.poNumber && <span><span style={{ color: '#999' }}>PO</span> <b>{d.poNumber}</b></span>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button onClick={() => actOnBill(b.id, () => updateBillStatus(b.id, 'approved'))} style={{ ...solidBtn, background: '#2e7d32' }}>✓ Approve</button>
                  <button onClick={() => actOnBill(b.id, () => updateBillStatus(b.id, 'rejected'))} style={{ ...solidBtn, background: '#c62828' }}>✕ Reject</button>
                  <button onClick={() => actOnBill(b.id, () => updateCommEmailCategory(b.id, 'general'))} style={ghostBtn} title="This email isn't a bill — remove it from the bills queue">Not a bill</button>
                  {b.gmailLink && <a href={b.gmailLink} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={12} /> View email</a>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {active.items.map(it => (
            <div key={it.id} onClick={it.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid #f2f2f2', cursor: 'pointer', borderLeft: it.priority ? `4px solid ${PRIORITY_COLOR}` : '4px solid transparent', background: it.priority ? '#fff8f3' : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = it.priority ? '#ffefe3' : '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = it.priority ? '#fff8f3' : 'transparent'}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.priority && <span title="Email-monitor client" style={{ marginRight: 6 }}>📧</span>}{it.label}
                </div>
                {it.sub && <div style={{ fontSize: '0.8rem', color: it.priority ? PRIORITY_COLOR : '#888', fontWeight: it.priority ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</div>}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#aaa', whiteSpace: 'nowrap' }}>{formatDate(it.date)}</span>
              <ChevronRight size={16} style={{ color: '#ccc', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
