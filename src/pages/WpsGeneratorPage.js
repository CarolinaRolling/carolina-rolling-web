import React, { useState, useMemo, useEffect } from 'react';
import { getOperatorSignatures } from '../services/api';
import { renderWpsPdf } from '../services/api';

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtDate = (iso) => { if (!iso) return ''; const p = String(iso).split('-'); return p.length === 3 ? `${p[1]}/${p[2]}/${p[0]}` : iso; };

// Format a decimal-inch value as a readable fraction (nearest 1/16")
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const fmtInch = (v) => {
  const s = Math.round(v * 16); const whole = Math.floor(s / 16); let frac = s % 16;
  if (frac === 0) return `${whole}"`;
  const g = gcd(frac, 16); const num = frac / g, den = 16 / g;
  return whole > 0 ? `${whole}-${num}/${den}"` : `${num}/${den}"`;
};
// ASME IX QW-451.1 base-metal thickness range qualified for a groove-weld test coupon of thickness T (in.)
const calcThicknessRange = (couponIn) => {
  const T = parseFloat(couponIn) || 0;
  if (T <= 0) return '1/16" – 3/4"';
  const min = T <= 0.375 ? '1/16"' : '3/16"';
  const max = T >= 1.5 ? '8"' : fmtInch(2 * T);
  return `${min} – ${max}`;
};

// ---- Reference data -------------------------------------------------------
const METALS = {
  P1: {
    label: 'Carbon Steel — A36 / A516 Gr. 70',
    pNo: 'P-No. 1, Group 1 & 2',
    baseText: 'P1 Group 1 & 2 to P1 Group 1 & 2',
    filler: {
      stick: { cls: 'E7018', sfa: 'A5.1' },
      mig:   { cls: 'ER70S-6', sfa: 'A5.18' },
      tig:   { cls: 'ER70S-6', sfa: 'A5.18' },
    },
    gas: { mig: '75% Argon / 25% CO₂ (C25)', tig: '100% Argon' },
    preheatF: (t) => (t >= 0.375 ? 175 : 60),
  },
  P8_304: {
    label: 'Stainless — 304 / 304L',
    pNo: 'P-No. 8, Group 1',
    baseText: 'P8 Group 1 to P8 Group 1',
    filler: {
      stick: { cls: 'E308L-16', sfa: 'A5.4' },
      mig:   { cls: 'ER308L', sfa: 'A5.9' },
      tig:   { cls: 'ER308L', sfa: 'A5.9' },
    },
    gas: { mig: 'Tri-Mix (90% He / 7.5% Ar / 2.5% CO₂)', tig: '100% Argon' },
    preheatF: () => 60,
  },
  P8_316: {
    label: 'Stainless — 316 / 316L',
    pNo: 'P-No. 8, Group 1',
    baseText: 'P8 Group 1 to P8 Group 1',
    filler: {
      stick: { cls: 'E316L-16', sfa: 'A5.4' },
      mig:   { cls: 'ER316L', sfa: 'A5.9' },
      tig:   { cls: 'ER316L', sfa: 'A5.9' },
    },
    gas: { mig: 'Tri-Mix (90% He / 7.5% Ar / 2.5% CO₂)', tig: '100% Argon' },
    preheatF: () => 60,
  },
  AL_6061: {
    label: 'Aluminum — 6061',
    pNo: 'P-No. 23',
    baseText: '6061 (P-No. 23) to 6061 (P-No. 23)',
    isAluminum: true,
    filler: {
      stick: { cls: 'E4043', sfa: 'A5.3' },
      mig:   { cls: 'ER4043', sfa: 'A5.10' },
      tig:   { cls: 'ER4043', sfa: 'A5.10' },
    },
    gas: { mig: '100% Argon', tig: '100% Argon' },
    preheatF: () => 60,
  },
  AL_5052: {
    label: 'Aluminum — 5052',
    pNo: 'P-No. 22',
    baseText: '5052 (P-No. 22) to 5052 (P-No. 22)',
    isAluminum: true,
    filler: {
      stick: { cls: 'E4043', sfa: 'A5.3' },
      mig:   { cls: 'ER5356', sfa: 'A5.10' },
      tig:   { cls: 'ER5356', sfa: 'A5.10' },
    },
    gas: { mig: '100% Argon', tig: '100% Argon' },
    preheatF: () => 60,
  },
};
const METAL_CODE = { P1: 'P1', P8_304: 'P8', P8_316: 'P8', AL_6061: 'AL6061', AL_5052: 'AL5052' };

const PROCESSES = {
  stick: { name: 'SMAW (Stick)', code: 'STK', current: 'DCEP (Reverse)' },
  mig:   { name: 'GMAW (MIG)',   code: 'MIG', current: 'DCEP (Reverse)' },
  tig:   { name: 'GTAW (TIG)',   code: 'TIG', current: 'DCEN (Straight)' },
};

const TACK_NOTES =
`Operator to inspect job process form.
If seam gap requested, log and retrieve spacers from equipment room. Install spacers.
Check cylinder edge alignment. Align and fit the center of the cylinder.
Apply one fusion pass.
Use fitting equipment to adjust seam alignment and begin intermittent welds.
Seam must pass internal go gauge to specific diameter.
Seam must pass visual/feel test on external diameter.
Welds not to exceed 2".
Remove and return spacers.
Cylinder edge offset must not exceed .0625".`;

const FULL_NOTES =
`Confirm weld type = 100% full penetration and applicable code/spec per client (e.g., ASME Sec. VIII / IX).
Prepare joint: bevel edges [30°–37.5° incl.], root face [1/16"], root gap [1/16"–1/8"] as specified.
Clean joint + adjacent area to bright metal (stainless: stainless tools only, no carbon contamination).
Preheat per material/thickness. Cylinder edge offset must not exceed .0625".
Fit and align; tack per the tack WPS to hold alignment.
Root pass: full penetration; verify fusion.
Back gouge root (air carbon arc) to sound metal from opposite side; grind clean.
Fill passes: [stringer/weave]; interpass temp [carbon ≤ 500°F / stainless ≤ 350°F].
Cap pass: [flush / slightly convex]. Clean slag/spatter each pass.
Inspection: 100% visual + internal go-gauge to diameter; NDE [PT / MT / RT / UT] as client-specified.
Acceptance per [ASME Sec. VIII Div. 1 / client spec].`;

// Auto-calc filler size + amperage/voltage ranges from process + thickness (editable after)
function calcParams(process, thicknessIn) {
  const t = parseFloat(thicknessIn) || 0;
  if (process === 'stick') {
    return t <= 0.1875
      ? { size: '3/32"', amps: '70–110 A', volts: '22–26 V' }
      : { size: '1/8" – 3/16"', amps: '90–140 A', volts: '22–28 V' };
  }
  if (process === 'mig') {
    return t <= 0.1875
      ? { size: '.035"', amps: '120–160 A', volts: '18–20 V' }
      : { size: '.035"', amps: '150–220 A', volts: '20–24 V' };
  }
  // tig
  return t <= 0.1875
    ? { size: '1/16"', amps: '80–130 A', volts: 'Arc length controlled' }
    : { size: '3/32" – 1/8"', amps: '120–180 A', volts: 'Arc length controlled' };
}

export default function WpsGeneratorPage() {
  const [metal, setMetal] = useState('P1');
  const [process, setProcess] = useState('stick');
  const [weldType, setWeldType] = useState('tack'); // tack | full
  const [thickness, setThickness] = useState('0.375');
  const [rev, setRev] = useState('R0');
  const [revisionDate, setRevisionDate] = useState(todayIso());
  const [lastUpdatedDate, setLastUpdatedDate] = useState(todayIso());
  const [signDate, setSignDate] = useState(todayIso());
  const [preparedBy, setPreparedBy] = useState('Jason Thornton');
  const [sigs, setSigs] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getOperatorSignatures().then(r => {
      const list = r.data.data || [];
      setSigs(list);
      const jason = list.find(s => /jason/i.test(s.operatorName));
      if (jason) setPreparedBy(jason.operatorName);
      else if (list.length) setPreparedBy(list[0].operatorName);
    }).catch(() => {});
  }, []);
  const signerSig = (sigs.find(s => s.operatorName === preparedBy) || {}).signatureData || null;

  // Derived defaults
  const derived = useMemo(() => {
    const m = METALS[metal];
    const f = m.filler[process];
    const p = calcParams(process, thickness);
    return {
      pNo: m.pNo,
      baseText: m.baseText,
      thicknessRange: calcThicknessRange(thickness),
      fillerClass: f.cls,
      sfa: f.sfa,
      fillerSize: p.size,
      amps: p.amps,
      volts: p.volts,
      current: (m.isAluminum && process === 'tig') ? 'AC (Balanced — oxide cleaning)' : PROCESSES[process].current,
      gas: process === 'stick' ? 'N/A (Stick)' : (m.gas[process] || ''),
      preheat: m.preheatF(parseFloat(thickness) || 0) + '° F',
      position: 'G2 (Horizontal, Fixed Axis)',
      joint: 'Butt',
      bead: weldType === 'tack' ? 'Weave' : 'Stringer / Weave',
      passType: weldType === 'tack' ? 'Intermittent as Necessary (weld ≤ 2")' : 'Root + Fill + Cap',
      backGouge: weldType === 'tack' ? 'Air Carbon Arc as Necessary' : 'Air Carbon Arc — root, as required',
      procName: PROCESSES[process].name,
      notes: weldType === 'tack' ? TACK_NOTES : FULL_NOTES,
    };
  }, [metal, process, weldType, thickness]);

  // Editable overrides (blank = use derived)
  const [ov, setOv] = useState({});
  const field = (key) => (ov[key] !== undefined ? ov[key] : derived[key]);
  const setField = (key, val) => setOv(o => ({ ...o, [key]: val }));
  // Reset overrides when the selection changes so new defaults show
  const resetKey = `${metal}|${process}|${weldType}|${thickness}`;
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) { setLastKey(resetKey); setOv({}); }

  const wpsNumber = `WPS-${METAL_CODE[metal]}-${PROCESSES[process].code}-${weldType === 'tack' ? 'TACK' : 'FULL'}-G2-${rev}`;

  const generatePdf = async () => {
    const today = new Date().toLocaleDateString('en-US');
    const sigDateStr = fmtDate(signDate || todayIso());
    const sections = [
      { title: 'Base Materials', rows: [
        ['', field('baseText')],
        ['Thickness Range Qualified', field('thicknessRange')],
      ]},
      { title: 'Filler', rows: [
        ['Process', field('procName')],
        ['SFA Specification', field('sfa')],
        ['AWS Classification', field('fillerClass')],
        ['Size', field('fillerSize')],
        ...(process !== 'stick' ? [['Shielding Gas', field('gas')]] : []),
      ]},
      { title: 'Technique', rows: [
        ['Welding Position', field('position')],
        ['Bead Type', field('bead')],
        ['Joint Type', field('joint')],
        ['Back Gouging', field('backGouge')],
        ['Pass Type', field('passType')],
        ['Preheat', field('preheat')],
        ['Current', `${field('current')} — ${field('amps')}`],
        ['Voltage', field('volts')],
      ]},
    ];
    const sectionsHtml = sections.map(sec =>
      `<h2>${sec.title}</h2><table class="spec"><tbody>` +
      sec.rows.map(([k, v]) => `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`).join('') +
      `</tbody></table>`
    ).join('');
    const notesHtml = (field('notes') || '').split('\n').filter(l => l.trim()).map(l => `<li>${l}</li>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${wpsNumber}</title>
<style>
  @page { size: letter; margin: 0.5in; }
  @font-face { font-family: 'Yellowcake'; src: url('/fonts/Yellowcake-Regular.ttf') format('truetype'); }
  body { font-family: Arial, Helvetica, sans-serif; color: #333; font-size: 12px; padding: 4px 2px; }
  .company-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .company-left { display: flex; align-items: center; gap: 14px; }
  .logo { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; }
  .company-name { font-family: 'Yellowcake', cursive; font-size: 22px; color: #333; }
  .company-contact { font-size: 8.5px; color: #666; margin-top: 3px; }
  .doc-right { text-align: right; }
  .doc-title { font-size: 20px; font-weight: 700; color: #1976d2; }
  .doc-num { font-size: 13px; font-weight: 700; }
  .doc-date { font-size: 11px; color: #888; }
  hr { border: none; border-top: 1px solid #ccc; margin: 8px 0; }
  h2 { color: #1976d2; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 11px 0 5px; }
  table.spec { width: 100%; border-collapse: collapse; }
  table.spec td { padding: 3.5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  table.spec td.k { width: 38%; color: #666; font-weight: 600; }
  table.spec td.v { font-weight: 600; color: #222; }
  ol.notes { margin: 4px 0 0 18px; padding: 0; }
  ol.notes li { font-size: 10.5px; margin-bottom: 2.5px; line-height: 1.32; }
  .sig { margin-top: 26px; display: flex; justify-content: space-between; }
  .sig .col { width: 45%; }
  .sig .val { height: 40px; padding: 0 0 3px 8px; display: flex; align-items: flex-end; font-size: 12px; color: #222; }
  .sig .val img { height: 40px; }
  .sig .bar { border-top: 1px solid #333; }
  .sig .lbl { padding-top: 4px; font-size: 10px; color: #666; }
</style></head><body>
  <div class="company-header">
    <div class="company-left">
      <img src="/logo.png" class="logo" onerror="this.style.display='none'" />
      <div><div class="company-name">Carolina Rolling Co. Inc.</div>
      <div class="company-contact">9152 Sonrisa St., Bellflower, CA 90706 &nbsp;|&nbsp; (562) 633-1044 &nbsp;|&nbsp; keepitrolling@carolinarolling.com</div></div>
    </div>
    <div class="doc-right">
      <div class="doc-title">WELDING PROCEDURE SPEC.</div>
      <div class="doc-num">${wpsNumber}</div>
      <div class="doc-date">Rev Date: ${fmtDate(revisionDate)}</div>
      <div class="doc-date">Last Updated: ${fmtDate(lastUpdatedDate)}</div>
    </div>
  </div>
  <hr/>
  <div style="font-size:12px;margin-bottom:4px;"><strong>Process:</strong> ${field('procName')} &nbsp;&nbsp;&nbsp; <strong>Type:</strong> Manual &nbsp;&nbsp;&nbsp; <strong>Weld Type:</strong> ${weldType === 'tack' ? 'Tack Weld' : 'Full Penetration (100%)'}</div>
  ${sectionsHtml}
  <h2>Note</h2>
  <ol class="notes">${notesHtml}</ol>
  <div class="sig">
    <div class="col">
      <div class="val">${signerSig ? `<img src="${signerSig}" />` : ''}</div>
      <div class="bar"></div>
      <div class="lbl">Prepared / Updated by: ${preparedBy}</div>
    </div>
    <div class="col">
      <div class="val">${sigDateStr}</div>
      <div class="bar"></div>
      <div class="lbl">Date</div>
    </div>
  </div>
  <div style="margin-top:24px;text-align:center;font-size:9px;color:#999;">Printed on: ${today}</div>
</body></html>`;

    setBusy(true);
    try {
      const res = await renderWpsPdf(html, wpsNumber);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert('Could not generate the WPS PDF. ' + (e?.response?.data?.error?.message || e?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { width: '100%', padding: '7px 9px', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.85rem' };
  const labelStyle = { display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', color: '#888', fontWeight: 700, marginBottom: 3, letterSpacing: 0.4 };
  const cell = { marginBottom: 12 };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>WPS Generator</h1>
      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 20 }}>
        Pick the base metal, process, weld type, and thickness — the procedure fills in automatically. Every field is editable before you generate.
        <span style={{ color: '#b45309' }}> The welding values are starting points; confirm them against your qualified procedures.</span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: '#f7f9fb', padding: 16, borderRadius: 10, marginBottom: 20 }}>
        <div><label style={labelStyle}>Base Metal</label>
          <select style={inputStyle} value={metal} onChange={e => setMetal(e.target.value)}>
            {Object.entries(METALS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select></div>
        <div><label style={labelStyle}>Process</label>
          <select style={inputStyle} value={process} onChange={e => setProcess(e.target.value)}>
            {Object.entries(PROCESSES).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
          </select></div>
        <div><label style={labelStyle}>Weld Type</label>
          <select style={inputStyle} value={weldType} onChange={e => setWeldType(e.target.value)}>
            <option value="tack">Tack Weld</option>
            <option value="full">Full / 100%</option>
          </select></div>
        <div><label style={labelStyle}>Thickness (in)</label>
          <input style={inputStyle} type="number" step="0.001" value={thickness} onChange={e => setThickness(e.target.value)} /></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.05rem', color: '#1565c0' }}>{wpsNumber}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>Rev</span>
          <input style={{ ...inputStyle, width: 70 }} value={rev} onChange={e => setRev(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
        <div><label style={labelStyle}>Revision Date (prints by signature)</label>
          <input type="date" style={{ ...inputStyle, maxWidth: 200 }} value={revisionDate} onChange={e => setRevisionDate(e.target.value)} /></div>
        <div><label style={labelStyle}>Last Updated</label>
          <input type="date" style={{ ...inputStyle, maxWidth: 200 }} value={lastUpdatedDate} onChange={e => setLastUpdatedDate(e.target.value)} /></div>
        <div><label style={labelStyle}>Signature Date (auto — today)</label>
          <input type="date" style={{ ...inputStyle, maxWidth: 200 }} value={signDate} onChange={e => setSignDate(e.target.value)} /></div>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 8 }}>These two dates stay fixed on the document; the footer always shows today's "Printed on" date automatically.</div>

      {[
        { title: 'Base Materials', fields: [['baseText', 'Base Materials'], ['thicknessRange', 'Thickness Range Qualified']] },
        { title: 'Filler', fields: [['sfa', 'SFA Specification'], ['fillerClass', 'AWS Classification'], ['fillerSize', 'Size'], ['gas', 'Shielding Gas']] },
        { title: 'Technique', fields: [['position', 'Welding Position'], ['bead', 'Bead Type'], ['joint', 'Joint Type'], ['backGouge', 'Back Gouging'], ['passType', 'Pass Type'], ['preheat', 'Preheat'], ['current', 'Current / Polarity'], ['amps', 'Amperage'], ['volts', 'Voltage']] },
      ].map(sec => (
        <div key={sec.title}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1565c0', textTransform: 'uppercase', letterSpacing: 0.5, margin: '14px 0 8px', borderBottom: '1px solid #e0e0e0', paddingBottom: 4 }}>{sec.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {sec.fields.map(([k, lbl]) => (
              <div key={k} style={cell}><label style={labelStyle}>{lbl}</label>
                <input style={inputStyle} value={field(k)} onChange={e => setField(k, e.target.value)} /></div>
            ))}
          </div>
        </div>
      ))}

      <div style={cell}><label style={labelStyle}>Procedure Notes (one step per line)</label>
        <textarea style={{ ...inputStyle, minHeight: 200, fontFamily: 'inherit', lineHeight: 1.5 }}
          value={field('notes')} onChange={e => setField('notes', e.target.value)} /></div>

      <div style={cell}><label style={labelStyle}>Prepared / Updated by (signs the WPS)</label>
        {sigs.length ? (
          <select style={{ ...inputStyle, maxWidth: 340 }} value={preparedBy} onChange={e => setPreparedBy(e.target.value)}>
            {!sigs.find(s => s.operatorName === preparedBy) && <option value={preparedBy}>{preparedBy}</option>}
            {sigs.map(s => <option key={s.operatorName} value={s.operatorName}>{s.operatorName}{s.signatureData ? ' ✍️' : ' (no signature)'}</option>)}
          </select>
        ) : (
          <input style={{ ...inputStyle, maxWidth: 340 }} value={preparedBy} onChange={e => setPreparedBy(e.target.value)} />
        )}
        {signerSig
          ? <div style={{ fontSize: '0.72rem', color: '#2e7d32', marginTop: 4 }}>✍️ Digital signature will be applied and auto-dated on the PDF.</div>
          : <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: 4 }}>No saved signature for this name — set one in Admin → API Keys, or it prints a blank line.</div>}
      </div>

      <button onClick={generatePdf} disabled={busy}
        style={{ marginTop: 8, padding: '12px 28px', background: busy ? '#90a4ae' : '#1565c0', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: busy ? 'default' : 'pointer' }}>
        {busy ? 'Generating…' : '🖨️ Generate WPS PDF'}
      </button>
    </div>
  );
}
