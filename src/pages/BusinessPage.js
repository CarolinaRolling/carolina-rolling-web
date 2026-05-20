import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Receipt, Users, BarChart3, Plus, DollarSign } from 'lucide-react';
import { getLiabilities, getLiabilitySummary, createLiability, updateLiability, payLiability, deleteLiability, uploadBillFile, approveBill, rejectBill, getEmployees, createEmployee, updateEmployee, deleteEmployee, updateVacationLog, getPayrolls, createPayroll, updatePayrollEntry, updatePayrollWeek, submitPayroll, deletePayroll, getWorkOrders, getOutstandingPayments, getPaymentHistory, recordBusinessPayment, clearBusinessPayment, reorderEmployees, sendPayrollEmail, getEmailAccounts, getSettings, updateSettings, previewPayrollPdf, getLedger, recordLedgerPayment, voidLedgerPayment, getCreditMemos, getRefunds, voidCreditMemo, voidRefund } from '../services/api';
import InvoiceCenterPage from './InvoiceCenterPage';
import TakePaymentModal from '../components/TakePaymentModal';
import CreditMemoModal from '../components/CreditMemoModal';
import RefundModal from '../components/RefundModal';
import COATab from './COATab';
import EmployeesTab from './EmployeesTab';
import HealthTab from './HealthTab';

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
  const [ef, setEf] = useState({ name:'',phone:'',hourlyRate:'',role:'',startDate:'',controlNumber:'',deductions:'ACH 100%',description:'',annualVacationDays:'' });
  // Vacation log modal
  const [vacEmp, setVacEmp] = useState(null);
  const [vacLog, setVacLog] = useState([]);
  const [vacNewDate, setVacNewDate] = useState('');
  const [vacNewHours, setVacNewHours] = useState('8');
  const [vacNewNote, setVacNewNote] = useState('');

  // Payroll
  const [payrolls, setPayrolls] = useState([]);
  const [activePR, setActivePR] = useState(null);
  const [showNewPR, setShowNewPR] = useState(false);
  const [prDates, setPrDates] = useState({ weekStart:'',weekEnd:'' });

  // Health
  const [health, setHealth] = useState(null);
  const [healthLoad, setHealthLoad] = useState(false);

  // Gmail accounts for sending payroll
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [payrollSenderAccountId, setPayrollSenderAccountId] = useState('');
  const [payrollSenderSaving, setPayrollSenderSaving] = useState(false);
  const [sendingPayroll, setSendingPayroll] = useState(false);

  // Payroll service email
  const [payrollEmail, setPayrollEmail] = useState('');
  const [payrollEmailEdit, setPayrollEmailEdit] = useState(false);
  const [payrollEmailSaving, setPayrollEmailSaving] = useState(false);

  // Payments
  const [outstanding, setOutstanding] = useState(null);
  const [ledger, setLedger] = useState({ invoices: [], totalOutstanding: 0, totalPaid: 0, count: 0 });
  const [ledgerFilter, setLedgerFilter] = useState('outstanding');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerExpanded, setLedgerExpanded] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ paymentType: 'partial', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'check', paymentReference: '', notes: '' });
  const [payHistory, setPayHistory] = useState(null);
  const [payTab, setPayTab] = useState('outstanding');
  const [payLoading, setPayLoading] = useState(false);
  const [showRecordPay, setShowRecordPay] = useState(null);
  const [payForm, setPayForm] = useState({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'check', paymentReference: '' });
  // New payment modals
  const [showTakePayment, setShowTakePayment] = useState(false);
  const [showCreditMemo, setShowCreditMemo] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [creditMemos, setCreditMemos] = useState([]);
  const [refunds, setRefunds] = useState([]);

  useEffect(() => {
    if (tab === 'coa') { loadLedger(); loadLiabs(); loadPayments();
      getCreditMemos().then(r => setCreditMemos(r.data.data || [])).catch(() => {});
      getRefunds().then(r => setRefunds(r.data.data || [])).catch(() => {});
    }
    if (tab === 'employees') { loadEmps(); loadPR(); loadPayrollEmail(); loadGmailAccounts(); }
    if (tab === 'health') loadHealth();

  }, [tab, liabF, liabCat]);

  const loadGmailAccounts = async () => {
    try { const r = await getEmailAccounts(); setGmailAccounts(r.data?.data || []); } catch {}
  };
  const loadPayrollSenderAccount = async () => {
    try { const r = await getSettings('payroll_sender_account'); setPayrollSenderAccountId(r.data?.data?.value || ''); } catch {}
  };
  const savePayrollSenderAccount = async (id) => {
    setPayrollSenderSaving(true);
    try { await updateSettings('payroll_sender_account', id); setPayrollSenderAccountId(id); showMsg('Sending account saved'); } catch { setErr('Failed'); }
    finally { setPayrollSenderSaving(false); }
  };

  const loadPayrollEmail = async () => {
    try { const r = await getSettings('payroll_service_email'); setPayrollEmail(r.data?.data?.value || ''); } catch {}
  };
  const savePayrollEmail = async (email) => {
    setPayrollEmailSaving(true);
    try { await updateSettings('payroll_service_email', email); setPayrollEmail(email); setPayrollEmailEdit(false); showMsg('Payroll service email saved'); } catch { setErr('Failed to save email'); }
    finally { setPayrollEmailSaving(false); }
  };

  const loadLiabs = async () => { try { setLiabLoad(true); const [a,b] = await Promise.all([getLiabilities({status:liabF,category:liabCat}),getLiabilitySummary()]); setLiabs(a.data.data||[]); setLiabSum(b.data.data); } catch{} finally{setLiabLoad(false);} };
  const loadLedger = async () => {
    try {
      const r = await getLedger({ status: ledgerFilter, search: ledgerSearch });
      setLedger(r.data.data);
    } catch {}
  };

  const handleRecordPayment = async () => {
    if (!paymentModal) return;
    try {
      await recordLedgerPayment(paymentModal.id, paymentForm);
      showMsg('Payment recorded');
      setPaymentModal(null);
      loadLedger();
    } catch (e) { setErr(e.response?.data?.error?.message || 'Failed to record payment'); }
  };

  const handleVoidPayment = async (paymentId) => {
    if (!window.confirm('Void this payment?')) return;
    try {
      await voidLedgerPayment(paymentId);
      showMsg('Payment voided');
      loadLedger();
    } catch { setErr('Failed to void payment'); }
  };

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
  const saveEmp = async () => { if(!ef.name||!ef.hourlyRate){setErr('Name & rate required');return;} try{
    const data = { ...ef };
    // Clean numeric fields — empty strings break Postgres DECIMAL
    if (!data.annualVacationDays || data.annualVacationDays === '') data.annualVacationDays = 0;
    if (!data.hourlyRate || data.hourlyRate === '') data.hourlyRate = 0;
    // Set defaults
    if (!data.deductions) data.deductions = 'ACH 100%';
    if(editEmp)await updateEmployee(editEmp.id,data);else await createEmployee(data);setShowEmp(false);setEditEmp(null);setEf({name:'',phone:'',hourlyRate:'',role:'',startDate:'',controlNumber:'',deductions:'ACH 100%',description:'',annualVacationDays:''});showMsg(editEmp?'Updated':'Added');await loadEmps();}catch(e){setErr(e.response?.data?.error?.message||'Failed to save');}};

  const createPR = async () => { if(!prDates.weekStart||!prDates.weekEnd){setErr('Select dates');return;} try{const r=await createPayroll(prDates);setActivePR(r.data.data);setShowNewPR(false);showMsg('Created');await loadPR();}catch(e){setErr(e.response?.data?.error?.message||'Failed');}};
  const updateEntry = async (entry, upd) => { 
    if(!activePR)return; 
    try{
      const res = await updatePayrollEntry(activePR.id,entry.id,upd);
      const updated = { ...res.data.data, grossPay: parseFloat(res.data.data?.grossPay) || 0 };
      // Update in-place instead of refetching everything
      setActivePR(prev => {
        if (!prev) return prev;
        const entries = (prev.entries||[]).map(e => e.id === entry.id ? { ...e, ...updated } : e);
        const totalGross = entries.reduce((s,e) => s + (parseFloat(e.grossPay)||0), 0);
        return { ...prev, entries, totalGross };
      });
    }catch{setErr('Failed');}
  };

  // OT editor state
  const [otEntry, setOtEntry] = useState(null); // the payroll entry being edited
  const [otList, setOtList] = useState([]); // working copy of overtimeDetails
  const [otNewDate, setOtNewDate] = useState('');
  const [otNewHrs, setOtNewHrs] = useState(1.5);

  // Extended Hours (bulk OT) modal state
  const [showExtHrs, setShowExtHrs] = useState(false);
  const [extHrsEmps, setExtHrsEmps] = useState([]); // selected employee entry ids
  const [extHrsDates, setExtHrsDates] = useState([]); // selected dates
  const [extHrsHours, setExtHrsHours] = useState(1.5);
  const [extHrsSaving, setExtHrsSaving] = useState(false);

  // Vacation editor state (payroll entry)
  const [vacEntry, setVacEntry] = useState(null);
  const [vacEntryList, setVacEntryList] = useState([]); // [{date, hours}]
  const [vacEntryNewDate, setVacEntryNewDate] = useState('');
  const [vacEntryNewHrs, setVacEntryNewHrs] = useState(8);

  const openOtEditor = (en) => {
    setOtEntry(en);
    setOtList([...(en.overtimeDetails || [])]);
    setOtNewDate('');
    setOtNewHrs(1.5);
  };

  const saveOt = async () => {
    if (!otEntry) return;
    const totalOtHours = otList.reduce((s, x) => s + (parseFloat(x.hours) || 0), 0);
    await updateEntry(otEntry, { overtimeDetails: otList, overtimeHours: totalOtHours });
    setOtEntry(null);
    setOtList([]);
    // Sync back to payrolls list too
    await loadPR();
  };

  const openVacEntryEditor = (en) => {
    setVacEntry(en);
    // Build list from vacationDates + vacationHours
    const dates = en.vacationDates || [];
    if (dates.length > 0) {
      const hoursEach = dates.length > 0 ? (parseFloat(en.vacationHours) || 0) / dates.length : 8;
      setVacEntryList(dates.map(d => ({ date: typeof d === 'string' ? d : d.date, hours: typeof d === 'object' ? (d.hours || hoursEach) : hoursEach })));
    } else if (parseFloat(en.vacationHours) > 0) {
      setVacEntryList([{ date: activePR?.weekStart || '', hours: parseFloat(en.vacationHours) }]);
    } else {
      setVacEntryList([]);
    }
    setVacEntryNewDate('');
    setVacEntryNewHrs(8);
  };

  const saveVacEntry = async () => {
    if (!vacEntry) return;
    const totalVacHours = vacEntryList.reduce((s, x) => s + (parseFloat(x.hours) || 0), 0);
    const dates = vacEntryList.map(v => ({ date: v.date, hours: parseFloat(v.hours) || 8 }));
    await updateEntry(vacEntry, { vacationDates: dates, vacationHours: totalVacHours });
    setVacEntry(null);
    setVacEntryList([]);
    await loadPR();
  };
  const downloadPayrollPdf = (pr) => {
    // Build the same HTML as printPayrollService but trigger download via blob
    const sortedEntries = (pr.entries || []).slice().sort((a,b)=>((a.sortOrder??999)-(b.sortOrder??999))||a.employeeName.localeCompare(b.employeeName));
    const entries = sortedEntries.map(en => {
      const emp = emps.find(e => e.id === en.employeeId) || {};
      return { ...en, controlNumber: emp.controlNumber || en.controlNumber || '', deductions: emp.deductions || en.deductions || '', description: emp.description || en.description || '' };
    });
    const sd = new Date(pr.weekStart+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const ed = new Date(pr.weekEnd+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const css = `* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px 30px; font-size: 11px; color: #222; } .header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid #1a1a1a; } .company-name { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; } .doc-title { font-size: 13px; font-weight: 600; color: #555; margin-top: 2px; } .date-range { margin-top: 8px; padding: 8px 14px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; font-weight: 700; text-align: center; } table { width: 100%; border-collapse: collapse; margin-top: 12px; } th { background: #1a1a1a; color: white; padding: 7px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; } td { border: 1px solid #bbb; padding: 6px 8px; font-size: 11px; } td.c { text-align: center; } tr:nth-child(even) { background: #f9f9f9; } .foot { margin-top: 20px; padding-top: 10px; border-top: 2px solid #1a1a1a; display: flex; justify-content: space-between; font-size: 10px; color: #888; } @media print { @page { margin: 0.4in; size: portrait; } }`;
    const rows = entries.map(en => {
      const op = [];
      if (parseFloat(en.vacationHours) > 0) op.push('Vac: ' + en.vacationHours + 'h');
      if (parseFloat(en.bonus) > 0) op.push('Bonus: $' + parseFloat(en.bonus).toFixed(2));
      return '<tr><td>' + (en.controlNumber||'') + '</td><td style="font-weight:600">' + en.employeeName + '</td><td>' + (en.deductions||'') + '</td><td>' + (en.description||'') + '</td><td class="c">$' + parseFloat(en.hourlyRate).toFixed(2) + '</td><td class="c" style="font-weight:600">' + en.regularHours + '</td><td class="c" style="font-weight:600;color:' + (parseFloat(en.overtimeHours)>0?'#c62828':'#888') + '">' + en.overtimeHours + '</td><td>' + op.join(', ') + '</td></tr>';
    }).join('');
    const html = '<html><head><title>Payroll</title><style>' + css + '</style></head><body><div class="header"><div><div class="company-name">Carolina Rolling Co., Inc.</div><div class="doc-title">Weekly Payroll Report</div></div></div><div class="date-range">Pay Period: ' + sd + ' — ' + ed + '</div><table><thead><tr><th>Control #</th><th>Employee Name</th><th>Deductions</th><th>Description</th><th style="text-align:center">Rate</th><th style="text-align:center">Reg Hours</th><th style="text-align:center">OT</th><th>Other Pay</th></tr></thead><tbody>' + rows + '</tbody></table><div class="foot"><span>Generated: ' + new Date().toLocaleDateString() + '</span><span>Carolina Rolling Co., Inc.</span></div></body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payroll_${pr.weekStart}_to_${pr.weekEnd}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { sd, ed };
  };

  const printPayrollService = (pr) => {
    const sortedEntries = (pr.entries || []).slice().sort((a,b)=>((a.sortOrder??999)-(b.sortOrder??999))||a.employeeName.localeCompare(b.employeeName));
    const entries = sortedEntries.map(en => {
      const emp = emps.find(e => e.id === en.employeeId) || {};
      return { ...en, controlNumber: emp.controlNumber || '', deductions: emp.deductions || '', description: emp.description || '' };
    });
    const sd = new Date(pr.weekStart+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const ed = new Date(pr.weekEnd+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const w = window.open('', '_blank');
    const css = `* { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px 30px; font-size: 11px; color: #222; }
      .header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid #1a1a1a; }
      .header img { width: 70px; height: 70px; }
      .company-name { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; }
      .doc-title { font-size: 13px; font-weight: 600; color: #555; margin-top: 2px; }
      .date-range { margin-top: 8px; padding: 8px 14px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; font-weight: 700; text-align: center; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #1a1a1a; color: white; padding: 7px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
      td { border: 1px solid #bbb; padding: 6px 8px; font-size: 11px; }
      td.c { text-align: center; }
      tr:nth-child(even) { background: #f9f9f9; }
      .foot { margin-top: 20px; padding-top: 10px; border-top: 2px solid #1a1a1a; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
      @media print { body { margin: 0; padding: 15px 20px; } @page { margin: 0.4in; size: portrait; } }`;
    const rows = entries.map(en => {
      const op = [];
      if (parseFloat(en.vacationHours) > 0) op.push('Vac: ' + en.vacationHours + 'h');
      if (parseFloat(en.bonus) > 0) op.push('Bonus: $' + parseFloat(en.bonus).toFixed(2));
      const nt = '';
      return '<tr><td>' + en.controlNumber + '</td><td style="font-weight:600">' + en.employeeName + '</td><td>' + en.deductions + '</td><td>' + en.description + '</td><td class="c">$' + parseFloat(en.hourlyRate).toFixed(2) + '</td><td class="c" style="font-weight:600">' + en.regularHours + '</td><td class="c" style="font-weight:600;color:' + (parseFloat(en.overtimeHours)>0?'#c62828':'#888') + '">' + en.overtimeHours + '</td><td>' + op.join(', ') + '</td><td style="font-size:9px;color:#555">' + nt + '</td></tr>';
    }).join('');
    const now = new Date();
    w.document.write('<html><head><title>Payroll</title><style>' + css + '</style></head><body>' +
      '<div class="header"><img src="/logo.png" onerror="this.style.display=\'none\'"/><div><div class="company-name">Carolina Rolling Co., Inc.</div><div class="doc-title">Weekly Payroll Report</div></div></div>' +
      '<div class="date-range">Pay Period: ' + sd + ' \u2014 ' + ed + '</div>' +
      '<table><thead><tr><th>Control #</th><th>Employee Name</th><th>Deductions</th><th>Description</th><th style="text-align:center">Rate</th><th style="text-align:center">Reg Hours</th><th style="text-align:center">OT</th><th>Other Pay</th><th>Notes</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="foot"><span>Generated: ' + now.toLocaleDateString() + ' at ' + now.toLocaleTimeString() + '</span><span>Carolina Rolling Co., Inc.</span></div>' +
      '</body></html>');
    w.document.close();
    w.print();
  };

  const printPayrollDetailed = (pr) => {
    const sortedEntries = (pr.entries || []).slice().sort((a,b)=>((a.sortOrder??999)-(b.sortOrder??999))||a.employeeName.localeCompare(b.employeeName));
    const entries = sortedEntries.map(en => {
      const emp = emps.find(e => e.id === en.employeeId) || {};
      return { ...en, annualVacationDays: emp.annualVacationDays || 0, vacationDaysUsed: emp.vacationDaysUsed || 0 };
    });
    const sd = new Date(pr.weekStart+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const ed = new Date(pr.weekEnd+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const w = window.open('', '_blank');
    const css = `* { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; padding: 16px 24px; font-size: 10px; color: #222; line-height: 1.3; }
      .hdr { display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 2px solid #000; margin-bottom: 8px; }
      .hdr img { width: 55px; height: 55px; }
      .co { font-size: 16px; font-weight: 800; }
      .dt { font-size: 11px; color: #555; }
      .dr { padding: 6px 0; font-size: 12px; font-weight: 800; text-align: center; border-bottom: 1px solid #999; margin-bottom: 8px; }
      .emp { border: 1px solid #888; margin-bottom: 6px; page-break-inside: avoid; }
      .emp-h { background: #1a1a1a; color: #fff; padding: 4px 10px; display: flex; justify-content: space-between; font-size: 10px; }
      .emp-h b { font-size: 11px; }
      .emp-b { padding: 4px 10px; }
      .r { display: flex; justify-content: space-between; padding: 1px 0; }
      .r .l { color: #444; } .r .v { font-weight: 700; }
      .ot-box { background: #fff3e0; border-left: 3px solid #e65100; padding: 3px 8px; margin: 2px 0; font-size: 9px; }
      .vc-box { background: #e3f2fd; border-left: 3px solid #1565c0; padding: 3px 8px; margin: 2px 0; font-size: 9px; }
      .bal { font-size: 9px; color: #888; padding: 1px 0; }
      .gp { display: flex; justify-content: space-between; border-top: 1.5px solid #000; padding: 3px 0 0; margin-top: 3px; font-weight: 800; font-size: 11px; }
      .tot { border: 2px solid #000; padding: 8px 12px; margin-top: 10px; font-size: 14px; font-weight: 800; text-align: right; }
      .ft { margin-top: 12px; padding-top: 6px; border-top: 1px solid #bbb; display: flex; justify-content: space-between; font-size: 9px; color: #999; }
      @media print { body { padding: 10px 16px; } @page { margin: 0.3in; size: portrait; } .emp { break-inside: avoid; } }`;
    const cards = entries.map(en => {
      const rate = parseFloat(en.hourlyRate) || 0;
      const reg = parseFloat(en.regularHours) || 0;
      const ot = parseFloat(en.overtimeHours) || 0;
      const vac = parseFloat(en.vacationHours) || 0;
      const bonus = parseFloat(en.bonus) || 0;
      const regPay = reg * rate;
      const otPay = ot * rate * 1.5;
      const vacPay = vac * rate;
      const vacDays = vac / 8;
      const vacRem = parseFloat(en.annualVacationDays) - parseFloat(en.vacationDaysUsed);
      let h = '<div class="emp"><div class="emp-h"><b>' + en.employeeName + '</b><span>$' + rate.toFixed(2) + '/hr &nbsp;|&nbsp; OT $' + (rate*1.5).toFixed(2) + '/hr</span></div><div class="emp-b">';
      h += '<div class="r"><span class="l">Regular</span><span class="v">' + reg + 'h \u00d7 $' + rate.toFixed(2) + ' = $' + regPay.toFixed(2) + '</span></div>';
      if (ot > 0) {
        h += '<div class="r"><span class="l">Overtime</span><span class="v" style="color:#c62828">' + ot + 'h \u00d7 $' + (rate*1.5).toFixed(2) + ' = $' + otPay.toFixed(2) + '</span></div>';
        if (en.overtimeDetails && en.overtimeDetails.length > 0) h += '<div class="ot-box">' + en.overtimeDetails.map(d => new Date(d.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) + ' ' + d.hours + 'h ($' + (d.hours*rate*1.5).toFixed(2) + ')').join(' &nbsp;\u2022&nbsp; ') + '</div>';
      }
      if (vac > 0) {
        h += '<div class="r"><span class="l">Vacation</span><span class="v" style="color:#1565c0">' + vac + 'h (' + vacDays.toFixed(1) + 'd) \u00d7 $' + rate.toFixed(2) + ' = $' + vacPay.toFixed(2) + '</span></div>';
        if (en.vacationDates && en.vacationDates.length > 0) h += '<div class="vc-box">' + en.vacationDates.map(d => { const dt = typeof d === 'string' ? d : d.date; const hrs = typeof d === 'object' && d.hours ? d.hours + 'h' : ''; return new Date(dt+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) + (hrs ? ' (' + hrs + ')' : ''); }).join(', ') + '</div>';
      }
      if (parseFloat(en.annualVacationDays) > 0) h += '<div class="bal">Vacation balance: ' + vacRem.toFixed(1) + ' / ' + parseFloat(en.annualVacationDays).toFixed(1) + ' days</div>';
      if (bonus > 0) h += '<div class="r"><span class="l">Bonus' + (en.bonusNotes ? ' \u2014 ' + en.bonusNotes : '') + '</span><span class="v">$' + bonus.toFixed(2) + '</span></div>';
      h += '<div class="gp"><span>Gross Pay</span><span>$' + parseFloat(en.grossPay).toFixed(2) + '</span></div></div></div>';
      return h;
    }).join('');
    const now = new Date();
    w.document.write('<html><head><title>Detailed Payroll</title><style>' + css + '</style></head><body>' +
      '<div class="hdr"><img src="/logo.png" onerror="this.style.display=\'none\'"/><div><div class="co">Carolina Rolling Co., Inc.</div><div class="dt">Detailed Payroll Report</div></div></div>' +
      '<div class="dr">' + sd + ' \u2014 ' + ed + '</div>' +
      cards +
      '<div class="tot">Total Gross Payroll: $' + parseFloat(pr.totalGross).toFixed(2) + '</div>' +
      '<div class="ft"><span>Generated: ' + now.toLocaleDateString() + ' ' + now.toLocaleTimeString() + '</span><span>CONFIDENTIAL \u2014 Carolina Rolling Co., Inc.</span></div>' +
      '</body></html>');
    w.document.close();
    w.print();
  };

  const applyExtHrs = async () => {
    if (extHrsEmps.length === 0 || extHrsDates.length === 0) { setErr('Select at least one employee and one date'); return; }
    setExtHrsSaving(true);
    try {
      for (const entryId of extHrsEmps) {
        const entry = (activePR?.entries || []).find(e => e.id === entryId);
        if (!entry) continue;
        const existing = [...(entry.overtimeDetails || [])];
        for (const date of extHrsDates) {
          const idx = existing.findIndex(x => x.date === date);
          if (idx >= 0) existing[idx] = { ...existing[idx], hours: existing[idx].hours + extHrsHours };
          else existing.push({ date, hours: extHrsHours });
        }
        existing.sort((a,b) => a.date.localeCompare(b.date));
        const totalOt = existing.reduce((s,x) => s + x.hours, 0);
        await updateEntry(entry, { overtimeDetails: existing, overtimeHours: totalOt });
      }
      await loadPR();
      setShowExtHrs(false);
      showMsg(`Extended hours applied to ${extHrsEmps.length} employee(s) across ${extHrsDates.length} day(s)`);
    } catch { setErr('Failed to apply extended hours'); }
    finally { setExtHrsSaving(false); }
  };

  const TABS = [
    {key:'invoicing',label:'Invoicing',icon:<FileText size={16}/>},
    {key:'coa',label:'Chart of Accounts',icon:<DollarSign size={16}/>},
    {key:'employees',label:'Employees & Payroll',icon:<Users size={16}/>},
    {key:'health',label:'Company Health',icon:<BarChart3 size={16}/>}
  ];
  const [coaTab, setCoaTab] = useState('ar');

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

      {tab === 'coa' && (
        <COATab
          ledger={ledger} ledgerFilter={ledgerFilter} setLedgerFilter={setLedgerFilter}
          ledgerSearch={ledgerSearch} setLedgerSearch={setLedgerSearch}
          ledgerExpanded={ledgerExpanded} setLedgerExpanded={setLedgerExpanded}
          loadLedger={loadLedger}
          coaTab={coaTab} setCoaTab={setCoaTab}
          paymentModal={paymentModal} setPaymentModal={setPaymentModal}
          paymentForm={paymentForm} setPaymentForm={setPaymentForm}
          handleRecordPayment={handleRecordPayment}
          liabs={liabs} liabSum={liabSum} liabLoad={liabLoad}
          liabF={liabF} setLiabF={setLiabF} liabCat={liabCat} setLiabCat={setLiabCat}
          loadLiabs={loadLiabs}
          showBill={showBill} setShowBill={setShowBill}
          editBill={editBill} setEditBill={setEditBill}
          bf={bf} setBf={setBf}
          billFileRef={billFileRef} uploadingBill={uploadingBill}
          handleBillFileUpload={handleBillFileUpload}
          handleSaveBill={handleSaveBill} handlePayBill={handlePayBill}
          handleRejectBill={handleRejectBill} handleApproveBill={handleApproveBill}
          handleDeleteBill={handleDeleteBill} daysUntil={daysUntil}
          showTakePayment={showTakePayment} setShowTakePayment={setShowTakePayment}
          showCreditMemo={showCreditMemo} setShowCreditMemo={setShowCreditMemo}
          showRefund={showRefund} setShowRefund={setShowRefund}
          getCreditMemos={getCreditMemos} setCreditMemos={setCreditMemos}
          getRefunds={getRefunds} setRefunds={setRefunds}
          fmt={fmt}
        />
      )}

      {tab === 'employees' && (
        <EmployeesTab
          emps={emps} empLoad={empLoad} showEmp={showEmp} setShowEmp={setShowEmp}
          editEmp={editEmp} setEditEmp={setEditEmp} ef={ef} setEf={setEf}
          loadEmps={loadEmps}
          vacEmp={vacEmp} setVacEmp={setVacEmp} vacLog={vacLog} setVacLog={setVacLog}
          vacNewDate={vacNewDate} setVacNewDate={setVacNewDate}
          vacNewHours={vacNewHours} setVacNewHours={setVacNewHours}
          vacNewNote={vacNewNote} setVacNewNote={setVacNewNote}
          payrolls={payrolls} activePR={activePR} setActivePR={setActivePR}
          showNewPR={showNewPR} setShowNewPR={setShowNewPR}
          prDates={prDates} setPrDates={setPrDates}
          otEntry={otEntry} setOtEntry={setOtEntry}
          otList={otList} setOtList={setOtList}
          otNewDate={otNewDate} setOtNewDate={setOtNewDate}
          otNewHrs={otNewHrs} setOtNewHrs={setOtNewHrs}
          showExtHrs={showExtHrs} setShowExtHrs={setShowExtHrs}
          extHrsEmps={extHrsEmps} setExtHrsEmps={setExtHrsEmps}
          vacEntryList={vacEntryList} setVacEntryList={setVacEntryList}
          vacEntryEmp={vacEntry} setVacEntryEmp={setVacEntry}
          vacEntryNewDate={vacEntryNewDate} setVacEntryNewDate={setVacEntryNewDate}
          vacEntryNewHours={vacEntryNewHrs} setVacEntryNewHours={setVacEntryNewHrs}
          gmailAccounts={gmailAccounts}
          payrollSenderAccountId={payrollSenderAccountId}
          setPayrollSenderAccountId={setPayrollSenderAccountId}
          sendingPayroll={sendingPayroll}
          payrollEmail={payrollEmail}
          payrollEmailEdit={payrollEmailEdit} setPayrollEmailEdit={setPayrollEmailEdit}
          handleSaveEmp={handleSaveEmp} handleDeleteEmp={handleDeleteEmp}
          handleReactivateEmp={handleReactivateEmp} handleMoveEmp={handleMoveEmp}
          handleSavePR={handleSavePR} handleDeletePR={handleDeletePR}
          handleSubmitPR={handleSubmitPR} handleUpdateEntry={handleUpdateEntry}
          handleSendPayroll={handleSendPayroll}
          saveOt={saveOt} saveVacEntry={saveVacEntry}
          printPayrollSummary={printPayrollSummary} printPayrollCsv={printPayrollCsv}
          previewPayroll={previewPayroll}
          fmt={fmt} formatPhone={formatPhone} daysUntil={daysUntil}
          showMsg={showMsg} setErr={setErr}
        />
      )}

      {tab === 'health' && (
        <HealthTab health={health} healthLoad={healthLoad} fmt={fmt} />
      )}
    </div>
  );
}

export default BusinessPage;
