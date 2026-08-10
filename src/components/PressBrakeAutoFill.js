import React, { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { getPressBrakeConfig } from '../services/api';

// Standard stock thicknesses (label -> decimal inches). Matches the form's thickness dropdown so
// a snapped value selects cleanly instead of landing as a "Custom" decimal.
const STOCK_THICKNESS = [
  ['24 ga', 0.0239], ['20 ga', 0.0359], ['16 ga', 0.0598], ['14 ga', 0.0747],
  ['12 ga', 0.1046], ['11 ga', 0.1196], ['10 ga', 0.1345],
  ['1/8"', 0.125], ['3/16"', 0.1875], ['1/4"', 0.25], ['5/16"', 0.3125],
  ['3/8"', 0.375], ['1/2"', 0.5], ['5/8"', 0.625], ['3/4"', 0.75], ['7/8"', 0.875],
  ['1"', 1.0], ['1-1/4"', 1.25], ['1-1/2"', 1.5], ['2"', 2.0],
];

// Snap a measured thickness (decimal in) to the nearest stock value, IF it's within tolerance.
// Real sheet measures slightly off nominal (e.g. 14 ga is 0.0747 but a part may read 0.0768), so
// we snap when close. If it's not near any stock size (a genuinely custom thickness), return null
// and let the raw value stand as Custom.
function snapThickness(decimalIn) {
  const v = Number(decimalIn);
  if (!v || v <= 0) return null;
  let best = null, bestDiff = Infinity;
  for (const [label, dec] of STOCK_THICKNESS) {
    const diff = Math.abs(dec - v);
    if (diff < bestDiff) { bestDiff = diff; best = { label, dec }; }
  }
  if (!best) return null;
  // Tolerance: within 10% of the stock value, or 0.006" absolute (covers gauge measurement spread),
  // whichever is larger. Keeps 0.0768->14ga but won't force a truly odd thickness onto a stock size.
  const tol = Math.max(best.dec * 0.10, 0.006);
  return bestDiff <= tol ? best.label : null;
}

/**
 * Auto-fill control for the press-brake form.
 *
 * On mount it health-checks the NAS parser. If reachable, it shows an upload control that takes a
 * STEP and/or DXF file, calls the parser, and pre-fills thickness / size / bend count / weight and
 * a suggested handling class. If the parser is NOT reachable (remote without VPN, NAS down), the
 * control hides itself entirely and the estimator just types values manually — the parser is a
 * convenience, never a requirement.
 *
 * Props:
 *   partData, setPartData  — the shared part form state (we pre-fill into it)
 *   onError                — optional error reporter
 */
export default function PressBrakeAutoFill({ partData, setPartData, onError }) {
  const [config, setConfig] = useState(null);
  const [reachable, setReachable] = useState(null);   // null=checking, true/false=known
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);          // last parse summary
  const [note, setNote] = useState(null);
  const [slots, setSlots] = useState({ step: null, bend_dxf: null, cut_dxf: null });

  const parserUrl = config?.parserUrl && String(config.parserUrl).trim()
    ? config.parserUrl.replace(/\/+$/, '')
    : null;

  // Load config (has the parser URL + handling thresholds).
  useEffect(() => {
    let cancelled = false;
    getPressBrakeConfig()
      .then(res => { if (!cancelled) setConfig(res.data?.data || null); })
      .catch(() => { if (!cancelled) setConfig(null); });
    return () => { cancelled = true; };
  }, []);

  // Health-check the parser once we know the URL.
  useEffect(() => {
    if (config === null) return;         // still loading config
    if (!parserUrl) { setReachable(false); return; }
    let cancelled = false;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    fetch(`${parserUrl}/health`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if (!cancelled) setReachable(!!j.ok); })
      .catch(() => { if (!cancelled) setReachable(false); })
      .finally(() => clearTimeout(t));
    return () => { cancelled = true; ctrl.abort(); clearTimeout(t); };
  }, [config, parserUrl]);

  // Suggest a handling class from weight + longest flat dimension against configured thresholds.
  const suggestHandling = useCallback((weightLb, sizeIn) => {
    const th = config?.handlingThresholds;
    if (!th) return null;
    const one = th['one-operator'];
    const two = th['two-person'];
    const w = Number(weightLb) || 0;
    const s = Number(sizeIn) || 0;
    if (one && w <= one.maxWeightLb && s <= one.maxSizeIn) return 'one-operator';
    if (two && w <= two.maxWeightLb && s <= two.maxSizeIn) return 'two-person';
    return 'two-person-crane';
  }, [config]);

  const applyResult = useCallback((data) => {
    let snappedLabel = null;
    setPartData(prev => {
      const next = { ...prev };
      if (data.thickness_in != null) {
        const snap = snapThickness(data.thickness_in);
        if (snap) { next.thickness = snap; snappedLabel = snap; }
        else { next.thickness = String(data.thickness_in); }
      }
      if (data.flat_length_in != null) next.length = `${data.flat_length_in}"`;
      if (data.flat_width_in != null) next.width = String(data.flat_width_in);
      if (data.bend_count != null) next.bendCount = data.bend_count;
      if (data.weight_lb != null) next._parsedWeightLb = data.weight_lb;
      // suggest handling from weight + longest flat dim
      const longest = Math.max(Number(data.flat_length_in) || 0, Number(data.flat_width_in) || 0);
      const suggested = suggestHandling(data.weight_lb, longest);
      if (suggested && !prev.handlingClass) next.handlingClass = suggested;
      return next;
    });
    return snappedLabel;
  }, [setPartData, suggestHandling]);

  // Parse using the bend-line DXF (has the BEND layer the parser needs) plus the STEP if given.
  const runParse = useCallback(async (stepFile, bendDxfFile) => {
    if (!parserUrl) return;
    if (!stepFile && !bendDxfFile) return;
    setBusy(true); setNote(null); setResult(null);
    try {
      const material = partData.material || 'steel';
      let data;
      if (stepFile && bendDxfFile) {
        const fd = new FormData();
        fd.append('step', stepFile); fd.append('dxf', bendDxfFile); fd.append('material', material);
        const r = await fetch(`${parserUrl}/analyze`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(await r.text());
        data = await r.json();
      } else if (bendDxfFile) {
        const fd = new FormData();
        fd.append('file', bendDxfFile);
        if (partData.thickness) fd.append('thickness_in', String(parseFloat(partData.thickness) || ''));
        fd.append('material', material);
        const r = await fetch(`${parserUrl}/analyze-dxf`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(await r.text());
        data = await r.json();
      } else {
        const fd = new FormData();
        fd.append('file', stepFile);
        const r = await fetch(`${parserUrl}/analyze-step`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(await r.text());
        data = await r.json();
      }
      const snapped = applyResult(data);
      setResult(data);
      if (data.cross_check && data.cross_check.bend_mismatch) {
        setNote({ type: 'warn', msg: `Heads up: STEP counted ${data.cross_check.step_bend_count} bends, DXF counted ${data.cross_check.dxf_bend_count}. Using DXF — verify.` });
      } else if (snapped && data.thickness_in != null && Math.abs(Number(data.thickness_in) - ({'24 ga':0.0239,'20 ga':0.0359,'16 ga':0.0598,'14 ga':0.0747,'12 ga':0.1046,'11 ga':0.1196,'10 ga':0.1345}[snapped] ?? Number(data.thickness_in))) > 0.0005) {
        setNote({ type: 'ok', msg: `Values pre-filled. Measured ${data.thickness_in}" → snapped to ${snapped}. Verify before saving.` });
      } else {
        setNote({ type: 'ok', msg: 'Values pre-filled. Verify before saving.' });
      }
    } catch (e) {
      setNote({ type: 'err', msg: 'Couldn\'t parse the file(s). Enter values manually below.' });
      if (onError) onError('STEP/DXF parse failed');
    } finally {
      setBusy(false);
    }
  }, [parserUrl, partData.material, partData.thickness, applyResult, onError]);

  // Handle a file dropped into a specific role slot. Roles:
  //   'step'      -> STEP model (attached as step_file, for operators)
  //   'bend_dxf'  -> DXF WITH bend lines (parsed + attached for the press; NEVER shared to cut vendor)
  //   'cut_dxf'   -> clean DXF WITHOUT bend lines (attached as cut_file, the ONLY file the vendor sees)
  const handleSlot = useCallback((role, file) => {
    if (!file) return;
    const nextSlots = { ...slots, [role]: file };
    setSlots(nextSlots);
    // Push the three files (with their roles) into partData so the save flow attaches them.
    const cadFiles = [];
    if (nextSlots.step)     cadFiles.push({ file: nextSlots.step, role: 'step' });
    if (nextSlots.bend_dxf) cadFiles.push({ file: nextSlots.bend_dxf, role: 'bend_dxf' });
    if (nextSlots.cut_dxf)  cadFiles.push({ file: nextSlots.cut_dxf, role: 'cut_dxf' });
    setPartData(prev => ({
      ...prev,
      _cadFiles: cadFiles,
      _cad_step_name: nextSlots.step?.name || null,
      _cad_bend_dxf_name: nextSlots.bend_dxf?.name || null,
      _cad_cut_dxf_name: nextSlots.cut_dxf?.name || null,
    }));
    // Re-parse when a parsing-relevant file changes (STEP or the bend DXF).
    if (role === 'step' || role === 'bend_dxf') {
      runParse(nextSlots.step, nextSlots.bend_dxf);
    }
  }, [slots, setPartData, runParse]);

  // Hidden while checking, or if the parser isn't reachable.
  if (reachable !== true) return null;

  const slotName = (role) => partData[`_cad_${role}_name`];
  const Slot = ({ role, label, hint, accept }) => (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '2px dashed #7cb342', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontSize: '0.8rem', color: '#558b2f', background: '#fff' }}>
        <Upload size={15} /> {slotName(role) ? `Replace ${label}…` : `${label}…`}
        <input type="file" accept={accept} style={{ display: 'none' }} disabled={busy}
          onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) handleSlot(role, f); }} />
      </label>
      <div style={{ fontSize: '0.68rem', color: '#7a9a5a', marginTop: 2 }}>{hint}</div>
      {slotName(role) && <div style={{ fontSize: '0.72rem', color: '#2e7d32', marginTop: 2, fontWeight: 600 }}>📎 {slotName(role)}</div>}
    </div>
  );

  return (
    <div style={{ border: '1px solid #c5e1a5', background: '#f1f8e9', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#33691e' }}>⚡ Auto-fill from CAD</span>
        <span style={{ fontSize: '0.72rem', color: '#689f38' }}>upload the part files by role</span>
      </div>

      <Slot role="step" label="STEP model" accept=".step,.stp"
        hint="3D model — for operators to view the part." />
      <Slot role="bend_dxf" label="DXF with bend lines" accept=".dxf"
        hint="Flat pattern WITH bend lines — used to read bends/size and for the press. Not sent to the cut vendor." />
      <Slot role="cut_dxf" label="DXF clean cut file" accept=".dxf"
        hint="Flat pattern WITHOUT bend lines — the ONLY file shared to the cut vendor." />

      {busy && <div style={{ fontSize: '0.75rem', color: '#558b2f', marginTop: 4 }}>Analyzing…</div>}

      {result && (
        <div style={{ fontSize: '0.75rem', color: '#33691e', marginTop: 8, lineHeight: 1.6 }}>
          {result.thickness_in != null && <>Thickness <b>{result.thickness_in}"</b> · </>}
          {result.bend_count != null && <>Bends <b>{result.bend_count}</b> · </>}
          {result.flat_length_in != null && <>Flat <b>{result.flat_length_in} × {result.flat_width_in}"</b> · </>}
          {result.weight_lb != null && <>Weight <b>{result.weight_lb} lb</b></>}
        </div>
      )}
      {note && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', marginTop: 8,
          color: note.type === 'err' ? '#c62828' : note.type === 'warn' ? '#e65100' : '#2e7d32' }}>
          {note.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {note.msg}
        </div>
      )}
    </div>
  );
}
