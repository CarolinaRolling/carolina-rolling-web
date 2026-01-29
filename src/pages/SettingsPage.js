import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Mail, Save, ArrowRight } from 'lucide-react';
import { getNotificationEmail, updateNotificationEmail } from '../services/api';

function SettingsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadEmail();
  }, []);

  const loadEmail = async () => {
    try {
      setLoading(true);
      const response = await getNotificationEmail();
      setEmail(response.data.data?.email || '');
    } catch (err) {
      console.error('Failed to load email:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    try {
      setSaving(true);
      setError(null);
      await updateNotificationEmail(email);
      setSuccess('Email saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save email');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="grid grid-2">
        {/* Location Settings */}
        <div 
          className="card" 
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/settings/locations')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 12, 
                background: '#e3f2fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <MapPin size={24} color="#1976d2" />
              </div>
              <div>
                <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Location Settings</h3>
                <p style={{ color: '#666', fontSize: '0.875rem' }}>Configure warehouse map locations</p>
              </div>
            </div>
            <ArrowRight size={20} color="#999" />
          </div>
        </div>

        {/* Email Settings */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12, 
              background: '#fff3e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Mail size={24} color="#e65100" />
            </div>
            <div>
              <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Email Notifications</h3>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Configure new shipment email alerts</p>
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Notification Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              disabled={loading}
            />
          </div>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleSaveEmail}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Email'}
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 16 }}>About</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-item-label">Application</div>
            <div className="detail-item-value">Shipment Tracker Web</div>
          </div>
          <div className="detail-item">
            <div className="detail-item-label">Version</div>
            <div className="detail-item-value">1.0.0</div>
          </div>
          <div className="detail-item">
            <div className="detail-item-label">Company</div>
            <div className="detail-item-value">Carolina Rolling</div>
          </div>
          <div className="detail-item">
            <div className="detail-item-label">API</div>
            <div className="detail-item-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {process.env.REACT_APP_API_URL || 'https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
