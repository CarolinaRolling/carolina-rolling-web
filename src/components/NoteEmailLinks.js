import React from 'react';

/**
 * Scans internal-notes text for Gmail links (dropped in when the AI captures RFQ pricing / supplier
 * quotes) and renders a clickable "Open in Gmail" button for each — no more copying URLs by hand.
 */
export default function NoteEmailLinks({ notes }) {
  if (!notes || typeof notes !== 'string') return null;



  if (links.length === 0) return null;

  return (
    <div style={{ marginTop: 10, padding: '8px 10px', background: '#ede7f6', border: '1px solid #d1c4e9', borderRadius: 6 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5e35b1', marginBottom: 6 }}>
        📧 Email link{links.length === 1 ? '' : 's'} from notes ({links.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              fontSize: '0.78rem', color: 'white', textDecoration: 'none', fontWeight: 600,
              background: '#5e35b1', padding: '5px 12px', borderRadius: 5, border: '1px solid #4527a0',
            }}
            title={l.url}>
            📧 {l.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
