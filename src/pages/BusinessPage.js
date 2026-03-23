import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Receipt, Users, BarChart3, Plus, DollarSign } from 'lucide-react';
import { getLiabilities, getLiabilitySummary, createLiability, updateLiability, payLiability, deleteLiability, uploadBillFile, approveBill, rejectBill, getEmployees, createEmployee, updateEmployee, deleteEmployee, getPayrolls, createPayroll, updatePayrollEntry, updatePayrollWeek, submitPayroll, getWorkOrders, getOutstandingPayments, getPaymentHistory, recordBusinessPayment, clearBusinessPayment } from '../services/api';
import InvoiceCenterPage from './InvoiceCenterPage';

const LB_CATS = [
  { key: 'materials', label: 'Materials', icon: '🧱', color: '#E65100' },
  { key: 'insurance', label: 'Insurance', icon: '🛡️', color: '#1565C0' },
  { key: 'supplies', label: 'Supplies', icon: '🔧', color: '#2E7D32' },
  { key: 'utilities', label: 'Utilities', icon: '💡', color: '#F9A825' },
  { key: 'rent', label: 'Rent/Lease', icon: '🏭', color: '#6A1B9A' },
  { key: 'equipment', label: 'Equipment', icon: '⚙️', color: '#00838F' },
  { key: 'payroll', label: 'Payroll', icon: '👥', color: '#C62828' },
  { key: 'other', label: 'Other', icon: '📎', color: '#616161' }
];
const OT_INC = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8];
const fmt = (v) => '$' + (parseFloat(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

function BusinessPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'invoicing';
  const setTab = (t) => setSp({ tab: t }, { replace: true });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  // Liabilities
  const [liabs, setLiabs] = useState([]);
  const [liabSum, setLiabSum] = useState(null);
  const [liabLoad, setLiabLoad] = useState(false);
  const [liabF, setLiabF] = useState('unpaid');
  const [liabCat, setLiabCat] = useState('all');
  const [showBill, setShowBill] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [bf, setBf] = useState({ name:'',category:'other',amount:'',dueDate:'',recurring:false,recurringInterval:'monthly',vendor:'',notes:'',referenceNumber:'',vendorInvoiceNumber:'',poNumber:'' });
  const billFileRef = React.useRef(null);

  // Employees
  const [emps, setEmps] = useState([]);
  const [empLoad, setEmpLoad] = useState(false);
  const [showEmp, setShowEmp] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [ef, setEf] = useState({ name:'',phone:'',hourlyRate:'',role:'',startDate:'' });

  // Payroll
  const [payrolls, setPayrolls] = useState([]);
  const [activePR, setActivePR] = useState(null);
  const [showNewPR, setShowNewPR] = useState(false);
  const [prDates, setPrDates] = useState({ weekStart:'',weekEnd:'' });
  const [otModal, setOtModal] = useState(null);
  const [otDate, setOtDate] = useState('');
  const [otHrs, setOtHrs] = useState(0.5);

  // Health
  const [health, setHealth] = useState(null);
  const [healthLoad, setHealthLoad] = useState(false);

  // Payments
  const [outstanding, setOutstanding] = useState(null);
  const [payHistory, setPayHistory] = useState(null);
  const [payTab, setPayTab] = useState('outstanding');
  const [payLoading, setPayLoading] = useState(false);
  const [showRecordPay, setShowRecordPay] = useState(null); // WO id
  const [payForm, setPayForm] = useState({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'check', paymentReference: '' });

  useEffect(() => {
    if (tab === 'liabilities') loadLiabs();
    if (tab === 'employees') { loadEmps(); loadPR(); }
    if (tab === 'health') loadHealth();
    if (tab === 'payments') loadPayments();
  }, [tab, liabF, liabCat]);

  const loadLiabs = async () => { try { setLiabLoad(true); const [a,b] = await Promise.all([getLiabilities({status:liabF,category:liabCat}),getLiabilitySummary()]); setLiabs(a.data.data||[]); setLiabSum(b.data.data); } catch{} finally{setLiabLoad(false);} };
  const loadPayments = async () => { try { setPayLoading(true); const [a,b] = await Promise.all([getOutstandingPayments(), getPaymentHistory()]); setOutstanding(a.data.data); setPayHistory(b.data.data); } catch{} finally{setPayLoading(false);} };
  const loadEmps = async () => { try { setEmpLoad(true); const r = await getEmployees({active:'all'}); setEmps(r.data.data||[]); } catch{} finally{setEmpLoad(false);} };
  const loadPR = async () => { try { const r = await getPayrolls(); setPayrolls(r.data.data||[]); } catch{} };
  const loadHealth = async () => {
    try {
      setHealthLoad(true);
      const [woR, lR] = await Promise.all([getWorkOrders({archived:'false',view:'list'}), getLiabilities({status:'paid'})]);
      const wos = woR.data.data||[], bills = lR.data.data||[];
      let rev=0; wos.forEach(w => rev += parseFloat(w.grandTotal)||0);
      const byCat = {}; let exp=0;
      bills.forEach(b => { const c=b.category||'other', a=parseFloat(b.paidAmount||b.amount)||0; byCat[c]=(byCat[c]||0)+a; exp+=a; });
      setHealth({totalRevenue:rev,totalExpenses:exp,profit:rev-exp,expensesByCategory:byCat,woCount:wos.length,billCount:bills.length});
    } catch{setErr('Failed to load');} finally{setHealthLoad(false);}
  };

  const saveBill = async () => { if(!bf.name||!bf.amount){setErr('Name & amount required');return;} try{if(editBill)await updateLiability(editBill.id,bf);else await createLiability(bf);setShowBill(false);setEditBill(null);setBf({name:'',category:'other',amount:'',dueDate:'',recurring:false,recurringInterval:'monthly',vendor:'',notes:'',referenceNumber:'',vendorInvoiceNumber:'',poNumber:''});showMsg(editBill?'Updated':'Added');await loadLiabs();}catch{setErr('Failed');}};
  const saveEmp = async () => { if(!ef.name||!ef.hourlyRate){setErr('Name & rate required');return;} try{if(editEmp)await updateEmployee(editEmp.id,ef);else await createEmployee(ef);setShowEmp(false);setEditEmp(null);setEf({name:'',phone:'',hourlyRate:'',role:'',startDate:''});showMsg(editEmp?'Updated':'Added');await loadEmps();}catch{setErr('Failed');}};

  const createPR = async () => { if(!prDates.weekStart||!prDates.weekEnd){setErr('Select dates');return;} try{const r=await createPayroll(prDates);setActivePR(r.data.data);setShowNewPR(false);showMsg('Created');await loadPR();}catch(e){setErr(e.response?.data?.error?.message||'Failed');}};
  const updateEntry = async (entry, upd) => { if(!activePR)return; try{await updatePayrollEntry(activePR.id,entry.id,upd);const r=await getPayrolls();setPayrolls(r.data.data||[]);const u=(r.data.data||[]).find(p=>p.id===activePR.id);if(u)setActivePR(u);}catch{setErr('Failed');}};
  const addOT = async (entry) => { if(!otDate)return; const d=[...(entry.overtimeDetails||[]),{date:otDate,hours:otHrs}]; await updateEntry(entry,{overtimeDetails:d,overtimeHours:d.reduce((s,x)=>s+x.hours,0)}); setOtModal(null);setOtDate('');setOtHrs(0.5); };

  const TABS = [
    {key:'invoicing',label:'Invoicing',icon:<FileText size={16}/>},
    {key:'liabilities',label:'Bills & Liabilities',icon:<Receipt size={16}/>},
    {key:'payments',label:'Payment Center',icon:<DollarSign size={16}/>},
    {key:'employees',label:'Employees & Payroll',icon:<Users size={16}/>},
    {key:'health',label:'Company Health',icon:<BarChart3 size={16}/>}
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{marginBottom:0}}><h1 className="page-title">💼 Business Center</h1></div>
      {err && <div className="alert alert-error" style={{marginBottom:12}}>{err} <button onClick={()=>setErr(null)} style={{float:'right',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>}
      {msg && <div className="alert alert-success" style={{marginBottom:12}}>{msg}</div>}

      <div style={{display:'flex',gap:0,borderBottom:'2px solid #e0e0e0',marginBottom:16,overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{padding:'10px 16px',border:'none',cursor:'pointer',background:tab===t.key?'#1976d2':'transparent',color:tab===t.key?'white':'#555',fontWeight:tab===t.key?700:500,fontSize:'0.9rem',borderRadius:'8px 8px 0 0',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'invoicing' && <InvoiceCenterPage embedded={true} />}

      {/* LIABILITIES */}
      {tab === 'liabilities' && (<div>
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
            )}
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowBill(false)}>Cancel</button><button className="btn btn-primary" onClick={saveBill}>{editBill?'Update':'Add'}</button></div>
        </div></div>)}
      </div>)}

      {/* PAYMENT CENTER */}
      {tab === 'payments' && (<div>
        {payLoading ? <div style={{textAlign:'center',padding:40}}>Loading...</div> : (<>
          {/* Summary Cards */}
          {outstanding && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
              <div style={{padding:16,borderRadius:10,background:'#fff3e0',border:'1px solid #FFE0B2'}}>
                <div style={{fontSize:'0.8rem',color:'#888'}}>Outstanding</div>
                <div style={{fontSize:'1.5rem',fontWeight:800,color:'#E65100'}}>{fmt(outstanding.totalOutstanding)}</div>
                <div style={{fontSize:'0.8rem',color:'#888'}}>{outstanding.count} invoices</div>
              </div>
              <div style={{padding:16,borderRadius:10,background:outstanding.over30>0?'#ffebee':'#e8f5e9',border:`1px solid ${outstanding.over30>0?'#ef9a9a':'#c8e6c9'}`}}>
                <div style={{fontSize:'0.8rem',color:'#888'}}>Over 30 Days</div>
                <div style={{fontSize:'1.5rem',fontWeight:800,color:outstanding.over30>0?'#c62828':'#2e7d32'}}>{outstanding.over30}</div>
              </div>
              <div style={{padding:16,borderRadius:10,background:outstanding.over60>0?'#ffebee':'#e8f5e9',border:`1px solid ${outstanding.over60>0?'#ef9a9a':'#c8e6c9'}`}}>
                <div style={{fontSize:'0.8rem',color:'#888'}}>Over 60 Days</div>
                <div style={{fontSize:'1.5rem',fontWeight:800,color:outstanding.over60>0?'#c62828':'#2e7d32'}}>{outstanding.over60}</div>
              </div>
              <div style={{padding:16,borderRadius:10,background:'#e8f5e9',border:'1px solid #c8e6c9'}}>
                <div style={{fontSize:'0.8rem',color:'#888'}}>Total Received</div>
                <div style={{fontSize:'1.5rem',fontWeight:800,color:'#2e7d32'}}>{fmt(payHistory?.totalReceived||0)}</div>
                <div style={{fontSize:'0.8rem',color:'#888'}}>{payHistory?.count||0} payments</div>
              </div>
            </div>
          )}

          {/* Sub-tabs */}
          <div style={{display:'flex',gap:4,marginBottom:16}}>
            {['outstanding','history'].map(s=><button key={s} onClick={()=>setPayTab(s)} style={{padding:'6px 14px',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600,fontSize:'0.85rem',background:payTab===s?'#1976d2':'#f0f0f0',color:payTab===s?'white':'#555'}}>{s==='outstanding'?`Awaiting Payment (${outstanding?.count||0})`:`Payment History (${payHistory?.count||0})`}</button>)}
          </div>

          {/* Outstanding Invoices */}
          {payTab === 'outstanding' && outstanding && (
            outstanding.invoices.length === 0 ? <div style={{textAlign:'center',padding:40,color:'#888'}}>🎉 No outstanding invoices!</div> : (
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.85rem'}}>
                <thead><tr style={{background:'#fafafa'}}>
                  <th style={{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid #e0e0e0'}}>Invoice</th>
                  <th style={{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid #e0e0e0'}}>Client</th>
                  <th style={{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid #e0e0e0'}}>Work Order</th>
                  <th style={{padding:'10px 12px',textAlign:'right',borderBottom:'2px solid #e0e0e0'}}>Amount</th>
                  <th style={{padding:'10px 12px',textAlign:'center',borderBottom:'2px solid #e0e0e0'}}>Age</th>
                  <th style={{padding:'10px 12px',textAlign:'center',borderBottom:'2px solid #e0e0e0',width:180}}>Action</th>
                </tr></thead>
                <tbody>{outstanding.invoices.map(inv=>{
                  const age = inv.daysOutstanding;
                  const ageColor = age>90?'#c62828':age>60?'#d84315':age>30?'#E65100':'#555';
                  return (
                    <tr key={inv.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                      <td style={{padding:'10px 12px',fontWeight:600}}>{inv.invoiceNumber}</td>
                      <td style={{padding:'10px 12px'}}>{inv.clientName}{inv.clientPurchaseOrderNumber&&<div style={{fontSize:'0.75rem',color:'#888'}}>PO: {inv.clientPurchaseOrderNumber}</div>}</td>
                      <td style={{padding:'10px 12px'}}><a href={`/workorder/${inv.id}`} style={{color:'#1976d2',textDecoration:'none',fontWeight:600}}>{inv.drNumber?`DR-${inv.drNumber}`:inv.orderNumber}</a></td>
                      <td style={{padding:'10px 12px',textAlign:'right',fontWeight:700}}>{fmt(inv.grandTotal)}</td>
                      <td style={{padding:'10px 12px',textAlign:'center',fontWeight:600,color:ageColor}}>{age}d</td>
                      <td style={{padding:'6px 12px',textAlign:'center'}}>
                        {showRecordPay===inv.id ? (
                          <div style={{display:'flex',gap:4,alignItems:'center'}}>
                            <select className="form-select" value={payForm.paymentMethod} onChange={e=>setPayForm({...payForm,paymentMethod:e.target.value})} style={{width:80,padding:'4px',fontSize:'0.8rem'}}>
                              <option value="check">Check</option>
                              <option value="ach">ACH</option>
                              <option value="wire">Wire</option>
                              <option value="cash">Cash</option>
                              <option value="credit_card">Card</option>
                            </select>
                            <input className="form-input" placeholder="Ref#" value={payForm.paymentReference} onChange={e=>setPayForm({...payForm,paymentReference:e.target.value})} style={{width:80,padding:'4px',fontSize:'0.8rem'}}/>
                            <button onClick={async()=>{try{await recordBusinessPayment(inv.id,payForm);showMsg(`Payment recorded for ${inv.invoiceNumber}`);setShowRecordPay(null);await loadPayments();}catch{setErr('Failed');}}} style={{background:'#2e7d32',color:'white',border:'none',borderRadius:4,padding:'4px 8px',cursor:'pointer',fontWeight:600,fontSize:'0.8rem'}}>✓</button>
                            <button onClick={()=>setShowRecordPay(null)} style={{background:'none',border:'1px solid #ddd',borderRadius:4,padding:'4px 6px',cursor:'pointer',fontSize:'0.8rem'}}>✕</button>
                          </div>
                        ) : (
                          <button onClick={()=>{setShowRecordPay(inv.id);setPayForm({paymentDate:new Date().toISOString().split('T')[0],paymentMethod:'check',paymentReference:''});}} style={{background:'#2e7d32',color:'white',border:'none',borderRadius:6,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:'0.8rem'}}>💰 Record Payment</button>
                        )}
                      </td>
                    </tr>);
                })}</tbody>
              </table>
            </div>)
          )}

          {/* Payment History */}
          {payTab === 'history' && payHistory && (
            payHistory.payments.length === 0 ? <div style={{textAlign:'center',padding:40,color:'#888'}}>No payments recorded yet</div> : (
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.85rem'}}>
                <thead><tr style={{background:'#fafafa'}}>
                  <th style={{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid #e0e0e0'}}>Date</th>
                  <th style={{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid #e0e0e0'}}>Client</th>
                  <th style={{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid #e0e0e0'}}>Invoice</th>
                  <th style={{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid #e0e0e0'}}>Work Order</th>
                  <th style={{padding:'10px 12px',textAlign:'center',borderBottom:'2px solid #e0e0e0'}}>Method</th>
                  <th style={{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid #e0e0e0'}}>Reference</th>
                  <th style={{padding:'10px 12px',textAlign:'right',borderBottom:'2px solid #e0e0e0'}}>Amount</th>
                  <th style={{padding:'10px 12px',textAlign:'center',borderBottom:'2px solid #e0e0e0',width:60}}></th>
                </tr></thead>
                <tbody>{payHistory.payments.map(p=>(
                  <tr key={p.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                    <td style={{padding:'10px 12px',fontWeight:500}}>{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td style={{padding:'10px 12px'}}>{p.clientName}</td>
                    <td style={{padding:'10px 12px',fontWeight:600}}>{p.invoiceNumber}</td>
                    <td style={{padding:'10px 12px'}}><a href={`/workorder/${p.id}`} style={{color:'#1976d2',textDecoration:'none'}}>{p.drNumber?`DR-${p.drNumber}`:p.orderNumber}</a></td>
                    <td style={{padding:'10px 12px',textAlign:'center'}}><span style={{padding:'2px 8px',borderRadius:4,fontSize:'0.75rem',fontWeight:600,background:'#e3f2fd',color:'#1565c0'}}>{p.paymentMethod||'—'}</span></td>
                    <td style={{padding:'10px 12px',color:'#666'}}>{p.paymentReference||'—'}</td>
                    <td style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:'#2e7d32'}}>{fmt(p.grandTotal)}</td>
                    <td style={{padding:'10px 12px',textAlign:'center'}}><button onClick={async()=>{if(!window.confirm('Undo this payment?'))return;try{await clearBusinessPayment(p.id);showMsg('Payment cleared');await loadPayments();}catch{}}} style={{background:'none',border:'none',cursor:'pointer',color:'#c62828',fontSize:'0.8rem'}} title="Undo payment">↩️</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>)
          )}
        </>)}
      </div>)}

      {/* EMPLOYEES & PAYROLL */}
      {tab === 'employees' && (<div>
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h3 style={{margin:0}}>👥 Employee Roster</h3><button className="btn btn-primary btn-sm" onClick={()=>{setEditEmp(null);setEf({name:'',phone:'',hourlyRate:'',role:'',startDate:''});setShowEmp(true);}}><Plus size={16}/> Add Employee</button></div>
          {empLoad?<div style={{textAlign:'center',padding:20}}>Loading...</div>:emps.length===0?<div style={{textAlign:'center',padding:20,color:'#888'}}>No employees yet</div>:
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>{emps.map(e=>(
            <div key={e.id} style={{padding:16,borderRadius:10,border:'1px solid #e0e0e0',background:e.isActive?'white':'#f9f9f9',opacity:e.isActive?1:0.6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div><div style={{fontWeight:700,fontSize:'1rem'}}>{e.name}</div>{e.role&&<div style={{fontSize:'0.85rem',color:'#1976d2'}}>{e.role}</div>}</div>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>{setEditEmp(e);setEf({name:e.name,phone:e.phone||'',hourlyRate:e.hourlyRate,role:e.role||'',startDate:e.startDate||''});setShowEmp(true);}} style={{background:'#f0f0f0',border:'none',borderRadius:4,padding:'4px 6px',cursor:'pointer',fontSize:'0.8rem'}}>✏️</button>
                  {e.isActive&&<button onClick={async()=>{if(!window.confirm(`Deactivate ${e.name}?`))return;try{await deleteEmployee(e.id);await loadEmps();}catch{}}} style={{background:'none',border:'1px solid #e0e0e0',borderRadius:4,padding:'4px 6px',cursor:'pointer',color:'#c62828',fontSize:'0.8rem'}}>✕</button>}
                </div>
              </div>
              <div style={{marginTop:8,fontSize:'0.85rem',color:'#555'}}>
                <div style={{fontWeight:700,color:'#2e7d32',fontSize:'1.1rem'}}>{fmt(e.hourlyRate)}/hr</div>
                {e.phone&&<div>📞 {e.phone}</div>}
                {e.startDate&&<div>Started: {new Date(e.startDate+'T12:00:00').toLocaleDateString()}</div>}
                {!e.isActive&&<div style={{color:'#c62828',fontWeight:600}}>Inactive</div>}
              </div>
            </div>))}</div>}
        </div>

        {/* Payroll */}
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h3 style={{margin:0}}>📊 Weekly Payroll</h3><button className="btn btn-primary btn-sm" onClick={()=>setShowNewPR(true)}><Plus size={16}/> Create Weekly Payroll</button></div>
          {activePR&&(<div style={{marginBottom:20,padding:16,background:'#f0f7ff',borderRadius:10,border:'2px solid #1976d2'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                {activePR.status==='draft'?(
                  <>
                    <input type="date" className="form-input" defaultValue={activePR.weekStart} onBlur={async(e)=>{const s=e.target.value;if(s&&s!==activePR.weekStart){try{const r=await updatePayrollWeek(activePR.id,{weekStart:s});setActivePR(r.data.data);await loadPR();}catch{}}}} style={{width:150,padding:'4px 8px',fontWeight:600}}/>
                    <span>—</span>
                    <input type="date" className="form-input" defaultValue={activePR.weekEnd} onBlur={async(e)=>{const s=e.target.value;if(s&&s!==activePR.weekEnd){try{const r=await updatePayrollWeek(activePR.id,{weekEnd:s});setActivePR(r.data.data);await loadPR();}catch{}}}} style={{width:150,padding:'4px 8px',fontWeight:600}}/>
                  </>
                ):(
                  <span style={{fontWeight:700,fontSize:'1rem'}}>{new Date(activePR.weekStart+'T12:00:00').toLocaleDateString()} — {new Date(activePR.weekEnd+'T12:00:00').toLocaleDateString()}</span>
                )}
                <span style={{padding:'2px 8px',borderRadius:4,fontSize:'0.8rem',fontWeight:600,background:activePR.status==='submitted'?'#c8e6c9':'#fff3e0',color:activePR.status==='submitted'?'#2e7d32':'#E65100'}}>{activePR.status==='submitted'?'✓ Submitted':'Draft'}</span>
              </div>
              <div style={{display:'flex',gap:8}}>{activePR.status==='draft'&&<button className="btn btn-sm" onClick={async()=>{if(!window.confirm('Submit payroll?'))return;try{await submitPayroll(activePR.id);showMsg('Submitted');setActivePR(null);await loadPR();}catch{setErr('Failed');}}} style={{background:'#2e7d32',color:'white'}}>📤 Submit</button>}<button className="btn btn-sm btn-outline" onClick={()=>setActivePR(null)}>Close</button></div>
            </div>
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.9rem'}}>
              <thead><tr style={{background:'#e3f2fd'}}><th style={{padding:'8px 12px',textAlign:'left'}}>Employee</th><th style={{padding:'8px',textAlign:'center',width:80}}>Rate</th><th style={{padding:'8px',textAlign:'center',width:90}}>Regular</th><th style={{padding:'8px',textAlign:'center',width:100}}>Overtime</th><th style={{padding:'8px',textAlign:'center',width:90}}>Vacation</th><th style={{padding:'8px',textAlign:'center',width:90}}>Bonus</th><th style={{padding:'8px 12px',textAlign:'right',width:100}}>Gross</th></tr></thead>
              <tbody>{(activePR.entries||[]).map(en=>(
                <tr key={en.id} style={{borderBottom:'1px solid #e0e0e0'}}>
                  <td style={{padding:'8px 12px',fontWeight:600}}>{en.employeeName}</td>
                  <td style={{padding:'8px',textAlign:'center',color:'#888'}}>{fmt(en.hourlyRate)}</td>
                  <td style={{padding:'4px 8px',textAlign:'center'}}>{activePR.status==='draft'?<input key={en.id+'-r-'+en.regularHours} type="number" step="0.5" className="form-input" defaultValue={en.regularHours} onBlur={e=>{const v=parseFloat(e.target.value)||0;if(v!==parseFloat(en.regularHours))updateEntry(en,{regularHours:v});}} onFocus={e=>e.target.select()} style={{width:70,textAlign:'center',padding:'4px'}}/>:en.regularHours}</td>
                  <td style={{padding:'4px 8px',textAlign:'center'}}><div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}><span style={{fontWeight:600,color:en.overtimeHours>0?'#E65100':'#888'}}>{en.overtimeHours}</span>{activePR.status==='draft'&&<button onClick={()=>{setOtModal(en.id);setOtDate('');setOtHrs(0.5);}} style={{background:'#ff9800',color:'white',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:'0.75rem'}}>+OT</button>}</div>{en.overtimeDetails&&en.overtimeDetails.length>0&&<div style={{fontSize:'0.7rem',color:'#888',marginTop:2}}>{en.overtimeDetails.map((d,i)=><span key={i}>{new Date(d.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}:{d.hours}h{i<en.overtimeDetails.length-1?', ':''}</span>)}</div>}</td>
                  <td style={{padding:'4px 8px',textAlign:'center'}}>{activePR.status==='draft'?<input key={en.id+'-v-'+en.vacationHours} type="number" step="0.5" className="form-input" defaultValue={en.vacationHours} onBlur={e=>{const v=parseFloat(e.target.value)||0;if(v!==parseFloat(en.vacationHours))updateEntry(en,{vacationHours:v});}} onFocus={e=>e.target.select()} style={{width:70,textAlign:'center',padding:'4px'}}/>:en.vacationHours}</td>
                  <td style={{padding:'4px 8px',textAlign:'center'}}>{activePR.status==='draft'?<input key={en.id+'-b-'+en.bonus} type="number" step="1" className="form-input" defaultValue={en.bonus} onBlur={e=>{const v=parseFloat(e.target.value)||0;if(v!==parseFloat(en.bonus))updateEntry(en,{bonus:v});}} onFocus={e=>e.target.select()} style={{width:70,textAlign:'center',padding:'4px'}}/>:fmt(en.bonus)}</td>
                  <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#2e7d32'}}>{fmt(en.grossPay)}</td>
                </tr>))}
                <tr style={{background:'#e8f5e9'}}><td colSpan={6} style={{padding:'10px 12px',fontWeight:700,textAlign:'right'}}>Total Gross</td><td style={{padding:'10px 12px',textAlign:'right',fontWeight:800,fontSize:'1.1rem',color:'#2e7d32'}}>{fmt(activePR.totalGross)}</td></tr>
              </tbody></table></div>
          </div>)}
          {payrolls.length>0&&<div><h4 style={{marginBottom:8,color:'#555'}}>Payroll History</h4><div style={{display:'flex',flexDirection:'column',gap:6}}>{payrolls.map(p=>(
            <div key={p.id} onClick={()=>setActivePR(p)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',borderRadius:8,border:'1px solid #e0e0e0',cursor:'pointer',background:activePR?.id===p.id?'#e3f2fd':'white'}}>
              <div><span style={{fontWeight:600}}>{new Date(p.weekStart+'T12:00:00').toLocaleDateString()} — {new Date(p.weekEnd+'T12:00:00').toLocaleDateString()}</span><span style={{marginLeft:8,padding:'1px 8px',borderRadius:4,fontSize:'0.75rem',fontWeight:600,background:p.status==='submitted'?'#c8e6c9':'#fff3e0',color:p.status==='submitted'?'#2e7d32':'#E65100'}}>{p.status}</span></div>
              <div style={{fontWeight:700}}>{fmt(p.totalGross)}</div>
            </div>))}</div></div>}
        </div>

        {/* Modals */}
        {showEmp&&<div className="modal-overlay" onClick={()=>setShowEmp(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:450}}>
          <div className="modal-header"><h3 className="modal-title">{editEmp?'Edit':'Add'} Employee</h3><button className="modal-close" onClick={()=>setShowEmp(false)}>&times;</button></div>
          <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
            <div className="form-group" style={{margin:0}}><label className="form-label">Name *</label><input className="form-input" value={ef.name} onChange={e=>setEf({...ef,name:e.target.value})}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="form-group" style={{margin:0}}><label className="form-label">Hourly Rate *</label><input type="number" step="0.01" className="form-input" value={ef.hourlyRate} onChange={e=>setEf({...ef,hourlyRate:e.target.value})}/></div><div className="form-group" style={{margin:0}}><label className="form-label">Phone</label><input className="form-input" value={ef.phone} onChange={e=>setEf({...ef,phone:e.target.value})}/></div></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="form-group" style={{margin:0}}><label className="form-label">Role</label><input className="form-input" value={ef.role} onChange={e=>setEf({...ef,role:e.target.value})} placeholder="e.g. Welder"/></div><div className="form-group" style={{margin:0}}><label className="form-label">Start Date</label><input type="date" className="form-input" value={ef.startDate} onChange={e=>setEf({...ef,startDate:e.target.value})}/></div></div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowEmp(false)}>Cancel</button><button className="btn btn-primary" onClick={saveEmp}>{editEmp?'Update':'Add'}</button></div>
        </div></div>}
        {showNewPR&&<div className="modal-overlay" onClick={()=>setShowNewPR(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
          <div className="modal-header"><h3 className="modal-title">Create Weekly Payroll</h3><button className="modal-close" onClick={()=>setShowNewPR(false)}>&times;</button></div>
          <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
            <div className="form-group" style={{margin:0}}><label className="form-label">Week Start (Monday)</label><input type="date" className="form-input" value={prDates.weekStart} onChange={e=>{const s=e.target.value;const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+6);setPrDates({weekStart:s,weekEnd:d.toISOString().split('T')[0]});}}/></div>
            <div className="form-group" style={{margin:0}}><label className="form-label">Week End (Sunday)</label><input type="date" className="form-input" value={prDates.weekEnd} readOnly style={{background:'#f5f5f5'}}/></div>
            <div style={{fontSize:'0.85rem',color:'#666'}}>All active employees added automatically.</div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowNewPR(false)}>Cancel</button><button className="btn btn-primary" onClick={createPR}>Create</button></div>
        </div></div>}
        {otModal&&<div className="modal-overlay" onClick={()=>setOtModal(null)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:350}}>
          <div className="modal-header"><h3 className="modal-title">Add Overtime</h3><button className="modal-close" onClick={()=>setOtModal(null)}>&times;</button></div>
          <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
            <div className="form-group" style={{margin:0}}><label className="form-label">Date</label><input type="date" className="form-input" value={otDate} onChange={e=>setOtDate(e.target.value)}/></div>
            <div className="form-group" style={{margin:0}}><label className="form-label">Hours</label><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{OT_INC.map(h=><button key={h} onClick={()=>setOtHrs(h)} style={{padding:'6px 12px',borderRadius:6,border:otHrs===h?'2px solid #1976d2':'1px solid #ddd',background:otHrs===h?'#e3f2fd':'white',cursor:'pointer',fontWeight:otHrs===h?700:400,fontSize:'0.85rem'}}>{h}h</button>)}</div></div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setOtModal(null)}>Cancel</button><button className="btn btn-primary" onClick={()=>{const en=(activePR?.entries||[]).find(e=>e.id===otModal);if(en)addOT(en);}}>Add {otHrs}h OT</button></div>
        </div></div>}
      </div>)}

      {/* COMPANY HEALTH */}
      {tab === 'health' && (<div>
        {healthLoad?<div style={{textAlign:'center',padding:40}}>Loading...</div>:health&&<div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
            <div style={{padding:20,borderRadius:12,background:'#E8F5E9',border:'2px solid #66BB6A',textAlign:'center'}}><div style={{fontSize:'0.85rem',color:'#555'}}>Total Revenue</div><div style={{fontSize:'2rem',fontWeight:800,color:'#2e7d32'}}>{fmt(health.totalRevenue)}</div><div style={{fontSize:'0.8rem',color:'#888'}}>{health.woCount} work orders</div></div>
            <div style={{padding:20,borderRadius:12,background:'#FFEBEE',border:'2px solid #EF5350',textAlign:'center'}}><div style={{fontSize:'0.85rem',color:'#555'}}>Total Expenses</div><div style={{fontSize:'2rem',fontWeight:800,color:'#c62828'}}>{fmt(health.totalExpenses)}</div><div style={{fontSize:'0.8rem',color:'#888'}}>{health.billCount} paid bills</div></div>
            <div style={{padding:20,borderRadius:12,background:health.profit>=0?'#E8F5E9':'#FFEBEE',border:`2px solid ${health.profit>=0?'#66BB6A':'#EF5350'}`,textAlign:'center'}}><div style={{fontSize:'0.85rem',color:'#555'}}>Profit</div><div style={{fontSize:'2rem',fontWeight:800,color:health.profit>=0?'#2e7d32':'#c62828'}}>{fmt(health.profit)}</div><div style={{fontSize:'0.8rem',color:'#888'}}>{health.totalRevenue>0?Math.round((health.profit/health.totalRevenue)*100):0}% margin</div></div>
          </div>
          <div className="card"><h3 style={{marginBottom:16}}>💸 Where Money Goes</h3>
            {Object.keys(health.expensesByCategory).length===0?<div style={{textAlign:'center',padding:20,color:'#888'}}>No paid bills yet. Track bills in Liabilities tab.</div>:
            <div>{(()=>{const s=Object.entries(health.expensesByCategory).sort((a,b)=>b[1]-a[1]);const mx=s[0]?.[1]||1;return s.map(([cat,amt])=>{const ci=LB_CATS.find(c=>c.key===cat)||{icon:'📎',label:cat,color:'#616161'};const pct=health.totalExpenses>0?Math.round((amt/health.totalExpenses)*100):0;return(<div key={cat} style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontWeight:600,fontSize:'0.9rem'}}>{ci.icon} {ci.label}</span><span style={{fontWeight:700}}>{fmt(amt)} <span style={{fontWeight:400,color:'#888',fontSize:'0.8rem'}}>({pct}%)</span></span></div><div style={{height:12,background:'#f0f0f0',borderRadius:6,overflow:'hidden'}}><div style={{height:'100%',width:`${(amt/mx)*100}%`,background:ci.color,borderRadius:6}}/></div></div>);});})()}</div>}
          </div>
        </div>}
      </div>)}
    </div>
  );
}

export default BusinessPage;
