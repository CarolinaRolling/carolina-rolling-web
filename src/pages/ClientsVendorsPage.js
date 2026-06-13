import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Users, Building2, Search, Check, X } from 'lucide-react';
import { getClients, createClient, updateClient, deleteClient, getVendors, createVendor, updateVendor, deleteVendor, verifySinglePermit, startBatchVerification, getBatchStatus, downloadResaleReport, getWorkOrders, getEstimates, getVendorHistory, mergeClient, getClientHistory, getClientStatementPdf } from '../services/api';

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)})${digits.slice(3)}`;
  return `(${digits.slice(0,3)})${digits.slice(3,6)}-${digits.slice(6)}`;
};

const formatResale = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};

const isValidResale = (val) => {
  if (!val) return false;
  return /^\d{3}-\d{6}$/.test(val.trim());
};

const ClientsVendorsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [mergeModal, setMergeModal] = useState(null); // { target: client }
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [merging, setMerging] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Selected item for detail view
  const [selectedItem, setSelectedItem] = useState(null);
  const [workHistory, setWorkHistory] = useState([]);
  const [clientHistory, setClientHistory] = useState(null); // full history {workOrders, payments, creditMemos, refunds, openBalance}
  const [vendorHistory, setVendorHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState('workorders'); // workorders | payments | credits | refunds
  const [showAccounting, setShowAccounting] = useState(true);
  const [statementLoading, setStatementLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [showInactive]);

  // Auto-open add client form if navigated with ?addClient=Name
  useEffect(() => {
    const addClientName = searchParams.get('addClient');
    if (addClientName && !loading) {
      setActiveTab('clients');
      setEditing(null);
      setFormData({
        name: addClientName,
        address: '', taxStatus: 'taxable', resaleCertificate: '',
        customTaxRate: '', paymentTerms: '', apEmail: '', quickbooksName: '', notes: '',
        contacts: [], accountingContactName: '', accountingContactEmail: '', accountingContactPhone: ''
      });
      setShowModal(true);
      // Clear the query param so it doesn't re-trigger
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, loading]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsRes, vendorsRes] = await Promise.all([
        getClients({ active: showInactive ? undefined : 'true' }),
        getVendors({ active: showInactive ? undefined : 'true' })
      ]);
      const freshClients = clientsRes.data.data || [];
      const freshVendors = vendorsRes.data.data || [];
      setClients(freshClients);
      setVendors(freshVendors);
      // Refresh selectedItem so the detail panel reflects the latest saved data
      setSelectedItem(prev => {
        if (!prev) return prev;
        const updated = [...freshClients, ...freshVendors].find(i => i.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Client functions
  const openClientModal = (client = null) => {
    setEditing(client);
    if (client) {
      const data = { ...client };
      // Migrate legacy single contact into contacts array if not already there
      if (data.contactName && (!data.contacts || !data.contacts.some(c => c.isPrimary))) {
        const existing = data.contacts || [];
        data.contacts = [{ name: data.contactName, email: data.contactEmail || '', phone: data.contactPhone || '', role: '', isPrimary: true }, ...existing.map(c => ({ ...c, isPrimary: false }))];
      }
      if (!data.contacts) data.contacts = [];
      // Migrate emailScanAddresses to monitored flag on contacts
      const scanAddrs = (data.emailScanAddresses || []).map(a => a.toLowerCase());
      data.contacts = data.contacts.map(c => ({
        ...c,
        monitored: c.monitored || (c.email && scanAddrs.includes(c.email.toLowerCase()))
      }));
      // Sync primary contact back to top-level legacy fields (backend still reads them)
      const primary = data.contacts.find(c => c.isPrimary) || data.contacts[0];
      if (primary) {
        data.contactName = primary.name || '';
        data.contactEmail = primary.email || '';
        data.contactPhone = primary.phone || '';
      }
      setFormData(data);
    } else {
      setFormData({
        name: '',
        address: '',
        taxStatus: 'taxable',
        resaleCertificate: '',
        customTaxRate: '',
        paymentTerms: '', apEmail: '', quickbooksName: '',
        notes: '',
        contacts: [],
        accountingContactName: '',
        accountingContactEmail: '',
        accountingContactPhone: ''
      });
    }
    setShowModal(true);
  };

  const handleSaveClient = async () => {
    if (!formData.name?.trim()) {
      setError('Client name is required');
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateClient(editing.id, formData);
        showMessage('Client updated');
      } else {
        await createClient(formData);
        showMessage('Client created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`Deactivate client "${client.name}"?`)) return;
    try {
      await deleteClient(client.id);
      showMessage('Client deactivated');
      loadData();
    } catch (err) {
      setError('Failed to deactivate client');
    }
  };

  const handleReactivateClient = async (client) => {
    try {
      await updateClient(client.id, { isActive: true });
      showMessage('Client reactivated');
      loadData();
    } catch (err) {
      setError('Failed to reactivate client');
    }
  };

  const handleVerifyPermit = async (clientId, permitNumber) => {
    if (!permitNumber || !permitNumber.trim()) {
      setError('No resale certificate number to verify');
      return;
    }
    try {
      setVerifying(true);
      const res = await verifySinglePermit({ clientId, permitNumber: permitNumber.trim() });
      const result = res.data?.data;
      if (result) {
        // Update local formData if editing this client
        if (editing && editing.id === clientId) {
          setFormData(prev => ({
            ...prev,
            permitStatus: result.status,
            permitLastVerified: result.verifiedDate,
            permitRawResponse: result.rawResponse,
            permitOwnerName: result.ownerName || '',
            permitDbaName: result.dbaName || '',
            _permitRawFields: result.rawFields || {},
            _permitLabelMap: result.labelMap || {},
            // Auto-set tax status to resale when permit is verified active
            ...(result.status === 'active' ? { taxStatus: 'resale' } : {})
          }));
        }
        showMessage(`Permit verified: ${result.status.toUpperCase()}${result.rawResponse ? ' — ' + result.rawResponse : ''}`);
        loadData();
      }
    } catch (err) {
      setError('Failed to verify permit: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setVerifying(false);
    }
  };

  // Vendor functions
  const openVendorModal = (vendor = null) => {
    setEditing(vendor);
    if (vendor) {
      const data = { ...vendor };
      if (data.contactName && (!data.contacts || !data.contacts.some(c => c.isPrimary))) {
        const existing = data.contacts || [];
        data.contacts = [{ name: data.contactName, email: data.contactEmail || '', phone: data.contactPhone || '', role: '', isPrimary: true }, ...existing.map(c => ({ ...c, isPrimary: false }))];
      }
      if (!data.contacts) data.contacts = [];
      const scanAddrs = (data.emailScanAddresses || []).map(a => a.toLowerCase());
      data.contacts = data.contacts.map(c => ({
        ...c,
        monitored: c.monitored || (c.email && scanAddrs.includes(c.email.toLowerCase()))
      }));
      const primary = data.contacts.find(c => c.isPrimary) || data.contacts[0];
      if (primary) {
        data.contactName = primary.name || '';
        data.contactEmail = primary.email || '';
        data.contactPhone = primary.phone || '';
      }
      setFormData(data);
    } else {
      setFormData({
        name: '',
        address: '',
        accountNumber: '',
        notes: '',
        contacts: [],
        accountingContactName: '',
        accountingContactEmail: '',
        accountingContactPhone: ''
      });
    }
    setShowModal(true);
  };

  const handleSaveVendor = async () => {
    if (!formData.name?.trim()) {
      setError('Vendor name is required');
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateVendor(editing.id, formData);
        showMessage('Vendor updated');
      } else {
        await createVendor(formData);
        showMessage('Vendor created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    if (!window.confirm(`Deactivate vendor "${vendor.name}"?`)) return;
    try {
      await deleteVendor(vendor.id);
      showMessage('Vendor deactivated');
      loadData();
    } catch (err) {
      setError('Failed to deactivate vendor');
    }
  };

  const handleReactivateVendor = async (vendor) => {
    try {
      await updateVendor(vendor.id, { isActive: true });
      showMessage('Vendor reactivated');
      loadData();
    } catch (err) {
      setError('Failed to reactivate vendor');
    }
  };

  // Filter data
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.contactName?.toLowerCase().includes(search.toLowerCase())
  );

  const getTaxStatusBadge = (status) => {
    const styles = {
      taxable: { bg: '#e3f2fd', color: '#1565c0', label: 'Taxable' },
      resale: { bg: '#fff3e0', color: '#e65100', label: 'Resale' },
      exempt: { bg: '#e8f5e9', color: '#2e7d32', label: 'Tax Exempt' }
    };
    const s = styles[status] || styles.taxable;
    return (
      <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 500 }}>
        {s.label}
      </span>
    );
  };

  const selectItem = async (item) => {
    setSelectedItem(item);
    setHistoryLoading(true);
    setHistoryTab('workorders');
    if (activeTab === 'clients') {
      setVendorHistory(null);
      setClientHistory(null);
      try {
        const r = await getClientHistory(item.id);
        setClientHistory(r.data.data);
        setWorkHistory(r.data.data.workOrders || []);
      } catch {
        // Fallback to old method
        try {
          const res = await getWorkOrders({ clientId: item.id, limit: 100, archived: 'true' });
          const wos = res.data.data || [];
          const res2 = await getWorkOrders({ clientId: item.id, limit: 100, archived: 'false' });
          const allWOs = [...wos, ...(res2.data.data || [])];
          const seen = new Set();
          const unique = allWOs.filter(w => { if (seen.has(w.id)) return false; seen.add(w.id); return true; });
          unique.sort((a, b) => (b.drNumber || 0) - (a.drNumber || 0));
          setWorkHistory(unique);
        } catch { setWorkHistory([]); }
      }
      finally { setHistoryLoading(false); }
    } else {
      setWorkHistory([]);
      setClientHistory(null);
      try {
        const res = await getVendorHistory(item.id);
        setVendorHistory(res.data.data);
      } catch { setVendorHistory(null); }
      finally { setHistoryLoading(false); }
    }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clients & Vendors</h1>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${activeTab === 'clients' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setActiveTab('clients'); setSelectedItem(null); setWorkHistory([]); }}>
          <Users size={18} /> Clients ({clients.length})
        </button>
        <button className={`btn ${activeTab === 'vendors' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setActiveTab('vendors'); setSelectedItem(null); setWorkHistory([]); }}>
          <Building2 size={18} /> Vendors ({vendors.length})
        </button>
        <button className={`btn ${activeTab === 'permits' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('permits')}>
          🔐 Permit Status
        </button>
      </div>

      {/* Master-Detail Layout */}
      {(activeTab === 'clients' || activeTab === 'vendors') && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, height: 'calc(100vh - 180px)' }}>
          {/* LEFT: Scrollable List */}
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', background: 'white', height: '100%' }}>
            {/* Search + Add */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 6, background: '#fafafa' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                <input className="form-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30, fontSize: '0.85rem', padding: '6px 8px 6px 30px' }} />
              </div>
              <button onClick={() => activeTab === 'clients' ? openClientModal() : openVendorModal()} style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 6, padding: '0 10px', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }} title="Add new">+</button>
            </div>
            <div style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#888' }}>
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ width: 14, height: 14 }} /> Inactive
              </label>
            </div>
            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(activeTab === 'clients' ? filteredClients : filteredVendors).map(item => (
                <div key={item.id} onClick={() => selectItem(item)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                    background: selectedItem?.id === item.id ? '#e3f2fd' : 'white',
                    borderLeft: selectedItem?.id === item.id ? '3px solid #1976d2' : '3px solid transparent',
                    opacity: item.isActive ? 1 : 0.5,
                    transition: 'all 0.1s'
                  }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                  {(() => {
                    const primary = (item.contacts || []).find(c => c.isPrimary) || (item.contacts || [])[0];
                    const name = primary?.name || item.contactName;
                    return name ? <div style={{ fontSize: '0.8rem', color: '#666' }}>{name}{primary?.role ? <span style={{ color: '#1976d2', marginLeft: 4, fontSize: '0.75rem' }}>({primary.role})</span> : null}</div> : null;
                  })()}
                  {activeTab === 'clients' && item.taxStatus && (
                    <div style={{ marginTop: 2 }}>{getTaxStatusBadge(item.taxStatus)}</div>
                  )}
                  {activeTab === 'vendors' && item.accountNumber && (
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>Acct: {item.accountNumber}</div>
                  )}
                  {!item.isActive && <div style={{ fontSize: '0.7rem', color: '#c62828', marginTop: 2 }}>Inactive</div>}
                </div>
              ))}
              {(activeTab === 'clients' ? filteredClients : filteredVendors).length === 0 && (
                <div style={{ textAlign: 'center', padding: 30, color: '#888', fontSize: '0.85rem' }}>No {activeTab} found</div>
              )}
            </div>
          </div>

          {/* RIGHT: Detail Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', height: '100%' }}>
            {!selectedItem ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#fafafa', borderRadius: 10, border: '1px dashed #ddd' }}>
                <div style={{ textAlign: 'center' }}>
                  {activeTab === 'clients' ? <Users size={48} style={{ opacity: 0.2, marginBottom: 8 }} /> : <Building2 size={48} style={{ opacity: 0.2, marginBottom: 8 }} />}
                  <div>Select a {activeTab === 'clients' ? 'client' : 'vendor'} to view details</div>
                </div>
              </div>
            ) : (
              <>
                {/* Info Card */}
                <div style={{ padding: 20, borderRadius: 10, border: '1px solid #e0e0e0', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{selectedItem.name}</h2>
                      {(() => {
                      const primary = (selectedItem.contacts || []).find(c => c.isPrimary) || (selectedItem.contacts || [])[0];
                      const name = primary?.name || selectedItem.contactName;
                      return name ? <div style={{ fontSize: '0.9rem', color: '#555', marginTop: 4 }}>{name}{primary?.role ? <span style={{ color: '#1976d2', marginLeft: 6, fontSize: '0.8rem' }}>· {primary.role}</span> : null}</div> : null;
                    })()}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => activeTab === 'clients' ? openClientModal(selectedItem) : openVendorModal(selectedItem)}><Edit size={14} /> Edit</button>
                      {activeTab === 'clients' && (
                        <button className="btn btn-sm" onClick={() => { setMergeSourceId(''); setMergeModal({ target: selectedItem }); }} style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>⇄ Merge</button>
                      )}
                      {selectedItem.isActive ? (
                        <button className="btn btn-sm" onClick={() => activeTab === 'clients' ? handleDeleteClient(selectedItem) : handleDeleteVendor(selectedItem)} style={{ background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }}><X size={14} /> Deactivate</button>
                      ) : (
                        <button className="btn btn-sm" onClick={() => activeTab === 'clients' ? handleReactivateClient(selectedItem) : handleReactivateVendor(selectedItem)} style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #66bb6a' }}><Check size={14} /> Reactivate</button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 24px', fontSize: '0.85rem' }}>
                    {(() => {
                      const primary = (selectedItem.contacts || []).find(c => c.isPrimary) || (selectedItem.contacts || [])[0];
                      const phone = primary?.phone || selectedItem.contactPhone;
                      const email = primary?.email || selectedItem.contactEmail;
                      return <>
                        {phone && <div><span style={{ color: '#888' }}>📞</span> {formatPhone(phone)}</div>}
                        {email && <div><span style={{ color: '#888' }}>📧</span> {email}</div>}
                      </>;
                    })()}
                    {selectedItem.apEmail && <div><span style={{ color: '#888' }}>📧 AP:</span> {selectedItem.apEmail}</div>}
                    {selectedItem.address && <div><span style={{ color: '#888' }}>📍</span> {selectedItem.address}</div>}
                    {activeTab === 'clients' && selectedItem.taxStatus && <div>Tax: {getTaxStatusBadge(selectedItem.taxStatus)}</div>}
                    {activeTab === 'clients' && selectedItem.paymentTerms && <div><span style={{ color: '#888' }}>Terms:</span> {selectedItem.paymentTerms}</div>}
                    {activeTab === 'clients' && selectedItem.quickbooksName && <div><span style={{ color: '#888' }}>📗 QB:</span> {selectedItem.quickbooksName}</div>}
                    {activeTab === 'clients' && selectedItem.resaleCertificate && <div><span style={{ color: '#888' }}>🔐 Resale:</span> {selectedItem.resaleCertificate} {selectedItem.permitStatus === 'active' && <span style={{ color: '#2e7d32', fontWeight: 600 }}>✅</span>}</div>}
                    {activeTab === 'vendors' && selectedItem.accountNumber && <div><span style={{ color: '#888' }}>Account:</span> {selectedItem.accountNumber}</div>}
                    {selectedItem.notes && <div style={{ gridColumn: 'span 2', color: '#666', fontStyle: 'italic' }}>{selectedItem.notes}</div>}
                  </div>
                  {/* Contacts list */}
                  {(selectedItem.contacts && selectedItem.contacts.length > 1) && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 6 }}>All Contacts:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selectedItem.contacts.map((c, i) => (
                          <div key={i} style={{ padding: '5px 10px', background: c.isPrimary ? '#e8f5e9' : '#f5f5f5', borderRadius: 6, fontSize: '0.8rem', border: `1px solid ${c.isPrimary ? '#a5d6a7' : '#e8e8e8'}` }}>
                            <span style={{ fontWeight: 600 }}>{c.name || 'No name'}</span>
                            {c.isPrimary && <span style={{ color: '#2e7d32', marginLeft: 4, fontSize: '0.7rem', fontWeight: 700 }}>★</span>}
                            {c.role && <span style={{ color: '#1976d2', marginLeft: 4 }}>· {c.role}</span>}
                            {c.monitored && <span style={{ color: '#E65100', marginLeft: 4, fontSize: '0.7rem' }}>📧</span>}
                            {c.email && <div style={{ color: '#666', marginTop: 1 }}>{c.email}</div>}
                            {c.phone && <div style={{ color: '#888', marginTop: 1 }}>{c.phone}{c.extension ? <span style={{ marginLeft: 4 }}>x{c.extension}</span> : null}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* COC Required badge */}
                  {selectedItem.requiresCoc && (
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: '#fff3e0', border: '1px solid #FFB74D', borderRadius: 99, fontSize: '0.78rem', fontWeight: 600, color: '#E65100' }}>
                      📜 COC Required for all orders
                    </div>
                  )}
                  {/* Accounting contact — always visible on client profile */}
                  {(selectedItem.accountingContactName || selectedItem.accountingContactEmail) && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 4 }}>🧾 Accounting Contact</div>
                      <div style={{ fontSize: '0.85rem', padding: '6px 10px', background: '#f9f9f9', borderRadius: 6 }}>
                        {selectedItem.accountingContactName && <div style={{ fontWeight: 600 }}>{selectedItem.accountingContactName}</div>}
                        {selectedItem.accountingContactEmail && <div style={{ color: '#666' }}>📧 {selectedItem.accountingContactEmail}</div>}
                        {selectedItem.accountingContactPhone && <div style={{ color: '#888' }}>📞 {formatPhone(selectedItem.accountingContactPhone)}</div>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Client History — full account history */}
                {activeTab === 'clients' && (
                  <div style={{ flex: 1, borderRadius: 10, border: '1px solid #e0e0e0', background: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                    {/* Open Balance Banner */}
                    {clientHistory && parseFloat(clientHistory.openBalance) > 0 && (
                      <div style={{ padding: '10px 16px', background: parseFloat(clientHistory.openBalance) > 0 ? '#fff3e0' : '#e8f5e9', borderBottom: '2px solid #e65100', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Open Balance</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#bf360c' }}>${parseFloat(clientHistory.openBalance).toFixed(2)}</div>
                          {selectedItem.paymentTerms && <div style={{ fontSize: '0.75rem', color: '#888' }}>Terms: {selectedItem.paymentTerms}</div>}
                        </div>
                        <button disabled={statementLoading} onClick={async () => {
                          setStatementLoading(true);
                          try {
                            const r = await getClientStatementPdf(selectedItem.id);
                            const blob = new Blob([r.data], { type: 'application/pdf' });
                            const url = window.URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          } catch(e) { alert('Failed to generate statement'); }
                          finally { setStatementLoading(false); }
                        }} style={{ padding: '8px 16px', background: '#e65100', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {statementLoading ? '⏳' : '📄'} {statementLoading ? 'Generating...' : 'Account Statement'}
                        </button>
                      </div>
                    )}

                    {/* History tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
                      {[
                        { key: 'workorders', label: `Work Orders (${(clientHistory?.workOrders || workHistory).length})` },
                        { key: 'payments', label: `Payments (${(clientHistory?.payments || []).length})` },
                        { key: 'credits', label: `Credits (${(clientHistory?.creditMemos || []).length})` },
                        { key: 'refunds', label: `Refunds (${(clientHistory?.refunds || []).length})` },
                      ].map(t => (
                        <button key={t.key} onClick={() => setHistoryTab(t.key)}
                          style={{ padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: historyTab === t.key ? 700 : 400, background: 'transparent', color: historyTab === t.key ? '#1565c0' : '#555', borderBottom: historyTab === t.key ? '2px solid #1565c0' : '2px solid transparent' }}>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {historyLoading ? <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Loading history...</div> : (<>

                      {/* Work Orders tab */}
                      {historyTab === 'workorders' && (() => {
                        const wos = clientHistory?.workOrders || workHistory;
                        if (wos.length === 0) return <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>No work orders found</div>;
                        return (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Work Order</th>
                                <th style={{ padding: '8px 8px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Status</th>
                                <th style={{ padding: '8px 8px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Total</th>
                                <th style={{ padding: '8px 8px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Due Date</th>
                                <th style={{ padding: '8px 8px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {wos.map(wo => {
                                const balance = parseFloat(wo.balance ?? wo.grandTotal) || 0;
                                const isOverdue = wo.daysOverdue > 0;
                                const isPaid = balance <= 0.01 && wo.invoiceNumber;
                                return (
                                  <tr key={wo.id} style={{ borderBottom: '1px solid #f0f0f0', background: isOverdue ? '#fff8f5' : 'white' }}>
                                    <td style={{ padding: '8px 10px' }}>
                                      <a href={`/workorder/${wo.id}`} onClick={e => { e.preventDefault(); navigate(`/workorder/${wo.id}`); }} style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 600 }}>
                                        {wo.drNumber ? `DR-${wo.drNumber}` : wo.orderNumber}
                                      </a>
                                      {wo.invoiceNumber && <div style={{ fontSize: '0.72rem', color: '#2e7d32' }}>#{wo.invoiceNumber}</div>}
                                      <div style={{ fontSize: '0.72rem', color: '#aaa' }}>{wo.createdAt ? new Date(wo.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''}</div>
                                    </td>
                                    <td style={{ padding: '8px 8px' }}>
                                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                                        background: wo.status === 'shipped' || wo.status === 'archived' ? '#f3e5f5' : wo.status === 'stored' || wo.status === 'completed' ? '#e8f5e9' : '#e1f5fe',
                                        color: wo.status === 'shipped' || wo.status === 'archived' ? '#7b1fa2' : wo.status === 'stored' || wo.status === 'completed' ? '#2e7d32' : '#0288d1' }}>
                                        {wo.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600 }}>
                                      ${parseFloat(wo.total ?? wo.grandTotal ?? 0).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '8px 8px' }}>
                                      {wo.dueDate ? (
                                        <div>
                                          <div style={{ fontSize: '0.8rem', color: isOverdue ? '#c62828' : '#333', fontWeight: isOverdue ? 700 : 400 }}>
                                            {new Date(wo.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                          </div>
                                          {isOverdue && balance > 0.01 && (
                                            <div style={{ fontSize: '0.7rem', color: '#c62828', fontWeight: 700 }}>
                                              {wo.daysOverdue}d overdue
                                            </div>
                                          )}
                                          {!isOverdue && balance > 0.01 && wo.daysOverdue !== null && (
                                            <div style={{ fontSize: '0.7rem', color: '#2e7d32' }}>
                                              {Math.abs(wo.daysOverdue)}d remaining
                                            </div>
                                          )}
                                        </div>
                                      ) : isPaid ? (
                                        <span style={{ fontSize: '0.75rem', color: '#2e7d32' }}>✓ Paid</span>
                                      ) : wo.invoiceNumber ? (
                                        <span style={{ fontSize: '0.75rem', color: '#888' }}>—</span>
                                      ) : (
                                        <span style={{ fontSize: '0.72rem', color: '#ccc' }}>No invoice</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                                      {isPaid ? (
                                        <span style={{ color: '#2e7d32', fontSize: '0.78rem', fontWeight: 600 }}>✓ Paid</span>
                                      ) : balance > 0.01 ? (
                                        <span style={{ color: isOverdue ? '#c62828' : '#e65100', fontWeight: 700 }}>${balance.toFixed(2)}</span>
                                      ) : wo.invoiceNumber ? (
                                        <span style={{ color: '#2e7d32', fontSize: '0.78rem' }}>✓</span>
                                      ) : (
                                        <span style={{ color: '#ccc' }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        );
                      })()}

                      {/* Payments tab */}
                      {historyTab === 'payments' && (() => {
                        const pmts = clientHistory?.payments || [];
                        if (pmts.length === 0) return <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>No payments recorded</div>;
                        return (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Date</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Method</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Reference</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Applied To</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pmts.map(pmt => (
                                <tr key={pmt.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '8px 12px' }}>{pmt.paymentDate ? new Date(pmt.paymentDate+'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</td>
                                  <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{pmt.method?.replace('_',' ')}</td>
                                  <td style={{ padding: '8px 12px', color: '#888' }}>{pmt.reference || '—'}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: '#555' }}>
                                    {(pmt.applications||[]).length > 0 ? (pmt.applications||[]).map(a => `DR-${a.workOrderId?.slice(-4)||'?'}`).join(', ') : '—'}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2e7d32' }}>${parseFloat(pmt.amount).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}

                      {/* Credits tab */}
                      {historyTab === 'credits' && (() => {
                        const cms = clientHistory?.creditMemos || [];
                        if (cms.length === 0) return <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>No credit memos</div>;
                        return (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Date</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Reason</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Amount</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Remaining</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cms.map(cm => (
                                <tr key={cm.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '8px 12px' }}>{cm.date ? new Date(cm.date+'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</td>
                                  <td style={{ padding: '8px 12px', color: '#555' }}>{cm.reason || '—'}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1565c0' }}>${parseFloat(cm.amount).toFixed(2)}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: parseFloat(cm.remainingAmount) > 0 ? '#2e7d32' : '#888' }}>
                                    ${parseFloat(cm.remainingAmount).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}

                      {/* Refunds tab */}
                      {historyTab === 'refunds' && (() => {
                        const refs = clientHistory?.refunds || [];
                        if (refs.length === 0) return <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>No refunds</div>;
                        return (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Date</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Method</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Reason</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {refs.map(r => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '8px 12px' }}>{r.date ? new Date(r.date+'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</td>
                                  <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{r.method?.replace('_',' ')}</td>
                                  <td style={{ padding: '8px 12px', color: '#555' }}>{r.reason || '—'}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#c62828' }}>-${parseFloat(r.amount).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}

                      </>)}
                    </div>

                    {/* Footer summary */}
                    {!historyLoading && historyTab === 'workorders' && (clientHistory?.workOrders || workHistory).length > 0 && (
                      <div style={{ padding: '8px 16px', background: '#f5f5f5', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ color: '#555' }}>{(clientHistory?.workOrders || workHistory).length} work orders</span>
                        {clientHistory?.openBalance && parseFloat(clientHistory.openBalance) > 0 && (
                          <span style={{ fontWeight: 700, color: '#e65100' }}>Open: ${parseFloat(clientHistory.openBalance).toFixed(2)}</span>
                        )}
                        <span style={{ fontWeight: 700 }}>Total: ${(clientHistory?.workOrders || workHistory).reduce((s, w) => s + (parseFloat(w.total ?? w.grandTotal) || 0), 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Vendor History */}
                {activeTab === 'vendors' && (
                  <div style={{ flex: 1, borderRadius: 10, border: '1px solid #e0e0e0', background: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px 16px', background: '#f5f5f5', borderBottom: '1px solid #e0e0e0', fontWeight: 700, fontSize: '0.95rem' }}>
                      📋 Vendor Activity
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {historyLoading ? <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Loading...</div> :
                      !vendorHistory ? <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>No data</div> : (
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* Summary cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                            <div style={{ background: '#e3f2fd', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1565c0' }}>{(vendorHistory.poNumbers || []).length}</div>
                              <div style={{ fontSize: '0.75rem', color: '#555' }}>PO Numbers</div>
                            </div>
                            <div style={{ background: '#f3e5f5', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#6a1b9a' }}>{(vendorHistory.workOrders || []).length}</div>
                              <div style={{ fontSize: '0.75rem', color: '#555' }}>Work Orders</div>
                            </div>
                            <div style={{ background: '#fff3e0', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#e65100' }}>{(vendorHistory.liabilities || []).length}</div>
                              <div style={{ fontSize: '0.75rem', color: '#555' }}>Bills</div>
                            </div>
                            <div style={{ background: '#e8f5e9', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2e7d32' }}>${(vendorHistory.totalMaterialValue || 0).toFixed(0)}</div>
                              <div style={{ fontSize: '0.75rem', color: '#555' }}>Material Value</div>
                            </div>
                          </div>

                          {/* Purchase Orders */}
                          {(vendorHistory.poNumbers || []).length > 0 && (
                            <div>
                              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>📦 Purchase Orders</h4>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                <thead><tr style={{ background: '#fafafa' }}>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>PO #</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Date</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Description</th>
                                </tr></thead>
                                <tbody>{(vendorHistory.poNumbers || []).map(po => (
                                  <tr key={po.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>PO-{po.poNumber}</td>
                                    <td style={{ padding: '6px 10px', color: '#666' }}>{po.createdAt ? new Date(po.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</td>
                                    <td style={{ padding: '6px 10px', color: '#555' }}>{po.description || '—'}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          )}

                          {/* Linked Work Orders */}
                          {(vendorHistory.workOrders || []).length > 0 && (
                            <div>
                              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>🔧 Linked Work Orders</h4>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                <thead><tr style={{ background: '#fafafa' }}>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Work Order</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Client</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Status</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Invoice</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Payment</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Total</th>
                                </tr></thead>
                                <tbody>{(vendorHistory.workOrders || []).map(wo => (
                                  <tr key={wo.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '6px 10px' }}>
                                      <a href={`/workorder/${wo.id}`} onClick={(e) => { e.preventDefault(); navigate(`/workorder/${wo.id}`); }} style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 600 }}>
                                        {wo.drNumber ? `DR-${wo.drNumber}` : wo.orderNumber}
                                      </a>
                                    </td>
                                    <td style={{ padding: '6px 10px' }}>{wo.clientName}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, background: wo.status === 'stored' || wo.status === 'completed' ? '#e8f5e9' : wo.status === 'processing' ? '#e1f5fe' : '#f5f5f5', color: wo.status === 'stored' || wo.status === 'completed' ? '#2e7d32' : wo.status === 'processing' ? '#0288d1' : '#666' }}>{wo.status}</span>
                                    </td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      {wo.invoiceNumber ? <span style={{ color: '#2e7d32', fontWeight: 600, fontSize: '0.8rem' }}>✅ {wo.invoiceNumber}</span> : <span style={{ color: '#ccc' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      {wo.paymentDate ? <span style={{ color: '#2e7d32', fontSize: '0.8rem' }}>💰 {new Date(wo.paymentDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span> : wo.invoiceNumber ? <span style={{ color: '#E65100', fontSize: '0.8rem' }}>⏳</span> : <span style={{ color: '#ccc' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{wo.grandTotal ? '$' + parseFloat(wo.grandTotal).toFixed(2) : '—'}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          )}

                          {/* Bills */}
                          {(vendorHistory.liabilities || []).length > 0 && (
                            <div>
                              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>🧾 Bills</h4>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                <thead><tr style={{ background: '#fafafa' }}>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Bill</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Category</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Due</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Status</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Amount</th>
                                </tr></thead>
                                <tbody>{(vendorHistory.liabilities || []).map(l => (
                                  <tr key={l.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '6px 10px', fontWeight: 500 }}>{l.name}</td>
                                    <td style={{ padding: '6px 10px', color: '#666' }}>{l.category}</td>
                                    <td style={{ padding: '6px 10px', color: '#666' }}>{l.dueDate ? new Date(l.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      {l.status === 'paid' ? <span style={{ color: '#2e7d32', fontWeight: 600, fontSize: '0.8rem' }}>✅ Paid{l.paidAt ? ` ${new Date(l.paidAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}` : ''}</span> : <span style={{ color: '#E65100', fontWeight: 600, fontSize: '0.8rem' }}>⏳ Unpaid</span>}
                                    </td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>${parseFloat(l.amount).toFixed(2)}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          )}

                          {/* Inbound Orders */}
                          {(vendorHistory.inboundOrders || []).length > 0 && (
                            <div>
                              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>📥 Inbound Orders</h4>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                <thead><tr style={{ background: '#fafafa' }}>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Description</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Date</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Status</th>
                                </tr></thead>
                                <tbody>{(vendorHistory.inboundOrders || []).map(o => (
                                  <tr key={o.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '6px 10px' }}>{o.description || o.materialDescription || 'Inbound order'}</td>
                                    <td style={{ padding: '6px 10px', color: '#666' }}>{new Date(o.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, background: o.status === 'received' ? '#e8f5e9' : '#fff3e0', color: o.status === 'received' ? '#2e7d32' : '#E65100' }}>{o.status || 'pending'}</span>
                                    </td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          )}

                          {(vendorHistory.poNumbers || []).length === 0 && (vendorHistory.workOrders || []).length === 0 && (vendorHistory.liabilities || []).length === 0 && (vendorHistory.inboundOrders || []).length === 0 && (
                            <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>No activity found for this vendor</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Client Modal */}
      {showModal && activeTab === 'clients' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Client' : 'Add Client'}</h3>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Client Name *</label>
                <input className="form-input" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Company or person name" />
              </div>

              {/* Unified Contacts */}
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, color: '#1976d2', fontSize: '0.9rem' }}>👥 Contacts</h4>
                  <button type="button" onClick={() => {
                    const contacts = [...(formData.contacts || []), { name: '', email: '', phone: '', role: '', isPrimary: (formData.contacts || []).length === 0 }];
                    setFormData({ ...formData, contacts });
                  }} style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#1565c0' }}>
                    + Add Contact
                  </button>
                </div>
                {(formData.contacts || []).length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#999', padding: 12, textAlign: 'center', background: '#fafafa', borderRadius: 6, border: '1px dashed #ddd' }}>No contacts yet — add your first contact</div>
                )}
                {(formData.contacts || []).map((contact, idx) => (
                  <div key={idx} style={{ marginBottom: 8, padding: '8px 10px', background: contact.isPrimary ? '#e8f5e9' : '#f9f9f9', borderRadius: 6, border: `1px solid ${contact.isPrimary ? '#66bb6a' : '#eee'}` }}>
                    {contact.isPrimary && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2e7d32', marginBottom: 4 }}>★ PRIMARY CONTACT</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.2fr 0.6fr 1fr auto', gap: 6 }}>
                      <input className="form-input" placeholder="Name *" value={contact.name || ''} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => {
                          const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], name: e.target.value };
                          const updates = { contacts: c };
                          if (c[idx].isPrimary) { updates.contactName = e.target.value; }
                          setFormData({ ...formData, ...updates });
                        }} />
                      <input className="form-input" placeholder="Email" type="email" value={contact.email || ''} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => {
                          const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], email: e.target.value };
                          const updates = { contacts: c };
                          if (c[idx].isPrimary) { updates.contactEmail = e.target.value; }
                          setFormData({ ...formData, ...updates });
                        }} />
                      <input className="form-input" placeholder="Phone" value={formatPhone(contact.phone || '')} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => {
                          const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], phone: formatPhone(e.target.value) };
                          const updates = { contacts: c };
                          if (c[idx].isPrimary) { updates.contactPhone = formatPhone(e.target.value); }
                          setFormData({ ...formData, ...updates });
                        }} />
                      <input className="form-input" placeholder="Ext" value={contact.extension || ''} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], extension: e.target.value.replace(/\D/g, '') }; setFormData({ ...formData, contacts: c }); }} />
                      <input className="form-input" placeholder="Role (e.g. Estimating)" value={contact.role || ''} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], role: e.target.value }; setFormData({ ...formData, contacts: c }); }} />
                      <button type="button" onClick={() => {
                          const c = [...(formData.contacts || [])]; c.splice(idx, 1);
                          // If deleted contact was primary, make first remaining contact primary
                          if (contact.isPrimary && c.length > 0) c[0].isPrimary = true;
                          const newPrimary = c.find(ct => ct.isPrimary) || c[0];
                          setFormData({ ...formData, contacts: c,
                            contactName: newPrimary?.name || '', contactEmail: newPrimary?.email || '', contactPhone: newPrimary?.phone || '' });
                        }}
                        style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', alignSelf: 'center' }}>
                        <X size={14} color="#c62828" />
                      </button>
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {!contact.isPrimary && (
                        <button type="button" onClick={() => {
                          const c = (formData.contacts || []).map((ct, i) => ({ ...ct, isPrimary: i === idx }));
                          setFormData({ ...formData, contacts: c, contactName: c[idx].name || '', contactEmail: c[idx].email || '', contactPhone: c[idx].phone || '' });
                        }} style={{ background: '#f0f0f0', color: '#1976d2', border: '1px solid #90caf9', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                          ☆ Set as Primary
                        </button>
                      )}
                      {contact.email && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: contact.monitored ? '#E65100' : '#999' }}>
                          <input type="checkbox" checked={contact.monitored || false} style={{ width: 14, height: 14, accentColor: '#E65100' }}
                            onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], monitored: e.target.checked }; setFormData({ ...formData, contacts: c, emailScanEnabled: c.some(ct => ct.monitored), emailScanAddresses: c.filter(ct => ct.monitored && ct.email).map(ct => ct.email) }); }} />
                          <span style={{ fontWeight: contact.monitored ? 600 : 400 }}>📧 Monitor Emails</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Accounting Contact — collapsible */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAccounting(a => !a)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, color: '#2e7d32', fontWeight: 600, fontSize: '0.9rem', marginBottom: showAccounting ? 10 : 0 }}>
                  🧾 Accounting Contact {showAccounting ? '▲' : '▼'}
                  {(formData.accountingContactName || formData.accountingContactEmail) && !showAccounting &&
                    <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 400, marginLeft: 4 }}>{formData.accountingContactName || formData.accountingContactEmail}</span>}
                </button>
                {showAccounting && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <input className="form-input" placeholder="Name" value={formData.accountingContactName || ''} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => setFormData({ ...formData, accountingContactName: e.target.value })} />
                    <input className="form-input" placeholder="Email" type="email" value={formData.accountingContactEmail || ''} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => setFormData({ ...formData, accountingContactEmail: e.target.value })} />
                    <input className="form-input" placeholder="Phone" value={formatPhone(formData.accountingContactPhone || '')} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => setFormData({ ...formData, accountingContactPhone: formatPhone(e.target.value) })} />
                  </div>
                )}
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Address</label>
                <textarea className="form-textarea" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
              </div>
              
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 8 }}>
                <h4 style={{ marginBottom: 12, color: '#1976d2' }}>💰 Tax Settings</h4>
              </div>
              
              <div className="form-group">
                <label className="form-label">Tax Status</label>
                <select className="form-select" value={formData.taxStatus || 'taxable'} onChange={(e) => setFormData({ ...formData, taxStatus: e.target.value })}>
                  <option value="taxable">Taxable</option>
                  <option value="resale">Resale (Tax Exempt)</option>
                  <option value="exempt">Tax Exempt (Other)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Custom Tax Rate (%)</label>
                <input 
                  type="text"
                  inputMode="decimal"
                  className="form-input" 
                  value={formData._customTaxRateInput !== undefined
                    ? formData._customTaxRateInput
                    : (formData.customTaxRate ? (parseFloat(formData.customTaxRate) * 100).toString() : '')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Allow only digits and a single decimal point
                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                      const parsed = raw === '' || raw === '.' ? '' : parseFloat(raw) / 100;
                      setFormData({ ...formData, _customTaxRateInput: raw, customTaxRate: isNaN(parsed) ? '' : parsed });
                    }
                  }}
                  onBlur={(e) => {
                    // On blur, normalize the displayed value
                    const raw = e.target.value;
                    if (raw === '' || raw === '.') {
                      setFormData({ ...formData, _customTaxRateInput: undefined, customTaxRate: '' });
                    } else {
                      const num = parseFloat(raw);
                      if (!isNaN(num)) {
                        setFormData({ ...formData, _customTaxRateInput: undefined, customTaxRate: num / 100 });
                      }
                    }
                  }}
                  placeholder="e.g. 3.9375 (leave blank for default)"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <select className="form-select" value={formData.paymentTerms || ''} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}>
                  <option value="">Not Set</option>
                  <option value="C.O.D.">C.O.D.</option>
                  <option value="1% 10 NET 30">1% 10 NET 30</option>
                  <option value="1% 10 DAYS NET 30">1% 10 DAYS NET 30</option>
                  <option value="1/2% 10 NET 30">1/2% 10 NET 30</option>
                  <option value="2% 10 DAYS NET 30">2% 10 DAYS NET 30</option>
                  <option value="10 DAYS">10 DAYS</option>
                  <option value="15 DAYS">15 DAYS</option>
                  <option value="NET 60 DAYS">NET 60 DAYS</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Accounts Payable Email <span style={{ fontWeight: 400, color: '#999', fontSize: '0.8rem' }}>(for sending invoices)</span></label>
                <input className="form-input" type="email" placeholder="ap@clientcompany.com"
                  value={formData.apEmail || ''} onChange={(e) => setFormData({ ...formData, apEmail: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">QuickBooks Desktop Name <span style={{ fontWeight: 400, color: '#999', fontSize: '0.8rem' }}>(must match QB exactly — used for IIF export)</span></label>
                <input className="form-input" placeholder="e.g. NOWELL STEEL AND SUPPLY"
                  value={formData.quickbooksName || ''} onChange={(e) => setFormData({ ...formData, quickbooksName: e.target.value.toUpperCase() })}
                  style={{ fontFamily: 'monospace', letterSpacing: 0.5 }} />
                {formData.quickbooksName && (
                  <div style={{ fontSize: '0.75rem', color: '#1565C0', marginTop: 4 }}>
                    📗 IIF exports will use: <strong>{formData.quickbooksName}</strong>
                  </div>
                )}
              </div>
              {formData.taxStatus === 'resale' && (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Resale Certificate # <span style={{ fontWeight: 400, color: '#999', fontSize: '0.8rem' }}>(format: 123-456789)</span></label>
                  <input className="form-input" value={formData.resaleCertificate || ''} 
                    onChange={(e) => setFormData({ ...formData, resaleCertificate: formatResale(e.target.value) })}
                    placeholder="000-000000" maxLength={10}
                    style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: 1, borderColor: formData.resaleCertificate && !isValidResale(formData.resaleCertificate) ? '#e65100' : undefined }} />
                  {formData.resaleCertificate && !isValidResale(formData.resaleCertificate) && (
                    <div style={{ fontSize: '0.75rem', color: '#e65100', marginTop: 4 }}>
                      ⚠️ Must be 9 digits in format: 123-456789
                    </div>
                  )}
                </div>
              )}
              {formData.taxStatus === 'resale' && formData.resaleCertificate && (
                <div style={{ gridColumn: 'span 2', padding: 12, background: '#f5f5f5', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 2 }}>CDTFA Permit Status</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {formData.permitStatus === 'active' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }}>✅ Active</span>}
                        {formData.permitStatus === 'closed' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }}>❌ Closed</span>}
                        {formData.permitStatus === 'not_found' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }}>❌ Not Found</span>}
                        {formData.permitStatus === 'error' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>⚠️ Error</span>}
                        {formData.permitStatus === 'unknown' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>⚠️ Unknown</span>}
                        {(!formData.permitStatus || formData.permitStatus === 'unverified') && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600, background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>Never verified</span>}
                        {formData.permitLastVerified && (
                          <span style={{ fontSize: '0.75rem', color: '#888' }}>
                            Last verified: {new Date(formData.permitLastVerified).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {formData.permitRawResponse && (
                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 4, fontStyle: 'italic' }}>
                          "{formData.permitRawResponse}"
                        </div>
                      )}
                      {(formData.permitOwnerName || formData.permitDbaName) && (
                        <div style={{ marginTop: 6 }}>
                          {formData.permitOwnerName && (
                            <div style={{ fontSize: '0.8rem', color: '#555' }}>
                              <strong>CDTFA Owner:</strong> {formData.permitOwnerName}
                            </div>
                          )}
                          {formData.permitDbaName && (
                            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 2 }}>
                              <strong>DBA:</strong> {formData.permitDbaName}
                            </div>
                          )}
                          {(() => {
                            const clean = (s) => (s || '').toLowerCase().replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|llp|lp|plc|dba|the)\b/g, '').replace(/[^a-z0-9]/g, '');
                            const clientLower = clean(formData.name);
                            const ownerLower = clean(formData.permitOwnerName);
                            const dbaLower = clean(formData.permitDbaName);
                            if (!clientLower) return null;
                            const matchesOwner = ownerLower && (ownerLower.includes(clientLower) || clientLower.includes(ownerLower));
                            const matchesDba = dbaLower && (dbaLower.includes(clientLower) || clientLower.includes(dbaLower));
                            if (!matchesOwner && !matchesDba && (ownerLower || dbaLower)) {
                              return (
                                <div style={{ marginTop: 4, padding: '4px 8px', background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 4, fontSize: '0.75rem', color: '#e65100', fontWeight: 600 }}>
                                  ⚠️ Name mismatch — Client: "{formData.name}"{ownerLower ? ` vs Owner: "${formData.permitOwnerName}"` : ''}{dbaLower ? ` vs DBA: "${formData.permitDbaName}"` : ''}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                    <button type="button" className="btn btn-sm" disabled={verifying || !isValidResale(formData.resaleCertificate)}
                      onClick={() => handleVerifyPermit(editing?.id, formData.resaleCertificate)}
                      style={{ padding: '6px 14px', background: (verifying || !isValidResale(formData.resaleCertificate)) ? '#bbb' : '#1565c0', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: (verifying || !isValidResale(formData.resaleCertificate)) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      {verifying ? '⏳ Verifying...' : '🔍 Verify Now'}
                    </button>
                  </div>
                  {/* DEBUG: Raw CDTFA fields — remove after fixing owner name */}
                  {formData._permitRawFields && Object.keys(formData._permitRawFields).length > 0 && (
                    <details style={{ marginTop: 8, fontSize: '0.7rem', color: '#888' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔧 Debug: Raw CDTFA Fields (click to expand)</summary>
                      {formData._permitLabelMap && Object.keys(formData._permitLabelMap).length > 0 && (
                        <div style={{ background: '#e8f5e9', padding: 8, borderRadius: 4, marginTop: 4, marginBottom: 4 }}>
                          <strong>Label → Value Map:</strong>
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                            {JSON.stringify(formData._permitLabelMap, null, 2)}
                          </pre>
                        </div>
                      )}
                      <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 4 }}>
                        {JSON.stringify(formData._permitRawFields, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
              </div>

              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.noTag || false} onChange={(e) => setFormData({ ...formData, noTag: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#e65100' }} />
                  <span style={{ fontWeight: 600, color: formData.noTag ? '#e65100' : '#333' }}>
                    🚫 No QR Tag — Do not place QR stickers on this client's material
                  </span>
                </label>
                {formData.noTag && (
                  <div style={{ marginTop: 8, padding: 10, background: '#fff3e0', borderRadius: 8, fontSize: '0.85rem', color: '#bf360c' }}>
                    When material is received for this client, the QR code print page will be skipped and a warning will be shown instead.
                  </div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.requiresPartLabels || false} onChange={(e) => setFormData({ ...formData, requiresPartLabels: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#1565c0' }} />
                  <span style={{ fontWeight: 600, color: formData.requiresPartLabels ? '#1565c0' : '#333' }}>
                    🏷️ Part Info Labels — Print part info stickers (Part#, PO#, Heat#) on Android tablets
                  </span>
                </label>
                {formData.requiresPartLabels && (
                  <div style={{ marginTop: 8, padding: 10, background: '#e3f2fd', borderRadius: 8, fontSize: '0.85rem', color: '#0d47a1' }}>
                    A "Print Label" button will appear next to each part on the Android tablet. Labels include client part number, purchase order number, and heat number.
                  </div>
                )}
              </div>
              {/* USMCA Auto-Generate */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!formData.autoGenerateUSMCA} style={{ width: 18, height: 18, accentColor: '#1565c0', marginTop: 2 }}
                    onChange={e => setFormData({...formData, autoGenerateUSMCA: e.target.checked})} />
                  <div>
                    <div style={{ fontWeight: 600, color: formData.autoGenerateUSMCA ? '#1565c0' : '#333' }}>🌎 Auto-generate USMCA Certificate of Origin on shipment</div>
                    <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>Automatically generates and saves a USMCA COO to shipping documents when an order is shipped</div>
                  </div>
                </label>
                {formData.autoGenerateUSMCA && (
                  <div style={{ marginTop: 12, padding: 12, background: '#e3f2fd', borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Certificate Format</label>
                      <select className="form-select" style={{ fontSize: '0.85rem' }} value={formData.usmcaFormat || 'format1'} onChange={e => setFormData({...formData, usmcaFormat: e.target.value})}>
                        <option value="format1">Format 1 — Numbered Fields</option>
                        <option value="format2">Format 2 — Table Style</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Default HS Tariff Code</label>
                      <input className="form-input" style={{ fontSize: '0.85rem' }} value={formData.usmcaHtsCode || ''} onChange={e => setFormData({...formData, usmcaHtsCode: e.target.value})} placeholder="e.g. 7215, 7222, 7222.40" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Importer Name (if different from client)</label>
                      <input className="form-input" style={{ fontSize: '0.85rem' }} value={formData.usmcaImporterName || ''} onChange={e => setFormData({...formData, usmcaImporterName: e.target.value})} placeholder="Importing entity" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Origin Criteria</label>
                      <select className="form-select" style={{ fontSize: '0.85rem' }} value={formData.usmcaOriginCriteria || 'A'} onChange={e => setFormData({...formData, usmcaOriginCriteria: e.target.value})}>
                        <option value="A">A — Wholly obtained/produced in US</option>
                        <option value="B">B — Tariff classification change</option>
                        <option value="C">C — Regional value content</option>
                        <option value="D">D — Produced exclusively in USMCA territory</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Importer Address</label>
                      <textarea className="form-input" rows={2} style={{ fontSize: '0.85rem', resize: 'vertical' }} value={formData.usmcaImporterAddress || ''} onChange={e => setFormData({...formData, usmcaImporterAddress: e.target.value})} placeholder={'Street Address\nCity, State ZIP'} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!formData.requiresCoc} style={{ width: 18, height: 18, accentColor: '#E65100' }}
                    onChange={(e) => setFormData({ ...formData, requiresCoc: e.target.checked })} />
                  <span style={{ fontWeight: 600, color: formData.requiresCoc ? '#E65100' : '#333' }}>
                    📜 COC Required — Auto-generate Certificate of Conformance when all parts complete
                  </span>
                </label>
              </div>

              {/* Email Scanner Notes — shows when any contact has monitoring enabled */}
              {(formData.contacts || []).some(c => c.monitored) && (
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', paddingTop: 12 }}>
                <div style={{ padding: 12, background: '#FFF3E0', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.8rem', color: '#E65100', fontWeight: 600, marginBottom: 6 }}>📧 Email scanning active for: {(formData.contacts || []).filter(c => c.monitored && c.email).map(c => c.email).join(', ')}</div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>AI Parsing Notes <span style={{ fontWeight: 400, color: '#888' }}>(helps the AI understand this client)</span></label>
                    <textarea className="form-input" rows={2} value={formData.emailScanParsingNotes || ''}
                      onChange={(e) => setFormData({ ...formData, emailScanParsingNotes: e.target.value })}
                      placeholder='e.g. "OR numbers are their reference numbers" or "Ted uses shorthand — cone means cone_roll"' />
                  </div>
                </div>
              </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveClient} disabled={saving}>
                {saving ? 'Saving...' : (editing ? 'Update Client' : 'Add Client')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Modal */}
      {showModal && activeTab === 'vendors' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Vendor Name *</label>
                <input className="form-input" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Company name" />
              </div>

              {/* Unified Contacts */}
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, color: '#1976d2', fontSize: '0.9rem' }}>👥 Contacts</h4>
                  <button type="button" onClick={() => {
                    const contacts = [...(formData.contacts || []), { name: '', email: '', phone: '', role: '', isPrimary: (formData.contacts || []).length === 0 }];
                    setFormData({ ...formData, contacts });
                  }} style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#1565c0' }}>
                    + Add Contact
                  </button>
                </div>
                {(formData.contacts || []).length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#999', padding: 12, textAlign: 'center', background: '#fafafa', borderRadius: 6, border: '1px dashed #ddd' }}>No contacts yet — add your first contact</div>
                )}
                {(formData.contacts || []).map((contact, idx) => (
                  <div key={idx} style={{ marginBottom: 8, padding: '8px 10px', background: contact.isPrimary ? '#e8f5e9' : '#f9f9f9', borderRadius: 6, border: `1px solid ${contact.isPrimary ? '#66bb6a' : '#eee'}` }}>
                    {contact.isPrimary && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2e7d32', marginBottom: 4 }}>★ PRIMARY CONTACT</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.2fr 0.6fr 1fr auto', gap: 6 }}>
                      <input className="form-input" placeholder="Name *" value={contact.name || ''} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => {
                          const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], name: e.target.value };
                          const updates = { contacts: c };
                          if (c[idx].isPrimary) { updates.contactName = e.target.value; }
                          setFormData({ ...formData, ...updates });
                        }} />
                      <input className="form-input" placeholder="Email" type="email" value={contact.email || ''} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => {
                          const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], email: e.target.value };
                          const updates = { contacts: c };
                          if (c[idx].isPrimary) { updates.contactEmail = e.target.value; }
                          setFormData({ ...formData, ...updates });
                        }} />
                      <input className="form-input" placeholder="Phone" value={formatPhone(contact.phone || '')} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => {
                          const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], phone: formatPhone(e.target.value) };
                          const updates = { contacts: c };
                          if (c[idx].isPrimary) { updates.contactPhone = formatPhone(e.target.value); }
                          setFormData({ ...formData, ...updates });
                        }} />
                      <input className="form-input" placeholder="Ext" value={contact.extension || ''} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], extension: e.target.value.replace(/\D/g, '') }; setFormData({ ...formData, contacts: c }); }} />
                      <input className="form-input" placeholder="Role (e.g. Estimating)" value={contact.role || ''} style={{ fontSize: '0.85rem' }}
                        onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], role: e.target.value }; setFormData({ ...formData, contacts: c }); }} />
                      <button type="button" onClick={() => {
                          const c = [...(formData.contacts || [])]; c.splice(idx, 1);
                          // If deleted contact was primary, make first remaining contact primary
                          if (contact.isPrimary && c.length > 0) c[0].isPrimary = true;
                          const newPrimary = c.find(ct => ct.isPrimary) || c[0];
                          setFormData({ ...formData, contacts: c,
                            contactName: newPrimary?.name || '', contactEmail: newPrimary?.email || '', contactPhone: newPrimary?.phone || '' });
                        }}
                        style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', alignSelf: 'center' }}>
                        <X size={14} color="#c62828" />
                      </button>
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {!contact.isPrimary && (
                        <button type="button" onClick={() => {
                          const c = (formData.contacts || []).map((ct, i) => ({ ...ct, isPrimary: i === idx }));
                          setFormData({ ...formData, contacts: c, contactName: c[idx].name || '', contactEmail: c[idx].email || '', contactPhone: c[idx].phone || '' });
                        }} style={{ background: '#f0f0f0', color: '#1976d2', border: '1px solid #90caf9', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                          ☆ Set as Primary
                        </button>
                      )}
                      {contact.email && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: contact.monitored ? '#E65100' : '#999' }}>
                          <input type="checkbox" checked={contact.monitored || false} style={{ width: 14, height: 14, accentColor: '#E65100' }}
                            onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], monitored: e.target.checked }; setFormData({ ...formData, contacts: c, emailScanEnabled: c.some(ct => ct.monitored), emailScanAddresses: c.filter(ct => ct.monitored && ct.email).map(ct => ct.email) }); }} />
                          <span style={{ fontWeight: contact.monitored ? 600 : 400 }}>📧 Monitor Emails</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Address</label>
                <textarea className="form-textarea" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input className="form-input" value={formData.accountNumber || ''} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} placeholder="Your account # with vendor" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
              </div>

              {/* Accounting Contact — collapsible */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAccounting(a => !a)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, color: '#2e7d32', fontWeight: 600, fontSize: '0.9rem', marginBottom: showAccounting ? 10 : 0 }}>
                  🧾 Accounting Contact {showAccounting ? '▲' : '▼'}
                  {(formData.accountingContactName || formData.accountingContactEmail) && !showAccounting &&
                    <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 400, marginLeft: 4 }}>{formData.accountingContactName || formData.accountingContactEmail}</span>}
                </button>
                {showAccounting && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <input className="form-input" placeholder="Name" value={formData.accountingContactName || ''} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => setFormData({ ...formData, accountingContactName: e.target.value })} />
                    <input className="form-input" placeholder="Email" type="email" value={formData.accountingContactEmail || ''} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => setFormData({ ...formData, accountingContactEmail: e.target.value })} />
                    <input className="form-input" placeholder="Phone" value={formatPhone(formData.accountingContactPhone || '')} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => setFormData({ ...formData, accountingContactPhone: formatPhone(e.target.value) })} />
                  </div>
                )}
              </div>
              
              {/* Email Scanner — shows when any contact has monitoring enabled */}
              {(formData.contacts || []).some(c => c.monitored) && (
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', paddingTop: 12 }}>
                <div style={{ padding: 12, background: '#F3E5F5', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.8rem', color: '#7B1FA2', fontWeight: 600 }}>📧 Email monitoring active for: {(formData.contacts || []).filter(c => c.monitored && c.email).map(c => c.email).join(', ')}</div>
                </div>
              </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveVendor} disabled={saving}>
                {saving ? 'Saving...' : (editing ? 'Update Vendor' : 'Add Vendor')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permits Tab */}
      {activeTab === 'permits' && (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🔐 CDTFA Seller's Permit Status</h3>
            <p style={{ color: '#666', marginBottom: 16, fontSize: '0.9rem' }}>
              Shows permit verification status for clients with resale certificates on file. 
              Permits are automatically verified annually on January 2nd.
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  setSuccess(''); setError('');
                  setSuccess('Starting batch verification — this may take a few minutes...');
                  const res = await startBatchVerification();
                  setSuccess(res.data?.message || 'Batch verification started');
                  // Poll for completion
                  const poll = setInterval(async () => {
                    try {
                      const status = await getBatchStatus();
                      if (status.data?.data?.status === 'complete' || status.data?.data?.status === 'idle') {
                        clearInterval(poll);
                        loadData();
                        setSuccess(`Verification complete — ${status.data?.data?.results?.active || 0} active, ${status.data?.data?.results?.closed || 0} closed, ${status.data?.data?.results?.failed || 0} failed`);
                      }
                    } catch (e) { clearInterval(poll); }
                  }, 5000);
                } catch (err) {
                  setError('Failed to start verification: ' + (err.response?.data?.error?.message || err.message));
                }
              }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                🔄 Verify All Clients Now
              </button>

              <button className="btn btn-outline" onClick={async () => {
                try {
                  setSuccess('Generating report...');
                  const res = await downloadResaleReport();
                  const blob = new Blob([res.data], { type: 'application/pdf' });
                  const url = window.URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  setSuccess('Report generated');
                } catch (err) {
                  setError('Failed to generate report: ' + (err.response?.data?.error?.message || err.message));
                }
              }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                📄 Download Verification Report PDF
              </button>
            </div>

            {/* Annual cron info */}
            <div style={{ padding: 12, background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
              <strong>📅 Annual Verification Schedule</strong>
              <p style={{ margin: '6px 0 0', color: '#555' }}>
                All client resale certificates are automatically verified against the CDTFA database every <strong>January 2nd at 3:00 AM Pacific</strong>. 
                The system checks each permit number, records the status (Active/Closed), the registered owner name, and flags any name mismatches. 
                Use the "Verify All" button above to run this check manually at any time.
              </p>
            </div>

            {/* Client permit table */}
            {(() => {
              const clientsWithPermits = clients.filter(c => c.resaleCertificate);
              if (clientsWithPermits.length === 0) {
                return <p style={{ color: '#999', fontStyle: 'italic' }}>No clients have resale certificates on file.</p>;
              }
              return (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Permit #</th>
                      <th>Status</th>
                      <th>CDTFA Owner</th>
                      <th>Last Verified</th>
                      <th>Warnings</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientsWithPermits.map(c => {
                      const clean = (s) => (s || '').toLowerCase().replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|llp|lp|plc|dba|the)\b/g, '').replace(/[^a-z0-9]/g, '');
                      const clientClean = clean(c.name);
                      const ownerClean = clean(c.permitOwnerName);
                      const dbaClean = clean(c.permitDbaName);
                      const matchesOwner = ownerClean && (ownerClean.includes(clientClean) || clientClean.includes(ownerClean));
                      const matchesDba = dbaClean && (dbaClean.includes(clientClean) || clientClean.includes(dbaClean));
                      const nameMismatch = clientClean && (ownerClean || dbaClean) && !matchesOwner && !matchesDba;
                      return (
                        <tr key={c.id} style={nameMismatch ? { background: '#fff8e1' } : {}}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{c.resaleCertificate}</td>
                          <td>
                            <span style={{
                              padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                              background: c.permitStatus === 'Active' || c.permitStatus === 'active' ? '#e8f5e9' : c.permitStatus === 'Closed' || c.permitStatus === 'closed' ? '#ffebee' : '#f5f5f5',
                              color: c.permitStatus === 'Active' || c.permitStatus === 'active' ? '#2e7d32' : c.permitStatus === 'Closed' || c.permitStatus === 'closed' ? '#c62828' : '#666'
                            }}>
                              {c.permitStatus || 'Not Verified'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#555' }}>
                            {c.permitOwnerName || '—'}
                            {c.permitDbaName && <div style={{ fontSize: '0.75rem', color: '#888' }}>DBA: {c.permitDbaName}</div>}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#666' }}>
                            {c.permitLastVerified ? new Date(c.permitLastVerified).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'Never'}
                          </td>
                          <td>
                            {nameMismatch && (
                              <span style={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 600 }}>⚠️ Name mismatch</span>
                            )}
                          </td>
                          <td>
                            <button className="btn btn-sm btn-outline" onClick={async () => {
                              try {
                                setSuccess(''); setError('');
                                const res = await verifySinglePermit({ clientId: c.id, permitNumber: c.resaleCertificate });
                                const result = res.data?.data;
                                if (result?.status) {
                                  setSuccess(`${c.name}: Permit is ${result.status}`);
                                }
                                loadData();
                              } catch (err) {
                                setError(`Verification failed for ${c.name}: ${err.response?.data?.error?.message || err.message}`);
                              }
                            }} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                              Verify
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
      {/* Merge Client Modal */}
      {mergeModal && (
        <div className="modal-overlay" onClick={() => setMergeModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">⇄ Merge Duplicate Client</h3>
              <button className="btn-icon" onClick={() => setMergeModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#5d4037' }}>
                All work orders, estimates, and liabilities from the <strong>duplicate</strong> will be moved to <strong>{mergeModal.target.name}</strong>. The duplicate will be permanently deleted.
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Duplicate to merge INTO <strong>{mergeModal.target.name}</strong></label>
                <select className="form-select" value={mergeSourceId} onChange={e => setMergeSourceId(e.target.value)}>
                  <option value="">— Select duplicate client —</option>
                  {clients.filter(c => c.id !== mergeModal.target.id).sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}{!c.isActive ? ' (inactive)' : ''}</option>
                  ))}
                </select>
              </div>
              {mergeSourceId && (
                <div style={{ background: '#fce4ec', border: '1px solid #f48fb1', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>
                  <strong style={{ color: '#b71c1c' }}>⚠ This cannot be undone.</strong>{' '}
                  "{clients.find(c => c.id === mergeSourceId)?.name}" will be permanently deleted after all records are transferred.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setMergeModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!mergeSourceId || merging}
                style={{ background: '#e65100', borderColor: '#e65100' }}
                onClick={async () => {
                  if (!window.confirm(`Merge "${clients.find(c => c.id === mergeSourceId)?.name}" into "${mergeModal.target.name}"? This cannot be undone.`)) return;
                  setMerging(true);
                  try {
                    const r = await mergeClient(mergeModal.target.id, mergeSourceId);
                    showMessage(r.data.message || 'Clients merged successfully');
                    setMergeModal(null);
                    loadData();
                  } catch (err) {
                    setError('Merge failed: ' + (err.response?.data?.error?.message || err.message));
                  } finally { setMerging(false); }
                }}>
                {merging ? '⏳ Merging...' : '⇄ Merge Clients'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsVendorsPage;
