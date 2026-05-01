import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api';
export { API_BASE_URL };

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
export const login = (username, password, totpCode) => api.post('/auth/login', { username, password, totpCode });
export const getCurrentUser = () => api.get('/auth/me');

// 2FA
export const setup2FA = () => api.post('/auth/2fa/setup');
export const verify2FA = (code) => api.post('/auth/2fa/verify', { code });
export const disable2FA = (password) => api.post('/auth/2fa/disable', { password });
export const get2FAStatus = () => api.get('/auth/2fa/status');
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
export const getShipments = (params) => api.get('/shipments', { params });
export const getUnlinkedShipments = () => api.get('/shipments/unlinked');
export const getShipmentById = (id) => api.get(`/shipments/${id}`);
export const getShipmentByQRCode = (qrCode) => api.get(`/shipments/qr/${qrCode}`);
export const getShipmentByWorkOrderId = (workOrderId) => api.get(`/shipments/workorder/${workOrderId}`);
export const createShipment = (data) => api.post('/shipments', data);
export const updateShipment = (id, data) => api.put(`/shipments/${id}`, data);
export const deleteShipment = (id) => api.delete(`/shipments/${id}`);
export const linkShipmentToWorkOrder = (shipmentId, workOrderId) => api.post(`/shipments/${shipmentId}/link-workorder`, { workOrderId });
export const unlinkShipmentFromWorkOrder = (shipmentId) => api.post(`/shipments/${shipmentId}/unlink-workorder`);
export const archiveShipment = (id) => api.put(`/shipments/${id}/archive`);
export const bulkArchiveShipments = (ids) => api.post('/shipments/bulk-archive', { ids });
export const bulkDeleteShipments = (ids) => api.post('/shipments/bulk-delete', { ids });

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
export const downloadShipmentDocument = (shipmentId, documentId) =>
  api.get(`/shipments/${shipmentId}/documents/${documentId}/download`, { responseType: 'blob' });

// Locations
export const getLocations = () => api.get('/settings/locations');
export const updateLocations = (locations) => api.put('/settings/locations', { locations });
export const addLocation = (location) => api.post('/settings/locations', location);
export const getWarehouseMapUrl = () => api.get('/settings/warehouse-map');
export const uploadWarehouseMap = (file) => {
  const formData = new FormData();
  formData.append('image', file);
  return api.post('/settings/warehouse-map', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const deleteLocation = (id) => api.delete(`/settings/locations/${id}`);
export const updateLocation = (id, location) => api.put(`/settings/locations/${id}`, location);

// Inbound Orders
export const getInboundOrders = () => api.get('/inbound');
export const getInboundOrderById = (id) => api.get(`/inbound/${id}`);
export const createInboundOrder = (data) => api.post('/inbound', data);
export const updateInboundOrder = (id, data) => api.put(`/inbound/${id}`, data);
export const deleteInboundOrder = (id) => api.delete(`/inbound/${id}`);

// Work Orders
export const getWorkOrders = (params) => api.get('/workorders', { params });
export const getWorkOrderById = (id) => api.get(`/workorders/${id}`);
export const createWorkOrder = (data) => api.post('/workorders', data);
export const updateWorkOrder = (id, data) => api.put(`/workorders/${id}`, data);
export const createTransportPO = (workOrderId, tripId) => api.post(`/workorders/${workOrderId}/transport-po`, { tripId });
// Vendor portal admin
export const toggleVendorShare = (workOrderId, partId, fileId, visible) => api.put(`/workorders/${workOrderId}/parts/${partId}/files/${fileId}/vendor-share`, { visible });
export const resolveVendorIssue = (workOrderId, issueId, resolutionNotes) => api.put(`/workorders/${workOrderId}/vendor-issues/${issueId}/resolve`, { resolutionNotes });
export const acknowledgeVendorIssue = (workOrderId, issueId) => api.put(`/workorders/${workOrderId}/vendor-issues/${issueId}/acknowledge`);
export const updateDRNumber = (id, drNumber) => api.put(`/workorders/${id}/dr-number`, { drNumber });
export const deleteWorkOrder = (id, overrideCode) => api.delete(`/workorders/${id}`, overrideCode ? { data: { overrideCode } } : undefined);
export const getWorkOrderPrintPackage = (id, mode, html) => api.post(`/workorders/${id}/print-package`, { mode, html }, { responseType: 'blob', timeout: 60000 });

// Work Order Parts
export const addWorkOrderPart = (workOrderId, data) => api.post(`/workorders/${workOrderId}/parts`, data);
export const updateWorkOrderPart = (workOrderId, partId, data) => api.put(`/workorders/${workOrderId}/parts/${partId}`, data);
export const deleteWorkOrderPart = (workOrderId, partId) => api.delete(`/workorders/${workOrderId}/parts/${partId}`);
export const reorderWorkOrderParts = (workOrderId, partIds) => api.put(`/workorders/${workOrderId}/parts/reorder`, { partIds });
export const createOutsideProcessingPO = (workOrderId, data) => api.post(`/workorders/${workOrderId}/outside-processing`, data);
export const createOutsideProcessingPOsAuto = (workOrderId, partIds = null) => api.post(`/workorders/${workOrderId}/outside-processing/auto-bulk`, partIds ? { partIds } : {});
export const createServicePOsAuto = (workOrderId, vendorIds = null, startingPONumber = null) => {
  const body = {};
  if (vendorIds) body.vendorIds = vendorIds;
  if (startingPONumber) body.startingPONumber = startingPONumber;
  return api.post(`/workorders/${workOrderId}/services/auto-bulk`, body);
};
export const regenServicePO = (workOrderId, documentId) => api.post(`/workorders/${workOrderId}/services/${documentId}/regen`);
export const deleteServicePO = (workOrderId, documentId) => api.delete(`/workorders/${workOrderId}/services/${documentId}`);
export const editOutsideProcessingPO = (workOrderId, poNumber, data) => api.put(`/workorders/${workOrderId}/outside-processing/${poNumber}`, data);
export const regenOutsideProcessingPO = (workOrderId, poNumber) => api.post(`/workorders/${workOrderId}/outside-processing/${poNumber}/regen`);
export const cancelOutsideProcessingPO = (workOrderId, poNumber, reason) => api.delete(`/workorders/${workOrderId}/outside-processing/${poNumber}`, { data: { reason } });
export const updateOutsideProcessingStatus = (workOrderId, partId, status) => api.put(`/workorders/${workOrderId}/parts/${partId}/outside-processing-status`, { status });

// Work Order Part Files
export const uploadPartFiles = (workOrderId, partId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/workorders/${workOrderId}/parts/${partId}/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getPartFileSignedUrl = async (workOrderId, partId, fileId) => {
  const response = await api.get(`/workorders/${workOrderId}/parts/${partId}/files/${fileId}/signed-url`);
  return response.data.data;
};
export const downloadPartFile = (workOrderId, partId, fileId) =>
  api.get(`/workorders/${workOrderId}/parts/${partId}/files/${fileId}/download`, { responseType: 'blob' });
export const deletePartFile = (workOrderId, partId, fileId) => 
  api.delete(`/workorders/${workOrderId}/parts/${partId}/files/${fileId}`);

// Work Order Documents (for order-level attachments like POs, supplier docs)
export const uploadWorkOrderDocuments = (workOrderId, files, documentType, portalVisible = false) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('documents', file));
  if (documentType) formData.append('documentType', documentType);
  formData.append('portalVisible', String(portalVisible));
  return api.post(`/workorders/${workOrderId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getWorkOrderDocumentSignedUrl = (workOrderId, documentId) => 
  api.get(`/workorders/${workOrderId}/documents/${documentId}/signed-url`);
export const downloadWorkOrderDocument = (workOrderId, documentId) =>
  api.get(`/workorders/${workOrderId}/documents/${documentId}/download`, { responseType: 'blob' });
export const deleteWorkOrderDocument = (workOrderId, documentId) => 
  api.delete(`/workorders/${workOrderId}/documents/${documentId}`);
export const regeneratePODocument = (workOrderId, documentId) => 
  api.post(`/workorders/${workOrderId}/documents/${documentId}/regenerate`);
export const createPODocument = (workOrderId, poNumber) => 
  api.post(`/workorders/${workOrderId}/create-po-pdf`, { poNumber });
export const toggleDocumentPortal = (workOrderId, documentId, portalVisible) =>
  api.patch(`/workorders/${workOrderId}/documents/${documentId}/portal`, { portalVisible });

// Work Order Material Ordering
export const orderWorkOrderMaterial = (workOrderId, data) => 
  api.post(`/workorders/${workOrderId}/order-material`, data);

// Work Order Estimate Linking
export const searchLinkableEstimates = (query) => 
  api.get('/workorders/linkable-estimates/search', { params: { q: query } });
export const linkEstimateToWorkOrder = (workOrderId, estimateId) => 
  api.post(`/workorders/${workOrderId}/link-estimate`, { estimateId });
export const unlinkEstimateFromWorkOrder = (workOrderId) => 
  api.post(`/workorders/${workOrderId}/unlink-estimate`);

// Estimates
export const getEstimates = (params) => api.get('/estimates', { params });
export const getEstimateById = (id) => api.get(`/estimates/${id}`);
export const createEstimate = (data) => api.post('/estimates', data);
export const updateEstimate = (id, data) => api.put(`/estimates/${id}`, data);
export const deleteEstimate = (id) => api.delete(`/estimates/${id}`);
export const restoreEstimate = (id) => api.post(`/estimates/${id}/restore`);
export const permanentDeleteEstimate = (id) => api.delete(`/estimates/${id}/permanent`);
export const getEstimateTrash = () => api.get('/estimates/trash');

// Estimate Parts
export const addEstimatePart = (estimateId, data) => api.post(`/estimates/${estimateId}/parts`, data);
export const generateOutsideProcessingPO = (estimateId, partId, notes) => api.post(`/estimates/${estimateId}/parts/${partId}/outside-processing-po`, { notes });
export const emailOutsideProcessingPO = (estimateId, partId, contactEmail) => api.post(`/estimates/${estimateId}/parts/${partId}/outside-processing-email`, { contactEmail });
export const updateEstimatePart = (estimateId, partId, data) => api.put(`/estimates/${estimateId}/parts/${partId}`, data);
export const reorderEstimateParts = (estimateId, partIds) => api.put(`/estimates/${estimateId}/parts/reorder`, { partIds });
export const deleteEstimatePart = (estimateId, partId) => api.delete(`/estimates/${estimateId}/parts/${partId}`);

// Estimate Part Files
export const getEstimatePartFiles = (estimateId, partId) => api.get(`/estimates/${estimateId}/parts/${partId}/files`);
export const viewEstimatePartFile = (estimateId, partId, fileId) => api.get(`/estimates/${estimateId}/parts/${partId}/files/${fileId}/view`);
export const uploadEstimatePartFile = (estimateId, partId, fileOrFiles, fileType = 'other') => {
  const formData = new FormData();
  const firstFile = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
  if (Array.isArray(fileOrFiles)) {
    fileOrFiles.forEach(f => formData.append('files', f));
  } else {
    formData.append('files', fileOrFiles);
  }
  formData.append('fileType', fileType);
  // Send the file's actual last-modified date from the filesystem
  if (firstFile && firstFile.lastModified) {
    formData.append('fileLastModified', String(firstFile.lastModified));
  }
  return api.post(`/estimates/${estimateId}/parts/${partId}/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const aiParseDocument = (estimateId, file, additionalNotes = '') => {
  const formData = new FormData();
  formData.append('file', file);
  if (additionalNotes) formData.append('additionalNotes', additionalNotes);
  return api.post(`/estimates/${estimateId}/ai-parse-document`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000 // 2 min for AI processing
  });
};
export const deleteEstimatePartFile = (estimateId, partId, fileId) => 
  api.delete(`/estimates/${estimateId}/parts/${partId}/files/${fileId}`);
export const toggleEstimateFilePortal = (estimateId, partId, fileId, portalVisible) =>
  api.patch(`/estimates/${estimateId}/parts/${partId}/files/${fileId}/portal`, { portalVisible });

// Reset estimate conversion (if work order is missing)
export const resetEstimateConversion = (estimateId) => api.post(`/estimates/${estimateId}/reset-conversion`);
export const checkOrphanedEstimates = () => api.get('/estimates/check-orphaned');

// Order Material (creates inbound orders)
export const orderMaterial = (estimateId, data) => api.post(`/estimates/${estimateId}/order-material`, data);

// Estimate Files
export const uploadEstimateFiles = (estimateId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/estimates/${estimateId}/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getEstimateFileSignedUrl = async (estimateId, fileId) => {
  const response = await api.get(`/estimates/${estimateId}/files/${fileId}/signed-url`);
  return response.data.data;
};
export const deleteEstimateFile = (estimateId, fileId) => api.delete(`/estimates/${estimateId}/files/${fileId}`);

// Download Estimate PDF
export const downloadEstimatePDF = (estimateId) => api.get(`/estimates/${estimateId}/pdf`, { responseType: 'blob' });

// Convert Estimate to Work Order
export const convertEstimateToWorkOrder = (estimateId, data) => api.post(`/estimates/${estimateId}/convert-to-workorder`, data);

// Duplicate Estimate (for repeat orders)
export const duplicateEstimate = (estimateId, data) => api.post(`/estimates/${estimateId}/duplicate`, data);

// Archive old estimates
export const archiveOldEstimates = () => api.post('/estimates/archive-old');

// Work Order Shipping & Archiving
export const shipWorkOrder = (id, data) => api.post(`/workorders/${id}/ship`, data);
export const archiveWorkOrder = (id) => api.post(`/workorders/${id}/archive`);
export const recordPickup = (id, data) => api.post(`/workorders/${id}/pickup`, data);
export const deletePickupEntry = (id, index) => api.delete(`/workorders/${id}/pickup/${index}`);
export const updatePickupEntry = (id, index, data) => api.put(`/workorders/${id}/pickup/${index}`, data);
export const getPickupReceipt = (id, index) => api.get(`/workorders/${id}/pickup/${index}/receipt`, { responseType: 'blob' });
export const recordPayment = (id, data) => api.post(`/workorders/${id}/record-payment`, data);
export const clearPayment = (id) => api.post(`/workorders/${id}/clear-payment`);
export const getArchivedWorkOrders = (params) => api.get('/workorders/archived', { params });
export const getRecentlyCompletedOrders = () => api.get('/workorders/recently-completed');
export const duplicateWorkOrderToEstimate = (id) => api.post(`/workorders/${id}/duplicate-to-estimate`);

// DR Numbers
export const getDRNumbers = (params) => api.get('/dr-numbers', { params });
export const getDRNumberStats = () => api.get('/dr-numbers/stats');
export const getNextDRNumber = () => api.get('/dr-numbers/next');
export const setNextDRNumber = (nextNumber) => api.put('/dr-numbers/next', { nextNumber });
export const assignDRNumber = (data) => api.post('/dr-numbers/assign', data);
export const voidDRNumber = (drNumber, reason, voidedBy) => api.post(`/dr-numbers/${drNumber}/void`, { reason, voidedBy });
export const releaseDRNumber = (drNumber) => api.delete(`/dr-numbers/${drNumber}/release`);
export const getVoidedDRNumbers = () => api.get('/dr-numbers/voided');

// PO Numbers
export const getPONumbers = (params) => api.get('/po-numbers', { params });
export const getPONumberStats = () => api.get('/po-numbers/stats');
export const getNextPONumber = () => api.get('/po-numbers/next');
export const setNextPONumber = (nextNumber) => api.put('/po-numbers/next', { nextNumber });
export const assignPONumber = (data) => api.post('/po-numbers/assign', data);
export const voidPONumber = (poNumber, reason, voidedBy) => api.post(`/po-numbers/${poNumber}/void`, { reason, voidedBy });
export const getVoidedPONumbers = () => api.get('/po-numbers/voided');
export const deletePONumber = (id) => api.delete(`/po-numbers/${id}`);
export const archivePONumber = (id) => api.post(`/po-numbers/${id}/archive`);
export const unarchivePONumber = (id) => api.post(`/po-numbers/${id}/unarchive`);
export const releasePONumber = (poNumber) => api.delete(`/po-numbers/${poNumber}/release`);
export const reassignPONumber = (oldPoNumber, newPoNumber) => api.put(`/po-numbers/${oldPoNumber}/reassign`, { newPoNumber });

// Daily Email Settings
export const getDailyEmailSettings = () => api.get('/email/settings');
export const updateDailyEmailSettings = (settings) => api.put('/email/settings', settings);
export const getDailyEmailActivities = (params) => api.get('/email/activities', { params });
export const sendDailyEmailNow = () => api.post('/email/send-daily');
export const sendTestEmail = () => api.post('/email/test');
export const getEmailLogs = () => api.get('/email/logs');

// Backup
export const getBackupInfo = () => api.get('/backup/info');
export const downloadBackup = (params) => api.get('/backup', { params });
export const restoreBackup = (data) => api.post('/backup/restore', data);
export const runBackgroundBackup = (data) => api.post('/backup/run-background', data);

// Email Settings
export const getNotificationEmail = () => api.get('/settings/notification-email');
export const updateNotificationEmail = (email) => api.put('/settings/notification-email', { email });

// General Settings
export const getSettings = (key) => api.get(`/settings/${key}`);
export const updateSettings = (key, value) => api.put(`/settings/${key}`, { value });
export const getPrinterConfig = () => api.get('/settings/printer-config');
export const updatePrinterConfig = (config) => api.put('/settings/printer-config', config);

// Schedule Email Settings
export const getScheduleEmailSettings = () => api.get('/settings/schedule-email');
export const updateScheduleEmailSettings = (email, enabled) => 
  api.put('/settings/schedule-email', { email, enabled });
export const sendScheduleEmailNow = () => api.post('/settings/schedule-email/send');

// Clients
export const getClients = (params) => api.get('/clients', { params });
export const searchClients = (q) => api.get('/clients/search', { params: { q } });
export const checkClientNoTag = (name) => api.get('/clients/check-notag', { params: { name } });
export const getClient = (id) => api.get(`/clients/${id}`);
export const createClient = (data) => api.post('/clients', data);
export const updateClient = (id, data) => api.put(`/clients/${id}`, data);
export const deleteClient = (id) => api.delete(`/clients/${id}`);

// Vendors
export const getVendors = (params) => api.get('/vendors', { params });
export const searchVendors = (q) => api.get('/vendors/search', { params: { q } });
export const getVendor = (id) => api.get(`/vendors/${id}`);
export const createVendor = (data) => api.post('/vendors', data);
export const updateVendor = (id, data) => api.put(`/vendors/${id}`, data);
export const deleteVendor = (id) => api.delete(`/vendors/${id}`);
export const getVendorHistory = (vendorId) => api.get(`/business/vendor-history/${vendorId}`);

// Permit Verification
export const verifySinglePermit = (data) => api.post('/verify-permit', data);
export const startBatchVerification = () => api.post('/verify-permits/batch');
export const getBatchStatus = () => api.get('/verify-permits/batch/status');
export const cancelBatchVerification = () => api.post('/verify-permits/batch/cancel');
export const downloadResaleReport = () => api.get('/verify-permits/report-pdf', { responseType: 'blob' });

// API Key Management
export const getApiKeys = () => api.get('/auth/api-keys');
export const getApiKeySetupQR = (id) => api.get(`/auth/api-keys/${id}/setup-qr`);
export const createApiKey = (data) => api.post('/auth/api-keys', data);
export const updateApiKey = (id, data) => api.put(`/auth/api-keys/${id}`, data);
export const revokeApiKey = (id) => api.delete(`/auth/api-keys/${id}`);
export const deleteApiKeyPermanent = (id) => api.delete(`/auth/api-keys/${id}/permanent`);
export const getApprovedIPs = () => api.get('/auth/approved-ips');
export const updateApprovedIPs = (ips) => api.put('/auth/approved-ips', { ips });

export default api;


// QuickBooks IIF Export
export const exportWorkOrderIIF = (id) => api.get(`/quickbooks/export/${id}`, { responseType: 'text', transformResponse: [(data) => data] });
export const previewWorkOrderIIF = (id) => api.get(`/quickbooks/preview/${id}`);
export const exportBatchIIF = (workOrderIds) => api.post('/quickbooks/export-batch', { workOrderIds }, { responseType: 'text', transformResponse: [(data) => data] });
export const previewIIF = (id) => api.get(`/quickbooks/preview/${id}`);
export const exportCustomersIIF = () => api.post('/quickbooks/export-customers', {}, { responseType: 'blob' });

// Shop Supplies
export const getShopSupplies = (params) => api.get('/shop-supplies', { params });
export const getLowStockSupplies = () => api.get('/shop-supplies/low-stock');
export const getShopSupplyByQR = (qrCode) => api.get(`/shop-supplies/qr/${qrCode}`);
export const createShopSupply = (data) => api.post('/shop-supplies', data);
export const updateShopSupply = (id, data) => api.put(`/shop-supplies/${id}`, data);
export const consumeShopSupply = (id, data) => api.post(`/shop-supplies/${id}/consume`, data);
export const refillShopSupply = (id, data) => api.post(`/shop-supplies/${id}/refill`, data);
export const getShopSupplyLogs = (id) => api.get(`/shop-supplies/${id}/logs`);
export const deleteShopSupply = (id) => api.delete(`/shop-supplies/${id}`);
export const uploadShopSupplyImage = (id, file) => {
  const formData = new FormData();
  formData.append('image', file);
  return api.post(`/shop-supplies/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const deleteShopSupplyImage = (id) => api.delete(`/shop-supplies/${id}/image`);
export const getShopSupplyCategories = () => api.get('/shop-supplies/categories');
export const updateShopSupplyCategories = (categories) => api.put('/shop-supplies/categories', { categories });

// Email Scanner
export const getEmailScannerStatus = () => api.get('/email-scanner/status');
export const getEmailScannerAccounts = () => api.get('/email-scanner/accounts');
export const startGmailOAuth = () => api.get('/email-scanner/oauth/start');
export const disconnectGmailAccount = (id) => api.delete(`/email-scanner/accounts/${id}`);
export const toggleGmailAccount = (id) => api.put(`/email-scanner/accounts/${id}/toggle`);
export const triggerEmailScan = (hoursBack = 0) => api.post('/email-scanner/scan-now', hoursBack ? { hoursBack } : {});
export const getEmailScanHistory = () => api.get('/email-scanner/history');
export const getPendingOrders = (status) => api.get('/email-scanner/pending-orders', { params: { status } });
export const approvePendingOrder = (id, data) => api.post(`/email-scanner/pending-orders/${id}/approve`, data);
export const rejectPendingOrder = (id, data) => api.post(`/email-scanner/pending-orders/${id}/reject`, data);
export const deletePendingOrder = (id) => api.delete(`/email-scanner/pending-orders/${id}`);
export const linkPendingOrderEstimate = (id, estimateId) => api.put(`/email-scanner/pending-orders/${id}/link-estimate`, { estimateId });
export const searchEstimatesForLink = (q) => api.get('/email-scanner/search-estimates', { params: { q } });
export const replyWithPdf = (estimateId, message) => api.post(`/email-scanner/reply-with-pdf/${estimateId}`, { message });
export const sendVendorRfq = (estimateId, data) => api.post(`/email-scanner/vendor-rfq/${estimateId}`, data);
export const getVendorContacts = (vendorId) => api.get(`/email-scanner/vendor-contacts/${vendorId}`);
export const getVendorById = (vendorId) => api.get(`/vendors/${vendorId}`);
export const sendVendorPo = (workOrderId, data) => api.post(`/email-scanner/vendor-po/${workOrderId}`, data);
export const parseDocumentWithAI = (file, clientName, parsingNotes) => {
  const formData = new FormData();
  formData.append('file', file);
  if (clientName) formData.append('clientName', clientName);
  if (parsingNotes) formData.append('parsingNotes', parsingNotes);
  return api.post('/email-scanner/parse-document', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000 // 60s timeout for AI processing
  });
};
export const getEmailNotifications = () => api.get('/email-scanner/notifications');
export const dismissEmailNotification = (id) => api.post(`/email-scanner/notifications/${id}/dismiss`);
export const getMonitoredClients = () => api.get('/email-scanner/monitored-clients');
export const retryScannedEmail = (id) => api.post(`/email-scanner/retry/${id}`);
export const deleteScannedEmail = (id) => api.delete(`/email-scanner/history/${id}`);
export const getGeneralParsingNotes = () => api.get('/email-scanner/general-notes');
export const updateGeneralParsingNotes = (notes) => api.put('/email-scanner/general-notes', { notes });
export const getGeneralScannerNotes = () => api.get('/email-scanner/general-notes');
export const updateGeneralScannerNotes = (notes) => api.put('/email-scanner/general-notes', { notes });

// Todos
export const getTodos = (params) => api.get('/todos', { params });
export const createTodo = (data) => api.post('/todos', data);
export const updateTodo = (id, data) => api.put(`/todos/${id}`, data);
export const completeTodo = (id) => api.post(`/todos/${id}/complete`);
export const acceptTodo = (id) => api.post(`/todos/${id}/accept`);
export const denyTodo = (id, reason) => api.post(`/todos/${id}/deny`, { reason });
export const deleteTodo = (id) => api.delete(`/todos/${id}`);

// Scrap Pickup
export const getScrapConfig = () => api.get('/settings/scrap-config');
export const updateScrapConfig = (data) => api.put('/settings/scrap-config', data);
export const getScrapLog = () => api.get('/settings/scrap-log');
export const requestScrapPickup = (scrapType) => api.post('/settings/scrap-request', { scrapType });
export const getScrapPending = () => api.get('/settings/scrap-pending');
export const confirmScrapPickup = (scrapType) => api.post('/settings/scrap-confirm-pickup', { scrapType });

// Invoicing
export const getInvoiceQueue = () => api.get('/workorders/invoicing/queue');
export const getInvoiceHistory = () => api.get('/workorders/invoicing/history');
export const recordInvoice = (id, formData) => api.post(`/workorders/${id}/invoice`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const uploadInvoicePdf = (id, formData) => api.post(`/workorders/${id}/invoice-pdf`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const clearInvoice = (id) => api.delete(`/workorders/${id}/invoice`);
export const skipInvoice = (id, reason) => api.post(`/workorders/${id}/skip-invoice`, { reason });
export const restoreInvoice = (id) => api.post(`/workorders/${id}/restore-invoice`);
export const markInvoiceSent = (id, formData) => api.post(`/workorders/${id}/mark-invoice-sent`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getInvoiceSkipped = () => api.get('/workorders/invoicing/skipped');
export const getNextInvoiceNumber = () => api.get('/quickbooks/next-invoice-number');
export const setNextInvoiceNumber = (nextNumber) => api.put('/quickbooks/next-invoice-number', { nextNumber });
export const assignInvoiceNumber = (woId) => api.post(`/quickbooks/assign-invoice-number/${woId}`);
export const getInvoiceNumbers = () => api.get('/quickbooks/invoice-numbers');
export const voidInvoiceNumber = (id, reason) => api.post(`/quickbooks/invoice-numbers/${id}/void`, { reason });
export const createManualInvoiceNumber = (data) => api.post('/quickbooks/invoice-numbers/manual', data);
export const importInvoiceNumbers = (pairs) => api.post('/quickbooks/import-invoice-numbers', { pairs });
export const emailInvoice = (id, email) => api.post(`/workorders/${id}/email-invoice`, { email });
export const repairPricing = () => api.post('/workorders/repair-pricing');

// ============= BUSINESS =============
// Liabilities
export const getLiabilities = (params) => api.get('/business/liabilities', { params });
export const getLiabilitySummary = () => api.get('/business/liabilities/summary');
export const createLiability = (data) => api.post('/business/liabilities', data);
export const updateLiability = (id, data) => api.put(`/business/liabilities/${id}`, data);
export const payLiability = (id, data) => api.post(`/business/liabilities/${id}/pay`, data);
export const deleteLiability = (id) => api.delete(`/business/liabilities/${id}`);
export const uploadBillFile = (id, file) => { const fd = new FormData(); fd.append('file', file); return api.post(`/business/liabilities/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); };
export const approveBill = (id, data) => api.post(`/business/liabilities/${id}/approve`, data);
export const rejectBill = (id) => api.post(`/business/liabilities/${id}/reject`);
// Employees
export const getEmployees = (params) => api.get('/business/employees', { params });
export const createEmployee = (data) => api.post('/business/employees', data);
export const updateEmployee = (id, data) => api.put(`/business/employees/${id}`, data);
export const deleteEmployee = (id) => api.delete(`/business/employees/${id}`);
export const reorderEmployees = (order) => api.post('/business/employees/reorder', { order });
export const sendPayrollEmail = (payrollId, data) => api.post(`/business/payroll/${payrollId}/send-email`, data);
export const getEmailAccounts = () => api.get('/email-scanner/accounts');
export const updateVacationLog = (id, vacationLog) => api.put(`/business/employees/${id}/vacation-log`, { vacationLog });
// Payments
export const getOutstandingPayments = () => api.get('/business/payments/outstanding');
export const getPaymentHistory = (params) => api.get('/business/payments/history', { params });
export const recordBusinessPayment = (woId, data) => api.post(`/business/payments/${woId}/record`, data);
export const clearBusinessPayment = (woId) => api.post(`/business/payments/${woId}/clear`);
// Payroll
export const getPayrolls = () => api.get('/business/payroll');
export const createPayroll = (data) => api.post('/business/payroll', data);
export const getPayroll = (id) => api.get(`/business/payroll/${id}`);
export const updatePayrollEntry = (payrollId, entryId, data) => api.put(`/business/payroll/${payrollId}/entries/${entryId}`, data);
export const updatePayrollWeek = (id, data) => api.put(`/business/payroll/${id}`, data);
export const submitPayroll = (id, data) => api.post(`/business/payroll/${id}/submit`, data);
export const deletePayroll = (id) => api.delete(`/business/payroll/${id}`);

// Weld Procedures (WPS)
export const getWeldProcedures = () => api.get('/business/wps');
export const getWeldProcedure = (id) => api.get(`/business/wps/${id}`);
export const createWeldProcedure = (data) => api.post('/business/wps', data);
export const updateWeldProcedure = (id, data) => api.put(`/business/wps/${id}`, data);
export const deleteWeldProcedure = (id) => api.delete(`/business/wps/${id}`);

// Certificate of Conformance
export const generateCOC = (workOrderId, data) => api.post(`/workorders/${workOrderId}/coc`, data, { responseType: 'blob' });
// Calendar
export const getCalendarEvents = (params) => api.get('/business/calendar', { params });
export const getUpcomingEvents = () => api.get('/business/calendar/upcoming');
export const createCalendarEvent = (data) => api.post('/business/calendar', data);
export const updateCalendarEvent = (id, data) => api.put(`/business/calendar/${id}`, data);
export const completeCalendarEvent = (id) => api.post(`/business/calendar/${id}/complete`);
export const deleteCalendarEvent = (id) => api.delete(`/business/calendar/${id}`);

// Communication Center
export const getCommEmails = (params) => api.get('/com-center/emails', { params });
export const archiveCommEmail = (id) => api.patch(`/com-center/emails/${id}/archive`);
export const updateCommEmailCategory = (id, category) => api.patch(`/com-center/emails/${id}/category`, { category });
