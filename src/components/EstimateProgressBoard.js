import React, { useState } from 'react';
import { updateEstimate } from '../services/api';

/**
 * Horizontal progression "breadcrumb" for an estimate's internal prep workflow.
 *
 * Stages: created -> waiting_pricing -> pricing_received -> in_review -> ready_to_send
 * Stages up to and including the current one are lit; later stages are grayed out. Any office user
 * can click a stage to move the estimate to it (forward or back). Optionally compact for list rows.
 *
 * Props:
 *   estimateId   — the estimate to update
 *   stage        — current workflowStage value
 *   onChange     — optional (newStage) => void, called after a successful update
 *   compact      — smaller styling for list rows
 *   readOnly     — render without click-to-advance
 */
const STAGES = [
  { key: 'created',         label: 'Created' },
  { key: 'waiting_pricing', label: 'Waiting for Pricing' },
  { key: 'pricing_received', label: 'Pricing Received' },
  { key: 'in_review',       label: 'Sent for Review' },
  { key: 'ready_to_send',   label: 'Ready to Send' },
];

export default function EstimateProgressBoard({ estimateId, stage, onChange, compact = false, readOnly = false, quoteCount = 0 }) {
  const [current, setCurrent] = useState(stage || 'created');
  const [saving, setSaving] = useState(false);

  const currentIdx = Math.max(0, STAGES.findIndex(s => s.key === current));

  const setStage = async (key) => {
    if (readOnly || saving || key === current) return;
    const prev = current;
    setCurrent(key);         // optimistic
    setSaving(true);
    try {
      await updateEstimate(estimateId, { workflowStage: key });
      if (onChange) onChange(key);
    } catch (e) {
      setCurrent(prev);      // revert on failure
    } finally {
      setSaving(false);
    }
  };

  const dot = compact ? 12 : 14;
  const fontSize = compact ? '0.75rem' : '0.8rem';
  const gap = compact ? 7 : 9;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, flexWrap: 'wrap', opacity: saving ? 0.7 : 1 }}
      onClick={(e) => e.stopPropagation()}>
      {STAGES.map((s, i) => {
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <span style={{ width: compact ? 16 : 22, height: 2, background: reached ? '#43a047' : '#d0d0d0', flexShrink: 0 }} />
            )}
            <span
              onClick={() => setStage(s.key)}
              title={readOnly ? s.label : `Set to "${s.label}"`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: compact ? 3 : 5,
                cursor: readOnly ? 'default' : 'pointer',
                fontSize, fontWeight: isCurrent ? 700 : 500,
                color: reached ? (isCurrent ? '#2e7d32' : '#66a06a') : '#bbb',
                whiteSpace: 'nowrap',
              }}>
              <span style={{
                width: dot, height: dot, borderRadius: '50%',
                background: reached ? '#43a047' : '#e0e0e0',
                border: isCurrent ? '2px solid #2e7d32' : 'none',
                flexShrink: 0,
              }} />
              {s.label}
              {s.key === 'pricing_received' && reached && quoteCount > 0 && (
                <span style={{ marginLeft: 3, fontSize: compact ? '0.68rem' : '0.72rem', fontWeight: 700, color: '#00838f', background: '#e0f7fa', borderRadius: 8, padding: '0 6px' }}>
                  {quoteCount} quote{quoteCount === 1 ? '' : 's'}
                </span>
              )}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
