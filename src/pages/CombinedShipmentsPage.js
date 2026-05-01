import React, { useState } from 'react';
import ShipmentsAdminPage from './ShipmentsAdminPage';
import InboundPage from './InboundPage';

export default function CombinedShipmentsPage({ initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'inbound' ? 'inbound' : 'outbound');

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', background: 'white', paddingLeft: 24, paddingTop: 16 }}>
        <button onClick={() => setActiveTab('outbound')} style={{
          padding: '8px 24px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem',
          background: 'none', borderBottom: activeTab === 'outbound' ? '3px solid #1976d2' : '3px solid transparent',
          color: activeTab === 'outbound' ? '#1976d2' : '#666', marginBottom: -2
        }}>
          🚚 Shipments
        </button>
        <button onClick={() => setActiveTab('inbound')} style={{
          padding: '8px 24px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem',
          background: 'none', borderBottom: activeTab === 'inbound' ? '3px solid #1976d2' : '3px solid transparent',
          color: activeTab === 'inbound' ? '#1976d2' : '#666', marginBottom: -2
        }}>
          📥 Inbound Shipments
        </button>
      </div>
      <div style={{ display: activeTab === 'outbound' ? 'block' : 'none' }}>
        <ShipmentsAdminPage />
      </div>
      <div style={{ display: activeTab === 'inbound' ? 'block' : 'none' }}>
        <InboundPage />
      </div>
    </div>
  );
}
