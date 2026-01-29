import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Package, Filter, ArrowUpDown, Truck } from 'lucide-react';
import { getShipments } from '../services/api';

function InventoryPage() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [filteredShipments, setFilteredShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load saved preferences from localStorage
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem('inventory_statusFilter') || 'active';
  });
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('inventory_sortBy') || 'date_desc';
  });

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('inventory_statusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('inventory_sortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    loadShipments();
  }, []);

  useEffect(() => {
    filterAndSortShipments();
  }, [shipments, searchQuery, statusFilter, sortBy]);

  const loadShipments = async () => {
    try {
      setLoading(true);
      const response = await getShipments();
      setShipments(response.data.data || []);
    } catch (err) {
      setError('Failed to load shipments');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortShipments = () => {
    let filtered = [...shipments];

    // Filter by status
    if (statusFilter === 'active') {
      filtered = filtered.filter(s => s.status !== 'shipped');
    } else if (statusFilter === 'shipped') {
      filtered = filtered.filter(s => s.status === 'shipped');
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.clientName?.toLowerCase().includes(query) ||
        s.jobNumber?.toLowerCase().includes(query) ||
        s.qrCode?.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.receivedAt) - new Date(a.receivedAt);
        case 'date_asc':
          return new Date(a.receivedAt) - new Date(b.receivedAt);
        case 'name_asc':
          return (a.clientName || '').localeCompare(b.clientName || '');
        case 'name_desc':
          return (b.clientName || '').localeCompare(a.clientName || '');
        default:
          return 0;
      }
    });

    setFilteredShipments(filtered);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'received': return 'status-received';
      case 'in_progress': return 'status-in_progress';
      case 'completed': return 'status-completed';
      case 'shipped': return 'status-shipped';
      default: return 'status-received';
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {statusFilter === 'shipped' ? 'Shipped Orders' : 'Inventory'}
        </h1>
        <button className="btn btn-primary" onClick={() => navigate('/new-shipment')}>
          <Package size={18} />
          New Shipment
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${statusFilter === 'active' ? 'active' : ''}`}
          onClick={() => setStatusFilter('active')}
        >
          Active Inventory
        </button>
        <button 
          className={`tab ${statusFilter === 'shipped' ? 'active' : ''}`}
          onClick={() => setStatusFilter('shipped')}
        >
          <Truck size={16} style={{ marginRight: 6 }} />
          Shipped Orders
        </button>
      </div>

      {/* Search and Sort */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search by client, job number, or description..."
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
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </div>
      </div>

      {/* Shipment Grid */}
      {filteredShipments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-title">No shipments found</div>
          <p>
            {searchQuery 
              ? 'Try adjusting your search terms' 
              : statusFilter === 'shipped' 
                ? 'No shipped orders yet'
                : 'Create a new shipment to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-3">
          {filteredShipments.map((shipment) => (
            <div 
              key={shipment.id} 
              className="card shipment-card"
              onClick={() => navigate(`/shipment/${shipment.id}`)}
            >
              <div className="shipment-card-header">
                <div>
                  <div className="shipment-card-title">{shipment.clientName}</div>
                  <div className="shipment-card-subtitle">
                    {shipment.jobNumber || shipment.qrCode}
                  </div>
                </div>
                <span className={`status-badge ${getStatusColor(shipment.status)}`}>
                  {shipment.status?.replace('_', ' ')}
                </span>
              </div>
              <div className="shipment-card-info">
                {shipment.description && (
                  <div className="shipment-card-info-row">
                    <Package size={14} />
                    <span>{shipment.description.substring(0, 50)}...</span>
                  </div>
                )}
                <div className="shipment-card-info-row">
                  <MapPin size={14} />
                  <span>{shipment.location || 'No location'}</span>
                </div>
                <div className="shipment-card-info-row">
                  <Calendar size={14} />
                  <span>{formatDate(shipment.receivedAt)}</span>
                </div>
              </div>
              {shipment.photos?.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 4 }}>
                  {shipment.photos.slice(0, 3).map((photo, idx) => (
                    <img 
                      key={idx}
                      src={photo.url} 
                      alt=""
                      style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 4, 
                        objectFit: 'cover' 
                      }}
                    />
                  ))}
                  {shipment.photos.length > 3 && (
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 4, 
                      background: '#e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      color: '#666'
                    }}>
                      +{shipment.photos.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InventoryPage;
