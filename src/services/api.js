import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (username, password) => api.post('/auth/login', { username, password });
export const getCurrentUser = () => api.get('/auth/me');
export const changePassword = (currentPassword, newPassword) => 
  api.put('/auth/change-password', { currentPassword, newPassword });

// Admin - Users
export const getUsers = () => api.get('/auth/users');
export const createUser = (userData) => api.post('/auth/register', userData);
export const updateUser = (id, userData) => api.put(`/auth/users/${id}`, userData);
export const deleteUser = (id) => api.delete(`/auth/users/${id}`);

// Admin - Activity Logs
export const getActivityLogs = (limit = 100, offset = 0) => 
  api.get(`/auth/logs?limit=${limit}&offset=${offset}`);

// Shipments
export const getShipments = () => api.get('/shipments');
export const getShipmentById = (id) => api.get(`/shipments/${id}`);
export const getShipmentByQRCode = (qrCode) => api.get(`/shipments/qr/${qrCode}`);
export const createShipment = (data) => api.post('/shipments', data);
export const updateShipment = (id, data) => api.put(`/shipments/${id}`, data);
export const deleteShipment = (id) => api.delete(`/shipments/${id}`);

// Photos
export const uploadPhotos = (shipmentId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));
  return api.post(`/shipments/${shipmentId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deletePhoto = (shipmentId, photoId) => 
  api.delete(`/shipments/${shipmentId}/photos/${photoId}`);

// Documents - Upload to Cloudinary via backend
export const uploadDocuments = async (shipmentId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('documents', file));
  return api.post(`/shipments/${shipmentId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteDocument = async (shipmentId, documentId) => {
  return api.delete(`/shipments/${shipmentId}/documents/${documentId}`);
};

// Get signed URL for viewing private documents
export const getDocumentSignedUrl = async (shipmentId, documentId) => {
  const response = await api.get(`/shipments/${shipmentId}/documents/${documentId}/signed-url`);
  return response.data.data;
};

// Locations
export const getLocations = () => api.get('/settings/locations');
export const updateLocations = (locations) => api.put('/settings/locations', { locations });
export const addLocation = (location) => api.post('/settings/locations', location);
export const deleteLocation = (id) => api.delete(`/settings/locations/${id}`);
export const updateLocation = (id, location) => api.put(`/settings/locations/${id}`, location);

// Inbound Orders
export const getInboundOrders = () => api.get('/inbound');
export const getInboundOrderById = (id) => api.get(`/inbound/${id}`);
export const createInboundOrder = (data) => api.post('/inbound', data);
export const updateInboundOrder = (id, data) => api.put(`/inbound/${id}`, data);
export const deleteInboundOrder = (id) => api.delete(`/inbound/${id}`);

// Email Settings
export const getNotificationEmail = () => api.get('/settings/notification-email');
export const updateNotificationEmail = (email) => api.put('/settings/notification-email', { email });

// Schedule Email Settings
export const getScheduleEmailSettings = () => api.get('/settings/schedule-email');
export const updateScheduleEmailSettings = (email, enabled) => 
  api.put('/settings/schedule-email', { email, enabled });
export const sendScheduleEmailNow = () => api.post('/settings/schedule-email/send');

export default api;
