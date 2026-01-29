import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import InventoryPage from './pages/InventoryPage';
import ShipmentDetailsPage from './pages/ShipmentDetailsPage';
import NewShipmentPage from './pages/NewShipmentPage';
import InboundPage from './pages/InboundPage';
import InboundDetailsPage from './pages/InboundDetailsPage';
import SettingsPage from './pages/SettingsPage';
import LocationSettingsPage from './pages/LocationSettingsPage';
import AdminPage from './pages/AdminPage';
import SchedulingPage from './pages/SchedulingPage';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Admin Route Component
const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  
  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAdmin()) {
    return <Navigate to="/inventory" replace />;
  }
  
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/inventory" replace /> : <LoginPage />} />
      
      <Route path="/" element={<Navigate to="/inventory" replace />} />
      
      <Route path="/inventory" element={
        <ProtectedRoute>
          <Layout><InventoryPage /></Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/shipment/:id" element={
        <ProtectedRoute>
          <Layout><ShipmentDetailsPage /></Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/new-shipment" element={
        <ProtectedRoute>
          <Layout><NewShipmentPage /></Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/inbound" element={
        <ProtectedRoute>
          <Layout><InboundPage /></Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/inbound/:id" element={
        <ProtectedRoute>
          <Layout><InboundDetailsPage /></Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout><SettingsPage /></Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/settings/locations" element={
        <ProtectedRoute>
          <Layout><LocationSettingsPage /></Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/scheduling" element={
        <ProtectedRoute>
          <Layout><SchedulingPage /></Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin" element={
        <AdminRoute>
          <Layout><AdminPage /></Layout>
        </AdminRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
