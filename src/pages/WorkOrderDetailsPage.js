import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Save, X, Trash2, Plus, Package, FileText, User, 
  Calendar, Printer, Check, Upload, Eye, Tag, Truck, MapPin, Clock
} from 'lucide-react';
import { 
  getWorkOrderById, updateWorkOrder, deleteWorkOrder,
  addWorkOrderPart, updateWorkOrderPart, deleteWorkOrderPart,
  uploadPartFiles, getPartFileSignedUrl, deletePartFile,
  getShipmentByWorkOrderId
} from '../services/api';

const PART_TYPES = {
  plate_roll: { label: 'Plate Roll', fields: ['material', 'thickness', 'width', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  section_roll: { label: 'Section Roll', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  angle_roll: { label: 'Angle Roll', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  beam_roll: { label: 'Beam Roll', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  pipe_roll: { label: 'Pipe/Tube Roll', fields: ['material', 'outerDiameter', 'wallThickness', 'length', 'radius', 'diameter', 'arcDegrees'] },
  channel_roll: { label: 'Channel Roll', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  flat_bar: { label: 'Flat Bar', fields: ['material', 'thickness', 'width', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  other: { label: 'Other', fields: ['material', 'thickness', 'width', 'length', 'sectionSize', 'outerDiameter', 'wallThickness', 'rollType', 'radius', 'diameter', 'arcDegrees'] }
};

function WorkOrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showReceivingInfo, setShowReceivingInfo] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showPartModal, setShowPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partData, setPartData] = useState({});
  const [selectedPartType, setSelectedPartType] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupData, setPickupData] = useState({ pickedUpBy: '' });
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const fileInputRefs = useRef({});

  useEffect(() => { loadOrder(); }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const response = await getWorkOrderById(id);
      const data = response.data.data;
      setOrder(data);
      setEditData({
        clientName: data.clientName || '',
        clientPurchaseOrderNumber: data.clientPurchaseOrderNumber || '',
        jobNumber: data.jobNumber || '',
        contactName: data.contactName || '',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        storageLocation: data.storageLocation || '',
        notes: data.notes || '',
        receivedBy: data.receivedBy || '',
        requestedDueDate: data.requestedDueDate || '',
        promisedDate: data.promisedDate || '',
      });

      // Load linked shipment
      try {
        const shipmentResponse = await getShipmentByWorkOrderId(data.id);
        setShipment(shipmentResponse.data.data);
      } catch (shipErr) {
        setShipment(null);
      }
    } catch (err) {
      setError('Failed to load work order');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrder = async () => {
    try {
      setSaving(true);
      await updateWorkOrder(id, editData);
      await loadOrder();
      setIsEditing(false);
      showMessage('Work order updated');
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this work order?')) return;
    try {
      await deleteWorkOrder(id);
      navigate('/inventory');
    } catch (err) {
      setError('Failed to delete');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateWorkOrder(id, { status: newStatus });
      await loadOrder();
      showMessage(`Status: ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const showMessage = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Part functions
  const openAddPartModal = () => {
    setEditingPart(null);
    setSelectedPartType('');
    setPartData({ clientPartNumber: '', heatNumber: '', quantity: 1, material: '', thickness: '', width: '', length: '',
      outerDiameter: '', wallThickness: '', rollType: '', radius: '', diameter: '', arcDegrees: '', sectionSize: '', flangeOut: false, specialInstructions: '' });
    setShowPartModal(true);
  };

  const openEditPartModal = (part) => {
    setEditingPart(part);
    setSelectedPartType(part.partType);
    setPartData({ ...part, quantity: part.quantity || 1 });
    setShowPartModal(true);
  };

  const handleSavePart = async () => {
    if (!selectedPartType) { setError('Select a part type'); return; }
    try {
      setSaving(true);
      const data = { partType: selectedPartType, ...partData, quantity: parseInt(partData.quantity) || 1 };
      if (editingPart) {
        await updateWorkOrderPart(id, editingPart.id, data);
      } else {
        await addWorkOrderPart(id, data);
      }
      await loadOrder();
      setShowPartModal(false);
      showMessage(editingPart ? 'Part updated' : 'Part added');
    } catch (err) {
      setError('Failed to save part');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePart = async (partId) => {
    if (!window.confirm('Delete this part?')) return;
    try {
      await deleteWorkOrderPart(id, partId);
      await loadOrder();
      showMessage('Part deleted');
    } catch (err) {
      setError('Failed to delete part');
    }
  };

  const handlePartStatusChange = async (partId, status) => {
    try {
      await updateWorkOrderPart(id, partId, { status });
      await loadOrder();
    } catch (err) {
      setError('Failed to update part status');
    }
  };

  const handleFileUpload = async (partId, files) => {
    try {
      setUploadingFiles(partId);
      await uploadPartFiles(id, partId, files);
      await loadOrder();
      showMessage('Files uploaded');
    } catch (err) {
      setError('Failed to upload files');
    } finally {
      setUploadingFiles(null);
    }
  };

  const handleViewFile = async (partId, fileId) => {
    try {
      const response = await getPartFileSignedUrl(id, partId, fileId);
      window.open(response.data.url, '_blank');
    } catch (err) {
      setError('Failed to open file');
    }
  };

  const handleDeleteFile = async (partId, fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await deletePartFile(id, partId, fileId);
      await loadOrder();
      showMessage('File deleted');
    } catch (err) {
      setError('Failed to delete file');
    }
  };

  const handlePickup = async () => {
    try {
      await updateWorkOrder(id, { status: 'picked_up', pickedUpBy: pickupData.pickedUpBy, pickedUpAt: new Date().toISOString() });
      await loadOrder();
      setShowPickupModal(false);
      showMessage('Marked as picked up');
    } catch (err) {
      setError('Failed to update');
    }
  };

  const printWorkOrder = (type) => {
    const printWindow = window.open('', '_blank');
    const partsHtml = order.parts?.map(p => `
      <div style="border:1px solid #ddd;padding:12px;margin-bottom:10px;border-radius:4px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <strong>#${p.partNumber} - ${PART_TYPES[p.partType]?.label || p.partType}</strong>
          <span style="background:#e3f2fd;padding:2px 8px;border-radius:4px;font-size:0.8em">${p.status}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:0.9em">
          <div><strong>Qty:</strong> ${p.quantity}</div>
          ${p.material ? `<div><strong>Material:</strong> ${p.material}</div>` : ''}
          ${p.thickness ? `<div><strong>Thickness:</strong> ${p.thickness}</div>` : ''}
          ${p.width ? `<div><strong>Width:</strong> ${p.width}</div>` : ''}
          ${p.length ? `<div><strong>Length:</strong> ${p.length}</div>` : ''}
          ${p.sectionSize ? `<div><strong>Section:</strong> ${p.sectionSize}</div>` : ''}
          ${p.radius ? `<div><strong>Radius:</strong> ${p.radius}</div>` : ''}
          ${p.diameter ? `<div><strong>Diameter:</strong> ${p.diameter}</div>` : ''}
        </div>
        ${p.specialInstructions ? `<div style="margin-top:8px;padding:8px;background:#f5f5f5;border-radius:4px"><strong>Instructions:</strong> ${p.specialInstructions}</div>` : ''}
      </div>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>${type === 'customer' ? 'Delivery Receipt' : 'Work Order'} - ${order.drNumber ? `DR-${order.drNumber}` : order.orderNumber}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}h1{color:#1976d2;border-bottom:2px solid #1976d2;padding-bottom:10px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}.sig-box{border:1px solid #ddd;padding:20px;margin-top:30px}.sig-line{border-bottom:1px solid #333;height:40px;margin-top:10px}</style></head>
      <body><h1>${type === 'customer' ? 'Delivery Receipt' : 'Work Order'} - ${order.drNumber ? `DR-${order.drNumber}` : order.orderNumber}</h1>
      <div class="info-grid">
        <div style="padding:8px;background:#f5f5f5;border-radius:4px"><strong>Client:</strong> ${order.clientName}</div>
        ${order.clientPurchaseOrderNumber ? `<div style="padding:8px;background:#f5f5f5;border-radius:4px"><strong>PO#:</strong> ${order.clientPurchaseOrderNumber}</div>` : ''}
        ${order.contactName ? `<div style="padding:8px;background:#f5f5f5;border-radius:4px"><strong>Contact:</strong> ${order.contactName}</div>` : ''}
        ${order.contactPhone ? `<div style="padding:8px;background:#f5f5f5;border-radius:4px"><strong>Phone:</strong> ${order.contactPhone}</div>` : ''}
        ${order.promisedDate ? `<div style="padding:8px;background:#f5f5f5;border-radius:4px"><strong>Due:</strong> ${new Date(order.promisedDate).toLocaleDateString()}</div>` : ''}
      </div>
      ${order.notes ? `<div style="padding:10px;background:#f5f5f5;border-radius:4px;margin-bottom:20px"><strong>Notes:</strong> ${order.notes}</div>` : ''}
      <h2 style="border-bottom:2px solid #1976d2;padding-bottom:5px">Parts (${order.parts?.length || 0})</h2>
      ${partsHtml || '<p>No parts</p>'}
      ${type === 'customer' ? `<div class="sig-box"><h3 style="margin-top:0">Customer Acceptance</h3><p>I acknowledge receipt of the above items.</p>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-top:30px"><div><div class="sig-line">Signature</div></div><div><div class="sig-line">Date</div></div></div>
        <div style="margin-top:20px"><div class="sig-line">Print Name</div></div></div>` : ''}
      <div style="margin-top:30px;font-size:0.8em;color:#999;text-align:center">Printed ${new Date().toLocaleString()}</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
    setShowPrintMenu(false);
  };

  const printPartLabel = (part) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Label</title>
      <style>@page{size:62mm 29mm;margin:0}body{font-family:Arial;width:62mm;height:29mm;padding:2mm;margin:0;box-sizing:border-box}
      .lg{font-size:14pt;font-weight:bold}.sm{font-size:9pt;color:#333}</style></head>
      <body><div class="lg">${part.clientPartNumber || `Part ${part.partNumber}`}</div>
      <div class="sm">WO: ${order.orderNumber}</div>
      ${order.clientPurchaseOrderNumber ? `<div class="sm">PO: ${order.clientPurchaseOrderNumber}</div>` : ''}
      ${part.heatNumber ? `<div class="sm">Heat: ${part.heatNumber}</div>` : ''}
      <div class="sm">Qty: ${part.quantity}</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A';
  
  const StatusBadge = ({ status }) => {
    const styles = {
      draft: { background: '#e0e0e0', color: '#555' },
      received: { background: '#e3f2fd', color: '#1565c0' },
      in_progress: { background: '#fff3e0', color: '#e65100' },
      completed: { background: '#e8f5e9', color: '#2e7d32' },
      picked_up: { background: '#f3e5f5', color: '#7b1fa2' },
      pending: { background: '#e0e0e0', color: '#555' },
    };
    return <span className="status-badge" style={styles[status] || styles.draft}>{status?.replace('_', ' ')}</span>;
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!order) return <div className="empty-state"><div className="empty-state-title">Not found</div><button className="btn btn-primary" onClick={() => navigate('/inventory')}>Back</button></div>;

  const hasNoParts = !order.parts || order.parts.length === 0;
  
  // Get PO from shipment if not on work order
  const clientPO = order.clientPurchaseOrderNumber || shipment?.clientPurchaseOrderNumber;

  return (
    <div>
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-icon btn-secondary" onClick={() => navigate('/inventory')}><ArrowLeft size={20} /></button>
          <div>
            {order.drNumber ? (
              <h1 className="detail-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ 
                  fontFamily: 'Courier New, monospace', 
                  background: '#e3f2fd', 
                  padding: '4px 12px', 
                  borderRadius: 6,
                  color: '#1976d2'
                }}>
                  DR-{order.drNumber}
                </span>
              </h1>
            ) : (
              <h1 className="detail-title">{order.orderNumber}</h1>
            )}
            <div style={{ color: '#666', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>{order.clientName}</span>
              <StatusBadge status={hasNoParts ? 'pending' : order.status} />
              {hasNoParts && <span style={{ color: '#9c27b0', fontSize: '0.8rem' }}>(Awaiting Instructions)</span>}
            </div>
          </div>
        </div>
        <div className="actions-row">
          {order.status !== 'picked_up' && (
            <>
              <select className="form-select" value={order.status} onChange={(e) => handleStatusChange(e.target.value)} style={{ width: 'auto' }}>
                <option value="draft">Draft</option><option value="received">Received</option>
                <option value="in_progress">In Progress</option><option value="completed">Completed</option>
              </select>
              {order.status === 'completed' && <button className="btn btn-success" onClick={() => setShowPickupModal(true)}><Check size={18} />Pickup</button>}
            </>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-outline" onClick={() => setShowPrintMenu(!showPrintMenu)}><Printer size={18} />Print</button>
            {showPrintMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, minWidth: 160 }}>
                <button onClick={() => printWorkOrder('customer')} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>Customer Copy</button>
                <button onClick={() => printWorkOrder('operator')} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>Operator Copy</button>
                <button onClick={() => printWorkOrder('office')} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>Office Copy</button>
              </div>
            )}
          </div>
          <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={18} /></button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Toggle for Receiving Info */}
      {shipment && (
        <div style={{ marginBottom: 16 }}>
          <button 
            className={`btn ${showReceivingInfo ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowReceivingInfo(!showReceivingInfo)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Truck size={18} />
            {showReceivingInfo ? 'Hide Receiving Info' : 'Show Receiving Info'}
          </button>
        </div>
      )}

      {/* Receiving Info Panel (collapsible) */}
      {showReceivingInfo && shipment && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #4caf50' }}>
          <div className="card-header">
            <h3 className="card-title"><Truck size={20} style={{ marginRight: 8 }} />Receiving Info</h3>
          </div>
          
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-item-label"><Clock size={14} /> Received</div>
              <div className="detail-item-value">{formatDateTime(shipment.receivedAt)}</div>
            </div>
            {shipment.receivedBy && (
              <div className="detail-item">
                <div className="detail-item-label"><User size={14} /> Received By</div>
                <div className="detail-item-value">{shipment.receivedBy}</div>
              </div>
            )}
            <div className="detail-item">
              <div className="detail-item-label">Quantity</div>
              <div className="detail-item-value">{shipment.quantity} piece{shipment.quantity !== 1 ? 's' : ''}</div>
            </div>
            {shipment.location && (
              <div className="detail-item">
                <div className="detail-item-label"><MapPin size={14} /> Storage Location</div>
                <div className="detail-item-value">{shipment.location}</div>
              </div>
            )}
            <div className="detail-item">
              <div className="detail-item-label">QR Code</div>
              <div className="detail-item-value" style={{ fontFamily: 'monospace' }}>{shipment.qrCode}</div>
            </div>
          </div>

          {shipment.description && (
            <div style={{ marginTop: 16, padding: 16, background: '#e3f2fd', borderRadius: 8, borderLeft: '4px solid #1976d2' }}>
              <div style={{ fontWeight: 600, color: '#1565c0', marginBottom: 8 }}>Material Description</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{shipment.description}</div>
            </div>
          )}

          {shipment.notes && (
            <div style={{ marginTop: 16, padding: 16, background: '#fff3e0', borderRadius: 8, borderLeft: '4px solid #ff9800' }}>
              <div style={{ fontWeight: 600, color: '#e65100', marginBottom: 8 }}>Receiving Notes</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{shipment.notes}</div>
            </div>
          )}

          {shipment.photos?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Photos ({shipment.photos.length})</div>
              <div className="photo-grid">
                {shipment.photos.map(photo => (
                  <div key={photo.id} className="photo-item">
                    <img 
                      src={photo.thumbnailUrl || photo.url} 
                      alt="Shipment" 
                      onClick={() => window.open(photo.url, '_blank')}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Details Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Order Details</h3>
          {isEditing ? (
            <div className="actions-row">
              <button className="btn btn-primary btn-sm" onClick={handleSaveOrder} disabled={saving}><Save size={16} />{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}><X size={16} />Cancel</button>
            </div>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={() => setIsEditing(true)}><Edit size={16} />Edit</button>
          )}
        </div>
        {isEditing ? (
          <div className="grid grid-2">
            <div className="form-group"><label className="form-label">Client *</label><input className="form-input" value={editData.clientName} onChange={(e) => setEditData({ ...editData, clientName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Client PO#</label><input className="form-input" value={editData.clientPurchaseOrderNumber} onChange={(e) => setEditData({ ...editData, clientPurchaseOrderNumber: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Job Number</label><input className="form-input" value={editData.jobNumber} onChange={(e) => setEditData({ ...editData, jobNumber: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Storage Location</label><input className="form-input" value={editData.storageLocation} onChange={(e) => setEditData({ ...editData, storageLocation: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Contact</label><input className="form-input" value={editData.contactName} onChange={(e) => setEditData({ ...editData, contactName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={editData.contactPhone} onChange={(e) => setEditData({ ...editData, contactPhone: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Requested Due Date</label><input type="date" className="form-input" value={editData.requestedDueDate} onChange={(e) => setEditData({ ...editData, requestedDueDate: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Promised Date</label><input type="date" className="form-input" value={editData.promisedDate} onChange={(e) => setEditData({ ...editData, promisedDate: e.target.value })} /></div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Notes</label><textarea className="form-textarea" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} /></div>
          </div>
        ) : (
          <>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-item-label"><User size={14} /> Client</div><div className="detail-item-value">{order.clientName}</div></div>
              {clientPO && <div className="detail-item"><div className="detail-item-label"><FileText size={14} /> Client PO#</div><div className="detail-item-value" style={{ color: '#1976d2', fontWeight: 600 }}>{clientPO}</div></div>}
              {order.jobNumber && <div className="detail-item"><div className="detail-item-label">Job#</div><div className="detail-item-value">{order.jobNumber}</div></div>}
              {order.storageLocation && <div className="detail-item"><div className="detail-item-label"><MapPin size={14} /> Location</div><div className="detail-item-value">{order.storageLocation}</div></div>}
              {order.contactName && <div className="detail-item"><div className="detail-item-label">Contact</div><div className="detail-item-value">{order.contactName}</div></div>}
              {order.contactPhone && <div className="detail-item"><div className="detail-item-label">Phone</div><div className="detail-item-value">{order.contactPhone}</div></div>}
              {order.promisedDate && <div className="detail-item"><div className="detail-item-label"><Calendar size={14} /> Promised</div><div className="detail-item-value">{formatDate(order.promisedDate)}</div></div>}
              <div className="detail-item"><div className="detail-item-label"><Clock size={14} /> Created</div><div className="detail-item-value">{formatDate(order.createdAt)}</div></div>
            </div>
            {order.notes && <div style={{ marginTop: 16, padding: 12, background: '#f9f9f9', borderRadius: 8 }}><strong>Notes:</strong> {order.notes}</div>}
          </>
        )}
      </div>

      {/* Parts Section (directly below Order Details) */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><Package size={20} style={{ marginRight: 8 }} />Parts ({order.parts?.length || 0})</h3>
          <button className="btn btn-primary btn-sm" onClick={openAddPartModal}><Plus size={16} />Add Part</button>
        </div>
        {hasNoParts ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <Package size={48} color="#9c27b0" />
            <p style={{ marginTop: 12, color: '#9c27b0', fontWeight: 500 }}>Awaiting Instructions</p>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>Add parts when the client calls with rolling/bending instructions</p>
            <button className="btn btn-primary" onClick={openAddPartModal} style={{ marginTop: 16 }}><Plus size={16} />Add First Part</button>
          </div>
        ) : (
          <div>
            {order.parts.sort((a, b) => a.partNumber - b.partNumber).map(part => (
              <div key={part.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, marginBottom: 12, background: part.status === 'completed' ? '#f9fff9' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>#{part.partNumber}</span>
                      <span style={{ color: '#1976d2' }}>{PART_TYPES[part.partType]?.label || part.partType}</span>
                      <StatusBadge status={part.status} />
                    </div>
                    {part.clientPartNumber && <div style={{ color: '#666', fontSize: '0.875rem' }}>Client Part#: {part.clientPartNumber}</div>}
                    {part.heatNumber && <div style={{ color: '#666', fontSize: '0.875rem' }}>Heat#: {part.heatNumber}</div>}
                  </div>
                  <div className="actions-row">
                    <select className="form-select" value={part.status} onChange={(e) => handlePartStatusChange(part.id, e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}>
                      <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                    </select>
                    <button className="btn btn-sm btn-outline" onClick={() => printPartLabel(part)} title="Print Label"><Tag size={14} /></button>
                    <button className="btn btn-sm btn-outline" onClick={() => openEditPartModal(part)}><Edit size={14} /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeletePart(part.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, fontSize: '0.875rem' }}>
                  <div><strong>Qty:</strong> {part.quantity}</div>
                  {part.material && <div><strong>Material:</strong> {part.material}</div>}
                  {part.thickness && <div><strong>Thickness:</strong> {part.thickness}</div>}
                  {part.width && <div><strong>Width:</strong> {part.width}</div>}
                  {part.length && <div><strong>Length:</strong> {part.length}</div>}
                  {part.sectionSize && <div><strong>Section:</strong> {part.sectionSize}</div>}
                  {part.outerDiameter && <div><strong>OD:</strong> {part.outerDiameter}</div>}
                  {part.wallThickness && <div><strong>Wall:</strong> {part.wallThickness}</div>}
                  {part.rollType && <div><strong>Roll:</strong> {part.rollType === 'easy_way' ? 'Easy Way' : 'Hard Way'}</div>}
                  {part.radius && <div><strong>Radius:</strong> {part.radius}</div>}
                  {part.diameter && <div><strong>Diameter:</strong> {part.diameter}</div>}
                  {part.arcDegrees && <div><strong>Arc:</strong> {part.arcDegrees}°</div>}
                </div>
                {part.specialInstructions && <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4, fontSize: '0.875rem' }}><strong>Instructions:</strong> {part.specialInstructions}</div>}
                
                {/* Files */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Files ({part.files?.length || 0})</span>
                    <button className="btn btn-sm btn-outline" onClick={() => fileInputRefs.current[part.id]?.click()} disabled={uploadingFiles === part.id}>
                      <Upload size={12} />{uploadingFiles === part.id ? 'Uploading...' : 'Upload'}
                    </button>
                    <input type="file" multiple ref={el => fileInputRefs.current[part.id] = el} style={{ display: 'none' }} onChange={(e) => handleFileUpload(part.id, Array.from(e.target.files))} />
                  </div>
                  {part.files?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {part.files.map(file => (
                        <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                          <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.originalName}</span>
                          <button onClick={() => handleViewFile(part.id, file.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Eye size={12} /></button>
                          <button onClick={() => handleDeleteFile(part.id, file.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#d32f2f' }}><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Part Modal */}
      {showPartModal && (
        <div className="modal-overlay" onClick={() => setShowPartModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editingPart ? 'Edit Part' : 'Add Part'}</h3>
              <button className="btn btn-icon" onClick={() => setShowPartModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-group">
                <label className="form-label">Part Type *</label>
                <select className="form-select" value={selectedPartType} onChange={(e) => setSelectedPartType(e.target.value)}>
                  <option value="">Select type...</option>
                  {Object.entries(PART_TYPES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                </select>
              </div>
              {selectedPartType && (
                <div className="grid grid-2">
                  <div className="form-group"><label className="form-label">Client Part#</label><input className="form-input" value={partData.clientPartNumber} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Heat#</label><input className="form-input" value={partData.heatNumber} onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Quantity *</label><input type="number" className="form-input" value={partData.quantity} onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} min="1" /></div>
                  {PART_TYPES[selectedPartType]?.fields.includes('material') && <div className="form-group"><label className="form-label">Material</label><input className="form-input" value={partData.material} onChange={(e) => setPartData({ ...partData, material: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('thickness') && <div className="form-group"><label className="form-label">Thickness</label><input className="form-input" value={partData.thickness} onChange={(e) => setPartData({ ...partData, thickness: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('width') && <div className="form-group"><label className="form-label">Width</label><input className="form-input" value={partData.width} onChange={(e) => setPartData({ ...partData, width: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('length') && <div className="form-group"><label className="form-label">Length</label><input className="form-input" value={partData.length} onChange={(e) => setPartData({ ...partData, length: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('sectionSize') && <div className="form-group"><label className="form-label">Section Size</label><input className="form-input" value={partData.sectionSize} onChange={(e) => setPartData({ ...partData, sectionSize: e.target.value })} placeholder="e.g. W8x31" /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('outerDiameter') && <div className="form-group"><label className="form-label">Outer Diameter</label><input className="form-input" value={partData.outerDiameter} onChange={(e) => setPartData({ ...partData, outerDiameter: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('wallThickness') && <div className="form-group"><label className="form-label">Wall Thickness</label><input className="form-input" value={partData.wallThickness} onChange={(e) => setPartData({ ...partData, wallThickness: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('rollType') && (
                    <div className="form-group"><label className="form-label">Roll Type</label>
                      <select className="form-select" value={partData.rollType} onChange={(e) => setPartData({ ...partData, rollType: e.target.value })}>
                        <option value="">Select...</option><option value="easy_way">Easy Way</option><option value="hard_way">Hard Way</option>
                      </select>
                    </div>
                  )}
                  {PART_TYPES[selectedPartType]?.fields.includes('radius') && <div className="form-group"><label className="form-label">Radius</label><input className="form-input" value={partData.radius} onChange={(e) => setPartData({ ...partData, radius: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('diameter') && <div className="form-group"><label className="form-label">Diameter</label><input className="form-input" value={partData.diameter} onChange={(e) => setPartData({ ...partData, diameter: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('arcDegrees') && <div className="form-group"><label className="form-label">Arc (degrees)</label><input className="form-input" value={partData.arcDegrees} onChange={(e) => setPartData({ ...partData, arcDegrees: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('flangeOut') && (
                    <div className="form-group"><label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={partData.flangeOut} onChange={(e) => setPartData({ ...partData, flangeOut: e.target.checked })} /> Flange Out
                    </label></div>
                  )}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Special Instructions</label><textarea className="form-textarea" value={partData.specialInstructions} onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} /></div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPartModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePart} disabled={saving || !selectedPartType}>{saving ? 'Saving...' : editingPart ? 'Update Part' : 'Add Part'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup Modal */}
      {showPickupModal && (
        <div className="modal-overlay" onClick={() => setShowPickupModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Pickup</h3><button className="btn btn-icon" onClick={() => setShowPickupModal(false)}><X size={20} /></button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Picked Up By</label><input className="form-input" value={pickupData.pickedUpBy} onChange={(e) => setPickupData({ pickedUpBy: e.target.value })} placeholder="Name of person picking up" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPickupModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handlePickup}><Check size={18} />Confirm Pickup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrderDetailsPage;
