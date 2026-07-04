import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import { getWorkOrderMessages, sendWorkOrderMessage } from '../services/api';

// Text-message style thread between the office (this side) and the shop-floor operator.
// Office messages align right (blue); operator messages align left (gray).
export default function WorkOrderMessages({ workOrderId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [imageData, setImageData] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);
  const endRef = useRef(null);
  const containerRef = useRef(null);

  const load = useCallback(async (scroll) => {
    try {
      const res = await getWorkOrderMessages(workOrderId);
      const next = res.data.data || [];
      const c = containerRef.current;
      const nearBottom = c ? (c.scrollHeight - c.scrollTop - c.clientHeight < 120) : true;
      setMessages(prev => {
        const grew = next.length > prev.length;
        if (scroll || (grew && nearBottom)) setTimeout(() => { const el = containerRef.current; if (el) el.scrollTop = el.scrollHeight; }, 60);
        return next;
      });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [workOrderId]);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 15000);
    return () => clearInterval(t);
  }, [load]);

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Paste a screenshot / copied image straight into the message
  const onPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => setImageData(reader.result);
          reader.readAsDataURL(file);
          e.preventDefault();
        }
        break;
      }
    }
  };

  const send = async () => {
    if ((!text.trim() && !imageData) || sending) return;
    setSending(true);
    try {
      await sendWorkOrderMessage(workOrderId, { body: text.trim() || null, image: imageData || null });
      setText(''); setImageData(null);
      await load(true);
    } catch { /* keep input on failure */ }
    finally { setSending(false); }
  };

  const fmtTime = (d) => {
    const dt = new Date(d);
    return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 460, border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: '#f7f8fa' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 30 }}>Loading messages…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 40, fontSize: '0.9rem' }}>
            No messages yet. Send the shop floor a question or note about this order.
          </div>
        ) : messages.map(m => {
          const mine = m.senderType === 'office';
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <div style={{ fontSize: '0.72rem', color: '#888', margin: '0 6px 2px' }}>
                {m.senderName} · {m.senderType === 'office' ? 'Office' : 'Operator'} · {fmtTime(m.createdAt)}
              </div>
              <div style={{ maxWidth: '78%', background: mine ? '#1976d2' : '#fff', color: mine ? '#fff' : '#222', border: mine ? 'none' : '1px solid #e0e0e0', borderRadius: 14, borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4, padding: m.imageUrl && !m.body ? 4 : '8px 12px' }}>
                {m.imageUrl && (
                  <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" title="Open / download full image">
                    <img src={m.imageUrl} alt="attachment" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, display: 'block', cursor: 'zoom-in' }} />
                  </a>
                )}
                {m.body && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: m.imageUrl ? 6 : 0, padding: m.imageUrl ? '0 6px 4px' : 0 }}>{m.body}</div>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {imageData && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa' }}>
          <img src={imageData} alt="to send" style={{ height: 44, borderRadius: 6 }} />
          <span style={{ fontSize: '0.8rem', color: '#666', flex: 1 }}>Photo attached</span>
          <button onClick={() => setImageData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={16} /></button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderTop: '1px solid #e0e0e0', background: '#fff' }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} title="Attach a photo"
          style={{ background: 'none', border: '1px solid #ccc', borderRadius: 8, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#555', flexShrink: 0 }}>
          <ImageIcon size={18} />
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          onPaste={onPaste}
          placeholder="Message the shop floor… (paste a screenshot too)"
          style={{ flex: 1, border: '1px solid #ccc', borderRadius: 20, padding: '9px 14px', fontSize: '0.9rem', outline: 'none' }}
        />
        <button onClick={send} disabled={sending || (!text.trim() && !imageData)}
          style={{ background: (sending || (!text.trim() && !imageData)) ? '#bbd' : '#1976d2', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
