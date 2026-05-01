import React, { useState } from 'react';
import ShipmentsAdminPage from './ShipmentsAdminPage';
import InboundPage from './InboundPage';

export default function CombinedShipmentsPage({ initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'inbound' ? 'inbound' : 'outbound');

  const tabBar = (
    <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', background: 'white', marginBottom: 0 }}>
      <button onClick={() => setActiveTab('outbound')} style={{
        padding: '10px 28px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem',
        background: 'none', borderBottom: activeTab === 'outbound' ? '3px solid #1976d2' : '3px solid transparent',
        color: activeTab === 'outbound' ? '#1976d2' : '#666', marginBottom: -2
      }}>
        🚚 Shipments
      </button>
      <button onClick={() => setActiveTab('inbound')} style={{
        padding: '10px 28px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem',
        background: 'none', borderBottom: activeTab === 'inbound' ? '3px solid #1976d2' : '3px solid transparent',
        color: activeTab === 'inbound' ? '#1976d2' : '#666', marginBottom: -2
      }}>
        📥 Inbound Shipments
      </button>
    </div>
  );

  return (
    <div>
      {tabBar}
      {activeTab === 'outbound' && <ShipmentsAdminPage />}
      {activeTab === 'inbound' && <InboundPage />}
    </div>
  );
}
