import React, { useState, useEffect, useCallback } from 'react';
import { getOperators, getAssignments, assignWorkOrder, reorderAssignments, unassignWorkOrder, getAssignableWorkOrders } from '../services/api';

// Self-contained panel: pick an operator, reorder their queue (up/down), search a DR/client
// and assign it, or unassign. Reuses the same operations endpoints as the Operations page.
const arrowBtn = { background: 'none', border: '1px solid #ddd', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: '0.8rem' };

export default function OperatorAssignments() {
  const [operators, setOperators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ops, asg] = await Promise.all([getOperators(), getAssignments()]);
      setOperators(ops.data.data || []);
      setAssignments(asg.data.data || []);
    } catch { setOperators([]); setAssignments([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { try { const asg = await getAssignments(); setAssignments(asg.data.data || []); } catch {} };

  const countFor = (name) => assignments.filter(a => a.assignedOperator === name).length;
  const queue = selected
    ? assignments.filter(a => a.assignedOperator === selected).sort((a, b) => (a.assignedSequence ?? 0) - (b.assignedSequence ?? 0))
    : [];

  const doSearch = async () => {
    setSearching(true);
    try { const res = await getAssignableWorkOrders(query.trim()); setResults(res.data.data || []); }
    catch { setResults([]); } finally { setSearching(false); }
  };
  const assign = async (woId) => {
    if (!selected) return;
    setBusy(true);
    try { await assignWorkOrder(woId, selected); await refresh(); setResults(rs => rs.filter(r => r.id !== woId)); }
    catch {} finally { setBusy(false); }
  };
  const unassign = async (woId) => { setBusy(true); try { await unassignWorkOrder(woId); await refresh(); } catch {} finally { setBusy(false); } };
  const move = async (idx, dir) => {
    const ids = queue.map(q => q.id); const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setBusy(true);
    try { await reorderAssignments(selected, ids); await refresh(); } catch {} finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Operator list */}
      <div style={{ width: 210, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#555' }}>Operators</div>
        {operators.length === 0 ? (
          <div style={{ color: '#999', fontSize: '0.85rem' }}>No operators found.</div>
        ) : operators.map(op => {
          const name = op.operatorName || op.name || String(op);
          const active = selected === name;
          return (
            <button key={name} onClick={() => setSelected(name)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 8, marginBottom: 3, background: active ? '#e8f1fc' : '#f7f8fa', color: active ? '#1565c0' : '#333', fontWeight: active ? 700 : 500 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
                {op.deviceName && <span style={{ display: 'block', fontSize: '0.68rem', color: '#aaa', fontWeight: 400 }}>{op.deviceName}</span>}
              </span>
              <span style={{ background: countFor(name) ? '#1565c0' : '#ddd', color: 'white', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', flexShrink: 0 }}>{countFor(name)}</span>
            </button>
          );
        })}
      </div>

      {/* Selected operator's queue + assign */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selected ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <div style={{ fontWeight: 600 }}>Pick an operator to see their queue</div>
            <div style={{ fontSize: '0.82rem' }}>Then drag order with the arrows, or search a job below and assign it.</div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{selected}'s queue <span style={{ color: '#999', fontWeight: 500 }}>· {queue.length} job{queue.length === 1 ? '' : 's'}</span></div>
            {queue.length === 0 ? (
              <div style={{ color: '#999', marginBottom: 16 }}>No jobs assigned yet.</div>
            ) : queue.map((q, idx) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #eee', borderRadius: 8, marginBottom: 6 }}>
                <span style={{ color: '#999', width: 22, textAlign: 'center', fontWeight: 600 }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 600 }}>DR-{q.dr}</span> <span style={{ color: '#666' }}>{q.clientName}</span>
                </div>
                <button onClick={() => move(idx, -1)} disabled={busy || idx === 0} style={arrowBtn} title="Move up">▲</button>
                <button onClick={() => move(idx, 1)} disabled={busy || idx === queue.length - 1} style={arrowBtn} title="Move down">▼</button>
                <button onClick={() => unassign(q.id)} disabled={busy} style={{ ...arrowBtn, color: '#c62828', width: 30 }} title="Remove from queue">✕</button>
              </div>
            ))}

            <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.9rem' }}>Add a job to {selected}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
                  placeholder="Search DR # or client…" style={{ flex: 1, border: '1px solid #ccc', borderRadius: 6, padding: '8px 12px' }} />
                <button onClick={doSearch} disabled={searching} style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>{searching ? '…' : 'Search'}</button>
              </div>
              {results.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #f2f2f2' }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>DR-{r.dr}</span> <span style={{ color: '#666' }}>{r.clientName}</span>
                    {r.assignedOperator && r.assignedOperator !== selected && <span style={{ color: '#e65100', fontSize: '0.78rem' }}> · on {r.assignedOperator}</span>}
                  </div>
                  {r.assignedOperator === selected ? (
                    <span style={{ color: '#2e7d32', fontSize: '0.8rem', fontWeight: 600 }}>✓ Assigned</span>
                  ) : (
                    <button onClick={() => assign(r.id)} disabled={busy} style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.82rem' }}>Assign</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
