import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, Save, Package } from 'lucide-react';
import QRCode from 'qrcode';
import { createShipment, uploadPhotos, uploadDocuments, getLocations } from '../services/api';

function NewShipmentPage() {
  const navigate = useNavigate();
  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);

  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [createdShipment, setCreatedShipment] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const [formData, setFormData] = useState({
    clientName: '',
    jobNumber: '',
    clientPurchaseOrderNumber: '',
    description: '',
    partNumbers: '',
    quantity: 1,
    location: '',
    notes: '',
    receivedBy: '',
    requestedDueDate: '',
    promisedDate: '',
  });

  const [photos, setPhotos] = useState([]);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (createdShipment?.qrCode) {
      generateQRCode(createdShipment.qrCode);
    }
  }, [createdShipment?.qrCode]);

  const loadLocations = async () => {
    try {
      const response = await getLocations();
      setLocations(response.data.data || []);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const generateQRCode = async (code) => {
    try {
      const url = await QRCode.toDataURL(code, { width: 300, margin: 2 });
      setQrCodeUrl(url);
    } catch (err) {
      console.error('QR Code generation failed:', err);
    }
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setPhotos([...photos, ...newPhotos]);
  };

  const handleDocSelect = (e) => {
    const files = Array.from(e.target.files);
    const newDocs = files.map(file => ({
      file,
      name: file.name
    }));
    setDocuments([...documents, ...newDocs]);
  };

  const removePhoto = (index) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index].preview);
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const removeDocument = (index) => {
    const newDocs = [...documents];
    newDocs.splice(index, 1);
    setDocuments(newDocs);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.clientName.trim()) {
      setError('Client name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Create shipment
      const shipmentData = {
        ...formData,
        partNumbers: formData.partNumbers 
          ? formData.partNumbers.split(',').map(p => p.trim()).filter(p => p)
          : [],
        quantity: parseInt(formData.quantity) || 1,
      };

      const response = await createShipment(shipmentData);
      const newShipment = response.data.data;

      // Upload photos if any
      if (photos.length > 0) {
        await uploadPhotos(newShipment.id, photos.map(p => p.file));
      }

      // Upload documents if any
      if (documents.length > 0) {
        await uploadDocuments(newShipment.id, documents.map(d => d.file));
      }

      setCreatedShipment(newShipment);
    } catch (err) {
      setError('Failed to create shipment');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Show success screen with QR code
  if (createdShipment) {
    return (
      <div>
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Shipment Created!</h2>
          <p style={{ color: '#666', marginBottom: 24 }}>{createdShipment.clientName}</p>
          
          {qrCodeUrl && (
            <div style={{ marginBottom: 24 }}>
              <img src={qrCodeUrl} alt="QR Code" style={{ maxWidth: '100%' }} />
              <div style={{ fontFamily: 'monospace', marginTop: 8 }}>{createdShipment.qrCode}</div>
            </div>
          )}

          <div className="actions-row" style={{ justifyContent: 'center' }}>
            <button 
              className="btn btn-outline"
              onClick={() => {
                const link = document.createElement('a');
                link.download = `${createdShipment.qrCode}.png`;
                link.href = qrCodeUrl;
                link.click();
              }}
            >
              Download QR Code
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => navigate(`/shipment/${createdShipment.id}`)}
            >
              View Shipment
            </button>
          </div>
          
          <button 
            className="btn btn-secondary" 
            style={{ marginTop: 16, width: '100%' }}
            onClick={() => {
              setCreatedShipment(null);
              setFormData({
                clientName: '',
                jobNumber: '',
                clientPurchaseOrderNumber: '',
                description: '',
                partNumbers: '',
                quantity: 1,
                location: '',
                notes: '',
                receivedBy: '',
                requestedDueDate: '',
                promisedDate: '',
              });
              setPhotos([]);
              setDocuments([]);
            }}
          >
            Create Another Shipment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-icon btn-secondary" onClick={() => navigate('/inventory')}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="page-title">New Shipment</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
          {/* Main Form */}
          <div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Shipment Information</h3>
              
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Client Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.jobNumber}
                    onChange={(e) => setFormData({ ...formData, jobNumber: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client PO Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.clientPurchaseOrderNumber}
                    onChange={(e) => setFormData({ ...formData, clientPurchaseOrderNumber: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    min="1"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Part Numbers (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.partNumbers}
                    onChange={(e) => setFormData({ ...formData, partNumbers: e.target.value })}
                    placeholder="e.g., PN-001, PN-002"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <select
                    className="form-select"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  >
                    <option value="">Select location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Received By</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.receivedBy}
                    onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Requested Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.requestedDueDate}
                    onChange={(e) => setFormData({ ...formData, requestedDueDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Promised Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.promisedDate}
                    onChange={(e) => setFormData({ ...formData, promisedDate: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Photos</h3>
              </div>
              
              <div 
                className="file-upload"
                onClick={() => photoInputRef.current?.click()}
              >
                <Upload size={32} className="file-upload-icon" />
                <p>Click to select photos</p>
                <p style={{ fontSize: '0.75rem', color: '#999' }}>JPG, PNG, GIF up to 10MB</p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />

              {photos.length > 0 && (
                <div className="photo-grid" style={{ marginTop: 16 }}>
                  {photos.map((photo, index) => (
                    <div key={index} className="photo-item">
                      <img src={photo.preview} alt={photo.name} />
                      <button 
                        type="button"
                        className="photo-item-delete"
                        onClick={() => removePhoto(index)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Documents</h3>
              </div>
              
              <div 
                className="file-upload"
                onClick={() => docInputRef.current?.click()}
              >
                <Upload size={32} className="file-upload-icon" />
                <p>Click to select PDF documents</p>
                <p style={{ fontSize: '0.75rem', color: '#999' }}>PDF files up to 20MB</p>
              </div>
              <input
                ref={docInputRef}
                type="file"
                multiple
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleDocSelect}
              />

              {documents.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  {documents.map((doc, index) => (
                    <div key={index} className="document-item">
                      <Package size={20} style={{ color: '#d32f2f' }} />
                      <span className="document-item-name">{doc.name}</span>
                      <button 
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => removeDocument(index)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card" style={{ position: 'sticky', top: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 16 }}>Summary</h3>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 4 }}>Client</div>
                <div style={{ fontWeight: 500 }}>{formData.clientName || '—'}</div>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 4 }}>Photos</div>
                <div style={{ fontWeight: 500 }}>{photos.length} selected</div>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 4 }}>Documents</div>
                <div style={{ fontWeight: 500 }}>{documents.length} selected</div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                disabled={saving}
              >
                <Save size={18} />
                {saving ? 'Creating...' : 'Create Shipment'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default NewShipmentPage;
