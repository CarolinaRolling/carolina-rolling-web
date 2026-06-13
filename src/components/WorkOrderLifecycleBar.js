import React, { useState, useCallback } from 'react';
import { FileText, Truck, PackageCheck, Receipt, DollarSign, Check, ExternalLink, Download } from 'lucide-react';
import { downloadEstimatePDF, downloadWorkOrderDocument, generateInvoicePDF, getWOPayments } from '../services/api';
import { formatDate } from '../utils/dates';

const money = (v) => `$${(parseFloat(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function openBlob(data, type = 'application/pdf') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/**
 * Lifecycle bar across the top of the DR page: Estimate → Inbound → Ship → Invoice → Payment.
 * Each enabled stage expands an inline panel (single-open). Disabled stages gray out.
 * Inbound is driven by the page's existing receiving panel via props.
 */
export default function WorkOrderLifecycleBar({
  order,
  shipment,
  inboundOpen,
  onToggleInbound,
  onLinkShipment,
  showMessage = () => {},
}) {
  const [openStage, setOpenStage] = useState(null);
  const [busy, setBusy] = useState(null);
  const [payments, setPayments] = useState(null);

  // --- stage availability ---
  const shippingDocs = (order.documents || []).filter((d) => d.documentType === 'shipping_doc');
  const hasShipped = !!order.shippedAt || (order.pickupHistory || []).length > 0;
  const hasEstimate = !!order.estimateId;
  const hasShipment = !!shipment;
  const hasShipStage = shippingDocs.length > 0 || hasShipped;
  const hasInvoice = !!order.invoiceNumber || (order.documents || []).some((d) => d.documentType === 'invoice');
  const canPayment = hasInvoice; // enable once invoiced, even if unpaid
  const isPaid = !!order.codPaid || !!order.paymentDate;

  const loadPayments = useCallback(async () => {
    try {
      const res = await getWOPayments(order.id);
      setPayments(res.data.data || res.data || []);
    } catch {
      setPayments([]);
    }
  }, [order.id]);

  const toggle = (stage) => {
    if (stage === 'inbound') {
      if (!hasShipment) { onLinkShipment(); return; }
      setOpenStage(null);
      onToggleInbound();
      return;
    }
    const next = openStage === stage ? null : stage;
    setOpenStage(next);
    if (next === 'payment' && payments === null) loadPayments();
  };

  const doEstimatePdf = async () => {
    if (!order.estimateId) return;
    setBusy('estimate');
    try { const res = await downloadEstimatePDF(order.estimateId); openBlob(res.data); }
    catch { showMessage('Could not open estimate PDF'); }
    finally { setBusy(null); }
  };

  const doInvoicePdf = async () => {
    setBusy('invoice');
    try { const res = await generateInvoicePDF(order.id); openBlob(res.data); }
    catch { showMessage('Could not generate invoice PDF'); }
    finally { setBusy(null); }
  };

  const doOpenDoc = async (docId) => {
    setBusy(docId);
    try { const res = await downloadWorkOrderDocument(order.id, docId); openBlob(res.data); }
    catch { showMessage('Could not open document'); }
    finally { setBusy(null); }
  };

  // --- stage definitions ---
  const STAGES = [
    { key: 'estimate', label: 'Estimate', icon: FileText,   enabled: hasEstimate, complete: hasEstimate, color: '#1565c0' },
    { key: 'inbound',  label: 'Inbound',  icon: Truck,       enabled: true,        complete: !!(shipment && shipment.receivedAt), color: '#2e7d32', linkable: !hasShipment },
    { key: 'ship',     label: 'Ship',     icon: PackageCheck, enabled: hasShipStage, complete: hasShipped, color: '#00838f' },
    { key: 'invoice',  label: 'Invoice',  icon: Receipt,     enabled: hasInvoice,  complete: hasInvoice, color: '#e65100' },
    { key: 'payment',  label: 'Payment',  icon: DollarSign,  enabled: canPayment,  complete: isPaid, color: '#6a1b9a' },
  ];

  const grandTotal = parseFloat(order.grandTotal) || 0;
  const paidTotal = (payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const outstanding = Math.max(grandTotal - paidTotal, 0);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Stepper row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {STAGES.map((s) => {
          const Icon = s.icon;
          const isActive = (s.key === 'inbound' && inboundOpen) || openStage === s.key;
          const disabled = !s.enabled;
          return (
            <button
              key={s.key}
              onClick={() => !disabled && toggle(s.key)}
              disabled={disabled}
              title={disabled ? `${s.label} — not reached yet` : s.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                border: `1px solid ${disabled ? '#e0e0e0' : s.color}`,
                background: disabled ? '#f5f5f5' : isActive ? s.color : 'white',
                color: disabled ? '#bbb' : isActive ? 'white' : s.color,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
              {s.label}
              {s.key === 'inbound' && s.linkable && !disabled && <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>+ link</span>}
              {s.complete && (
                <Check size={14} style={{ color: isActive ? 'white' : '#2e7d32' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Panels (Inbound uses the page's existing receiving panel below) */}
      {openStage === 'estimate' && (
        <Panel color="#1565c0">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>Estimate {order.estimateNumber || ''}</strong>
              {order.estimateTotal && <span style={{ color: '#666', marginLeft: 8 }}>{money(order.estimateTotal)}</span>}
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>PDF is generated from the current estimate (always up to date).</div>
            </div>
            <button onClick={doEstimatePdf} disabled={busy === 'estimate'} style={btn('#1565c0')}>
              <ExternalLink size={14} /> {busy === 'estimate' ? 'Opening…' : 'View / Download PDF'}
            </button>
          </div>
        </Panel>
      )}

      {openStage === 'ship' && (
        <Panel color="#00838f">
          {hasShipped && (
            <div style={{ fontSize: '0.82rem', color: '#00695c', marginBottom: shippingDocs.length ? 10 : 0 }}>
              Shipped {order.shippedAt ? formatDate(order.shippedAt) : (order.pickupHistory?.[0]?.date ? formatDate(order.pickupHistory[0].date) : '')}
              {order.pickedUpBy ? ` · ${order.pickedUpBy}` : ''}
            </div>
          )}
          {shippingDocs.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#888' }}>No shipping documents uploaded yet.</div>
          ) : shippingDocs.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: '0.85rem' }}>📄 {d.originalName || 'Shipping document'}</span>
              <button onClick={() => doOpenDoc(d.id)} disabled={busy === d.id} style={btn('#00838f')}>
                <Download size={14} /> {busy === d.id ? '…' : 'Open'}
              </button>
            </div>
          ))}
        </Panel>
      )}

      {openStage === 'invoice' && (
        <Panel color="#e65100">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>Invoice {order.invoiceNumber ? `#${order.invoiceNumber}` : ''}</strong>
              {order.invoiceDate && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>Invoiced {formatDate(order.invoiceDate)}</div>}
            </div>
            <button onClick={doInvoicePdf} disabled={busy === 'invoice'} style={btn('#e65100')}>
              <Download size={14} /> {busy === 'invoice' ? 'Generating…' : 'View / Download Invoice'}
            </button>
          </div>
        </Panel>
      )}

      {openStage === 'payment' && (
        <Panel color="#6a1b9a">
          {payments === null ? (
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Loading payments…</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
                <Stat label="Invoice Total" value={money(grandTotal)} />
                <Stat label="Paid" value={money(paidTotal)} color="#2e7d32" />
                <Stat label="Outstanding" value={money(outstanding)} color={outstanding > 0 ? '#c62828' : '#2e7d32'} />
              </div>
              {payments.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: outstanding > 0 ? '#c62828' : '#888' }}>
                  {outstanding > 0 ? 'No payments recorded yet — outstanding.' : 'No payments recorded.'}
                </div>
              ) : payments.map((p, i) => (
                <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.83rem' }}>
                  <span>{p.paymentDate || p.date ? formatDate(p.paymentDate || p.date) : ''} · {p.method || p.paymentMethod || 'Payment'}{p.reference || p.paymentReference ? ` (${p.reference || p.paymentReference})` : ''}</span>
                  <strong>{money(p.amount)}</strong>
                </div>
              ))}
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

function Panel({ color, children }) {
  return (
    <div className="card" style={{ marginTop: 10, borderLeft: `4px solid ${color}`, padding: 16 }}>
      {children}
    </div>
  );
}

function Stat({ label, value, color = '#333' }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function btn(color) {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    background: color, color: 'white', border: 'none', borderRadius: 6,
    padding: '7px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
  };
}
