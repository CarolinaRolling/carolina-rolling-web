import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Save, X, Trash2, Plus, Package, FileText, User, 
  Calendar, Printer, Check, Upload, Eye, Tag
} from 'lucide-react';
import { 
  getWorkOrderById, updateWorkOrder, deleteWorkOrder,
  addWorkOrderPart, updateWorkOrderPart, deleteWorkOrderPart,
  uploadPartFiles, getPartFileSignedUrl, deletePartFile
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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
        projectDescription: data.projectDescription || '',
        storageLocation: data.storageLocation || '',
        notes: data.notes || '',
        receivedBy: data.receivedBy || '',
        requestedDueDate: data.requestedDueDate || '',
        promisedDate: data.promisedDate || '',
      });
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
      navigate('/workorders');
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

  const handlePartStatusChange = async (partId, newStatus) => {
    try {
      await updateWorkOrderPart(id, partId, { status: newStatus });
      await loadOrder();
    } catch (err) {
      setError('Failed to update part');
    }
  };

  const handleFileUpload = async (partId, files) => {
    try {
      setUploadingFiles(partId);
      await uploadPartFiles(id, partId, Array.from(files));
      await loadOrder();
      showMessage('Files uploaded');
    } catch (err) {
      setError('Failed to upload');
    } finally {
      setUploadingFiles(null);
    }
  };

  const handleViewFile = async (partId, file) => {
    try {
      const data = await getPartFileSignedUrl(id, partId, file.id);
      window.open(data.url, '_blank');
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
      setSaving(true);
      await updateWorkOrder(id, { status: 'picked_up', pickedUpBy: pickupData.pickedUpBy });
      await loadOrder();
      setShowPickupModal(false);
      showMessage('Marked as picked up');
    } catch (err) {
      setError('Failed to complete pickup');
    } finally {
      setSaving(false);
    }
  };

  // Print functions
  const printWorkOrder = (type) => {
    const printWindow = window.open('', '_blank');
    const title = type === 'customer' ? 'Customer Copy' : type === 'operator' ? 'Operator Copy' : 'Office Copy';
    let partsHtml = (order.parts || []).map(part => {
      const typeConfig = PART_TYPES[part.partType] || PART_TYPES.other;
      return `<div style="border:1px solid #ddd;padding:15px;margin:10px 0;page-break-inside:avoid;">
        <h3 style="margin:0 0 10px;border-bottom:2px solid #1976d2;padding-bottom:5px;">Part #${part.partNumber}: ${typeConfig.label}</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:14px;">
          ${part.clientPartNumber ? `<div><strong>Client Part#:</strong> ${part.clientPartNumber}</div>` : ''}
          ${part.heatNumber ? `<div><strong>Heat#:</strong> ${part.heatNumber}</div>` : ''}
          <div><strong>Qty:</strong> ${part.quantity}</div>
          ${part.material ? `<div><strong>Material:</strong> ${part.material}</div>` : ''}
          ${part.thickness ? `<div><strong>Thickness:</strong> ${part.thickness}</div>` : ''}
          ${part.width ? `<div><strong>Width:</strong> ${part.width}</div>` : ''}
          ${part.length ? `<div><strong>Length:</strong> ${part.length}</div>` : ''}
          ${part.sectionSize ? `<div><strong>Section:</strong> ${part.sectionSize}</div>` : ''}
          ${part.outerDiameter ? `<div><strong>OD:</strong> ${part.outerDiameter}</div>` : ''}
          ${part.wallThickness ? `<div><strong>Wall:</strong> ${part.wallThickness}</div>` : ''}
          ${part.rollType ? `<div><strong>Roll:</strong> ${part.rollType === 'easy_way' ? 'Easy Way' : 'Hard Way'}</div>` : ''}
          ${part.radius ? `<div><strong>Radius:</strong> ${part.radius}</div>` : ''}
          ${part.diameter ? `<div><strong>Diameter:</strong> ${part.diameter}</div>` : ''}
          ${part.diameter && parseFloat(part.diameter) > 100 ? `<div><strong>Chord:</strong> 60" <strong>Height:</strong> ${(parseFloat(part.diameter)/2 - Math.sqrt(Math.pow(parseFloat(part.diameter)/2, 2) - 900)).toFixed(3)}"</div>` : ''}
          ${part.arcDegrees ? `<div><strong>Arc:</strong> ${part.arcDegrees}°</div>` : ''}
          ${part.flangeOut ? `<div><strong>Flange Out:</strong> Yes</div>` : ''}
        </div>
        ${part.specialInstructions ? `<div style="margin-top:10px;padding:10px;background:#fff3e0;border-radius:4px;"><strong>Instructions:</strong> ${part.specialInstructions}</div>` : ''}
      </div>`;
    }).join('');
    
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${order.orderNumber} - ${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}h1{color:#1976d2}
      .sig-box{border:1px solid #333;padding:20px;margin-top:30px}.sig-line{border-top:1px solid #333;margin-top:50px;padding-top:5px}</style></head>
      <body><div style="display:flex;justify-content:space-between"><div><h1>Carolina Rolling</h1><p style="color:#666">Metal Forming & Rolling</p></div>
      <div style="text-align:right"><div style="font-size:1.3em;font-weight:bold;color:#1976d2">${order.orderNumber}</div><div style="color:#666">${title}</div></div></div>
      <h2 style="border-bottom:2px solid #1976d2;padding-bottom:5px">Order Information</h2>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:15px 0">
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
  if (!order) return <div className="empty-state"><div className="empty-state-title">Not found</div><button className="btn btn-primary" onClick={() => navigate('/workorders')}>Back</button></div>;

  return (
    <div>
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-icon btn-secondary" onClick={() => navigate('/workorders')}><ArrowLeft size={20} /></button>
          <div>
            <h1 className="detail-title">{order.orderNumber}</h1>
            <div style={{ color: '#666', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>{order.clientName}</span><StatusBadge status={order.status} />
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
          {!isEditing && <button className="btn btn-outline" onClick={() => setIsEditing(true)}><Edit size={18} />Edit</button>}
          <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={18} /></button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="grid grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div>
          {/* Order Details */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Order Details</h3>
              {isEditing && (
                <div className="actions-row">
                  <button className="btn btn-primary btn-sm" onClick={handleSaveOrder} disabled={saving}><Save size={16} />{saving ? 'Saving...' : 'Save'}</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}><X size={16} />Cancel</button>
                </div>
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
                <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-input" value={editData.requestedDueDate} onChange={(e) => setEditData({ ...editData, requestedDueDate: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Promised</label><input type="date" className="form-input" value={editData.promisedDate} onChange={(e) => setEditData({ ...editData, promisedDate: e.target.value })} /></div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Material Description</label><textarea className="form-textarea" value={editData.projectDescription} onChange={(e) => setEditData({ ...editData, projectDescription: e.target.value })} placeholder="Description of material received (e.g., 4x4x1/4 angle, 20' lengths, pallet damage noted)" /></div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Notes</label><textarea className="form-textarea" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} /></div>
              </div>
            ) : (
              <div className="detail-grid">
                <div className="detail-item"><div className="detail-item-label"><User size={14} /> Client</div><div className="detail-item-value">{order.clientName}</div></div>
                {order.clientPurchaseOrderNumber && <div className="detail-item"><div className="detail-item-label"><FileText size={14} /> PO#</div><div className="detail-item-value" style={{ color: '#1976d2', fontWeight: 600 }}>{order.clientPurchaseOrderNumber}</div></div>}
                {order.jobNumber && <div className="detail-item"><div className="detail-item-label">Job#</div><div className="detail-item-value">{order.jobNumber}</div></div>}
                {order.storageLocation && <div className="detail-item"><div className="detail-item-label">Location</div><div className="detail-item-value">{order.storageLocation}</div></div>}
                {order.contactName && <div className="detail-item"><div className="detail-item-label">Contact</div><div className="detail-item-value">{order.contactName}</div></div>}
                {order.contactPhone && <div className="detail-item"><div className="detail-item-label">Phone</div><div className="detail-item-value">{order.contactPhone}</div></div>}
                {order.promisedDate && <div className="detail-item"><div className="detail-item-label"><Calendar size={14} /> Promised</div><div className="detail-item-value">{formatDate(order.promisedDate)}</div></div>}
                <div className="detail-item"><div className="detail-item-label">Created</div><div className="detail-item-value">{formatDate(order.createdAt)}</div></div>
              </div>
            )}
            {!isEditing && order.projectDescription && (
              <div style={{ marginTop: 16, padding: 12, background: '#e3f2fd', borderRadius: 8, borderLeft: '4px solid #1976d2' }}>
                <strong style={{ color: '#1565c0' }}>Material Description:</strong>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{order.projectDescription}</div>
              </div>
            )}
            {!isEditing && order.notes && <div style={{ marginTop: 16, padding: 12, background: '#f9f9f9', borderRadius: 8 }}><strong>Notes:</strong> {order.notes}</div>}
          </div>

          {/* Parts */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><Package size={20} style={{ marginRight: 8 }} />Parts ({order.parts?.length || 0})</h3>
              <button className="btn btn-primary btn-sm" onClick={openAddPartModal}><Plus size={16} />Add Part</button>
            </div>
            {(!order.parts || order.parts.length === 0) ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <Package size={48} color="#ccc" />
                <p style={{ marginTop: 12 }}>No parts added yet</p>
                <button className="btn btn-outline" onClick={openAddPartModal} style={{ marginTop: 12 }}><Plus size={16} />Add First Part</button>
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
                      {part.diameter && (() => {
                        const diamNum = parseFloat(part.diameter);
                        if (diamNum > 100) {
                          const radius = diamNum / 2;
                          const chord = 60;
                          const height = radius - Math.sqrt(radius * radius - (chord / 2) * (chord / 2));
                          return <div><strong>Chord:</strong> 60" <strong>Height:</strong> {height.toFixed(3)}"</div>;
                        }
                        return null;
                      })()}
                      {part.arcDegrees && <div><strong>Arc:</strong> {part.arcDegrees}°</div>}
                      {part.flangeOut && <div><strong>Flange Out:</strong> Yes</div>}
                    </div>
                    {part.specialInstructions && <div style={{ marginTop: 8, padding: 8, background: '#fff3e0', borderRadius: 4, fontSize: '0.875rem' }}><strong>Instructions:</strong> {part.specialInstructions}</div>}
                    
                    {/* Files */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <FileText size={14} /><strong style={{ fontSize: '0.875rem' }}>Files</strong>
                        <input type="file" multiple accept=".pdf,.stp,.step" style={{ display: 'none' }} ref={el => fileInputRefs.current[part.id] = el} onChange={(e) => handleFileUpload(part.id, e.target.files)} />
                        <button className="btn btn-sm btn-outline" onClick={() => fileInputRefs.current[part.id]?.click()} disabled={uploadingFiles === part.id}>
                          <Upload size={12} />{uploadingFiles === part.id ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>
                      {part.files?.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {part.files.map(file => (
                            <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f5f5f5', borderRadius: 4, fontSize: '0.8rem' }}>
                              <span>{file.originalName || file.filename}</span>
                              <button onClick={() => handleViewFile(part.id, file)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Eye size={12} /></button>
                              <button onClick={() => handleDeleteFile(part.id, file.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#d32f2f' }}><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      ) : <div style={{ color: '#999', fontSize: '0.8rem' }}>No files uploaded</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 24 }}>
            <h3 className="card-title">Summary</h3>
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 12 }}><div style={{ fontSize: '0.875rem', color: '#666' }}>Total Parts</div><div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{order.parts?.length || 0}</div></div>
              <div style={{ marginBottom: 12 }}><div style={{ fontSize: '0.875rem', color: '#666' }}>Completed</div><div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#388e3c' }}>{order.parts?.filter(p => p.status === 'completed').length || 0}</div></div>
              {order.promisedDate && <div style={{ marginBottom: 12 }}><div style={{ fontSize: '0.875rem', color: '#666' }}>Due Date</div><div style={{ fontWeight: 500 }}>{formatDate(order.promisedDate)}</div></div>}
            </div>
            {order.status === 'completed' && (
              <button className="btn btn-success" style={{ width: '100%', marginTop: 16 }} onClick={() => setShowPickupModal(true)}><Check size={18} />Mark as Picked Up</button>
            )}
          </div>
        </div>
      </div>

      {/* Part Modal */}
      {showPartModal && (
        <div className="modal-overlay" onClick={() => setShowPartModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingPart ? `Edit Part #${editingPart.partNumber}` : 'Add New Part'}</h3>
              <button className="modal-close" onClick={() => setShowPartModal(false)}>&times;</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Part Type *</label>
              <select className="form-select" value={selectedPartType} onChange={(e) => setSelectedPartType(e.target.value)}>
                <option value="">Select type...</option>
                {Object.entries(PART_TYPES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
              </select>
            </div>

            {selectedPartType && (
              <div className="grid grid-2" style={{ marginTop: 16 }}>
                <div className="form-group"><label className="form-label">Client Part#</label><input className="form-input" value={partData.clientPartNumber || ''} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Heat#</label><input className="form-input" value={partData.heatNumber || ''} onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Quantity</label><input type="number" className="form-input" value={partData.quantity || 1} onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} min="1" /></div>
                
                {PART_TYPES[selectedPartType]?.fields.includes('material') && <div className="form-group"><label className="form-label">Material</label><input className="form-input" value={partData.material || ''} onChange={(e) => setPartData({ ...partData, material: e.target.value })} placeholder="e.g., A36, 304 SS" /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('thickness') && <div className="form-group"><label className="form-label">Thickness</label><input className="form-input" value={partData.thickness || ''} onChange={(e) => setPartData({ ...partData, thickness: e.target.value })} placeholder='e.g., 1/2"' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('width') && <div className="form-group"><label className="form-label">Width</label><input className="form-input" value={partData.width || ''} onChange={(e) => setPartData({ ...partData, width: e.target.value })} placeholder='e.g., 48"' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('length') && <div className="form-group"><label className="form-label">Length</label><input className="form-input" value={partData.length || ''} onChange={(e) => setPartData({ ...partData, length: e.target.value })} placeholder='e.g., 120"' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('sectionSize') && <div className="form-group"><label className="form-label">Section Size</label><input className="form-input" value={partData.sectionSize || ''} onChange={(e) => setPartData({ ...partData, sectionSize: e.target.value })} placeholder='e.g., L4x4x1/2' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('outerDiameter') && <div className="form-group"><label className="form-label">Outer Diameter</label><input className="form-input" value={partData.outerDiameter || ''} onChange={(e) => setPartData({ ...partData, outerDiameter: e.target.value })} placeholder='e.g., 6"' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('wallThickness') && <div className="form-group"><label className="form-label">Wall Thickness</label><input className="form-input" value={partData.wallThickness || ''} onChange={(e) => setPartData({ ...partData, wallThickness: e.target.value })} placeholder='e.g., Sch 40' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('rollType') && (
                  <div className="form-group"><label className="form-label">Roll Direction</label>
                    <select className="form-select" value={partData.rollType || ''} onChange={(e) => setPartData({ ...partData, rollType: e.target.value })}>
                      <option value="">Select...</option><option value="easy_way">Easy Way</option><option value="hard_way">Hard Way</option>
                    </select>
                  </div>
                )}
                {PART_TYPES[selectedPartType]?.fields.includes('radius') && <div className="form-group"><label className="form-label">Radius</label><input className="form-input" value={partData.radius || ''} onChange={(e) => setPartData({ ...partData, radius: e.target.value })} placeholder='e.g., 48" radius' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('diameter') && <div className="form-group"><label className="form-label">Diameter</label><input className="form-input" value={partData.diameter || ''} onChange={(e) => setPartData({ ...partData, diameter: e.target.value })} placeholder='e.g., 96" dia' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('arcDegrees') && <div className="form-group"><label className="form-label">Arc Degrees</label><input className="form-input" value={partData.arcDegrees || ''} onChange={(e) => setPartData({ ...partData, arcDegrees: e.target.value })} placeholder='e.g., 90, 180, 360' /></div>}
                {PART_TYPES[selectedPartType]?.fields.includes('flangeOut') && (
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="flangeOut" checked={partData.flangeOut || false} onChange={(e) => setPartData({ ...partData, flangeOut: e.target.checked })} />
                    <label htmlFor="flangeOut" className="form-label" style={{ marginBottom: 0 }}>Flange Out</label>
                  </div>
                )}
                <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Special Instructions</label><textarea className="form-textarea" value={partData.specialInstructions || ''} onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} placeholder="Any special instructions for the operator..." /></div>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPartModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSavePart} disabled={saving || !selectedPartType}>{saving ? 'Saving...' : editingPart ? 'Update Part' : 'Add Part'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup Modal */}
      {showPickupModal && (
        <div className="modal-overlay" onClick={() => setShowPickupModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Mark as Picked Up</h3>
              <button className="modal-close" onClick={() => setShowPickupModal(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">Picked Up By</label>
              <input type="text" className="form-input" value={pickupData.pickedUpBy} onChange={(e) => setPickupData({ ...pickupData, pickedUpBy: e.target.value })} placeholder="Name of person picking up" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPickupModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handlePickup} disabled={saving}>{saving ? 'Saving...' : 'Complete Pickup'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrderDetailsPage;
