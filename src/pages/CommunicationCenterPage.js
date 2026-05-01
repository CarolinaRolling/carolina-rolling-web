import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Archive, ExternalLink, Tag, Mail, AlertCircle, DollarSign, Megaphone, Shield, MessageSquare, Users, Zap } from 'lucide-react';
import { getCommEmails, archiveCommEmail, updateCommEmailCategory, scanCommNow } from '../services/api';

const CATEGORIES = [
  { key: 'all',            label: 'All',            color: '#555',    bg: '#f5f5f5', icon: '✉️' },
  { key: 'client_inquiry', label: 'Client Inquiry', color: '#1565c0', bg: '#e3f2fd', icon: '👤' },
  { key: 'vendor',         label: 'Vendor',         color: '#E65100', bg: '#fff3e0', icon: '🏭' },
  { key: 'bill',           label: 'Bills',          color: '#6a1b9a', bg: '#f3e5f5', icon: '💵' },
  { key: 'general',        label: 'General',        color: '#2e7d32', bg: '#e8f5e9', icon: '💬' },
  { key: 'marketing',      label: 'Marketing',      color: '#f57c00', bg: '#fff8e1', icon: '📣' },
  { key: 'spam',           label: 'Spam',           color: '#c62828', bg: '#ffebee', icon: '🚫' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

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

export default function CommunicationCenterPage() {
  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState(null);
  const [categoryMenuId, setCategoryMenuId] = useState(null);

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
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(t); } }, [message]);

  const handleScanNow = async () => {
    setScanning(true);
    setMessage('Scanning all accounts...');
    try {
      await scanCommNow();
      setTimeout(async () => { await loadEmails(); setMessage('Scan complete'); setScanning(false); }, 8000);
    } catch { setError('Scan failed'); setScanning(false); }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #e0e0e0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>💬 Communication Center</h1>
          <p style={{ margin: '2px 0 0', color: '#888', fontSize: '0.78rem' }}>All incoming emails — scanned every 30 min · {total} total</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', color: '#666' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived
          </label>
          <button onClick={loadEmails} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'white', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleScanNow} disabled={scanning} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: scanning ? '#aaa' : '#f57c00', color: 'white', border: 'none', borderRadius: 6, cursor: scanning ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
            ⚡ {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {message && <div style={{ padding: '7px 24px', background: '#e8f5e9', borderBottom: '1px solid #a5d6a7', color: '#2e7d32', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>{message}</div>}
      {error && <div style={{ padding: '7px 24px', background: '#ffebee', borderBottom: '1px solid #ef9a9a', color: '#c62828', fontSize: '0.82rem', flexShrink: 0 }}>{error}</div>}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 190, borderRight: '1px solid #e8e8e8', background: '#fafafa', flexShrink: 0, overflowY: 'auto' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)} style={{
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
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f4f6f8' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#bbb' }}>Loading emails...</div>
          ) : emails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#bbb' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{showArchived ? 'No archived emails' : 'No emails in this category'}</div>
              <div style={{ fontSize: '0.8rem' }}>Runs every 30 min · click Scan Now to check immediately</div>
            </div>
          ) : (
            <div style={{ background: 'white', margin: 16, borderRadius: 10, border: '1px solid #e4e4e4', overflow: 'hidden' }}>
              {emails.map((email, idx) => (
                <div key={email.id} style={{ padding: '12px 16px', borderBottom: idx < emails.length - 1 ? '1px solid #f2f2f2' : 'none', display: 'flex', gap: 12, alignItems: 'center', background: email.commArchived ? '#fafafa' : 'white', opacity: email.commArchived ? 0.6 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.87rem', color: '#111' }}>{email.fromName || email.fromEmail}</span>
                      <span style={{ fontSize: '0.72rem', color: '#bbb' }}>{email.fromEmail}</span>
                      <CategoryBadge category={email.commCategory} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.83rem', color: '#222', marginBottom: 2 }}>{email.subject}</div>
                    {email.commSnippet && <div style={{ fontSize: '0.76rem', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.commSnippet}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', color: '#ccc', minWidth: 52, textAlign: 'right' }}>{formatDate(email.receivedAt)}</span>
                    {email.gmailLink && (
                      <a href={email.gmailLink} target="_blank" rel="noopener noreferrer"
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
