import React, { useState, useEffect } from 'react';
import { getEstimateSupplierEmails } from '../services/api';

/**
 * Shows supplier/vendor emails linked to an estimate, as a reference in the material section of the
 * estimate and work-order pages. Supports multiple suppliers on one estimate (each linked email is
 * listed). Read-only reference — linking/unlinking is done from the Supplier Communications tab.
 *
 * Props:
 *   estimateId — the estimate whose linked supplier emails to show. For a work order, pass the
 *                estimate it was converted from (the emails stay linked to the estimate).
 */
export default function LinkedSupplierEmails({ estimateId }) {
  const [emails, setEmails] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!estimateId) { setLoaded(true); return; }
    let cancelled = false;
    getEstimateSupplierEmails(estimateId)
      .then(res => { if (!cancelled) setEmails(res.data?.data || []); })
      .catch(() => { if (!cancelled) setEmails([]); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [estimateId]);

  if (!loaded || emails.length === 0) return null; // nothing to show

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <div style={{ marginTop: 10, padding: '8px 10px', background: '#e0f7fa', border: '1px solid #b2ebf2', borderRadius: 6 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#00838f', marginBottom: 4 }}>
        📧 Supplier {emails.length === 1 ? 'email' : 'emails'} ({emails.length})
      </div>
      {emails.map(em => (
        <div key={em.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', padding: '2px 0' }}>
          <span style={{ color: '#00695c', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {em.fromName || em.fromEmail || 'Supplier'}
          </span>
          <span style={{ color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {em.subject || '(no subject)'}
          </span>
          <span style={{ color: '#999', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{fmtDate(em.receivedAt)}</span>
          {em.gmailLink && (
            <a href={em.gmailLink} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '0.72rem', color: '#00838f', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Open ↗
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
