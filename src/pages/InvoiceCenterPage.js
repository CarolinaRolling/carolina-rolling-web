import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoiceQueue, getInvoiceHistory, recordInvoice, uploadInvoicePdf, clearInvoice, exportWorkOrderIIF, assignInvoiceNumber, exportBatchIIF, getNextInvoiceNumber } from '../services/api';

const InvoiceCenterPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0] });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pdfUploadWO, setPdfUploadWO] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchPreview, setBatchPreview] = useState([]);
  const [nextInvNum, setNextInvNum] = useState(null);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      if (activeTab === 'queue') {
        const [qRes, numRes] = await Promise.all([getInvoiceQueue(), getNextInvoiceNumber()]);
        setQueue(qRes.data.data || []);
        setNextInvNum(numRes.data.data?.nextNumber || 1001);
      } else {
        const res = await getInvoiceHistory();
        setHistory(res.data.data || []);
      }
    } catch (err) { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    setSelected(selected.size === filteredQueue.length ? new Set() : new Set(filteredQueue.map(wo => wo.id)));
  };

  const handleExportIIF = async (wo) => {
    try {
      if (!wo.invoiceNumber) {
        const r = await assignInvoiceNumber(wo.id);
        wo.invoiceNumber = r.data.data.invoiceNumber;
      }
      const response = await exportWorkOrderIIF(wo.id);
      const iifContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const blob = new Blob([iifContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `invoice-${wo.invoiceNumber}-${(wo.clientName || '').replace(/[^a-zA-Z0-9]/g, '_')}.iif`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
      setSuccess(`IIF exported — Invoice #${wo.invoiceNumber}`);
      loadData();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to export IIF'); }
  };

  const handleBatchConfirm = () => {
    const selectedWOs = filteredQueue.filter(wo => selected.has(wo.id));
    if (selectedWOs.length === 0) return;
    let num = nextInvNum;
    const preview = selectedWOs.map(wo => ({
      id: wo.id, drNumber: wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber,
      clientName: wo.clientName, total: getWOTotal(wo),
      invoiceNumber: wo.invoiceNumber || num++
    }));
    setBatchPreview(preview);
    setBatchConfirmOpen(true);
  };

  const handleBatchExport = async () => {
    try {
      setSaving(true);
      for (const item of batchPreview) {
        const orig = queue.find(q => q.id === item.id);
        if (!orig?.invoiceNumber) await assignInvoiceNumber(item.id);
      }
      const response = await exportBatchIIF(batchPreview.map(p => p.id));
      const iifContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const blob = new Blob([iifContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `quickbooks-batch-${new Date().toISOString().split('T')[0]}.iif`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
      setSuccess(`Batch exported — ${batchPreview.length} invoices`);
      setBatchConfirmOpen(false); setSelected(new Set()); loadData();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to export batch'); }
    finally { setSaving(false); }
  };

  const handleRecordInvoice = async () => {
    if (!invoiceForm.invoiceNumber.trim()) { setError('Invoice number is required'); return; }
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append('invoiceNumber', invoiceForm.invoiceNumber.trim());
      fd.append('invoiceDate', invoiceForm.invoiceDate);
      if (invoiceFile) fd.append('invoicePdf', invoiceFile);
      await recordInvoice(invoiceModal.id, fd);
      setSuccess('Invoice recorded'); setInvoiceModal(null); setInvoiceFile(null); loadData();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to record invoice'); }
    finally { setSaving(false); }
  };

  const handleUploadPdf = async () => {
    if (!pdfFile) return;
    try {
      setSaving(true);
      const fd = new FormData(); fd.append('invoicePdf', pdfFile);
      await uploadInvoicePdf(pdfUploadWO.id, fd);
      setSuccess('PDF uploaded'); setPdfUploadWO(null); setPdfFile(null); loadData();
    } catch (err) { setError('Failed to upload PDF'); }
    finally { setSaving(false); }
  };

  const handleClearInvoice = async (wo) => {
    if (!window.confirm(`Remove invoice ${wo.invoiceNumber} from ${wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber}?`)) return;
    try { await clearInvoice(wo.id); setSuccess('Invoice cleared'); loadData(); } catch (err) { setError('Failed to clear'); }
  };

  const formatCurrency = (v) => '$' + (parseFloat(v) || 0).toFixed(2);
  const getWOTotal = (wo) => (wo.parts || []).reduce((s, p) => s + (parseFloat(p.partTotal) || 0), 0) + (parseFloat(wo.truckingCost) || 0);

  const filteredQueue = search ? queue.filter(wo => (wo.clientName || '').toLowerCase().includes(search.toLowerCase()) || (wo.drNumber && String(wo.drNumber).includes(search)) || (wo.orderNumber || '').toLowerCase().includes(search.toLowerCase())) : queue;
  const filteredHistory = search ? history.filter(wo => (wo.clientName || '').toLowerCase().includes(search.toLowerCase()) || (wo.drNumber && String(wo.drNumber).includes(search)) || (wo.invoiceNumber || '').toLowerCase().includes(search.toLowerCase())) : history;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Invoice Center</h1>
        <input type="text" className="form-input" placeholder="Search by client, DR#, invoice#..." style={{ width: 280 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>x</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success} <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>x</button></div>}

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => { setActiveTab('queue'); setSelected(new Set()); }}>
          Awaiting Invoice {queue.length > 0 && <span style={{ marginLeft: 6, background: '#E65100', color: 'white', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem' }}>{queue.length}</span>}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Invoiced</button>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : activeTab === 'queue' ? (
        <div>
          {selected.size > 0 && (
            <div style={{ background: '#E3F2FD', border: '2px solid #1565C0', borderRadius: 8, padding: '12px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: '#1565C0' }}>{selected.size} selected</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={handleBatchConfirm} style={{ background: '#2E7D32', color: 'white', border: 'none', fontWeight: 700, padding: '10px 20px', fontSize: '0.95rem' }}>Batch IIF Export ({selected.size})</button>
                <button className="btn btn-outline" onClick={() => setSelected(new Set())} style={{ padding: '10px 16px' }}>Clear</button>
              </div>
            </div>
          )}
          {filteredQueue.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}><div style={{ fontSize: '3rem', marginBottom: 8 }}>All caught up!</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px' }}>
                <input type="checkbox" checked={selected.size === filteredQueue.length && filteredQueue.length > 0} onChange={toggleSelectAll} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>Select All ({filteredQueue.length})</span>
              </div>
              {filteredQueue.map(wo => {
                const total = getWOTotal(wo);
                const drLabel = wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber;
                const isCOD = (wo.paymentTerms || '').replace(/\./g, '').toUpperCase().includes('COD');
                const isSelected = selected.has(wo.id);
                return (
                  <div key={wo.id} className="card" style={{ padding: '14px 20px', borderLeft: isSelected ? '4px solid #1565C0' : '4px solid transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(wo.id)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }} />
                        <div>
                          <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 700, fontSize: '1.1rem', color: '#1565C0', cursor: 'pointer' }} onClick={() => navigate('/workorders/' + wo.id)}>{drLabel}</span>
                          <div style={{ fontSize: '0.85rem', color: '#555' }}>{wo.clientName}{isCOD && <span style={{ marginLeft: 8, background: '#c62828', color: 'white', padding: '1px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>COD</span>}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 100 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCurrency(total)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{(wo.parts || []).length} part{(wo.parts || []).length !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontSize: '0.8rem', minWidth: 80, textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: wo.status === 'shipped' ? '#E8EAF6' : wo.status === 'stored' ? '#E8F5E9' : '#FFF3E0', color: wo.status === 'shipped' ? '#283593' : wo.status === 'stored' ? '#2E7D32' : '#E65100' }}>{wo.status === 'stored' ? 'Stored' : wo.status === 'shipped' ? 'Shipped' : 'Completed'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: '#2E7D32', color: '#2E7D32' }} onClick={() => handleExportIIF(wo)}>IIF</button>
                        <button className="btn" style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#1565C0', color: 'white', border: 'none', fontWeight: 600 }} onClick={() => { setInvoiceModal(wo); setInvoiceForm({ invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0] }); setInvoiceFile(null); }}>Record</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          {filteredHistory.length === 0 ? <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>No invoices yet.</div> : (
            <table className="table">
              <thead><tr><th>DR#</th><th>Client</th><th>Invoice #</th><th>Date</th><th>Amount</th><th>By</th><th>PDF</th><th></th></tr></thead>
              <tbody>
                {filteredHistory.map(wo => (
                  <tr key={wo.id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1565C0', cursor: 'pointer' }} onClick={() => navigate('/workorders/' + wo.id)}>{wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber}</span></td>
                    <td>{wo.clientName}</td><td style={{ fontWeight: 600 }}>{wo.invoiceNumber}</td>
                    <td style={{ fontSize: '0.85rem' }}>{wo.invoiceDate ? new Date(wo.invoiceDate).toLocaleDateString() : '-'}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(getWOTotal(wo))}</td>
                    <td style={{ fontSize: '0.85rem', color: '#666' }}>{wo.invoicedBy || '-'}</td>
                    <td>{wo.invoicePdfUrl ? <a href={wo.invoicePdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1565C0', fontWeight: 600, fontSize: '0.85rem' }}>View</a> : <button className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={() => { setPdfUploadWO(wo); setPdfFile(null); }}>Upload</button>}</td>
                    <td><button className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#c62828', borderColor: '#c62828' }} onClick={() => handleClearInvoice(wo)}>Clear</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {batchConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setBatchConfirmOpen(false)}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 560, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#2E7D32', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Batch IIF Export - Confirm</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>{batchPreview.length} invoice{batchPreview.length !== 1 ? 's' : ''} will be exported</div>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#f5f5f5', fontSize: '0.8rem', color: '#666' }}><th style={{ padding: '10px 16px', textAlign: 'left' }}>Invoice #</th><th style={{ padding: '10px 16px', textAlign: 'left' }}>Work Order</th><th style={{ padding: '10px 16px', textAlign: 'left' }}>Client</th><th style={{ padding: '10px 16px', textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  {batchPreview.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#2E7D32' }}>#{item.invoiceNumber}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#1565C0' }}>{item.drNumber}</td>
                      <td style={{ padding: '10px 16px' }}>{item.clientName}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background: '#f5f5f5', fontWeight: 700 }}><td colSpan={3} style={{ padding: '10px 16px' }}>Total</td><td style={{ padding: '10px 16px', textAlign: 'right' }}>{formatCurrency(batchPreview.reduce((s, i) => s + i.total, 0))}</td></tr></tfoot>
              </table>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #eee', display: 'flex', gap: 12 }}>
              <button className="btn" onClick={handleBatchExport} disabled={saving} style={{ flex: 1, background: '#2E7D32', color: 'white', border: 'none', padding: '14px', fontWeight: 700, borderRadius: 8, fontSize: '1rem' }}>{saving ? 'Exporting...' : 'Export ' + batchPreview.length + ' Invoices to IIF'}</button>
              <button onClick={() => setBatchConfirmOpen(false)} style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {invoiceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setInvoiceModal(null)}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#1565C0', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Record Invoice</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>{invoiceModal.drNumber ? 'DR-' + invoiceModal.drNumber : invoiceModal.orderNumber} - {invoiceModal.clientName}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>{formatCurrency(getWOTotal(invoiceModal))}</div>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label" style={{ fontWeight: 600 }}>Invoice Number *</label><input type="text" className="form-input" placeholder="e.g. 1005" autoFocus value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') handleRecordInvoice(); }} /></div>
              <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label" style={{ fontWeight: 600 }}>Invoice Date</label><input type="date" className="form-input" value={invoiceForm.invoiceDate} onChange={e => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })} /></div>
              <div className="form-group" style={{ marginBottom: 20 }}><label className="form-label" style={{ fontWeight: 600 }}>Invoice PDF <span style={{ fontWeight: 400, color: '#888' }}>(optional)</span></label><input type="file" accept=".pdf" className="form-input" style={{ padding: 8 }} onChange={e => setInvoiceFile(e.target.files[0] || null)} /></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" onClick={handleRecordInvoice} disabled={saving || !invoiceForm.invoiceNumber.trim()} style={{ flex: 1, background: invoiceForm.invoiceNumber.trim() ? '#1565C0' : '#ccc', color: 'white', border: 'none', padding: '14px', fontWeight: 700, borderRadius: 8 }}>{saving ? 'Saving...' : 'Record Invoice'}</button>
                <button onClick={() => setInvoiceModal(null)} style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pdfUploadWO && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPdfUploadWO(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Upload Invoice PDF</h3>
            <p style={{ color: '#666', marginBottom: 12, fontSize: '0.9rem' }}>Invoice {pdfUploadWO.invoiceNumber} - {pdfUploadWO.drNumber ? 'DR-' + pdfUploadWO.drNumber : pdfUploadWO.orderNumber}</p>
            <input type="file" accept=".pdf" className="form-input" style={{ padding: 8, marginBottom: 16 }} onChange={e => setPdfFile(e.target.files[0] || null)} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleUploadPdf} disabled={saving || !pdfFile} style={{ flex: 1 }}>{saving ? 'Uploading...' : 'Upload'}</button>
              <button className="btn btn-outline" onClick={() => setPdfUploadWO(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCenterPage;
