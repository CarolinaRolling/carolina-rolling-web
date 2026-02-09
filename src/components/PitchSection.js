import React, { useState, useEffect, useMemo } from 'react';

/**
 * Reusable Pitch / Helix section for any rolled part form.
 *
 * Props:
 *   partData, setPartData  — standard form state
 *   clDiameter             — centerline diameter of the roll (inches)
 *   profileOD              — OD / height of the cross-section (inches, for spacing calcs)
 *
 * Stores all values in partData._pitch* fields.
 * Also writes _pitchDevelopedDia so the parent form can reference it.
 */
export default function PitchSection({ partData, setPartData, clDiameter, inputDiameter, profileOD }) {
  // inputDiameter = raw user input (ID/OD/CL as entered) — used for developed diameter
  // clDiameter = centerline-adjusted — used for circumference & spacing calcs
  const devDia = inputDiameter || clDiameter; // fallback to CL if not provided
  const [enabled, setEnabled] = useState(!!(partData._pitchEnabled));
  const [method, setMethod] = useState(partData._pitchMethod || 'runrise');
  const [run, setRun] = useState(partData._pitchRun || '12');
  const [rise, setRise] = useState(partData._pitchRise || '');
  const [angle, setAngle] = useState(partData._pitchAngle || '');
  const [spaceType, setSpaceType] = useState(partData._pitchSpaceType || 'between');
  const [spaceValue, setSpaceValue] = useState(partData._pitchSpaceValue || '');
  const [direction, setDirection] = useState(partData._pitchDirection || 'clockwise');

  // Cross-convert between input methods & compute developed diameter
  const pitchCalc = useMemo(() => {
    if (!enabled) return null;
    const od = profileOD || 0;
    const circumference = clDiameter > 0 ? Math.PI * clDiameter : 0;

    let calcAngle = 0;
    let calcRun = parseFloat(run) || 12;
    let calcRise = 0;
    let risePerRev = 0;
    let spaceBetween = 0;
    let spaceCenter = 0;

    if (method === 'runrise') {
      calcRise = parseFloat(rise) || 0;
      if (calcRise > 0 && calcRun > 0) {
        calcAngle = Math.atan(calcRise / calcRun) * (180 / Math.PI);
      }
    } else if (method === 'degree') {
      calcAngle = parseFloat(angle) || 0;
      if (calcAngle > 0 && calcAngle < 90 && calcRun > 0) {
        calcRise = calcRun * Math.tan(calcAngle * (Math.PI / 180));
      }
    } else if (method === 'space') {
      const sv = parseFloat(spaceValue) || 0;
      if (sv > 0 && circumference > 0) {
        if (spaceType === 'center') {
          spaceCenter = sv;
          spaceBetween = sv - od;
          risePerRev = sv;
        } else {
          spaceBetween = sv;
          spaceCenter = sv + od;
          risePerRev = sv + od;
        }
        calcAngle = Math.atan(risePerRev / circumference) * (180 / Math.PI);
        calcRise = (risePerRev / circumference) * (calcRun > 0 ? calcRun : 12);
      }
    }

    // Compute rise per revolution from angle if not already set via space
    if (method !== 'space' && calcAngle > 0 && circumference > 0) {
      risePerRev = circumference * Math.tan(calcAngle * (Math.PI / 180));
      spaceCenter = risePerRev;
      spaceBetween = risePerRev - od;
    }

    if (calcAngle <= 0 && calcRise <= 0) return null;

    // Developed Diameter (from TI-83 program):
    //   √( ((π × D × rise) / (2 × run))² + D² )
    // D = raw input diameter — if user enters ID, developed is ID; OD stays OD
    let developedDia = 0;
    if (devDia > 0 && calcRise > 0 && calcRun > 0) {
      const h = (Math.PI * devDia * calcRise) / (2 * calcRun);
      developedDia = Math.sqrt(h * h + devDia * devDia);
    }

    return {
      angle: calcAngle, rise: calcRise, run: calcRun,
      risePerRev, spaceBetween, spaceCenter, circumference, od,
      developedDia, inputDia: devDia
    };
  }, [enabled, method, run, rise, angle, spaceType, spaceValue, clDiameter, devDia, profileOD]);

  // Sync to partData
  useEffect(() => {
    if (enabled) {
      setPartData(prev => ({
        ...prev,
        _pitchEnabled: true,
        _pitchMethod: method,
        _pitchRun: run,
        _pitchRise: rise,
        _pitchAngle: angle,
        _pitchSpaceType: spaceType,
        _pitchSpaceValue: spaceValue,
        _pitchDirection: direction,
        _pitchDevelopedDia: pitchCalc ? pitchCalc.developedDia : 0,
      }));
    } else {
      setPartData(prev => ({ ...prev, _pitchEnabled: false, _pitchDevelopedDia: 0 }));
    }
  }, [enabled, method, run, rise, angle, spaceType, spaceValue, direction, pitchCalc]);

  return (
    <div style={{
      marginTop: 16, padding: 14, borderRadius: 8,
      background: enabled ? '#fff8e1' : '#f9f9f9',
      border: `2px solid ${enabled ? '#ffc107' : '#e0e0e0'}`,
      transition: 'all 0.2s'
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
        <input type="checkbox" checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: '1rem' }}>🌀 Pitch / Helix (Spiral Staircase, Coil)</span>
      </label>

      {enabled && (
        <div style={{ marginTop: 14 }}>
          {/* Direction & Method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Direction (from ground floor)</label>
              <select className="form-select" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="clockwise">↻ Clockwise (going up)</option>
                <option value="counterclockwise">↺ Counter-Clockwise (going up)</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Input Method</label>
              <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="runrise">Run & Rise</option>
                <option value="degree">Degree of Angle</option>
                <option value="space">Spacing (Between / C-to-C)</option>
              </select>
            </div>
          </div>

          {/* Run & Rise */}
          {method === 'runrise' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Run (inches)</label>
                <input type="number" step="0.1" className="form-input" value={run}
                  onChange={(e) => setRun(e.target.value)} placeholder="12" />
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Horizontal distance (default 12")</div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Rise (inches)</label>
                <input type="number" step="0.01" className="form-input" value={rise}
                  onChange={(e) => setRise(e.target.value)} placeholder="Height at run point" />
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Vertical rise at the run distance</div>
              </div>
            </div>
          )}

          {/* Degree */}
          {method === 'degree' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Pitch Angle (degrees)</label>
              <input type="number" step="0.1" className="form-input" value={angle}
                onChange={(e) => setAngle(e.target.value)} placeholder="e.g. 5, 10, 15" />
              <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Angle of the helix from horizontal</div>
            </div>
          )}

          {/* Spacing */}
          {method === 'space' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Spacing Type</label>
                <select className="form-select" value={spaceType} onChange={(e) => setSpaceType(e.target.value)}>
                  <option value="between">Between (gap between profiles)</option>
                  <option value="center">Center-to-Center</option>
                </select>
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>
                  {spaceType === 'center'
                    ? 'Measured from CL of one revolution to the next (includes 1 OD)'
                    : 'Clear gap between bottom of upper profile and top of lower profile'}
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Spacing (inches)</label>
                <input type="number" step="0.01" className="form-input" value={spaceValue}
                  onChange={(e) => setSpaceValue(e.target.value)} placeholder="Rise per full revolution" />
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Rise over one full revolution</div>
              </div>
            </div>
          )}

          {/* Pitch Calculations */}
          {pitchCalc && (
            <div style={{ marginTop: 14, background: '#f3e5f5', borderRadius: 8, padding: 12, fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 600, color: '#6a1b9a', marginBottom: 8, fontSize: '0.85rem' }}>📐 Pitch Calculations</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Pitch Angle</div>
                  <div style={{ fontWeight: 600 }}>{pitchCalc.angle.toFixed(2)}°</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Run / Rise</div>
                  <div style={{ fontWeight: 600 }}>{pitchCalc.run}" / {pitchCalc.rise.toFixed(3)}"</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Rise per Revolution</div>
                  <div style={{ fontWeight: 600 }}>{pitchCalc.risePerRev > 0 ? pitchCalc.risePerRev.toFixed(3) + '"' : '—'}</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Between Spacing</div>
                  <div style={{ fontWeight: 600 }}>{pitchCalc.spaceBetween > 0 ? pitchCalc.spaceBetween.toFixed(3) + '"' : '—'}</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>Center-to-Center</div>
                  <div style={{ fontWeight: 600 }}>{pitchCalc.spaceCenter > 0 ? pitchCalc.spaceCenter.toFixed(3) + '"' : '—'}</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>CL Circumference</div>
                  <div style={{ fontWeight: 600 }}>{pitchCalc.circumference > 0 ? pitchCalc.circumference.toFixed(2) + '"' : 'Need Ø'}</div>
                </div>
              </div>

              {/* Developed Diameter - highlighted */}
              {pitchCalc.developedDia > 0 && (
                <div style={{ marginTop: 10, padding: 10, background: '#e8f5e9', borderRadius: 6, border: '1px solid #a5d6a7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#2e7d32', fontSize: '0.75rem', fontWeight: 600 }}>🎯 Developed (Pitch) Diameter</div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>Set rolls to this diameter</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#2e7d32' }}>
                      {pitchCalc.developedDia.toFixed(4)}"
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 4 }}>
                    Developed Radius: <strong>{(pitchCalc.developedDia / 2).toFixed(4)}"</strong>
                    {' '} | Floor Ø: {pitchCalc.inputDia.toFixed(2)}" → Pitch Ø: {pitchCalc.developedDia.toFixed(4)}" (+{(pitchCalc.developedDia - pitchCalc.inputDia).toFixed(4)}")
                  </div>
                </div>
              )}

              <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#666', borderTop: '1px solid #ddd', paddingTop: 6 }}>
                Direction: <strong>{direction === 'clockwise' ? '↻ Clockwise' : '↺ Counter-Clockwise'}</strong> (looking down, going up from ground floor)
                {pitchCalc.od > 0 && <span> | Profile: {pitchCalc.od}"</span>}
              </div>
            </div>
          )}

          {/* Warning if no diameter for space calcs */}
          {enabled && method === 'space' && clDiameter <= 0 && (
            <div style={{ marginTop: 8, background: '#fff3e0', padding: 8, borderRadius: 6, fontSize: '0.8rem', color: '#e65100' }}>
              ⚠️ Enter a roll diameter above to calculate spacing values (circumference needed for spacing method).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Helper: build pitch description lines for rolling descriptions.
 * Call from the parent form's rollingDescription useMemo.
 */
export function getPitchDescriptionLines(partData, clDiameter) {
  if (!partData._pitchEnabled) return [];
  const lines = [];
  lines.push(`Pitch: ${partData._pitchDirection === 'clockwise' ? 'CW' : 'CCW'} (from ground floor)`);
  if (partData._pitchMethod === 'runrise') {
    lines.push(`  Run: ${partData._pitchRun}" / Rise: ${partData._pitchRise}"`);
  } else if (partData._pitchMethod === 'degree') {
    lines.push(`  Pitch Angle: ${partData._pitchAngle}°`);
  } else if (partData._pitchMethod === 'space') {
    lines.push(`  ${partData._pitchSpaceType === 'center' ? 'Center-to-Center' : 'Between'} Spacing: ${partData._pitchSpaceValue}"`);
  }
  if (partData._pitchDevelopedDia > 0) {
    lines.push(`  → Developed Ø: ${partData._pitchDevelopedDia.toFixed(4)}" (set rolls to this)`);
  }
  return lines;
}
