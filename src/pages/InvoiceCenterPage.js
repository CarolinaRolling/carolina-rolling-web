import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoiceQueue, getInvoiceHistory, recordInvoice, uploadInvoicePdf, clearInvoice, exportWorkOrderIIF, emailInvoice } from '../services/api';

const InvoiceCenterPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  // Invoice recording modal
  const [invoiceModal, setInvoiceModal] = useState(null); // WO object or null
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0] });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // PDF upload modal (for history items)
  const [pdfUploadWO, setPdfUploadWO] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);

  // Email invoice modal
  const [emailModal, setEmailModal] = useState(null);
  const [emailAddress, setEmailAddress] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      if (activeTab === 'queue') {
        const res = await getInvoiceQueue();
        setQueue(res.data.data || []);
      } else {
        const res = await getInvoiceHistory();
        setHistory(res.data.data || []);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportIIF = async (wo) => {
    try {
      const response = await exportWorkOrderIIF(wo.id);
      const iifContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const blob = new Blob([iifContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber}-${(wo.clientName || '').replace(/[^a-zA-Z0-9]/g, '_')}.iif`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setSuccess(`IIF exported for ${wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to export IIF');
    }
  };

  const handleRecordInvoice = async () => {
    if (!invoiceForm.invoiceNumber.trim()) { setError('Invoice number is required'); return; }
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('invoiceNumber', invoiceForm.invoiceNumber.trim());
      formData.append('invoiceDate', invoiceForm.invoiceDate);
      if (invoiceFile) formData.append('invoicePdf', invoiceFile);
      
      await recordInvoice(invoiceModal.id, formData);
      setSuccess(`Invoice ${invoiceForm.invoiceNumber} recorded for ${invoiceModal.drNumber ? 'DR-' + invoiceModal.drNumber : invoiceModal.orderNumber}`);
      setInvoiceModal(null);
      setInvoiceFile(null);
      setInvoiceForm({ invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to record invoice');
    } finally { setSaving(false); }
  };

  const handleUploadPdf = async () => {
    if (!pdfFile) { setError('Select a PDF file'); return; }
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('invoicePdf', pdfFile);
      await uploadInvoicePdf(pdfUploadWO.id, formData);
      setSuccess('Invoice PDF uploaded');
      setPdfUploadWO(null);
      setPdfFile(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to upload PDF');
    } finally { setSaving(false); }
  };

  const handleClearInvoice = async (wo) => {
    if (!window.confirm(`Remove invoice ${wo.invoiceNumber} from ${wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber}? This moves it back to the queue.`)) return;
    try {
      await clearInvoice(wo.id);
      setSuccess('Invoice cleared');
      loadData();
    } catch (err) { setError('Failed to clear invoice'); }
  };

  const handleEmailInvoice = async (wo, overrideEmail) => {
    try {
      setSaving(true);
      const res = await emailInvoice(wo.id, overrideEmail || null);
      setSuccess(res.data.message || 'Invoice emailed');
      setEmailModal(null);
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to email invoice';
      if (msg.includes('No email')) {
        // No AP email on file — open email modal to enter one
        setEmailModal(wo);
        setEmailAddress('');
        setError('');
      } else {
        setError(msg);
      }
    } finally { setSaving(false); }
  };

  const formatCurrency = (v) => '$' + (parseFloat(v) || 0).toFixed(2);

  const getWOTotal = (wo) => {
    const partsTotal = (wo.parts || []).reduce((sum, p) => sum + (parseFloat(p.partTotal) || 0), 0);
    const trucking = parseFloat(wo.truckingCost) || 0;
    return partsTotal + trucking;
  };

  const filteredQueue = search 
    ? queue.filter(wo => 
        (wo.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (wo.drNumber && String(wo.drNumber).includes(search)) ||
        (wo.orderNumber || '').toLowerCase().includes(search.toLowerCase())
      )
    : queue;

  const filteredHistory = search
    ? history.filter(wo =>
        (wo.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (wo.drNumber && String(wo.drNumber).includes(search)) ||
        (wo.invoiceNumber || '').toLowerCase().includes(search.toLowerCase())
      )
    : history;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">📄 Invoice Center</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" className="form-input" placeholder="Search by client, DR#, invoice#..." style={{ width: 280 }}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success} <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
          📋 Awaiting Invoice {queue.length > 0 && <span style={{ marginLeft: 6, background: '#E65100', color: 'white', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem' }}>{queue.length}</span>}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          ✅ Invoiced
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : activeTab === 'queue' ? (
        <div>
          {filteredQueue.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>All caught up!</div>
              <div>No work orders waiting to be invoiced.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredQueue.map(wo => {
                const total = getWOTotal(wo);
                const drLabel = wo.drNumber ? `DR-${wo.drNumber}` : wo.orderNumber;
                const isCOD = wo.paymentTerms?.toUpperCase().includes('COD') || false;
                return (
                  <div key={wo.id} className="card" style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 200 }}>
                        <div>
                          <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 700, fontSize: '1.1rem', color: '#1565C0', cursor: 'pointer' }}
                            onClick={() => navigate(`/workorders/${wo.id}`)}>
                            {drLabel}
                          </span>
                          <div style={{ fontSize: '0.85rem', color: '#555' }}>
                            {wo.clientName}
                            {isCOD && <span style={{ marginLeft: 8, background: '#c62828', color: 'white', padding: '1px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>COD</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: 100 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#333' }}>{formatCurrency(total)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{(wo.parts || []).length} part{(wo.parts || []).length !== 1 ? 's' : ''}</div>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#888', minWidth: 80, textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                          background: wo.status === 'shipped' ? '#E8EAF6' : wo.status === 'stored' ? '#E8F5E9' : '#FFF3E0',
                          color: wo.status === 'shipped' ? '#283593' : wo.status === 'stored' ? '#2E7D32' : '#E65100'
                        }}>
                          {wo.status === 'stored' ? 'Stored' : wo.status === 'shipped' ? 'Shipped' : 'Completed'}
                        </span>
                        {wo.completedAt && <div style={{ marginTop: 2, fontSize: '0.7rem' }}>{new Date(wo.completedAt).toLocaleDateString()}</div>}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: '#2E7D32', color: '#2E7D32' }}
                          onClick={() => handleExportIIF(wo)} title="Export QuickBooks IIF">
                          📗 IIF
                        </button>
                        <button className="btn" style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#1565C0', color: 'white', border: 'none', fontWeight: 600 }}
                          onClick={() => { setInvoiceModal(wo); setInvoiceForm({ invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0] }); setInvoiceFile(null); }}>
                          📄 Record Invoice
                        </button>
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
          {filteredHistory.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>📄</div>
              <div>No invoices recorded yet.</div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>DR#</th>
                  <th>Client</th>
                  <th>Invoice #</th>
                  <th>Invoice Date</th>
                  <th>Amount</th>
                  <th>Invoiced By</th>
                  <th>PDF</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(wo => {
                  const total = getWOTotal(wo);
                  const drLabel = wo.drNumber ? `DR-${wo.drNumber}` : wo.orderNumber;
                  return (
                    <tr key={wo.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1565C0', cursor: 'pointer' }}
                          onClick={() => navigate(`/workorders/${wo.id}`)}>
                          {drLabel}
                        </span>
                      </td>
                      <td>{wo.clientName}</td>
                      <td style={{ fontWeight: 600 }}>{wo.invoiceNumber}</td>
                      <td style={{ fontSize: '0.85rem' }}>{wo.invoiceDate ? new Date(wo.invoiceDate).toLocaleDateString() : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(total)}</td>
                      <td style={{ fontSize: '0.85rem', color: '#666' }}>{wo.invoicedBy || '—'}</td>
                      <td>
                        {wo.invoicePdfUrl ? (
                          <a href={wo.invoicePdfUrl} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#1565C0', fontWeight: 600, fontSize: '0.85rem' }}>
                            📎 View PDF
                          </a>
                        ) : (
                          <button className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                            onClick={() => { setPdfUploadWO(wo); setPdfFile(null); }}>
                            Upload PDF
                          </button>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#c62828', borderColor: '#c62828' }}
                          onClick={() => handleClearInvoice(wo)}>
                          Clear
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Record Invoice Modal */}
      {invoiceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setInvoiceModal(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 0, maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#1565C0', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>📄 Record Invoice</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>
                {invoiceModal.drNumber ? 'DR-' + invoiceModal.drNumber : invoiceModal.orderNumber} — {invoiceModal.clientName}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>{formatCurrency(getWOTotal(invoiceModal))}</div>
            </div>

            <div style={{ padding: 24 }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Invoice Number *</label>
                <input type="text" className="form-input" placeholder="e.g. INV-1234" autoFocus
                  value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleRecordInvoice(); }} />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Invoice Date</label>
                <input type="date" className="form-input" value={invoiceForm.invoiceDate}
                  onChange={e => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Invoice PDF <span style={{ fontWeight: 400, color: '#888' }}>(optional — can upload later)</span></label>
                <input type="file" accept=".pdf" className="form-input" style={{ padding: '8px' }}
                  onChange={e => setInvoiceFile(e.target.files[0] || null)} />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" onClick={handleRecordInvoice} disabled={saving || !invoiceForm.invoiceNumber.trim()}
                  style={{ flex: 1, background: invoiceForm.invoiceNumber.trim() ? '#1565C0' : '#ccc', color: 'white', border: 'none', padding: '14px', fontWeight: 700, borderRadius: 8, fontSize: '1rem' }}>
                  {saving ? 'Saving...' : '✅ Record Invoice'}
                </button>
                <button onClick={() => setInvoiceModal(null)}
                  style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Upload Modal */}
      {pdfUploadWO && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPdfUploadWO(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>📎 Upload Invoice PDF</h3>
            <p style={{ color: '#666', marginBottom: 12, fontSize: '0.9rem' }}>
              Invoice {pdfUploadWO.invoiceNumber} — {pdfUploadWO.drNumber ? 'DR-' + pdfUploadWO.drNumber : pdfUploadWO.orderNumber}
            </p>
            <input type="file" accept=".pdf" className="form-input" style={{ padding: 8, marginBottom: 16 }}
              onChange={e => setPdfFile(e.target.files[0] || null)} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleUploadPdf} disabled={saving || !pdfFile} style={{ flex: 1 }}>
                {saving ? 'Uploading...' : '📤 Upload'}
              </button>
              <button className="btn btn-outline" onClick={() => setPdfUploadWO(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCenterPage;
