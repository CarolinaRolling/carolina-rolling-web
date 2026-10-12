import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, RotateCcw, Eye, Search, X } from 'lucide-react';
import { getDeletedItems, getDeletedItem, undoDeletedItem } from '../services/api';

// Friendly names for the record types the archive holds
const KIND = {
  WorkOrder: 'Work order', WorkOrderPart: 'Part', WorkOrderPartFile: 'Part file', WorkOrderDocument: 'Document',
  ShipmentCharge: 'Shipment charge', VendorIssue: 'Vendor issue', Estimate: 'Estimate', EstimatePart: 'Estimate part',
  EstimatePartFile: 'Estimate part file', EstimateFile: 'Estimate file', Client: 'Client', Vendor: 'Vendor',
  Shipment: 'Shipment', ShipmentPhoto: 'Shipment photo', ShipmentDocument: 'Shipment document', InboundOrder: 'Inbound order',
  PONumber: 'PO number', DRNumber: 'DR number', InvoiceNumber: 'Invoice number', WorkOrderPayment: 'Payment',
  ClientPayment: 'Client payment', PaymentApplication: 'Payment application', CreditMemo: 'Credit memo',
  CreditMemoApplication: 'Credit application', Refund: 'Refund', Liability: 'Bill / liability', Employee: 'Employee',
  InspectionJob: 'Inspection job', InspectionUnit: 'Inspection unit', ShopSupply: 'Shop supply', TodoItem: 'To-do',
  PendingOrder: 'Pending order', InboundPaperwork: 'Inbound paperwork', WeldProcedure: 'Weld procedure',
};
const kind = (m) => KIND[m] || m;
const TABLE_KIND = {
  work_order_parts: 'parts', work_order_part_files: 'part files', work_order_documents: 'documents',
  work_order_messages: 'messages', estimate_parts: 'estimate parts', shipment_photos: 'photos',
  shipment_documents: 'shipment documents', work_order_payments: 'payments',
};
const fmt = (d) => d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

// Entries deleted together (one request) share a groupId and are undone together
function groupEntries(rows) {
  const groups = [];
  const byId = new Map();
  for (const r of rows) {
    const key = r.groupId || `solo:${r.id}`;
    if (!byId.has(key)) { const g = { key, entries: [] }; byId.set(key, g); groups.push(g); }
    byId.get(key).entries.push(r);
  }
  for (const g of groups) {
    const e = g.entries;
    g.when = e[0].createdAt;
    g.by = e.find(x => x.deletedBy)?.deletedBy || null;
    g.reason = e.find(x => x.reason)?.reason || null;
    g.restoredAt = e.every(x => x.restoredAt) ? e[0].restoredAt : null;
    g.restoredBy = e.find(x => x.restoredBy)?.restoredBy || null;
    g.undoable = e.some(x => x.undoable);
    g.legacy = e.every(x => !x.tableName);
    // the "headline" record: a work order / estimate / shipment if there is one
    const rank = ['WorkOrder', 'Estimate', 'Shipment', 'Client', 'Vendor', 'InboundOrder'];
    g.lead = [...e].sort((a, b) => (rank.indexOf(a.modelName) + 1 || 99) - (rank.indexOf(b.modelName) + 1 || 99))[0];
  }
  return groups;
}

function DeletedItemsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('deleted');
  const [busy, setBusy] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await getDeletedItems({ search: search.trim() || undefined, status: status === 'all' ? undefined : status, limit: 300 });
      setRows(res.data.data || []); setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load deleted items');
    } finally { setLoading(false); }
  }, [search, status]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const handleUndo = async (g) => {
    // The list may show only part of a group (search, paging) — confirm against everything that comes back
    let entries = g.entries;
    const gid = g.entries[0].groupId;
    if (gid) {
      try { const r = await getDeletedItems({ groupId: gid, limit: 500 }); if (r.data.data?.length) entries = r.data.data.filter(e => !e.restoredAt); }
      catch (_) { /* fall back to what is shown */ }
    }
    const names = entries.map(e => `${kind(e.modelName)}${e.label ? ` — ${e.label}` : ''}`);
    const list = names.slice(0, 8).join('\n') + (names.length > 8 ? `\n…and ${names.length - 8} more` : '');
    if (!window.confirm(`Undo this deletion? Everything deleted together comes back:\n\n${list}`)) return;
    try {
      setBusy(g.key); setError(null); setSuccess(null);
      const target = g.entries.find(e => e.undoable) || g.entries[0];
      const res = await undoDeletedItem(target.id);
      setSuccess(res.data.message || 'Restored');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Undo failed — nothing was changed.');
    } finally { setBusy(null); }
  };

  const openSnapshot = async (entry) => {
    try {
      const res = await getDeletedItem(entry.id);
      setViewing(res.data.data);
    } catch (err) { setError('Could not load that snapshot'); }
  };

  const groups = groupEntries(rows);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trash2 size={26} /> Deleted Items
        </h1>
      </div>
      <p style={{ color: '#666', marginTop: -8, marginBottom: 16 }}>
        Everything deleted is kept here for 90 days. <strong>Undo</strong> brings back the record and everything deleted with it
        (a work order's parts, files and messages), exactly as it was — or, if something now conflicts, tells you why and changes nothing.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#888' }} />
          <input className="form-input" style={{ paddingLeft: 32, width: '100%' }} placeholder="Search by DR #, name, who deleted, reason…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" value={status} onChange={e => setStatus(e.target.value)} style={{ flex: '0 0 auto', width: 'auto' }}>
          <option value="deleted">Still deleted</option>
          <option value="restored">Restored</option>
          <option value="all">All</option>
        </select>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>{total} record{total === 1 ? '' : 's'}</span>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : groups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#888', padding: 32 }}>Nothing here.</div>
      ) : groups.map(g => (
        <div key={g.key} className="card" style={{ marginBottom: 10, padding: '12px 16px', opacity: g.restoredAt ? 0.7 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: '1 1 300px' }}>
              <div style={{ fontWeight: 600 }}>
                {kind(g.lead.modelName)}{g.lead.label ? ` — ${g.lead.label}` : ''}
                {g.entries.length > 1 && <span style={{ color: '#666', fontWeight: 400 }}> + {g.entries.length - 1} more deleted with it</span>}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 2 }}>
                Deleted {fmt(g.when)}{g.by ? ` by ${g.by}` : ''}{g.reason ? ` · ${g.reason}` : ''}
              </div>
              {g.restoredAt && <div style={{ fontSize: '0.85rem', color: '#2e7d32', marginTop: 2 }}>Restored {fmt(g.restoredAt)}{g.restoredBy ? ` by ${g.restoredBy}` : ''}</div>}
              {g.entries.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {g.entries.map(e => (
                    <button key={e.id} className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem', padding: '2px 8px' }} onClick={() => openSnapshot(e)}>
                      {e.label || kind(e.modelName)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => openSnapshot(g.lead)}><Eye size={14} /> View</button>
              {g.undoable ? (
                <button className="btn btn-sm btn-primary" disabled={busy === g.key} onClick={() => handleUndo(g)}>
                  <RotateCcw size={14} /> {busy === g.key ? 'Restoring…' : 'Undo'}
                </button>
              ) : g.legacy ? (
                <span title="Saved before Undo existed: viewable, but must be re-entered by hand" style={{ fontSize: '0.8rem', color: '#888', alignSelf: 'center' }}>View only</span>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal" style={{ maxWidth: 820, width: '95%', maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title">{kind(viewing.modelName)}{viewing.label ? ` — ${viewing.label}` : ''}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setViewing(null)}><X size={14} /></button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 8 }}>
              Deleted {fmt(viewing.createdAt)}{viewing.deletedBy ? ` by ${viewing.deletedBy}` : ''}
            </div>
            {viewing.snapshot?.cascade && Object.keys(viewing.snapshot.cascade).length > 0 && (
              <div style={{ fontSize: '0.85rem', marginBottom: 8 }}>
                Deleted along with it: {Object.entries(viewing.snapshot.cascade).map(([t, r]) => `${r.length} ${TABLE_KIND[t] || t.replace(/_/g, ' ')}`).join(', ')}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <tbody>
                {Object.entries(viewing.snapshot?.row || viewing.snapshot || {})
                  .filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))
                  .map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '4px 8px', color: '#666', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{k}</td>
                      <td style={{ padding: '4px 8px', wordBreak: 'break-word', fontFamily: typeof v === 'object' ? 'monospace' : undefined }}>
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeletedItemsPage;
