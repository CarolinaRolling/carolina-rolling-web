import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ShoppingCart, Receipt, Mail, ChevronRight, CheckCircle2, RefreshCw, ExternalLink, PackageOpen, ScanLine } from 'lucide-react';
import { getEstimates, getPendingOrders, getCommBills, getCommCoverage, getMonitoredClients, updateBillStatus, updateCommEmailCategory, getUnlinkedShipments, getInboundPaperwork, uploadInboundPaperwork, confirmInboundPaperwork, reclassifyInboundPaperwork, dismissInboundPaperwork, dismissAllInboundPaperwork, convertPaperworkToEstimate, convertPaperworkToOrder, clearPaperworkDockReceive, getClients } from '../services/api';
import EstimateProgressBoard from '../components/EstimateProgressBoard';
import SupplierCommsTab from '../components/SupplierCommsTab';
import { formatDate } from '../utils/dates';

// One hub for everything waiting on a human decision, split into tabs:
// Estimates to review, Emails awaiting reply, Client orders to approve, Bills to approve.
// Estimates/emails from "email monitor" clients are prioritized to the top and color-coded.
const PRIORITY_COLOR = '#E65100';

export default function ReviewCenterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('tab') || 'estimates'; }
    catch { return 'estimates'; }
  });
  const [estimates, setEstimates] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [unlinked, setUnlinked] = useState([]);
  const [paperwork, setPaperwork] = useState([]);
  const [uploadingScan, setUploadingScan] = useState(false);
  const [monitored, setMonitored] = useState(new Set());

  const load = async (dispatchAfter = true) => {
    setRefreshing(true);
    const [est, ord, bil, cov, mon, unl, pap] = await Promise.allSettled([
      getEstimates({ status: 'draft' }),
      getPendingOrders('pending'),
      getCommBills(),
      getCommCoverage({ quotesOnly: true }),
      getMonitoredClients(),
      getUnlinkedShipments(),
      getInboundPaperwork(),
    ]);
    if (mon.status === 'fulfilled') setMonitored(new Set((mon.value.data.data || []).map(c => (c.name || '').trim().toLowerCase()).filter(Boolean)));
    if (est.status === 'fulfilled') setEstimates((est.value.data.data || []).filter(e => e.status === 'draft'));
    if (ord.status === 'fulfilled') setOrders(ord.value.data.data || []);
    if (bil.status === 'fulfilled') setBills((bil.value.data.data || []).filter(b => (b.billStatus || 'pending') === 'pending'));
    if (cov.status === 'fulfilled') setQuotes((cov.value.data.data || []).filter(e => !e.commResponded && !e.commHandledManually));
    if (unl.status === 'fulfilled') setUnlinked(unl.value.data.data || []);
    if (pap.status === 'fulfilled') setPaperwork(pap.value.data.data || []);
    setLoading(false); setRefreshing(false);
    // Only broadcast when this load was triggered by a real user action, NOT when it was itself
    // triggered by a reviewcount:refresh event — otherwise load->dispatch->listener->load loops forever.
    if (dispatchAfter) window.dispatchEvent(new Event('reviewcount:refresh')); // keep sidebar badge in sync
  };
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, []);

  // Reload the board when something elsewhere changes review state — e.g. an estimate is marked sent
  // (which removes it from the draft list), a bill is handled, etc. Without this the board only
  // loaded on mount, so a just-sent estimate lingered until a manual page reload.
  // NOTE: this reload passes dispatchAfter=false so it does NOT re-broadcast the event it's reacting
  // to (that would create an infinite refresh loop and hammer the API).
  useEffect(() => {
    let lastRun = 0;
    let pendingTimer = null;
    const onRefresh = () => {
      const now = Date.now();
      const since = now - lastRun;
      if (since >= 2000) { lastRun = now; load(false); }
      else if (!pendingTimer) {
        pendingTimer = setTimeout(() => { pendingTimer = null; lastRun = Date.now(); load(false); }, 2000 - since);
      }
    };
    window.addEventListener('reviewcount:refresh', onRefresh);
    // Also refresh when the tab regains focus, so returning to the board shows current state.
    window.addEventListener('focus', onRefresh);
    return () => {
      if (pendingTimer) clearTimeout(pendingTimer);
      window.removeEventListener('reviewcount:refresh', onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
    /* eslint-disable-next-line */
  }, []);

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
    .map(e => ({ id: e.id, label: e.estimateNumber || 'Estimate', sub: e.clientName || 'Unknown client', date: e.createdAt, priority: isMonitored(e.clientName), stage: e.workflowStage || 'created', quoteCount: e.quoteCount || 0, pricingQuotedNeedsEntry: e.pricingQuotedNeedsEntry, onClick: () => navigate(`/estimates/${e.id}`) }));

  const orderItems = [...orders].sort((a, b) => byDateAsc(a.createdAt, b.createdAt))
    .map(o => ({ id: o.id, label: o.clientName || 'Client order', sub: o.poNumber ? `PO ${o.poNumber}` : 'Client-submitted order', date: o.createdAt, onClick: () => navigate('/pending-orders') }));

  const quoteItems = [...quotes].sort((a, b) => byDateAsc(a.commLastMessageAt || a.receivedAt, b.commLastMessageAt || b.receivedAt))
    .map(e => ({ id: e.id, label: e.subject || '(no subject)', sub: e.fromName || e.fromEmail || '', date: e.commLastMessageAt || e.receivedAt, priority: isMonitored(e.fromName) || isMonitored(e.clientName), onClick: () => navigate(`/com-center?focus=${e.id}`) }));

  // Order requested: estimates, email, orders, bills
  const tabs = [
    { key: 'estimates', title: 'Estimates', icon: FileText, color: '#1565c0', items: estimateItems },
    { key: 'suppliers', title: 'Suppliers', icon: Mail, color: '#00838f', items: [], selfManaged: true },
    { key: 'email', title: 'Email', icon: Mail, color: '#2e7d32', items: quoteItems },
    { key: 'orders', title: 'Orders', icon: ShoppingCart, color: '#e65100', items: orderItems },
    { key: 'waiting', title: 'Waiting for Instructions', icon: PackageOpen, color: '#e65100', items: unlinked },
    { key: 'paperwork', title: 'Inbound Paperwork', icon: ScanLine, color: '#00838f', items: paperwork.filter(p => p.status === 'needs_review' || p.status === 'queued' || p.status === 'processing' || p.status === 'error' || p.status === 'awaiting_dock_receive') },
    { key: 'bills', title: 'Bills', icon: Receipt, color: '#6a1b9a', items: bills },
  ];
  const total = tabs.reduce((n, t) => n + t.items.length, 0);
  const active = tabs.find(t => t.key === activeTab) || tabs[0];

  const solidBtn = { border: 'none', color: 'white', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 };
  const ghostBtn = { border: '1px solid #ccc', background: 'white', color: '#555', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem' };

  const handleScanUpload = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setUploadingScan(true);
    try {
      for (const f of list) { try { await uploadInboundPaperwork(f); } catch (e) { /* continue */ } }
      // Give the background classifier a moment, then reload.
      setTimeout(load, 1500);
    } finally { setUploadingScan(false); }
  };
  const handleConfirmPaperwork = async (id, body) => {
    try { await confirmInboundPaperwork(id, body); load(); } catch {}
  };
  const handleReclassifyPaperwork = async (id, docType) => {
    try { await reclassifyInboundPaperwork(id, docType); load(); } catch {}
  };
  const handleDismissPaperwork = async (id) => {
    try { await dismissInboundPaperwork(id); load(); } catch {}
  };
  const handleDismissAllPaperwork = async () => {
    if (!window.confirm('Dismiss all items in the Inbound Paperwork review list? (Confirmed/filed items are not affected.)')) return;
    try { await dismissAllInboundPaperwork(); load(); } catch {}
  };
  const [pwClientPicker, setPwClientPicker] = useState(null); // { id, clientName, options }
  const [pwClientSel, setPwClientSel] = useState('');
  const handleConvertPaperwork = async (id, kind, clientId) => {
    try {
      const res = kind === 'order'
        ? await convertPaperworkToOrder(id, clientId)
        : await convertPaperworkToEstimate(id, clientId);
      const d = res.data?.data;
      setPwClientPicker(null);
      if (kind === 'estimate' && d?.estimateId) navigate(`/estimates/${d.estimateId}`);
      else if (kind === 'order') {
        window.alert(d?.duplicate
          ? 'A pending order for this PO already exists.'
          : `Pending order created${d?.matchedEstimateNumber ? ` — matched to ${d.matchedEstimateNumber}` : ''}. It's in the Orders tab.`);
        load();
      } else load();
    } catch (err) {
      if (err.response?.data?.error?.code === 'NO_CLIENT') {
        try {
          const cl = await getClients();
          setPwClientPicker({ id, kind, clientName: err.response?.data?.data?.clientName, options: (cl.data?.data || []) });
          setPwClientSel('');
        } catch { window.alert('No matching client, and the client list could not be loaded.'); }
      } else {
        window.alert(err.response?.data?.error?.message || 'Could not convert.');
      }
    }
  };
  const handleClearDockReceive = async (id) => {
    try { await clearPaperworkDockReceive(id); load(); } catch {}
  };

  const DOC_TYPE_LABELS = { estimate: 'Estimate', purchase_order: 'Purchase Order', delivery_form: 'Delivery Form', unknown: 'Unknown' };
  const ACTION_LABELS = {
    create_estimate: 'Create draft estimate',
    create_pending_order: 'Create pending order',
    receive_supplier_material: 'Receive supplier material',
    attach_to_order: 'Attach to order',
    needs_instructions: 'Flag: needs instructions',
    converted_to_estimate: 'Converted to estimate',
    converted_to_order: 'Converted to order',
    unknown: 'Review manually'
  };

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
      ) : activeTab === 'suppliers' ? (
        <SupplierCommsTab />
      ) : activeTab === 'paperwork' ? (
        <div>
          {/* Upload bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              Upload a scanned estimate, purchase order, or delivery form. The AI classifies it and recommends what to do — you confirm each one.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {paperwork.length > 0 && (
                <button onClick={handleDismissAllPaperwork} style={{ ...ghostBtn, fontSize: '0.78rem' }}>Dismiss all</button>
              )}
              <label style={{ ...solidBtn, background: '#00838f', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: uploadingScan ? 'wait' : 'pointer' }}>
                {uploadingScan ? 'Uploading…' : '⬆ Upload scan(s)'}
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
                  onChange={(e) => { handleScanUpload(e.target.files); e.target.value = ''; }} disabled={uploadingScan} />
              </label>
            </div>
          </div>
          {paperwork.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>
              <ScanLine size={40} style={{ marginBottom: 10 }} />
              <div style={{ fontWeight: 600 }}>No paperwork in the queue</div>
              <div style={{ fontSize: '0.85rem' }}>Upload a scan to get started.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {paperwork.map(p => {
                const busy = p.status === 'queued' || p.status === 'processing';
                const done = p.status === 'confirmed';
                const err = p.status === 'error';
                const awaiting = p.status === 'awaiting_dock_receive';
                const isEstimate = p.docType === 'estimate';
                const isPO = p.docType === 'purchase_order';
                return (
                  <div key={p.id} className="card" style={{ padding: 14, borderLeft: `4px solid ${err ? '#c62828' : awaiting ? '#ef6c00' : done ? '#2e7d32' : '#00838f'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{p.originalName || 'scan'}</strong>
                          {p.docType && <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#e0f7fa', color: '#00838f', borderRadius: 99, padding: '1px 8px' }}>{DOC_TYPE_LABELS[p.docType] || p.docType}</span>}
                          {p.classifyConfidence === 'low' && <span style={{ fontSize: '0.7rem', color: '#e65100', fontWeight: 700 }}>⚠ low confidence</span>}
                          {p.fileUrl && <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.74rem', color: '#3949ab' }}>view scan</a>}
                        </div>
                        {busy && <div style={{ fontSize: '0.82rem', color: '#00838f', marginTop: 4 }}>⏳ AI is reading this…</div>}
                        {err && <div style={{ fontSize: '0.82rem', color: '#c62828', marginTop: 4 }}>Error: {p.errorMessage || 'classification failed'}</div>}
                        {p.aiSummary && !busy && <div style={{ fontSize: '0.82rem', color: '#555', marginTop: 4 }}>{p.aiSummary}</div>}
                        {p.recommendationNote && !busy && (
                          <div style={{ fontSize: '0.82rem', color: '#00695c', marginTop: 6, background: '#e0f2f1', borderRadius: 6, padding: '5px 9px' }}>
                            💡 {p.recommendationNote}
                          </div>
                        )}
                        {awaiting && (
                          <div style={{ fontSize: '0.82rem', color: '#e65100', marginTop: 6, background: '#fff3e0', borderRadius: 6, padding: '5px 9px', fontWeight: 600 }}>
                            📦 {p.recommendationNote || 'Received from scan — no dock shipment registered.'}
                          </div>
                        )}
                        {done && <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: 6, fontWeight: 600 }}>✓ {ACTION_LABELS[p.resolvedAction] || p.resolvedAction}{p.resultRef && p.resultRef !== 'manual' ? ` · ${p.resultRef}` : ''}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
                        {p.status === 'needs_review' && isEstimate && (
                          <button style={{ ...solidBtn, background: '#00838f' }} onClick={() => handleConvertPaperwork(p.id, 'estimate')}>
                            📝 Convert to Estimate
                          </button>
                        )}
                        {p.status === 'needs_review' && isPO && (
                          <button style={{ ...solidBtn, background: '#e65100' }} onClick={() => handleConvertPaperwork(p.id, 'order')}>
                            📋 Convert to Order
                          </button>
                        )}
                        {p.status === 'needs_review' && !isEstimate && !isPO && (
                          <button style={{ ...solidBtn, background: '#2e7d32' }} onClick={() => handleConfirmPaperwork(p.id)}>
                            ✓ {ACTION_LABELS[p.recommendedAction] || 'Confirm'}
                          </button>
                        )}
                        {p.status === 'needs_review' && (
                          <select defaultValue="" onChange={(e) => { if (e.target.value) handleReclassifyPaperwork(p.id, e.target.value); }}
                            style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: 5, border: '1px solid #ccc' }}>
                            <option value="">Change type…</option>
                            <option value="estimate">Estimate</option>
                            <option value="purchase_order">Purchase Order</option>
                            <option value="delivery_form">Delivery Form</option>
                          </select>
                        )}
                        {awaiting && (
                          <button style={{ ...solidBtn, background: '#ef6c00' }} onClick={() => handleClearDockReceive(p.id)}>
                            ✓ Confirm shipment received
                          </button>
                        )}
                        {(err || p.status === 'needs_review' || awaiting || done) && (
                          <button style={{ ...ghostBtn, fontSize: '0.73rem' }} onClick={() => handleDismissPaperwork(p.id)}>Dismiss</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {pwClientPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPwClientPicker(null)}>
              <div className="card" style={{ maxWidth: 460, width: '90%', padding: 20 }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>Which client is this estimate for?</h3>
                <div style={{ background: '#fff8ec', border: '1px solid #ffe0b2', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: '0.85rem' }}>
                  No client matched{pwClientPicker.clientName ? <strong> {pwClientPicker.clientName}</strong> : ''}. Pick one, or create the client first.
                </div>
                <select value={pwClientSel} onChange={e => setPwClientSel(e.target.value)} style={{ width: '100%', padding: 8 }}>
                  <option value="">— select a client —</option>
                  {(pwClientPicker.options || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
                  <button style={ghostBtn} onClick={() => { setPwClientPicker(null); navigate('/clients-vendors'); }}>+ Create a client first</button>
                  <button style={{ ...solidBtn, background: '#00838f' }} disabled={!pwClientSel} onClick={() => handleConvertPaperwork(pwClientPicker.id, pwClientPicker.kind || 'estimate', pwClientSel)}>Convert with this client</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : active.items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 50, color: '#2e7d32' }}>
          <CheckCircle2 size={36} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 600, fontSize: '1.02rem' }}>All clear.</div>
          <div style={{ fontSize: '0.85rem', color: '#888', marginTop: 4 }}>Nothing in {active.title.toLowerCase()} needs review right now.</div>
        </div>
      ) : activeTab === 'waiting' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {unlinked.map(s => (
            <div key={s.id} className="card" style={{ padding: 14, borderLeft: '4px solid #e65100', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.clientName}</div>
                {s.description && <div style={{ fontSize: '0.82rem', color: '#666' }}>{s.description.length > 90 ? s.description.slice(0, 90) + '…' : s.description}</div>}
                <div style={{ fontSize: '0.78rem', color: '#999', marginTop: 2 }}>
                  Received {formatDate(s.receivedAt || s.createdAt)}
                  {s.clientPurchaseOrderNumber && <span style={{ color: '#1976d2', marginLeft: 8 }}>PO# {s.clientPurchaseOrderNumber}</span>}
                  {s.location && ` • ${s.location}`}
                  {s.receivedBy && ` • by ${s.receivedBy}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button style={ghostBtn} onClick={() => navigate(`/shipment/${s.id}`)}>Details</button>
                <button style={{ ...solidBtn, background: '#e65100' }} onClick={() => navigate(`/shipment/${s.id}`)}>Create Work Order</button>
              </div>
            </div>
          ))}
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
                {it.stage && (
                  <div style={{ marginTop: 6 }}>
                    <EstimateProgressBoard estimateId={it.id} stage={it.stage} quoteCount={it.quoteCount} pricingQuotedNeedsEntry={it.pricingQuotedNeedsEntry} compact />
                  </div>
                )}
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
