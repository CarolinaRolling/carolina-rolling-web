import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoiceNumbers, voidInvoiceNumber, getNextInvoiceNumber, setNextInvoiceNumber, createManualInvoiceNumber, importInvoiceNumbers } from '../services/api';

const InvoiceNumbersPage = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [invoiceNumbers, setInvoiceNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showVoid, setShowVoid] = useState(false);
  const [nextNum, setNextNum] = useState('');
  const [nextNumInput, setNextNumInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ invoiceNumber: '', clientName: '' });

  // QB Import state
  const [importPairs, setImportPairs] = useState(null);  // parsed rows ready for preview
  const [importResults, setImportResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, nextRes] = await Promise.all([getInvoiceNumbers(), getNextInvoiceNumber()]);
      setInvoiceNumbers(invRes.data.data || []);
      const n = nextRes.data.data?.nextNumber || 1001;
      setNextNum(String(n));
      setNextNumInput(String(n));
    } catch (err) {
      setError('Failed to load data');
    } finally { setLoading(false); }
  };

  const handleSetNextNumber = async () => {
    const num = parseInt(nextNumInput);
    if (!num || num < 1) { setError('Enter a valid number'); return; }
    try {
      setSaving(true);
      await setNextInvoiceNumber(num);
      setNextNum(String(num));
      setSuccess(`Next invoice number set to ${num}`);
    } catch (err) {
      setError('Failed to update');
    } finally { setSaving(false); }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    try {
      setSaving(true);
      await voidInvoiceNumber(voidTarget.id, voidReason);
      setSuccess(`Invoice #${voidTarget.invoiceNumber} voided`);
      setVoidTarget(null);
      setVoidReason('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to void');
    } finally { setSaving(false); }
  };

  const handleManualCreate = async () => {
    const num = parseInt(manualForm.invoiceNumber);
    if (!num || num < 1) { setError('Enter a valid invoice number'); return; }
    try {
      setSaving(true);
      await createManualInvoiceNumber({ invoiceNumber: num, clientName: manualForm.clientName || null });
      setSuccess(`Invoice #${num} created`);
      setManualOpen(false);
      setManualForm({ invoiceNumber: '', clientName: '' });
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create invoice number');
    } finally { setSaving(false); }
  };

  // Parse a QuickBooks CSV or IIF export and extract DR→invoice pairs
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    setImportPairs(null);
    setImportResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const pairs = [];

        if (file.name.toLowerCase().endsWith('.iif')) {
          // IIF format: tab-delimited, TRNS rows have DOCNUM at col 7 and OTHER1 at col 13
          // Header: TRNS TRNSID TRNSTYPE DATE ACCNT NAME AMOUNT DOCNUM MEMO CLEAR TOPRINT TERMS PONUM OTHER1
          const lines = text.split(/
?
/);
          for (const line of lines) {
            if (!line.startsWith('TRNS	')) continue;
            const cols = line.split('	');
            // IIF TRNS: [0]TRNS [1]TRNSID [2]TRNSTYPE [3]DATE [4]ACCNT [5]NAME [6]AMOUNT [7]DOCNUM [8]MEMO [9]CLEAR [10]TOPRINT [11]TERMS [12]PONUM [13]OTHER1
            const docNum = (cols[7] || '').trim();   // invoice number
            const other1 = (cols[13] || '').trim();  // DR number
            const qbName = (cols[5] || '').trim();   // QB customer name
            const terms = (cols[11] || '').trim();  // Payment terms
            const invNum = parseInt(docNum);
            const drNum = parseInt(other1);
            if (invNum && drNum) pairs.push({ invoiceNumber: String(invNum), drNumber: String(drNum) });
            if (invNum && drNum) pairs.push({ invoiceNumber: String(invNum), drNumber: String(drNum), qbName: qbName || null, terms: terms || null });
        } else {
          // CSV format from QB Invoice List report
          // Try to auto-detect columns: look for headers containing "Num"/"Invoice" and "Other 1"/"DR"
          const lines = text.split(/
?
/).filter(l => l.trim());
          if (lines.length < 2) throw new Error('File appears empty');
          // Parse header row — handle quoted CSV
          const parseRow = (row) => {
            const cols = []; let cur = ''; let inQ = false;
            for (let i = 0; i < row.length; i++) {
              const c = row[i];
              if (c === '"') { inQ = !inQ; }
              else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
              else { cur += c; }
            }
            cols.push(cur.trim());
            return cols;
          };
          const headers = parseRow(lines[0]).map(h => h.replace(/"/g, '').toLowerCase().trim());
          // Find invoice number column — QB uses "Num" or "Invoice No." or "Number"
          const invCol = headers.findIndex(h => h === 'num' || h === 'number' || h.includes('invoice no') || h.includes('invoice #'));
          // Find DR number column — QB stores it in "Other 1" or "Delivery Receipt"
          const drCol = headers.findIndex(h => h.includes('other 1') || h.includes('other1') || h.includes('delivery receipt') || h.includes('dr number') || h === 'dr#');
          // Find QB customer name column
          const nameCol = headers.findIndex(h => h === 'name' || h === 'customer' || h === 'client' || h.includes('customer name'));
          const termsCol = headers.findIndex(h => h === 'terms' || h.includes('payment terms') || h.includes('term'));
          if (invCol === -1) throw new Error('Could not find invoice number column. Expected a column named "Num", "Number", or "Invoice No."');
          if (drCol === -1) throw new Error('Could not find DR number column. Expected a column named "Other 1" or "Delivery Receipt". Make sure you exported the Other 1 field from QuickBooks.');
          for (let i = 1; i < lines.length; i++) {
            const cols = parseRow(lines[i]);
            const invNum = parseInt((cols[invCol] || '').replace(/[^0-9]/g, ''));
            const drNum = parseInt((cols[drCol] || '').replace(/[^0-9]/g, ''));
            const qbName = nameCol >= 0 ? (cols[nameCol] || '').replace(/"/g, '').trim() : null;
            if (invNum && drNum) pairs.push({ invoiceNumber: String(invNum), drNumber: String(drNum), qbName: qbName || null, terms: terms || null });
          }
        }

        if (pairs.length === 0) {
          setImportError('No valid DR→invoice pairs found in the file. Make sure the file contains invoice transactions with DR numbers in the "Other 1" field.');
          return;
        }
        setImportPairs(pairs);
      } catch (err) {
        setImportError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importPairs || importPairs.length === 0) return;
    try {
      setImporting(true);
      setImportError('');
      const res = await importInvoiceNumbers(importPairs);
      setImportResults(res.data.data);
      setImportPairs(null);
      setSuccess(res.data.message);
      loadData();
    } catch (err) {
      setImportError(err.response?.data?.error?.message || 'Import failed');
    } finally { setImporting(false); }
  };

  const filtered = search
    ? invoiceNumbers.filter(inv =>
        String(inv.invoiceNumber).includes(search) ||
        (inv.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.workOrder?.drNumber && String(inv.workOrder.drNumber).includes(search))
      )
    : invoiceNumbers;

  const activeCount = invoiceNumbers.filter(i => i.status === 'active').length;
  const voidCount = invoiceNumbers.filter(i => i.status === 'void').length;

  return (
    <div>
      {!embedded && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">📄 Invoice Numbers</h1>
        <input type="text" className="form-input" placeholder="Search by invoice#, client, DR#..." style={{ width: 280 }}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      )}
      {embedded && <h3 style={{ marginBottom: 12 }}>📄 Invoice Numbers</h3>}

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success} <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      {/* Next Number Config */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Invoice Number Sequence</h3>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: '4px 0 0' }}>
              {activeCount} active, {voidCount} voided — Next: <strong>#{nextNum}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: '#555', fontSize: '0.9rem' }}>Next #:</span>
            <input type="number" className="form-input" style={{ width: 110 }}
              value={nextNumInput} onChange={e => setNextNumInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSetNextNumber(); }} />
            <button className="btn btn-primary" disabled={saving || nextNumInput === nextNum} onClick={handleSetNextNumber}>
              {saving ? '...' : 'Set'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowVoid(!showVoid)}
              style={{ color: showVoid ? '#c62828' : '#666', borderColor: showVoid ? '#c62828' : '#ccc' }}>
              {showVoid ? 'Hide Voided' : 'Show Voided'}
            </button>
            <button className="btn" onClick={() => { setManualOpen(true); setManualForm({ invoiceNumber: nextNum, clientName: '' }); }}
              style={{ background: '#1565C0', color: 'white', border: 'none', fontWeight: 600 }}>
              + Manual Entry
            </button>
          </div>
        </div>
      </div>

      {/* QuickBooks Invoice Import */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>📥 Import Invoice Numbers from QuickBooks</h3>
          <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>
            Upload a QuickBooks invoice export to bulk-assign invoice numbers to matching work orders by DR number.
          </p>
        </div>

        {importError && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            {importError} <button onClick={() => setImportError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* How to export instructions */}
        {!importPairs && !importResults && (
          <div style={{ background: '#f3f8ff', border: '1px solid #bbdefb', borderRadius: 8, padding: 14, marginBottom: 14, fontSize: '0.85rem' }}>
            <strong>How to export from QuickBooks:</strong>
            <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
              <li>In QuickBooks, go to <strong>Reports → Sales → Invoice List</strong></li>
              <li>Customize the report to include the <strong>"Other 1"</strong> column (this holds the DR number)</li>
              <li>Set the date range to cover all your orders</li>
              <li>Click <strong>Excel → Create New Worksheet</strong> and save as CSV</li>
              <li>Upload the CSV file below — or upload a <strong>.IIF file</strong> exported directly from QuickBooks</li>
            </ol>
          </div>
        )}

        {/* File upload */}
        {!importPairs && !importResults && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: '#1565C0', color: 'white', padding: '8px 18px', borderRadius: 6,
            fontWeight: 600, fontSize: '0.9rem' }}>
            📂 Choose QB Export File (.csv or .iif)
            <input type="file" accept=".csv,.iif,.txt" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
        )}

        {/* Preview parsed pairs */}
        {importPairs && (
          <div>
            <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <strong style={{ color: '#2e7d32' }}>✓ Found {importPairs.length} invoice/DR pair{importPairs.length !== 1 ? 's' : ''} ready to import</strong>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, marginBottom: 14 }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>DR Number</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Invoice Number</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>QB Customer Name</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Terms</th>
                  </tr>
                </thead>
                <tbody>
                  {importPairs.map((p, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '6px 12px' }}>DR-{p.drNumber}</td>
                      <td style={{ padding: '6px 12px' }}>#{p.invoiceNumber}</td>
                      <td style={{ padding: '6px 12px', color: p.qbName ? '#333' : '#bbb' }}>
                        {p.qbName || '—'}
                      </td>
                      <td style={{ padding: '6px 12px', color: p.terms ? '#333' : '#bbb' }}>
                        {p.terms || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" disabled={importing} onClick={handleConfirmImport}
                style={{ background: '#2e7d32' }}>
                {importing ? '⏳ Importing...' : `✓ Confirm Import (${importPairs.length} pairs)`}
              </button>
              <button className="btn btn-secondary" onClick={() => setImportPairs(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Results summary */}
        {importResults && (
          <div style={{ fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={{ background: '#e8f5e9', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2e7d32' }}>{importResults.matched.length}</div>
                <div style={{ color: '#555' }}>Successfully imported</div>
              </div>
              <div style={{ background: importResults.alreadySet.length > 0 ? '#fff8e1' : '#f5f5f5', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f57c00' }}>{importResults.alreadySet.length}</div>
                <div style={{ color: '#555' }}>Already had invoice #</div>
              </div>
              <div style={{ background: importResults.notFound.length > 0 ? '#ffebee' : '#f5f5f5', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c62828' }}>{importResults.notFound.length}</div>
                <div style={{ color: '#555' }}>DR# not found</div>
              </div>
            </div>
            {importResults.matched.some(r => r.qbNameSet || r.termsSet) && (
              <div style={{ background: '#e8f5e9', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                <strong style={{ color: '#2e7d32' }}>✓ Client records updated:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem' }}>
                  {importResults.matched.filter(r => r.qbNameSet).map((r, i) => (
                    <li key={i}>QB name set for <strong>{r.clientName}</strong>: "{r.qbNameSet}"</li>
                  ))}
                  {importResults.matched.filter(r => r.termsSet).map((r, i) => (
                    <li key={i}>Terms set for <strong>{r.clientName}</strong>: "{r.termsSet}"</li>
                  ))}
                </ul>
              </div>
            )}
            {importResults.notFound.length > 0 && (
              <div style={{ background: '#ffebee', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                <strong style={{ color: '#c62828' }}>DR numbers not found:</strong>{' '}
                {importResults.notFound.map(r => `DR-${r.drNumber}`).join(', ')}
              </div>
            )}
            <button className="btn btn-outline" onClick={() => setImportResults(null)}>Import Another File</button>
          </div>
        )}
      </div>

      {/* Invoice Number Table */}
      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>📄</div>
          <div>No invoice numbers assigned yet. Export an IIF from the Invoice Center to auto-assign.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Work Order</th>
                <th>Status</th>
                <th>Assigned</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.filter(inv => showVoid || inv.status === 'active').map(inv => (
                <tr key={inv.id} style={inv.status === 'void' ? { opacity: 0.5, background: '#fafafa' } : {}}>
                  <td>
                    <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 700, fontSize: '1.05rem', color: inv.status === 'void' ? '#999' : '#1565C0' }}>
                      #{inv.invoiceNumber}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{inv.clientName || '—'}</td>
                  <td>
                    {inv.workOrder ? (
                      <span style={{ fontFamily: 'monospace', color: '#1565C0', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => navigate(`/workorders/${inv.workOrderId}`)}>
                        {inv.workOrder.drNumber ? `DR-${inv.workOrder.drNumber}` : inv.workOrder.orderNumber}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                      background: inv.status === 'active' ? '#E8F5E9' : '#FFEBEE',
                      color: inv.status === 'active' ? '#2E7D32' : '#C62828'
                    }}>
                      {inv.status === 'active' ? 'Active' : 'Voided'}
                    </span>
                    {inv.status === 'void' && inv.voidReason && (
                      <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>{inv.voidReason}</div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#666' }}>
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    {inv.status === 'active' && (
                      <button className="btn btn-sm btn-outline" 
                        style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#c62828', borderColor: '#c62828' }}
                        onClick={() => { setVoidTarget(inv); setVoidReason(''); }}>
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setVoidTarget(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, color: '#c62828' }}>Void Invoice #{voidTarget.invoiceNumber}?</h3>
            <p style={{ color: '#666', marginBottom: 12, fontSize: '0.9rem' }}>
              This will void invoice #{voidTarget.invoiceNumber} for {voidTarget.clientName || 'Unknown'} 
              and clear the invoice from the linked work order.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Reason (optional)</label>
              <input type="text" className="form-input" placeholder="e.g. Duplicate, wrong amount" 
                value={voidReason} onChange={e => setVoidReason(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleVoid(); }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" onClick={handleVoid} disabled={saving}
                style={{ flex: 1, background: '#c62828', color: 'white', border: 'none', fontWeight: 700, borderRadius: 8, padding: '12px' }}>
                {saving ? 'Voiding...' : 'Void Invoice'}
              </button>
              <button className="btn btn-outline" onClick={() => setVoidTarget(null)} style={{ padding: '12px 20px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {manualOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setManualOpen(false)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 0, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#1565C0', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Manual Invoice Number Entry</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>Create an invoice number record manually</div>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Invoice Number *</label>
                <input type="number" className="form-input" placeholder="e.g. 1015" autoFocus
                  value={manualForm.invoiceNumber} onChange={e => setManualForm({ ...manualForm, invoiceNumber: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualCreate(); }} />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Client Name <span style={{ fontWeight: 400, color: '#888' }}>(optional)</span></label>
                <input type="text" className="form-input" placeholder="e.g. Nowell Steel and Supply"
                  value={manualForm.clientName} onChange={e => setManualForm({ ...manualForm, clientName: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" onClick={handleManualCreate} disabled={saving || !manualForm.invoiceNumber}
                  style={{ flex: 1, background: manualForm.invoiceNumber ? '#1565C0' : '#ccc', color: 'white', border: 'none', padding: '14px', fontWeight: 700, borderRadius: 8 }}>
                  {saving ? 'Creating...' : 'Create Invoice #' + (manualForm.invoiceNumber || '...')}
                </button>
                <button onClick={() => setManualOpen(false)}
                  style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceNumbersPage;
