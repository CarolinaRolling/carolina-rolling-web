import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupplierEmails, linkSupplierEmail, unlinkSupplierEmail, searchEstimatesForLink, updateCommEmailCategory } from '../services/api';

/**
 * Supplier Communications tab (Review Center).
 *
 * Lists vendor/supplier emails the scanner captured, shows any material pricing it extracted, and
 * lets a HUMAN link an email to an estimate. Linking auto-advances that estimate's progression
 * board to "Pricing Received". The AI only surfaces + extracts — the person decides the link.
 *
 * Cost application is intentionally NOT silent: the extracted pricing is shown as reference, and a
 * button takes the person to the estimate to apply/confirm it.
 */
export default function SupplierCommsTab() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('unlinked'); // 'unlinked' | 'linked' | 'all'
  const [expanded, setExpanded] = useState(null);    // email id whose body is expanded
  const [linkingFor, setLinkingFor] = useState(null); // email id being linked
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const linkedParam = filter === 'all' ? undefined : (filter === 'linked' ? 'true' : 'false');
      const res = await getSupplierEmails(linkedParam);
      setEmails(res.data?.data || []);
    } catch (e) {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Estimate search (debounced) for the link picker
  useEffect(() => {
    if (!linkingFor || search.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await searchEstimatesForLink(search.trim());
        if (!cancelled) setResults(res.data?.data || []);
      } catch { if (!cancelled) setResults([]); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, linkingFor]);

  const doLink = async (emailId, estimateId) => {
    setBusy(true);
    try {
      await linkSupplierEmail(emailId, estimateId);
      setLinkingFor(null); setSearch(''); setResults([]);
      await load();
    } catch (e) {
      alert('Failed to link: ' + (e.response?.data?.error?.message || e.message));
    } finally { setBusy(false); }
  };

  const doUnlink = async (emailId) => {
    if (!window.confirm('Unlink this email from its estimate?')) return;
    setBusy(true);
    try { await unlinkSupplierEmail(emailId); await load(); }
    catch (e) { alert('Failed to unlink: ' + (e.response?.data?.error?.message || e.message)); }
    finally { setBusy(false); }
  };

  // Remove an email from the supplier queue (e.g. the AI mis-caught it, or you went with a
  // different supplier). Recategorizes it to 'general' — the record survives, it just leaves this
  // tab. Not a hard delete.
  const doDismiss = async (emailId) => {
    if (!window.confirm('Remove this from the supplier list? (It wasn\'t a supplier quote, or you went another way.)')) return;
    setBusy(true);
    try { await updateCommEmailCategory(emailId, 'general'); await load(); }
    catch (e) { alert('Failed to remove: ' + (e.response?.data?.error?.message || e.message)); }
    finally { setBusy(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

  // Pull a human-readable pricing snippet out of the scanner's parsedData, if present.
  const pricingText = (pd) => {
    if (!pd) return null;
    if (typeof pd === 'string') return pd;
    if (pd.materialPricing) return pd.materialPricing;
    if (pd.pricing) return pd.pricing;
    if (pd.summary) return pd.summary;
    return null;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {['unlinked', 'linked', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer',
              border: filter === f ? '1px solid #1976d2' : '1px solid #ddd',
              background: filter === f ? '#e3f2fd' : 'white',
              color: filter === f ? '#1565c0' : '#666', fontWeight: filter === f ? 600 : 400,
              textTransform: 'capitalize',
            }}>{f}</button>
        ))}
        <span style={{ fontSize: '0.78rem', color: '#999', marginLeft: 4 }}>
          {loading ? 'Loading…' : `${emails.length} supplier email${emails.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {!loading && emails.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
          No supplier emails{filter === 'unlinked' ? ' waiting to be linked' : ''}.
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {emails.map(em => {
          const price = pricingText(em.parsedData);
          const isExpanded = expanded === em.id;
          const isLinking = linkingFor === em.id;
          return (
            <div key={em.id} style={{ borderTop: '1px solid #f2f2f2', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#222' }}>
                    {em.fromName || em.fromEmail || 'Unknown supplier'}
                    {em.parseConfidence && (
                      <span style={{ marginLeft: 8, fontSize: '0.68rem', padding: '1px 6px', borderRadius: 8,
                        background: em.parseConfidence === 'high' ? '#e8f5e9' : em.parseConfidence === 'low' ? '#ffebee' : '#fff8e1',
                        color: em.parseConfidence === 'high' ? '#2e7d32' : em.parseConfidence === 'low' ? '#c62828' : '#e65100' }}>
                        {em.parseConfidence} confidence
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {em.subject || '(no subject)'}
                  </div>
                  {em.fromEmail && em.fromName && (
                    <div style={{ fontSize: '0.72rem', color: '#999' }}>{em.fromEmail}</div>
                  )}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>{fmtDate(em.receivedAt)}</span>
              </div>

              {/* Extracted material pricing (reference) */}
              {price && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: '#f1f8e9', border: '1px solid #dcedc8', borderRadius: 6, fontSize: '0.8rem', color: '#33691e', whiteSpace: 'pre-wrap' }}>
                  <strong style={{ fontSize: '0.72rem', color: '#558b2f' }}>Extracted pricing (verify before applying):</strong>
                  <div style={{ marginTop: 2 }}>{price}</div>
                </div>
              )}

              {/* Linked state */}
              {em.estimateId ? (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: '#2e7d32', fontWeight: 600 }}>
                    ✓ Linked to {em.linkedEstimate?.estimateNumber || 'estimate'}
                    {em.linkedEstimate?.clientName ? ` — ${em.linkedEstimate.clientName}` : ''}
                  </span>
                  <button onClick={() => navigate(`/estimates/${em.estimateId}`)}
                    style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: '1px solid #1976d2', background: '#e3f2fd', color: '#1565c0', cursor: 'pointer' }}>
                    Open estimate to apply cost →
                  </button>
                  <button onClick={() => doUnlink(em.id)} disabled={busy}
                    style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: '1px solid #ddd', background: 'white', color: '#888', cursor: 'pointer' }}>
                    Unlink
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {!isLinking ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setLinkingFor(em.id); setSearch(''); setResults([]); }}
                        style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 5, border: '1px solid #1976d2', background: '#1976d2', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                        🔗 Link to estimate
                      </button>
                      {em.rawBody && (
                        <button onClick={() => setExpanded(isExpanded ? null : em.id)}
                          style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 5, border: '1px solid #ddd', background: 'white', color: '#666', cursor: 'pointer' }}>
                          {isExpanded ? 'Hide email' : 'Read email'}
                        </button>
                      )}
                      {em.gmailLink && (
                        <a href={em.gmailLink} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 5, border: '1px solid #ddd', background: 'white', color: '#666', textDecoration: 'none' }}>
                          Open in Gmail
                        </a>
                      )}
                      <button onClick={() => doDismiss(em.id)} disabled={busy}
                        title="Not a supplier quote, or you went with a different supplier — remove from this list"
                        style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 5, border: '1px solid #ddd', background: 'white', color: '#c62828', cursor: 'pointer', marginLeft: 'auto' }}>
                        ✕ Not a supplier quote
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: 10, background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }}>
                      <div style={{ fontSize: '0.78rem', color: '#555', marginBottom: 6 }}>
                        Search for the estimate this pricing belongs to:
                      </div>
                      <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Estimate # or client name…"
                        style={{ width: '100%', maxWidth: 340, padding: '6px 10px', borderRadius: 5, border: '1px solid #ccc', fontSize: '0.82rem' }} />
                      <div style={{ marginTop: 6 }}>
                        {results.map(r => (
                          <div key={r.id} onClick={() => doLink(em.id, r.id)}
                            style={{ padding: '6px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', gap: 10 }}
                            onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ fontWeight: 600, color: '#1565c0' }}>{r.estimateNumber}</span>
                            <span style={{ color: '#777', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.clientName}</span>
                            <span style={{ color: '#aaa', fontSize: '0.72rem' }}>{r.status}</span>
                          </div>
                        ))}
                        {search.trim().length >= 2 && results.length === 0 && (
                          <div style={{ padding: '6px 10px', color: '#999', fontSize: '0.78rem' }}>No matching estimates.</div>
                        )}
                      </div>
                      <button onClick={() => { setLinkingFor(null); setSearch(''); setResults([]); }}
                        style={{ marginTop: 6, fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: '1px solid #ddd', background: 'white', color: '#888', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  )}
                  {isExpanded && em.rawBody && (
                    <div style={{ marginTop: 8, padding: 10, background: '#fafafa', border: '1px solid #eee', borderRadius: 6, fontSize: '0.78rem', color: '#444', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
                      {em.rawBody}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
