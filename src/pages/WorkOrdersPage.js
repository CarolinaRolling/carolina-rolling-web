import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronDown, ChevronRight, ClipboardList, User, Calendar, Package, Trash2 } from 'lucide-react';
import { getWorkOrders, createWorkOrder, deleteWorkOrder } from '../services/api';

function WorkOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedClients, setExpandedClients] = useState({});
  const [newOrder, setNewOrder] = useState({
    clientName: '',
    clientPurchaseOrderNumber: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
    receivedBy: '',
    requestedDueDate: '',
    promisedDate: '',
  });

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await getWorkOrders();
      setOrders(response.data.data || []);
    } catch (err) {
      setError('Failed to load work orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAndGroupedOrders = () => {
    let filtered = [...orders];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.clientName?.toLowerCase().includes(query) ||
        o.orderNumber?.toLowerCase().includes(query) ||
        o.clientPurchaseOrderNumber?.toLowerCase().includes(query) ||
        o.contactName?.toLowerCase().includes(query)
      );
    }

    // Group by client
    const grouped = filtered.reduce((acc, order) => {
      const client = order.clientName || 'Unknown Client';
      if (!acc[client]) {
        acc[client] = [];
      }
      acc[client].push(order);
      return acc;
    }, {});

    // Sort clients alphabetically
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {});
  };

  const groupedOrders = getFilteredAndGroupedOrders();

  const toggleClient = (client) => {
    setExpandedClients(prev => ({
      ...prev,
      [client]: !prev[client]
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newOrder.clientName.trim()) {
      setError('Client name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await createWorkOrder({
        ...newOrder,
        status: 'draft'
      });
      const createdOrder = response.data.data;
      navigate(`/workorders/${createdOrder.id}`);
    } catch (err) {
      setError('Failed to create work order');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this work order and all its parts?')) return;
    try {
      await deleteWorkOrder(id);
      await loadOrders();
    } catch (err) {
      setError('Failed to delete work order');
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

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { label: 'Draft', class: 'status-badge', style: { background: '#e0e0e0', color: '#555' } },
      received: { label: 'Received', class: 'status-badge status-received', style: {} },
      in_progress: { label: 'In Progress', class: 'status-badge status-in_progress', style: {} },
      completed: { label: 'Completed', class: 'status-badge status-completed', style: {} },
      picked_up: { label: 'Picked Up', class: 'status-badge status-shipped', style: {} },
    };
    const config = statusMap[status] || statusMap.draft;
    return <span className={config.class} style={config.style}>{config.label}</span>;
  };

  const totalOrders = Object.values(groupedOrders).reduce((sum, arr) => sum + arr.length, 0);
  const clientCount = Object.keys(groupedOrders).length;

  // Auto-expand all clients on first load or when filter changes
  useEffect(() => {
    const expanded = {};
    Object.keys(groupedOrders).forEach(client => {
      expanded[client] = expandedClients[client] !== false;
    });
    if (Object.keys(expanded).length > 0 && Object.keys(expandedClients).length === 0) {
      setExpandedClients(expanded);
    }
  }, [orders, statusFilter, searchQuery]);

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
        <div>
          <h1 className="page-title">Work Orders</h1>
          <p style={{ color: '#666', fontSize: '0.875rem', marginTop: 4 }}>
            {totalOrders} orders from {clientCount} clients
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
          <Plus size={18} />
          New Work Order
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search by client, order number, PO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            {['all', 'draft', 'received', 'in_progress', 'completed', 'picked_up'].map(status => (
              <button
                key={status}
                className={`tab ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      </div>

      {clientCount === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No work orders</div>
          <p>{searchQuery || statusFilter !== 'all' ? 'No orders match your filters' : 'Create a work order to get started'}</p>
        </div>
      ) : (
        <div>
          {Object.entries(groupedOrders).map(([client, clientOrders]) => (
            <div key={client} className="card" style={{ marginBottom: 16 }}>
              {/* Client Header */}
              <div
                onClick={() => toggleClient(client)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '4px 0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {expandedClients[client] ? (
                    <ChevronDown size={20} color="#666" />
                  ) : (
                    <ChevronRight size={20} color="#666" />
                  )}
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: '#e8f5e9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User size={20} color="#388e3c" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{client}</h3>
                    <p style={{ color: '#666', fontSize: '0.8rem' }}>
                      {clientOrders.length} order{clientOrders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Orders List */}
              {expandedClients[client] && (
                <div style={{ marginTop: 16, marginLeft: 32 }}>
                  {clientOrders.map((order, index) => (
                    <div
                      key={order.id}
                      style={{
                        padding: 16,
                        background: '#f9f9f9',
                        borderRadius: 8,
                        marginBottom: index < clientOrders.length - 1 ? 12 : 0,
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => navigate(`/workorders/${order.id}`)}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#f9f9f9'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <ClipboardList size={16} color="#1976d2" />
                            <span style={{ fontWeight: 600, color: '#1976d2' }}>
                              {order.orderNumber}
                            </span>
                            {getStatusBadge(order.status)}
                          </div>

                          {order.clientPurchaseOrderNumber && (
                            <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: 4 }}>
                              PO# {order.clientPurchaseOrderNumber}
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#666', fontSize: '0.85rem' }}>
                              <Package size={14} />
                              <span>{order.parts?.length || 0} parts</span>
                            </div>
                            {order.promisedDate && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#666', fontSize: '0.85rem' }}>
                                <Calendar size={14} />
                                <span>Due {formatDate(order.promisedDate)}</span>
                              </div>
                            )}
                          </div>

                          <div style={{ color: '#999', fontSize: '0.8rem', marginTop: 8 }}>
                            Created {formatDate(order.createdAt)}
                          </div>
                        </div>

                        <button
                          className="btn btn-sm btn-danger"
                          onClick={(e) => handleDelete(order.id, e)}
                          style={{ marginLeft: 12 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Order Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">New Work Order</h3>
              <button className="modal-close" onClick={() => setShowNewModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="grid grid-2">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Client Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newOrder.clientName}
                    onChange={(e) => setNewOrder({ ...newOrder, clientName: e.target.value })}
                    placeholder="e.g., Smith Manufacturing"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client PO Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newOrder.clientPurchaseOrderNumber}
                    onChange={(e) => setNewOrder({ ...newOrder, clientPurchaseOrderNumber: e.target.value })}
                    placeholder="e.g., PO-2024-001"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newOrder.contactName}
                    onChange={(e) => setNewOrder({ ...newOrder, contactName: e.target.value })}
                    placeholder="e.g., John Smith"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={newOrder.contactPhone}
                    onChange={(e) => setNewOrder({ ...newOrder, contactPhone: e.target.value })}
                    placeholder="e.g., (555) 123-4567"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newOrder.contactEmail}
                    onChange={(e) => setNewOrder({ ...newOrder, contactEmail: e.target.value })}
                    placeholder="e.g., john@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Requested Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newOrder.requestedDueDate}
                    onChange={(e) => setNewOrder({ ...newOrder, requestedDueDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Promised Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newOrder.promisedDate}
                    onChange={(e) => setNewOrder({ ...newOrder, promisedDate: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                    placeholder="Any special instructions or notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create & Add Parts'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrdersPage;
