import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Save, X, Trash2, Package, FileText, User } from 'lucide-react';
import { getInboundOrderById, updateInboundOrder, deleteInboundOrder, convertInboundToShipment } from '../services/api';
import { useAuth } from '../context/AuthContext';

function InboundDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const response = await getInboundOrderById(id);
      const data = response.data.data;
      setOrder(data);
      setEditData({
        supplierName: data.supplierName || '',
        purchaseOrderNumber: data.purchaseOrderNumber || '',
        clientName: data.clientName || '',
        description: data.description || '',
      });
    } catch (err) {
      setError('Failed to load order');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editData.supplierName || !editData.purchaseOrderNumber || 
        !editData.clientName || !editData.description) {
      setError('All fields are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await updateInboundOrder(id, editData);
      await loadOrder();
      setIsEditing(false);
      setSuccess('Order updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save changes');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this inbound order?')) return;
    try {
      await deleteInboundOrder(id);
      navigate('/inbound');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to delete order');
    }
  };

  // U36: a received delivery already has its shipment — only an admin may convert it again, after confirming
  const isReceived = !!order && (order.status === 'received' || !!order.receivedAt);
  const handleConvertToShipment = async () => {
    if (saving) return;
    let force = false;
    if (isReceived) {
      if (!isAdmin()) { setError('This delivery has already been received, so its shipment exists already.'); return; }
      if (!window.confirm('This delivery has already been received — a shipment for it probably exists already.\n\nCreate ANOTHER shipment from it anyway?')) return;
      force = true;
    }
    try {
      setSaving(true);
      setError(null);
      // The server creates the shipment and receives this delivery in one step (audit R21)
      const response = await convertInboundToShipment(id, { force });
      const newShipment = response.data.data;
      navigate(`/shipment/${newShipment.id}`);
    } catch (err) {
      // U36: show the server's reason (409 DELIVERY_RECEIVED) and reload so the button reflects it
      setError(err.response?.data?.error?.message || 'Failed to convert to shipment');
      console.error(err);
      if (err.response?.status === 409) loadOrder();
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Order not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/inbound')}>
          Back to Inbound
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-icon btn-secondary" onClick={() => navigate('/inbound')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="detail-title">PO# {order.purchaseOrderNumber}</h1>
            <div style={{ color: '#666', fontSize: '0.875rem' }}>
              From {order.supplierName}
            </div>
          </div>
        </div>
        <div className="actions-row">
          {isEditing ? (
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={18} />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                <X size={18} />
                Cancel
              </button>
            </>
          ) : (
            <>
              {(!isReceived || isAdmin()) && (
                <button className={isReceived ? 'btn btn-outline' : 'btn btn-success'} onClick={handleConvertToShipment} disabled={saving}
                  title={isReceived ? 'Already received — converting again creates a second shipment (admin only)' : undefined}>
                  <Package size={18} />
                  {isReceived ? 'Convert Again (admin)' : 'Convert to Shipment'}
                </button>
              )}
              {isReceived && !isAdmin() && (
                <span style={{ alignSelf: 'center', color: '#2e7d32', fontWeight: 600, fontSize: '0.85rem' }}>✓ Received</span>
              )}
              <button className="btn btn-outline" onClick={() => setIsEditing(true)}>
                <Edit size={18} />
                Edit
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                <Trash2 size={18} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 16 }}>Order Details</h3>
        
        {isEditing ? (
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Supplier Name *</label>
              <input
                type="text"
                className="form-input"
                value={editData.supplierName}
                onChange={(e) => setEditData({ ...editData, supplierName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Order Number *</label>
              <input
                type="text"
                className="form-input"
                value={editData.purchaseOrderNumber}
                onChange={(e) => setEditData({ ...editData, purchaseOrderNumber: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Client Name (who it's for) *</label>
              <input
                type="text"
                className="form-input"
                value={editData.clientName}
                onChange={(e) => setEditData({ ...editData, clientName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Created</label>
              <input
                type="text"
                className="form-input"
                value={formatDate(order.createdAt)}
                disabled
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Description *</label>
              <textarea
                className="form-textarea"
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-item-label">
                  <Package size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Supplier
                </div>
                <div className="detail-item-value">{order.supplierName}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">
                  <FileText size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Purchase Order #
                </div>
                <div className="detail-item-value" style={{ color: '#1976d2', fontWeight: 600 }}>
                  {order.purchaseOrderNumber}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">
                  <User size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  For Client
                </div>
                <div className="detail-item-value">{order.clientName}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Created</div>
                <div className="detail-item-value">{formatDate(order.createdAt)}</div>
              </div>
            </div>
            
            <div style={{ marginTop: 20, padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
              <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>
                Description
              </div>
              <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {order.description}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InboundDetailsPage;
