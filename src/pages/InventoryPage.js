import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Package, Truck, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';
import { getWorkOrders, getArchivedWorkOrders } from '../services/api';

function InventoryPage() {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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
    loadWorkOrders();
  }, [statusFilter]);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      let response;
      if (statusFilter === 'archived') {
        response = await getArchivedWorkOrders();
      } else {
        response = await getWorkOrders({ archived: 'false' });
      }
      setWorkOrders(response.data.data || []);
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
    } else if (statusFilter !== 'archived' && statusFilter !== 'active') {
      // active shows all non-archived
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.clientName?.toLowerCase().includes(query) ||
        o.orderNumber?.toLowerCase().includes(query) ||
        o.clientPurchaseOrderNumber?.toLowerCase().includes(query) ||
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

  const filteredOrders = getFilteredOrders();

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
          {statusFilter === 'archived' ? '📁 Archived Orders' : '📦 Inventory'}
        </h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${statusFilter === 'active' ? 'active' : ''}`}
          onClick={() => setStatusFilter('active')}
        >
          All Active
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
              placeholder="Search by DR#, client, PO number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
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
        </div>
      </div>

      {/* Inventory Grid */}
      {filteredOrders.length === 0 ? (
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
              {order.clientPurchaseOrderNumber && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  fontSize: '0.85rem',
                  color: '#666',
                  marginBottom: 8
                }}>
                  <FileText size={14} />
                  <span>PO: <strong>{order.clientPurchaseOrderNumber}</strong></span>
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
      )}
    </div>
  );
}

export default InventoryPage;
