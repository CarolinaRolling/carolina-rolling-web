import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ShoppingCart, Receipt, Mail, ChevronRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { getEstimates, getPendingOrders, getCommBills, getCommCoverage } from '../services/api';
import { formatDate } from '../utils/dates';

// One hub for everything waiting on a human decision: estimates to review,
// client-submitted orders to approve, bills to approve, and quotes awaiting a reply.
// It is a launcher — each row links to where the actual review happens.
export default function ReviewCenterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estimates, setEstimates] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [quotes, setQuotes] = useState([]);

  const load = async () => {
    setRefreshing(true);
    const [est, ord, bil, cov] = await Promise.allSettled([
      getEstimates({ status: 'draft' }),
      getPendingOrders('pending'),
      getCommBills(),
      getCommCoverage({ quotesOnly: true }),
    ]);
    if (est.status === 'fulfilled') setEstimates((est.value.data.data || []).filter(e => e.status === 'draft'));
    if (ord.status === 'fulfilled') setOrders(ord.value.data.data || []);
    if (bil.status === 'fulfilled') setBills((bil.value.data.data || []).filter(b => (b.billStatus || 'pending') === 'pending'));
    if (cov.status === 'fulfilled') setQuotes((cov.value.data.data || []).filter(e => !e.commResponded && !e.commHandledManually));
    setLoading(false); setRefreshing(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const money = (n, c) => (n == null || isNaN(n)) ? '' : `${c === 'CAD' ? 'C$' : '$'}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const byDateAsc = (a, b) => new Date(a) - new Date(b);

  const sections = [
    {
      key: 'estimates', title: 'Estimates to review', icon: FileText, color: '#1565c0',
      items: [...estimates].sort((a, b) => byDateAsc(a.createdAt, b.createdAt)).map(e => ({
        id: e.id,
        label: e.estimateNumber || 'Estimate',
        sub: e.clientName || 'Unknown client',
        date: e.createdAt,
        onClick: () => navigate(`/estimates/${e.id}`),
      })),
    },
    {
      key: 'orders', title: 'Client orders to approve', icon: ShoppingCart, color: '#e65100',
      items: [...orders].sort((a, b) => byDateAsc(a.createdAt, b.createdAt)).map(o => ({
        id: o.id,
        label: o.clientName || 'Client order',
        sub: o.poNumber ? `PO ${o.poNumber}` : 'Client-submitted order',
        date: o.createdAt,
        onClick: () => navigate('/pending-orders'),
      })),
    },
    {
      key: 'bills', title: 'Bills to approve', icon: Receipt, color: '#6a1b9a',
      items: [...bills].sort((a, b) => byDateAsc(a.receivedAt, b.receivedAt)).map(b => {
        const d = b.billData || {};
        const amt = money(d.amount, d.currency);
        return {
          id: b.id,
          label: d.vendorName || b.fromName || b.fromEmail || 'Vendor bill',
          sub: [amt, d.dueDate ? `due ${d.dueDate}` : null].filter(Boolean).join(' · ') || (b.subject || ''),
          date: b.receivedAt,
          onClick: () => navigate('/com-center'),
        };
      }),
    },
    {
      key: 'quotes', title: 'Quotes awaiting reply', icon: Mail, color: '#2e7d32',
      items: [...quotes].sort((a, b) => byDateAsc(a.commLastMessageAt || a.receivedAt, b.commLastMessageAt || b.receivedAt)).map(e => ({
        id: e.id,
        label: e.subject || '(no subject)',
        sub: e.fromName || e.fromEmail || '',
        date: e.commLastMessageAt || e.receivedAt,
        onClick: () => navigate('/com-center'),
      })),
    },
  ];

  const total = sections.reduce((n, s) => n + s.items.length, 0);

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
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading review items…</div>
      ) : total === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#2e7d32' }}>
          <CheckCircle2 size={40} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>All caught up.</div>
          <div style={{ fontSize: '0.85rem', color: '#888', marginTop: 4 }}>No estimates, orders, bills, or quotes are waiting.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: s.items.length ? '1px solid #eee' : 'none', borderLeft: `4px solid ${s.color}` }}>
                  <Icon size={18} style={{ color: s.color }} />
                  <span style={{ fontWeight: 700, color: '#222' }}>{s.title}</span>
                  <span style={{ marginLeft: 'auto', background: s.items.length ? s.color : '#bbb', color: 'white', borderRadius: 12, padding: '1px 9px', fontSize: '0.78rem', fontWeight: 700 }}>{s.items.length}</span>
                </div>
                {s.items.length === 0 ? (
                  <div style={{ padding: '12px 18px', color: '#9e9e9e', fontSize: '0.85rem' }}>All clear.</div>
                ) : (
                  s.items.map(it => (
                    <div key={it.id} onClick={it.onClick}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderTop: '1px solid #f2f2f2', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</div>
                        {it.sub && <div style={{ fontSize: '0.8rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</div>}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#aaa', whiteSpace: 'nowrap' }}>{formatDate(it.date)}</span>
                      <ChevronRight size={16} style={{ color: '#ccc', flexShrink: 0 }} />
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
