import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Package, Truck, AlertCircle, CheckCircle, Clock, FileText, Plus, Inbox } from 'lucide-react';
import { getWorkOrders, getArchivedWorkOrders, getShipments, createWorkOrder } from '../services/api';

function InventoryPage() {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkOrder, setNewWorkOrder] = useState({
    clientName: '',
    clientPO: '',
    jobNumber: '',
    projectDescription: '',
    storageLocation: ''
  });
  const [selectedShipments, setSelectedShipments] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem('inventory_statusFilter') || 'active';
  });
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('inventory_sortBy') || 'date_desc';
  });

  useEffect(() => {
    localStorage.setItem('inventory_statusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('inventory_sortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load work orders
      if (statusFilter === 'archived') {
        const response = await getArchivedWorkOrders();
        setWorkOrders(response.data.data || []);
      } else if (statusFilter !== 'unassigned') {
        const response = await getWorkOrders({ archived: 'false' });
        setWorkOrders(response.data.data || []);
      }
      
      // Load all shipments (we'll filter unassigned on frontend)
      try {
        const shipResponse = await getShipments();
        const allShipments = shipResponse.data.data || [];
        // Filter to only unassigned (no workOrderId)
        setShipments(allShipments.filter(s => !s.workOrderId));
      } catch (e) {
        console.log('Could not load shipments:', e);
        setShipments([]);
      }
    } catch (err) {
      setError('Failed to load inventory');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredOrders = () => {
    let filtered = [...workOrders];

    // Filter by status within active
    if (statusFilter === 'awaiting') {
      filtered = filtered.filter(o => !o.allMaterialReceived && o.pendingInboundCount > 0);
    } else if (statusFilter === 'ready') {
      filtered = filtered.filter(o => o.status === 'completed');
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.clientName?.toLowerCase().includes(query) ||
        o.orderNumber?.toLowerCase().includes(query) ||
        o.clientPO?.toLowerCase().includes(query) ||
        (o.drNumber && `DR-${o.drNumber}`.toLowerCase().includes(query)) ||
        (o.drNumber && o.drNumber.toString().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'date_asc':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'dr_desc':
          return (b.drNumber || 0) - (a.drNumber || 0);
        case 'dr_asc':
          return (a.drNumber || 0) - (b.drNumber || 0);
        case 'name_asc':
          return (a.clientName || '').localeCompare(b.clientName || '');
        case 'name_desc':
          return (b.clientName || '').localeCompare(a.clientName || '');
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getFilteredShipments = () => {
    let filtered = [...shipments];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.clientName?.toLowerCase().includes(query) ||
        s.qrCode?.toLowerCase().includes(query) ||
        s.clientPurchaseOrderNumber?.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort by date
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return filtered;
  };

  const filteredOrders = getFilteredOrders();
  const filteredShipments = getFilteredShipments();
  const unassignedCount = shipments.length;

  // Count items for tabs
  const awaitingCount = workOrders.filter(o => !o.allMaterialReceived && o.pendingInboundCount > 0).length;
  const readyCount = workOrders.filter(o => o.status === 'completed').length;

  const getStatusColor = (order) => {
    if (!order.allMaterialReceived && order.pendingInboundCount > 0) return 'status-pending';
    switch (order.status) {
      case 'received': return 'status-received';
      case 'in_progress': return 'status-in_progress';
      case 'completed': return 'status-completed';
      case 'shipped': return 'status-shipped';
      case 'archived': return 'status-shipped';
      default: return 'status-received';
    }
  };

  const getStatusLabel = (order) => {
    if (!order.allMaterialReceived && order.pendingInboundCount > 0) {
      return `Awaiting ${order.pendingInboundCount} shipment${order.pendingInboundCount > 1 ? 's' : ''}`;
    }
    return order.status?.replace('_', ' ');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleCreateWorkOrder = async () => {
    if (!newWorkOrder.clientName.trim()) {
      setError('Client name is required');
      return;
    }
    
    try {
      setSaving(true);
      const response = await createWorkOrder({
        ...newWorkOrder,
        shipmentIds: selectedShipments,
        assignDRNumber: true
      });
      
      setShowCreateModal(false);
      setNewWorkOrder({ clientName: '', clientPO: '', jobNumber: '', projectDescription: '', storageLocation: '' });
      setSelectedShipments([]);
      loadData();
      
      // Navigate to the new work order
      if (response.data.data?.id) {
        navigate(`/workorder/${response.data.data.id}`);
      }
    } catch (err) {
      setError('Failed to create work order');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleShipmentSelection = (shipmentId) => {
    setSelectedShipments(prev => 
      prev.includes(shipmentId) 
        ? prev.filter(id => id !== shipmentId)
        : [...prev, shipmentId]
    );
  };

  const openCreateModal = (shipment = null) => {
    if (shipment) {
      setNewWorkOrder({
        clientName: shipment.clientName || '',
        clientPO: shipment.clientPurchaseOrderNumber || '',
        jobNumber: shipment.jobNumber || '',
        projectDescription: shipment.description || '',
        storageLocation: shipment.location || ''
      });
      setSelectedShipments([shipment.id]);
    } else {
      // Keep existing selections if any
      if (selectedShipments.length === 1) {
        const ship = shipments.find(s => s.id === selectedShipments[0]);
        if (ship) {
          setNewWorkOrder({
            clientName: ship.clientName || '',
            clientPO: ship.clientPurchaseOrderNumber || '',
            jobNumber: ship.jobNumber || '',
            projectDescription: ship.description || '',
            storageLocation: ship.location || ''
          });
        }
      } else {
        setNewWorkOrder({ clientName: '', clientPO: '', jobNumber: '', projectDescription: '', storageLocation: '' });
      }
    }
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {statusFilter === 'archived' ? '📁 Archived Orders' : 
           statusFilter === 'unassigned' ? '📥 Unassigned Shipments' : '📦 Inventory'}
        </h1>
        {statusFilter === 'unassigned' && selectedShipments.length > 0 && (
          <button 
            className="btn btn-primary"
            onClick={() => openCreateModal()}
          >
            <Plus size={18} /> Create Work Order ({selectedShipments.length} selected)
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${statusFilter === 'active' ? 'active' : ''}`}
          onClick={() => setStatusFilter('active')}
        >
          All Active
        </button>
        <button 
          className={`tab ${statusFilter === 'unassigned' ? 'active' : ''}`}
          onClick={() => setStatusFilter('unassigned')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Inbox size={14} />
          Unassigned Shipments
          {unassignedCount > 0 && (
            <span style={{ 
              background: '#9c27b0', 
              color: 'white', 
              borderRadius: 10, 
              padding: '2px 8px', 
              fontSize: '0.7rem',
              marginLeft: 4
            }}>
              {unassignedCount}
            </span>
          )}
        </button>
        <button 
          className={`tab ${statusFilter === 'awaiting' ? 'active' : ''}`}
          onClick={() => setStatusFilter('awaiting')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Clock size={14} />
          Awaiting Material
          {awaitingCount > 0 && (
            <span style={{ 
              background: '#f57c00', 
              color: 'white', 
              borderRadius: 10, 
              padding: '2px 8px', 
              fontSize: '0.7rem',
              marginLeft: 4
            }}>
              {awaitingCount}
            </span>
          )}
        </button>
        <button 
          className={`tab ${statusFilter === 'ready' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ready')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <CheckCircle size={14} />
          Ready to Ship
          {readyCount > 0 && (
            <span style={{ 
              background: '#388e3c', 
              color: 'white', 
              borderRadius: 10, 
              padding: '2px 8px', 
              fontSize: '0.7rem',
              marginLeft: 4
            }}>
              {readyCount}
            </span>
          )}
        </button>
        <button 
          className={`tab ${statusFilter === 'archived' ? 'active' : ''}`}
          onClick={() => setStatusFilter('archived')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Truck size={14} />
          Archived (Shipped)
        </button>
      </div>

      {/* Search and Sort */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder={statusFilter === 'unassigned' 
                ? "Search shipments by client, QR code, description..." 
                : "Search by DR#, client, PO number..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {statusFilter !== 'unassigned' && (
            <select 
              className="form-select" 
              style={{ width: 'auto' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="dr_desc">DR# (Newest)</option>
              <option value="dr_asc">DR# (Oldest)</option>
              <option value="date_desc">Date (Newest)</option>
              <option value="date_asc">Date (Oldest)</option>
              <option value="name_asc">Client A-Z</option>
              <option value="name_desc">Client Z-A</option>
            </select>
          )}
        </div>
      </div>

      {/* Unassigned Shipments View */}
      {statusFilter === 'unassigned' ? (
        filteredShipments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📥</div>
            <div className="empty-state-title">No unassigned shipments</div>
            <p>All received shipments have been assigned to work orders</p>
          </div>
        ) : (
          <>
            {selectedShipments.length > 0 && (
              <div style={{ 
                background: '#e8f5e9', 
                padding: 12, 
                borderRadius: 8, 
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{selectedShipments.length} shipment{selectedShipments.length > 1 ? 's' : ''} selected</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => setSelectedShipments([])}
                  >
                    Clear
                  </button>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => openCreateModal()}
                  >
                    <Plus size={16} /> Create Work Order
                  </button>
                </div>
              </div>
            )}
            
            <div className="grid grid-3">
              {filteredShipments.map((shipment) => (
                <div 
                  key={shipment.id} 
                  className="card"
                  style={{ 
                    cursor: 'pointer',
                    borderLeft: selectedShipments.includes(shipment.id) 
                      ? '4px solid #9c27b0' 
                      : '4px solid #e0e0e0',
                    background: selectedShipments.includes(shipment.id) ? '#f3e5f5' : 'white',
                    transition: 'all 0.15s'
                  }}
                  onClick={() => toggleShipmentSelection(shipment.id)}
                >
                  {/* Checkbox */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedShipments.includes(shipment.id)}
                        onChange={() => {}}
                        style={{ width: 18, height: 18 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          {shipment.clientName || 'Unknown Client'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                          {shipment.qrCode}
                        </div>
                      </div>
                    </div>
                    <span className={`status-badge status-${shipment.status}`}>
                      {shipment.status}
                    </span>
                  </div>

                  {/* Client PO */}
                  {shipment.clientPurchaseOrderNumber && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: 8
                    }}>
                      <FileText size={14} />
                      <span>PO: <strong>{shipment.clientPurchaseOrderNumber}</strong></span>
                    </div>
                  )}

                  {/* Description */}
                  {shipment.description && (
                    <div style={{ 
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: 8,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {shipment.description}
                    </div>
                  )}

                  {/* Location */}
                  {shipment.location && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: 8
                    }}>
                      <MapPin size={14} />
                      <span>{shipment.location}</span>
                    </div>
                  )}

                  {/* Quantity */}
                  {shipment.quantity && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: 8
                    }}>
                      <Package size={14} />
                      <span>Qty: {shipment.quantity}</span>
                    </div>
                  )}

                  {/* Date */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    fontSize: '0.8rem',
                    color: '#999'
                  }}>
                    <Calendar size={14} />
                    <span>Received {formatDate(shipment.receivedAt || shipment.createdAt)}</span>
                  </div>

                  {/* Quick create button */}
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 10, width: '100%' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreateModal(shipment);
                    }}
                  >
                    <Plus size={14} /> Create Work Order
                  </button>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        /* Work Orders View */
        filteredOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">No items found</div>
            <p>
              {searchQuery 
                ? 'Try adjusting your search terms' 
                : statusFilter === 'archived' 
                  ? 'No archived orders yet'
                  : statusFilter === 'awaiting'
                    ? 'No items awaiting material'
                    : 'No items in inventory'}
            </p>
          </div>
        ) : (
          <div className="grid grid-3">
            {filteredOrders.map((order) => (
              <div 
                key={order.id} 
                className="card"
                onClick={() => navigate(`/workorder/${order.id}`)}
                style={{ 
                  cursor: 'pointer',
                  borderLeft: !order.allMaterialReceived && order.pendingInboundCount > 0 
                    ? '4px solid #f57c00' 
                    : order.status === 'completed' 
                      ? '4px solid #388e3c'
                      : '4px solid #e0e0e0',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    {order.drNumber ? (
                      <div style={{ 
                        fontFamily: 'Courier New, monospace', 
                        fontWeight: 700, 
                        fontSize: '1.2rem', 
                        color: '#1976d2',
                        background: '#e3f2fd',
                        padding: '4px 10px',
                        borderRadius: 6,
                        display: 'inline-block'
                      }}>
                        DR-{order.drNumber}
                      </div>
                    ) : (
                      <div style={{ fontWeight: 600, color: '#666' }}>
                        {order.orderNumber}
                      </div>
                    )}
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginTop: 6 }}>
                      {order.clientName}
                    </div>
                  </div>
                  <span className={`status-badge ${getStatusColor(order)}`}>
                    {getStatusLabel(order)}
                  </span>
                </div>

                {/* Client PO */}
                {order.clientPO && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    fontSize: '0.85rem',
                    color: '#666',
                    marginBottom: 8
                  }}>
                    <FileText size={14} />
                    <span>PO: <strong>{order.clientPO}</strong></span>
                  </div>
                )}

                {/* Parts info */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  fontSize: '0.85rem',
                  color: '#666',
                  marginBottom: 8
                }}>
                  <Package size={14} />
                  <span>{order.parts?.length || 0} part{(order.parts?.length || 0) !== 1 ? 's' : ''}</span>
                </div>

                {/* Awaiting material warning */}
                {!order.allMaterialReceived && order.pendingInboundCount > 0 && (
                  <div style={{
                    background: '#fff3e0',
                    border: '1px solid #ffb74d',
                    borderRadius: 6,
                    padding: 8,
                    marginBottom: 8,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <AlertCircle size={14} style={{ color: '#f57c00' }} />
                    <span>Awaiting {order.pendingInboundCount} inbound shipment{order.pendingInboundCount > 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Location */}
                {order.storageLocation && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    fontSize: '0.85rem',
                    color: '#666',
                    marginBottom: 8
                  }}>
                    <MapPin size={14} />
                    <span>{order.storageLocation}</span>
                  </div>
                )}

                {/* Date */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  fontSize: '0.8rem',
                  color: '#999'
                }}>
                  <Calendar size={14} />
                  <span>
                    {statusFilter === 'archived' 
                      ? `Shipped ${formatDate(order.shippedAt || order.archivedAt)}`
                      : formatDate(order.createdAt)
                    }
                  </span>
                </div>

                {/* Estimate link */}
                {order.estimateNumber && (
                  <div style={{ 
                    marginTop: 8, 
                    paddingTop: 8, 
                    borderTop: '1px solid #eee',
                    fontSize: '0.75rem',
                    color: '#7b1fa2'
                  }}>
                    From: {order.estimateNumber}
                  </div>
                )}

                {/* Duplicate button for archived */}
                {statusFilter === 'archived' && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 10, width: '100%' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/workorder/${order.id}?duplicate=true`);
                    }}
                  >
                    📋 Duplicate to New Estimate
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Create Work Order Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Work Order</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            
            <div style={{ padding: 20 }}>
              {selectedShipments.length > 0 && (
                <div style={{ 
                  background: '#e8f5e9', 
                  padding: 12, 
                  borderRadius: 8, 
                  marginBottom: 16,
                  fontSize: '0.9rem'
                }}>
                  <strong>{selectedShipments.length}</strong> shipment{selectedShipments.length > 1 ? 's' : ''} will be linked to this work order
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={newWorkOrder.clientName}
                  onChange={(e) => setNewWorkOrder({ ...newWorkOrder, clientName: e.target.value })}
                  placeholder="Enter client name"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Client PO Number</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={newWorkOrder.clientPO}
                  onChange={(e) => setNewWorkOrder({ ...newWorkOrder, clientPO: e.target.value })}
                  placeholder="Enter PO number"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Job Number</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={newWorkOrder.jobNumber}
                  onChange={(e) => setNewWorkOrder({ ...newWorkOrder, jobNumber: e.target.value })}
                  placeholder="Enter job number"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Project Description / Instructions</label>
                <textarea 
                  className="form-textarea"
                  value={newWorkOrder.projectDescription}
                  onChange={(e) => setNewWorkOrder({ ...newWorkOrder, projectDescription: e.target.value })}
                  placeholder="Enter project description or instructions from client"
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Storage Location</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={newWorkOrder.storageLocation}
                  onChange={(e) => setNewWorkOrder({ ...newWorkOrder, storageLocation: e.target.value })}
                  placeholder="e.g., Bay 1 - Rack A"
                />
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button 
                  className="btn btn-outline" 
                  style={{ flex: 1 }}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  onClick={handleCreateWorkOrder}
                  disabled={saving || !newWorkOrder.clientName.trim()}
                >
                  {saving ? 'Creating...' : 'Create & Assign DR#'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;
