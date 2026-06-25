import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  reorderEmployees, getPayrolls, createPayroll, updatePayrollEntry,
  updatePayrollWeek, submitPayroll, deletePayroll, sendPayrollEmail,
  previewPayrollPdf, updateVacationLog, getSettings, updateSettings,
  getEmailAccounts,
} from '../services/api';

const OT_INC = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,7,8,9,10,12];
const fmt = (v) => '$' + (parseFloat(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const formatPhone = (p) => { if(!p)return ''; const d=p.replace(/\D/g,''); return d.length===10?`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`:p; };
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

export default function EmployeesTab({ showMsg, setErr }) {
  // State
  const [emps, setEmps] = useState([]);
  const [empLoad, setEmpLoad] = useState(false);
  const [showEmp, setShowEmp] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [ef, setEf] = useState({name:'',phone:'',hourlyRate:'',role:'',startDate:'',controlNumber:'',deductions:'ACH 100%',description:'',annualVacationDays:''});
  const [payrolls, setPayrolls] = useState([]);
  const [activePR, setActivePR] = useState(null);
  const [showNewPR, setShowNewPR] = useState(false);
  const [prDates, setPrDates] = useState({weekStart:'',weekEnd:''});
  const [otEntry, setOtEntry] = useState(null);
  const [otList, setOtList] = useState([]);
  const [otNewDate, setOtNewDate] = useState('');
  const [otNewHrs, setOtNewHrs] = useState(1.5);
  const [showExtHrs, setShowExtHrs] = useState(false);
  const [extHrsEmps, setExtHrsEmps] = useState([]);
  const [extHrsDates, setExtHrsDates] = useState([]);
  const [extHrsHours, setExtHrsHours] = useState(1.5);
  const [extHrsSaving, setExtHrsSaving] = useState(false);
  const [vacEmp, setVacEmp] = useState(null);
  const [vacLog, setVacLog] = useState([]);
  const [vacNewDate, setVacNewDate] = useState('');
  const [vacNewHours, setVacNewHours] = useState('8');
  const [vacNewNote, setVacNewNote] = useState('');
  const [vacEntry, setVacEntry] = useState(null);
  const [vacEntryList, setVacEntryList] = useState([]);
  const [vacEntryNewDate, setVacEntryNewDate] = useState('');
  const [vacEntryNewHrs, setVacEntryNewHrs] = useState(8);
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [payrollSenderAccountId, setPayrollSenderAccountId] = useState('');
  const [sendingPayroll, setSendingPayroll] = useState(false);
  const [payrollEmail, setPayrollEmail] = useState('');
  const [payrollEmailEdit, setPayrollEmailEdit] = useState(false);
  const [payrollEmailSaving, setPayrollEmailSaving] = useState(false);

  useEffect(() => {
    loadEmps();
    loadPR();
    loadGmailAccounts();
    getSettings('payroll_sender_account').then(r => setPayrollSenderAccountId(r.data?.data?.value || '')).catch(()=>{});
    getSettings('payroll_email').then(r => setPayrollEmail(r.data?.data?.value || '')).catch(()=>{});
  }, []);

  const loadEmps = async () => { try { setEmpLoad(true); const r = await getEmployees({active:'all'}); setEmps(r.data.data||[]); } catch{} finally{setEmpLoad(false);} };
  const loadPR = async () => { try { const r = await getPayrolls(); setPayrolls(r.data.data||[]); } catch{} };
  const loadGmailAccounts = async () => { try { const r = await getEmailAccounts(); setGmailAccounts(r.data?.data||[]); } catch{} };

  const saveEmp = async () => {
    if(!ef.name||!ef.hourlyRate){setErr('Name & rate required');return;}
    try {
      const data={...ef};
      if(!data.annualVacationDays||data.annualVacationDays==='')data.annualVacationDays=0;
      if(!data.hourlyRate||data.hourlyRate==='')data.hourlyRate=0;
      if(!data.deductions)data.deductions='ACH 100%';
      if(editEmp)await updateEmployee(editEmp.id,data);else await createEmployee(data);
      setShowEmp(false);setEditEmp(null);
      setEf({name:'',phone:'',hourlyRate:'',role:'',startDate:'',controlNumber:'',deductions:'ACH 100%',description:'',annualVacationDays:''});
      showMsg(editEmp?'Updated':'Added');await loadEmps();
    }catch(e){setErr(e.response?.data?.error?.message||'Failed to save');}
  };

  const createPR = async () => {
    if(!prDates.weekStart||!prDates.weekEnd){setErr('Select dates');return;}
    try{const r=await createPayroll(prDates);setActivePR(r.data.data);setShowNewPR(false);showMsg('Created');await loadPR();}
    catch(e){setErr(e.response?.data?.error?.message||'Failed');}
  };

  const updateEntry = async (entry, upd) => {
    if(!activePR)return;
    try{
      const res=await updatePayrollEntry(activePR.id,entry.id,upd);
      const updated={...res.data.data,grossPay:parseFloat(res.data.data?.grossPay)||0};
      setActivePR(prev=>{
        if(!prev)return prev;
        const entries=(prev.entries||[]).map(e=>e.id===entry.id?{...e,...updated}:e);
        const totalGross=entries.reduce((s,e)=>s+(parseFloat(e.grossPay)||0),0);
        return{...prev,entries,totalGross};
      });
    }catch{setErr('Failed');}
  };

  const openOtEditor = (en) => { setOtEntry(en);setOtList([...(en.overtimeDetails||[])]);setOtNewDate('');setOtNewHrs(1.5); };
  const openVacEntryEditor = (en) => { setVacEntry(en);setVacEntryList([...(en.vacationDetails||[])]);setVacEntryNewDate('');setVacEntryNewHrs(8); };

  const saveOt = async () => {
    if(!otEntry)return;
    const totalOtHours=otList.reduce((s,x)=>s+(parseFloat(x.hours)||0),0);
    await updateEntry(otEntry,{overtimeDetails:otList,overtimeHours:totalOtHours});
    setOtEntry(null);setOtList([]);
  };

  const saveVacEntry = async () => {
    if(!vacEntry)return;
    const totalVacHours=vacEntryList.reduce((s,x)=>s+(parseFloat(x.hours)||0),0);
    await updateEntry(vacEntry,{vacationDetails:vacEntryList,vacationHours:totalVacHours});
    setVacEntry(null);setVacEntryList([]);
  };

  const applyExtHrs = async () => {
    if(extHrsEmps.length===0||extHrsDates.length===0){setErr('Select at least one employee and one date');return;}
    setExtHrsSaving(true);
    try{
      for(const entryId of extHrsEmps){
        const entry=(activePR?.entries||[]).find(e=>e.id===entryId);
        if(!entry)continue;
        const existing=[...(entry.overtimeDetails||[])];
        for(const date of extHrsDates){
          const idx=existing.findIndex(x=>x.date===date);
          if(idx>=0)existing[idx]={...existing[idx],hours:existing[idx].hours+extHrsHours};
          else existing.push({date,hours:extHrsHours});
        }
        existing.sort((a,b)=>a.date.localeCompare(b.date));
        const totalOt=existing.reduce((s,x)=>s+x.hours,0);
        await updateEntry(entry,{overtimeDetails:existing,overtimeHours:totalOt});
      }
      await loadPR();setShowExtHrs(false);
      showMsg(`Extended hours applied to ${extHrsEmps.length} employee(s) across ${extHrsDates.length} day(s)`);
    }catch{setErr('Failed to apply extended hours');}
    finally{setExtHrsSaving(false);}
  };

  const savePayrollEmail = async (email) => {
    setPayrollEmailSaving(true);
    try{await updateSettings('payroll_email',email);setPayrollEmail(email);setPayrollEmailEdit(false);showMsg('Saved');}
    catch{setErr('Failed');}finally{setPayrollEmailSaving(false);}
  };

  const savePayrollSenderAccount = async (id) => {
    try{await updateSettings('payroll_sender_account',id);setPayrollSenderAccountId(id);showMsg('Saved');}
    catch{setErr('Failed');}
  };

  const printPayrollService = (pr) => {
    const w=window.open('','_blank');if(!w)return;
    const sd=pr.weekStart?new Date(pr.weekStart+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }):'';
    const ed=pr.weekEnd?new Date(pr.weekEnd+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }):'';
    const css='.body{font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto}.hdr{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1976d2;padding-bottom:12px;margin-bottom:16px}.co{font-size:1.1rem;font-weight:700}.dt{font-size:0.9rem;color:#555}.dr{text-align:center;font-size:1.1rem;font-weight:600;margin-bottom:20px;color:#333}.emp{padding:12px;margin-bottom:12px;border:1px solid #e0e0e0;border-radius:6px}.en{font-size:1rem;font-weight:700;margin-bottom:6px}.r{display:flex;justify-content:space-between;padding:2px 0;font-size:0.9rem}.l{color:#666}.v{font-weight:600}.gp{display:flex;justify-content:space-between;padding:8px 0 0;border-top:1px solid #eee;font-size:1rem;font-weight:700;color:#1976d2}.tot{margin-top:16px;padding:12px;background:#e3f2fd;border-radius:6px;font-size:1.1rem;font-weight:700;text-align:center;color:#1565c0}.ft{margin-top:20px;padding-top:12px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:0.75rem;color:#888}';
    const entries=pr.entries||[];
    const cards=entries.map(en=>{const reg=parseFloat(en.regularHours)||0;const ot=parseFloat(en.overtimeHours)||0;const vac=parseFloat(en.vacationHours)||0;const rate=parseFloat(en.hourlyRate)||0;const bonus=parseFloat(en.bonusAmount)||0;const regPay=reg*rate;const otPay=ot*rate*1.5;const vacPay=vac*rate;const gross=parseFloat(en.grossPay)||0;const annual=parseFloat(en.annualVacationDays)||10;const totalVacH=(entries.filter(e=>e.employeeId===en.employeeId).reduce((s,e)=>s+(parseFloat(e.vacationHours)||0),0));const vacRem=(totalVacH/8);let h=`<div class="emp"><div class="en">${en.employeeName||'Unknown'}</div>`;if(reg>0)h+=`<div class="r"><span class="l">Regular (${reg}h @ ${fmt(rate)}/h)</span><span class="v">${fmt(regPay)}</span></div>`;if(ot>0)h+=`<div class="r"><span class="l">Overtime (${ot}h @ ${fmt(rate*1.5)}/h)</span><span class="v">${fmt(otPay)}</span></div>`;if(vac>0)h+=`<div class="r"><span class="l">Vacation (${vac}h @ ${fmt(rate)}/h)</span><span class="v">${fmt(vacPay)}</span></div>`;if(annual>0)h+=`<div class="bal">Vacation balance: ${vacRem.toFixed(1)} / ${parseFloat(annual).toFixed(1)} days</div>`;if(bonus>0)h+=`<div class="r"><span class="l">Bonus${en.bonusNotes?' — '+en.bonusNotes:''}</span><span class="v">${fmt(bonus)}</span></div>`;h+=`<div class="gp"><span>Gross Pay</span><span>${fmt(gross)}</span></div></div>`;return h;}).join('');
    const now=new Date();
    w.document.write(`<html><head><title>Payroll</title><style>${css}</style></head><body><div class="hdr"><img src="/logo.png" onerror="this.style.display='none'"/><div><div class="co">Carolina Rolling Co., Inc.</div><div class="dt">Payroll Summary</div></div></div><div class="dr">${sd} — ${ed}</div>${cards}<div class="tot">Total Gross Payroll: ${fmt(pr.totalGross)}</div><div class="ft"><span>Generated: ${now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${now.toLocaleTimeString()}</span><span>CONFIDENTIAL</span></div></body></html>`);
    w.document.close();w.print();
  };

  const printPayrollDetailed = printPayrollService;

  const previewPayrollPdfLocal = async (pr) => {
    try{const r=await previewPayrollPdf(pr.id);const blob=new Blob([r.data],{type:'application/pdf'});window.open(URL.createObjectURL(blob),'_blank');}
    catch{setErr('Preview failed');}
  };

  // Local wrappers
  const handleSendPayrollLocal = async (pr, accountId) => {
    if(!accountId){setErr('Select a Gmail account first');return;}
    setSendingPayroll(true);
    try{await sendPayrollEmail(pr.id,{accountId});showMsg('Payroll sent!');}
    catch(e){setErr(e.response?.data?.error?.message||'Failed to send');}
    finally{setSendingPayroll(false);}
  };
  const handleSubmitPRLocal = async (pr) => {
    try{await submitPayroll(pr.id);showMsg('Submitted');await loadPR();}
    catch{setErr('Failed to submit');}
  };
  const handleDeletePRLocal = async (pr) => {
    if(!window.confirm('Delete this payroll?'))return;
    try{await deletePayroll(pr.id);showMsg('Deleted');await loadPR();if(activePR?.id===pr.id)setActivePR(null);}
    catch{setErr('Failed');}
  };
  const handleDeleteEmpLocal = async (emp) => {
    if(!window.confirm(`Deactivate ${emp.name}?`))return;
    try{await deleteEmployee(emp.id);await loadEmps();}catch{}
  };
  const handleReactivateEmpLocal = async (emp) => {
    try{await updateEmployee(emp.id,{isActive:true});showMsg('Reactivated');await loadEmps();}
    catch{setErr('Failed');}
  };
  const handleMoveEmpLocal = async (updatedEmps) => {
    setEmps(updatedEmps);
    try{await reorderEmployees(updatedEmps.map((x,i)=>({id:x.id,sortOrder:i})));}catch{}
  };

  return (
    <div>
    <div className="card" style={{marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h3 style={{margin:0}}>👥 Employee Roster</h3><button className="btn btn-primary btn-sm" onClick={()=>{setEditEmp(null);setEf({name:'',phone:'',hourlyRate:'',role:'',startDate:'',controlNumber:'',deductions:'ACH 100%',description:'',annualVacationDays:''});setShowEmp(true);}}><Plus size={16}/> Add Employee</button></div>
      {empLoad?<div style={{textAlign:'center',padding:20}}>Loading...</div>:emps.length===0?<div style={{textAlign:'center',padding:20,color:'#888'}}>No employees yet</div>:
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>{emps.map(e=>(
        <div key={e.id} style={{padding:16,borderRadius:10,border:'1px solid #e0e0e0',background:e.isActive?'white':'#f9f9f9',opacity:e.isActive?1:0.6}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div><div style={{fontWeight:700,fontSize:'1rem'}}>{e.name}</div>{e.role&&<div style={{fontSize:'0.85rem',color:'#1976d2'}}>{e.role}</div>}</div>
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              <div style={{display:'flex',flexDirection:'column',gap:1}}>
                <button onClick={async()=>{const idx=emps.findIndex(x=>x.id===e.id);if(idx<=0)return;const updated=[...emps];[updated[idx-1],updated[idx]]=[updated[idx],updated[idx-1]];setEmps(updated);try{await reorderEmployees(updated.map((x,i)=>({id:x.id,sortOrder:i})));if(activePR){const entries=activePR.entries||[];const reordered=updated.map((x,i)=>({...entries.find(e=>e.employeeId===x.id)||{},sortOrder:i}));setActivePR(prev=>prev?{...prev,entries:entries.map(e=>{const u=reordered.find(r=>r.employeeId===e.employeeId);return u?{...e,sortOrder:u.sortOrder}:e;})}:prev);}}catch{}}} style={{background:'#f0f0f0',border:'none',borderRadius:3,padding:'1px 5px',cursor:'pointer',fontSize:'0.65rem',lineHeight:1}} title="Move up">▲</button>
                <button onClick={async()=>{const idx=emps.findIndex(x=>x.id===e.id);if(idx>=emps.length-1)return;const updated=[...emps];[updated[idx],updated[idx+1]]=[updated[idx+1],updated[idx]];setEmps(updated);try{await reorderEmployees(updated.map((x,i)=>({id:x.id,sortOrder:i})));if(activePR){const entries=activePR.entries||[];const reordered=updated.map((x,i)=>({...entries.find(e=>e.employeeId===x.id)||{},sortOrder:i}));setActivePR(prev=>prev?{...prev,entries:entries.map(e=>{const u=reordered.find(r=>r.employeeId===e.employeeId);return u?{...e,sortOrder:u.sortOrder}:e;})}:prev);}}catch{}}} style={{background:'#f0f0f0',border:'none',borderRadius:3,padding:'1px 5px',cursor:'pointer',fontSize:'0.65rem',lineHeight:1}} title="Move down">▼</button>
              </div>
              <button onClick={()=>{setEditEmp(e);setEf({name:e.name,phone:e.phone||'',hourlyRate:e.hourlyRate,role:e.role||'',startDate:e.startDate||'',controlNumber:e.controlNumber||'',deductions:e.deductions||'ACH 100%',description:e.description||'',annualVacationDays:e.annualVacationDays||''});setShowEmp(true);}} style={{background:'#f0f0f0',border:'none',borderRadius:4,padding:'4px 6px',cursor:'pointer',fontSize:'0.8rem'}}>✏️</button>
              {e.isActive&&<button onClick={async()=>{if(!window.confirm(`Deactivate ${e.name}?`))return;try{await deleteEmployee(e.id);await loadEmps();}catch{}}} style={{background:'none',border:'1px solid #e0e0e0',borderRadius:4,padding:'4px 6px',cursor:'pointer',color:'#c62828',fontSize:'0.8rem'}}>✕</button>}
            </div>
          </div>
          <div style={{marginTop:8,fontSize:'0.85rem',color:'#555'}}>
            <div style={{fontWeight:700,color:'#2e7d32',fontSize:'1.1rem'}}>{fmt(e.hourlyRate)}/hr</div>
            {e.phone&&<div>📞 {e.phone}</div>}
            {e.controlNumber&&<div style={{color:'#1565c0'}}>Control#: {e.controlNumber}</div>}
            {e.description&&<div style={{color:'#666',fontSize:'0.8rem'}}>{e.description}</div>}
            {e.deductions&&<div style={{color:'#888',fontSize:'0.8rem'}}>{e.deductions}</div>}
            {e.startDate&&<div>Started: {new Date(e.startDate+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>}
            {parseFloat(e.annualVacationDays)>0&&<div style={{marginTop:4}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{padding:'3px 8px',background:'#e3f2fd',borderRadius:4,fontSize:'0.8rem'}}>🏖️ {(parseFloat(e.annualVacationDays)-(parseFloat(e.vacationDaysUsed)||0)).toFixed(1)} / {parseFloat(e.annualVacationDays).toFixed(1)} days left</span>
                <button onClick={(ev)=>{ev.stopPropagation();setVacEmp(e);setVacLog([...(e.vacationLog||[])]);}} style={{background:'none',border:'1px solid #90caf9',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:'0.7rem',color:'#1565c0'}}>Edit</button>
              </div>
              {(()=>{const today=new Date().toISOString().split('T')[0];const upcoming=(e.vacationLog||[]).filter(v=>v.date>today).sort((a,b)=>a.date.localeCompare(b.date));return upcoming.length>0?<div style={{fontSize:'0.7rem',color:'#1565c0',marginTop:3}}>📅 Upcoming: {upcoming.slice(0,5).map((v,i)=><span key={i}>{new Date(v.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} ({v.hours}h){i<Math.min(upcoming.length,5)-1?', ':''}</span>)}{upcoming.length>5?` +${upcoming.length-5} more`:''}</div>:null;})()}
            </div>}
            {!e.isActive&&<div style={{color:'#c62828',fontWeight:600}}>Inactive</div>}
          </div>
        </div>))}</div>}
    </div>

    {/* Payroll Service Email Setting */}
    <div className="card" style={{marginBottom:12,padding:'12px 16px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:'1rem'}}>📧</span>
          <div>
            <div style={{fontWeight:700,fontSize:'0.9rem'}}>Payroll Service Email</div>
            <div style={{fontSize:'0.78rem',color:'#888'}}>Payroll sheet will be emailed here when submitted</div>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12,flex:1}}>
          {/* Recipient email */}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:'0.8rem',color:'#888',width:80,flexShrink:0}}>Send to:</span>
            {payrollEmailEdit ? (
              <div style={{display:'flex',gap:8,alignItems:'center',flex:1}}>
                <input className="form-input" type="email" value={payrollEmail} onChange={e=>setPayrollEmail(e.target.value)} placeholder="payroll@service.com" style={{flex:1}}/>
                <button className="btn btn-primary btn-sm" onClick={()=>savePayrollEmail(payrollEmail)} disabled={payrollEmailSaving}>{payrollEmailSaving?'Saving...':'Save'}</button>
                <button className="btn btn-sm btn-outline" onClick={()=>setPayrollEmailEdit(false)}>Cancel</button>
              </div>
            ) : (
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontWeight:600,color:payrollEmail?'#1565c0':'#bbb'}}>{payrollEmail||'Not set'}</span>
                <button className="btn btn-sm btn-outline" onClick={()=>setPayrollEmailEdit(true)}>✏️ {payrollEmail?'Change':'Set'}</button>
              </div>
            )}
          </div>
          {/* Sending account */}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:'0.8rem',color:'#888',width:80,flexShrink:0}}>Send from:</span>
            {gmailAccounts.length === 0 ? (
              <span style={{color:'#c62828',fontSize:'0.85rem'}}>No Gmail accounts connected — add one in Admin → Email Scanner</span>
            ) : (
              <select className="form-select" style={{flex:1,maxWidth:320}} value={payrollSenderAccountId} onChange={e=>{setPayrollSenderAccountId(e.target.value);savePayrollSenderAccount(e.target.value);}}>
                {gmailAccounts.map(a=><option key={a.id} value={a.id}>{a.email}{!a.isActive?' (inactive)':''}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>
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
              <span style={{fontWeight:700,fontSize:'1rem'}}>{new Date(activePR.weekStart+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} — {new Date(activePR.weekEnd+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
            )}
            <span style={{padding:'2px 8px',borderRadius:4,fontSize:'0.8rem',fontWeight:600,background:activePR.status==='submitted'?'#c8e6c9':'#fff3e0',color:activePR.status==='submitted'?'#2e7d32':'#E65100'}}>{activePR.status==='submitted'?'✓ Submitted':'Draft'}</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            {activePR.status==='draft'&&<button className="btn btn-sm" onClick={async()=>{
              try {
                const res = await previewPayrollPdfLocal(activePR);
                const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                window.open(url, '_blank');
              } catch { setErr('Failed to generate preview'); }
            }} style={{background:'#1565c0',color:'white'}}>👁️ Preview PDF</button>}
            {activePR.status==='draft'&&<button className="btn btn-sm" onClick={async()=>{
              if(!payrollEmail){setErr('Set a payroll service email address first');return;}
              const senderId = payrollSenderAccountId || (gmailAccounts[0]?.id);
              if(!senderId){setErr('No Gmail account connected — connect one in Admin → Email Scanner');return;}
              const senderAcc = gmailAccounts.find(a=>a.id===senderId);
              if(!window.confirm(`Submit payroll and send via ${senderAcc?.email||'Gmail'} to ${payrollEmail}?`))return;
              setSendingPayroll(true);
              try{
                const sd = new Date(activePR.weekStart+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
                const ed = new Date(activePR.weekEnd+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
                await sendPayrollEmail(activePR.id,{
                  gmailAccountId: senderId,
                  toEmail: payrollEmail,
                  subject: 'Carolina Rolling Payroll ' + sd + ' - ' + ed
                });
                await submitPayroll(activePR.id);
                showMsg('✅ Payroll submitted and emailed to ' + payrollEmail);
                setActivePR(null);await loadPR();await loadEmps();
              }catch(e){setErr('Failed to send: '+(e.response?.data?.error?.message||e.message));}
              finally{setSendingPayroll(false);}
            }} disabled={sendingPayroll} style={{background:'#2e7d32',color:'white'}}>
              {sendingPayroll?'Sending...':'📤 Submit & Email'}
            </button>}
            {activePR.status==='draft'&&<button className="btn btn-sm" onClick={async()=>{
              if(!window.confirm('Submit this payroll WITHOUT emailing it? It will be marked submitted and vacation balances will update, but no email will be sent.'))return;
              setSendingPayroll(true);
              try{
                await submitPayroll(activePR.id);
                showMsg('✅ Payroll submitted (no email sent)');
                setActivePR(null);await loadPR();await loadEmps();
              }catch(e){setErr('Failed to submit: '+(e.response?.data?.error?.message||e.message));}
              finally{setSendingPayroll(false);}
            }} disabled={sendingPayroll} style={{background:'#455a64',color:'white'}}>
              {sendingPayroll?'Submitting...':'✓ Submit (No Email)'}
            </button>}
            {activePR.status==='draft'&&<button className="btn btn-sm" onClick={async()=>{if(!window.confirm('Delete this payroll draft? All entries will be lost.'))return;try{await deletePayroll(activePR.id);showMsg('Draft deleted');setActivePR(null);await loadPR();}catch{setErr('Failed to delete');}}} style={{background:'#c62828',color:'white'}}>🗑️ Delete Draft</button>}
            {activePR.status==='draft'&&<button className="btn btn-sm" onClick={()=>{setExtHrsEmps([]);setExtHrsDates([]);setExtHrsHours(1.5);setShowExtHrs(true);}} style={{background:'#E65100',color:'white'}}>⏱️ Extended Hours</button>}
            <button className="btn btn-sm" onClick={()=>printPayrollService(activePR)} style={{background:'#1565c0',color:'white'}}>🖨️ Payroll Sheet</button>
            <button className="btn btn-sm" onClick={()=>printPayrollDetailed(activePR)} style={{background:'#6a1b9a',color:'white'}}>🖨️ Detailed</button>
            <button className="btn btn-sm btn-outline" onClick={()=>setActivePR(null)}>Close</button>
          </div>
        </div>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.9rem'}}>
          <thead><tr style={{background:'#e3f2fd'}}><th style={{padding:'8px 12px',textAlign:'left'}}>Employee</th><th style={{padding:'8px',textAlign:'center',width:80}}>Rate</th><th style={{padding:'8px',textAlign:'center',width:90}}>Regular</th><th style={{padding:'8px',textAlign:'center',width:100}}>Overtime</th><th style={{padding:'8px',textAlign:'center',width:90}}>Vacation</th><th style={{padding:'8px',textAlign:'center',width:90}}>Bonus</th><th style={{padding:'8px 12px',textAlign:'right',width:100}}>Gross</th></tr></thead>
          <tbody>{(activePR.entries||[]).slice().sort((a,b)=>((a.sortOrder??999)-(b.sortOrder??999))||a.employeeName.localeCompare(b.employeeName)).map(en=>(
            <tr key={en.id} style={{borderBottom:'1px solid #e0e0e0'}}>
              <td style={{padding:'8px 12px',fontWeight:600}}>{en.employeeName}</td>
              <td style={{padding:'8px',textAlign:'center',color:'#888'}}>{fmt(en.hourlyRate)}</td>
              <td style={{padding:'4px 8px',textAlign:'center'}}>{activePR.status==='draft'?<input key={en.id+'-r-'+en.regularHours} type="number" step="0.5" className="form-input" defaultValue={en.regularHours} onBlur={e=>{const v=parseFloat(e.target.value)||0;if(v!==parseFloat(en.regularHours))updateEntry(en,{regularHours:v});}} onFocus={e=>e.target.select()} style={{width:70,textAlign:'center',padding:'4px'}}/>:en.regularHours}</td>
              <td style={{padding:'4px 8px',textAlign:'center'}}><div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}><span style={{fontWeight:600,color:en.overtimeHours>0?'#E65100':'#888'}}>{en.overtimeHours}</span>{activePR.status==='draft'&&<button onClick={()=>openOtEditor(en)} style={{background:'#ff9800',color:'white',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:'0.75rem'}}>{en.overtimeHours>0?'✏️':'+ OT'}</button>}</div>{en.overtimeDetails&&en.overtimeDetails.length>0&&<div style={{fontSize:'0.7rem',color:'#888',marginTop:2}}>{en.overtimeDetails.map((d,i)=><span key={i}>{new Date(d.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}:{d.hours}h{i<en.overtimeDetails.length-1?', ':''}</span>)}</div>}</td>
              <td style={{padding:'4px 8px',textAlign:'center'}}><div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}><span style={{fontWeight:600,color:en.vacationHours>0?'#1565c0':'#888'}}>{en.vacationHours}</span>{activePR.status==='draft'&&<button onClick={()=>openVacEntryEditor(en)} style={{background:'#1565c0',color:'white',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:'0.75rem'}}>{en.vacationHours>0?'✏️':'+ Vac'}</button>}</div>{en.vacationDates&&en.vacationDates.length>0&&<div style={{fontSize:'0.7rem',color:'#1565c0',marginTop:2}}>{(en.vacationDates||[]).map((d,i)=>{const dt=typeof d==='string'?d:d.date;const hrs=typeof d==='object'?d.hours:null;return <span key={i}>{new Date(dt+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}{hrs?':'+hrs+'h':''}{i<en.vacationDates.length-1?', ':''}</span>;})}</div>}</td>
              <td style={{padding:'4px 8px',textAlign:'center'}}>{activePR.status==='draft'?<div><input key={en.id+'-b-'+en.bonus} type="number" step="1" className="form-input" defaultValue={en.bonus} onBlur={e=>{const v=parseFloat(e.target.value)||0;if(v!==parseFloat(en.bonus))updateEntry(en,{bonus:v});}} onFocus={e=>e.target.select()} style={{width:70,textAlign:'center',padding:'4px'}}/>{parseFloat(en.bonus)>0&&<input key={en.id+'-bn-'+(en.bonusNotes||'')} className="form-input" defaultValue={en.bonusNotes||''} onBlur={e=>{if(e.target.value!==(en.bonusNotes||''))updateEntry(en,{bonusNotes:e.target.value});}} placeholder="reason" style={{width:80,padding:'2px 4px',fontSize:'0.7rem',marginTop:2}}/>}</div>:parseFloat(en.bonus)>0?<div>{fmt(en.bonus)}{en.bonusNotes&&<div style={{fontSize:'0.7rem',color:'#888'}}>{en.bonusNotes}</div>}</div>:fmt(en.bonus)}</td>
              <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#2e7d32'}}>{fmt(en.grossPay)}</td>
            </tr>))}
            <tr style={{background:'#e8f5e9'}}><td colSpan={6} style={{padding:'10px 12px',fontWeight:700,textAlign:'right'}}>Total Gross</td><td style={{padding:'10px 12px',textAlign:'right',fontWeight:800,fontSize:'1.1rem',color:'#2e7d32'}}>{fmt(activePR.totalGross)}</td></tr>
          </tbody></table></div>
      </div>)}
      {payrolls.length>0&&<div><h4 style={{marginBottom:8,color:'#555'}}>Payroll History</h4><div style={{display:'flex',flexDirection:'column',gap:6}}>{payrolls.map(p=>(
        <div key={p.id} onClick={()=>setActivePR(p)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',borderRadius:8,border:'1px solid #e0e0e0',cursor:'pointer',background:activePR?.id===p.id?'#e3f2fd':'white'}}>
          <div><span style={{fontWeight:600}}>{new Date(p.weekStart+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} — {new Date(p.weekEnd+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span><span style={{marginLeft:8,padding:'1px 8px',borderRadius:4,fontSize:'0.75rem',fontWeight:600,background:p.status==='submitted'?'#c8e6c9':'#fff3e0',color:p.status==='submitted'?'#2e7d32':'#E65100'}}>{p.status}</span></div>
          <div style={{fontWeight:700}}>{fmt(p.totalGross)}</div>
        </div>))}</div></div>}
    </div>

    {/* Modals */}
    {showEmp&&<div className="modal-overlay"><div className="modal" style={{maxWidth:450}}>
      <div className="modal-header"><h3 className="modal-title">{editEmp?'Edit':'Add'} Employee</h3><button className="modal-close" onClick={()=>setShowEmp(false)}>&times;</button></div>
      <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
        <div className="form-group" style={{margin:0}}><label className="form-label">Name *</label><input className="form-input" value={ef.name} onChange={e=>setEf({...ef,name:e.target.value})}/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="form-group" style={{margin:0}}><label className="form-label">Hourly Rate *</label><input type="number" step="0.01" className="form-input" value={ef.hourlyRate} onChange={e=>setEf({...ef,hourlyRate:e.target.value})}/></div><div className="form-group" style={{margin:0}}><label className="form-label">Phone</label><input className="form-input" value={ef.phone} onChange={e=>setEf({...ef,phone:e.target.value})}/></div></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="form-group" style={{margin:0}}><label className="form-label">Role</label><input className="form-input" value={ef.role} onChange={e=>setEf({...ef,role:e.target.value})} placeholder="e.g. Welder"/></div><div className="form-group" style={{margin:0}}><label className="form-label">Start Date</label><input type="date" className="form-input" value={ef.startDate} onChange={e=>setEf({...ef,startDate:e.target.value})}/></div></div>
        <div style={{borderTop:'1px solid #e0e0e0',paddingTop:12,marginTop:4}}><h4 style={{margin:'0 0 8px',fontSize:'0.9rem',color:'#1565c0'}}>📋 Payroll Service Fields</h4></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="form-group" style={{margin:0}}><label className="form-label">Control Number</label><input className="form-input" value={ef.controlNumber} onChange={e=>setEf({...ef,controlNumber:e.target.value})} placeholder="e.g. 3676774"/></div><div className="form-group" style={{margin:0}}><label className="form-label">Deductions</label><input className="form-input" value={ef.deductions} onChange={e=>setEf({...ef,deductions:e.target.value})} placeholder="e.g. ACH 100%"/></div></div>
        <div className="form-group" style={{margin:0}}><label className="form-label">Description</label><select className="form-select" value={ef.description} onChange={e=>setEf({...ef,description:e.target.value})}><option value="">Select...</option><option value="CA3400 Metal Goods Mfg">CA3400 Metal Goods Mfg</option><option value="CA8810 Clerical Office Employee">CA8810 Clerical Office Employee</option><option value="CA0000 Exempt Officer">CA0000 Exempt Officer</option></select></div>
        <div style={{borderTop:'1px solid #e0e0e0',paddingTop:12,marginTop:4}}><h4 style={{margin:'0 0 8px',fontSize:'0.9rem',color:'#2e7d32'}}>🏖️ Vacation</h4></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div className="form-group" style={{margin:0}}><label className="form-label">Annual Vacation Days</label><input type="number" step="0.5" className="form-input" value={ef.annualVacationDays} onChange={e=>setEf({...ef,annualVacationDays:e.target.value})} placeholder="0"/></div>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">Days Used ({new Date().getFullYear()})</label>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{padding:'8px 12px',background:'#f5f5f5',borderRadius:6,fontWeight:700,fontSize:'1rem',flex:1}}>{editEmp ? parseFloat(editEmp.vacationDaysUsed||0).toFixed(1) : '0.0'}</div>
              {editEmp && <button type="button" onClick={()=>{setVacEmp(editEmp);setVacLog([...(editEmp.vacationLog||[])]);setShowEmp(false);}} style={{background:'#1565c0',color:'white',border:'none',borderRadius:6,padding:'8px 12px',cursor:'pointer',fontWeight:600,fontSize:'0.8rem',whiteSpace:'nowrap'}}>✏️ Edit Log</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowEmp(false)}>Cancel</button><button className="btn btn-primary" onClick={saveEmp}>{editEmp?'Update':'Add'}</button></div>
    </div></div>}
    {showNewPR&&<div className="modal-overlay" onClick={()=>setShowNewPR(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
      <div className="modal-header"><h3 className="modal-title">Create Weekly Payroll</h3><button className="modal-close" onClick={()=>setShowNewPR(false)}>&times;</button></div>
      <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div className="form-group" style={{margin:0}}><label className="form-label">Week Start</label><input type="date" className="form-input" value={prDates.weekStart} onChange={e=>{const s=e.target.value;if(!prDates.weekEnd){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+4);setPrDates({weekStart:s,weekEnd:d.toISOString().split('T')[0]});}else{setPrDates({...prDates,weekStart:s});}}}/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Week End</label><input type="date" className="form-input" value={prDates.weekEnd} onChange={e=>setPrDates({...prDates,weekEnd:e.target.value})}/></div>
        </div>
        <div style={{fontSize:'0.85rem',color:'#666'}}>All active employees will be added automatically.</div>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowNewPR(false)}>Cancel</button><button className="btn btn-primary" onClick={createPR}>Create</button></div>
    </div></div>}
    {/* Overtime Editor Modal */}
    {otEntry&&<div className="modal-overlay"><div className="modal" style={{maxWidth:550}}>
      <div className="modal-header">
        <h3 className="modal-title">⏱️ Overtime — {otEntry.employeeName}</h3>
        <button className="modal-close" onClick={()=>setOtEntry(null)}>&times;</button>
      </div>
      <div style={{padding:'4px 20px 0',fontSize:'0.85rem',color:'#666'}}>
        Pay period: {activePR?new Date(activePR.weekStart+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })+' — '+new Date(activePR.weekEnd+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }):''}
        &nbsp;|&nbsp; Rate: ${parseFloat(otEntry.hourlyRate).toFixed(2)} × 1.5 = <strong>${(parseFloat(otEntry.hourlyRate)*1.5).toFixed(2)}/hr OT</strong>
      </div>
      <div style={{padding:20}}>
        {/* Add new OT entry */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 0.7fr auto',gap:8,marginBottom:12,padding:10,background:'#fff3e0',borderRadius:8}}>
          <div className="form-group" style={{margin:0}}><label className="form-label" style={{fontSize:'0.75rem'}}>Date</label><input type="date" className="form-input" value={otNewDate} onChange={e=>setOtNewDate(e.target.value)} style={{fontSize:'0.85rem',padding:'4px 8px'}}/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label" style={{fontSize:'0.75rem'}}>Hours</label>
            <select className="form-select" value={otNewHrs} onChange={e=>setOtNewHrs(parseFloat(e.target.value))} style={{fontSize:'0.85rem',padding:'4px 8px'}}>
              {[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,7,8].map(h=><option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
          <button onClick={()=>{if(!otNewDate)return;setOtList([...otList,{date:otNewDate,hours:otNewHrs}].sort((a,b)=>a.date.localeCompare(b.date)));setOtNewDate('');setOtNewHrs(1.5);}} style={{background:'#E65100',color:'white',border:'none',borderRadius:6,padding:'4px 14px',cursor:'pointer',fontWeight:600,alignSelf:'end',marginBottom:2}}>+ Add</button>
        </div>

        {/* OT entries list */}
        {otList.length===0?<div style={{textAlign:'center',padding:16,color:'#999',fontSize:'0.85rem'}}>No overtime entries</div>:
        <div style={{border:'1px solid #e0e0e0',borderRadius:8,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.85rem'}}>
            <thead><tr style={{background:'#fff3e0'}}>
              <th style={{padding:'8px 12px',textAlign:'left'}}>Date</th>
              <th style={{padding:'8px',textAlign:'center',width:90}}>Hours</th>
              <th style={{padding:'8px',textAlign:'right',width:90}}>Pay</th>
              <th style={{padding:'8px',width:40}}></th>
            </tr></thead>
            <tbody>{otList.map((ot,idx)=>(
              <tr key={idx} style={{borderBottom:'1px solid #f0f0f0'}}>
                <td style={{padding:'6px 12px'}}>{new Date(ot.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</td>
                <td style={{padding:'6px 8px',textAlign:'center'}}>
                  <select value={ot.hours} onChange={e=>{const l=[...otList];l[idx]={...l[idx],hours:parseFloat(e.target.value)};setOtList(l);}} style={{width:60,padding:'2px',fontSize:'0.8rem',border:'1px solid #ddd',borderRadius:4}}>
                    {[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,7,8].map(h=><option key={h} value={h}>{h}h</option>)}
                  </select>
                </td>
                <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600,color:'#E65100'}}>${(ot.hours*parseFloat(otEntry.hourlyRate)*1.5).toFixed(2)}</td>
                <td style={{padding:'6px 4px',textAlign:'center'}}><button onClick={()=>{const l=[...otList];l.splice(idx,1);setOtList(l);}} style={{background:'none',border:'none',cursor:'pointer',color:'#c62828',fontSize:'0.85rem'}}>✕</button></td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{background:'#fff3e0'}}>
              <td style={{padding:'8px 12px',fontWeight:700}}>Total</td>
              <td style={{padding:'8px',textAlign:'center',fontWeight:700}}>{otList.reduce((s,e)=>s+e.hours,0).toFixed(1)}h</td>
              <td style={{padding:'8px',textAlign:'right',fontWeight:700,color:'#E65100'}}>${(otList.reduce((s,e)=>s+e.hours,0)*parseFloat(otEntry.hourlyRate)*1.5).toFixed(2)}</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={()=>setOtEntry(null)}>Cancel</button>
        <button className="btn btn-primary" onClick={saveOt} style={{background:'#E65100'}}>💾 Save Overtime ({otList.reduce((s,e)=>s+e.hours,0).toFixed(1)}h)</button>
      </div>
    </div></div>}

    {/* Extended Hours (Bulk OT) Modal */}
    {showExtHrs&&activePR&&<div className="modal-overlay"><div className="modal" style={{maxWidth:600}}>
      <div className="modal-header">
        <h3 className="modal-title">⏱️ Extended Hours — Bulk Overtime Entry</h3>
        <button className="modal-close" onClick={()=>setShowExtHrs(false)}>&times;</button>
      </div>
      <div style={{padding:'4px 20px 4px',fontSize:'0.85rem',color:'#666'}}>
        Pay period: {new Date(activePR.weekStart+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} — {new Date(activePR.weekEnd+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
      </div>
      <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Employee checkboxes */}
        <div>
          <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:8,color:'#E65100'}}>👥 Select Employees</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'4px 8px',background:extHrsEmps.length===(activePR.entries||[]).length?'#fff3e0':'transparent',borderRadius:6}}>
              <input type="checkbox" checked={extHrsEmps.length===(activePR.entries||[]).length} onChange={e=>setExtHrsEmps(e.target.checked?(activePR.entries||[]).map(en=>en.id):[])} style={{width:16,height:16}}/>
              <span style={{fontWeight:600,color:'#E65100'}}>All Employees</span>
            </label>
            {(activePR.entries||[]).slice().sort((a,b)=>((a.sortOrder??999)-(b.sortOrder??999))||a.employeeName.localeCompare(b.employeeName)).map(en=>(
              <label key={en.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'4px 8px',background:extHrsEmps.includes(en.id)?'#fff3e0':'transparent',borderRadius:6}}>
                <input type="checkbox" checked={extHrsEmps.includes(en.id)} onChange={e=>setExtHrsEmps(prev=>e.target.checked?[...prev,en.id]:prev.filter(x=>x!==en.id))} style={{width:16,height:16}}/>
                <span style={{fontWeight:500}}>{en.employeeName}</span>
                <span style={{fontSize:'0.75rem',color:'#888'}}>${parseFloat(en.hourlyRate).toFixed(2)}/hr</span>
              </label>
            ))}
          </div>
        </div>
        {/* Date checkboxes — generate days in pay period */}
        <div>
          <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:8,color:'#1565c0'}}>📅 Select Dates</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {(()=>{
              const dates=[];
              const start=new Date(activePR.weekStart+'T12:00:00');
              const end=new Date(activePR.weekEnd+'T12:00:00');
              for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
                dates.push(new Date(d).toISOString().split('T')[0]);
              }
              return dates.map(dt=>(
                <label key={dt} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'4px 8px',background:extHrsDates.includes(dt)?'#e3f2fd':'transparent',borderRadius:6}}>
                  <input type="checkbox" checked={extHrsDates.includes(dt)} onChange={e=>setExtHrsDates(prev=>e.target.checked?[...prev,dt]:prev.filter(x=>x!==dt))} style={{width:16,height:16}}/>
                  <span style={{fontWeight:500}}>{new Date(dt+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</span>
                </label>
              ));
            })()}
          </div>
          {/* Hours selector */}
          <div style={{marginTop:16,padding:'10px 12px',background:'#fff3e0',borderRadius:8,border:'1px solid #FFE0B2'}}>
            <label style={{fontWeight:700,fontSize:'0.85rem',color:'#E65100',display:'block',marginBottom:6}}>⏱️ OT Hours per day</label>
            <select className="form-select" value={extHrsHours} onChange={e=>setExtHrsHours(parseFloat(e.target.value))}>
              {OT_INC.map(h=><option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
        </div>
      </div>
      {extHrsEmps.length>0&&extHrsDates.length>0&&(
        <div style={{margin:'0 20px 12px',padding:'10px 14px',background:'#e8f5e9',borderRadius:8,fontSize:'0.85rem',color:'#2e7d32',fontWeight:600}}>
          → Will add {extHrsHours}h OT to {extHrsEmps.length} employee(s) × {extHrsDates.length} day(s) = {(extHrsHours*extHrsEmps.length*extHrsDates.length).toFixed(1)} total OT hours
        </div>
      )}
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={()=>setShowExtHrs(false)}>Cancel</button>
        <button className="btn btn-primary" onClick={applyExtHrs} disabled={extHrsSaving||extHrsEmps.length===0||extHrsDates.length===0} style={{background:'#E65100'}}>
          {extHrsSaving?'Applying...':'⚡ Apply Extended Hours'}
        </button>
      </div>
    </div></div>}

    {/* Vacation Entry Editor (payroll) */}
    {vacEntry&&<div className="modal-overlay"><div className="modal" style={{maxWidth:550}}>
      <div className="modal-header">
        <h3 className="modal-title">🏖️ Vacation — {vacEntry.employeeName}</h3>
        <button className="modal-close" onClick={()=>setVacEntry(null)}>&times;</button>
      </div>
      <div style={{padding:'4px 20px 0',fontSize:'0.85rem',color:'#666'}}>
        Pay period: {activePR?new Date(activePR.weekStart+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })+' — '+new Date(activePR.weekEnd+'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }):''}
        &nbsp;|&nbsp; Rate: ${parseFloat(vacEntry.hourlyRate).toFixed(2)}/hr
      </div>
      <div style={{padding:20}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 0.7fr auto',gap:8,marginBottom:12,padding:10,background:'#e3f2fd',borderRadius:8}}>
          <div className="form-group" style={{margin:0}}><label className="form-label" style={{fontSize:'0.75rem'}}>Date</label><input type="date" className="form-input" value={vacEntryNewDate} onChange={e=>setVacEntryNewDate(e.target.value)} style={{fontSize:'0.85rem',padding:'4px 8px'}}/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label" style={{fontSize:'0.75rem'}}>Hours</label>
            <select className="form-select" value={vacEntryNewHrs} onChange={e=>setVacEntryNewHrs(parseFloat(e.target.value))} style={{fontSize:'0.85rem',padding:'4px 8px'}}>
              <option value="1">1h</option><option value="2">2h</option><option value="3">3h</option><option value="4">4h (half day)</option>
              <option value="5">5h</option><option value="6">6h</option><option value="7">7h</option><option value="8">8h (full day)</option>
            </select>
          </div>
          <button onClick={()=>{if(!vacEntryNewDate)return;setVacEntryList([...vacEntryList,{date:vacEntryNewDate,hours:vacEntryNewHrs}].sort((a,b)=>a.date.localeCompare(b.date)));setVacEntryNewDate('');setVacEntryNewHrs(8);}} style={{background:'#1565c0',color:'white',border:'none',borderRadius:6,padding:'4px 14px',cursor:'pointer',fontWeight:600,alignSelf:'end',marginBottom:2}}>+ Add</button>
        </div>
        {vacEntryList.length===0?<div style={{textAlign:'center',padding:16,color:'#999',fontSize:'0.85rem'}}>No vacation entries</div>:
        <div style={{border:'1px solid #e0e0e0',borderRadius:8,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.85rem'}}>
            <thead><tr style={{background:'#e3f2fd'}}>
              <th style={{padding:'8px 12px',textAlign:'left'}}>Date</th>
              <th style={{padding:'8px',textAlign:'center',width:90}}>Hours</th>
              <th style={{padding:'8px',textAlign:'center',width:70}}>Days</th>
              <th style={{padding:'8px',textAlign:'right',width:90}}>Pay</th>
              <th style={{padding:'8px',width:40}}></th>
            </tr></thead>
            <tbody>{vacEntryList.map((v,idx)=>(
              <tr key={idx} style={{borderBottom:'1px solid #f0f0f0'}}>
                <td style={{padding:'6px 12px'}}>{new Date(v.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</td>
                <td style={{padding:'6px 8px',textAlign:'center'}}>
                  <select value={v.hours} onChange={e=>{const l=[...vacEntryList];l[idx]={...l[idx],hours:parseFloat(e.target.value)};setVacEntryList(l);}} style={{width:60,padding:'2px',fontSize:'0.8rem',border:'1px solid #ddd',borderRadius:4}}>
                    <option value="1">1h</option><option value="2">2h</option><option value="3">3h</option><option value="4">4h</option>
                    <option value="5">5h</option><option value="6">6h</option><option value="7">7h</option><option value="8">8h</option>
                  </select>
                </td>
                <td style={{padding:'6px 8px',textAlign:'center',color:'#1565c0',fontWeight:600}}>{(v.hours/8).toFixed(2)}</td>
                <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600,color:'#1565c0'}}>${(v.hours*parseFloat(vacEntry.hourlyRate)).toFixed(2)}</td>
                <td style={{padding:'6px 4px',textAlign:'center'}}><button onClick={()=>{const l=[...vacEntryList];l.splice(idx,1);setVacEntryList(l);}} style={{background:'none',border:'none',cursor:'pointer',color:'#c62828',fontSize:'0.85rem'}}>✕</button></td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{background:'#e3f2fd'}}>
              <td style={{padding:'8px 12px',fontWeight:700}}>Total</td>
              <td style={{padding:'8px',textAlign:'center',fontWeight:700}}>{vacEntryList.reduce((s,e)=>s+e.hours,0).toFixed(1)}h</td>
              <td style={{padding:'8px',textAlign:'center',fontWeight:700,color:'#1565c0'}}>{(vacEntryList.reduce((s,e)=>s+e.hours,0)/8).toFixed(2)}d</td>
              <td style={{padding:'8px',textAlign:'right',fontWeight:700,color:'#1565c0'}}>${(vacEntryList.reduce((s,e)=>s+e.hours,0)*parseFloat(vacEntry.hourlyRate)).toFixed(2)}</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={()=>setVacEntry(null)}>Cancel</button>
        <button className="btn btn-primary" onClick={saveVacEntry}>💾 Save Vacation ({vacEntryList.reduce((s,e)=>s+e.hours,0).toFixed(1)}h)</button>
      </div>
    </div></div>}

    {/* Vacation Log Modal */}
    {vacEmp&&<div className="modal-overlay"><div className="modal" style={{maxWidth:600}}>
      <div className="modal-header"><h3 className="modal-title">🏖️ Vacation Log — {vacEmp.name}</h3><button className="modal-close" onClick={()=>setVacEmp(null)}>&times;</button></div>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:'0.85rem',lineHeight:1.6}}>
            {(()=>{
              const today=new Date().toISOString().split('T')[0];
              const taken=vacLog.filter(e=>e.date<=today);
              const planned=vacLog.filter(e=>e.date>today);
              const takenH=taken.reduce((s,e)=>s+(parseFloat(e.hours)||0),0);
              const plannedH=planned.reduce((s,e)=>s+(parseFloat(e.hours)||0),0);
              const totalH=takenH+plannedH;
              const annual=parseFloat(vacEmp.annualVacationDays||0);
              return <>
                <div><strong>Annual:</strong> {annual.toFixed(1)} days ({(annual*8).toFixed(0)}h)</div>
                <div><span style={{color:'#2e7d32'}}>✅ Taken:</span> <strong>{(takenH/8).toFixed(1)} days</strong> ({takenH.toFixed(1)}h) &nbsp;|&nbsp; <span style={{color:'#1565c0'}}>📅 Planned:</span> <strong>{(plannedH/8).toFixed(1)} days</strong> ({plannedH.toFixed(1)}h)</div>
                <div><strong style={{color:annual-(totalH/8)<0?'#c62828':'#1565c0'}}>Remaining: {(annual-(totalH/8)).toFixed(1)} days</strong> (after planned)</div>
              </>;
            })()}
          </div>
        </div>

        {/* Add new entry */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 0.7fr 1fr auto',gap:8,marginBottom:12,padding:10,background:'#e8f5e9',borderRadius:8}}>
          <div className="form-group" style={{margin:0}}><label className="form-label" style={{fontSize:'0.75rem'}}>Date</label><input type="date" className="form-input" value={vacNewDate} onChange={e=>setVacNewDate(e.target.value)} style={{fontSize:'0.85rem',padding:'4px 8px'}}/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label" style={{fontSize:'0.75rem'}}>Hours</label>
            <select className="form-select" value={vacNewHours} onChange={e=>setVacNewHours(e.target.value)} style={{fontSize:'0.85rem',padding:'4px 8px'}}>
              <option value="1">1h</option><option value="2">2h</option><option value="3">3h</option><option value="4">4h (half day)</option>
              <option value="5">5h</option><option value="6">6h</option><option value="7">7h</option><option value="8">8h (full day)</option>
            </select>
          </div>
          <div className="form-group" style={{margin:0}}><label className="form-label" style={{fontSize:'0.75rem'}}>Note</label><input className="form-input" value={vacNewNote} onChange={e=>setVacNewNote(e.target.value)} placeholder="optional" style={{fontSize:'0.85rem',padding:'4px 8px'}}/></div>
          <button onClick={()=>{if(!vacNewDate)return;const entry={date:vacNewDate,hours:parseFloat(vacNewHours)||8,note:vacNewNote,source:'manual'};setVacLog([...vacLog,entry].sort((a,b)=>a.date.localeCompare(b.date)));setVacNewDate('');setVacNewHours('8');setVacNewNote('');}} style={{background:'#2e7d32',color:'white',border:'none',borderRadius:6,padding:'4px 14px',cursor:'pointer',fontWeight:600,alignSelf:'end',marginBottom:2}}>+ Add</button>
        </div>

        {/* Log entries */}
        {vacLog.length===0?<div style={{textAlign:'center',padding:20,color:'#999',fontSize:'0.85rem'}}>No vacation entries this year</div>:
        <div style={{maxHeight:300,overflowY:'auto',border:'1px solid #e0e0e0',borderRadius:8}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.85rem'}}>
            <thead><tr style={{background:'#f5f5f5',position:'sticky',top:0}}>
              <th style={{padding:'8px 12px',textAlign:'left'}}>Date</th>
              <th style={{padding:'8px',textAlign:'center',width:70}}>Hours</th>
              <th style={{padding:'8px',textAlign:'center',width:70}}>Days</th>
              <th style={{padding:'8px 12px',textAlign:'left'}}>Note</th>
              <th style={{padding:'8px',width:40}}></th>
            </tr></thead>
            <tbody>{vacLog.map((entry,idx)=>{const isFuture=entry.date>new Date().toISOString().split('T')[0];return(
              <tr key={idx} style={{borderBottom:'1px solid #f0f0f0',background:isFuture?'#e3f2fd':''}}>
                <td style={{padding:'6px 12px'}}>
                  <input type="date" value={entry.date} onChange={e=>{const l=[...vacLog];l[idx]={...l[idx],date:e.target.value};setVacLog(l.sort((a,b)=>a.date.localeCompare(b.date)));}} style={{border:'1px solid #ddd',borderRadius:4,padding:'2px 6px',fontSize:'0.8rem',width:130}}/>
                  <span style={{marginLeft:6,fontSize:'0.75rem',color:isFuture?'#1565c0':'#2e7d32',fontWeight:600}}>{isFuture?'📅 Planned':'✅ Taken'}</span>
                </td>
                <td style={{padding:'6px 8px',textAlign:'center'}}>
                  <select value={entry.hours} onChange={e=>{const l=[...vacLog];l[idx]={...l[idx],hours:parseFloat(e.target.value)};setVacLog(l);}} style={{width:55,padding:'2px',fontSize:'0.8rem',border:'1px solid #ddd',borderRadius:4}}>
                    <option value="1">1h</option><option value="2">2h</option><option value="3">3h</option><option value="4">4h</option>
                    <option value="5">5h</option><option value="6">6h</option><option value="7">7h</option><option value="8">8h</option>
                  </select>
                </td>
                <td style={{padding:'6px 8px',textAlign:'center',color:'#1565c0',fontWeight:600}}>{(parseFloat(entry.hours)/8).toFixed(2)}</td>
                <td style={{padding:'6px 12px'}}>
                  <input className="form-input" value={entry.note||''} onChange={e=>{const l=[...vacLog];l[idx]={...l[idx],note:e.target.value};setVacLog(l);}} style={{fontSize:'0.8rem',padding:'2px 6px'}} placeholder="—"/>
                </td>
                <td style={{padding:'6px 4px',textAlign:'center'}}><button onClick={()=>{const l=[...vacLog];l.splice(idx,1);setVacLog(l);}} style={{background:'none',border:'none',cursor:'pointer',color:'#c62828',fontSize:'0.85rem'}}>✕</button></td>
              </tr>
            )})}</tbody>
            <tfoot><tr style={{background:'#e3f2fd'}}>
              <td style={{padding:'8px 12px',fontWeight:700}}>Total ({vacLog.filter(e=>e.date<=new Date().toISOString().split('T')[0]).length} taken, {vacLog.filter(e=>e.date>new Date().toISOString().split('T')[0]).length} planned)</td>
              <td style={{padding:'8px',textAlign:'center',fontWeight:700}}>{vacLog.reduce((s,e)=>s+(parseFloat(e.hours)||0),0).toFixed(1)}h</td>
              <td style={{padding:'8px',textAlign:'center',fontWeight:700,color:'#1565c0'}}>{(vacLog.reduce((s,e)=>s+(parseFloat(e.hours)||0),0)/8).toFixed(2)}d</td>
              <td colSpan={2}></td>
            </tr></tfoot>
          </table>
        </div>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={()=>setVacEmp(null)}>Cancel</button>
        <button className="btn btn-primary" onClick={async()=>{try{await updateVacationLog(vacEmp.id,vacLog);showMsg('Vacation log saved');setVacEmp(null);await loadEmps();}catch{setErr('Failed to save');}}}>💾 Save Vacation Log</button>
      </div>
    </div></div>}

    </div>
  );
}

