import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Archive, ExternalLink, Tag, Mail, AlertCircle, DollarSign, Megaphone, Shield, MessageSquare, Users, Zap, CheckCircle, Clock, CheckCheck } from 'lucide-react';
import { getCommEmails, archiveCommEmail, updateCommEmailCategory, scanCommNow, getCommScanLogs, testCommConnection, cancelCommScan, getCommCoverage, markCommHandled, scanCommCoverage, reclassifyComm, getCommGmailUrl, cleanupStaleComm, getCommBills, updateBillStatus, scanCommBills, convertEmailToEstimate, getClients, getAiParseStatus, enqueueConvert, getConvertQueue, resolveConvertQueueItem, dismissConvertQueueItem } from '../services/api';

const CATEGORIES = [
  { key: 'all',            label: 'All',            color: '#555',    bg: '#f5f5f5', icon: '✉️' },
  { key: 'client_inquiry', label: 'Client Inquiry', color: '#1565c0', bg: '#e3f2fd', icon: '👤' },
  { key: 'vendor',         label: 'Vendors',        color: '#E65100', bg: '#fff3e0', icon: '🏭' },
  { key: 'bill',           label: 'Bills',          color: '#6a1b9a', bg: '#f3e5f5', icon: '💵' },
  { key: 'general',        label: 'General',        color: '#2e7d32', bg: '#e8f5e9', icon: '💬' },
  { key: 'marketing',      label: 'Marketing',      color: '#f57c00', bg: '#fff8e1', icon: '📣' },
  { key: 'spam',           label: 'Spam',           color: '#c62828', bg: '#ffebee', icon: '🚫' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));
// Only these three appear as tabs in the sidebar
const SIDEBAR_CATEGORIES = CATEGORIES.filter(c => ['client_inquiry', 'vendor', 'bill'].includes(c.key));

function CategoryBadge({ category }) {
  const cat = CAT_MAP[category] || CAT_MAP['general'];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, background: cat.bg, color: cat.color, whiteSpace: 'nowrap' }}>
      {cat.icon} {cat.label}
    </span>
  );
}

function formatDate(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const diff = Date.now() - d;
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

const ghostBtn = { background: 'white', border: '1px solid #ddd', color: '#555', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 };
const solidBtn = { color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 };

function BillField({ label, value, strong }) {
  return (<div><span style={{ color: '#999', fontSize: '0.72rem' }}>{label}: </span><span style={{ fontWeight: strong ? 700 : 500 }}>{value || '—'}</span></div>);
}

function BillsView({ bills, pending, scanning, onScan, onReload, onStatus, onOpen }) {
  const money = (v, c) => v == null ? '—' : `${(!c || c === 'USD') ? '$' : c + ' '}${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>{pending} awaiting review · {bills.length} total</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onReload} style={ghostBtn}>Refresh</button>
          <button onClick={onScan} disabled={scanning} style={{ ...ghostBtn, color: '#6a1b9a', borderColor: '#ce93d8' }}>{scanning ? 'Reading…' : 'Read new invoices'}</button>
        </div>
      </div>
      {bills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🧾</div>
          <div style={{ fontWeight: 600 }}>No bills yet</div>
          <div style={{ fontSize: '0.8rem' }}>Invoices land here once a bill email is scanned — from a PDF attachment or from the email body.</div>
        </div>
      ) : bills.map((b) => {
        const d = b.billData || {};
        const status = b.billStatus || 'pending';
        const err = d.error;
        const accent = status === 'approved' ? '#2e7d32' : status === 'rejected' ? '#c62828' : '#6a1b9a';
        return (
          <div key={b.id} style={{ background: 'white', border: '1px solid #e4e4e4', borderRadius: 10, padding: 14, marginBottom: 10, borderLeft: `4px solid ${accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.vendorName || b.fromName || b.fromEmail}</div>
                <div style={{ fontSize: '0.78rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.subject}</div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 99, alignSelf: 'flex-start',
                background: status === 'approved' ? '#e8f5e9' : status === 'rejected' ? '#ffebee' : '#f3e5f5', color: accent }}>
                {status === 'pending' ? 'Needs review' : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            {err ? (
              <div style={{ fontSize: '0.8rem', color: '#c62828', marginTop: 8 }}>
                {err === 'no_pdf' ? 'No PDF invoice found on this email — open it to check.' : 'Could not read this invoice automatically — open it to review.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px', marginTop: 10, fontSize: '0.82rem' }}>
                <BillField label="Invoice #" value={d.invoiceNumber} />
                <BillField label="Amount" value={money(d.amount, d.currency)} strong />
                <BillField label="Invoice date" value={d.invoiceDate} />
                <BillField label="Due" value={d.dueDate} />
                {d.poNumber && <BillField label="PO" value={d.poNumber} />}
              </div>
            )}
            {d.summary && !err && <div style={{ fontSize: '0.78rem', color: '#777', marginTop: 8 }}>{d.summary}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {status !== 'approved' && <button onClick={() => onStatus(b.id, 'approved')} style={{ ...solidBtn, background: '#2e7d32' }}>✓ Approve</button>}
              {status !== 'rejected' && <button onClick={() => onStatus(b.id, 'rejected')} style={{ ...solidBtn, background: '#c62828' }}>✕ Reject</button>}
              {status !== 'pending' && <button onClick={() => onStatus(b.id, 'pending')} style={ghostBtn}>Reset</button>}
              <a href={b.gmailLink} onClick={(ev) => onOpen(ev, b.id, b.gmailLink)} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={12} /> Open email</a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function subTabStyle(active, color) {
  return {
    padding: '5px 14px', borderRadius: 99, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
    border: `1px solid ${active ? color : '#ddd'}`,
    background: active ? color : 'white',
    color: active ? 'white' : '#666',
  };
}

export default function CommunicationCenterPage() {
  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('client_inquiry');
  const [clientSubTab, setClientSubTab] = useState('all'); // 'all' | 'respond_to'
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState(null);
  const [categoryMenuId, setCategoryMenuId] = useState(null);
  const [coverage, setCoverage] = useState([]);
  const [coverageAwaiting, setCoverageAwaiting] = useState(0);
  const [coverageScanning, setCoverageScanning] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [bills, setBills] = useState([]);
  const [billsPending, setBillsPending] = useState(0);
  const [billsScanning, setBillsScanning] = useState(false);
  const [showCoverage, setShowCoverage] = useState(true);
  const logsRef = React.useRef(null);
  const userScrolledUp = React.useRef(false);
  // Focus/highlight a specific email when arriving from the Review Center (/com-center?focus=<id>).
  const [focusId, setFocusId] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('focus') || null; } catch { return null; }
  });
  const emailRowRefs = React.useRef({});
  // Accordion: which email row is expanded to show its body (one at a time).
  const [expandedId, setExpandedId] = useState(null);

  const loadCoverage = useCallback(async () => {
    try {
      const res = await getCommCoverage({ quotesOnly: true });
      setCoverage(res.data.data || []);
      setCoverageAwaiting(res.data.awaiting || 0);
    } catch { /* quiet */ }
  }, []);

  const handleRescanCoverage = async () => {
    setCoverageScanning(true);
    try { await scanCommCoverage(); await loadCoverage(); }
    catch {} finally { setCoverageScanning(false); }
  };

  const handleMarkHandled = async (id, threadId) => {
    try {
      await markCommHandled(id, true);
      window.dispatchEvent(new Event('reviewcount:refresh'));
      const match = (e) => e.id === id || (threadId && e.gmailThreadId === threadId);
      const patch = (e) => (match(e) ? { ...e, commResponded: true, commHandledManually: true } : e);
      const wasAwaiting = coverage.some(e => match(e) && !(e.commResponded || e.commHandledManually));
      setEmails((prev) => prev.map(patch));
      setCoverage((prev) => prev.map(patch));
      if (wasAwaiting) setCoverageAwaiting((n) => Math.max(n - 1, 0));
    } catch {}
  };

  // --- Convert email to estimate (queue-based) ---
  const navigate = useNavigate();
  const [clientPicker, setClientPicker] = useState(null); // { scannedEmailId? | queueItemId?, options }
  const [clientPickerSel, setClientPickerSel] = useState('');
  const [queue, setQueue] = useState([]);
  const [queueCounts, setQueueCounts] = useState({});

  const loadQueue = useCallback(async () => {
    try {
      const res = await getConvertQueue();
      setQueue(res.data?.data || []);
      setQueueCounts(res.data?.counts || {});
    } catch { /* quiet */ }
  }, []);

  // Poll the queue while the page is open so buttons + the Queue tab reflect background progress.
  useEffect(() => {
    loadQueue();
    const iv = setInterval(loadQueue, 4000);
    return () => clearInterval(iv);
  }, [loadQueue]);

  // scannedEmailId -> its most-recent queue item, for per-row button state.
  const queueByEmail = React.useMemo(() => {
    const m = {};
    for (const it of queue) { if (!m[it.scannedEmailId]) m[it.scannedEmailId] = it; }
    return m;
  }, [queue]);

  const handleConvertClick = async (scannedEmailId) => {
    try {
      await enqueueConvert(scannedEmailId);
      setMessage('Added to the convert queue — processing in the background.');
      loadQueue();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not add to the queue.');
    }
  };

  const openClientPicker = async (opts) => {
    try {
      const cl = await getClients();
      setClientPicker({ ...opts, options: (cl.data?.data || []) });
      setClientPickerSel('');
    } catch { setError('Could not load the client list.'); }
  };

  const submitClientPick = async () => {
    if (!clientPickerSel || !clientPicker) return;
    try {
      if (clientPicker.queueItemId) await resolveConvertQueueItem(clientPicker.queueItemId, clientPickerSel);
      else if (clientPicker.scannedEmailId) await enqueueConvert(clientPicker.scannedEmailId, clientPickerSel);
      setClientPicker(null);
      setMessage('Client set — the item is back in the queue.');
      loadQueue();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not set the client.');
    }
  };

  const dismissQueueItem = async (id) => {
    try { await dismissConvertQueueItem(id); loadQueue(); } catch {}
  };

  // Renders the Convert-to-Estimate control for an email, reflecting its queue state. Returns null when
  // the email isn't an RFQ and isn't already in the queue. Shared by the merged inquiry list.
  const renderConvertControl = (e) => {
    const qi = queueByEmail[e.id];
    if (!qi && !e.isRfq) return null;
    if (qi && (qi.status === 'queued' || qi.status === 'processing')) {
      return <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#00695c', flexShrink: 0 }} title="In the convert queue">⏳ {qi.status === 'processing' ? 'Converting…' : 'Queued'}</span>;
    }
    if (qi && qi.status === 'needs_client') {
      return <button onClick={(ev) => { ev.stopPropagation(); openClientPicker({ queueItemId: qi.id, fromEmail: qi.fromEmail, fromName: qi.fromName, subject: qi.subject }); }}
        style={{ background: '#ef6c00', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, flexShrink: 0 }}>⚠️ Pick client</button>;
    }
    if (qi && qi.status === 'done' && qi.estimateId) {
      return (
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={(ev) => { ev.stopPropagation(); navigate(`/estimates/${qi.estimateId}`); }}
            style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}>
            ✅ {qi.estimateNumber || 'Estimate'}{qi.partsCreated != null ? ` · ${qi.partsCreated}p` : ''}
          </button>
          <button onClick={(ev) => { ev.stopPropagation(); handleConvertClick(e.id); }} title="Re-run conversion" style={{ background: '#eceff1', color: '#00695c', border: '1px solid #b0bec5', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>↻ Rescan</button>
        </span>
      );
    }
    if (qi && qi.status === 'error') {
      return <button onClick={(ev) => { ev.stopPropagation(); handleConvertClick(e.id); }} title={qi.errorMessage || 'Conversion failed — retry'}
        style={{ background: '#c62828', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, flexShrink: 0 }}>⚠️ Retry</button>;
    }
    return <button onClick={(ev) => { ev.stopPropagation(); handleConvertClick(e.id); }}
      title="AI-parse this RFQ's attachments into a draft estimate"
      style={{ background: '#00838f', color: 'white', border: '1px solid #00838f', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, flexShrink: 0 }}>📝 Convert to Estimate</button>;
  };

  const loadBills = useCallback(async () => {
    try {
      const res = await getCommBills();
      setBills(res.data.data || []);
      setBillsPending(res.data.pending || 0);
    } catch { /* quiet */ }
  }, []);

  const handleScanBills = async () => {
    setBillsScanning(true);
    try { await scanCommBills(); setMessage('Reading invoices in the background — click Refresh in a minute.'); }
    catch { setError('Bill scan failed to start'); }
    finally { setBillsScanning(false); }
  };

  const handleBillStatus = async (id, status) => {
    try {
      await updateBillStatus(id, status);
      window.dispatchEvent(new Event('reviewcount:refresh'));
      setBills((prev) => {
        const next = prev.map((b) => b.id === id ? { ...b, billStatus: status } : b);
        setBillsPending(next.filter((b) => (b.billStatus || 'pending') === 'pending').length);
        return next;
      });
    } catch {}
  };

  const handleOpenEmail = async (e, id, fallback) => {
    if (e) e.preventDefault();
    // Open a blank tab synchronously (avoids popup blockers), then point it at the resolved URL
    const win = window.open('about:blank', '_blank');
    try {
      const res = await getCommGmailUrl(id);
      const url = (res.data && res.data.data && res.data.data.url) || fallback;
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch {
      if (win) win.location.href = fallback; else window.open(fallback, '_blank');
    }
  };

  const handleCleanupStale = async () => {
    if (!window.confirm('Mark every conversation with no activity in the last 3 weeks as responded? This clears out old, closed-out threads.')) return;
    setCleaning(true);
    try {
      const res = await cleanupStaleComm(21);
      const n = (res.data && res.data.data && res.data.data.updated) || 0;
      setMessage(`Cleaned up ${n} stale conversation${n === 1 ? '' : 's'}.`);
      await loadEmails();
      await loadCoverage();
    } catch { setError('Cleanup failed'); }
    finally { setCleaning(false); }
  };

  const handleReclassify = async () => {
    if (!window.confirm('Re-sort recent emails with the latest classifier? This runs in the background and takes a minute or two.')) return;
    setReclassifying(true);
    try {
      await reclassifyComm();
      setMessage('Re-sorting in the background — click Refresh in a minute to see updated categories.');
    } catch { setError('Failed to start re-sort'); }
    finally { setReclassifying(false); }
  };

  const loadEmails = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getCommEmails({ category: activeCategory, archived: showArchived, limit: 200 });
      setEmails(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { setError('Failed to load emails'); }
    finally { setLoading(false); }
  }, [activeCategory, showArchived]);

  useEffect(() => { loadEmails(); }, [loadEmails]);
  useEffect(() => { loadCoverage(); }, [loadCoverage]);
  useEffect(() => { if (activeCategory === 'bill') loadBills(); }, [activeCategory, loadBills]);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(t); } }, [message]);

  // When arriving with ?focus=<id>, land on the Client Inquiry tab, then scroll to and briefly
  // highlight that email in the merged list once it has loaded and rendered.
  useEffect(() => {
    if (focusId) { setActiveCategory('client_inquiry'); setClientSubTab('all'); }
  }, [focusId]);
  useEffect(() => {
    if (!focusId) return;
    if (activeCategory !== 'client_inquiry') return;
    if (!emails || emails.length === 0) return; // wait until the list has loaded
    const t = setTimeout(() => {
      const el = emailRowRefs.current[focusId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const clear = setTimeout(() => setFocusId(null), 3500);
        return () => clearTimeout(clear);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [focusId, activeCategory, emails]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await getCommScanLogs();
      setLogs(res.data.data || []);
      const st = res.data.status;
      if (st?.running) setScanning(true);
      // Auto-scroll to bottom only if user hasn't scrolled up
      if (!userScrolledUp.current && logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    } catch { /* silent */ }
    finally { setLogsLoading(false); }
  };

  const handleScanNow = async () => {
    setScanning(true);
    setMessage('Scanning all accounts...');
    setShowLogs(true);
    try {
      await scanCommNow();
      // Poll until scan completes (status.running === false) — max 5 minutes
      let polls = 0;
      const maxPolls = 150; // 5 min at 2s intervals
      const interval = setInterval(async () => {
        polls++;
        const res = await getCommScanLogs().catch(() => null);
        if (res) setLogs(res.data.data || []);
        const status = res?.data?.status;
        // Stop when running=false OR timeout
        if ((status && !status.running) || polls >= maxPolls) {
          clearInterval(interval);
          if (status?.error) {
            setError('Scan failed: ' + status.error);
          } else {
            setMessage('Scan complete — inbox refreshed');
            setTimeout(() => setShowLogs(false), 2000);
          }
          await loadEmails();
          setScanning(false);
        }
      }, 2000);
    } catch (e) {
      setError('Scan request failed: ' + (e.response?.data?.error?.message || e.message));
      setScanning(false);
      await fetchLogs();
    }
  };

  const handleArchive = async (id) => {
    try { await archiveCommEmail(id); setEmails(prev => prev.filter(e => e.id !== id)); setMessage(showArchived ? 'Restored' : 'Archived'); }
    catch { setError('Failed'); }
  };

  const handleCategoryChange = async (id, category) => {
    try { await updateCommEmailCategory(id, category); setEmails(prev => prev.map(e => e.id === id ? { ...e, commCategory: category } : e)); setCategoryMenuId(null); setMessage('Category updated'); }
    catch { setError('Failed'); }
  };

  const counts = {}; emails.forEach(e => { counts[e.commCategory] = (counts[e.commCategory] || 0) + 1; }); counts['all'] = emails.length;

  // Show only the most recent email per conversation (thread)
  const dedupedEmails = (() => {
    const byThread = new Map();
    for (const e of emails) {
      const key = e.gmailThreadId || e.id;
      const prev = byThread.get(key);
      if (!prev || new Date(e.receivedAt) > new Date(prev.receivedAt)) byThread.set(key, e);
    }
    return [...byThread.values()];
  })();
  const isResponded = (e) => e.commResponded || e.commHandledManually;

  const respondToCount = dedupedEmails.filter(e => !isResponded(e)).length;

  // Set of email ids that are quote requests (from the coverage feed). On the Client Inquiry tab these
  // float to the top, highlighted, and carry the Convert control — replacing the old separate panel.
  const quoteIds = new Set(coverage.map(c => c.id));
  const quoteById = new Map(coverage.map(c => [c.id, c]));
  const decorate = (e) => {
    const rawRfq = e.emailType === 'rfq' || e.commIsQuoteRequest === true;
    if (quoteById.has(e.id)) return { ...e, isRfq: e.isRfq ?? quoteById.get(e.id).isRfq ?? rawRfq, _isQuote: true };
    return { ...e, isRfq: e.isRfq ?? rawRfq, _isQuote: false };
  };

  let displayEmails;
  if (activeCategory === 'client_inquiry' && clientSubTab === 'respond_to') {
    displayEmails = dedupedEmails.filter(e => !isResponded(e)).map(decorate);
  } else {
    displayEmails = dedupedEmails.map(decorate);
  }
  // On the inquiry tab, float quote requests (esp. unanswered) to the very top.
  if (activeCategory === 'client_inquiry') {
    displayEmails = [...displayEmails].sort((a, b) => {
      const aq = a._isQuote, bq = b._isQuote;
      if (aq !== bq) return aq ? -1 : 1;                       // quotes first
      const aAns = isResponded(a), bAns = isResponded(b);
      if (aq && bq && aAns !== bAns) return aAns ? 1 : -1;     // among quotes, unanswered first
      return new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0); // then newest
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #e0e0e0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>💬 Communication Center</h1>
          <p style={{ margin: '2px 0 0', color: '#888', fontSize: '0.78rem' }}>All incoming emails — scanned every 30 min · {total} total</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', color: '#666' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived
          </label>
          <button onClick={loadEmails} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'white', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleReclassify} disabled={reclassifying} title="Re-run categorization on recent emails"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'white', color: '#6a1b9a', border: '1px solid #ce93d8', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <Tag size={13} /> {reclassifying ? 'Starting…' : 'Re-sort'}
          </button>
          <button onClick={handleCleanupStale} disabled={cleaning} title="Mark conversations idle for 3+ weeks as responded"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'white', color: '#00838f', border: '1px solid #80deea', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <CheckCheck size={13} /> {cleaning ? 'Cleaning…' : 'Clean up'}
          </button>
          {scanning ? (
            <button onClick={async () => { await cancelCommScan().catch(() => {}); setScanning(false); setMessage('Scan cancelled'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#c62828', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
              ✕ Cancel Scan
            </button>
          ) : (
            <button onClick={handleScanNow}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#f57c00', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
              ⚡ Scan Now
            </button>
          )}
          <button onClick={async () => {
            setShowLogs(true);
            setMessage('Testing Gmail connections...');
            try {
              const res = await testCommConnection();
              const results = res.data.results || [];
              results.forEach(r => {
                if (r.ok) setLogs(prev => [{ ts: new Date().toISOString(), level: 'info', message: '✅ ' + r.account + ' connected — ' + r.messagesTotal + ' total messages', detail: null }, ...prev]);
                else setLogs(prev => [{ ts: new Date().toISOString(), level: 'error', message: '❌ ' + r.account + ' FAILED', detail: r.error }, ...prev]);
              });
              setMessage(results.every(r => r.ok) ? 'All accounts connected' : 'Some accounts have errors — check logs');
            } catch(e) { setError('Test failed: ' + (e.response?.data?.error || e.message)); }
          }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'white', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            🔌 Test Connection
          </button>
          <button onClick={async () => { setShowLogs(s => !s); if (!showLogs) await fetchLogs(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: showLogs ? '#1565c0' : 'white', color: showLogs ? 'white' : '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            📋 {showLogs ? 'Hide Logs' : 'Logs'}
          </button>
        </div>
      </div>

      {message && <div style={{ padding: '7px 24px', background: '#e8f5e9', borderBottom: '1px solid #a5d6a7', color: '#2e7d32', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>{message}</div>}
      {error && <div style={{ padding: '7px 24px', background: '#ffebee', borderBottom: '1px solid #ef9a9a', color: '#c62828', fontSize: '0.82rem', flexShrink: 0 }}>{error}</div>}

      {/* Quote coverage status bar — the quote requests themselves now live in the list below,
          floated to the top and highlighted. This bar just summarizes + offers a re-check. */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #e0e0e0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '0.9rem' }}>
          📋 Quote Coverage
          {coverageAwaiting > 0
            ? <span style={{ background: '#fff3e0', color: '#e65100', borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{coverageAwaiting} awaiting reply</span>
            : <span style={{ background: '#e8f5e9', color: '#2e7d32', borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>All answered</span>}
          <span style={{ color: '#aaa', fontSize: '0.76rem', fontWeight: 400 }}>— shown at the top of the list below</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); handleRescanCoverage(); }} disabled={coverageScanning}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #1976d2', color: '#1976d2', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.78rem' }}>
          <RefreshCw size={13} className={coverageScanning ? 'spin' : ''} /> {coverageScanning ? 'Checking…' : 'Re-check'}
        </button>
      </div>


      {/* Client picker — shown when Convert found no confident client match (never auto-creates) */}
      {clientPicker && (
        <div className="modal-overlay" onClick={() => setClientPicker(null)}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>📝 Which client is this for?</h3>
              <button className="btn btn-icon" onClick={() => setClientPicker(null)}>✕</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ background: '#fff8ec', border: '1px solid #ffe0b2', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: '0.85rem' }}>
                No existing client matched <strong>{clientPicker.fromName || clientPicker.fromEmail}</strong>
                {clientPicker.fromEmail ? <span style={{ color: '#777' }}> ({clientPicker.fromEmail})</span> : null}.
                Pick the right client below, or create the client first and then convert. The AI won't create clients on its own.
              </div>
              <label className="form-label">Existing clients</label>
              <select className="form-input" value={clientPickerSel} onChange={ev => setClientPickerSel(ev.target.value)} style={{ width: '100%' }}>
                <option value="">— select a client —</option>
                {(clientPicker.options || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" onClick={() => { setClientPicker(null); navigate('/clients'); }}>
                  + Create a client first
                </button>
                <button className="btn btn-primary" disabled={!clientPickerSel}
                  style={{ background: '#00838f', borderColor: '#00838f' }}
                  onClick={submitClientPick}>
                  Use this client
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Scan Logs Panel */}
      {showLogs && (
        <div style={{ background: '#1a1a2e', color: '#e0e0e0', fontSize: '0.75rem', fontFamily: 'monospace', flexShrink: 0, borderBottom: '2px solid #333' }}>
          {/* Log toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', borderBottom: '1px solid #333', background: '#111' }}>
            <span style={{ color: '#aaa', fontWeight: 600, fontSize: '0.78rem' }}>
              📋 Scan Log
              {scanning && <span style={{ color: '#f57c00', marginLeft: 8 }}>● RUNNING</span>}
              {!scanning && logs.length > 0 && <span style={{ color: '#888', marginLeft: 8 }}>({logs.length} entries)</span>}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {userScrolledUp.current && (
                <button onClick={() => { userScrolledUp.current = false; if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }}
                  style={{ background: '#f57c00', border: 'none', color: 'white', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                  ↓ Resume scroll
                </button>
              )}
              <button onClick={() => { userScrolledUp.current = false; fetchLogs(); }}
                style={{ background: 'none', border: '1px solid #444', color: '#aaa', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '0.7rem' }}>↻ Refresh</button>
              <button onClick={() => setLogs([])}
                style={{ background: 'none', border: '1px solid #444', color: '#888', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '0.7rem' }}>Clear</button>
            </div>
          </div>
          {/* Log entries */}
          <div ref={logsRef} style={{ maxHeight: 240, overflowY: 'auto', padding: '8px 14px' }}
            onScroll={(e) => {
              const el = e.target;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
              userScrolledUp.current = !atBottom;
            }}>
            {logs.length === 0 ? (
              <div style={{ color: '#555', fontStyle: 'italic', padding: '4px 0' }}>No log entries yet — click Scan Now to start</div>
            ) : [...logs].reverse().map((log, i) => (
              <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid #1e1e2e' }}>
                <span style={{ color: '#555', marginRight: 6, userSelect: 'none' }}>
                  {new Date(log.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {log.level === 'error' && (
                  <span style={{ background: '#c62828', color: 'white', borderRadius: 3, padding: '0 5px', marginRight: 6, fontSize: '0.68rem', fontWeight: 700 }}>ERROR</span>
                )}
                {log.level === 'warn' && (
                  <span style={{ background: '#f57c00', color: 'white', borderRadius: 3, padding: '0 5px', marginRight: 6, fontSize: '0.68rem', fontWeight: 700 }}>WARN</span>
                )}
                <span style={{ color: log.level === 'error' ? '#ff8a80' : log.level === 'warn' ? '#ffd740' : '#b9f6ca' }}>
                  {log.message}
                </span>
                {log.detail && (
                  <div style={{ color: '#ff6e6e', paddingLeft: 16, whiteSpace: 'pre-wrap', fontSize: '0.7rem', background: '#2a0000', padding: '4px 8px', borderRadius: 4, marginTop: 3 }}>
                    {log.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {/* Sidebar */}
        <div style={{ width: 190, borderRight: '1px solid #e8e8e8', background: '#fafafa', flexShrink: 0, overflowY: 'auto' }}>
          {SIDEBAR_CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => { setActiveCategory(cat.key); if (cat.key !== 'client_inquiry') setClientSubTab('all'); }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              padding: '10px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
              borderLeft: activeCategory === cat.key ? '3px solid ' + cat.color : '3px solid transparent',
              background: activeCategory === cat.key ? 'white' : 'transparent',
              color: activeCategory === cat.key ? cat.color : '#555',
              fontWeight: activeCategory === cat.key ? 700 : 400,
              fontSize: '0.84rem', borderBottom: '1px solid #f0f0f0'
            }}>
              <span>{cat.icon} {cat.label}</span>
              {(counts[cat.key] || 0) > 0 && (
                <span style={{ background: activeCategory === cat.key ? cat.color : '#e0e0e0', color: activeCategory === cat.key ? 'white' : '#666', borderRadius: 99, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700 }}>
                  {counts[cat.key]}
                </span>
              )}
            </button>
          ))}
          {/* Convert Queue tab */}
          {(() => {
            const active = (queueCounts.queued || 0) + (queueCounts.processing || 0) + (queueCounts.needs_client || 0);
            return (
              <button onClick={() => setActiveCategory('convert_queue')} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                padding: '10px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                borderLeft: activeCategory === 'convert_queue' ? '3px solid #00838f' : '3px solid transparent',
                background: activeCategory === 'convert_queue' ? 'white' : 'transparent',
                color: activeCategory === 'convert_queue' ? '#00838f' : '#555',
                fontWeight: activeCategory === 'convert_queue' ? 700 : 400,
                fontSize: '0.84rem', borderBottom: '1px solid #f0f0f0'
              }}>
                <span>📝 Convert Queue</span>
                {active > 0 && (
                  <span style={{ background: activeCategory === 'convert_queue' ? '#00838f' : '#e0e0e0', color: activeCategory === 'convert_queue' ? 'white' : '#666', borderRadius: 99, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700 }}>
                    {active}
                  </span>
                )}
              </button>
            );
          })()}
        </div>

        {/* List */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', background: '#f4f6f8' }}>
          {activeCategory === 'bill' && (
            <BillsView bills={bills} pending={billsPending} scanning={billsScanning}
              onScan={handleScanBills} onReload={loadBills} onStatus={handleBillStatus} onOpen={handleOpenEmail} />
          )}
          {/* Convert Queue view */}
          {activeCategory === 'convert_queue' && (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#00695c' }}>Convert Queue</h3>
                <button onClick={loadQueue} style={{ padding: '5px 12px', background: 'white', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Refresh</button>
              </div>
              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 70, color: '#bbb' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>The queue is empty</div>
                  <div style={{ fontSize: '0.85rem' }}>Click “Convert to Estimate” on an email to add it here.</div>
                </div>
              ) : (
                queue.map(it => {
                  const S = {
                    queued: { bg: '#eceff1', bd: '#cfd8dc', label: '⏳ Queued', col: '#455a64' },
                    processing: { bg: '#e0f7fa', bd: '#80deea', label: '⚙️ Processing…', col: '#00838f' },
                    needs_client: { bg: '#fff3e0', bd: '#ffcc80', label: '⚠️ Needs client', col: '#e65100' },
                    done: { bg: '#e8f5e9', bd: '#a5d6a7', label: '✅ Done', col: '#2e7d32' },
                    error: { bg: '#ffebee', bd: '#ef9a9a', label: '⚠️ Error', col: '#c62828' },
                  }[it.status] || { bg: '#fff', bd: '#ddd', label: it.status, col: '#555' };
                  return (
                    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', marginBottom: 6, borderRadius: 8, background: S.bg, border: `1px solid ${S.bd}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.subject || '(no subject)'}</div>
                        <div style={{ fontSize: '0.74rem', color: '#777' }}>
                          {it.fromName || it.fromEmail}
                          {it.clientName ? ` · ${it.clientName}` : ''}
                          {it.status === 'error' && it.errorMessage ? ` · ${it.errorMessage}` : ''}
                          {it.status === 'done' && it.partsCreated != null ? ` · ${it.partsCreated} part(s)` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: S.col, flexShrink: 0 }}>{S.label}</span>
                      {it.status === 'needs_client' && (
                        <button onClick={() => openClientPicker({ queueItemId: it.id, fromEmail: it.fromEmail, fromName: it.fromName, subject: it.subject })}
                          style={{ background: '#ef6c00', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, flexShrink: 0 }}>Pick client</button>
                      )}
                      {it.status === 'done' && it.estimateId && (
                        <button onClick={() => navigate(`/estimates/${it.estimateId}`)}
                          style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, flexShrink: 0 }}>Open {it.estimateNumber || 'estimate'}</button>
                      )}
                      {(it.status === 'done' || it.status === 'error') && (
                        <button onClick={() => dismissQueueItem(it.id)} title="Remove from list"
                          style={{ background: 'transparent', color: '#999', border: 'none', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>✕</button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
          {/* Client Inquiry sub-tabs */}
          {activeCategory === 'client_inquiry' && (
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
              <button onClick={() => setClientSubTab('all')} style={subTabStyle(clientSubTab === 'all', '#1565c0')}>All</button>
              <button onClick={() => setClientSubTab('respond_to')} style={subTabStyle(clientSubTab === 'respond_to', '#e65100')}>
                Respond To{respondToCount > 0 ? ` (${respondToCount})` : ''}
              </button>
            </div>
          )}
          {activeCategory !== 'bill' && activeCategory !== 'convert_queue' && (loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#bbb' }}>Loading emails...</div>
          ) : displayEmails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#bbb' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{activeCategory === 'client_inquiry' && clientSubTab === 'respond_to' ? '✅' : '💬'}</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{
                showArchived ? 'No archived emails'
                : (activeCategory === 'client_inquiry' && clientSubTab === 'respond_to') ? 'All caught up — every inquiry answered'
                : 'No emails in this category'
              }</div>
              <div style={{ fontSize: '0.8rem' }}>Runs every 30 min · click Scan Now to check immediately</div>
            </div>
          ) : (
            <div style={{ background: 'white', margin: 16, borderRadius: 10, border: '1px solid #e4e4e4', overflow: 'hidden' }}>
              {displayEmails.map((email, idx) => {
                const isQuote = email._isQuote;
                const unanswered = email.commCategory === 'client_inquiry' && !isResponded(email);
                const isOpen = expandedId === email.id;
                const isFocused = focusId === email.id;
                const rowBg = isFocused ? '#fff3cd' : email.commArchived ? '#fafafa' : (isQuote && unanswered) ? '#fff8ec' : 'white';
                return (
                <div key={email.id} ref={el => { if (el) emailRowRefs.current[email.id] = el; }}
                  style={{ borderBottom: idx < displayEmails.length - 1 ? '1px solid #f2f2f2' : 'none',
                    borderLeft: isFocused ? '3px solid #ff9800' : isQuote ? '3px solid #f57c00' : '3px solid transparent',
                    background: rowBg, opacity: email.commArchived ? 0.6 : 1,
                    boxShadow: isFocused ? 'inset 0 0 0 2px rgba(255,152,0,0.25)' : 'none', transition: 'background 0.3s' }}>
                  {/* Header row — click to expand/collapse the body */}
                  <div onClick={() => setExpandedId(isOpen ? null : email.id)}
                    style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
                    <span style={{ flexShrink: 0, color: '#bbb', fontSize: '0.8rem', width: 12 }}>{isOpen ? '▾' : '▸'}</span>
                    {email.commCategory === 'client_inquiry' && (
                      <div title={isResponded(email) ? 'Responded' : 'Awaiting your reply'} style={{ flexShrink: 0, display: 'flex' }}>
                        <CheckCircle size={28} color={isResponded(email) ? '#2e7d32' : '#d4d4d4'} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.87rem', color: '#111' }}>{email.fromName || email.fromEmail}</span>
                        <span style={{ fontSize: '0.72rem', color: '#bbb' }}>{email.fromEmail}</span>
                        <CategoryBadge category={email.commCategory} />
                        {isQuote && <span style={{ background: '#fff3e0', color: '#e65100', borderRadius: 99, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700 }}>QUOTE</span>}
                        {isQuote && unanswered && <span style={{ color: '#e65100', fontWeight: 700, fontSize: '0.68rem' }}>· awaiting reply</span>}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.83rem', color: '#222', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</div>
                      {!isOpen && email.commSnippet && <div style={{ fontSize: '0.76rem', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.commSnippet}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <span style={{ fontSize: '0.72rem', color: '#ccc', minWidth: 52, textAlign: 'right' }}>{formatDate(email.receivedAt)}</span>
                      {renderConvertControl(email)}
                      {unanswered && (
                        <button onClick={() => handleMarkHandled(email.id, email.gmailThreadId)} title="Mark this inquiry as handled"
                          style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          ✓ Handled
                        </button>
                      )}
                      {email.gmailLink && (
                        <a href={email.gmailLink} onClick={(ev) => handleOpenEmail(ev, email.id, email.gmailLink)} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 10px', background: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: 5, fontSize: '0.74rem', color: '#3949ab', textDecoration: 'none', fontWeight: 600 }}>
                          <ExternalLink size={11} /> Open
                        </a>
                      )}
                      <div style={{ position: 'relative' }}>
                        <button onClick={(e) => { e.stopPropagation(); setCategoryMenuId(categoryMenuId === email.id ? null : email.id); }}
                          style={{ padding: '4px 8px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 5, cursor: 'pointer', fontSize: '0.8rem' }}>
                          🏷️
                        </button>
                        {categoryMenuId === email.id && (
                          <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.13)', zIndex: 200, minWidth: 155, overflow: 'hidden' }}>
                            {CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                              <button key={cat.key} onClick={(e) => { e.stopPropagation(); handleCategoryChange(email.id, cat.key); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: email.commCategory === cat.key ? cat.bg : 'white', cursor: 'pointer', fontSize: '0.81rem', color: cat.color, fontWeight: email.commCategory === cat.key ? 700 : 400, borderBottom: '1px solid #f5f5f5' }}>
                                {cat.icon} {cat.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleArchive(email.id)} title={email.commArchived ? 'Restore' : 'Archive'}
                        style={{ padding: '4px 8px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 5, cursor: 'pointer', fontSize: '0.8rem', color: email.commArchived ? '#2e7d32' : '#aaa' }}>
                        📦
                      </button>
                    </div>
                  </div>
                  {/* Expanded body */}
                  {isOpen && (
                    <div style={{ padding: '0 16px 14px 40px', borderTop: '1px solid #f2f2f2' }}>
                      {email.rawBody
                        ? <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.82rem', color: '#333', lineHeight: 1.5, marginTop: 10, maxHeight: '45vh', overflowY: 'auto', background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 12 }}>{email.rawBody}</div>
                        : email.commSnippet
                          ? <div style={{ marginTop: 10 }}>
                              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.82rem', color: '#333', lineHeight: 1.5, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 12 }}>{email.commSnippet}</div>
                              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 6 }}>Preview only — use “Open” for the full email. (Full text is saved on newly scanned emails.)</div>
                            </div>
                          : <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 10 }}>No preview available — use “Open” to view the full email in Gmail.</div>}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
