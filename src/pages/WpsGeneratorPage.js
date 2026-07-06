import React, { useState, useMemo } from 'react';

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
};
const METAL_CODE = { P1: 'P1', P8_304: 'P8', P8_316: 'P8' };

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
  const [preparedBy, setPreparedBy] = useState('Jason Thornton');

  // Derived defaults
  const derived = useMemo(() => {
    const m = METALS[metal];
    const f = m.filler[process];
    const p = calcParams(process, thickness);
    return {
      pNo: m.pNo,
      baseText: m.baseText,
      fillerClass: f.cls,
      sfa: f.sfa,
      fillerSize: p.size,
      amps: p.amps,
      volts: p.volts,
      current: PROCESSES[process].current,
      gas: process === 'stick' ? 'N/A (Stick)' : (m.gas[process] || ''),
      preheat: m.preheatF(parseFloat(thickness) || 0) + '° F',
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

  const generatePdf = () => {
    const today = new Date().toLocaleDateString('en-US');
    const rows = [
      ['Process', PROCESSES[process].name + ' — Manual'],
      ['Weld Type', weldType === 'tack' ? 'Tack Weld' : 'Full Penetration (100%)'],
      ['Base Materials', `${field('baseText')}  (${field('pNo')})`],
      ['Material Thickness', `${thickness}"`],
      ['Welding Position', 'G2 (Horizontal, Fixed Axis)'],
      ['Filler — SFA Spec.', field('sfa')],
      ['Filler — AWS Class', field('fillerClass')],
      ['Filler Size', field('fillerSize')],
      ['Shielding Gas', field('gas')],
      ['Current / Polarity', field('current')],
      ['Amperage', field('amps')],
      ['Voltage', field('volts')],
      ['Preheat', field('preheat')],
      ['Joint Type', 'Butt'],
      ['Bead Type', weldType === 'tack' ? 'Intermittent (weld ≤ 2")' : 'Root + Fill + Cap'],
      ['Back Gouging', weldType === 'tack' ? 'As necessary' : 'Air Carbon Arc — root, as required'],
    ];
    const rowsHtml = rows.map(([k, v]) => `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`).join('');
    const notesHtml = (field('notes') || '').split('\n').filter(l => l.trim()).map(l => `<li>${l}</li>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${wpsNumber}</title>
<style>
  @page { size: letter; margin: 0.5in; }
  @font-face { font-family: 'Yellowcake'; src: url('/fonts/Yellowcake-Regular.ttf') format('truetype'); }
  body { font-family: Arial, Helvetica, sans-serif; color: #333; font-size: 12px; padding: 8px 4px; }
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
  h2 { color: #1976d2; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 6px; }
  table.spec { width: 100%; border-collapse: collapse; }
  table.spec td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  table.spec td.k { width: 38%; color: #666; font-weight: 600; }
  table.spec td.v { font-weight: 600; color: #222; }
  ol.notes { margin: 4px 0 0 18px; padding: 0; }
  ol.notes li { font-size: 11px; margin-bottom: 4px; line-height: 1.4; }
  .sig { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig .line { border-top: 1px solid #333; width: 45%; padding-top: 4px; font-size: 10px; color: #666; }
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
      <div class="doc-date">Date: ${today}</div>
    </div>
  </div>
  <hr/>
  <h2>Procedure Details</h2>
  <table class="spec"><tbody>${rowsHtml}</tbody></table>
  <h2>Procedure Notes</h2>
  <ol class="notes">${notesHtml}</ol>
  <div class="sig">
    <div class="line">Prepared / Updated by: ${preparedBy}</div>
    <div class="line">Date: ${today}</div>
  </div>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to generate the WPS.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          ['baseText', 'Base Materials'], ['pNo', 'P-Number'], ['sfa', 'Filler SFA Spec'],
          ['fillerClass', 'Filler AWS Class'], ['fillerSize', 'Filler Size'], ['current', 'Current / Polarity'],
          ['amps', 'Amperage'], ['volts', 'Voltage'], ['gas', 'Shielding Gas'],
          ['preheat', 'Preheat'],
        ].map(([k, lbl]) => (
          <div key={k} style={cell}><label style={labelStyle}>{lbl}</label>
            <input style={inputStyle} value={field(k)} onChange={e => setField(k, e.target.value)} /></div>
        ))}
      </div>

      <div style={cell}><label style={labelStyle}>Procedure Notes (one step per line)</label>
        <textarea style={{ ...inputStyle, minHeight: 200, fontFamily: 'inherit', lineHeight: 1.5 }}
          value={field('notes')} onChange={e => setField('notes', e.target.value)} /></div>

      <div style={cell}><label style={labelStyle}>Prepared / Updated by</label>
        <input style={{ ...inputStyle, maxWidth: 320 }} value={preparedBy} onChange={e => setPreparedBy(e.target.value)} /></div>

      <button onClick={generatePdf}
        style={{ marginTop: 8, padding: '12px 28px', background: '#1565c0', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
        🖨️ Generate WPS PDF
      </button>
    </div>
  );
}
