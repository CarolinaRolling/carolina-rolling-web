import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hash, ShoppingCart, FileText } from 'lucide-react';
import DRNumbersPage from './DRNumbersPage';
import PONumbersPage from './PONumbersPage';
import InvoiceNumbersPage from './InvoiceNumbersPage';

function TrackingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dr';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  const TABS = [
    { key: 'dr', label: 'DR Numbers', icon: <Hash size={16} /> },
    { key: 'po', label: 'PO Numbers', icon: <ShoppingCart size={16} /> },
    { key: 'invoice', label: 'Invoice Numbers', icon: <FileText size={16} /> }
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1 className="page-title">📍 Tracking & Numbers</h1>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0', marginBottom: 16 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? '#1976d2' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#555',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: '0.95rem', borderRadius: '8px 8px 0 0',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dr' && <DRNumbersPage embedded={true} />}
      {activeTab === 'po' && <PONumbersPage embedded={true} />}
      {activeTab === 'invoice' && <InvoiceNumbersPage embedded={true} />}
    </div>
  );
}

export default TrackingPage;
