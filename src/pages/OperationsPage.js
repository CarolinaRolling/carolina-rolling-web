import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Activity, Clock, Users } from 'lucide-react';
import { getProductionWeek } from '../services/api';
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ymd = weekStart.toISOString().slice(0, 10);
      const res = await getProductionWeek(ymd);
      setParts(res.data.data.parts || []);
    } catch { setParts([]); } finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const weekEnd = days[6];
  const thisWeekStart = startOfWeek(new Date());
  const isThisWeek = weekStart.getTime() === thisWeekStart.getTime();
  const todayIdx = isThisWeek ? dayIndex(new Date(), weekStart) : -1;

  // Group by employee
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

  const shiftWeek = (delta) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7); setWeekStart(d);
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Activity size={26} color="#1565c0" />
        <h1 className="page-title" style={{ margin: 0 }}>Operations — Production</h1>
      </div>
      <p style={{ color: '#777', marginTop: 0, fontSize: '0.9rem' }}>
        Every part completed each week, by who marked it done on the floor. Use it to spot output trends.
      </p>

      {/* Week navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <button className="btn btn-outline" onClick={() => shiftWeek(-1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChevronLeft size={16} /> Prev
        </button>
        <div style={{ fontWeight: 700, fontSize: '1rem', minWidth: 230, textAlign: 'center' }}>
          {formatDate(weekStart)} – {formatDate(weekEnd)}{isThisWeek && <span style={{ color: '#2e7d32', fontSize: '0.78rem', marginLeft: 8 }}>This week</span>}
        </div>
        <button className="btn btn-outline" onClick={() => shiftWeek(1)} disabled={isThisWeek} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Next <ChevronRight size={16} />
        </button>
        {!isThisWeek && <button className="btn btn-outline" onClick={() => setWeekStart(thisWeekStart)}>Jump to this week</button>}
      </div>

      {/* Summary */}
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
                      <td key={i} style={{ padding: '10px 6px', textAlign: 'center', color: n ? '#333' : '#ddd', fontWeight: n ? 700 : 400, background: i === todayIdx ? '#f0f6ff' : 'transparent' }}>
                        {n || '·'}
                      </td>
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
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 12px', borderBottom: '1px solid #f4f4f4', fontSize: '0.8rem' }}>
                              <span style={{ minWidth: 0 }}>
                                <strong>DR {p.dr || '—'}</strong>
                                <span style={{ color: '#888' }}> · {p.clientName || ''}</span>
                                <span style={{ color: '#555' }}> — {p.description}{p.quantity ? ` ×${p.quantity}` : ''}</span>
                              </span>
                              <span style={{ color: '#999', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {DAY_LABELS[Math.max(dayIndex(p.completedAt, weekStart), 0)]} {new Date(p.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {p.laborHours ? ` · ${p.laborHours}h` : ''}
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
    </div>
  );
}
