import React from 'react';
import { Plus } from 'lucide-react';
import TakePaymentModal from '../components/TakePaymentModal';
import CreditMemoModal from '../components/CreditMemoModal';
import RefundModal from '../components/RefundModal';

const LB_CATS = [
  {key:'materials',icon:'🔩',label:'Materials',color:'#1565c0'},
  {key:'insurance',icon:'🛡️',label:'Insurance',color:'#6a1b9a'},
  {key:'supplies',icon:'🧰',label:'Shop Supplies',color:'#e65100'},
  {key:'utilities',icon:'💡',label:'Utilities',color:'#f57f17'},
  {key:'rent',icon:'🏭',label:'Rent/Lease',color:'#2e7d32'},
  {key:'equipment',icon:'⚙️',label:'Equipment',color:'#37474f'},
  {key:'payroll',icon:'👥',label:'Payroll',color:'#880e4f'},
  {key:'other',icon:'📎',label:'Other',color:'#616161'},
];

export default function COATab({
  ledger, ledgerFilter, setLedgerFilter, ledgerSearch, setLedgerSearch,
  ledgerExpanded, setLedgerExpanded, loadLedger,
  coaTab, setCoaTab,
  paymentModal, setPaymentModal, paymentForm, setPaymentForm,
  handleRecordPayment,
  liabs, liabSum, liabLoad, liabF, setLiabF, liabCat, setLiabCat, loadLiabs,
  showBill, setShowBill, editBill, setEditBill, bf, setBf,
  billFileRef, uploadingBill, handleBillFileUpload, handleSaveBill,
  handlePayBill, handleRejectBill, handleApproveBill, handleDeleteBill, daysUntil,
  showTakePayment, setShowTakePayment,
  showCreditMemo, setShowCreditMemo,
  showRefund, setShowRefund,
  getCreditMemos, setCreditMemos, getRefunds, setRefunds,
  fmt,
}) {
  return (
    <div>
      {/* COA Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0', marginBottom: 20 }}>
        {[
          { key: 'ar', label: '📥 Accounts Receivable', color: '#1565c0' },
          { key: 'ap', label: '📤 Accounts Payable', color: '#6a1b9a' },
        ].map(t => (
          <button key={t.key} onClick={() => setCoaTab(t.key)}
            style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: coaTab === t.key ? 700 : 500, fontSize: '0.9rem',
              borderBottom: coaTab === t.key ? `3px solid ${t.color}` : '3px solid transparent',
              background: 'transparent', color: coaTab === t.key ? t.color : '#555' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ACCOUNTS RECEIVABLE ── */}
      {coaTab === 'ar' && (
        <div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setShowTakePayment(true)}
              style={{ padding: '10px 20px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              💵 Take Payment
            </button>
            <button onClick={() => setShowCreditMemo(true)}
              style={{ padding: '10px 16px', background: '#1565c0', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              📋 Credit Memo
            </button>
            <button onClick={() => setShowRefund(true)}
              style={{ padding: '10px 16px', background: '#b71c1c', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              ↩ Refund
            </button>
          </div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Outstanding', value: ledger.totalOutstanding, color: '#e65100', bg: '#fff3e0' },
          { label: 'Collected', value: ledger.totalCollected, color: '#2e7d32', bg: '#e8f5e9' },
          { label: 'Invoices', value: ledger.count, color: '#1565c0', bg: '#e3f2fd', isCnt: true }
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 8, padding: '14px 18px', border: `1px solid ${c.color}33` }}>
            <div style={{ fontSize: '0.75rem', color: c.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color }}>{c.isCnt ? ledger.count : ('$' + (parseFloat(c.value)||0).toLocaleString('en-US', { minimumFractionDigits: 2 }))}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { key: 'outstanding', label: 'Outstanding' },
          { key: 'paid', label: 'Paid' },
          { key: 'needs_pricing', label: `⚠️ Needs Pricing${ledger.needsPricingCount > 0 ? ` (${ledger.needsPricingCount})` : ''}` },
          { key: 'all', label: 'All' }
        ].map(f => (
          <button key={f.key} onClick={() => { setLedgerFilter(f.key); loadLedger(); }}
            style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: 20, cursor: 'pointer', background: ledgerFilter === f.key ? (f.key === 'needs_pricing' ? '#e65100' : '#1976d2') : 'white', color: ledgerFilter === f.key ? 'white' : (f.key === 'needs_pricing' ? '#e65100' : '#555'), fontWeight: ledgerFilter === f.key ? 700 : 400, fontSize: '0.85rem' }}>
            {f.label}
          </button>
        ))}
        <input placeholder="Search client, DR#, invoice..." className="form-input" style={{ width: 240, marginLeft: 'auto' }}
          value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadLedger()} />
      </div>

      {/* Ledger rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(ledger.invoices || []).length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No invoices found.</div>}
        {(ledger.invoices || []).map(inv => {
          const isExpanded = ledgerExpanded === inv.id;
          const balance = parseFloat(inv.balance) || 0;
          const totalPaid = parseFloat(inv.totalPaid) || 0;
          const grandTotal = parseFloat(inv.grandTotal) || 0;
          const paidPct = grandTotal > 0 ? Math.min(100, Math.round(totalPaid / grandTotal * 100)) : 0;
          return (
            <div key={inv.id} style={{ background: 'white', borderRadius: 8, border: `1px solid ${inv.isPaid ? '#a5d6a7' : '#e0e0e0'}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: inv.isPaid ? '#f1f8f1' : 'white' }}
                onClick={() => setLedgerExpanded(isExpanded ? null : inv.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1565c0', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={e => { e.stopPropagation(); window.open(`/work-orders/${inv.id}`, '_blank'); }}>
                      {inv.drNumber ? 'DR-' + inv.drNumber : inv.orderNumber}
                    </span>
                    {inv.invoiceNumber && <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#2e7d32', fontWeight: 600 }}>#{inv.invoiceNumber}</span>}
                    {inv.isPaid
                      ? <span style={{ fontSize: '0.75rem', background: '#2e7d32', color: 'white', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>✓ PAID</span>
                      : inv.needsPricing
                        ? <span style={{ fontSize: '0.75rem', background: '#e65100', color: 'white', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>⚠️ Set Pricing</span>
                        : <span style={{ fontSize: '0.75rem', background: inv.daysOutstanding > 60 ? '#c62828' : inv.daysOutstanding > 30 ? '#e65100' : '#1565c0', color: 'white', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>{inv.daysOutstanding}d</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#555' }}>{inv.clientName}{inv.clientPurchaseOrderNumber && ` — PO: ${inv.clientPurchaseOrderNumber}`}</div>
                  {/* Payment bar */}
                  {totalPaid > 0 && !inv.isPaid && (
                    <div style={{ marginTop: 6, height: 4, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden', width: 200 }}>
                      <div style={{ height: '100%', width: paidPct + '%', background: '#43a047', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>${grandTotal.toFixed(2)}</div>
                  {!inv.isPaid && totalPaid > 0 && <div style={{ fontSize: '0.8rem', color: '#e65100', fontWeight: 600 }}>Balance: ${balance.toFixed(2)}</div>}
                  {!inv.isPaid && totalPaid > 0 && <div style={{ fontSize: '0.75rem', color: '#2e7d32' }}>Paid: ${totalPaid.toFixed(2)}</div>}
                </div>
                {!inv.isPaid && (
                  <button onClick={e => { e.stopPropagation(); setPaymentModal(inv); setPaymentForm({ paymentType: balance >= grandTotal - 0.01 ? 'full' : 'partial', amount: balance.toFixed(2), paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'check', paymentReference: '', notes: '' }); }}
                    style={{ padding: '8px 14px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                    + Payment
                  </button>
                )}
              </div>

              {isExpanded && (inv.payments || []).length > 0 && (
                <div style={{ borderTop: '1px solid #eee', background: '#fafafa', padding: '10px 16px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#888', marginBottom: 8 }}>PAYMENT HISTORY</div>
                  {inv.payments.map(pmt => (
                    <div key={pmt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ fontSize: '0.8rem', color: '#666', minWidth: 90 }}>{new Date(pmt.paymentDate).toLocaleDateString()}</span>
                      <span style={{ fontSize: '0.85rem', color: '#333', flex: 1 }}>
                        {pmt.paymentType === 'downpayment' ? 'Down Payment' : pmt.paymentType === 'full' ? 'Paid in Full' : 'Partial Payment'}
                        {pmt.paymentMethod && ` — ${pmt.paymentMethod}`}
                        {pmt.paymentReference && ` #${pmt.paymentReference}`}
                      </span>
                      <span style={{ fontWeight: 700, color: '#2e7d32', fontSize: '0.95rem' }}>-${parseFloat(pmt.amount).toFixed(2)}</span>
                      <button onClick={() => handleVoidPayment(pmt.id)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 6px' }}>✕ Void</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </div>
            </div>
      </div>
        </div>
    </div>
          );
        })}
      </div>


      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 480, width: '95%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#2e7d32', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Record Payment</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{paymentModal.clientName} — {paymentModal.drNumber ? 'DR-' + paymentModal.drNumber : paymentModal.orderNumber} — Balance: ${(parseFloat(paymentModal.balance)||0).toFixed(2)}</div>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Payment Type</label>
                <select className="form-select" value={paymentForm.paymentType} onChange={e => setPaymentForm(f => ({ ...f, paymentType: e.target.value, amount: e.target.value === 'partial' ? '' : f.amount }))}>
                  <option value="downpayment">Down Payment</option>
                  <option value="partial">Partial Payment</option>
                  <option value="full">Payment in Full</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Amount *</label>
                  <input type="number" step="0.01" className="form-input" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={paymentForm.paymentDate} onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Method</label>
                  <select className="form-select" value={paymentForm.paymentMethod} onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    {['check','ach','wire','credit_card','cash','other'].map(m => <option key={m} value={m}>{m === 'ach' ? 'ACH' : m === 'credit_card' ? 'Credit Card' : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Reference #</label>
                  <input className="form-input" placeholder="Check #, wire ref..." value={paymentForm.paymentReference} onChange={e => setPaymentForm(f => ({ ...f, paymentReference: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Notes</label>
                <input className="form-input" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button onClick={handleRecordPayment} style={{ flex: 1, padding: '14px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>Record Payment</button>
                <button onClick={() => setPaymentModal(null)} style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACCOUNTS PAYABLE ── */}
      {coaTab === 'ap' && (
        <div>

    {liabSum && (<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
      <div style={{background:liabSum.totalOverdue>0?'#ffebee':'#e8f5e9',padding:16,borderRadius:10,border:`1px solid ${liabSum.totalOverdue>0?'#ef9a9a':'#c8e6c9'}`}}><div style={{fontSize:'0.8rem',color:'#888'}}>Overdue</div><div style={{fontSize:'1.5rem',fontWeight:800,color:liabSum.totalOverdue>0?'#c62828':'#2e7d32'}}>{fmt(liabSum.totalOverdue)}</div><div style={{fontSize:'0.8rem',color:'#888'}}>{liabSum.overdueCount} bills</div></div>
      <div style={{background:'#fff3e0',padding:16,borderRadius:10,border:'1px solid #FFE0B2'}}><div style={{fontSize:'0.8rem',color:'#888'}}>Due This Week</div><div style={{fontSize:'1.5rem',fontWeight:800,color:'#E65100'}}>{fmt(liabSum.totalDueThisWeek)}</div><div style={{fontSize:'0.8rem',color:'#888'}}>{liabSum.dueThisWeekCount} bills</div></div>
      <div style={{background:'#f5f5f5',padding:16,borderRadius:10,border:'1px solid #e0e0e0'}}><div style={{fontSize:'0.8rem',color:'#888'}}>Total Unpaid</div><div style={{fontSize:'1.5rem',fontWeight:800,color:'#333'}}>{fmt(liabSum.totalUnpaid)}</div></div>
      {liabSum.pendingReview > 0 && <div style={{padding:16,borderRadius:10,background:'#fff8e1',border:'2px solid #ff9800',cursor:'pointer'}} onClick={()=>setLiabF('pending_review')}><div style={{fontSize:'0.8rem',color:'#888'}}>Pending Review</div><div style={{fontSize:'1.5rem',fontWeight:800,color:'#E65100'}}>{liabSum.pendingReview}</div><div style={{fontSize:'0.75rem',color:'#ff9800',fontWeight:600}}>🤖 AI detected</div></div>}
    </div>)}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
      <div style={{display:'flex',gap:4}}>{['unpaid','paid','pending_review','all'].map(s=><button key={s} onClick={()=>setLiabF(s)} style={{padding:'6px 14px',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600,fontSize:'0.85rem',background:liabF===s?'#1976d2':'#f0f0f0',color:liabF===s?'white':'#555'}}>{s==='pending_review'?`Pending${liabSum?.pendingReview?' ('+liabSum.pendingReview+')':''}`:s.charAt(0).toUpperCase()+s.slice(1)}</button>)}</div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <select className="form-select" value={liabCat} onChange={e=>setLiabCat(e.target.value)} style={{width:160}}><option value="all">All Categories</option>{LB_CATS.map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}</select>
        <button className="btn btn-primary" onClick={()=>{setEditBill(null);setBf({name:'',category:'other',amount:'',dueDate:'',recurring:false,recurringInterval:'monthly',vendor:'',notes:'',referenceNumber:'',vendorInvoiceNumber:'',poNumber:''});setShowBill(true);}}><Plus size={16}/> Add Bill</button>
      </div>
    </div>
    {liabLoad?<div style={{textAlign:'center',padding:40}}>Loading...</div>:liabs.length===0?<div style={{textAlign:'center',padding:40,color:'#888'}}>No bills found</div>:
    <div style={{display:'flex',flexDirection:'column',gap:8}}>{liabs.map(b=>{const cat=LB_CATS.find(c=>c.key===b.category)||LB_CATS[7];const d=daysUntil(b.dueDate);const od=d!==null&&d<0&&b.status==='unpaid';const ds=d!==null&&d>=0&&d<=7&&b.status==='unpaid';const isPending=b.status==='pending_review';return(
      <div key={b.id} style={{padding:'12px 16px',borderRadius:8,display:'flex',alignItems:'center',gap:12,background:isPending?'#fff8e1':b.status==='paid'?'#f9f9f9':od?'#ffebee':ds?'#fff8e1':'white',border:`1px solid ${isPending?'#ff9800':od?'#ef9a9a':ds?'#ffe082':'#e0e0e0'}`,opacity:b.status==='paid'?0.7:1}}>
        <div style={{width:36,height:36,borderRadius:8,background:cat.color+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0}}>{cat.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:'0.95rem',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            {b.name}
            {isPending&&<span style={{fontSize:'0.7rem',background:'#ff9800',color:'white',padding:'1px 6px',borderRadius:4}}>🤖 PENDING REVIEW</span>}
            {b.recurring&&<span style={{fontSize:'0.7rem',background:'#e3f2fd',color:'#1565c0',padding:'1px 6px',borderRadius:4}}>🔄 {b.recurringInterval}</span>}
            {od&&<span style={{fontSize:'0.7rem',background:'#c62828',color:'white',padding:'1px 6px',borderRadius:4}}>OVERDUE</span>}
            {b.createdBy==='email_scanner'&&<span style={{fontSize:'0.65rem',background:'#f3e5f5',color:'#7b1fa2',padding:'1px 5px',borderRadius:3}}>📧 Auto</span>}
          </div>
          <div style={{fontSize:'0.8rem',color:'#888',display:'flex',gap:12,flexWrap:'wrap'}}>
            {b.vendor&&<span>{b.vendor}</span>}
            {b.vendorInvoiceNumber&&<span>Inv: {b.vendorInvoiceNumber}</span>}
            {b.poNumber&&<span style={{color:'#1565c0',fontWeight:500}}>PO: {b.poNumber}</span>}
            {b.dueDate&&<span>Due: {new Date(b.dueDate+'T12:00:00').toLocaleDateString()}</span>}
            {d!==null&&b.status==='unpaid'&&<span style={{color:od?'#c62828':ds?'#E65100':'#888',fontWeight:od||ds?600:400}}>{od?`${Math.abs(d)}d overdue`:d===0?'Due today':`${d}d left`}</span>}
            {b.status==='paid'&&b.paidAt&&<span style={{color:'#2e7d32'}}>Paid {new Date(b.paidAt).toLocaleDateString()}</span>}
            {b.invoiceFileUrl&&<a href={b.invoiceFileUrl} target="_blank" rel="noopener noreferrer" style={{color:'#1976d2',textDecoration:'none'}}>📄 PDF</a>}
          </div>
        </div>
        <div style={{fontWeight:700,fontSize:'1.1rem',color:b.status==='paid'?'#888':'#333',whiteSpace:'nowrap'}}>{fmt(b.amount)}</div>
        <div style={{display:'flex',gap:4,flexShrink:0}}>
          {isPending&&<button onClick={async()=>{try{await approveBill(b.id);showMsg('Approved');await loadLiabs();}catch{}}} style={{background:'#2e7d32',color:'white',border:'none',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontWeight:600,fontSize:'0.8rem'}}>✓ Approve</button>}
          {isPending&&<button onClick={async()=>{if(!window.confirm('Reject and delete this bill?'))return;try{await rejectBill(b.id);showMsg('Rejected');await loadLiabs();}catch{}}} style={{background:'#c62828',color:'white',border:'none',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontWeight:600,fontSize:'0.8rem'}}>✕ Reject</button>}
          {b.status==='unpaid'&&<button onClick={async()=>{if(!window.confirm(`Pay "${b.name}"?`))return;try{await payLiability(b.id);showMsg('Paid');await loadLiabs();}catch{}}} style={{background:'#2e7d32',color:'white',border:'none',borderRadius:6,padding:'6px 12px',cursor:'pointer',fontWeight:600,fontSize:'0.8rem'}}>✓ Pay</button>}
          <button onClick={()=>{setEditBill(b);setBf({name:b.name,category:b.category,amount:b.amount,dueDate:b.dueDate||'',recurring:b.recurring,recurringInterval:b.recurringInterval||'monthly',vendor:b.vendor||'',notes:b.notes||'',referenceNumber:b.referenceNumber||'',vendorInvoiceNumber:b.vendorInvoiceNumber||'',poNumber:b.poNumber||''});setShowBill(true);}} style={{background:'#f0f0f0',border:'none',borderRadius:6,padding:'6px 8px',cursor:'pointer',fontSize:'0.8rem'}}>✏️</button>
          <button onClick={async()=>{if(!window.confirm(`Delete?`))return;try{await deleteLiability(b.id);await loadLiabs();}catch{}}} style={{background:'none',border:'1px solid #e0e0e0',borderRadius:6,padding:'6px 8px',cursor:'pointer',color:'#c62828',fontSize:'0.8rem'}}>🗑️</button>
        </div>
      </div>);})}</div>}
    {showBill&&(<div className="modal-overlay" onClick={()=>setShowBill(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:580}}>
      <div className="modal-header"><h3 className="modal-title">{editBill?'Edit':'Add'} Bill</h3><button className="modal-close" onClick={()=>setShowBill(false)}>&times;</button></div>
      <div style={{padding:20,display:'flex',flexDirection:'column',gap:12,maxHeight:'70vh',overflowY:'auto'}}>
        <div className="form-group" style={{margin:0}}><label className="form-label">Name *</label><input className="form-input" value={bf.name} onChange={e=>setBf({...bf,name:e.target.value})}/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="form-group" style={{margin:0}}><label className="form-label">Category</label><select className="form-select" value={bf.category} onChange={e=>setBf({...bf,category:e.target.value})}>{LB_CATS.map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}</select></div><div className="form-group" style={{margin:0}}><label className="form-label">Amount *</label><input type="number" step="0.01" className="form-input" value={bf.amount} onChange={e=>setBf({...bf,amount:e.target.value})}/></div></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="form-group" style={{margin:0}}><label className="form-label">Due Date</label><input type="date" className="form-input" value={bf.dueDate} onChange={e=>setBf({...bf,dueDate:e.target.value})}/></div><div className="form-group" style={{margin:0}}><label className="form-label">Vendor</label><input className="form-input" value={bf.vendor} onChange={e=>setBf({...bf,vendor:e.target.value})}/></div></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="form-group" style={{margin:0}}><label className="form-label">Vendor Invoice #</label><input className="form-input" value={bf.vendorInvoiceNumber} onChange={e=>setBf({...bf,vendorInvoiceNumber:e.target.value})} placeholder="Vendor's invoice number"/></div><div className="form-group" style={{margin:0}}><label className="form-label">Our PO #</label><input className="form-input" value={bf.poNumber} onChange={e=>setBf({...bf,poNumber:e.target.value})} placeholder="PO number this invoice references"/></div></div>
        <div style={{display:'flex',alignItems:'center',gap:12}}><label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}><input type="checkbox" checked={bf.recurring} onChange={e=>setBf({...bf,recurring:e.target.checked})} style={{width:18,height:18}}/><span style={{fontWeight:500}}>Recurring</span></label>{bf.recurring&&<select className="form-select" value={bf.recurringInterval} onChange={e=>setBf({...bf,recurringInterval:e.target.value})} style={{width:140}}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>}</div>
        <div className="form-group" style={{margin:0}}><label className="form-label">Reference #</label><input className="form-input" value={bf.referenceNumber} onChange={e=>setBf({...bf,referenceNumber:e.target.value})}/></div>
        <div className="form-group" style={{margin:0}}><label className="form-label">Notes</label><textarea className="form-textarea" value={bf.notes} onChange={e=>setBf({...bf,notes:e.target.value})} rows={2}/></div>
        {/* File upload */}
        {editBill && (
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">📎 Invoice / Bill PDF</label>
            {editBill.invoiceFileUrl ? (
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <a href={editBill.invoiceFileUrl} target="_blank" rel="noopener noreferrer" style={{color:'#1976d2',fontWeight:600,fontSize:'0.85rem'}}>📄 View Attached PDF</a>
                <button type="button" onClick={() => billFileRef.current?.click()} style={{background:'#f0f0f0',border:'1px solid #ddd',borderRadius:4,padding:'4px 10px',cursor:'pointer',fontSize:'0.8rem'}}>Replace</button>
              </div>
            ) : (
              <button type="button" onClick={() => billFileRef.current?.click()} style={{background:'#e3f2fd',border:'1px solid #90caf9',borderRadius:6,padding:'8px 16px',cursor:'pointer',fontSize:'0.85rem',color:'#1565c0',fontWeight:600}}>📎 Attach Invoice PDF</button>
            )}
            <input ref={billFileRef} type="file" accept=".pdf,image/*" style={{display:'none'}} onChange={async(e)=>{
              const file = e.target.files[0]; if(!file) return;
              try { showMsg('Uploading...'); await uploadBillFile(editBill.id, file); showMsg('File attached'); await loadLiabs(); } catch { setErr('Upload failed'); }
            }} />
          </div>
            </div>
            </div>
            </div>
            </div>
        )}
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowBill(false)}>Cancel</button><button className="btn btn-primary" onClick={saveBill}>{editBill?'Update':'Add'}</button></div>
    </div></div>)}

  );
}
