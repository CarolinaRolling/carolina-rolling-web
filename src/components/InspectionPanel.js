import React, { useState, useEffect } from 'react';
import { Plus, FileText, Printer, Check, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import {
  getInspectionJobs, createInspectionJob, deleteInspectionJob,
  addInspectionUnit, saveInspectionUnit, updateInspectionJob,
  moveInspectionUnit, deleteInspectionUnit,
  getInspectionTools, createInspectionTool, deleteInspectionTool,
  getInspectionReportPdf, getInspectionLabelPdf,
  addWorkOrderPart,
} from '../services/api';

const TOLERANCE_OOS = 0.1875; // 3/16"
const TOLERANCE_DIAM = 0.125; // 1/8"
export const SPEC_TOLERANCE = 0.25; // 1/4" — how far a measurement may differ from the ordered spec before warning

// Parse a spec dimension that may be a fraction ("1/4", "1 1/2"), decimal, or have units
export function parseSpec(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).trim();
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const dec = parseFloat(s);
  return isNaN(dec) ? null : dec;
}

// Compare a unit's measurements against the part's ordered spec.
// Returns [{ label, measured, spec, delta }] for anything beyond SPEC_TOLERANCE.
export function specIssues(part, unit, skip = false) {
  if (!part || !unit) return [];
  const pr = unit.preRoll || {}, po = unit.postRoll || {};
  const specW = parseSpec(part.width);
  const specL = parseSpec(part.length);
  const specT = parseSpec(part.thickness);
  const specD = parseSpec(part.diameter) ?? parseSpec(part.outerDiameter) ?? parseSpec(part.formData?.diameter) ?? parseSpec(part.formData?.outerDiameter);
  const issues = [];
  const check = (label, measured, spec) => {
    const m = parseFloat(measured);
    if (spec == null || !m || isNaN(m)) return;
    const delta = Math.abs(m - spec);
    if (delta > SPEC_TOLERANCE) issues.push({ label, measured: m, spec, delta });
  };
  if (!skip) {
    check('Width (End 1)', pr.widthEnd1, specW);
    check('Width (End 2)', pr.widthEnd2, specW);
    check('Length (End 1)', pr.lengthEnd1, specL);
    check('Length (End 2)', pr.lengthEnd2, specL);
    check('Thickness', pr.thickness, specT);
  }
  check('Diameter A', po.diamSeam, specD);
  check('Diameter B', po.diam90, specD);
  check('Diameter C', po.diam45, specD);
  check('Diameter D', po.diamNeg45, specD);
  return issues;
}

// ── Reference diagrams ──
function PreRollDiagram() {
  return (
    <svg viewBox="0 0 320 170" style={{ width:'100%', maxWidth:300, border:'1px solid #e0e0e0', borderRadius:8, background:'#fafafa' }}>
      <rect x="40" y="40" width="240" height="95" fill="none" stroke="#1565c0" strokeWidth="2"/>
      <line x1="40" y1="28" x2="280" y2="28" stroke="#e65100" strokeWidth="1.5"/>
      <text x="160" y="22" textAnchor="middle" fontSize="10" fill="#e65100">Width (both ends)</text>
      <text x="305" y="90" textAnchor="middle" fontSize="10" fill="#2e7d32" transform="rotate(90,305,90)">Length (both ends)</text>
      <line x1="40" y1="40" x2="280" y2="135" stroke="#7b1fa2" strokeWidth="1.5" strokeDasharray="5,3"/>
      <line x1="280" y1="40" x2="40" y2="135" stroke="#c62828" strokeWidth="1.5" strokeDasharray="5,3"/>
      <text x="150" y="92" textAnchor="middle" fontSize="9" fill="#7b1fa2">Diag A</text>
      <text x="172" y="105" textAnchor="middle" fontSize="9" fill="#c62828">Diag B</text>
      <text x="160" y="158" textAnchor="middle" fontSize="9" fill="#555">Thickness at center of plate</text>
    </svg>
  );
}
function PostRollDiagram() {
  return (
    <svg viewBox="0 0 320 200" style={{ width:'100%', maxWidth:300, border:'1px solid #e0e0e0', borderRadius:8, background:'#fafafa' }}>
      <circle cx="160" cy="105" r="68" fill="none" stroke="#1565c0" strokeWidth="2"/>
      <line x1="160" y1="37" x2="160" y2="173" stroke="#c62828" strokeWidth="1.5"/>
      <line x1="92" y1="105" x2="228" y2="105" stroke="#2e7d32" strokeWidth="1.5"/>
      <line x1="112" y1="57" x2="208" y2="153" stroke="#e65100" strokeWidth="1.5"/>
      <line x1="208" y1="57" x2="112" y2="153" stroke="#7b1fa2" strokeWidth="1.5"/>
      <text x="160" y="30" textAnchor="middle" fontSize="10" fill="#c62828">A (seam, 0°)</text>
      <text x="250" y="108" textAnchor="start" fontSize="10" fill="#2e7d32">B (90°)</text>
      <text x="214" y="52" textAnchor="start" fontSize="10" fill="#e65100">C (45°)</text>
      <text x="106" y="52" textAnchor="end" fontSize="10" fill="#7b1fa2">D (-45°)</text>
      <text x="160" y="193" textAnchor="middle" fontSize="9" fill="#555">Diameter at each point</text>
    </svg>
  );
}

// ── Compact table cell ──
function Cell({ value, onChange, type, warn, error }) {
  if (type === 'check') {
    return <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ width:16, height:16, cursor:'pointer' }} />;
  }
  return (
    <input type="number" step="0.0001" value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ width:62, padding:'4px 5px', border:`1px solid ${error?'#c62828':warn?'#e65100':'#ddd'}`,
        background: error?'#ffebee':warn?'#fff3e0':'white',
        borderRadius:4, fontSize:'0.78rem', fontFamily:'monospace', textAlign:'right' }} />
  );
}

function rowStatus(pr, po, skip) {
  const oos = Math.abs((parseFloat(pr.diagA)||0) - (parseFloat(pr.diagB)||0)) > TOLERANCE_OOS;
  const dv = [parseFloat(po.diamSeam)||0, parseFloat(po.diam90)||0, parseFloat(po.diam45)||0, parseFloat(po.diamNeg45)||0].filter(v=>v>0);
  const diamFail = dv.length >= 2 && (Math.max(...dv) - Math.min(...dv)) > TOLERANCE_DIAM;
  const prDone = pr.thickness && pr.gradeConfirmed && pr.heatNumberConfirmed && pr.widthEnd1 && pr.widthEnd2 && pr.lengthEnd1 && pr.lengthEnd2 && pr.diagA && pr.diagB;
  const poDone = po.circumEnd1 && po.circumEnd2 && po.diamSeam && po.diam90 && po.diam45 && po.diamNeg45;
  return { oos, diamFail, done: (skip || prDone) && poDone };
}

// ── Main panel (CR Admin table view) ──
export default function InspectionPanel({ order, inspectionPart, linkedPartId, onRefresh }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showDiagrams, setShowDiagrams] = useState(false);
  const [tools, setTools] = useState([]);
  const [showTools, setShowTools] = useState(false);
  const [newTool, setNewTool] = useState({ name:'', toolType:'', serialNumber:'', calibrationDueDate:'' });

  useEffect(() => { (async () => {
    try { const r = await getInspectionTools(); setTools(r.data?.data || r.data || []); } catch (e) {}
  })(); }, []);

  const selectedToolIds = job?.toolsUsed || [];
  const toggleTool = async (toolId) => {
    if (!job) return;
    const next = selectedToolIds.includes(toolId)
      ? selectedToolIds.filter(id => id !== toolId)
      : [...selectedToolIds, toolId];
    setJob({ ...job, toolsUsed: next });
    try { await updateInspectionJob(job.id, { toolsUsed: next }); } catch (e) { setError('Could not save tool selection'); }
  };
  const handleAddTool = async () => {
    if (!newTool.name.trim()) return;
    try {
      const r = await createInspectionTool(newTool);
      const created = r.data?.data || r.data;
      const list = (await getInspectionTools()).data?.data || [];
      setTools(list);
      setNewTool({ name:'', toolType:'', serialNumber:'', calibrationDueDate:'' });
      if (created?.id) toggleTool(created.id);
    } catch (e) { setError('Could not add tool'); }
  };
  const handleRemoveTool = async (toolId) => {
    try { await deleteInspectionTool(toolId); setTools(tools.filter(t => t.id !== toolId)); } catch (e) {}
  };

  const linkedPart = (order.parts || []).find(p => p.id === linkedPartId);
  const drNum = order.drNumber || order.orderNumber || '';
  const irNumber = `IR-${drNum}-${linkedPart?.partNumber ?? '?'}`;

  useEffect(() => { if (order?.id) loadJob(); /* eslint-disable-next-line */ }, [order?.id, inspectionPart?.id]);

  const loadJob = async () => {
    setLoading(true); setError(null);
    try {
      const desired = parseInt(linkedPart?.quantity) || parseInt(inspectionPart?.quantity) || 1;
      const r = await getInspectionJobs(order.id);
      const jobs = r.data.data || [];
      let found = jobs.find(j => j.inspectionPartId === inspectionPart?.id || j.workOrderPartId === linkedPartId);
      if (!found) {
        const create = await createInspectionJob({ workOrderId: order.id, workOrderPartId: linkedPartId, inspectionPartId: inspectionPart?.id, unitCount: desired });
        found = create.data.data;
      }
      // Note: cylinder count is managed manually after creation (Add / Move / Delete),
      // so we no longer auto-add units on reload — that would undo a move or delete.
      setJob(found);
      const init = {};
      (found.units || []).forEach(u => { init[u.id] = { preRoll: { ...(u.preRoll||{}) }, postRoll: { ...(u.postRoll||{}) } }; });
      setRows(init);
      setDirty(false);
      setLastSync(new Date());
    } catch(e) { console.error(e); setError(e?.response?.data?.error?.message || e.message || 'Failed to load inspection'); }
    finally { setLoading(false); }
  };

  const setPR = (uid, field, val) => { setDirty(true); setRows(prev => ({ ...prev, [uid]: { ...prev[uid], preRoll: { ...prev[uid].preRoll, [field]: val } } })); };
  const setPO = (uid, field, val) => { setDirty(true); setRows(prev => ({ ...prev, [uid]: { ...prev[uid], postRoll: { ...prev[uid].postRoll, [field]: val } } })); };

  // Live sync: pull the operator's latest measurements every 12s.
  // Paused while the office has unsaved edits so we never clobber typing.
  useEffect(() => {
    if (!job?.id) return;
    const t = setInterval(async () => {
      if (dirty || saving) return;
      try {
        const r = await getInspectionJobs(order.id);
        const found = (r.data.data || []).find(j => j.id === job.id);
        if (!found) return;
        setJob(found);
        const init = {};
        (found.units || []).forEach(u => { init[u.id] = { preRoll: { ...(u.preRoll||{}) }, postRoll: { ...(u.postRoll||{}) } }; });
        setRows(init);
        setLastSync(new Date());
      } catch {}
    }, 12000);
    return () => clearInterval(t);
  }, [job?.id, dirty, saving, order.id]);

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const u of (job.units || [])) {
        const r = rows[u.id]; if (!r) continue;
        await saveInspectionUnit(u.id, { preRoll: r.preRoll, postRoll: r.postRoll });
      }
      await loadJob();
    } catch(e) { setError('Save failed'); }
    finally { setSaving(false); }
  };

  const handleAddUnit = async () => { if (!job) return; await addInspectionUnit(job.id); await loadJob(); };

  const handleToggleSkip = async (val) => {
    if (!job) return;
    try { await updateInspectionJob(job.id, { skipPreRoll: val }); await loadJob(); }
    catch (e) { setError('Could not update inspection setting'); }
  };

  const handleMoveUnit = async (unitId, targetPartId) => {
    if (!targetPartId) return;
    try {
      await moveInspectionUnit(unitId, targetPartId);
      // Make sure the target line has an inspection panel (service line) so the moved cylinder shows immediately
      const hasInsp = (order.parts || []).some(p => p.partType === 'inspection' &&
        String(p._linkedPartId || p.formData?._linkedPartId || p.formData?.linkedPartId || '') === String(targetPartId));
      if (!hasInsp) {
        const targetPart = (order.parts || []).find(p => p.id === targetPartId);
        await addWorkOrderPart(order.id, {
          partType: 'inspection', quantity: parseInt(targetPart?.quantity) || 1,
          _linkedPartId: targetPartId, description: 'Inspection',
          materialSource: 'customer_supplied', status: 'pending',
        });
      }
      if (onRefresh) await onRefresh(); else await loadJob();
    } catch (e) { setError(e?.response?.data?.error?.message || 'Could not move cylinder'); }
  };
  const handleDeleteUnit = async (unitId, unitLabel) => {
    if (!window.confirm(`Delete cylinder ${unitLabel}? Its measurements will be permanently removed.`)) return;
    try { await deleteInspectionUnit(unitId); await loadJob(); }
    catch (e) { setError('Could not delete cylinder'); }
  };

  const handlePrintLabel = async (unitId) => {
    try { const r = await getInspectionLabelPdf(unitId); window.open(URL.createObjectURL(new Blob([r.data], { type:'application/pdf' })), '_blank'); }
    catch(e) { alert('Label print failed'); }
  };
  const handleReport = async () => {
    if (!job) return; setReportLoading(true);
    try { const r = await getInspectionReportPdf(job.id); window.open(URL.createObjectURL(new Blob([r.data], { type:'application/pdf' })), '_blank'); }
    catch(e) { alert('Report generation failed'); }
    finally { setReportLoading(false); }
  };

  if (loading) return <div style={{ padding:16, marginTop:12, textAlign:'center', color:'#888', border:'2px solid #1565c0', borderRadius:10 }}>Loading inspection…</div>;
  if (error || !job) return (
    <div style={{ marginTop:12, border:'2px solid #c62828', borderRadius:10, padding:16, background:'#fff5f5' }}>
      <div style={{ fontWeight:700, color:'#c62828', display:'flex', alignItems:'center', gap:6 }}><AlertTriangle size={16} /> Inspection couldn't load</div>
      <div style={{ fontSize:'0.82rem', color:'#666', margin:'6px 0 10px' }}>{error || 'No inspection job for this part.'}</div>
      <button onClick={loadJob} style={{ padding:'8px 14px', background:'#1565c0', color:'white', border:'none', borderRadius:6, fontWeight:600, cursor:'pointer' }}>Retry</button>
    </div>
  );

  const units = job.units || [];
  const skip = !!job.skipPreRoll;
  const SERVICE_PART_TYPES = ['fab_service','shop_rate','rush_service','inspection'];
  const moveTargets = (order?.parts || []).filter(p => !SERVICE_PART_TYPES.includes(p.partType) && p.id !== linkedPartId);
  const completedCount = units.filter(u => { const r = rows[u.id]||{preRoll:{},postRoll:{}}; return rowStatus(r.preRoll, r.postRoll, skip).done; }).length;
  const allComplete = completedCount === units.length && units.length > 0;

  const th = { padding:'6px 6px', fontSize:'0.68rem', color:'#555', fontWeight:700, whiteSpace:'nowrap', borderBottom:'1px solid #ddd' };
  const td = { padding:'4px 5px', textAlign:'center', borderBottom:'1px solid #f0f0f0' };
  const toolInput = { padding:'6px 8px', border:'1px solid #ccc', borderRadius:5, fontSize:'0.82rem', width:170 };

  // ── Spec check: measured vs the ORDERED spec on the part ──
  const specW = parseSpec(linkedPart?.width);
  const specL = parseSpec(linkedPart?.length);
  const specT = parseSpec(linkedPart?.thickness);
  const specD = parseSpec(linkedPart?.diameter) ?? parseSpec(linkedPart?.outerDiameter) ?? parseSpec(linkedPart?.formData?.diameter) ?? parseSpec(linkedPart?.formData?.outerDiameter);
  const overSpec = (measured, spec) => { const m = parseFloat(measured); return spec != null && m && !isNaN(m) && Math.abs(m - spec) > SPEC_TOLERANCE; };
  const allSpecIssues = units.flatMap(u => {
    const r = rows[u.id] || { preRoll:{}, postRoll:{} };
    return specIssues(linkedPart, r, skip).map(i => ({ unitId: u.unitId, ...i }));
  });

  return (
    <div style={{ background:'white', borderRadius:10, border:`2px solid ${allSpecIssues.length ? '#c62828' : '#1565c0'}`, overflow:'hidden', marginTop:12 }}>
      {/* OUT-OF-SPEC banner — pinned at the very top, never collapses */}
      {allSpecIssues.length > 0 && (
        <div style={{ background:'#c62828', padding:'12px 16px', borderBottom:'3px solid #7f0000' }}>
          <div style={{ color:'white', fontWeight:800, fontSize:'1rem', display:'flex', alignItems:'center', gap:8 }}>
            <AlertTriangle size={20} /> OUT OF SPEC — CHECK BEFORE RUNNING / SHIPPING
          </div>
          <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:3 }}>
            {allSpecIssues.map((i, idx) => (
              <div key={idx} style={{ color:'white', fontSize:'0.84rem', fontFamily:'monospace' }}>
                <strong>{i.unitId}</strong> · {i.label}: measured <strong>{i.measured}"</strong> vs spec <strong>{i.spec}"</strong> &nbsp;(off {i.delta.toFixed(3)}")
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ background:'#1565c0', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ color:'white', fontWeight:700, fontSize:'0.98rem' }}>🔬 Cylinder Inspection · {irNumber}</div>
          <div style={{ color:'rgba(255,255,255,0.85)', fontSize:'0.78rem' }}>
            {completedCount}/{units.length} complete{allComplete && ' — ✓ all done'}
            {dirty
              ? <span style={{ color:'#ffe082' }}> · ✎ editing — live paused (Save to resume)</span>
              : <span style={{ color:'#a5ffb0' }}> · ● live{lastSync ? ` · updated ${lastSync.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}` : ''}</span>}
          </div>
          <label style={{ color:'white', fontSize:'0.78rem', display:'flex', alignItems:'center', gap:5, marginTop:4, cursor:'pointer' }}>
            <input type="checkbox" checked={skip} onChange={e => handleToggleSkip(e.target.checked)} />
            Client-supplied cylinders — skip flat-sheet (pre-roll)
          </label>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowDiagrams(s => !s)} style={{ padding:'7px 12px', background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.4)', borderRadius:6, cursor:'pointer', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:4 }}>
            {showDiagrams ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} Diagrams
          </button>
          <button onClick={() => setShowTools(s => !s)} style={{ padding:'7px 12px', background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.4)', borderRadius:6, cursor:'pointer', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:4 }}>
            🛠 Tools{selectedToolIds.length ? ` (${selectedToolIds.length})` : ''}
          </button>
          <button onClick={handleReport} disabled={reportLoading} style={{ padding:'7px 12px', background:allComplete?'white':'rgba(255,255,255,0.2)', color:allComplete?'#1565c0':'white', border:`1px solid ${allComplete?'white':'rgba(255,255,255,0.4)'}`, borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:5 }}>
            <FileText size={14}/> {reportLoading ? 'Generating…' : 'Report'}
          </button>
        </div>
      </div>

      {showDiagrams && (
        <div style={{ display:'flex', gap:16, padding:'12px 14px', background:'#f9fbfd', borderBottom:'1px solid #e0e0e0', flexWrap:'wrap' }}>
          {!skip && <div><div style={{ fontSize:'0.72rem', fontWeight:700, color:'#555', marginBottom:4 }}>Pre-Roll (flat plate)</div><PreRollDiagram/></div>}
          <div><div style={{ fontSize:'0.72rem', fontWeight:700, color:'#555', marginBottom:4 }}>Post-Roll (cylinder)</div><PostRollDiagram/></div>
        </div>
      )}

      {showTools && (
        <div style={{ padding:'12px 14px', background:'#f9fbfd', borderBottom:'1px solid #e0e0e0' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#555', marginBottom:8 }}>Inspection tools used (selected tools appear on the report)</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
            {tools.length === 0 && <span style={{ fontSize:'0.8rem', color:'#888' }}>No tools registered yet — add one below.</span>}
            {tools.map(t => {
              const sel = selectedToolIds.includes(t.id);
              return (
                <label key={t.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 9px', background: sel ? '#1565c0' : 'white', color: sel ? 'white' : '#333', border:`1px solid ${sel ? '#1565c0' : '#ccc'}`, borderRadius:6, cursor:'pointer', fontSize:'0.82rem' }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleTool(t.id)} />
                  <span>{t.name}{t.toolType ? ` · ${t.toolType}` : ''}{t.serialNumber ? ` · #${t.serialNumber}` : ''}</span>
                  <span onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); handleRemoveTool(t.id); }} title="Remove from list" style={{ marginLeft:4, opacity:0.6 }}>✕</span>
                </label>
              );
            })}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
            <input value={newTool.name} onChange={e=>setNewTool({...newTool, name:e.target.value})} placeholder={'Tool name (e.g. 6" Caliper)'} style={toolInput} />
            <input value={newTool.toolType} onChange={e=>setNewTool({...newTool, toolType:e.target.value})} placeholder="Type" style={{...toolInput, width:110}} />
            <input value={newTool.serialNumber} onChange={e=>setNewTool({...newTool, serialNumber:e.target.value})} placeholder="Serial / ID" style={{...toolInput, width:120}} />
            <input type="date" value={newTool.calibrationDueDate} onChange={e=>setNewTool({...newTool, calibrationDueDate:e.target.value})} title="Calibration due date" style={{...toolInput, width:150}} />
            <button onClick={handleAddTool} style={{ padding:'7px 12px', background:'#1565c0', color:'white', border:'none', borderRadius:6, fontWeight:600, cursor:'pointer', fontSize:'0.82rem' }}>+ Add tool</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', width:'100%', minWidth:1100 }}>
          <thead>
            <tr style={{ background:'#fafafa' }}>
              <th style={{ ...th, textAlign:'left', position:'sticky', left:0, background:'#fafafa' }}>Cylinder ID</th>
              {!skip && <th style={th} colSpan={9}>PRE-ROLL (flat plate)</th>}
              <th style={th} colSpan={6}>POST-ROLL (cylinder)</th>
              <th style={th}>Status</th>
              <th style={th}>Label</th>
              <th style={th}>Move / Del</th>
            </tr>
            <tr style={{ background:'#fafafa' }}>
              <th style={{ ...th, position:'sticky', left:0, background:'#fafafa' }}></th>
              {!skip && <><th style={th}>Thk</th><th style={th}>Grade</th><th style={th}>Heat</th>
              <th style={th}>W1</th><th style={th}>W2</th><th style={th}>L1</th><th style={th}>L2</th>
              <th style={th}>Diag A</th><th style={th}>Diag B</th></>}
              <th style={th}>Circ 1</th><th style={th}>Circ 2</th>
              <th style={th}>Ø A</th><th style={th}>Ø B</th><th style={th}>Ø C</th><th style={th}>Ø D</th>
              <th style={th}></th><th style={th}></th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {units.map(u => {
              const r = rows[u.id] || { preRoll:{}, postRoll:{} };
              const pr = r.preRoll, po = r.postRoll;
              const st = rowStatus(pr, po, skip);
              return (
                <tr key={u.id}>
                  <td style={{ ...td, textAlign:'left', fontFamily:'monospace', fontWeight:700, color:'#1565c0', position:'sticky', left:0, background:'white', whiteSpace:'nowrap' }}>{u.unitId}</td>
                  {!skip && <>
                  <td style={td}><Cell value={pr.thickness} onChange={v=>setPR(u.id,'thickness',v)} error={overSpec(pr.thickness, specT)} /></td>
                  <td style={td}><Cell type="check" value={pr.gradeConfirmed} onChange={v=>setPR(u.id,'gradeConfirmed',v)} /></td>
                  <td style={td}><Cell type="check" value={pr.heatNumberConfirmed} onChange={v=>setPR(u.id,'heatNumberConfirmed',v)} /></td>
                  <td style={td}><Cell value={pr.widthEnd1} onChange={v=>setPR(u.id,'widthEnd1',v)} error={overSpec(pr.widthEnd1, specW)} /></td>
                  <td style={td}><Cell value={pr.widthEnd2} onChange={v=>setPR(u.id,'widthEnd2',v)} error={overSpec(pr.widthEnd2, specW)} /></td>
                  <td style={td}><Cell value={pr.lengthEnd1} onChange={v=>setPR(u.id,'lengthEnd1',v)} error={overSpec(pr.lengthEnd1, specL)} /></td>
                  <td style={td}><Cell value={pr.lengthEnd2} onChange={v=>setPR(u.id,'lengthEnd2',v)} error={overSpec(pr.lengthEnd2, specL)} /></td>
                  <td style={td}><Cell value={pr.diagA} onChange={v=>setPR(u.id,'diagA',v)} warn={st.oos} /></td>
                  <td style={td}><Cell value={pr.diagB} onChange={v=>setPR(u.id,'diagB',v)} warn={st.oos} /></td>
                  </>}
                  <td style={td}><Cell value={po.circumEnd1} onChange={v=>setPO(u.id,'circumEnd1',v)} /></td>
                  <td style={td}><Cell value={po.circumEnd2} onChange={v=>setPO(u.id,'circumEnd2',v)} /></td>
                  <td style={td}><Cell value={po.diamSeam} onChange={v=>setPO(u.id,'diamSeam',v)} error={st.diamFail || overSpec(po.diamSeam, specD)} /></td>
                  <td style={td}><Cell value={po.diam90} onChange={v=>setPO(u.id,'diam90',v)} error={st.diamFail || overSpec(po.diam90, specD)} /></td>
                  <td style={td}><Cell value={po.diam45} onChange={v=>setPO(u.id,'diam45',v)} error={st.diamFail || overSpec(po.diam45, specD)} /></td>
                  <td style={td}><Cell value={po.diamNeg45} onChange={v=>setPO(u.id,'diamNeg45',v)} error={st.diamFail || overSpec(po.diamNeg45, specD)} /></td>
                  <td style={td}>
                    {st.diamFail ? <span title="Diameter out of tolerance" style={{ color:'#c62828' }}><AlertTriangle size={15}/></span>
                      : st.oos ? <span title="Out of square" style={{ color:'#e65100' }}><AlertTriangle size={15}/></span>
                      : st.done ? <Check size={15} style={{ color:'#2e7d32' }}/> : <span style={{ color:'#ccc' }}>—</span>}
                  </td>
                  <td style={td}>
                    <button onClick={() => handlePrintLabel(u.id)} title="Print label" style={{ background:'none', border:'1px solid #ddd', borderRadius:5, padding:'4px 6px', cursor:'pointer', color:'#37474f' }}><Printer size={13}/></button>
                  </td>
                  <td style={td}>
                    <div style={{ display:'flex', gap:4, alignItems:'center', justifyContent:'center' }}>
                      {moveTargets.length > 0 && (
                        <select defaultValue="" onChange={(e)=>{ const v=e.target.value; e.target.value=''; if(v) handleMoveUnit(u.id, v); }} title="Move this cylinder to another line" style={{ fontSize:'0.72rem', padding:'3px 4px', border:'1px solid #ddd', borderRadius:5, cursor:'pointer', maxWidth:92 }}>
                          <option value="">Move →</option>
                          {moveTargets.map(p => <option key={p.id} value={p.id}>Line #{p.partNumber}</option>)}
                        </select>
                      )}
                      <button onClick={() => handleDeleteUnit(u.id, u.unitId)} title="Delete this cylinder" style={{ background:'none', border:'1px solid #ffcdd2', borderRadius:5, padding:'4px 6px', cursor:'pointer', color:'#c62828' }}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ display:'flex', gap:8, padding:'10px 14px', borderTop:'1px solid #e0e0e0', alignItems:'center' }}>
        <button onClick={saveAll} disabled={saving} style={{ padding:'9px 16px', background:'#1565c0', color:'white', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <Check size={15}/> {saving ? 'Saving…' : 'Save all'}
        </button>
        <button onClick={handleAddUnit} style={{ padding:'9px 14px', background:'white', color:'#1565c0', border:'1px solid #1565c0', borderRadius:6, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          <Plus size={14}/> Add cylinder
        </button>
        <span style={{ fontSize:'0.74rem', color:'#999', marginLeft:'auto' }}>Out-of-square limit 3/16" · Diameter variance limit ±1/8"</span>
      </div>
    </div>
  );
}
