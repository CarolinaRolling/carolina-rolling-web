import React, { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { getPressBrakeConfig } from '../services/api';

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
    setPartData(prev => {
      const next = { ...prev };
      if (data.thickness_in != null) next.thickness = String(data.thickness_in);
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
  }, [setPartData, suggestHandling]);

  const handleFiles = useCallback(async (fileList) => {
    if (!parserUrl || !fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const step = files.find(f => /\.(step|stp)$/i.test(f.name));
    const dxf = files.find(f => /\.dxf$/i.test(f.name));
    if (!step && !dxf) {
      setNote({ type: 'err', msg: 'Please choose a STEP (.step/.stp) and/or DXF (.dxf) file.' });
      return;
    }
    setBusy(true); setNote(null); setResult(null);
    try {
      const material = partData.material || 'steel';
      let data;
      if (step && dxf) {
        const fd = new FormData();
        fd.append('step', step); fd.append('dxf', dxf); fd.append('material', material);
        const r = await fetch(`${parserUrl}/analyze`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(await r.text());
        data = await r.json();
      } else if (dxf) {
        const fd = new FormData();
        fd.append('file', dxf);
        if (partData.thickness) fd.append('thickness_in', String(parseFloat(partData.thickness) || ''));
        fd.append('material', material);
        const r = await fetch(`${parserUrl}/analyze-dxf`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(await r.text());
        data = await r.json();
      } else {
        const fd = new FormData();
        fd.append('file', step);
        const r = await fetch(`${parserUrl}/analyze-step`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(await r.text());
        data = await r.json();
      }
      applyResult(data);
      setResult(data);
      if (data.cross_check && data.cross_check.bend_mismatch) {
        setNote({ type: 'warn', msg: `Heads up: STEP counted ${data.cross_check.step_bend_count} bends, DXF counted ${data.cross_check.dxf_bend_count}. Using DXF — verify.` });
      } else {
        setNote({ type: 'ok', msg: 'Values pre-filled from your file(s). Verify before saving.' });
      }
    } catch (e) {
      setNote({ type: 'err', msg: 'Couldn\'t parse the file(s). Enter values manually below.' });
      if (onError) onError('STEP/DXF parse failed');
    } finally {
      setBusy(false);
    }
  }, [parserUrl, partData.material, partData.thickness, applyResult, onError]);

  // Hidden while checking, or if the parser isn't reachable.
  if (reachable !== true) return null;

  return (
    <div style={{ border: '1px solid #c5e1a5', background: '#f1f8e9', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#33691e' }}>⚡ Auto-fill from CAD</span>
        <span style={{ fontSize: '0.72rem', color: '#689f38' }}>upload STEP + DXF (flat pattern)</span>
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '2px dashed #7cb342', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontSize: '0.85rem', color: '#558b2f', background: '#fff' }}>
        <Upload size={16} /> {busy ? 'Analyzing…' : 'Choose STEP and/or DXF…'}
        <input type="file" accept=".step,.stp,.dxf" multiple style={{ display: 'none' }}
          disabled={busy}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      </label>

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
