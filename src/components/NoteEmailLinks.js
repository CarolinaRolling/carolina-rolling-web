import React from 'react';

/**
 * Scans internal-notes text for Gmail links (dropped in when the AI captures RFQ pricing / supplier
 * quotes) and renders a clickable "Open in Gmail" button for each — no more copying URLs by hand.
 * Each button is labeled from the NEAREST note header above its link, so two different vendors get
 * two different names.
 */
export default function NoteEmailLinks({ notes }) {
  if (!notes || typeof notes !== 'string') return null;

  const urlRegex = /https:\/\/mail\.google\.com\/mail\/[^\s]+/g;
  const links = [];
  let m;
  while ((m = urlRegex.exec(notes)) !== null) {
    const url = m[0].replace(/[)\].,]+$/, '');
    const before = notes.slice(0, m.index);
    let label = 'Open email in Gmail';

    // Find the NEAREST header line above THIS link (scan upward, closest first).
    const linesAbove = before.split('\n');
    for (let i = linesAbove.length - 1; i >= 0; i--) {
      const line = linesAbove[i];
      const sup = line.match(/\*\*\*Supplier quote:\s*([^(*]+?)\s*\(/i);
      if (sup) { label = `Open ${sup[1].trim()}'s quote email`; break; }
      if (/\*\*\*Pricing you quoted/i.test(line)) { label = 'Open the pricing email you sent'; break; }
    }

    if (!links.some((l) => l.url === url)) links.push({ url, label });
  }

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
