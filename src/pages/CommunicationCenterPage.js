import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Archive, ExternalLink, Tag, Mail, AlertCircle, DollarSign, Megaphone, Shield, MessageSquare, Users } from 'lucide-react';
import { getCommEmails, archiveCommEmail, updateCommEmailCategory } from '../services/api';

const CATEGORIES = [
  { key: 'all',            label: 'All',             color: '#555',    bg: '#f5f5f5',    icon: <Mail size={14} /> },
  { key: 'client_inquiry', label: 'Client Inquiry',  color: '#1565c0', bg: '#e3f2fd',    icon: <Users size={14} /> },
  { key: 'vendor',         label: 'Vendor',          color: '#E65100', bg: '#fff3e0',    icon: <Tag size={14} /> },
  { key: 'bill',           label: 'Bills',           color: '#6a1b9a', bg: '#f3e5f5',    icon: <DollarSign size={14} /> },
  { key: 'general',        label: 'General',         color: '#2e7d32', bg: '#e8f5e9',    icon: <MessageSquare size={14} /> },
  { key: 'marketing',      label: 'Marketing',       color: '#f57c00', bg: '#fff8e1',    icon: <Megaphone size={14} /> },
  { key: 'spam',           label: 'Spam',            color: '#c62828', bg: '#ffebee',    icon: <Shield size={14} /> },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

function CategoryBadge({ category }) {
  const cat = CAT_MAP[category] || CAT_MAP['general'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: cat.bg, color: cat.color, whiteSpace: 'nowrap' }}>
      {cat.icon} {cat.label}
    </span>
  );
}

function formatDate(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const now = new Date();
  const diff = now - d;
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 7 * 24 * 60 * 60 * 1000) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function CommunicationCenterPage() {
  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState(null);
  const [categoryMenuId, setCategoryMenuId] = useState(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = { category: activeCategory, archived: showArchived, limit: 100 };
      const res = await getCommEmails(params);
      setEmails(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      setError('Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, showArchived]);

  useEffect(() => { loadEmails(); }, [loadEmails]);

  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); }
  }, [message]);

  const handleArchive = async (id) => {
    try {
      await archiveCommEmail(id);
      setEmails(prev => prev.filter(e => e.id !== id));
      setMessage(showArchived ? 'Restored' : 'Archived');
    } catch { setError('Failed'); }
  };

  const handleCategoryChange = async (id, category) => {
    try {
      await updateCommEmailCategory(id, category);
      setEmails(prev => prev.map(e => e.id === id ? { ...e, commCategory: category } : e));
      setCategoryMenuId(null);
      setMessage('Category updated');
    } catch { setError('Failed to update category'); }
  };

  const counts = {};
  emails.forEach(e => { counts[e.commCategory] = (counts[e.commCategory] || 0) + 1; });
  counts['all'] = emails.length;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>💬 Communication Center</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.85rem' }}>
            All incoming emails — scanned every 30 minutes across all connected accounts
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', color: '#666' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <button onClick={loadEmails} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {message && <div style={{ padding: '10px 16px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, marginBottom: 16, color: '#2e7d32', fontWeight: 600 }}>{message}</div>}
      {error && <div style={{ padding: '10px 16px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, marginBottom: 16, color: '#c62828' }}><AlertCircle size={14} style={{ marginRight: 6 }} />{error}</div>}

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Category sidebar */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => setActiveCategory(cat.key)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: activeCategory === cat.key ? cat.bg : 'white',
                borderLeft: activeCategory === cat.key ? '3px solid ' + cat.color : '3px solid transparent',
                color: activeCategory === cat.key ? cat.color : '#444',
                fontWeight: activeCategory === cat.key ? 700 : 400,
                fontSize: '0.85rem', gap: 8,
                borderBottom: '1px solid #f0f0f0'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{cat.icon} {cat.label}</span>
                {counts[cat.key] > 0 && (
                  <span style={{ background: activeCategory === cat.key ? cat.color : '#ddd', color: activeCategory === cat.key ? 'white' : '#666', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                    {counts[cat.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Email list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>Loading emails...</div>
          ) : emails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999', background: 'white', borderRadius: 10, border: '1px solid #e0e0e0' }}>
              <MessageSquare size={40} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600 }}>{showArchived ? 'No archived emails' : 'No emails in this category'}</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>The scanner runs every 30 minutes</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'white', borderRadius: 10, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              {emails.map((email, idx) => (
                <div key={email.id} style={{
                  padding: '14px 16px', borderBottom: idx < emails.length - 1 ? '1px solid #f0f0f0' : 'none',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: email.commArchived ? '#fafafa' : 'white',
                  opacity: email.commArchived ? 0.7 : 1
                }}>
                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a1a' }}>{email.fromName || email.fromEmail}</span>
                      <span style={{ fontSize: '0.75rem', color: '#999' }}>{email.fromEmail}</span>
                      <CategoryBadge category={email.commCategory} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#333', marginBottom: 4 }}>{email.subject}</div>
                    {email.commSnippet && (
                      <div style={{ fontSize: '0.78rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.commSnippet}
                      </div>
                    )}
                  </div>

                  {/* Right side controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>{formatDate(email.receivedAt)}</span>

                    {/* Open in Gmail */}
                    {email.gmailLink && (
                      <a href={email.gmailLink} target="_blank" rel="noopener noreferrer" title="Open in Gmail"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 5, fontSize: '0.75rem', color: '#1976d2', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <ExternalLink size={12} /> Gmail
                      </a>
                    )}

                    {/* Category picker */}
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setCategoryMenuId(categoryMenuId === email.id ? null : email.id)}
                        title="Change category"
                        style={{ padding: '4px 8px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 5, cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}>
                        <Tag size={12} />
                      </button>
                      {categoryMenuId === email.id && (
                        <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 150, overflow: 'hidden' }}>
                          {CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                            <button key={cat.key} onClick={() => handleCategoryChange(email.id, cat.key)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: email.commCategory === cat.key ? cat.bg : 'white', cursor: 'pointer', fontSize: '0.82rem', color: cat.color, fontWeight: email.commCategory === cat.key ? 700 : 400 }}>
                              {cat.icon} {cat.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Archive/Restore */}
                    <button onClick={() => handleArchive(email.id)} title={email.commArchived ? 'Restore' : 'Archive'}
                      style={{ padding: '4px 8px', background: email.commArchived ? '#e8f5e9' : '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 5, cursor: 'pointer', color: email.commArchived ? '#2e7d32' : '#888' }}>
                      <Archive size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total > 0 && (
            <div style={{ textAlign: 'center', padding: '10px', fontSize: '0.8rem', color: '#999' }}>
              Showing {emails.length} of {total} emails
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
