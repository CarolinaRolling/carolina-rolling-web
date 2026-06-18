import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Activity, Clock, Users, ClipboardList, ArrowUp, ArrowDown, X, Search, Plus, ExternalLink, Edit2, Trash2, Square, CheckSquare } from 'lucide-react';
import {
  getProductionWeek, getOperators, getAssignments, getAssignableWorkOrders,
  assignWorkOrder, reorderAssignments, unassignWorkOrder, updatePartCompletedBy,
  getOperatorTasks, addOperatorTask, updateOperatorTask, deleteOperatorTask, reorderOperatorTasks,
} from '../services/api';
import { formatDate } from '../utils/dates';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow)); // Monday
  return x;
}
function dayIndex(dateStr, weekStart) {
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - weekStart.getTime()) / 86400000);
}

export default function OperationsPage() {
  const [tab, setTab] = useState('assignments');
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Activity size={26} color="#1565c0" />
        <h1 className="page-title" style={{ margin: 0 }}>Operations</h1>
      </div>

      {/* Toggle */}
      <div style={{ display: 'inline-flex', background: '#f0f2f5', borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {[['assignments', 'Task Distribution', <ClipboardList size={15} />], ['production', 'Production', <Activity size={15} />]].map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
              padding: '7px 16px', borderRadius: 7, fontSize: '0.86rem', fontWeight: 700,
              background: tab === id ? 'white' : 'transparent', color: tab === id ? '#1565c0' : '#888',
              boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'production' ? <ProductionView /> : <AssignmentsView />}
    </div>
  );
}

/* ----------------------------- PRODUCTION ----------------------------- */
function ProductionView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [operators, setOperators] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ymd = weekStart.toISOString().slice(0, 10);
      const res = await getProductionWeek(ymd);
      setParts(res.data.data.parts || []);
    } catch { setParts([]); } finally { setLoading(false); }
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getOperators().then(r => setOperators(r.data.data || [])).catch(() => {}); }, []);

  const saveCompletedBy = async (partId, value) => {
    setSavingId(partId);
    try { await updatePartCompletedBy(partId, value); setEditingId(null); await load(); }
    catch {} finally { setSavingId(null); }
  };

  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const weekEnd = days[6];
  const thisWeekStart = startOfWeek(new Date());
  const isThisWeek = weekStart.getTime() === thisWeekStart.getTime();
  const todayIdx = isThisWeek ? dayIndex(new Date(), weekStart) : -1;

  const byEmp = {};
  for (const p of parts) {
    const k = p.completedBy || 'Unassigned';
    if (!byEmp[k]) byEmp[k] = { name: k, total: 0, hours: 0, perDay: Array(7).fill(0), parts: [] };
    byEmp[k].total += 1;
    byEmp[k].hours += p.laborHours || 0;
    const di = dayIndex(p.completedAt, weekStart);
    if (di >= 0 && di < 7) byEmp[k].perDay[di] += 1;
    byEmp[k].parts.push(p);
  }
  const employees = Object.values(byEmp).sort((a, b) => b.total - a.total);
  const maxTotal = employees.reduce((m, e) => Math.max(m, e.total), 0) || 1;
  const grandParts = parts.length;
  const grandHours = parts.reduce((s, p) => s + (p.laborHours || 0), 0);
  const shiftWeek = (delta) => { const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7); setWeekStart(d); };

  return (
    <>
      <p style={{ color: '#777', marginTop: 0, fontSize: '0.9rem' }}>
        Every part completed each week, by who marked it done on the floor. Use it to spot output trends.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <button className="btn btn-outline" onClick={() => shiftWeek(-1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ChevronLeft size={16} /> Prev</button>
        <div style={{ fontWeight: 700, fontSize: '1rem', minWidth: 230, textAlign: 'center' }}>
          {formatDate(weekStart)} – {formatDate(weekEnd)}{isThisWeek && <span style={{ color: '#2e7d32', fontSize: '0.78rem', marginLeft: 8 }}>This week</span>}
        </div>
        <button className="btn btn-outline" onClick={() => shiftWeek(1)} disabled={isThisWeek} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Next <ChevronRight size={16} /></button>
        {!isThisWeek && <button className="btn btn-outline" onClick={() => setWeekStart(thisWeekStart)}>Jump to this week</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Parts completed', value: grandParts, icon: <Activity size={18} />, color: '#1565c0' },
          { label: 'Labor hours', value: grandHours ? grandHours.toFixed(1) : '0', icon: <Clock size={18} />, color: '#6a1b9a' },
          { label: 'People working', value: employees.length, icon: <Users size={18} />, color: '#2e7d32' },
        ].map(c => (
          <div key={c.label} className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div style={{ color: c.color, display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: '0.74rem', color: '#888', fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Loading…</div>
      ) : employees.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 50, color: '#999' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🛠️</div>
          <div style={{ fontWeight: 600 }}>No parts completed this week</div>
          <div style={{ fontSize: '0.82rem' }}>Completed parts show up here once the floor marks them done.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: 760 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '2px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Employee</th>
                {days.map((d, i) => (
                  <th key={i} style={{ padding: '10px 6px', textAlign: 'center', color: i === todayIdx ? '#1565c0' : '#888', fontWeight: i === todayIdx ? 800 : 600 }}>
                    <div>{DAY_LABELS[i]}</div>
                    <div style={{ fontSize: '0.68rem', color: '#bbb', fontWeight: 500 }}>{d.getMonth() + 1}/{d.getDate()}</div>
                  </th>
                ))}
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Parts</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Hrs</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <React.Fragment key={emp.name}>
                  <tr onClick={() => setExpanded(expanded === emp.name ? null : emp.name)}
                    style={{ borderBottom: '1px solid #f2f2f2', cursor: 'pointer', background: expanded === emp.name ? '#f5f9ff' : 'white' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                      <span style={{ color: '#999', marginRight: 6 }}>{expanded === emp.name ? '▾' : '▸'}</span>{emp.name}
                    </td>
                    {emp.perDay.map((n, i) => (
                      <td key={i} style={{ padding: '10px 6px', textAlign: 'center', color: n ? '#333' : '#ddd', fontWeight: n ? 700 : 400, background: i === todayIdx ? '#f0f6ff' : 'transparent' }}>{n || '·'}</td>
                    ))}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <div style={{ width: 40, height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${(emp.total / maxTotal) * 100}%`, height: '100%', background: '#1565c0' }} />
                        </div>
                        {emp.total}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#666' }}>{emp.hours ? emp.hours.toFixed(1) : '—'}</td>
                  </tr>
                  {expanded === emp.name && (
                    <tr>
                      <td colSpan={10} style={{ padding: '0 14px 12px', background: '#f5f9ff' }}>
                        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: 8, overflow: 'hidden' }}>
                          {emp.parts.slice().sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt)).map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid #f4f4f4', fontSize: '0.8rem' }}>
                              <span style={{ minWidth: 0 }}>
                                <strong>DR {p.dr || '—'}</strong>
                                <span style={{ color: '#888' }}> · {p.clientName || ''}</span>
                                <span style={{ color: '#555' }}> — {p.description}{p.quantity ? ` ×${p.quantity}` : ''}</span>
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {editingId === p.id ? (
                                  <>
                                    <select autoFocus defaultValue={p.completedBy || ''} disabled={savingId === p.id}
                                      onChange={(e) => saveCompletedBy(p.id, e.target.value)}
                                      style={{ fontSize: '0.78rem', padding: '3px 6px', border: '1px solid #1565c0', borderRadius: 6 }}>
                                      <option value="">Unassigned</option>
                                      {p.completedBy && !operators.some(o => o.operatorName === p.completedBy) && (
                                        <option value={p.completedBy}>{p.completedBy}</option>
                                      )}
                                      {operators.map(o => <option key={o.operatorName} value={o.operatorName}>{o.operatorName}</option>)}
                                    </select>
                                    <button title="Cancel" onClick={() => setEditingId(null)} style={{ ...iconBtn, padding: 3 }}><X size={13} /></button>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color: '#999', whiteSpace: 'nowrap' }}>
                                      {DAY_LABELS[Math.max(dayIndex(p.completedAt, weekStart), 0)]} {new Date(p.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                      {p.laborHours ? ` · ${p.laborHours}h` : ''}
                                    </span>
                                    <button title="Change who completed this" onClick={() => setEditingId(p.id)} style={{ ...iconBtn, padding: 3, color: '#1565c0' }}><Edit2 size={13} /></button>
                                  </>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 10 }}>
        "Completed by" comes from the tablet that marked each part done. If a tablet isn't tied to a specific person, its parts show under the device name.
      </p>
    </>
  );
}

/* ----------------------------- ASSIGNMENTS ----------------------------- */
function AssignmentsView() {
  const navigate = useNavigate();
  const [operators, setOperators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tileOp, setTileOp] = useState({});
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [taskBusy, setTaskBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, asg] = await Promise.all([getOperators(), getAssignments()]);
      setOperators(ops.data.data || []);
      setAssignments(asg.data.data || []);
    } catch { setOperators([]); setAssignments([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadTasks = useCallback(async (op) => {
    if (!op) { setTasks([]); return; }
    try { const r = await getOperatorTasks(op); setTasks(r.data.data || []); } catch { setTasks([]); }
  }, []);
  useEffect(() => { loadTasks(selected); }, [selected, loadTasks]);

  const refreshAssignments = async () => {
    try { const asg = await getAssignments(); setAssignments(asg.data.data || []); } catch {}
  };

  const countFor = (name) => assignments.filter(a => a.assignedOperator === name).length;
  const firstAvailable = () => {
    if (operators.length === 0) return null;
    let best = operators[0].operatorName, bestN = countFor(best);
    for (const o of operators) { const n = countFor(o.operatorName); if (n < bestN) { best = o.operatorName; bestN = n; } }
    return best;
  };
  const faName = firstAvailable();
  const queue = selected
    ? assignments.filter(a => a.assignedOperator === selected).sort((a, b) => (a.assignedSequence ?? 0) - (b.assignedSequence ?? 0))
    : [];

  const runSearch = async () => {
    setSearching(true);
    try { const res = await getAssignableWorkOrders(query.trim()); setResults(res.data.data || []); }
    catch { setResults([]); } finally { setSearching(false); }
  };

  const addJob = async (woId, operator) => {
    if (!operator) return;
    setBusy(true);
    try { await assignWorkOrder(woId, operator); await refreshAssignments(); setResults(rs => rs.filter(r => r.id !== woId)); }
    catch {} finally { setBusy(false); }
  };
  const reassignJob = async (woId, newOp) => {
    if (!newOp || newOp === selected) return;
    setBusy(true);
    try { await assignWorkOrder(woId, newOp); await refreshAssignments(); }
    catch {} finally { setBusy(false); }
  };
  const handleRemove = async (woId) => {
    setBusy(true);
    try { await unassignWorkOrder(woId); await refreshAssignments(); }
    catch {} finally { setBusy(false); }
  };
  const move = async (idx, dir) => {
    const ids = queue.map(q => q.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setBusy(true);
    try { await reorderAssignments(selected, ids); await refreshAssignments(); }
    catch {} finally { setBusy(false); }
  };

  const addTask = async () => {
    const text = newTask.trim();
    if (!text || !selected) return;
    setTaskBusy(true);
    try { await addOperatorTask(selected, text); setNewTask(''); await loadTasks(selected); }
    catch {} finally { setTaskBusy(false); }
  };
  const toggleTask = async (t) => {
    setTaskBusy(true);
    try { await updateOperatorTask(t.id, { done: !t.done }); await loadTasks(selected); }
    catch {} finally { setTaskBusy(false); }
  };
  const removeTask = async (id) => {
    setTaskBusy(true);
    try { await deleteOperatorTask(id); await loadTasks(selected); }
    catch {} finally { setTaskBusy(false); }
  };
  const moveTask = async (idx, dir) => {
    const ids = tasks.map(t => t.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setTaskBusy(true);
    try { await reorderOperatorTasks(selected, ids); await loadTasks(selected); }
    catch {} finally { setTaskBusy(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Loading…</div>;

  const opSelect = (value, onChange, opts = {}) => (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={opts.disabled}
      style={{ fontSize: '0.78rem', padding: '4px 6px', border: '1px solid #ddd', borderRadius: 6, maxWidth: 150 }}>
      {opts.firstAvailable && <option value="">First available{faName ? ` — ${faName}` : ''}</option>}
      {operators.map(o => <option key={o.operatorName} value={o.operatorName}>{o.operatorName}</option>)}
    </select>
  );

  return (
    <>
      <p style={{ color: '#777', marginTop: 0, fontSize: '0.9rem' }}>
        Build each operator's schedule — drag jobs into order, add tasks, and reassign work to whoever's free. Everything here shows up on that operator's tablet. Operators come from the tablet API keys (Users &amp; Logs).
      </p>

      {operators.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <Users size={30} style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>No operators found</div>
          <div style={{ fontSize: '0.82rem' }}>Set an operator name on each tablet's API key under Users &amp; Logs, then they'll show up here.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Operator list */}
          <div className="card" style={{ padding: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#999', padding: '6px 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Operators</div>
            {operators.map(op => {
              const n = countFor(op.operatorName);
              const active = selected === op.operatorName;
              return (
                <button key={op.operatorName} onClick={() => { setSelected(op.operatorName); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                    border: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 8, marginBottom: 2,
                    background: active ? '#e8f1fc' : 'transparent', color: active ? '#1565c0' : '#333', fontWeight: active ? 700 : 500,
                  }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {op.operatorName}
                    {op.deviceName && <span style={{ display: 'block', fontSize: '0.68rem', color: '#aaa', fontWeight: 400 }}>{op.deviceName}</span>}
                  </span>
                  <span style={{ background: n ? '#1565c0' : '#ddd', color: 'white', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', flexShrink: 0 }}>{n}</span>
                </button>
              );
            })}
          </div>

          {/* Right side */}
          <div>
            {/* QUEUE (top) */}
            {!selected ? (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999', marginBottom: 16 }}>
                <ClipboardList size={28} style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600 }}>Pick an operator to see their queue</div>
                <div style={{ fontSize: '0.82rem' }}>Or just search jobs below and assign them to whoever's available.</div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, marginBottom: 16 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, color: '#333' }}>
                  {selected}'s queue
                  <span style={{ color: '#999', fontWeight: 500 }}> · {queue.length} job{queue.length === 1 ? '' : 's'} · {tasks.filter(t => !t.done).length} task{tasks.filter(t => !t.done).length === 1 ? '' : 's'}</span>
                </div>

                {/* Jobs */}
                <div style={{ padding: '8px 14px 4px', fontSize: '0.7rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 }}>Jobs</div>
                {queue.length === 0 ? (
                  <div style={{ padding: '4px 14px 12px', color: '#aaa', fontSize: '0.84rem' }}>No jobs yet — add one below.</div>
                ) : queue.map((q, idx) => (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: '1px solid #f6f6f6' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1565c0', color: 'white', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>DR {q.dr || '—'} <span style={{ color: '#888', fontWeight: 400 }}>· {q.clientName || ''}</span></div>
                      <div style={{ fontSize: '0.7rem', color: '#aaa' }}>{q.status}{q.promisedDate ? ` · due ${formatDate(q.promisedDate)}` : ''}</div>
                    </div>
                    {opSelect(selected, (v) => reassignJob(q.id, v), { disabled: busy })}
                    <button title="Move up" disabled={idx === 0 || busy} onClick={() => move(idx, -1)} style={iconBtn}><ArrowUp size={14} /></button>
                    <button title="Move down" disabled={idx === queue.length - 1 || busy} onClick={() => move(idx, 1)} style={iconBtn}><ArrowDown size={14} /></button>
                    <button title="Open work order" onClick={() => navigate(`/workorders/${q.id}`)} style={iconBtn}><ExternalLink size={14} /></button>
                    <button title="Remove" disabled={busy} onClick={() => handleRemove(q.id)} style={{ ...iconBtn, color: '#c62828' }}><X size={14} /></button>
                  </div>
                ))}

                {/* Tasks */}
                <div style={{ padding: '12px 14px 4px', fontSize: '0.7rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, borderTop: '1px solid #f0f0f0', marginTop: 6 }}>Tasks</div>
                {tasks.map((t, idx) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderTop: '1px solid #f6f6f6' }}>
                    <button title={t.done ? 'Mark not done' : 'Mark done'} disabled={taskBusy} onClick={() => toggleTask(t)} style={{ ...iconBtn, padding: 3, color: t.done ? '#2e7d32' : '#999' }}>
                      {t.done ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: t.done ? '#aaa' : '#333', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                    <button title="Move up" disabled={idx === 0 || taskBusy} onClick={() => moveTask(idx, -1)} style={iconBtn}><ArrowUp size={14} /></button>
                    <button title="Move down" disabled={idx === tasks.length - 1 || taskBusy} onClick={() => moveTask(idx, 1)} style={iconBtn}><ArrowDown size={14} /></button>
                    <button title="Delete" disabled={taskBusy} onClick={() => removeTask(t.id)} style={{ ...iconBtn, padding: 3, color: '#c62828' }}><Trash2 size={14} /></button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px' }}>
                  <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder='Add a task — e.g. "Take out trash"'
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.84rem', boxSizing: 'border-box' }} />
                  <button className="btn btn-primary" onClick={addTask} disabled={taskBusy || !newTask.trim()}>Add task</button>
                </div>
              </div>
            )}

            {/* ADD A JOB — tiles */}
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.9rem' }}>Find &amp; assign jobs</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#bbb' }} />
                  <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()}
                    placeholder="Search by DR # or client…"
                    style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
                <button className="btn btn-primary" onClick={runSearch} disabled={searching}>{searching ? '…' : 'Search'}</button>
              </div>
              {results.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                  {results.map(r => {
                    const chosen = tileOp[r.id] !== undefined ? tileOp[r.id] : (selected || '');
                    return (
                      <div key={r.id} style={{ border: '1px solid #e6e6e6', borderRadius: 10, padding: 10, background: '#fafbfc' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>DR {r.dr || '—'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.clientName || ''}</div>
                        <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: 8 }}>{r.status}{r.assignedOperator ? ` · on ${r.assignedOperator}` : ''}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <select value={chosen} onChange={e => setTileOp(m => ({ ...m, [r.id]: e.target.value }))}
                            style={{ flex: 1, fontSize: '0.78rem', padding: '5px 6px', border: '1px solid #ddd', borderRadius: 6, minWidth: 0 }}>
                            <option value="">Unassigned — pick operator</option>
                            {operators.map(o => <option key={o.operatorName} value={o.operatorName}>{o.operatorName}</option>)}
                          </select>
                          <button className="btn btn-primary" disabled={busy || !chosen} onClick={() => addJob(r.id, chosen)} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, padding: '5px 10px' }}><Plus size={14} /> Add</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (!searching && query) ? (
                <div style={{ color: '#aaa', fontSize: '0.82rem' }}>No matching active work orders.</div>
              ) : (
                <div style={{ color: '#bbb', fontSize: '0.82rem' }}>Search a DR # or client to see job tiles you can assign.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const iconBtn = {
  background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: 5, cursor: 'pointer',
  color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
