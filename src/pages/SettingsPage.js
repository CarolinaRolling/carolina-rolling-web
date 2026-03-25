import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Mail, Save, ArrowRight, DollarSign, Archive, Plus, Edit3, Trash2 } from 'lucide-react';
import { getNotificationEmail, updateNotificationEmail, getSettings, updateSettings, getWeldProcedures, createWeldProcedure, updateWeldProcedure, deleteWeldProcedure } from '../services/api';

function SettingsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // WPS Management
  const [wpsList, setWpsList] = useState([]);
  const [showWpsModal, setShowWpsModal] = useState(false);
  const [editWps, setEditWps] = useState(null);
  const [wf, setWf] = useState({ wpsNumber:'', name:'', process:'SMAW', processType:'Manual', baseMaterials:'', sfaSpecification:'', awsClassification:'', fillerSize:'', weldingPosition:'', beadType:'', jointType:'', backGouging:'', passType:'', preheat:'', current:'', voltage:'', notes:'', updatedBy:'Jason Thornton' });

  // Tax and markup settings
  const [taxSettings, setTaxSettings] = useState({
    defaultTaxRate: 7.0,
    taxLabel: 'NC Sales Tax',
    materialMarkup: 20,
    otherServicesMarkup: 15,
    archiveAfterMonths: 1,
    keepArchivedYears: 2
  });

  useEffect(() => {
    loadSettings();
    loadWps();
  }, []);

  const loadWps = async () => {
    try { const r = await getWeldProcedures(); setWpsList(r.data.data || []); } catch {}
  };
  const emptyWf = { wpsNumber:'', name:'', process:'SMAW', processType:'Manual', baseMaterials:'', sfaSpecification:'', awsClassification:'', fillerSize:'', weldingPosition:'', beadType:'', jointType:'', backGouging:'', passType:'', preheat:'', current:'', voltage:'', notes:'', updatedBy:'Jason Thornton' };
  const saveWps = async () => {
    if (!wf.wpsNumber || !wf.name) { setError('WPS Number and Name required'); return; }
    try {
      if (editWps) await updateWeldProcedure(editWps.id, wf);
      else await createWeldProcedure(wf);
      setShowWpsModal(false); setEditWps(null); setWf(emptyWf);
      setSuccess(editWps ? 'WPS updated' : 'WPS created');
      await loadWps();
    } catch { setError('Failed to save WPS'); }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await getNotificationEmail();
      setEmail(response.data.data?.email || '');
      
      // Try to load tax settings
      try {
        const taxResponse = await getSettings('tax_settings');
        if (taxResponse.data.data?.value) {
          setTaxSettings(prev => ({ ...prev, ...taxResponse.data.data.value }));
        }
      } catch (e) {
        // Settings might not exist yet
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    try {
      setSaving(true);
      setError(null);
      await updateNotificationEmail(email);
      showSuccess('Email saved successfully');
    } catch (err) {
      setError('Failed to save email');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTaxSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      await updateSettings('tax_settings', taxSettings);
      showSuccess('Tax settings saved');
    } catch (err) {
      setError('Failed to save tax settings');
    } finally {
      setSaving(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
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
          onClick={() => navigate('/admin/settings/locations')}
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

        {/* Email Settings (original) */}
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

      {/* Tax Settings */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 12, 
            background: '#e8f5e9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <DollarSign size={24} color="#388e3c" />
          </div>
          <div>
            <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Tax & Pricing Settings</h3>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>Configure default tax rate and markups for estimates</p>
          </div>
        </div>
        
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">Default Tax Rate (%)</label>
            <input
              type="number"
              className="form-input"
              value={taxSettings.defaultTaxRate}
              onChange={(e) => setTaxSettings({ ...taxSettings, defaultTaxRate: parseFloat(e.target.value) || 0 })}
              step="0.1"
            />
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>Applied to all new estimates</p>
          </div>
          <div className="form-group">
            <label className="form-label">Tax Label</label>
            <input
              type="text"
              className="form-input"
              value={taxSettings.taxLabel}
              onChange={(e) => setTaxSettings({ ...taxSettings, taxLabel: e.target.value })}
              placeholder="e.g., NC Sales Tax"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Default Material Markup (%)</label>
            <input
              type="number"
              className="form-input"
              value={taxSettings.materialMarkup}
              onChange={(e) => setTaxSettings({ ...taxSettings, materialMarkup: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Default Other Services Markup (%)</label>
            <input
              type="number"
              className="form-input"
              value={taxSettings.otherServicesMarkup}
              onChange={(e) => setTaxSettings({ ...taxSettings, otherServicesMarkup: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSaveTaxSettings} disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Tax Settings'}
        </button>
      </div>

      {/* Archive Settings */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 12, 
            background: '#f3e5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Archive size={24} color="#7b1fa2" />
          </div>
          <div>
            <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Archive Settings</h3>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>Configure estimate archiving rules</p>
          </div>
        </div>
        
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">Auto-archive estimates after</label>
            <select
              className="form-select"
              value={taxSettings.archiveAfterMonths}
              onChange={(e) => setTaxSettings({ ...taxSettings, archiveAfterMonths: parseInt(e.target.value) })}
            >
              <option value={1}>1 month</option>
              <option value={2}>2 months</option>
              <option value={3}>3 months</option>
              <option value={0}>Never</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Keep archived estimates for</label>
            <select
              className="form-select"
              value={taxSettings.keepArchivedYears}
              onChange={(e) => setTaxSettings({ ...taxSettings, keepArchivedYears: parseInt(e.target.value) })}
            >
              <option value={1}>1 year</option>
              <option value={2}>2 years</option>
              <option value={5}>5 years</option>
              <option value={99}>Forever</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSaveTaxSettings} disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Archive Settings'}
        </button>
      </div>

      {/* Weld Procedures (WPS) Management */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="card-title" style={{ margin: 0 }}>🔥 Weld Procedure Specifications (WPS)</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditWps(null); setWf(emptyWf); setShowWpsModal(true); }}><Plus size={16} /> Add WPS</button>
        </div>
        {wpsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>No weld procedures yet. Add your first WPS.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {wpsList.map(w => (
              <div key={w.id} style={{ padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{w.wpsNumber}</div>
                  <div style={{ fontSize: '0.85rem', color: '#555' }}>{w.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
                    {w.process} • {w.processType} • {w.baseMaterials || '—'} • {w.awsClassification || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditWps(w); setWf({ wpsNumber: w.wpsNumber, name: w.name, process: w.process || '', processType: w.processType || '', baseMaterials: w.baseMaterials || '', sfaSpecification: w.sfaSpecification || '', awsClassification: w.awsClassification || '', fillerSize: w.fillerSize || '', weldingPosition: w.weldingPosition || '', beadType: w.beadType || '', jointType: w.jointType || '', backGouging: w.backGouging || '', passType: w.passType || '', preheat: w.preheat || '', current: w.current || '', voltage: w.voltage || '', notes: w.notes || '', updatedBy: w.updatedBy || '' }); setShowWpsModal(true); }} className="btn btn-sm btn-outline"><Edit3 size={14} /> Edit</button>
                  <button onClick={async () => { if (!window.confirm(`Delete WPS ${w.wpsNumber}?`)) return; try { await deleteWeldProcedure(w.id); await loadWps(); setSuccess('WPS deleted'); } catch { setError('Failed'); } }} className="btn btn-sm" style={{ color: '#c62828', border: '1px solid #c62828', background: 'white' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WPS Modal */}
      {showWpsModal && (
        <div className="modal-overlay"><div className="modal" style={{ maxWidth: 650, maxHeight: '90vh', overflow: 'auto' }}>
          <div className="modal-header">
            <h3 className="modal-title">{editWps ? 'Edit' : 'Add'} Weld Procedure</h3>
            <button className="modal-close" onClick={() => setShowWpsModal(false)}>&times;</button>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">WPS Number *</label><input className="form-input" value={wf.wpsNumber} onChange={e => setWf({...wf, wpsNumber: e.target.value})} placeholder="e.g. P-1-S-A-02VLH"/></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Name *</label><input className="form-input" value={wf.name} onChange={e => setWf({...wf, name: e.target.value})} placeholder="e.g. SMAW Carbon Steel Butt Weld"/></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Process</label>
                <select className="form-select" value={wf.process} onChange={e => setWf({...wf, process: e.target.value})}>
                  <option value="SMAW">SMAW (Stick)</option><option value="GMAW">GMAW (MIG)</option><option value="GTAW">GTAW (TIG)</option><option value="FCAW">FCAW (Flux-Core)</option><option value="SAW">SAW (Submerged Arc)</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Type</label>
                <select className="form-select" value={wf.processType} onChange={e => setWf({...wf, processType: e.target.value})}>
                  <option value="Manual">Manual</option><option value="Semi-Automatic">Semi-Automatic</option><option value="Automatic">Automatic</option>
                </select>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #eee', paddingTop: 10 }}><strong style={{ fontSize: '0.85rem', color: '#555' }}>Base Materials</strong></div>
            <div className="form-group" style={{ margin: 0 }}><input className="form-input" value={wf.baseMaterials} onChange={e => setWf({...wf, baseMaterials: e.target.value})} placeholder="e.g. P1 Group 1&2 to P1 Group 1&2"/></div>
            <div style={{ borderTop: '1px solid #eee', paddingTop: 10 }}><strong style={{ fontSize: '0.85rem', color: '#555' }}>Filler</strong></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">SFA Spec</label><input className="form-input" value={wf.sfaSpecification} onChange={e => setWf({...wf, sfaSpecification: e.target.value})} placeholder="e.g. A5.1"/></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">AWS Classification</label><input className="form-input" value={wf.awsClassification} onChange={e => setWf({...wf, awsClassification: e.target.value})} placeholder="e.g. E7018"/></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Filler Size</label><input className="form-input" value={wf.fillerSize} onChange={e => setWf({...wf, fillerSize: e.target.value})} placeholder='e.g. 1/8" - 3/16"'/></div>
            </div>
            <div style={{ borderTop: '1px solid #eee', paddingTop: 10 }}><strong style={{ fontSize: '0.85rem', color: '#555' }}>Technique</strong></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Position</label><input className="form-input" value={wf.weldingPosition} onChange={e => setWf({...wf, weldingPosition: e.target.value})} placeholder="e.g. G2"/></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Bead Type</label>
                <select className="form-select" value={wf.beadType} onChange={e => setWf({...wf, beadType: e.target.value})}>
                  <option value="">Select...</option><option value="Weave">Weave</option><option value="Stringer">Stringer</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Joint Type</label>
                <select className="form-select" value={wf.jointType} onChange={e => setWf({...wf, jointType: e.target.value})}>
                  <option value="">Select...</option><option value="Butt">Butt</option><option value="Fillet">Fillet</option><option value="Lap">Lap</option><option value="Corner">Corner</option><option value="Edge">Edge</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Back Gouging</label><input className="form-input" value={wf.backGouging} onChange={e => setWf({...wf, backGouging: e.target.value})} placeholder="e.g. Air Carbon Arc as Necessary"/></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Pass Type</label><input className="form-input" value={wf.passType} onChange={e => setWf({...wf, passType: e.target.value})} placeholder="e.g. Intermittent as Necessary"/></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Preheat</label><input className="form-input" value={wf.preheat} onChange={e => setWf({...wf, preheat: e.target.value})} placeholder="e.g. 175° F"/></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Current</label><input className="form-input" value={wf.current} onChange={e => setWf({...wf, current: e.target.value})} placeholder="e.g. 50-850 Amp DC"/></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Voltage</label><input className="form-input" value={wf.voltage} onChange={e => setWf({...wf, voltage: e.target.value})} placeholder="e.g. 40"/></div>
            </div>
            <div style={{ borderTop: '1px solid #eee', paddingTop: 10 }}><strong style={{ fontSize: '0.85rem', color: '#555' }}>Procedure Notes</strong></div>
            <div className="form-group" style={{ margin: 0 }}><textarea className="form-textarea" value={wf.notes} onChange={e => setWf({...wf, notes: e.target.value})} rows={6} placeholder="Step-by-step procedure instructions..."/></div>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Updated By</label><input className="form-input" value={wf.updatedBy} onChange={e => setWf({...wf, updatedBy: e.target.value})}/></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowWpsModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveWps}>{editWps ? 'Update' : 'Create'} WPS</button>
          </div>
        </div></div>
      )}

      {/* App Info */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 16 }}>About</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-item-label">Application</div>
            <div className="detail-item-value">CR Admin Web</div>
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
