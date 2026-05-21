import React, { useState } from 'react';
import ShipmentsAdminPage from './ShipmentsAdminPage';
import InboundPage from './InboundPage';

export default function CombinedShipmentsPage({ initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'inbound' ? 'inbound' : 'outbound');

  return (
    <div style={{ margin: '-24px -24px 0 -24px' }}>
      {/* Tab bar — negative margins to break out of main-content padding */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '2px solid #e0e0e0', paddingLeft: 24, paddingTop: 8 }}>
        <button onClick={() => setActiveTab('outbound')} style={{
          padding: '10px 28px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
          background: 'none',
          borderBottom: activeTab === 'outbound' ? '3px solid #1976d2' : '3px solid transparent',
          color: activeTab === 'outbound' ? '#1976d2' : '#666',
          marginBottom: -2
        }}>
          🚚 Shipments
        </button>
        <button onClick={() => setActiveTab('inbound')} style={{
          padding: '10px 28px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
          background: 'none',
          borderBottom: activeTab === 'inbound' ? '3px solid #1976d2' : '3px solid transparent',
          color: activeTab === 'inbound' ? '#1976d2' : '#666',
          marginBottom: -2
        }}>
          📥 Inbound Shipments
        </button>
      </div>

      <div style={{ padding: '0 24px 24px 24px' }}>
        {activeTab === 'outbound' && <ShipmentsAdminPage />}
        {activeTab === 'inbound' && <InboundPage />}
      </div>
    </div>
  );
}
