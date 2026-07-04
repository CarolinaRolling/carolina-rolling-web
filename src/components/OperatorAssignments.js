import React, { useState, useEffect, useCallback } from 'react';
import { getOperators, getAssignments, assignWorkOrder, reorderAssignments, unassignWorkOrder, getAssignableWorkOrders, getOperatorTasks, addOperatorTask, updateOperatorTask, deleteOperatorTask } from '../services/api';

// All-operators board: every operator's queue shown side by side with its job count, so you can
// see the workload at a glance and move jobs between operators to balance. Reorder within a queue
// with the arrows; reassign with the per-job operator dropdown; add jobs via search.
const arrowBtn = { background: 'none', border: '1px solid #ddd', borderRadius: 5, width: 26, height: 24, cursor: 'pointer', fontSize: '0.7rem', lineHeight: 1 };

export default function OperatorAssignments() {
  const [operators, setOperators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(() => { try { return JSON.parse(localStorage.getItem('operatorQueueOrder')) || []; } catch { return []; } });
  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState({});

  const load = useCallback(async () => {
    try {
      const [ops, asg, tks] = await Promise.all([getOperators(), getAssignments(), getOperatorTasks()]);
      setOperators(ops.data.data || []);
      setAssignments(asg.data.data || []);
      setTasks(tks.data.data || []);
    } catch { setOperators([]); setAssignments([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { try { const asg = await getAssignments(); setAssignments(asg.data.data || []); } catch {} };
  const refreshTasks = async () => { try { const r = await getOperatorTasks(); setTasks(r.data.data || []); } catch {} };
  const tasksFor = (name) => tasks.filter(t => t.operator === name);
  const addTask = async (op) => {
    const text = (taskInput[op] || '').trim();
    if (!text) return;
    setBusy(true);
    try { await addOperatorTask(op, text); setTaskInput(ti => ({ ...ti, [op]: '' })); await refreshTasks(); } catch {} finally { setBusy(false); }
  };
  const toggleTask = async (t) => { setBusy(true); try { await updateOperatorTask(t.id, { done: !t.done }); await refreshTasks(); } catch {} finally { setBusy(false); } };
  const removeTask = async (id) => { setBusy(true); try { await deleteOperatorTask(id); await refreshTasks(); } catch {} finally { setBusy(false); } };

  const names = operators.map(o => o.operatorName || o.name || String(o)).filter(Boolean);
  // Apply the saved column order; operators not yet ordered fall to the end alphabetically
  const orderedNames = [...names].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const moveOperator = (name, dir) => {
    const cur = [...orderedNames];
    const i = cur.indexOf(name), j = i + dir;
    if (j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    setOrder(cur);
    try { localStorage.setItem('operatorQueueOrder', JSON.stringify(cur)); } catch {}
  };
  const queueFor = (name) => assignments.filter(a => a.assignedOperator === name).sort((a, b) => (a.assignedSequence ?? 0) - (b.assignedSequence ?? 0));

  const doSearch = async () => {
    setSearching(true);
    try { const res = await getAssignableWorkOrders(query.trim()); setResults(res.data.data || []); }
    catch { setResults([]); } finally { setSearching(false); }
  };
  const assign = async (woId, op) => {
    if (!op) return;
    setBusy(true);
    try { await assignWorkOrder(woId, op); await refresh(); setResults(rs => rs.filter(r => r.id !== woId)); }
    catch {} finally { setBusy(false); }
  };
  const reassign = async (woId, newOp) => {
    setBusy(true);
    try { if (newOp) await assignWorkOrder(woId, newOp); else await unassignWorkOrder(woId); await refresh(); }
    catch {} finally { setBusy(false); }
  };
  const move = async (name, idx, dir) => {
    const ids = queueFor(name).map(q => q.id); const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setBusy(true);
    try { await reorderAssignments(name, ids); await refresh(); } catch {} finally { setBusy(false); }
  };

  const totalAssigned = names.reduce((s, n) => s + queueFor(n).length, 0);

  return (
    <div>
      {/* Search + assign */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, maxWidth: 520 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
            placeholder="Search a DR #, client, or PO to assign…" style={{ flex: 1, border: '1px solid #ccc', borderRadius: 6, padding: '8px 12px' }} />
          <button onClick={doSearch} disabled={searching} style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>{searching ? '…' : 'Search'}</button>
        </div>
        {results.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #f2f2f2', maxWidth: 520 }}>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600 }}>DR-{r.dr}</span> <span style={{ color: '#666' }}>{r.clientName}</span>
              {r.assignedOperator && <span style={{ color: '#e65100', fontSize: '0.78rem' }}> · on {r.assignedOperator}</span>}
            </div>
            <select defaultValue="" onChange={e => { if (e.target.value) assign(r.id, e.target.value); }} disabled={busy}
              style={{ padding: '5px 6px', borderRadius: 6, border: '1px solid #2e7d32', color: '#2e7d32', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
              <option value="">Assign to…</option>
              {orderedNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: 8 }}>
        {names.length} operator{names.length === 1 ? '' : 's'} · {totalAssigned} job{totalAssigned === 1 ? '' : 's'} assigned
      </div>

      {/* All operators side by side */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingBottom: 8, alignItems: 'flex-start' }}>
        {names.length === 0 ? (
          <div style={{ color: '#999' }}>No operators found.</div>
        ) : orderedNames.map((name, opIdx) => {
          const q = queueFor(name);
          const others = orderedNames.filter(n => n !== name);
          // Light workload coloring: green (light), amber (moderate), red (heavy)
          const headBg = q.length === 0 ? '#f5f5f5' : q.length <= 3 ? '#e8f5e9' : q.length <= 6 ? '#fff8e1' : '#ffebee';
          const headColor = q.length === 0 ? '#999' : q.length <= 3 ? '#2e7d32' : q.length <= 6 ? '#e65100' : '#c62828';
          return (
            <div key={name} style={{ minWidth: 260, maxWidth: 300, flex: '0 0 auto', border: '1px solid #e0e0e0', borderRadius: 8, background: 'white' }}>
              <div style={{ padding: '8px 12px', background: headBg, borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <button onClick={() => moveOperator(name, -1)} disabled={opIdx === 0} title="Move left"
                  style={{ background: 'none', border: 'none', cursor: opIdx === 0 ? 'default' : 'pointer', color: headColor, opacity: opIdx === 0 ? 0.3 : 1, fontSize: '0.9rem', padding: 0 }}>◀</button>
                <span style={{ fontWeight: 700, color: headColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</span>
                <span style={{ background: headColor, color: 'white', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700, padding: '1px 8px', flexShrink: 0 }}>{q.length}</span>
                <button onClick={() => moveOperator(name, 1)} disabled={opIdx === orderedNames.length - 1} title="Move right"
                  style={{ background: 'none', border: 'none', cursor: opIdx === orderedNames.length - 1 ? 'default' : 'pointer', color: headColor, opacity: opIdx === orderedNames.length - 1 ? 0.3 : 1, fontSize: '0.9rem', padding: 0 }}>▶</button>
              </div>
              <div style={{ padding: 8 }}>
                {q.length === 0 ? (
                  <div style={{ color: '#bbb', fontSize: '0.82rem', textAlign: 'center', padding: '10px 0' }}>No jobs</div>
                ) : q.map((job, idx) => (
                  <div key={job.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: '6px 8px', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#999', fontSize: '0.72rem', width: 16 }}>{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>DR-{job.dr}</span> <span style={{ color: '#666' }}>{job.clientName}</span>
                      </div>
                      <button onClick={() => move(name, idx, -1)} disabled={busy || idx === 0} style={arrowBtn} title="Up">▲</button>
                      <button onClick={() => move(name, idx, 1)} disabled={busy || idx === q.length - 1} style={arrowBtn} title="Down">▼</button>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <select defaultValue="" onChange={e => { const v = e.target.value; e.target.value = ''; if (v) reassign(job.id, v); }} disabled={busy}
                        style={{ flex: 1, padding: '3px 4px', borderRadius: 5, border: '1px solid #ccc', fontSize: '0.72rem', cursor: 'pointer' }}>
                        <option value="">Move to…</option>
                        {others.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button onClick={() => reassign(job.id, '')} disabled={busy} style={{ ...arrowBtn, width: 24, color: '#c62828' }} title="Unassign">✕</button>
                    </div>
                  </div>
                ))}
                {/* Tasks for this operator */}
                <div style={{ borderTop: '1px dashed #e0e0e0', marginTop: 6, paddingTop: 6 }}>
                  {tasksFor(name).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', padding: '2px 0' }}>
                      <input type="checkbox" checked={!!t.done} onChange={() => toggleTask(t)} disabled={busy} />
                      <span style={{ flex: 1, minWidth: 0, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#aaa' : '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</span>
                      <button onClick={() => removeTask(t.id)} disabled={busy} title="Delete task" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: '0.75rem', flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <input value={taskInput[name] || ''} onChange={e => setTaskInput(ti => ({ ...ti, [name]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addTask(name); }}
                      placeholder="+ Add task…" style={{ flex: 1, minWidth: 0, border: '1px solid #ddd', borderRadius: 5, padding: '4px 6px', fontSize: '0.78rem' }} />
                    <button onClick={() => addTask(name)} disabled={busy || !(taskInput[name] || '').trim()}
                      style={{ background: '#455a64', color: 'white', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}>Add</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
