import React, { useState, useEffect } from 'react';
import { Plus, FileText, Printer, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getInspectionJobs, createInspectionJob, deleteInspectionJob,
  addInspectionUnit, saveInspectionUnit,
  getInspectionReportPdf, getInspectionLabelPdf,
} from '../services/api';

const TOLERANCE_OOS = 0.1875; // 3/16"
const TOLERANCE_DIAM = 0.125; // 1/8"
const UNIT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ── Measurement illustration SVGs ──
function PreRollDiagram() {
  return (
    <svg viewBox="0 0 320 180" style={{ width:'100%', maxWidth:320, border:'1px solid #e0e0e0', borderRadius:8, background:'#fafafa' }}>
      {/* Flat plate rectangle */}
      <rect x="40" y="40" width="240" height="100" fill="none" stroke="#1565c0" strokeWidth="2"/>
      {/* Width arrows */}
      <line x1="40" y1="28" x2="280" y2="28" stroke="#e65100" strokeWidth="1.5" markerEnd="url(#arrow)" markerStart="url(#arrow)"/>
      <text x="160" y="22" textAnchor="middle" fontSize="10" fill="#e65100">Width (both ends)</text>
      {/* Length arrows */}
      <line x1="295" y1="40" x2="295" y2="140" stroke="#2e7d32" strokeWidth="1.5"/>
      <text x="308" y="95" textAnchor="middle" fontSize="10" fill="#2e7d32" transform="rotate(90,308,95)">Length (both ends)</text>
      {/* Diagonal A */}
      <line x1="40" y1="40" x2="280" y2="140" stroke="#7b1fa2" strokeWidth="1.5" strokeDasharray="5,3"/>
      {/* Diagonal B */}
      <line x1="280" y1="40" x2="40" y2="140" stroke="#c62828" strokeWidth="1.5" strokeDasharray="5,3"/>
      <text x="160" y="100" textAnchor="middle" fontSize="9" fill="#7b1fa2">Diag A</text>
      <text x="160" y="115" textAnchor="middle" fontSize="9" fill="#c62828">Diag B</text>
      {/* Thickness label */}
      <text x="160" y="165" textAnchor="middle" fontSize="10" fill="#555">Measure thickness at center of plate</text>
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#e65100"/>
        </marker>
      </defs>
    </svg>
  );
}

function PostRollDiagram() {
  return (
    <svg viewBox="0 0 320 200" style={{ width:'100%', maxWidth:320, border:'1px solid #e0e0e0', borderRadius:8, background:'#fafafa' }}>
      {/* Cylinder end-on view (circle) */}
      <circle cx="160" cy="105" r="70" fill="none" stroke="#1565c0" strokeWidth="2"/>
      {/* Seam line (0°) */}
      <line x1="160" y1="35" x2="160" y2="55" stroke="#c62828" strokeWidth="2.5"/>
      <text x="160" y="30" textAnchor="middle" fontSize="10" fill="#c62828">Seam (0°)</text>
      {/* 45° mark */}
      <line x1="209" y1="56" x2="195" y2="70" stroke="#e65100" strokeWidth="2.5"/>
      <text x="220" y="52" textAnchor="start" fontSize="10" fill="#e65100">45°</text>
      {/* -45° mark */}
      <line x1="111" y1="56" x2="125" y2="70" stroke="#2e7d32" strokeWidth="2.5"/>
      <text x="68" y="52" textAnchor="middle" fontSize="10" fill="#2e7d32">-45°</text>
      {/* Diameter lines */}
      <line x1="90" y1="105" x2="230" y2="105" stroke="#555" strokeWidth="1" strokeDasharray="4,3"/>
      <text x="160" y="120" textAnchor="middle" fontSize="9" fill="#555">Measure diameter at each point</text>
      {/* Circumference arrow around bottom */}
      <path d="M 100 165 A 70 70 0 0 0 220 165" fill="none" stroke="#1565c0" strokeWidth="1.5" strokeDasharray="4,2"/>
      <text x="160" y="185" textAnchor="middle" fontSize="9" fill="#1565c0">Circumference (both ends)</text>
    </svg>
  );
}

// ── Single measurement field ──
function MeasField({ label, value, onChange, type='number', warn, error, placeholder, suffix='"' }) {
  return (
    <div style={{ marginBottom:8 }}>
      <label style={{ fontSize:'0.78rem', color:'#555', fontWeight:600, display:'block', marginBottom:2 }}>{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        {type === 'checkbox' ? (
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
            style={{ width:18, height:18, cursor:'pointer' }} />
        ) : (
          <input type="number" step="0.0001" value={value||''} onChange={e => onChange(e.target.value)}
            placeholder={placeholder||'0.0000'}
            style={{ width:'100%', padding:'6px 8px', border:`1px solid ${error?'#c62828':warn?'#e65100':'#ddd'}`, borderRadius:4, fontSize:'0.9rem', fontFamily:'monospace' }} />
        )}
        {type !== 'checkbox' && suffix && <span style={{ color:'#888', fontSize:'0.8rem' }}>{suffix}</span>}
        {warn && <AlertTriangle size={14} style={{ color:'#e65100', flexShrink:0 }} />}
        {error && <AlertTriangle size={14} style={{ color:'#c62828', flexShrink:0 }} />}
      </div>
    </div>
  );
}

// ── One cylinder tab ──
function CylinderTab({ unit, onSave, onPrintLabel }) {
  const [pr, setPr] = useState(unit.preRoll || {});
  const [po, setPo] = useState(unit.postRoll || {});
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState('preroll'); // preroll | postroll

  const oos = Math.abs((parseFloat(pr.diagA)||0) - (parseFloat(pr.diagB)||0));
  const oosWarn = oos > TOLERANCE_OOS;

  const diamVals = [parseFloat(po.diamSeam)||0, parseFloat(po.diam45)||0, parseFloat(po.diamNeg45)||0].filter(v=>v>0);
  const diamVar = diamVals.length >= 2 ? Math.max(...diamVals) - Math.min(...diamVals) : 0;
  const diamFail = diamVar > TOLERANCE_DIAM;

  const save = async () => {
    setSaving(true);
    try { await onSave(unit.id, { preRoll: pr, postRoll: po }); }
    finally { setSaving(false); }
  };

  const preRollDone = pr.thickness && pr.gradeConfirmed && pr.heatNumberConfirmed &&
    pr.widthEnd1 && pr.widthEnd2 && pr.lengthEnd1 && pr.lengthEnd2 && pr.diagA && pr.diagB;
  const postRollDone = po.circumEnd1 && po.circumEnd2 && po.diamSeam && po.diam45 && po.diamNeg45;

  return (
    <div>
      {/* Warnings */}
      {oosWarn && (
        <div style={{ background:'#fff3e0', border:'2px solid #e65100', borderRadius:8, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
          <AlertTriangle size={18} style={{ color:'#e65100', flexShrink:0 }} />
          <div>
            <div style={{ fontWeight:700, color:'#e65100' }}>⚠️ Out of Square — {oos.toFixed(4)}" (limit: 3/16")</div>
            <div style={{ fontSize:'0.82rem', color:'#555' }}>Confirm with client before proceeding to roll.</div>
          </div>
        </div>
      )}
      {diamFail && (
        <div style={{ background:'#ffebee', border:'2px solid #c62828', borderRadius:8, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
          <AlertTriangle size={18} style={{ color:'#c62828', flexShrink:0 }} />
          <div>
            <div style={{ fontWeight:700, color:'#c62828' }}>❌ Diameter Out of Tolerance — variance {diamVar.toFixed(4)}" (limit: ±1/8")</div>
            <div style={{ fontSize:'0.82rem', color:'#555' }}>Diameter measurements exceed acceptable tolerance.</div>
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid #e0e0e0', marginBottom:16 }}>
        {[
          { key:'preroll', label:'📐 Pre-Roll', done: preRollDone },
          { key:'postroll', label:'📏 Post-Roll', done: postRollDone },
          { key:'diagrams', label:'📊 Diagrams' },
        ].map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            style={{ padding:'8px 16px', border:'none', cursor:'pointer', fontSize:'0.85rem', fontWeight:section===s.key?700:400,
              background:'transparent', color:section===s.key?'#1565c0':'#555',
              borderBottom:section===s.key?'2px solid #1565c0':'2px solid transparent' }}>
            {s.label} {s.done !== undefined && (s.done ? ' ✓' : '')}
          </button>
        ))}
      </div>

      {section === 'preroll' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <MeasField label="Thickness" value={pr.thickness} onChange={v => setPr({...pr, thickness:v})} />
            <MeasField label="Grade Confirmed" value={pr.gradeConfirmed} onChange={v => setPr({...pr, gradeConfirmed:v})} type="checkbox" />
            <MeasField label="Heat Number Confirmed" value={pr.heatNumberConfirmed} onChange={v => setPr({...pr, heatNumberConfirmed:v})} type="checkbox" />
            <MeasField label="Width — End 1" value={pr.widthEnd1} onChange={v => setPr({...pr, widthEnd1:v})} />
            <MeasField label="Width — End 2" value={pr.widthEnd2} onChange={v => setPr({...pr, widthEnd2:v})} />
          </div>
          <div>
            <MeasField label="Length — End 1" value={pr.lengthEnd1} onChange={v => setPr({...pr, lengthEnd1:v})} />
            <MeasField label="Length — End 2" value={pr.lengthEnd2} onChange={v => setPr({...pr, lengthEnd2:v})} />
            <MeasField label="Diagonal A" value={pr.diagA} onChange={v => setPr({...pr, diagA:v})} warn={oosWarn} />
            <MeasField label="Diagonal B" value={pr.diagB} onChange={v => setPr({...pr, diagB:v})} warn={oosWarn} />
            {oosWarn && (
              <div>
                <label style={{ fontSize:'0.78rem', color:'#555', fontWeight:600, display:'block', marginBottom:2 }}>Client Approval Note</label>
                <textarea rows={2} value={pr.clientNote||''} onChange={e => setPr({...pr, clientNote:e.target.value})}
                  placeholder="e.g. Client approved to proceed..."
                  style={{ width:'100%', padding:'6px 8px', border:'1px solid #e65100', borderRadius:4, fontSize:'0.82rem', resize:'vertical' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'postroll' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <MeasField label="Circumference — End 1" value={po.circumEnd1} onChange={v => setPo({...po, circumEnd1:v})} />
            <MeasField label="Circumference — End 2" value={po.circumEnd2} onChange={v => setPo({...po, circumEnd2:v})} />
            <MeasField label="Diameter at Seam (0°)" value={po.diamSeam} onChange={v => setPo({...po, diamSeam:v})} error={diamFail} />
          </div>
          <div>
            <MeasField label="Diameter at 45°" value={po.diam45} onChange={v => setPo({...po, diam45:v})} error={diamFail} />
            <MeasField label="Diameter at -45°" value={po.diamNeg45} onChange={v => setPo({...po, diamNeg45:v})} error={diamFail} />
            {diamVals.length >= 2 && (
              <div style={{ background:diamFail?'#ffebee':'#e8f5e9', border:`1px solid ${diamFail?'#ef9a9a':'#a5d6a7'}`, borderRadius:6, padding:'8px 12px', marginTop:8 }}>
                <div style={{ fontSize:'0.8rem', fontWeight:700, color:diamFail?'#c62828':'#2e7d32' }}>
                  Diameter variance: {diamVar.toFixed(4)}" {diamFail ? '❌ EXCEEDS ±1/8"' : '✓ Within tolerance'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'diagrams' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div style={{ fontWeight:600, fontSize:'0.85rem', color:'#333', marginBottom:8 }}>Pre-Roll Measurements</div>
            <PreRollDiagram />
          </div>
          <div>
            <div style={{ fontWeight:600, fontSize:'0.85rem', color:'#333', marginBottom:8 }}>Post-Roll Measurements</div>
            <PostRollDiagram />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:'flex', gap:8, marginTop:16, paddingTop:12, borderTop:'1px solid #e0e0e0' }}>
        <button onClick={save} disabled={saving}
          style={{ flex:1, padding:'10px', background:'#1565c0', color:'white', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <Check size={16} /> {saving ? 'Saving...' : 'Save Measurements'}
        </button>
        <button onClick={() => onPrintLabel(unit.id)}
          style={{ padding:'10px 14px', background:'#37474f', color:'white', border:'none', borderRadius:6, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <Printer size={15} /> Print Label
        </button>
      </div>
    </div>
  );
}

// ── Main InspectionPanel ──
export default function InspectionPanel({ order, inspectionPart, linkedPartId }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeUnit, setActiveUnit] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (order?.id) loadJob();
  }, [order?.id, inspectionPart?.id]);

  const loadJob = async () => {
    setLoading(true);
    try {
      const r = await getInspectionJobs(order.id);
      const jobs = r.data.data || [];
      // Find job linked to this inspection part
      const found = jobs.find(j => j.inspectionPartId === inspectionPart?.id || j.workOrderPartId === linkedPartId);
      if (found) {
        setJob(found);
      } else {
        // Auto-create job when inspection part is present
        const partQty = inspectionPart?.quantity || 1;
        const create = await createInspectionJob({
          workOrderId: order.id,
          workOrderPartId: linkedPartId,
          inspectionPartId: inspectionPart?.id,
          unitCount: partQty,
        });
        setJob(create.data.data);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSaveUnit = async (unitId, data) => {
    await saveInspectionUnit(unitId, data);
    await loadJob();
  };

  const handlePrintLabel = async (unitId) => {
    try {
      const r = await getInspectionLabelPdf(unitId);
      const blob = new Blob([r.data], { type:'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch(e) { alert('Label print failed'); }
  };

  const handleAddUnit = async () => {
    if (!job) return;
    await addInspectionUnit(job.id);
    await loadJob();
    setActiveUnit((job.units?.length) || 0);
  };

  const handleReport = async () => {
    if (!job) return;
    setReportLoading(true);
    try {
      const r = await getInspectionReportPdf(job.id);
      const blob = new Blob([r.data], { type:'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch(e) { alert('Report generation failed'); }
    finally { setReportLoading(false); }
  };

  if (loading) return <div style={{ padding:20, textAlign:'center', color:'#888' }}>Loading inspection data...</div>;
  if (!job) return null;

  const units = job.units || [];
  const completedCount = units.filter(u => u.preRollComplete && u.postRollComplete).length;
  const allComplete = completedCount === units.length && units.length > 0;

  return (
    <div style={{ background:'white', borderRadius:10, border:'2px solid #1565c0', overflow:'hidden', marginTop:12 }}>
      {/* Header */}
      <div style={{ background:'#1565c0', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>
            🔬 Cylinder Inspection
          </div>
          <div style={{ color:'rgba(255,255,255,0.8)', fontSize:'0.8rem' }}>
            {completedCount}/{units.length} complete
            {allComplete && ' — ✓ All cylinders done'}
          </div>
        </div>
        <button onClick={handleReport} disabled={reportLoading}
          style={{ padding:'8px 14px', background:allComplete?'white':'rgba(255,255,255,0.2)', color:allComplete?'#1565c0':'white',
            border:`1px solid ${allComplete?'white':'rgba(255,255,255,0.4)'}`, borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'0.85rem',
            display:'flex', alignItems:'center', gap:6 }}>
          <FileText size={15} /> {reportLoading ? 'Generating...' : 'Inspection Report'}
        </button>
      </div>

      {/* Cylinder tabs */}
      <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid #e0e0e0', overflowX:'auto', background:'#f5f5f5' }}>
        {units.map((u, idx) => {
          const done = u.preRollComplete && u.postRollComplete;
          const pr = u.preRoll || {};
          const po = u.postRoll || {};
          const oosWarn = Math.abs((parseFloat(pr.diagA)||0)-(parseFloat(pr.diagB)||0)) > TOLERANCE_OOS;
          const diamVals = [parseFloat(po.diamSeam)||0,parseFloat(po.diam45)||0,parseFloat(po.diamNeg45)||0].filter(v=>v>0);
          const diamFail = diamVals.length>=2 && (Math.max(...diamVals)-Math.min(...diamVals)) > TOLERANCE_DIAM;
          return (
            <button key={u.id} onClick={() => setActiveUnit(idx)}
              style={{ padding:'10px 16px', border:'none', cursor:'pointer', whiteSpace:'nowrap', fontSize:'0.85rem', fontWeight:activeUnit===idx?700:400,
                background:activeUnit===idx?'white':'transparent',
                color:diamFail?'#c62828':oosWarn?'#e65100':activeUnit===idx?'#1565c0':'#555',
                borderBottom:activeUnit===idx?'2px solid #1565c0':'2px solid transparent',
                display:'flex', alignItems:'center', gap:5 }}>
              {done ? <Check size={13} style={{ color:'#2e7d32' }} /> : (oosWarn || diamFail) ? <AlertTriangle size={13} /> : null}
              {UNIT_LETTERS[idx]}
            </button>
          );
        })}
        <button onClick={handleAddUnit}
          style={{ padding:'10px 12px', border:'none', cursor:'pointer', background:'transparent', color:'#1565c0', display:'flex', alignItems:'center', gap:4, fontSize:'0.85rem', whiteSpace:'nowrap' }}>
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Active cylinder form */}
      {units[activeUnit] && (
        <div style={{ padding:16 }}>
          <div style={{ fontSize:'0.8rem', color:'#888', marginBottom:12 }}>
            Cylinder ID: <strong style={{ color:'#1565c0', fontFamily:'monospace', fontSize:'0.95rem' }}>{units[activeUnit].unitId}</strong>
          </div>
          <CylinderTab
            key={units[activeUnit].id}
            unit={units[activeUnit]}
            onSave={handleSaveUnit}
            onPrintLabel={handlePrintLabel}
          />
        </div>
      )}
    </div>
  );
}
