import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Save, X, Trash2, Plus, Package, FileText, User, 
  Calendar, Printer, Check, Upload, Eye, Tag, Truck, MapPin, Clock, File, ShoppingCart, Download, Link2, Unlink, RefreshCw
} from 'lucide-react';
import PlateRollForm from '../components/PlateRollForm';
import AngleRollForm from '../components/AngleRollForm';
import PipeRollForm from '../components/PipeRollForm';
import SquareTubeRollForm from '../components/SquareTubeRollForm';
import FlatBarRollForm from '../components/FlatBarRollForm';
import ChannelRollForm from '../components/ChannelRollForm';
import BeamRollForm from '../components/BeamRollForm';
import ConeRollForm from '../components/ConeRollForm';
import ShapedPlateForm from '../components/ShapedPlateForm';
import TeeBarRollForm from '../components/TeeBarRollForm';
import RushServiceForm, { EXPEDITE_OPTIONS, EMERGENCY_OPTIONS } from '../components/RushServiceForm';
import PressBrakeForm from '../components/PressBrakeForm';
import FlatStockForm from '../components/FlatStockForm';
import FabServiceForm from '../components/FabServiceForm';
import ShopRateForm from '../components/ShopRateForm';
import HeatNumberInput from '../components/HeatNumberInput';
import { 
  getWorkOrderById, updateWorkOrder, deleteWorkOrder,
  addWorkOrderPart, updateWorkOrderPart, deleteWorkOrderPart, reorderWorkOrderParts,
  createOutsideProcessingPO, createOutsideProcessingPOsAuto, createServicePOsAuto, regenServicePO, deleteServicePO, updateOutsideProcessingStatus, createTransportPO,
  editOutsideProcessingPO, regenOutsideProcessingPO, cancelOutsideProcessingPO,
  toggleVendorShare, resolveVendorIssue,
  uploadPartFiles, getPartFileSignedUrl, downloadPartFile, deletePartFile,
  uploadWorkOrderDocuments, getWorkOrderDocumentSignedUrl, downloadWorkOrderDocument, deleteWorkOrderDocument, regeneratePODocument, createPODocument, toggleDocumentPortal,
  getShipmentByWorkOrderId, getNextPONumber, orderWorkOrderMaterial,
  searchVendors, searchLinkableEstimates, linkEstimateToWorkOrder, unlinkEstimateFromWorkOrder,
  searchClients, getSettings, getUnlinkedShipments, linkShipmentToWorkOrder, unlinkShipmentFromWorkOrder, duplicateWorkOrderToEstimate,
  getWorkOrderPrintPackage, updateDRNumber, recordPickup, deletePickupEntry, updatePickupEntry, getPickupReceipt, recordPayment, clearPayment,
  exportWorkOrderIIF, assignInvoiceNumber, API_BASE_URL,
  generateCOC, getWeldProcedures
} from '../services/api';

const PART_TYPES = {
  plate_roll: { label: 'Plate Roll', icon: '🔩', desc: 'Flat plate rolling with arc calculator', fields: ['material', 'thickness', 'width', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  shaped_plate: { label: 'Shaped Plate', icon: '⭕', desc: 'Round plates, donuts, and custom shapes', fields: ['material', 'thickness', 'outerDiameter'] },
  cone_roll: { label: 'Cone Layout', icon: '🔺', desc: 'Cone segment design with AutoCAD export', fields: ['material', 'thickness', 'width', 'length'] },
  angle_roll: { label: 'Angle Roll', icon: '📐', desc: 'Angle iron rolling', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  flat_bar: { label: 'Flat & Square Bar', icon: '▬', desc: 'Flat bar and square bar bending', fields: ['material', 'thickness', 'width', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  pipe_roll: { label: 'Pipes/Tubes/Round', icon: '🔧', desc: 'Pipe, tube, and solid round bar bending', fields: ['material', 'outerDiameter', 'wallThickness', 'length', 'radius', 'diameter', 'arcDegrees'] },
  tube_roll: { label: 'Square & Rect Tubing', icon: '⬜', desc: 'Square and rectangular tube rolling', fields: ['material', 'sectionSize', 'thickness', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  channel_roll: { label: 'Channel', icon: '🔲', desc: 'C-channel rolling', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  beam_roll: { label: 'Beam', icon: '🏗️', desc: 'I-beam and H-beam rolling', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  tee_bar: { label: 'Tee Bars', icon: '🇹', desc: 'Structural tee rolling', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  press_brake: { label: 'Press Brake', icon: '⏏️', desc: 'Press brake forming from print', fields: ['material', 'thickness', 'width', 'length'] },
  flat_stock: { label: 'Flat Stock', icon: '📄', desc: 'Flat material cut to custom print', fields: ['material', 'thickness', 'width', 'length'] },
  fab_service: { label: 'Fabrication Service', icon: '🔥', desc: 'Welding, fitting, cut-to-fit services', fields: [] },
  shop_rate: { label: 'Shop Rate', icon: '⏱️', desc: 'Hourly rate — custom work', fields: [] },
  rush_service: { label: 'Expedite & Emergency', icon: '🚨', desc: 'Rush order surcharge and off-hour opening fees', fields: [] },
  other: { label: 'Other', icon: '📦', desc: 'Custom or miscellaneous parts', fields: ['material', 'thickness', 'width', 'length', 'sectionSize', 'outerDiameter', 'wallThickness', 'rollType', 'radius', 'diameter', 'arcDegrees'] }
};

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)})${digits.slice(3)}`;
  return `(${digits.slice(0,3)})${digits.slice(3,6)}-${digits.slice(6)}`;
};

// Returns true if a part is flagged as hidden-from-customer (Rolling Assist mode).
const isHiddenFromCustomer = (part) => {
  if (!part) return false;
  if (part._fsHiddenFromCustomer) return true;
  if (part.formData && part.formData._fsHiddenFromCustomer) return true;
  return false;
};

function WorkOrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [showAccountingContact, setShowAccountingContact] = useState(false);
  const [woTab, setWoTab] = useState('parts');
  const [clientPaymentTerms, setClientPaymentTerms] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [allShipments, setAllShipments] = useState([]);
  const [activeShipmentIdx, setActiveShipmentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showReceivingInfo, setShowReceivingInfo] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showPartModal, setShowPartModal] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderParts, setReorderParts] = useState([]);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [serviceModalSelected, setServiceModalSelected] = useState(new Set()); // vendor IDs to PO
  const [serviceModalSubmitting, setServiceModalSubmitting] = useState(false);
  const [servicesStartingPONumber, setServicesStartingPONumber] = useState('');
  const [showPartTypePicker, setShowPartTypePicker] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partData, setPartData] = useState({});
  const [selectedPartType, setSelectedPartType] = useState('');
  const [partFormError, setPartFormError] = useState(null);  const [uploadingFiles, setUploadingFiles] = useState(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadingMtrs, setUploadingMtrs] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupData, setPickupData] = useState({ pickedUpBy: '', type: null, items: {} });
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showCocModal, setShowCocModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cocWpsList, setCocWpsList] = useState([]);
  const [cocWpsId, setCocWpsId] = useState('');
  const [cocCertifiedBy, setCocCertifiedBy] = useState('Jason Thornton');
  const [cocDate, setCocDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cocGenerating, setCocGenerating] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderPONumber, setOrderPONumber] = useState('');
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  const [ordering, setOrdering] = useState(false);
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [showLinkEstimateModal, setShowLinkEstimateModal] = useState(false);
  const [estimateSearchQuery, setEstimateSearchQuery] = useState('');
  const [estimateSearchResults, setEstimateSearchResults] = useState([]);
  const [searchingEstimates, setSearchingEstimates] = useState(false);
  const [linkingEstimate, setLinkingEstimate] = useState(false);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [laborMinimums, setLaborMinimums] = useState([]);
  const fileInputRefs = useRef({});
  const docInputRef = useRef(null);
  const mtrInputRef = useRef(null);
  const [defaultTaxRate, setDefaultTaxRate] = useState(9.75);
  const [showLinkShipmentModal, setShowLinkShipmentModal] = useState(false);
  const [unlinkedShipments, setUnlinkedShipments] = useState([]);
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState('');
  const [shipmentLinking, setShipmentLinking] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [editingDR, setEditingDR] = useState(false);
  const [drInput, setDrInput] = useState('');
  const [codConfirmOpen, setCodConfirmOpen] = useState(false);
  const [codOverrideInput, setCodOverrideInput] = useState('');
  const [codOverridePassword, setCodOverridePassword] = useState('');
  const [codAction, setCodAction] = useState(null); // 'checklist' or 'pickup'
  const [codShowOverride, setCodShowOverride] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ date: new Date().toISOString().split('T')[0], method: '', reference: '' });

  useEffect(() => { 
    loadOrder(); loadLaborMinimums(); 
    // Load COD override password
    getSettings('cod_override_password').then(res => {
      if (res.data.data?.value) setCodOverridePassword(res.data.data.value);
    }).catch(() => {});
    // Auto-refresh every 30 seconds for live progress updates from shop tablets
    const interval = setInterval(() => { loadOrder(); }, 30000);
    return () => clearInterval(interval);
  }, [id]);

  const loadDefaultTaxRate = async () => {
    try {
      const res = await getSettings('tax_settings');
      if (res.data?.data?.value?.defaultTaxRate) {
        const rate = parseFloat(res.data.data.value.defaultTaxRate);
        setDefaultTaxRate(rate);
        return rate;
      }
    } catch (e) { /* use default */ }
    return 9.75;
  };

  const initialLoadDone = useRef(false);
  
  const loadOrder = async (opts = {}) => {
    // Save scroll position before reload
    const scrollY = window.scrollY;
    const isReload = initialLoadDone.current;
    
    try {
      // Only show loading spinner on first load, not on reloads
      if (!isReload) setLoading(true);
      
      // Load admin default tax rate first
      const adminTaxRate = await loadDefaultTaxRate();
      const response = await getWorkOrderById(id);
      const data = response.data.data;
      setOrder(data);

      // Determine correct tax rate: WO stored > client-specific > admin default
      let effectiveTaxRate = adminTaxRate;
      let loadedClient = null;
      if (data.clientId) {
        try {
          const clientRes = await searchClients(data.clientName || '');
          const clients = clientRes.data?.data || [];
          loadedClient = clients.find(c => c.id === data.clientId);
          if (loadedClient?.paymentTerms) {
            setClientPaymentTerms(loadedClient.paymentTerms);
          }
          // Store client object on order so contact picker can use the contacts array
          if (loadedClient) {
            setOrder(prev => prev ? { ...prev, _clientObj: loadedClient } : prev);
          }
        } catch (e) { /* ignore */ }
      }
      if (data.taxRate) {
        effectiveTaxRate = parseFloat(data.taxRate);
      } else if (loadedClient?.customTaxRate) {
        effectiveTaxRate = parseFloat(loadedClient.customTaxRate) * 100;
      }

      // Auto-determine tax exempt from client if not already saved on the WO
      let taxExempt = data.taxExempt || false;
      let taxExemptReason = data.taxExemptReason || '';
      let taxExemptCertNumber = data.taxExemptCertNumber || '';
      if (!data.taxExempt && loadedClient) {
        const clientIsExempt = loadedClient.taxStatus === 'resale' || loadedClient.taxStatus === 'exempt' ||
          (loadedClient.resaleCertificate && loadedClient.permitStatus === 'active');
        if (clientIsExempt) {
          taxExempt = true;
          taxExemptReason = (loadedClient.taxStatus === 'exempt') ? 'Tax Exempt' : 'Resale';
          taxExemptCertNumber = loadedClient.resaleCertificate || '';
        }
      }

      setEditData({
        clientId: data.clientId || null,
        clientName: data.clientName || '',
        clientPurchaseOrderNumber: data.clientPurchaseOrderNumber || '',
        jobNumber: data.jobNumber || '',
        contactName: data.contactName || '',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        contactExtension: data.contactExtension || '',
        storageLocation: data.storageLocation || '',
        notes: data.notes || '',
        receivedBy: data.receivedBy || '',
        requestedDueDate: data.requestedDueDate || '',
        promisedDate: data.promisedDate || '',
        // Pricing fields
        truckingDescription: data.truckingDescription || '',
        truckingCost: data.truckingCost || '',
        taxRate: effectiveTaxRate.toString(),
        // Tax exempt
        taxExempt: taxExempt,
        taxExemptReason: taxExemptReason,
        taxExemptCertNumber: taxExemptCertNumber,
        // Minimum charge override
        minimumOverride: data.minimumOverride || false,
        minimumOverrideReason: data.minimumOverrideReason || '',
      });

      // Load linked shipments
      try {
        const shipmentResponse = await getShipmentByWorkOrderId(data.id);
        setShipment(shipmentResponse.data.data);
        setAllShipments(shipmentResponse.data.all || [shipmentResponse.data.data]);
      } catch (shipErr) {
        setShipment(null);
        setAllShipments([]);
      }
    } catch (err) {
      setError('Failed to load work order');
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
      // Restore scroll position after React re-renders
      if (isReload) {
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      }
    }
  };

  const loadLaborMinimums = async () => {
    const defaults = [
      { partType: 'plate_roll', label: 'Plate ≤ 3/8"', sizeField: 'thickness', maxSize: 0.375, minWidth: '', maxWidth: '', minimum: 125 },
      { partType: 'plate_roll', label: 'Plate ≤ 3/8" (24-60" wide)', sizeField: 'thickness', maxSize: 0.375, minWidth: 24, maxWidth: 60, minimum: 150 },
      { partType: 'plate_roll', label: 'Plate > 3/8"', sizeField: 'thickness', minSize: 0.376, minWidth: '', maxWidth: '', minimum: 200 },
      { partType: 'angle_roll', label: 'Angle ≤ 2x2', sizeField: 'angleSize', maxSize: 2, minWidth: '', maxWidth: '', minimum: 150 },
      { partType: 'angle_roll', label: 'Angle > 2x2', sizeField: 'angleSize', minSize: 2.01, minWidth: '', maxWidth: '', minimum: 250 },
    ];
    try {
      const resp = await getSettings('labor_minimums');
      setLaborMinimums(resp?.data?.data?.value || defaults);
    } catch { setLaborMinimums(defaults); }
  };

  // Parse dimension string: "3/8"" → 0.375, "1-1/2"" → 1.5, "2.5" → 2.5, "24 ga" → 0.025, "2x2" → 2
  const parseDimension = (val) => {
    if (!val) return 0;
    const s = String(val).trim().replace(/["\u2033]/g, '');
    if (!isNaN(s) && s !== '') return parseFloat(s);
    const gaugeMatch = s.match(/^(\d+)\s*ga/i);
    if (gaugeMatch) {
      const gaugeMap = { 24: 0.025, 22: 0.030, 20: 0.036, 18: 0.048, 16: 0.060, 14: 0.075, 12: 0.105, 11: 0.120, 10: 0.135 };
      return gaugeMap[parseInt(gaugeMatch[1])] || 0;
    }
    const mixedMatch = s.match(/^(\d+)\s*[-\u2013]\s*(\d+)\s*\/\s*(\d+)/);
    if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    const fracMatch = s.match(/^(\d+)\s*\/\s*(\d+)/);
    if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    const leadMatch = s.match(/^([\d.]+)/);
    if (leadMatch) return parseFloat(leadMatch[1]);
    return 0;
  };

  const getPartSize = (part) => {
    const fd = part.formData || {};
    if (part.partType === 'plate_roll' || part.partType === 'flat_stock') return parseDimension(part.thickness);
    if (part.partType === 'angle_roll') return parseDimension(fd._angleSize || part.sectionSize || '');
    if (part.partType === 'pipe_roll') return parseDimension(part.outerDiameter);
    if (part.partType === 'tube_roll') return parseDimension(fd._tubeSize || part.sectionSize || '');
    if (part.partType === 'flat_bar') return parseDimension(fd._barSize || part.sectionSize || '');
    if (part.partType === 'channel_roll') return parseDimension(fd._channelSize || part.sectionSize || '');
    if (part.partType === 'beam_roll') return parseDimension(fd._beamSize || part.sectionSize || '');
    if (part.partType === 'tee_bar') return parseDimension(fd._teeSize || part.sectionSize || '');
    if (part.partType === 'cone_roll') return parseFloat(fd._coneLargeDia) || parseDimension(part.sectionSize || '');
    return parseDimension(part.sectionSize || part.thickness || '');
  };

  const getPartWidth = (part) => parseDimension(part.width);

  const getLaborMinimum = (part) => {
    if (!laborMinimums.length) return null;
    const partSize = getPartSize(part);
    const partWidth = getPartWidth(part);
    let bestSpecificRule = null, bestGeneralRule = null, bestFallbackRule = null;

    for (const rule of laborMinimums) {
      if (rule.partType !== part.partType) continue;
      if (!bestFallbackRule || parseFloat(rule.minimum) > parseFloat(bestFallbackRule.minimum)) bestFallbackRule = rule;

      const hasMinSize = rule.minSize !== undefined && rule.minSize !== null && rule.minSize !== '' && parseFloat(rule.minSize) > 0;
      const hasMaxSize = rule.maxSize !== undefined && rule.maxSize !== null && rule.maxSize !== '' && parseFloat(rule.maxSize) > 0;
      const hasMinWidth = rule.minWidth !== undefined && rule.minWidth !== null && rule.minWidth !== '' && parseFloat(rule.minWidth) > 0;
      const hasMaxWidth = rule.maxWidth !== undefined && rule.maxWidth !== null && rule.maxWidth !== '' && parseFloat(rule.maxWidth) > 0;
      const hasSizeConstraints = hasMinSize || hasMaxSize;
      const hasWidthConstraints = hasMinWidth || hasMaxWidth;

      if (!hasSizeConstraints && !hasWidthConstraints) {
        if (!bestGeneralRule || parseFloat(rule.minimum) > parseFloat(bestGeneralRule.minimum)) bestGeneralRule = rule;
        continue;
      }

      let sizeOk = true;
      if (hasSizeConstraints) {
        if (partSize <= 0) { sizeOk = false; }
        else {
          if (hasMinSize && partSize < parseFloat(rule.minSize)) sizeOk = false;
          if (hasMaxSize && partSize > parseFloat(rule.maxSize)) sizeOk = false;
        }
      }
      let widthOk = true;
      if (hasWidthConstraints) {
        if (partWidth <= 0) { widthOk = false; }
        else {
          if (hasMinWidth && partWidth < parseFloat(rule.minWidth)) widthOk = false;
          if (hasMaxWidth && partWidth > parseFloat(rule.maxWidth)) widthOk = false;
        }
      }
      if (sizeOk && widthOk) {
        if (!bestSpecificRule || parseFloat(rule.minimum) > parseFloat(bestSpecificRule.minimum)) bestSpecificRule = rule;
      }
    }
    return bestSpecificRule || bestGeneralRule || bestFallbackRule;
  };

  // Round up material cost after markup (matches estimate logic)
  const roundUpMaterial = (value, rounding) => {
    if (!rounding || rounding === 'none' || value <= 0) return value;
    if (rounding === 'dollar') return Math.ceil(value);
    if (rounding === 'five') return Math.ceil(value / 5) * 5;
    return value;
  };

  const getMinimumInfo = () => {
    let totalLabor = 0, totalMaterial = 0, highestMinimum = 0, highestMinRule = null;
    const EA_PRICED = ['plate_roll', 'shaped_plate', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'];
    const parts = order?.parts || [];

    parts.forEach(part => {
      if (!EA_PRICED.includes(part.partType)) return;
      const laborEach = parseFloat(part.laborTotal) || 0;
      const materialCost = parseFloat(part.materialTotal) || 0;
      const materialMarkup = parseFloat(part.materialMarkupPercent) || (part.formData?.materialMarkupPercent ? parseFloat(part.formData.materialMarkupPercent) : 0);
      const materialEach = roundUpMaterial(materialCost * (1 + materialMarkup / 100), part.formData?._materialRounding);
      const qty = parseInt(part.quantity) || 1;
      totalLabor += laborEach * qty;
      totalMaterial += materialEach * qty;

      const rule = getLaborMinimum(part);
      if (rule && parseFloat(rule.minimum) > highestMinimum) {
        highestMinimum = parseFloat(rule.minimum);
        highestMinRule = rule;
      }
    });

    const minimumApplies = !editData.minimumOverride && highestMinimum > 0 && totalLabor > 0 && totalLabor < highestMinimum;
    const adjustedLabor = minimumApplies ? highestMinimum : totalLabor;
    const laborDifference = minimumApplies ? (highestMinimum - totalLabor) : 0;
    return { totalLabor, totalMaterial, highestMinimum, highestMinRule, minimumApplies, adjustedLabor, laborDifference };
  };

  const handleSaveOrder = async () => {
    try {
      setSaving(true);
      setError(null);
      console.log('Saving editData:', editData);
      const response = await updateWorkOrder(id, editData);
      console.log('Save response:', response);
      await loadOrder();
      setIsEditing(false);
      showMessage('Work order updated');
    } catch (err) {
      console.error('Save error:', err);
      console.error('Response data:', err.response?.data);
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
      setError('Failed to save changes: ' + errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (overrideCode) => {
    if (!overrideCode && !window.confirm('Delete this work order?')) return;
    try {
      await deleteWorkOrder(id, overrideCode);
      navigate('/inventory');
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to delete work order';
      if (msg.includes('voided instead')) {
        setShowDeleteModal(true);
      } else if (err?.response?.status === 403 || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('invalid')) {
        setError('Incorrect override passcode — access denied');
      } else {
        setError(msg);
      }
    }
  };

  const handleDeleteOverride = async () => {
    const code = window.prompt('Enter override passcode:');
    if (!code) return;
    setShowDeleteModal(false);
    await handleDelete(code);
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateWorkOrder(id, { status: newStatus });
      await loadOrder();
      showMessage(`Status: ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const showMessage = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Document upload for order
  const handleDocumentUpload = async (files) => {
    try {
      setUploadingDocs(true);
      await uploadWorkOrderDocuments(id, files);
      await loadOrder();
      showMessage('Documents uploaded');
    } catch (err) {
      setError('Failed to upload documents');
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleViewDocument = async (documentId) => {
    try {
      const response = await downloadWorkOrderDocument(id, documentId);
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json') || contentType.includes('text/html')) {
        setError('Failed to retrieve document — try re-uploading');
        return;
      }
      const blob = new Blob([response.data], { type: contentType || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setError('Failed to open document');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteWorkOrderDocument(id, documentId);
      await loadOrder();
      showMessage('Document deleted');
    } catch (err) {
      setError('Failed to delete document');
    }
  };

  // MTR upload
  const handleMtrUpload = async (files) => {
    try {
      setUploadingMtrs(true);
      await uploadWorkOrderDocuments(id, files, 'mtr');
      await loadOrder();
      showMessage('MTR(s) uploaded');
    } catch (err) {
      setError('Failed to upload MTR');
    } finally {
      setUploadingMtrs(false);
    }
  };

  // Link Shipment functions
  const openLinkShipmentModal = async () => {
    setShowLinkShipmentModal(true);
    setShipmentSearchQuery('');
    try {
      const res = await getUnlinkedShipments();
      setUnlinkedShipments(res.data.data || []);
    } catch (err) {
      console.error('Failed to load unlinked shipments:', err);
      setUnlinkedShipments([]);
    }
  };

  const handleLinkShipment = async (shipmentId) => {
    try {
      setShipmentLinking(true);
      await linkShipmentToWorkOrder(shipmentId, id);
      setShowLinkShipmentModal(false);
      showMessage('Shipment linked successfully');
      await loadOrder();
    } catch (err) {
      setError('Failed to link shipment: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setShipmentLinking(false);
    }
  };

  const handleUnlinkShipment = async () => {
    if (!shipment?.id) return;
    if (!window.confirm('Unlink this shipment from the work order? The shipment will go back to the unlinked queue.')) return;
    try {
      await unlinkShipmentFromWorkOrder(shipment.id);
      setShipment(null);
      setShowReceivingInfo(false);
      showMessage('Shipment unlinked');
      await loadOrder();
    } catch (err) {
      setError('Failed to unlink shipment: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleDRChange = async () => {
    const newDR = parseInt(drInput);
    if (!newDR || newDR < 1) { setError('Please enter a valid DR number'); return; }
    if (newDR === order.drNumber) { setEditingDR(false); return; }
    try {
      await updateDRNumber(id, newDR);
      setEditingDR(false);
      showMessage(`DR number changed to DR-${newDR}`);
      await loadOrder();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      setError(msg);
    }
  };

  const filteredUnlinkedShipments = unlinkedShipments.filter(s => {
    if (!shipmentSearchQuery) return true;
    const q = shipmentSearchQuery.toLowerCase();
    return (s.clientName || '').toLowerCase().includes(q) ||
           (s.jobNumber || '').toLowerCase().includes(q) ||
           (s.qrCode || '').toLowerCase().includes(q) ||
           (s.description || '').toLowerCase().includes(q);
  });

  // Reorder — duplicate WO to new estimate with cleared material pricing
  const handleReorder = async () => {
    if (!window.confirm(`Create a reorder estimate from this work order?\n\nA new estimate will be created with all part specs and pricing copied from the original estimate${order.estimateNumber ? ` (${order.estimateNumber})` : ''}. You can then update pricing and send to the client.\n\nThe original work order and estimate will not be modified.`)) return;
    try {
      setReordering(true);
      const res = await duplicateWorkOrderToEstimate(id);
      const est = res.data.data;
      showMessage(res.data.message || 'Estimate created');
      // Navigate to the new estimate
      navigate(`/estimates/${est.id}`);
    } catch (err) {
      setError('Failed to create reorder estimate: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setReordering(false);
    }
  };

  // Part functions
  const openAddPartModal = () => {
    setEditingPart(null);
    setShowPartTypePicker(true);
  };

  const handleSelectPartType = (type) => {
    setShowPartTypePicker(false);
    setSelectedPartType(type);
    setPartFormError(null);
    setPartData({
      partType: type, clientPartNumber: '', heatNumber: '', cutFileReference: '', quantity: 1,
      material: '', thickness: '', width: '', length: '',
      outerDiameter: '', wallThickness: '', rollType: '', radius: '', diameter: '',
      arcDegrees: '', sectionSize: '', flangeOut: false, specialInstructions: '',
      laborRate: '', laborHours: '', laborTotal: '', materialUnitCost: '', materialTotal: '',
      setupCharge: '', otherCharges: '', partTotal: '',
      materialSource: 'customer_supplied', vendorId: null, supplierName: '', materialDescription: '',
      weSupplyMaterial: false, materialMarkupPercent: 20, rollingCost: '',
      _rollToMethod: '', _rollValue: '', _rollMeasurePoint: 'inside', _rollMeasureType: 'diameter', _tangentLength: '',
      _materialOrigin: '', _rollingDescription: '', _materialDescription: '',
      _angleSize: '', _customAngleSize: '', _legOrientation: '',
      _lengthOption: '', _customLength: '',
      serviceDrilling: false, serviceDrillingCost: '', serviceDrillingVendor: '',
      serviceCutting: false, serviceCuttingCost: '', serviceCuttingVendor: '',
      serviceFitting: false, serviceFittingCost: '', serviceFittingVendor: '',
      serviceWelding: false, serviceWeldingCost: '', serviceWeldingVendor: '', serviceWeldingPercent: 100,
      otherServicesCost: '', otherServicesMarkupPercent: 15
    });
    setVendorSuggestions([]);
    setShowVendorSuggestions(false);
    setShowPartModal(true);
  };

  const openEditPartModal = (part) => {
    setEditingPart(part);
    setSelectedPartType(part.partType);
    setPartFormError(null);
    setVendorSuggestions([]);
    setShowVendorSuggestions(false);
    // Merge formData back into partData for editing
    const editData = { ...part, quantity: part.quantity || 1, _vendorSearch: undefined };
    if (part.formData && typeof part.formData === 'object') {
      Object.assign(editData, part.formData);
      delete editData._vendorSearch; // never restore search state from DB
    }
    // Normalize null/undefined materialMarkupPercent so form saves the correct default
    if (editData.materialMarkupPercent === null || editData.materialMarkupPercent === undefined) {
      editData.materialMarkupPercent = 20;
    }
    setPartData(editData);
    setShowPartModal(true);
  };

  const validatePart = () => {
    const warnings = [];
    if (!selectedPartType) { warnings.push('Part type is required'); return warnings; }
    
    if (selectedPartType === 'plate_roll') {
      if (!partData.thickness) warnings.push('Thickness is required');
      if (!partData.rollType) warnings.push('Roll Direction (Easy Way / Hard Way) is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
    }
    if (selectedPartType === 'shaped_plate') {
      if (!partData.thickness) warnings.push('Thickness is required');
      const shape = partData._shapeType || 'round';
      if ((shape === 'round' || shape === 'donut') && !partData.outerDiameter) warnings.push('Outer Diameter (OD) is required');
      if (shape === 'donut' && !partData._innerDiameter) warnings.push('Inner Diameter (ID) is required');
      if (shape === 'donut' && partData._innerDiameter && partData.outerDiameter && parseFloat(partData._innerDiameter) >= parseFloat(partData.outerDiameter)) {
        warnings.push('Inner Diameter must be smaller than Outer Diameter');
      }
      if (shape === 'custom' && !partData._customDescription) warnings.push('Shape description is required');
    }
    if (selectedPartType === 'flat_stock') {
      if (!partData.thickness) warnings.push('Thickness is required');
    }
    if (selectedPartType === 'angle_roll') {
      if (!partData._angleSize) warnings.push('Angle size is required');
      if (partData._angleSize === 'Custom' && !partData._customAngleSize) warnings.push('Custom angle size is required');
      if (!partData.thickness) warnings.push('Thickness is required');
      if (!partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
      if (partData._angleSize && partData._angleSize !== 'Custom') {
        const parts = partData._angleSize.split('x').map(Number);
        if (parts.length === 2 && parts[0] !== parts[1] && partData.rollType && !partData._legOrientation) {
          warnings.push('Leg orientation is required for unequal angle sizes');
        }
      }
    }
    if (selectedPartType === 'pipe_roll') {
      if (!partData._pipeSize && !partData.outerDiameter) warnings.push('Pipe/tube size or OD is required');
      if (partData._pipeSize === 'Custom' && !partData.outerDiameter) warnings.push('Outer diameter is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
    }
    if (selectedPartType === 'tube_roll') {
      if (!partData._tubeSize) warnings.push('Tube size is required');
      if (partData._tubeSize === 'Custom' && !partData._customTubeSize) warnings.push('Custom tube size is required');
      if (!partData.thickness) warnings.push('Wall thickness is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
      const tubeParts = (partData._tubeSize || '').split('x').map(Number);
      if (tubeParts.length === 2 && tubeParts[0] !== tubeParts[1] && !partData.rollType) {
        warnings.push('Roll Direction (Easy Way / Hard Way) is required');
      }
    }
    if (selectedPartType === 'flat_bar') {
      if (!partData._barSize) warnings.push('Bar size is required');
      if (partData._barSize === 'Custom' && !partData._customBarSize) warnings.push('Custom bar size is required');
      if (partData._barShape !== 'square' && !partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
    }
    if (selectedPartType === 'channel_roll') {
      if (!partData._channelSize) warnings.push('Channel size is required');
      if (partData._channelSize === 'Custom' && !partData._customChannelSize) warnings.push('Custom channel size is required');
      if (!partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
    }
    if (selectedPartType === 'beam_roll') {
      if (!partData._beamSize) warnings.push('Beam size is required');
      if (partData._beamSize === 'Custom' && !partData._customBeamSize) warnings.push('Custom beam size is required');
      if (partData._isCamber) {
        if (!partData._camberDepth) warnings.push('Camber depth is required');
      } else {
        if (!partData.rollType) warnings.push('Roll Direction is required');
        if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
      }
    }
    if (selectedPartType === 'tee_bar') {
      if (!partData._teeSize) warnings.push('Tee size is required');
      if (partData._teeSize === 'Custom' && !partData._customTeeSize) warnings.push('Custom tee size is required');
      if (!partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
    }
    if (selectedPartType === 'press_brake') {
      if (!partData.thickness) warnings.push('Thickness is required');
    }
    if (selectedPartType === 'cone_roll') {
      if (!partData.thickness) warnings.push('Thickness is required');
      if (!partData._coneLargeDia) warnings.push('Large diameter is required');
      if (!partData._coneSmallDia) warnings.push('Small diameter is required');
      if (!partData._coneHeight) warnings.push('Cone height is required');
      if (parseFloat(partData._coneLargeDia) <= parseFloat(partData._coneSmallDia)) warnings.push('Large diameter must be greater than small diameter');
    }
    if (selectedPartType === 'rush_service') {
      if (!partData._expediteEnabled && !partData._emergencyEnabled) warnings.push('Select at least Expedite or Emergency Service');
      if (partData._expediteEnabled && partData._expediteType === 'custom_pct' && !partData._expediteCustomPct) warnings.push('Custom percentage is required');
      if (partData._expediteEnabled && partData._expediteType === 'custom_amt' && !partData._expediteCustomAmt) warnings.push('Custom amount is required');
    }
    if (selectedPartType === 'fab_service') {
      if (!partData._serviceType) warnings.push('Service type is required');
      if (!partData._linkedPartId) warnings.push('A linked part must be selected');
    }
    if (selectedPartType === 'shop_rate') {
      if (!partData._shopDescription) warnings.push('Job description is required');
      if (!partData._shopHours || parseFloat(partData._shopHours) <= 0) warnings.push('Estimated hours is required');
    }
    if (!partData.quantity || parseInt(partData.quantity) < 1) warnings.push('Quantity must be at least 1');
    return warnings;
  };

  const handleSavePart = async (addAnother = false) => {
    const warnings = validatePart();
    if (warnings.length > 0) { setPartFormError(warnings); return; }
    try {
      setSaving(true);
      setPartFormError(null);
      setError(null);
      
      // Build data matching estimate save flow
      const dataToSend = { partType: selectedPartType, ...partData, quantity: parseInt(partData.quantity) || 1 };
      // Remove UI-only fields that shouldn't be saved to database
      delete dataToSend._vendorSearch;
      // Capture shape file before cleaning
      const pendingShapeFile = dataToSend._shapeFile;
      delete dataToSend._shapeFile; // File objects can't be serialized
      
      // Sanitize ENUM fields - empty strings break Postgres ENUMs
      if (!dataToSend.rollType) dataToSend.rollType = null;
      if (!dataToSend.materialSource || !['we_order', 'customer_supplied', 'in_stock'].includes(dataToSend.materialSource)) {
        dataToSend.materialSource = 'customer_supplied';
      }
      // Clean heatBreakdown — convert qty strings to ints, remove empty rows
      if (dataToSend.heatBreakdown) {
        const cleaned = dataToSend.heatBreakdown
          .filter(r => r.heat && r.heat.trim())
          .map(r => ({ heat: r.heat.trim(), qty: parseInt(r.qty) || 0 }));
        dataToSend.heatBreakdown = cleaned.length > 0 ? cleaned : null;
      }
      
      // Recalculate partTotal at save time for ea-priced parts
      const EA_PRICED = ['plate_roll', 'shaped_plate', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'];
      // Clean price fields to exact 2-decimal values
      if (dataToSend.laborTotal) dataToSend.laborTotal = (Math.round(parseFloat(dataToSend.laborTotal) * 100) / 100).toFixed(2);
      if (dataToSend.materialTotal) dataToSend.materialTotal = (Math.round(parseFloat(dataToSend.materialTotal) * 100) / 100).toFixed(2);
      if (EA_PRICED.includes(selectedPartType)) {
        const qty = parseInt(dataToSend.quantity) || 1;
        const matCost = parseFloat(dataToSend.materialTotal) || 0;
        const matMarkupRaw = parseFloat(dataToSend.materialMarkupPercent);
        const matMarkup = isNaN(matMarkupRaw) ? 20 : matMarkupRaw;
        const matEach = roundUpMaterial(Math.round(matCost * (1 + matMarkup / 100) * 100) / 100, dataToSend._materialRounding);
        let baseLabEach = parseFloat(dataToSend._baseLaborTotal);
        if (isNaN(baseLabEach)) baseLabEach = parseFloat(dataToSend.laborTotal) || 0;
        const ops = dataToSend.outsideProcessing || [];
        const opEnabled = ops.length > 0;
        let opCostLot = 0, opProfitLot = 0;
        ops.forEach(op => {
          const cost = parseFloat(op.costPerPart) || 0;
          const expedite = parseFloat(op.expediteCost) || 0;
          const markup = parseFloat(op.markup) || 0;
          opCostLot += (cost + expedite) * qty;
          opProfitLot += cost * (markup / 100) * qty;
        });
        const opCostPerPart = qty > 0 ? opCostLot / qty : 0;
        const opProfitPerPart = qty > 0 ? opProfitLot / qty : 0;
        dataToSend._baseLaborTotal = baseLabEach.toFixed(2);
        // When OP is enabled, rolling labor is disabled (vendor does the work)
        const effectiveBase = opEnabled ? 0 : baseLabEach;
        dataToSend.laborTotal = (effectiveBase + opProfitPerPart).toFixed(2);
        const labEachWithOp = effectiveBase + opProfitPerPart;
        dataToSend.partTotal = (Math.round((matEach + labEachWithOp + opCostPerPart) * qty * 100) / 100).toFixed(2);
      }
      
      let savedPartId = editingPart?.id;
      if (editingPart) {
        await updateWorkOrderPart(id, editingPart.id, dataToSend);
      } else {
        const result = await addWorkOrderPart(id, dataToSend);
        savedPartId = result.data?.data?.id || result.data?.id;
      }
      
      // Auto-upload pending shape file (from any part form with drawing upload)
      if (pendingShapeFile && savedPartId) {
        try {
          await uploadPartFiles(id, savedPartId, [pendingShapeFile]);
        } catch (fileErr) {
          console.error('Auto-upload file failed:', fileErr);
        }
      }
      
      // Rush service: set promise date to today
      if (selectedPartType === 'rush_service' && (partData._expediteEnabled || partData._emergencyEnabled)) {
        try {
          const today = new Date().toISOString().split('T')[0];
          await updateWorkOrder(id, { promisedDate: today });
        } catch (e) { console.warn('Failed to set promise date:', e); }
      }
      await loadOrder();
      
      if (addAnother && !editingPart) {
        setShowPartModal(false);
        setEditingPart(null);
        setPartData({});
        setPartFormError(null);
        setVendorSuggestions([]);
        setShowVendorSuggestions(false);
        showMessage('Part added — select next part type');
        setShowPartTypePicker(true);
      } else {
        setShowPartModal(false);
        setEditingPart(null);
        setPartData({});
        setPartFormError(null);
        setVendorSuggestions([]);
        setShowVendorSuggestions(false);
        showMessage(editingPart ? 'Part updated' : 'Part added');
      }
    } catch (err) {
      console.error('Save part error:', err.response?.data || err);
      setPartFormError([err.response?.data?.error?.message || 'Failed to save part']);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePart = async (partId) => {
    if (!window.confirm('Delete this part?')) return;
    try {
      await deleteWorkOrderPart(id, partId);
      await loadOrder();
      showMessage('Part deleted');
    } catch (err) {
      setError('Failed to delete part');
    }
  };

  const handleDuplicatePart = (part) => {
    const fd = part.formData && typeof part.formData === 'object' ? part.formData : {};
    const newData = {
      ...part, ...fd,
      partType: part.partType,
      quantity: part.quantity || 1,
      clientPartNumber: part.clientPartNumber || '',
      heatNumber: '',
      cutFileReference: part.cutFileReference || '',
    };
    delete newData.id;
    delete newData.createdAt;
    delete newData.updatedAt;
    delete newData.workOrderId;
    delete newData.files;
    delete newData.formData;
    delete newData.status;
    delete newData.completedBy;
    delete newData.completedAt;
    setEditingPart(null);
    setSelectedPartType(part.partType);
    setPartData(newData);
    setShowPartModal(true);
    showMessage('Part duplicated — edit and save');
  };

  const handlePartStatusChange = async (partId, status) => {
    try {
      await updateWorkOrderPart(id, partId, { status });
      await loadOrder();
    } catch (err) {
      setError('Failed to update part status');
    }
  };

  const handleFileUpload = async (partId, files) => {
    try {
      setUploadingFiles(partId);
      await uploadPartFiles(id, partId, files);
      await loadOrder();
      showMessage('Files uploaded');
    } catch (err) {
      setError('Failed to upload files');
    } finally {
      setUploadingFiles(null);
    }
  };

  const handleViewFile = async (partId, fileId, fileUrl) => {
    // S3 files: open directly
    if (fileUrl && fileUrl.includes('amazonaws.com')) {
      window.open(fileUrl, '_blank');
      return;
    }
    try {
      const response = await downloadPartFile(id, partId, fileId);
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      // Fallback: open download URL with token query param
      try {
        const token = localStorage.getItem('token');
        const baseUrl = API_BASE_URL;
        const url = `${baseUrl}/workorders/${id}/parts/${partId}/files/${fileId}/download?token=${token}`;
        window.open(url, '_blank');
      } catch {
        setError('Failed to open file');
      }
    }
  };

  const handleDeleteFile = async (partId, fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await deletePartFile(id, partId, fileId);
      await loadOrder();
      showMessage('File deleted');
    } catch (err) {
      setError('Failed to delete file');
    }
  };

  const handlePickup = async () => {
    try {
      setError(null);
      setSaving(true);
      if (pickupData.type === 'full') {
        await recordPickup(id, { type: 'full', pickedUpBy: pickupData.pickedUpBy });
      } else {
        // Build items list from qty inputs
        const selectedItems = Object.entries(pickupData.items)
          .filter(([_, v]) => (parseInt(v.qty) || 0) > 0)
          .map(([partId, v]) => {
            const part = order.parts.find(p => p.id === partId);
            const fd = part?.formData && typeof part.formData === 'object' ? part.formData : {};
            return {
              partId,
              partNumber: part?.partNumber,
              partType: part?.partType,
              clientPartNumber: part?.clientPartNumber || '',
              description: fd._materialDescription || part?.materialDescription || part?.sectionSize || PART_TYPES[part?.partType]?.label || part?.partType,
              rollingDescription: fd._rollingDescription || part?.rollingDescription || '',
              quantity: parseInt(v.qty) || 0
            };
          })
          .filter(i => i.quantity > 0);
        
        if (selectedItems.length === 0) { setError('Enter quantity for at least one item'); setSaving(false); return; }
        await recordPickup(id, { type: 'partial', pickedUpBy: pickupData.pickedUpBy, items: selectedItems });
      }
      const updatedOrder = await loadOrder();
      setShowPickupModal(false);
      setPickupData({ pickedUpBy: '', type: null, items: {} });
      showMessage(pickupData.type === 'full' ? 'Full pickup recorded' : 'Partial pickup recorded & receipt saved');
      // Auto-print the pickup receipt for the entry we just created
      try {
        // The new entry is the last one in pickupHistory
        const history = order?.pickupHistory || [];
        const newIdx = history.length; // after reload it will be length-1, but we use the pre-reload length as the index
        const response = await getPickupReceipt(id, newIdx);
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (printErr) {
        console.warn('Auto-print failed — use Outbound tab to print:', printErr.message);
      }
    } catch (err) {
      console.error('Pickup error:', err.response?.data || err);
      setError(err.response?.data?.error?.message || 'Failed to record pickup');
    } finally { setSaving(false); }
  };

  // Compute remaining quantities per part based on pickup history
  const getPickupSummary = () => {
    const history = order?.pickupHistory || [];
    const parts = order?.parts || [];
    
    const pickedByPart = {};
    history.forEach(entry => {
      (entry.items || []).forEach(item => {
        const key = item.partId || `pn-${item.partNumber}`;
        pickedByPart[key] = (pickedByPart[key] || 0) + (item.quantity || 0);
      });
    });
    
    return parts.map(p => {
      const totalQty = p.quantity || 1;
      const picked = pickedByPart[p.id] || pickedByPart[`pn-${p.partNumber}`] || 0;
      const remaining = Math.max(0, totalQty - picked);
      return { ...p, totalQty, picked, remaining };
    });
  };

  // COD payment status — used in print HTML and UI
  const isCODClient = clientPaymentTerms && (clientPaymentTerms.toUpperCase().includes('COD') || clientPaymentTerms.toUpperCase().includes('C.O.D'));
  const codPaid = order?.codPaid === true;

  // Helper: build work order print HTML
  const buildWorkOrderPrintHtml = (includePricing) => {
    const clientPO = order.clientPurchaseOrderNumber || shipment?.clientPurchaseOrderNumber;
    const title = includePricing ? 'Work Order' : 'Production Order';
    const formatCurrency = (v) => '$' + (parseFloat(v) || 0).toFixed(2);
    
    const getSpecLabel = (p) => {
      const mp = p._rollMeasurePoint || 'inside';
      const isRad = !!p.radius && !p.diameter;
      if (mp === 'inside') return isRad ? 'ISR' : 'ID';
      if (mp === 'outside') return isRad ? 'OSR' : 'OD';
      return isRad ? 'CLR' : 'CLD';
    };
    const getRollDir = (p) => {
      if (!p.rollType) return '';
      if (p.partType === 'tee_bar') return p.rollType === 'easy_way' ? 'SO' : p.rollType === 'on_edge' ? 'SU' : 'SI';
      return p.rollType === 'easy_way' ? 'EW' : p.rollType === 'on_edge' ? 'OE' : 'HW';
    };

    // Collect all PDF files for printing later
    const allPdfUrls = [];

    // Collect order-level documents (non-PO: customer POs, specs, drawings, etc.)
    const orderDocUrls = [];
    const purchaseOrderUrls = [];
    if (order.documents) {
      order.documents.forEach(doc => {
        if (doc.documentType === 'purchase_order') {
          purchaseOrderUrls.push({ url: doc.url, name: doc.originalName });
        } else if (doc.documentType !== 'mtr') {
          orderDocUrls.push({ url: doc.url, name: doc.originalName });
        }
      });
    }

    const partsHtml = (() => {
      const sorted = (order.parts || []).sort((a, b) => a.partNumber - b.partNumber).filter(p => {
        if (p.partType === 'rush_service') return false;
        // Customer-facing (full/pricing) PDFs must hide internal-only parts.
        // Production-mode PDFs include them so the shop knows what's subbed.
        if (includePricing && isHiddenFromCustomer(p)) return false;
        return true;
      }).map(p => {
        const part = { ...p };
        if (part.formData && typeof part.formData === 'object') Object.assign(part, part.formData);
        return part;
      });
      const regular = sorted.filter(p => !['fab_service', 'shop_rate'].includes(p.partType) || !p._linkedPartId);
      const services = sorted.filter(p => ['fab_service', 'shop_rate'].includes(p.partType) && p._linkedPartId);
      const grouped = [];
      const used = new Set();
      regular.forEach(rp => {
        grouped.push(rp);
        services.forEach(sp => {
          if (String(sp._linkedPartId) === String(rp.id) && !used.has(sp.id)) { grouped.push(sp); used.add(sp.id); }
        });
      });
      services.forEach(sp => { if (!used.has(sp.id)) grouped.push(sp); });
      return grouped;
    })().map(part => {
      const isLinkedService = ['fab_service', 'shop_rate'].includes(part.partType) && part._linkedPartId;
      const linkedParent = isLinkedService ? order.parts.find(p => String(p.id) === String(part._linkedPartId)) : null;

      const pdfFiles = part.files?.filter(f => f.mimeType === 'application/pdf' || f.originalName?.toLowerCase().endsWith('.pdf')) || [];
      pdfFiles.forEach(f => allPdfUrls.push({ url: f.url, name: f.originalName, partNumber: part.partNumber }));

      // Build material line - prefer formData description (matches write-up format)
      const formMaterialDesc = part._materialDescription || part.materialDescription || '';
      let materialLine = '';
      if (part.partType === 'cone_roll') {
        // Always rebuild cone description from fields to avoid stale/garbled data
        const thk = part.thickness || '';
        const ldType = (part._coneLargeDiaType || 'inside') === 'inside' ? 'ID' : (part._coneLargeDiaType === 'outside' ? 'OD' : 'CLD');
        const sdType = (part._coneSmallDiaType || 'inside') === 'inside' ? 'ID' : (part._coneSmallDiaType === 'outside' ? 'OD' : 'CLD');
        const ld = parseFloat(part._coneLargeDia) || 0;
        const sd = parseFloat(part._coneSmallDia) || 0;
        const vh = parseFloat(part._coneHeight) || 0;
        const grade = part.material || '';
        const origin = part._materialOrigin || '';
        let coneLine = thk ? thk + ' ' : '';
        coneLine += 'Cone - ';
        if (ld && sd && vh) coneLine += ld.toFixed(1) + '" ' + ldType + ' x ' + sd.toFixed(1) + '" ' + sdType + ' x ' + vh.toFixed(1) + '" VH';
        if (grade) coneLine += ' ' + grade;
        if (origin) coneLine += ' ' + origin;
        materialLine = `${part.quantity}pc: ${coneLine}`;
      } else if (formMaterialDesc) {
        // Use the pre-formatted description; ensure qty is shown
        const cleaned = formMaterialDesc.replace(/^\(\d+\)\s*/, '').replace(/^\d+pc:?\s*/, '');
        materialLine = `${part.quantity}pc: ${cleaned}`;
      } else {
        // Fallback: build from raw fields
        const materialParts = [];
        if (part.sectionSize) materialParts.push(part.sectionSize);
        if (part.thickness) materialParts.push(part.thickness);
        if (part.width) materialParts.push(`x ${part.width}"`);
        if (part.length) materialParts.push(`x ${part.length}${part.length.toString().includes('"') || part.length.toString().includes("'") ? '' : '"'}`);
        if (part.outerDiameter) materialParts.push(`${part.outerDiameter}" OD`);
        if (part.wallThickness && part.wallThickness !== 'SOLID') materialParts.push(`x ${part.wallThickness} wall`);
        if (part.wallThickness === 'SOLID') materialParts.push('Solid');
        if (part.material) materialParts.push(part.material);
        const partTypeLabel = PART_TYPES[part.partType]?.label || part.partType || '';
        materialParts.push(partTypeLabel);
        materialLine = `${part.quantity}pc: ${materialParts.join(' ')}`;
      }

      // Build rolling description block from _rollingDescription (already formatted)
      // FIX: The _rollingDescription text in formData may have stale EW/HW direction.
      // Correct it using the actual rollType database field.
      let rollingDescFull = part._rollingDescription || '';
      if (rollingDescFull && part.rollType) {
        const correctDir = getRollDir(part); // Uses actual rollType from DB
        if (correctDir) {
          // Replace wrong direction abbreviations with correct one
          const allDirs = ['EW', 'HW', 'OE', 'SO', 'SI', 'SU'];
          const dirRegex = new RegExp('\\b(' + allDirs.join('|') + ')\\b', 'g');
          const matches = rollingDescFull.match(dirRegex);
          if (matches && matches.length > 0 && !matches.includes(correctDir)) {
            rollingDescFull = rollingDescFull.replace(dirRegex, correctDir);
          }
        }
      }
      let rollingBlock = '';
      const rollingLines = [];
      
      if (part._rollToMethod === 'print') {
        const printName = pdfFiles.length > 0 ? pdfFiles.map(f => f.originalName).join(', ') : '(see attached)';
        rollingLines.push(`Roll per print: ${printName}`);
      } else if (part._rollToMethod === 'template') {
        rollingLines.push('Roll Per Template / Sample');
      } else if (rollingDescFull) {
        const descLines = rollingDescFull.split(/\n|\\n/).map(l => l.trim()).filter(l => l);
        rollingLines.push(...descLines);
      } else {
        // Fallback: build roll line from raw fields
        const rollVal = part.diameter || part.radius;
        if (rollVal) {
          const spec = getSpecLabel(part);
          const dir = getRollDir(part);
          rollingLines.push(`Roll to ${rollVal}" ${spec}${dir ? ` ${dir}` : ''}${part.arcDegrees ? ` | Arc: ${part.arcDegrees}°` : ''}`);
        }
      }
      
      if (rollingLines.length > 0) {
        // Add complete rings note if applicable
        if (part._completeRings && part._ringsNeeded) {
          rollingLines.push(`${part._ringsNeeded} complete ring(s) required`);
        }
        rollingBlock = `
          <div style="background:#e8f5e9;padding:6px 10px;border-radius:4px;border-left:3px solid #2e7d32;margin-top:4px">
            <pre style="white-space:pre-wrap;margin:0;font-family:'Courier New',monospace;font-size:0.9rem;font-weight:bold;color:#1B5E20;line-height:1.4">${rollingLines.join('\n')}</pre>
          </div>
        `;
      }

      // Cone segment breakdown for print
      let coneSegmentBlock = '';

      // Orientation diagram for angle/channel rolls
      let orientationBlock = '';
      if ((part.partType === 'angle_roll' || part.partType === 'channel_roll') && part._orientationOption) {
        const imgPrefix = part.partType === 'channel_roll' ? 'Channel' : '';
        const imgFile = part.rollType === 'easy_way' ? `${imgPrefix}EWODOp${part._orientationOption}.png` : `${imgPrefix}HWIDOp${part._orientationOption}.png`;
        const label = part.rollType === 'easy_way' ? 'EW-OD' : 'HW-ID';
        orientationBlock = `
          <div style="margin-top:8px;max-width:220px;">
            <img src="/images/angle-orientation/${imgFile}" style="width:100%;border:1px solid #ddd;border-radius:4px;" />
            <div style="font-size:0.75em;color:#666;text-align:center;">${label} Option ${part._orientationOption}</div>
          </div>
        `;
      }

      if (part.partType === 'cone_roll') {
        var cTypeLabel = part._coneType === 'eccentric' ? 'Eccentric' + (part._coneEccentricAngle ? ' = ' + part._coneEccentricAngle + '°' : '') : 'Concentric';
        var rSegs = parseInt(part._coneRadialSegments) || 1;
        var segLabel = rSegs > 1 ? ' | ' + rSegs + ' @ ' + (360 / rSegs).toFixed(0) + '°' : '';
        coneSegmentBlock = `
          <div style="margin-top:6px;font-size:0.9rem;color:#4a148c;">🔺 ${cTypeLabel}${segLabel}</div>
          ${part.cutFileReference ? `<div style="margin-top:4px;font-size:0.85rem;color:#1565c0;">Layout Filename: ${part.cutFileReference}</div>` : ''}
        `;
      }

      // Checkbox for shop copy (production)
      const checkboxHtml = !includePricing ? `<div style="position:absolute;top:12px;right:12px;width:22px;height:22px;border:2px solid #999;border-radius:3px;background:#fff"></div>` : '';

      // Build specs grid (for office copy only)
      const specs = [];
      if (part.material) specs.push(['Grade', part.material]);
      if (part.sectionSize) {
        const sizeDisplay = part.partType === 'pipe_roll' && part._schedule ? part.sectionSize.replace(' Pipe', ` Sch ${part._schedule} Pipe`) : part.sectionSize;
        specs.push(['Size', sizeDisplay]);
      }
      if (part.thickness) specs.push(['Thickness', part.thickness]);
      if (part.width) specs.push(['Width', part.width + '"']);
      if (part.length) specs.push(['Length', part.length]);
      if (part.outerDiameter) specs.push(['OD', part.outerDiameter + '"']);
      if (part.wallThickness && part.wallThickness !== 'SOLID') specs.push(['Wall', part.wallThickness]);
      if (part.wallThickness === 'SOLID') specs.push(['Type', 'Solid Bar']);

      const specsHtml = includePricing && specs.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;background:#f5f5f5;padding:10px;border-radius:4px;margin-bottom:8px">
          ${specs.map(([k,v]) => `<div><span style="font-size:0.75rem;color:#888;text-transform:uppercase">${k}</span><br/><strong>${v}</strong></div>`).join('')}
        </div>
      ` : '';

      // Pricing calculations (always calculate, only display if includePricing)
      const matCost = parseFloat(part.materialTotal) || 0;
      const matMarkup = parseFloat(part.materialMarkupPercent) || 0;
      const matRounding = part.formData?._materialRounding;
      const matEachRaw = matCost * (1 + matMarkup / 100);
      const matEach = matRounding === 'dollar' ? Math.ceil(matEachRaw) : matRounding === 'five' ? Math.ceil(matEachRaw / 5) * 5 : matEachRaw;
      const labEach = parseFloat(part.laborTotal) || 0;
      const unitPrice = matEach + labEach;
      const qty = parseInt(part.quantity) || 1;
      const partTotal = unitPrice * qty;
      let pricingHtml = (part.partTotal || part.laborTotal || part.materialTotal) ? 'yes' : '';

      // Special instructions - skip if it duplicates rolling description
      const specialInstr = part.specialInstructions || '';
      const hasUniqueInstructions = specialInstr && specialInstr.trim() !== rollingDescFull.trim();

      return `
        <div class="part-row${isLinkedService ? ' service' : ''}">
          <div class="pr-item${isLinkedService ? ' svc' : ''}">${isLinkedService ? '+' : '#' + part.partNumber}</div>
          <div class="pr-desc">
            <div class="pr-type${isLinkedService ? ' svc' : ''}">${isLinkedService ? '↳ ' : ''}${PART_TYPES[part.partType]?.label || part.partType}${isLinkedService && linkedParent ? ` <span style="font-weight:400;color:#9c27b0;font-size:9px">(for Part #${linkedParent.partNumber})</span>` : ''}</div>
            <div class="pr-detail">
              ${part.clientPartNumber ? `Client Part#: ${part.clientPartNumber}<br/>` : ''}
              ${materialLine}
              ${part.heatBreakdown && part.heatBreakdown.length > 0 
                ? `<br/>Heat#: ${part.heatBreakdown.map(h => `<span style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:2px;padding:0 4px;font-weight:600;color:#795548">${h.heat}: ${h.qty}pc</span>`).join(' ')}` 
                : part.heatNumber ? `<br/>Heat#: ${part.heatNumber}` : ''}
              ${part.cutFileReference ? `<br/><span style="color:#1565c0">Cut File: ${part.cutFileReference}</span>` : ''}
            </div>
            ${rollingLines.length > 0 ? `<div class="roll-block">${rollingLines.join('<br/>')}</div>` : ''}
            ${orientationBlock}
            ${coneSegmentBlock}
            ${hasUniqueInstructions ? `<div style="margin-top:3px;font-size:10px;font-weight:600;color:#333">Note: ${specialInstr}</div>` : ''}
            ${includePricing && part.partType !== 'fab_service' ? `<div style="margin-top:2px;font-size:9px;color:#888">Material supplied by: ${part.materialSource === 'customer_supplied' ? (order.clientName || 'Customer') : 'Carolina Rolling Company'}</div>` : ''}
            ${pdfFiles.length > 0 ? `<div style="margin-top:2px;font-size:9px;color:#2e7d32">📎 ${pdfFiles.map(f => f.originalName).join(', ')}</div>` : ''}
            ${part.partType === 'press_brake' && part._pressBrakeFileName ? `<div style="margin-top:2px;font-size:9px;color:#1565c0">🗂️ Brake File: ${part._pressBrakeFileName}</div>` : ''}
            ${includePricing && pricingHtml ? `<div class="pr-pricing">${(() => {
              const matCost2 = parseFloat(part.materialTotal) || 0;
              const matMarkup2 = parseFloat(part.materialMarkupPercent) || 0;
              const matEach2Raw = matCost2 * (1 + matMarkup2 / 100);
              const matEach2 = matRounding === 'dollar' ? Math.ceil(matEach2Raw) : matRounding === 'five' ? Math.ceil(matEach2Raw / 5) * 5 : matEach2Raw;
              const labEach2 = parseFloat(part.laborTotal) || 0;
              return `${matCost2 ? `<span>Material: ${formatCurrency(matCost2)}${matMarkup2 > 0 ? ' +' + matMarkup2 + '%' : ''}</span>` : ''}${labEach2 ? `<span>Labor: ${formatCurrency(labEach2)}</span>` : ''}`;
            })()}</div>` : ''}
          </div>
          <div class="pr-qty">${parseInt(part.quantity) || 1}</div>
          ${includePricing ? `
            <div class="pr-unit">${formatCurrency(unitPrice)}</div>
            <div class="pr-amt">${formatCurrency(partTotal)}</div>
          ` : ''}
        </div>
      `;
    }).join('') || '<p style="color:#666">No parts added yet</p>';

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title} - ${order.drNumber ? 'DR-' + order.drNumber : order.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 32px 40px; max-width: 850px; margin: 0 auto; font-size: 13px; color: #333; }
    @page { size: letter; margin: 0.5in; }
    @media print { body { padding: 0; } .no-print { display: none; } }
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
    .doc-title { font-size: 20px; font-weight: 700; color: #1976d2; }
    .doc-right { text-align: right; }
    .doc-num { font-size: 13px; font-weight: 700; color: #333; }
    .doc-date { font-size: 11px; color: #888; }
    .divider { border: none; border-top: 1px solid #ccc; margin: 8px 0; }
    .info-grid { display: flex; gap: 24px; padding: 8px 0; margin-bottom: 6px; font-size: 12px; flex-wrap: wrap; }
    .info-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; font-weight: 600; }
    .info-item span { font-weight: 600; color: #333; }
    .section-title { font-size: 11px; text-transform: uppercase; color: #1976d2; font-weight: 700; letter-spacing: 0.5px; margin: 14px 0 6px; }
    .parts-header { display: flex; background: #f5f5f5; padding: 6px 0; border-bottom: 2px solid #ccc; font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; letter-spacing: 0.5px; }
    .ph-item { width: 42px; padding-left: 4px; }
    .ph-desc { flex: 1; padding-left: 8px; }
    .ph-qty { width: 40px; text-align: center; }
    .ph-unit { width: 65px; text-align: right; }
    .ph-amt { width: 70px; text-align: right; padding-right: 4px; }
    .part-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; page-break-inside: avoid; }
    .part-row.service { background: #f9f5fb; padding-left: 20px; }
    .pr-item { width: 42px; font-weight: 700; color: #1976d2; font-size: 11px; padding-left: 4px; flex-shrink: 0; }
    .pr-item.svc { color: #7b1fa2; }
    .pr-desc { flex: 1; padding-left: 8px; }
    .pr-type { font-weight: 700; font-size: 11px; color: #333; }
    .pr-type.svc { color: #7b1fa2; font-size: 10px; }
    .pr-detail { font-size: 10px; color: #666; line-height: 1.5; margin-top: 2px; }
    .pr-pricing { font-size: 10px; color: #555; margin-top: 3px; display: flex; gap: 12px; }
    .pr-pricing strong { color: #1565c0; }
    .pr-qty { width: 40px; text-align: center; font-weight: 600; font-size: 12px; flex-shrink: 0; }
    .pr-unit { width: 65px; text-align: right; font-size: 11px; flex-shrink: 0; }
    .pr-amt { width: 70px; text-align: right; font-weight: 700; font-size: 11px; padding-right: 4px; flex-shrink: 0; }
    .totals-box { margin-top: 16px; padding: 12px 16px; border: 1px solid #ccc; border-radius: 6px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
    .total-row.grand { padding: 8px 0; border-top: 2px solid #1976d2; margin-top: 4px; font-size: 16px; font-weight: 700; color: #1976d2; }
    .cc-box { margin-top: 10px; font-size: 11px; color: #666; text-align: right; }
    .notes-box { margin-top: 10px; padding: 8px; background: #f9f9f9; border-radius: 4px; font-size: 11px; border-left: 3px solid #1976d2; }
    .roll-block { background: #e8f5e9; padding: 6px 10px; border-radius: 4px; margin-top: 3px; font-size: 10px; color: #1b5e20; font-weight: 600; }
  </style>
</head>
<body>
  <div class="doc-header">
    <span class="doc-title">${includePricing ? 'WORK ORDER' : 'PRODUCTION ORDER'}</span>
    <div class="doc-right">
      <div class="doc-num">${order.drNumber ? 'DR-' + order.drNumber : order.orderNumber}</div>
      <div class="doc-date">${order.estimateNumber ? 'Est: ' + order.estimateNumber : ''}</div>
    </div>
  </div>
  <hr class="divider" />

  ${isCODClient ? `
  <div style="background:#c62828;color:white;padding:10px 16px;text-align:center;font-weight:900;font-size:16px;letter-spacing:2px;border:3px solid #b71c1c;border-radius:4px;margin-bottom:8px">
    💰 COD — COLLECT PAYMENT BEFORE RELEASING ORDER 💰
    ${codPaid ? '<div style="font-size:12px;font-weight:600;margin-top:4px;color:#a5d6a7">✅ PAYMENT RECORDED — ' + (order.paymentMethod || '').toUpperCase() + (order.paymentReference ? ' #' + order.paymentReference : '') + ' on ' + (order.paymentDate ? new Date(order.paymentDate).toLocaleDateString() : 'N/A') + '</div>' : '<div style="font-size:12px;font-weight:600;margin-top:4px;color:#ffcdd2">⚠️ PAYMENT NOT YET CONFIRMED</div>'}
  </div>
  ` : ''}

  <div class="info-grid">
    <div class="info-item"><label>Client</label><span>${order.clientName}</span></div>
    ${clientPO ? `<div class="info-item"><label>Client PO#</label><span>${clientPO}</span></div>` : ''}
    ${order.storageLocation ? `<div class="info-item"><label>Storage</label><span>${order.storageLocation}</span></div>` : ''}
    ${includePricing && order.promisedDate ? `<div class="info-item"><label>Promised</label><span>${new Date(order.promisedDate + 'T12:00:00').toLocaleDateString()}</span></div>` : ''}
    ${includePricing && order.contactName ? `<div class="info-item"><label>Contact</label><span>${order.contactName}${order.contactPhone ? ' — ' + order.contactPhone : ''}</span></div>` : ''}
    ${includePricing && clientPaymentTerms ? `<div class="info-item"><label>Payment Terms</label><span style="color:#1565c0">${clientPaymentTerms}</span></div>` : ''}
  </div>

  ${order.notes ? `<div class="notes-box"><strong>Notes:</strong> ${order.notes}</div>` : ''}

  <div class="section-title">SERVICES & MATERIALS</div>
  <div class="parts-header">
    <div class="ph-item">ITEM</div>
    <div class="ph-desc">DESCRIPTION</div>
    <div class="ph-qty">QTY</div>
    ${includePricing ? '<div class="ph-unit">UNIT</div><div class="ph-amt">AMOUNT</div>' : ''}
  </div>
  
  ${partsHtml}

  ${includePricing ? `
    <div style="margin-top:24px;padding:16px;background:#f0f7ff;border-radius:8px;border:1px solid #bbdefb">
      <h3 style="margin:0 0 12px;color:#1976d2">Order Totals</h3>
      ${(() => {
        const totals = calculateTotals();
        let minLine = '';
        if (totals.minInfo.minimumApplies) {
          minLine = `
            <div style="padding:6px 0;border-bottom:1px solid #ddd;font-size:0.85em;color:#e65100;">
              <div style="display:flex;justify-content:space-between"><span>Total Material</span><span>${formatCurrency(totals.minInfo.totalMaterial)}</span></div>
              <div style="display:flex;justify-content:space-between"><span>Total Labor <s style="color:#999">${formatCurrency(totals.minInfo.totalLabor)}</s></span><span style="font-weight:600">${formatCurrency(totals.minInfo.adjustedLabor)} (min: ${totals.minInfo.highestMinRule?.label || ''})</span></div>
            </div>
          `;
        }
        return minLine;
      })()}
      ${(() => {
        const totals = calculateTotals();
        let rushLines = '';
        if (totals.expediteAmount > 0) {
          rushLines += `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#e65100"><span>🚨 ${totals.expediteLabel}</span><strong>${formatCurrency(totals.expediteAmount)}</strong></div>`;
        }
        if (totals.emergencyAmount > 0) {
          rushLines += `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#c62828"><span>🚨 ${totals.emergencyLabel}</span><strong>${formatCurrency(totals.emergencyAmount)}</strong></div>`;
        }
        return rushLines;
      })()}
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Parts Subtotal</span><strong>${formatCurrency(calculateTotals().partsSubtotal)}</strong></div>
      ${calculateTotals().trucking > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${order.truckingDescription || 'Trucking'}</span><strong>${formatCurrency(calculateTotals().trucking)}</strong></div>` : ''}
      ${(editData.taxExempt || order.taxExempt) ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Tax</span><span style="color:#c62828;font-weight:bold">EXEMPT</span></div>` : (calculateTotals().taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Tax (${calculateTotals().taxRate}%)</span><strong>${formatCurrency(calculateTotals().taxAmount)}</strong></div>` : '')}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #1976d2;margin-top:4px;font-size:1.2rem">
        <strong>Grand Total</strong><strong style="color:#2e7d32">${formatCurrency(calculateTotals().grandTotal)}</strong>
      </div>
    </div>
  ` : ''}

  <div style="margin-top:30px;padding-top:16px;border-top:2px solid #ddd;color:#666;font-size:0.8em">
    ${title} — ${order.drNumber ? 'DR-' + order.drNumber : order.orderNumber} | Printed: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
    ${!includePricing ? '<br/><em>Production Copy</em>' : ''}
    ${allPdfUrls.length > 0 ? `
      <div style="margin-top:8px;padding:8px 10px;background:#f5f5f5;border-radius:4px;font-size:0.85rem;color:#333">
        <strong>Attached prints (included in this document):</strong>
        <ul style="margin:4px 0 0;padding-left:18px">
          ${allPdfUrls.map(f => `<li>Part #${f.partNumber}: ${f.name}</li>`).join('')}
          ${includePricing ? purchaseOrderUrls.map(f => `<li>🛒 ${f.name}</li>`).join('') : ''}
        </ul>
      </div>
    ` : ''}
  </div>
</body>
</html>`;

    return { html, hasPdfs: allPdfUrls.length > 0 || (includePricing && purchaseOrderUrls.length > 0) };
  };

  // Generate complete print package (work order details + attached PDFs merged into one)
  const generatePrintPackage = async (mode, saveToFile = false) => {
    try {
      setShowPrintMenu(false);
      const includePricing = mode === 'full';
      const { html } = buildWorkOrderPrintHtml(includePricing);
      
      // Send HTML to backend — it renders to PDF via Chrome, merges with part prints/POs
      const res = await getWorkOrderPrintPackage(id, mode, html);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      
      // Verify it's actually a PDF
      const header = await blob.slice(0, 5).text();
      if (header !== '%PDF-') {
        const text = await blob.text();
        console.warn('Print package did not return a valid PDF:', text.substring(0, 200));
        try {
          const errData = JSON.parse(text);
          setError(errData.error?.message || 'Failed to generate print package');
        } catch { setError('Failed to generate print package'); }
        return;
      }
      
      const url = URL.createObjectURL(blob);
      
      if (saveToFile) {
        const drLabel = order.drNumber ? `DR-${order.drNumber}` : order.orderNumber;
        const filename = mode === 'full' 
          ? `${drLabel}_Full_Package.pdf`
          : `${drLabel}_Production_Package.pdf`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        // Open in new tab — user can print from browser's PDF viewer
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      }
    } catch (err) {
      console.error('Print package error:', err);
      setError('Failed to generate print package. Check Heroku logs for details.');
    }
  };

  // Print Full Work Order (with pricing + part prints + docs + POs)
  const printFullWorkOrder = () => generatePrintPackage('full', false);

  // Print Production Copy (no pricing + part prints only)
  const printShopOrder = () => generatePrintPackage('production', false);

  // COD payment check — intercepts pickup actions for COD clients
  
  const handleCODCheck = (action) => {
    if (!isCODClient || codPaid) {
      // Not COD or already confirmed paid — proceed
      if (action === 'checklist') printPickupChecklist();
      else if (action === 'pickup') setShowPickupModal(true);
      return;
    }
    // COD client, not yet confirmed — show confirmation dialog
    setCodAction(action);
    setCodOverrideInput('');
    setCodShowOverride(false);
    setCodConfirmOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.method) { setError('Select a payment method'); return; }
    try {
      await recordPayment(id, { paymentDate: paymentForm.date, paymentMethod: paymentForm.method, paymentReference: paymentForm.reference });
      setPaymentDialogOpen(false);
      showMessage('Payment recorded');
      loadOrder();
      // If this was triggered from a pickup action, proceed
      if (codAction) {
        setTimeout(() => {
          if (codAction === 'checklist') printPickupChecklist();
          else if (codAction === 'pickup') setShowPickupModal(true);
          setCodAction(null);
        }, 500);
      }
    } catch (err) { setError('Failed to record payment: ' + (err.response?.data?.error?.message || err.message)); }
  };

  const handleClearPayment = async () => {
    if (!window.confirm('Clear payment record? This will require re-confirmation before pickup.')) return;
    try {
      await clearPayment(id);
      showMessage('Payment record cleared');
      loadOrder();
    } catch (err) { setError('Failed to clear payment'); }
  };

  // Print Pickup Checklist - simple form with checkboxes for loading
  const printPickupChecklist = () => {
    setShowPrintMenu(false);
    const drLabel = order.drNumber ? `DR-${order.drNumber}` : (order.orderNumber || '—');
    const clientPO = order.clientPurchaseOrderNumber || '';
    const parts = order?.parts || [];
    const SERVICE_TYPES = ['fab_service', 'shop_rate', 'rush_service'];
    const regularParts = parts.filter(p => !SERVICE_TYPES.includes(p.partType)).sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0));
    const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' });

    const getPartDesc = (p) => {
      const fd = p.formData || {};
      let desc = fd._materialDescription || p.materialDescription || '';
      if (!desc) {
        const specs = [];
        if (p.thickness) specs.push(p.thickness);
        if (p.width) specs.push(`x ${p.width}"`);
        if (p.length) specs.push(`x ${p.length}"`);
        if (p.sectionSize) specs.push(p.sectionSize);
        if (p.outerDiameter) specs.push(`${p.outerDiameter}" OD`);
        if (p.material) specs.push(p.material);
        desc = specs.join(' ') || p.partType || 'Part';
      }
      // Clean leading qty
      desc = desc.replace(/^\(\d+\)\s*/, '').replace(/^\d+pc:?\s*/, '');
      return desc;
    };

    const getPartType = (t) => {
      const map = { plate_roll: 'Plate Roll', pipe_roll: 'Pipe/Tube', tube_roll: 'Sq/Rect Tube',
        angle_roll: 'Angle Roll', channel_roll: 'Channel', beam_roll: 'Beam', flat_bar: 'Flat Bar',
        cone_roll: 'Cone', tee_bar: 'Tee Bar', press_brake: 'Press Brake', flat_stock: 'Flat Stock' };
      return map[t] || t || 'Part';
    };

    const getRolling = (p) => {
      const fd = p.formData || {};
      let desc = fd._rollingDescription || '';
      // Correct stale EW/HW direction using actual rollType
      if (desc && p.rollType) {
        const dir = (() => {
          if (!p.rollType) return '';
          if (p.partType === 'tee_bar') return p.rollType === 'easy_way' ? 'SO' : p.rollType === 'on_edge' ? 'SU' : 'SI';
          return p.rollType === 'easy_way' ? 'EW' : p.rollType === 'on_edge' ? 'OE' : 'HW';
        })();
        if (dir) {
          const allDirs = ['EW', 'HW', 'OE', 'SO', 'SI', 'SU'];
          const dirRx = new RegExp('\\b(' + allDirs.join('|') + ')\\b', 'g');
          const found = desc.match(dirRx);
          if (found && found.length > 0 && !found.includes(dir)) {
            desc = desc.replace(dirRx, dir);
          }
        }
      }
      return desc.split(/\n|\\n/).filter(l => l.trim()).slice(0, 1).join('') || '';
    };

    const printWindow = window.open('', '_blank');
    // Use pickup summary to show remaining quantities
    const pickupSummary = getPickupSummary();
    const hasPartialHistory = (order?.pickupHistory || []).length > 0;
    const remainingParts = hasPartialHistory 
      ? regularParts.map(p => {
          const summary = pickupSummary.find(s => s.id === p.id);
          return { ...p, displayQty: summary ? summary.remaining : (p.quantity || 1), totalQty: p.quantity || 1, alreadyShipped: summary ? summary.picked : 0 };
        }).filter(p => p.displayQty > 0)
      : regularParts.map(p => ({ ...p, displayQty: p.quantity || 1, totalQty: p.quantity || 1, alreadyShipped: 0 }));
    const totalPieces = remainingParts.reduce((s, p) => s + p.displayQty, 0);

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Pickup Checklist - ${drLabel}</title>
    <style>
      @font-face { font-family: 'Yellowcake'; src: url('/fonts/Yellowcake-Regular.ttf') format('truetype'); }
      @page { size: letter; margin: 0.5in; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; padding: 0.5in; }
      .header { display: flex; align-items: center; gap: 14px; padding-bottom: 20px; margin-bottom: 0; }
      .logo { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
      .company-name { font-family: 'Yellowcake', cursive; font-size: 22px; color: #333; line-height: 1.2; }
      .company-contact { font-size: 8.5px; color: #666; margin-top: 2px; }
      .divider { border: none; border-top: 1px solid #ccc; margin: 10px 0; }
      .doc-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px; }
      .doc-title { font-size: 18px; font-weight: 700; color: #1976d2; }
      .doc-info { text-align: right; }
      .dr { font-size: 24px; font-weight: 700; font-family: 'Courier New', monospace; color: #333; }
      .info-row { font-size: 10px; color: #555; margin-top: 1px; }
      .client-bar { display: flex; gap: 24px; padding: 8px 12px; background: #f5f5f5; border-radius: 4px; margin-bottom: 12px; font-size: 11px; }
      .client-bar strong { display: block; font-size: 8px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 1px; }
      .title { text-align: center; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0 12px; color: #1976d2; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1976d2; color: white; padding: 6px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
      th.check { width: 50px; text-align: center; }
      th.qty { width: 50px; text-align: center; }
      th.pn { width: 45px; text-align: center; }
      td { padding: 8px 10px; border-bottom: 1px solid #ddd; vertical-align: top; }
      td.check { text-align: center; vertical-align: middle; }
      td.qty { text-align: center; font-weight: 700; font-size: 14px; }
      td.pn { text-align: center; font-weight: 700; color: #1565c0; }
      .checkbox { width: 22px; height: 22px; border: 2px solid #333; display: inline-block; border-radius: 3px; }
      .type-tag { font-size: 9px; color: #666; background: #eee; padding: 1px 6px; border-radius: 3px; display: inline-block; margin-bottom: 2px; }
      .desc { font-weight: 600; font-size: 12px; }
      .rolling { font-size: 11px; color: #333; margin-top: 2px; }
      .special { font-size: 10px; color: #c62828; font-weight: 600; margin-top: 2px; }
      .count-summary { text-align: center; font-size: 12px; margin: 6px 0 10px; color: #666; }
      .footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 14px; }
      .sig-row { display: flex; justify-content: space-between; margin-top: 20px; gap: 30px; }
      .sig-block { flex: 1; }
      .sig-line { border-bottom: 1px solid #333; height: 28px; margin-bottom: 3px; }
      .sig-label { font-size: 9px; color: #888; }
      .notes-box { margin-top: 12px; border: 1px solid #ddd; border-radius: 4px; min-height: 50px; padding: 8px; }
      .notes-label { font-size: 9px; color: #888; margin-bottom: 3px; }
      .footer-branding { margin-top: 16px; display: flex; justify-content: space-between; font-size: 8px; color: #aaa; padding-top: 8px; border-top: 1px solid #eee; }
      @media print { body { padding: 0; } }
    </style></head><body>

    <div class="header">
      <img src="/logo.png" class="logo" onerror="this.style.display='none'" />
      <div>
        <div class="company-name">Carolina Rolling Co. Inc.</div>
        <div class="company-contact">9152 Sonrisa St., Bellflower, CA 90706 &nbsp;|&nbsp; (562) 633-1044 &nbsp;|&nbsp; keepitrolling@carolinarolling.com</div>
      </div>
    </div>
    <hr class="divider" />
    
    <div class="doc-header">
      <div class="doc-title">LOADING CHECKLIST${hasPartialHistory ? ' (Remaining)' : ''}</div>
      <div class="doc-info">
        <div class="dr">${drLabel}</div>
        <div class="info-row">${today}</div>
      </div>
    </div>

    <div class="client-bar">
      <div><strong>Client</strong>${order.clientName || '—'}</div>
      ${clientPO ? `<div><strong>PO#</strong>${clientPO}</div>` : ''}
      ${order.storageLocation ? `<div><strong>Storage</strong>${order.storageLocation}</div>` : ''}
    </div>

    <div class="count-summary">${remainingParts.length} part${remainingParts.length !== 1 ? 's' : ''} — ${totalPieces} total pieces${hasPartialHistory ? ' remaining' : ''}</div>

    <table>
      <thead>
        <tr>
          <th class="check">✓</th>
          <th class="pn">#</th>
          <th class="qty">QTY</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${remainingParts.map(p => {
          const desc = getPartDesc(p);
          const rolling = getRolling(p);
          const special = p.specialInstructions || '';
          const shippedNote = p.alreadyShipped > 0 ? `<div style="font-size:9px;color:#888;margin-top:1px;">(${p.alreadyShipped} of ${p.totalQty} previously shipped)</div>` : '';
          return `<tr>
            <td class="check"><div class="checkbox"></div></td>
            <td class="pn">${p.partNumber || ''}</td>
            <td class="qty">${p.displayQty}${shippedNote}</td>
            <td>
              <span class="type-tag">${getPartType(p.partType)}</span>
              <div class="desc">${desc}</div>
              ${rolling ? `<div class="rolling">${rolling}</div>` : ''}
              ${special ? `<div class="special">⚠ ${special}</div>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="footer">
      <div class="notes-label">Notes / Discrepancies:</div>
      <div class="notes-box"></div>
      
      <div class="sig-row">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Loaded By (Print Name)</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Picked Up By (Signature)</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Date / Time</div>
        </div>
      </div>

      <div class="footer-branding">
        <span>Carolina Rolling Co. Inc. — 9152 Sonrisa St., Bellflower, CA 90706</span>
        <span>${drLabel} — Printed ${today}</span>
      </div>
    </div>

    </body></html>`);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const printPartLabel = (part) => {
    const printWindow = window.open('', '_blank');
    const clientPO = order.clientPurchaseOrderNumber || shipment?.clientPurchaseOrderNumber;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Label</title>
      <style>@page{size:62mm 29mm;margin:0}body{font-family:Arial;width:62mm;height:29mm;padding:2mm;margin:0;box-sizing:border-box}
      .lg{font-size:14pt;font-weight:bold}.sm{font-size:9pt;color:#333}</style></head>
      <body><div class="lg">${part.clientPartNumber || `Part ${part.partNumber}`}</div>
      <div class="sm">${order.drNumber ? `DR-${order.drNumber}` : order.orderNumber}</div>
      ${clientPO ? `<div class="sm">PO: ${clientPO}</div>` : ''}
      ${part.heatBreakdown && part.heatBreakdown.length > 0 
        ? `<div class="sm">Heat: ${part.heatBreakdown.map(h => `<span style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:3px;padding:0 4px;font-weight:600;color:#795548">${h.heat}: ${h.qty}pc</span>`).join(' ')}</div>` 
        : part.heatNumber ? `<div class="sm">Heat: ${part.heatNumber}</div>` : ''}
      <div class="sm">Qty: ${part.quantity}</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    // Date-only strings like "2026-02-27" are parsed as UTC midnight, which shifts back a day in US timezones
    // Append T12:00:00 to force midday so timezone offset never flips the date
    const dateStr = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00' : d;
    return new Date(dateStr).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A';
  // === Link Estimate Handlers ===
  const handleSearchEstimates = async (query) => {
    setEstimateSearchQuery(query);
    if (query.length < 2) {
      setEstimateSearchResults([]);
      return;
    }
    try {
      setSearchingEstimates(true);
      const response = await searchLinkableEstimates(query);
      setEstimateSearchResults(response.data.data || []);
    } catch (err) {
      console.error('Search estimates error:', err);
    } finally {
      setSearchingEstimates(false);
    }
  };

  const handleLinkEstimate = async (estimateId) => {
    if (!window.confirm('Link this estimate to the work order? This will copy all parts, pricing, and client info from the estimate.')) return;
    try {
      setLinkingEstimate(true);
      const response = await linkEstimateToWorkOrder(id, estimateId);
      showMessage(response.data.message);
      setShowLinkEstimateModal(false);
      setEstimateSearchQuery('');
      setEstimateSearchResults([]);
      await loadOrder();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to link estimate');
    } finally {
      setLinkingEstimate(false);
    }
  };

  const handleUnlinkEstimate = async () => {
    if (!window.confirm('Unlink the estimate from this work order? Parts already copied will remain.')) return;
    try {
      await unlinkEstimateFromWorkOrder(id);
      showMessage('Estimate unlinked');
      await loadOrder();
    } catch (err) {
      setError('Failed to unlink estimate');
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Calculate pricing totals
  const calculateTotals = () => {
    const parts = order?.parts || [];
    const minInfo = getMinimumInfo();
    const EA_PRICED = ['plate_roll', 'shaped_plate', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'];
    
    let nonEaTotal = 0;
    let eaPricedTotal = 0;
    parts.forEach(p => {
      if (p.partType === 'rush_service') return; // handle separately
      // Fall back to formData.partTotal, then recalculate from labor+material if both are null
      let total = parseFloat(p.partTotal) || parseFloat((p.formData || {}).partTotal) || 0;
      if (!total) {
        // Recalculate from components
        const qty = parseInt(p.quantity) || 1;
        const matCost = parseFloat(p.materialTotal) || parseFloat((p.formData || {}).materialTotal) || 0;
        const matMarkup = parseFloat(p.materialMarkupPercent) ?? 20;
        const matEach = matCost * (1 + matMarkup / 100);
        const lab = parseFloat(p.laborTotal) || parseFloat((p.formData || {}).laborTotal) || 0;
        total = (matEach + lab) * qty;
      }
      if (EA_PRICED.includes(p.partType)) {
        eaPricedTotal += total;
      } else {
        nonEaTotal += total;
      }
    });
    
    // If minimum applies, replace ea-priced total with (material + adjusted labor)
    let partsSubtotal;
    if (minInfo.minimumApplies) {
      partsSubtotal = nonEaTotal + minInfo.totalMaterial + minInfo.adjustedLabor;
    } else {
      partsSubtotal = nonEaTotal + eaPricedTotal;
    }
    
    // Rush service: calculate expedite and emergency from rush_service parts
    let expediteAmount = 0;
    let emergencyAmount = 0;
    let expediteLabel = '';
    let emergencyLabel = '';
    const rushPart = parts.find(p => p.partType === 'rush_service');
    if (rushPart) {
      const fd = rushPart.formData || {};
      if (fd._expediteEnabled) {
        if (fd._expediteType === 'custom_amt') {
          expediteAmount = parseFloat(fd._expediteCustomAmt) || 0;
          expediteLabel = 'Expedite (Custom)';
        } else {
          let pct = parseFloat(fd._expediteType) || 0;
          if (fd._expediteType === 'custom_pct') pct = parseFloat(fd._expediteCustomPct) || 0;
          expediteAmount = partsSubtotal * (pct / 100);
          expediteLabel = `Expedite (${pct}%)`;
        }
      }
      if (fd._emergencyEnabled) {
        const emergOpts = { 'Saturday': 600, 'Saturday Night': 800, 'Sunday': 600, 'Sunday Night': 800 };
        emergencyAmount = emergOpts[fd._emergencyDay] || 0;
        emergencyLabel = `Emergency Off Hour Opening: ${fd._emergencyDay}`;
      }
    }
    
    const rushTotal = expediteAmount + emergencyAmount;
    partsSubtotal += rushTotal;

    const trucking = parseFloat(editData.truckingCost) || parseFloat(order?.truckingCost) || 0;
    const subtotal = partsSubtotal + trucking;
    const taxRate = parseFloat(editData.taxRate) || parseFloat(order?.taxRate) || defaultTaxRate;
    const isTaxExempt = editData.taxExempt || order?.taxExempt;
    const taxAmount = isTaxExempt ? 0 : subtotal * (taxRate / 100);
    const grandTotal = subtotal + taxAmount;
    return { partsSubtotal, trucking, subtotal, taxRate, taxAmount, grandTotal, minInfo, expediteAmount, expediteLabel, emergencyAmount, emergencyLabel };
  };
  
  // Order Material functions
  const getOrderableParts = () => {
    if (!order?.parts) return [];
    // Parts that need ordering: materialSource is 'we_order' AND not already ordered
    return order.parts.filter(p => 
      p.materialSource === 'we_order' && 
      !p.materialOrdered // false or null/undefined
    );
  };

  // Order Services functions — Fab Service / Shop Rate parts that have a vendor + cost set
  // but no PO yet on at least one of their OP entries.
  // Returns the groups object: { vendorId: { vendorId, vendorName, parts: [{part, op}], totalCost, hasHidden } }
  const getServiceOrderableGroups = () => {
    if (!order?.parts) return {};
    const groups = {};
    for (const part of order.parts) {
      if (!['fab_service', 'shop_rate'].includes(part.partType)) continue;
      const ops = part.outsideProcessing || [];
      const isHidden = isHiddenFromCustomer(part);
      for (const op of ops) {
        if (!op.vendorId) continue;
        if (op.poNumber) continue;
        const cost = parseFloat(op.costPerPart) || 0;
        if (cost <= 0) continue;
        if (!groups[op.vendorId]) {
          groups[op.vendorId] = {
            vendorId: op.vendorId,
            vendorName: op.vendorName || 'Unknown Vendor',
            parts: [],
            totalCost: 0,
            hasHidden: false
          };
        }
        const qty = parseInt(part.quantity) || 1;
        const expedite = parseFloat(op.expediteCost) || 0;
        groups[op.vendorId].parts.push({ part, op, qty, lineCost: (cost * qty) + expedite });
        groups[op.vendorId].totalCost += (cost * qty) + expedite;
        if (isHidden) groups[op.vendorId].hasHidden = true;
      }
    }
    return groups;
  };

  const hasOrderableServices = () => Object.keys(getServiceOrderableGroups()).length > 0;

  const getSupplierGroups = () => {
    const groups = {};
    order.parts?.filter(p => selectedPartIds.includes(p.id)).forEach(part => {
      const supplier = part.vendor?.name || part.supplierName || 'Unknown Supplier';
      if (!groups[supplier]) groups[supplier] = [];
      groups[supplier].push(part);
    });
    return groups;
  };

  const openOrderModal = async () => {
    // Debug: show all parts and their orderable status
    console.log('All parts:', order?.parts?.map(p => ({
      id: p.id,
      partNumber: p.partNumber,
      materialSource: p.materialSource,
      materialOrdered: p.materialOrdered,
      materialDescription: p.materialDescription,
      supplierName: p.supplierName
    })));
    
    const orderableParts = getOrderableParts();
    console.log('Orderable parts:', orderableParts);
    
    if (orderableParts.length === 0) {
      setError('No parts need material ordering. Parts need materialSource="we_order" and not already ordered.');
      return;
    }
    setSelectedPartIds(orderableParts.map(p => p.id));
    
    try {
      const poRes = await getNextPONumber();
      setOrderPONumber(poRes.data.data.nextNumber.toString());
    } catch (err) {
      setOrderPONumber('');
    }
    
    setShowOrderModal(true);
  };

  const handleOrderMaterial = async () => {
    if (!orderPONumber.trim()) { setError('PO number required'); return; }
    if (selectedPartIds.length === 0) { setError('Select at least one part'); return; }
    try {
      setOrdering(true);
      await orderWorkOrderMaterial(id, { purchaseOrderNumber: orderPONumber, partIds: selectedPartIds });
      await loadOrder();
      setShowOrderModal(false);
      setSuccess('Purchase orders created! Check Inbound & Purchase Orders pages.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) { 
      setError(err.response?.data?.error?.message || 'Failed to create orders'); 
    }
    finally { setOrdering(false); }
  };

  const StatusBadge = ({ status }) => {
    const styles = {
      quoted: { background: '#f5f5f5', color: '#666' },
      work_order_generated: { background: '#f3e5f5', color: '#7b1fa2' },
      waiting_for_materials: { background: '#fff3e0', color: '#f57c00' },
      received: { background: '#e3f2fd', color: '#1565c0' },
      processing: { background: '#e1f5fe', color: '#0288d1' },
      stored: { background: '#e8f5e9', color: '#2e7d32' },
      shipped: { background: '#f3e5f5', color: '#7b1fa2' },
      archived: { background: '#eceff1', color: '#546e7a' },
      void: { background: '#ffcdd2', color: '#b71c1c' },
      pending: { background: '#e0e0e0', color: '#555' },
      // Legacy mappings
      draft: { background: '#e3f2fd', color: '#1565c0' },
      in_progress: { background: '#e1f5fe', color: '#0288d1' },
      completed: { background: '#e8f5e9', color: '#2e7d32' },
    };
    const labels = {
      quoted: 'Quoted',
      work_order_generated: 'WO Generated',
      waiting_for_materials: 'Waiting Materials',
      received: 'Received',
      processing: 'Processing',
      stored: 'Stored',
      shipped: 'Shipped',
      archived: 'Archived',
      void: '⛔ VOID',
      pending: 'Pending',
      draft: 'Received',
      in_progress: 'Processing',
      completed: 'Stored',
    };
    return <span className="status-badge" style={styles[status] || styles.received}>{labels[status] || status?.replace('_', ' ')}</span>;
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!order) return <div className="empty-state"><div className="empty-state-title">Not found</div><button className="btn btn-primary" onClick={() => navigate('/inventory')}>Back</button></div>;

  const hasNoParts = !order.parts || order.parts.length === 0;
  const clientPO = order.clientPurchaseOrderNumber || shipment?.clientPurchaseOrderNumber;

  return (
    <div>
      {/* COD Banner — full width, above header */}
      {isCODClient && (
        <div style={{ borderRadius: '8px 8px 0 0', border: '3px solid #b71c1c', borderBottom: 'none', overflow: 'hidden', marginBottom: 0 }}>
          <div style={{ background: '#c62828', color: 'white', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.8rem' }}>💰</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: 2 }}>COD — COLLECT PAYMENT BEFORE SHIPPING</span>
            <span style={{ fontSize: '1.8rem' }}>💰</span>
          </div>
          {codPaid ? (
            <div style={{ background: '#E8F5E9', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #A5D6A7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#2E7D32', fontSize: '1rem' }}>PAYMENT CONFIRMED</div>
                  <div style={{ fontSize: '0.85rem', color: '#555' }}>
                    {order.paymentMethod && <span style={{ background: '#C8E6C9', padding: '2px 8px', borderRadius: 4, fontWeight: 600, marginRight: 8 }}>{order.paymentMethod}</span>}
                    {order.paymentReference && <span style={{ marginRight: 8 }}>Ref: <strong>{order.paymentReference}</strong></span>}
                    {order.paymentDate && <span>on {new Date(order.paymentDate).toLocaleDateString()}</span>}
                    {order.paymentRecordedBy && <span style={{ color: '#888', marginLeft: 8 }}> — by {order.paymentRecordedBy}</span>}
                  </div>
                </div>
              </div>
              <button className="btn btn-sm btn-outline" onClick={handleClearPayment} style={{ color: '#c62828', borderColor: '#c62828', fontSize: '0.75rem' }}>
                Clear Payment
              </button>
            </div>
          ) : (
            <div style={{ background: '#FFF3E0', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #FFB74D' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#E65100', fontSize: '1rem' }}>PAYMENT NOT CONFIRMED</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>Record payment before authorizing pickup</div>
                </div>
              </div>
              <button className="btn" onClick={() => { setPaymentForm({ date: new Date().toISOString().split('T')[0], method: '', reference: '' }); setPaymentDialogOpen(true); }}
                style={{ background: '#388E3C', color: 'white', border: 'none', fontWeight: 700, padding: '10px 20px', fontSize: '0.95rem' }}>
                💳 Record Payment
              </button>
            </div>
          )}
        </div>
      )}

      {/* Vendor Issues Warning Banner */}
      {(order.vendorIssues || []).filter(i => i.status !== 'resolved').length > 0 && (
        <div style={{ background: '#ffebee', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #c62828', borderBottom: '2px solid #c62828' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#c62828', fontSize: '1rem' }}>
                {(order.vendorIssues || []).filter(i => i.status !== 'resolved').length} UNRESOLVED VENDOR {(order.vendorIssues || []).filter(i => i.status !== 'resolved').length === 1 ? 'ISSUE' : 'ISSUES'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Review and resolve before proceeding</div>
            </div>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); setWoTab('vendor_issues'); setTimeout(() => document.getElementById('wo-tabs')?.scrollIntoView({ behavior: 'instant', block: 'start' }), 0); }}
            style={{ background: '#c62828', color: 'white', border: 'none', fontWeight: 700, padding: '10px 20px', fontSize: '0.95rem', borderRadius: 4, cursor: 'pointer' }}>
            ⚠ Review Issues
          </button>
        </div>
      )}

      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <div>
            {order.drNumber ? (
              <h1 className="detail-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {editingDR ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Courier New, monospace', color: '#1976d2', fontWeight: 700 }}>DR-</span>
                    <input type="number" value={drInput} onChange={(e) => setDrInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDRChange(); if (e.key === 'Escape') setEditingDR(false); }}
                      autoFocus
                      style={{ width: 90, fontFamily: 'Courier New, monospace', fontSize: '1.1rem', fontWeight: 700, padding: '4px 8px', border: '2px solid #1976d2', borderRadius: 6, textAlign: 'center' }} />
                    <button className="btn btn-sm btn-primary" onClick={handleDRChange} style={{ padding: '4px 8px' }}><Check size={16} /></button>
                    <button className="btn btn-sm btn-outline" onClick={() => setEditingDR(false)} style={{ padding: '4px 8px' }}><X size={16} /></button>
                  </span>
                ) : (
                  <span style={{ fontFamily: 'Courier New, monospace', background: '#e3f2fd', padding: '4px 12px', borderRadius: 6, color: '#1976d2', cursor: 'pointer' }}
                    onClick={() => { setDrInput(String(order.drNumber)); setEditingDR(true); }}
                    title="Click to change DR number">
                    DR-{order.drNumber} <Edit size={14} style={{ opacity: 0.5, marginLeft: 4 }} />
                  </span>
                )}
              </h1>
            ) : (
              <h1 className="detail-title">{order.orderNumber}</h1>
            )}
            <div style={{ color: '#666', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>{order.clientName}</span>
              <StatusBadge status={order.isVoided ? 'void' : hasNoParts ? 'pending' : order.status} />
              {hasNoParts && <span style={{ color: '#9c27b0', fontSize: '0.8rem' }}>(Awaiting Instructions)</span>}
            </div>
          </div>
        </div>

        {/* Void Banner */}
        {(order.isVoided || order.status === 'void') && (
          <div style={{ 
            margin: '0 0 12px', padding: '12px 20px', 
            background: 'repeating-linear-gradient(45deg, #ffcdd2, #ffcdd2 10px, #ffebee 10px, #ffebee 20px)',
            border: '3px solid #c62828', borderRadius: 8, 
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <span style={{ fontSize: '2rem' }}>⛔</span>
            <div>
              <div style={{ fontWeight: 800, color: '#b71c1c', fontSize: '1.2rem', letterSpacing: 2 }}>VOIDED</div>
              {order.voidReason && <div style={{ color: '#c62828', fontSize: '0.9rem' }}>{order.voidReason}</div>}
              {order.voidedBy && order.voidedAt && (
                <div style={{ color: '#e57373', fontSize: '0.8rem' }}>
                  by {order.voidedBy} on {new Date(order.voidedAt).toLocaleDateString()}
                </div>
              )}
              <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 4 }}>
                POs and material records are preserved for expense tracking. This order will not be invoiced.
              </div>
              <button onClick={async () => {
                if (!window.confirm('Remove void status from this work order? It will become active and eligible for invoicing again.')) return;
                try {
                  await updateWorkOrder(order.id, { isVoided: false, voidedAt: null, voidedBy: null, voidReason: null });
                  setOrder({ ...order, isVoided: false, voidedAt: null, voidedBy: null, voidReason: null });
                  showMessage('Void removed — work order is active again');
                } catch (err) { setError('Failed to unvoid'); }
              }} style={{ marginTop: 8, background: 'white', border: '1px solid #c62828', color: '#c62828', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                ↩️ Remove Void
              </button>
            </div>
          </div>
        )}

        <div className="actions-row">
          {!(order.isVoided || order.status === 'void') && order.status !== 'archived' && (
            <>
              <select className="form-select" value={order.status} onChange={(e) => handleStatusChange(e.target.value)} style={{ width: 'auto' }}>
                <option value="waiting_for_materials">Waiting for Materials</option>
                <option value="received">Received</option>
                <option value="processing">Processing</option>
                <option value="stored">Stored</option>
                <option value="shipped">Shipped</option>
              </select>
              <select className="form-select" 
                value={order.priority || 'normal'} 
                onChange={async (e) => {
                  try {
                    await updateWorkOrder(order.id, { priority: e.target.value });
                    setOrder({ ...order, priority: e.target.value });
                    showMessage(`Priority set to ${e.target.value}`);
                  } catch (err) { setError('Failed to update priority'); }
                }}
                style={{ 
                  width: 'auto',
                  fontWeight: order.priority === 'urgent' ? 700 : order.priority === 'high' ? 600 : 400,
                  color: order.priority === 'urgent' ? '#c62828' : order.priority === 'high' ? '#e65100' : '#333',
                  borderColor: order.priority === 'urgent' ? '#c62828' : order.priority === 'high' ? '#e65100' : '#ddd'
                }}>
                <option value="normal">Normal Priority</option>
                <option value="high">⚡ High Priority</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
              {(order.status === 'stored' || (order.pickupHistory?.length > 0 && getPickupSummary().some(p => p.remaining > 0))) && (
                <button className="btn btn-success" onClick={() => handleCODCheck('pickup')}>
                  <Check size={18} />{order.pickupHistory?.length > 0 ? 'Continue Shipment' : 'Ship'}
                  {isCODClient && !codPaid && <span style={{ marginLeft: 6, fontSize: '0.7rem' }}>💰</span>}
                </button>
              )}
              {['waiting_for_materials', 'received', 'processing'].includes(order.status) && !order.pickupHistory?.length && (
                <button className="btn" onClick={() => {
                  const items = {};
                  order.parts?.forEach(p => { items[p.id] = { qty: 0 }; });
                  setPickupData({ pickedUpBy: '', type: 'partial', items, _fromShipPartial: true });
                  setShowPickupModal(true);
                }}
                  style={{ background: '#e65100', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Truck size={16} /> Ship Partial
                </button>
              )}
            </>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-primary" onClick={() => setShowPrintMenu(!showPrintMenu)}><Printer size={18} />Print</button>
            {showPrintMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #ddd', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100, minWidth: 340, padding: 8 }}>
                
                <div style={{ padding: '6px 12px 4px', fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Full Work Order</div>
                <div style={{ display: 'flex', gap: 6, padding: '4px 8px 8px' }}>
                  <button onClick={printFullWorkOrder} style={{ flex: 1, padding: '14px 12px', border: '2px solid #1565C0', background: '#E3F2FD', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#1565C0' }}>
                    🖨️ Print
                  </button>
                  <button onClick={() => generatePrintPackage('full', true)} style={{ flex: 1, padding: '14px 12px', border: '2px solid #1565C0', background: 'white', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#1565C0' }}>
                    ⬇️ Download
                  </button>
                </div>
                <div style={{ padding: '2px 12px', fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Details + pricing + all documents + POs</div>
                
                <div style={{ borderTop: '2px solid #eee', margin: '6px 0' }}></div>
                
                <div style={{ padding: '6px 12px 4px', fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Production Copy</div>
                <div style={{ display: 'flex', gap: 6, padding: '4px 8px 8px' }}>
                  <button onClick={printShopOrder} style={{ flex: 1, padding: '14px 12px', border: '2px solid #E65100', background: '#FFF3E0', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#E65100' }}>
                    🖨️ Print
                  </button>
                  <button onClick={() => generatePrintPackage('production', true)} style={{ flex: 1, padding: '14px 12px', border: '2px solid #E65100', background: 'white', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#E65100' }}>
                    ⬇️ Download
                  </button>
                </div>
                <div style={{ padding: '2px 12px', fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Details (no pricing) + all documents</div>
                
                <div style={{ borderTop: '2px solid #eee', margin: '6px 0' }}></div>
                
                <div style={{ padding: '6px 12px 4px', fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Pickup / Loading</div>
                <button onClick={() => handleCODCheck('checklist')} style={{ display: 'block', width: '100%', padding: '14px 16px', border: '2px solid #388E3C', background: '#E8F5E9', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: '#388E3C', textAlign: 'center', margin: '4px 0' }}>
                  ☑️ Pickup Checklist
                  {isCODClient && !codPaid && <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#c62828', marginTop: 2 }}>⚠️ COD — Payment confirmation required</span>}
                </button>
                
                <div style={{ borderTop: '2px solid #eee', margin: '6px 0' }}></div>
                
                <div style={{ padding: '6px 12px 4px', fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>QuickBooks</div>
                <button onClick={async () => {
                  try {
                    setShowPrintMenu(false);
                    // Assign invoice number if not already assigned
                    if (!order.invoiceNumber) {
                      const assignRes = await assignInvoiceNumber(order.id);
                      order.invoiceNumber = assignRes.data.data.invoiceNumber;
                      showMessage(`Invoice #${order.invoiceNumber} assigned`);
                    }
                    const response = await exportWorkOrderIIF(order.id);
                    const iifContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                    const blob = new Blob([iifContent], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `invoice-${order.invoiceNumber || order.drNumber || order.orderNumber}-${(order.clientName || '').replace(/[^a-zA-Z0-9]/g, '_')}.iif`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    showMessage(`IIF exported — Invoice #${order.invoiceNumber}`);
                    loadOrder();
                  } catch (err) {
                    setError(err.response?.data?.error?.message || 'Failed to export IIF');
                  }
                }} style={{ display: 'block', width: '100%', padding: '14px 16px', border: '2px solid #2E7D32', background: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: '#2E7D32', textAlign: 'center', margin: '4px 0' }}>
                  📗 Export Invoice (.iif)
                </button>
                
                <div style={{ borderTop: '2px solid #eee', margin: '6px 0' }}></div>
                
                <div style={{ padding: '6px 12px 4px', fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Certificates</div>
                <button onClick={() => { setShowPrintMenu(false); setShowCocModal(true); }} style={{ display: 'block', width: '100%', padding: '14px 16px', border: '2px solid #6A1B9A', background: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: '#6A1B9A', textAlign: 'center', margin: '4px 0' }}>
                  📜 Certificate of Conformance (COC)
                </button>

                <div style={{ borderTop: '2px solid #eee', margin: '6px 0' }}></div>
                
                <div style={{ padding: '6px 12px 4px', fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Labels</div>
                <button onClick={() => {
                  setShowPrintMenu(false);
                  const SERVICE_TYPES = ['fab_service', 'shop_rate', 'rush_service'];
                  const labelParts = (order.parts || []).filter(p => !SERVICE_TYPES.includes(p.partType));
                  if (labelParts.length === 0) { showMessage('No parts to label'); return; }
                  const clientPO = order.clientPurchaseOrderNumber || '';
                  const drLabel = order.drNumber ? `DR-${order.drNumber}` : (order.orderNumber || '');
                  const totalLabels = labelParts.reduce((s, p) => s + (p.quantity || 1), 0);
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`<!DOCTYPE html><html><head><title>Labels - ${drLabel}</title>
                    <style>
                      @page { size: 62mm 29mm; margin: 0; }
                      body { margin: 0; padding: 0; }
                      .label { width: 62mm; height: 29mm; padding: 2mm; box-sizing: border-box; font-family: Arial, sans-serif; page-break-after: always; display: flex; flex-direction: column; justify-content: center; }
                      .label:last-child { page-break-after: auto; }
                      .lg { font-size: 14pt; font-weight: bold; line-height: 1.2; }
                      .sm { font-size: 9pt; color: #333; }
                    </style></head><body>`);
                  labelParts.forEach(part => {
                    const qty = part.quantity || 1;
                    const fd = part.formData && typeof part.formData === 'object' ? part.formData : {};
                    const label1 = part.clientPartNumber || fd.clientPartNumber || `Part ${part.partNumber}`;
                    for (let i = 0; i < qty; i++) {
                      printWindow.document.write(`<div class="label">
                        <div class="lg">${label1}</div>
                        <div class="sm">${drLabel}</div>
                        ${clientPO ? `<div class="sm">PO: ${clientPO}</div>` : ''}
                        ${part.heatNumber ? `<div class="sm">Heat: ${part.heatNumber}</div>` : ''}
                        <div class="sm">${i + 1} of ${qty}</div>
                      </div>`);
                    }
                  });
                  printWindow.document.write('</body></html>');
                  printWindow.document.close();
                  printWindow.onload = () => printWindow.print();
                }} style={{ display: 'block', width: '100%', padding: '14px 16px', border: '2px solid #795548', background: '#EFEBE9', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: '#795548', textAlign: 'center', margin: '4px 0' }}>
                  🏷️ Print All Labels ({(order.parts || []).filter(p => !['fab_service', 'shop_rate', 'rush_service'].includes(p.partType)).reduce((s, p) => s + (p.quantity || 1), 0)})
                </button>

                <div style={{ borderTop: '2px solid #eee', margin: '6px 0' }}></div>
                <button onClick={() => { setShowPrintMenu(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: '#f5f5f5', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: '0.9rem', textAlign: 'center', fontWeight: 600 }}>Cancel</button>
              </div>
            )}
          </div>
          <button className="btn" onClick={handleReorder} disabled={reordering}
            style={{ background: '#7b1fa2', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: reordering ? 0.6 : 1 }}
            title="Create new estimate from this order (for repeat orders)"
          >
            <Package size={16} />{reordering ? 'Creating...' : 'Reorder'}
          </button>
          <button className="btn btn-danger" onClick={() => handleDelete()}><Trash2 size={18} /></button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Toggle for Shipping Details */}
      {shipment ? (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            className={`btn ${showReceivingInfo ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowReceivingInfo(!showReceivingInfo)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Truck size={18} />
            {showReceivingInfo ? 'Hide Inbound Details' : 'Inbound Shipment Details'}
            {shipment.photos?.length > 0 && <span style={{ background: '#4caf50', color: 'white', borderRadius: 10, padding: '2px 6px', fontSize: '0.7rem' }}>{shipment.photos.length} 📷</span>}
            {(order?.pickupHistory || []).length > 0 && <span style={{ background: '#1976d2', color: 'white', borderRadius: 10, padding: '2px 6px', fontSize: '0.7rem' }}>{(order?.pickupHistory || []).length} shipment{(order?.pickupHistory || []).length > 1 ? 's' : ''}</span>}
          </button>
          <button
            className="btn btn-outline"
            onClick={handleUnlinkShipment}
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#d32f2f', color: '#d32f2f', fontSize: '0.85rem' }}
            title="Unlink this shipment from the work order"
          >
            <X size={16} /> Unlink
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <button 
            className="btn btn-outline"
            onClick={openLinkShipmentModal}
            style={{ display: 'flex', alignItems: 'center', gap: 8, borderColor: '#ff9800', color: '#e65100' }}
          >
            <Truck size={18} />
            Link Shipment
            <span style={{ fontSize: '0.75rem', color: '#888' }}>(No shipment linked)</span>
          </button>
        </div>
      )}

      {/* Shipping Details Panel */}
      {showReceivingInfo && allShipments.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #4caf50' }}>
          <div className="card-header">
            <h3 className="card-title"><Truck size={20} style={{ marginRight: 8 }} />Inbound Shipment Details</h3>
          </div>
          
          {/* Shipment tabs when multiple */}
          {allShipments.length > 1 && (
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0', marginBottom: 16 }}>
              {allShipments.map((s, idx) => (
                <button key={s.id} onClick={() => setActiveShipmentIdx(idx)}
                  style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer',
                    background: activeShipmentIdx === idx ? '#4caf50' : 'transparent',
                    color: activeShipmentIdx === idx ? 'white' : '#666',
                    fontWeight: activeShipmentIdx === idx ? 700 : 500,
                    fontSize: '0.85rem', borderRadius: '6px 6px 0 0'
                  }}>
                  Shipment {idx + 1}
                  {s.receivedAt && <span style={{ marginLeft: 6, fontSize: '0.7rem', opacity: 0.8 }}>
                    {new Date(s.receivedAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' })}
                  </span>}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const activeShipment = allShipments[activeShipmentIdx] || allShipments[0];
            if (!activeShipment) return null;
            return (
              <>
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Receiving</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <div className="detail-item-label"><Clock size={14} /> Received</div>
                      <div className="detail-item-value">{formatDateTime(activeShipment.receivedAt)}</div>
                    </div>
                    {activeShipment.receivedBy && (
                      <div className="detail-item">
                        <div className="detail-item-label"><User size={14} /> Received By</div>
                        <div className="detail-item-value">{activeShipment.receivedBy}</div>
                      </div>
                    )}
                    <div className="detail-item">
                      <div className="detail-item-label">Quantity</div>
                      <div className="detail-item-value">{activeShipment.quantity} piece{activeShipment.quantity !== 1 ? 's' : ''}</div>
                    </div>
                    {activeShipment.location && (
                      <div className="detail-item">
                        <div className="detail-item-label"><MapPin size={14} /> Storage Location</div>
                        <div className="detail-item-value">{activeShipment.location}</div>
                      </div>
                    )}
                    {activeShipmentIdx === 0 && order.pickedUpAt && (
                      <div className="detail-item">
                        <div className="detail-item-label"><Truck size={14} /> Shipped</div>
                        <div className="detail-item-value" style={{ color: '#2e7d32', fontWeight: 600 }}>{formatDateTime(order.pickedUpAt)}</div>
                      </div>
                    )}
                    {activeShipmentIdx === 0 && !order.pickedUpAt && order.pickupHistory?.length > 0 && (
                      <div className="detail-item">
                        <div className="detail-item-label"><Truck size={14} /> First Outbound</div>
                        <div className="detail-item-value" style={{ color: '#e65100', fontWeight: 600 }}>{formatDateTime(order.pickupHistory[0].date)}</div>
                      </div>
                    )}
                    {activeShipmentIdx === 0 && order.pickedUpBy && (
                      <div className="detail-item">
                        <div className="detail-item-label"><User size={14} /> Picked Up By</div>
                        <div className="detail-item-value">{order.pickedUpBy}</div>
                      </div>
                    )}
                  </div>
                </div>

                {activeShipment.description && (
                  <div style={{ marginBottom: 16, padding: 16, background: '#e3f2fd', borderRadius: 8, borderLeft: '4px solid #1976d2' }}>
                    <div style={{ fontWeight: 600, color: '#1565c0', marginBottom: 8 }}>Material Description</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{activeShipment.description}</div>
                  </div>
                )}

                {activeShipment.notes && (
                  <div style={{ marginBottom: 16, padding: 16, background: '#fff3e0', borderRadius: 8, borderLeft: '4px solid #ff9800' }}>
                    <div style={{ fontWeight: 600, color: '#e65100', marginBottom: 8 }}>Receiving Notes</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{activeShipment.notes}</div>
                  </div>
                )}

                {activeShipment.photos && activeShipment.photos.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>📷 Photos ({activeShipment.photos.length})</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                      {activeShipment.photos.map(photo => (
                        <div key={photo.id} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '2px solid #ddd' }}
                          onClick={() => window.open(photo.url, '_blank')}>
                          <img src={photo.thumbnailUrl || photo.url} alt="Shipment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Order Details Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Order Details</h3>
          {isEditing ? (
            <div className="actions-row">
              <button className="btn btn-primary btn-sm" onClick={handleSaveOrder} disabled={saving}><Save size={16} />{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}><X size={16} />Cancel</button>
            </div>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={() => setIsEditing(true)}><Edit size={16} />Edit</button>
          )}
        </div>
        {isEditing ? (
          <div className="grid grid-2">
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Client *</label>
              <input 
                className="form-input" 
                value={editData._clientSearch !== undefined ? editData._clientSearch : editData.clientName} 
                onChange={async (e) => {
                  const value = e.target.value;
                  setEditData({ ...editData, _clientSearch: value });
                  if (value.length >= 1) {
                    try {
                      const res = await searchClients(value);
                      setClientSuggestions(res.data.data || []);
                      setShowClientSuggestions(true);
                    } catch (err) { setClientSuggestions([]); }
                  } else {
                    setEditData({ ...editData, _clientSearch: value, clientId: null, clientName: '' });
                    setClientSuggestions([]);
                    setShowClientSuggestions(false);
                  }
                }}
                onFocus={async () => {
                  try {
                    const res = await searchClients('');
                    setClientSuggestions(res.data.data || []);
                    setShowClientSuggestions(true);
                  } catch (err) {}
                }}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                placeholder="Search or add client..."
                autoComplete="off"
              />
              {showClientSuggestions && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'white', border: '1px solid #ddd', borderRadius: 4,
                  maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                  {clientSuggestions.map(client => (
                    <div key={client.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                      onMouseDown={() => {
                        const updates = {
                          ...editData, clientId: client.id, clientName: client.name, _clientSearch: undefined,
                          ...(() => {
                          let contacts = (client.contacts || []).filter(c => c.name);
                          if (contacts.length === 0 && client.contactName) {
                            contacts = [{ name: client.contactName, email: client.contactEmail || '', phone: client.contactPhone || '', isPrimary: true }];
                          }
                          const primary = contacts.find(c => c.isPrimary) || contacts[0] || {};
                          return {
                            contactName: primary.name || editData.contactName,
                            contactPhone: primary.phone || editData.contactPhone,
                            contactEmail: primary.email || editData.contactEmail,
                          };
                        })()
                        };
                        // Apply client-specific tax rate if they have one
                        if (client.customTaxRate) {
                          updates.taxRate = (parseFloat(client.customTaxRate) * 100).toFixed(2);
                        } else {
                          updates.taxRate = defaultTaxRate.toString();
                        }
                        // Auto tax exempt for resale/exempt clients or verified resale certificates
                        const isExempt = client.taxStatus === 'resale' || client.taxStatus === 'exempt' || 
                          (client.resaleCertificate && client.permitStatus === 'active');
                        if (isExempt) {
                          updates.taxExempt = true;
                          updates.taxExemptReason = (client.taxStatus === 'exempt') ? 'Tax Exempt' : 'Resale';
                          updates.taxExemptCertNumber = client.resaleCertificate || '';
                        } else {
                          updates.taxExempt = false;
                          updates.taxExemptReason = '';
                          updates.taxExemptCertNumber = '';
                        }
                        setEditData(updates);
                        setClientPaymentTerms(client.paymentTerms || null);
                        setShowClientSuggestions(false);
                      }}>
                      <strong>{client.name}</strong>
                      {(() => {
                        const primary = (client.contacts || []).find(c => c.isPrimary) || (client.contacts || [])[0];
                        const name = primary?.name || client.contactName;
                        return name ? <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{name}{primary?.role ? <span style={{ color: '#1976d2', marginLeft: 4 }}>({primary.role})</span> : null}</span> : null;
                      })()}
                    </div>
                  ))}
                  {editData._clientSearch && editData._clientSearch.length >= 2 && !clientSuggestions.some(c => c.name.toLowerCase() === (editData._clientSearch || '').toLowerCase()) && (
                    <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600, borderTop: '2px solid #c8e6c9' }}
                      onMouseDown={() => {
                        setShowClientSuggestions(false);
                        navigate(`/clients-vendors?addClient=${encodeURIComponent(editData._clientSearch)}`);
                      }}>
                      + Add "{editData._clientSearch}" as new client
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="form-group"><label className="form-label">Client PO#</label><input className="form-input" value={editData.clientPurchaseOrderNumber} onChange={(e) => setEditData({ ...editData, clientPurchaseOrderNumber: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Job Number</label><input className="form-input" value={editData.jobNumber} onChange={(e) => setEditData({ ...editData, jobNumber: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Storage Location</label><input className="form-input" value={editData.storageLocation} onChange={(e) => setEditData({ ...editData, storageLocation: e.target.value })} /></div>
            {/* Contact picker — uses client contacts array if available */}
            {(() => {
              const clientObj = order?._clientObj || null;
              const contacts = clientObj ? (clientObj.contacts || []).filter(c => c.name) : [];
              if (contacts.length > 1) {
                return (
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <select className="form-select" value={editData.contactName || ''}
                      onChange={(e) => {
                        const c = contacts.find(ct => ct.name === e.target.value);
                        if (c) setEditData({ ...editData, contactName: c.name, contactEmail: c.email || '', contactPhone: c.phone || '', contactExtension: c.extension || '' });
                        else setEditData({ ...editData, contactName: e.target.value });
                      }}>
                      {contacts.map((c, i) => (
                        <option key={i} value={c.name}>{c.name}{c.isPrimary ? ' ★' : ''}{c.role ? ` · ${c.role}` : ''}{c.extension ? ` x${c.extension}` : ''}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return <>
                <div className="form-group"><label className="form-label">Contact Name</label><input className="form-input" value={editData.contactName} onChange={(e) => setEditData({ ...editData, contactName: e.target.value })} placeholder="John Smith" /></div>
                <div className="form-group"><label className="form-label">Contact Phone</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input className="form-input" style={{ flex: 1 }} value={formatPhone(editData.contactPhone || '')} onChange={(e) => setEditData({ ...editData, contactPhone: formatPhone(e.target.value) })} placeholder="(555) 123-4567" />
                    {editData.contactExtension && <span style={{ fontSize: '0.85rem', color: '#555', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, padding: '4px 8px', whiteSpace: 'nowrap' }}>x{editData.contactExtension}</span>}
                  </div>
                </div>
                <div className="form-group"><label className="form-label">Contact Email</label><input type="email" className="form-input" value={editData.contactEmail} onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })} placeholder="john@example.com" /></div>
              </>;
            })()}
            <div className="form-group"><label className="form-label">Requested Due Date</label><input type="date" className="form-input" value={editData.requestedDueDate} onChange={(e) => setEditData({ ...editData, requestedDueDate: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Promised Date</label><input type="date" className="form-input" value={editData.promisedDate} onChange={(e) => setEditData({ ...editData, promisedDate: e.target.value })} /></div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Notes</label><textarea className="form-textarea" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} /></div>
          </div>
        ) : (
          <>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-item-label"><User size={14} /> Client</div><div className="detail-item-value">{order.clientName}</div></div>
              {clientPaymentTerms && <div className="detail-item"><div className="detail-item-label">Payment Terms</div><div className="detail-item-value" style={{ fontWeight: 600 }}>{clientPaymentTerms}</div></div>}
              {clientPO && <div className="detail-item"><div className="detail-item-label"><FileText size={14} /> Client PO#</div><div className="detail-item-value" style={{ color: '#1976d2', fontWeight: 600 }}>{clientPO}</div></div>}
              {order.jobNumber && <div className="detail-item"><div className="detail-item-label">Job#</div><div className="detail-item-value">{order.jobNumber}</div></div>}
              {order.storageLocation && <div className="detail-item"><div className="detail-item-label"><MapPin size={14} /> Location</div><div className="detail-item-value">{order.storageLocation}</div></div>}
              {order.contactName && (() => {
                // Fall back to client contacts array for extension if not saved on WO yet
                const clientContact = (order._clientObj?.contacts || []).find(c => c.name === order.contactName);
                const ext = order.contactExtension || clientContact?.extension || '';
                return <>
                  <div className="detail-item"><div className="detail-item-label">Contact Name</div><div className="detail-item-value">{order.contactName}</div></div>
                  {order.contactPhone && <div className="detail-item"><div className="detail-item-label">Contact Phone</div><div className="detail-item-value">{formatPhone(order.contactPhone)}{ext ? <span style={{ color: '#888', marginLeft: 4 }}>x{ext}</span> : null}</div></div>}
                </>;
              })()}
              {!order.contactName && order.contactPhone && <div className="detail-item"><div className="detail-item-label">Contact Phone</div><div className="detail-item-value">{formatPhone(order.contactPhone)}</div></div>}
              {order.contactEmail && <div className="detail-item"><div className="detail-item-label">Contact Email</div><div className="detail-item-value">{order.contactEmail}</div></div>}
              {order.promisedDate && <div className="detail-item"><div className="detail-item-label"><Calendar size={14} /> Promised</div><div className="detail-item-value">{formatDate(order.promisedDate)}</div></div>}
              <div className="detail-item"><div className="detail-item-label"><Clock size={14} /> Created</div><div className="detail-item-value">{formatDate(order.createdAt)}</div></div>
            </div>
            {order.notes && <div style={{ marginTop: 16, padding: 12, background: '#f9f9f9', borderRadius: 8 }}><strong>Notes:</strong> {order.notes}</div>}
            {/* Collapsible accounting contact — for billing reference */}
            {order._clientObj && (order._clientObj.accountingContactName || order._clientObj.accountingContactEmail) && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eee' }}>
                <button onClick={() => setShowAccountingContact(a => !a)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#666', display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontWeight: 600 }}>
                  🧾 Accounting Contact {showAccountingContact ? '▲' : '▼'}
                </button>
                {showAccountingContact && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#f9f9f9', borderRadius: 6, fontSize: '0.85rem', border: '1px solid #e0e0e0' }}>
                    {order._clientObj.accountingContactName && <div style={{ fontWeight: 600 }}>{order._clientObj.accountingContactName}</div>}
                    {order._clientObj.accountingContactEmail && <div style={{ color: '#1565c0', marginTop: 2 }}>📧 {order._clientObj.accountingContactEmail}</div>}
                    {order._clientObj.accountingContactPhone && <div style={{ color: '#555', marginTop: 2 }}>📞 {formatPhone(order._clientObj.accountingContactPhone)}</div>}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Purchase Orders Section */}
        {order.documents?.filter(d => d.documentType === 'purchase_order' || d.documentType === 'outside_processing_po').length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#e65100' }}>
              <ShoppingCart size={18} /> Purchase Orders
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {order.documents.filter(d => d.documentType === 'purchase_order' || d.documentType === 'outside_processing_po').map(doc => {
                const isServicePO = doc.documentType === 'outside_processing_po';
                const bg = isServicePO ? '#E0F2F1' : '#fff3e0';
                const border = isServicePO ? '1px solid #80CBC4' : '1px solid #ffcc80';
                const iconColor = isServicePO ? '#00695C' : '#e65100';
                // Look up the service PO's vendor info for the mailto link
                let servicePOVendorEmail = null;
                let servicePOVendorName = null;
                let servicePOPONumber = null;
                if (isServicePO) {
                  const poMatch = (doc.originalName || '').match(/^(PO\d+)/);
                  servicePOPONumber = poMatch ? poMatch[1] : null;
                  if (servicePOPONumber) {
                    // Find the vendor from any part's outsideProcessing op with this PO stamp
                    for (const part of (order.parts || [])) {
                      const ops = part.outsideProcessing || [];
                      const matchOp = ops.find(op => op.poNumber === servicePOPONumber);
                      if (matchOp) {
                        servicePOVendorName = matchOp.vendorName || null;
                        // vendorEmail not stored on the op — look up the vendor record
                        // The frontend doesn't have vendors loaded here, so we'll rely on a mailto: with blank to:
                        break;
                      }
                    }
                  }
                }
                return (
                <div key={doc.id} style={{ 
                  display: 'flex', alignItems: 'center', gap: 8, 
                  background: bg, padding: '10px 14px', borderRadius: 8, 
                  fontSize: '0.9rem', border: border
                }}>
                  {isServicePO ? <span style={{ fontSize: '1.1rem' }}>🏭</span> : <File size={18} color={iconColor} />}
                  <span style={{ fontWeight: 500 }}>{doc.originalName}</span>
                  {isServicePO && <span style={{ fontSize: '0.7rem', background: '#00897B', color: 'white', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>SERVICE</span>}
                  <button 
                    onClick={() => handleViewDocument(doc.id)} 
                    className="btn btn-sm"
                    style={{ background: '#1976d2', color: 'white', padding: '4px 10px', marginLeft: 8 }}
                    title="View"
                  >
                    <Eye size={14} />
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const response = await getWorkOrderDocumentSignedUrl(id, doc.id);
                        const link = document.createElement('a');
                        link.href = response.data.data.url;
                        link.download = doc.originalName;
                        link.click();
                      } catch (err) {
                        setError('Failed to download');
                      }
                    }} 
                    className="btn btn-sm"
                    style={{ background: iconColor, color: 'white', padding: '4px 10px' }}
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        if (isServicePO) {
                          await regenServicePO(id, doc.id);
                          showMessage('Service PO PDF regenerated');
                        } else {
                          await regeneratePODocument(id, doc.id);
                          showMessage('PO PDF regenerated');
                        }
                        await loadOrder();
                      } catch (err) {
                        setError('Failed to regenerate PO PDF: ' + (err.response?.data?.error?.message || err.message));
                      }
                    }} 
                    style={{ background: 'none', border: '1px solid #1976d2', borderRadius: 4, cursor: 'pointer', padding: '4px 8px', color: '#1976d2' }}
                    title="Regenerate PDF"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button 
                    onClick={async () => {
                      if (isServicePO) {
                        const confirmMsg = `Delete ${servicePOPONumber || 'this service PO'}?\n\nThis will:\n• Delete the PDF\n• Remove the PO number from the tracker\n• Delete the pending inbound order\n• Clear the PO stamp from the affected parts (they'll become orderable again)\n\nContinue?`;
                        if (!window.confirm(confirmMsg)) return;
                        try {
                          const res = await deleteServicePO(id, doc.id);
                          showMessage(res.data?.message || 'Service PO deleted');
                          await loadOrder();
                        } catch (err) {
                          setError('Failed to delete service PO: ' + (err.response?.data?.error?.message || err.message));
                        }
                      } else {
                        handleDeleteDocument(doc.id);
                      }
                    }} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d32f2f' }}
                    title="Delete"
                  >
                    <X size={14} />
                  </button>
                  {isServicePO ? (
                    <button
                      onClick={() => {
                        const subject = encodeURIComponent(`${servicePOPONumber || 'Purchase Order'} from Carolina Rolling`);
                        const body = encodeURIComponent(
                          `Hi${servicePOVendorName ? ' ' + servicePOVendorName : ''},\n\n` +
                          `Please find the attached purchase order ${servicePOPONumber || ''} for DR-${order.drNumber}.\n\n` +
                          `Please download the PO from the attached file or reply with any questions.\n\n` +
                          `Thank you,\n` +
                          `Carolina Rolling Co.`
                        );
                        window.location.href = `mailto:?subject=${subject}&body=${body}`;
                      }}
                      style={{ background: '#00897B', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}
                      title="Open email draft (attach downloaded PDF manually)"
                    >
                      📤 Email
                    </button>
                  ) : (order.estimateId && (
                    <button
                      onClick={async () => {
                        try {
                          const { sendVendorPo } = await import('../services/api');
                          const res = await sendVendorPo(id, {});
                          const draftUrl = res.data.data?.draftUrl;
                          if (draftUrl) {
                            window.open(draftUrl, '_blank');
                            showMessage('PO draft created — review and send in Gmail');
                          }
                        } catch (err) {
                          const msg = err.response?.data?.error?.message || 'Failed';
                          if (msg.includes('No vendor RFQ')) {
                            setError('No vendor RFQ was sent for this estimate. Send an RFQ from the estimate first.');
                          } else {
                            setError(msg);
                          }
                        }
                      }}
                      style={{ background: '#7B1FA2', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}
                      title="Email PO to Vendor"
                    >
                      📤 Email
                    </button>
                  ))}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Missing PO PDFs — show regenerate for POs that have parts assigned but no document */}
        {(() => {
          const poDocNames = (order.documents || []).filter(d => d.documentType === 'purchase_order').map(d => d.originalName?.match(/^(PO\d+)/)?.[1]).filter(Boolean);
          const partPOs = [...new Set((order.parts || []).map(p => p.materialPurchaseOrderNumber).filter(Boolean))];
          const missingPOs = partPOs.filter(po => !poDocNames.includes(po));
          if (missingPOs.length === 0) return null;
          return (
            <div style={{ marginTop: 12, padding: 12, background: '#ffebee', borderRadius: 8, border: '1px solid #ef9a9a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c62828' }}>Missing PO Documents</div>
                <button onClick={async () => {
                  if (!window.confirm('Clear PO numbers from these parts? The parts will keep their vendor but the PO assignment will be removed.')) return;
                  try {
                    for (const po of missingPOs) {
                      const affectedParts = (order.parts || []).filter(p => p.materialPurchaseOrderNumber === po);
                      for (const part of affectedParts) {
                        await updateWorkOrderPart(id, part.id, { materialPurchaseOrderNumber: null, materialOrdered: false, materialOrderedAt: null });
                      }
                    }
                    showMessage('PO assignments cleared');
                    await loadOrder();
                  } catch (err) { setError('Failed to clear POs'); }
                }} style={{ background: 'none', border: '1px solid #ef9a9a', color: '#c62828', padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>
                  ✕ Dismiss All
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {missingPOs.map(po => (
                  <div key={po} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={async () => {
                      try {
                        await createPODocument(id, po);
                        showMessage(`${po} PDF regenerated`);
                        await loadOrder();
                      } catch (err) {
                        setError(`Failed to regenerate ${po}: ${err.response?.data?.error?.message || err.message}`);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #ef9a9a', borderRadius: '6px 0 0 6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <RefreshCw size={14} color="#c62828" />
                      <strong style={{ color: '#c62828' }}>{po}</strong>
                      <span style={{ color: '#666' }}>— Regenerate</span>
                    </button>
                    <button onClick={async () => {
                      try {
                        const affectedParts = (order.parts || []).filter(p => p.materialPurchaseOrderNumber === po);
                        for (const part of affectedParts) {
                          await updateWorkOrderPart(id, part.id, { materialPurchaseOrderNumber: null, materialOrdered: false, materialOrderedAt: null });
                        }
                        showMessage(`${po} cleared from parts`);
                        await loadOrder();
                      } catch (err) { setError('Failed to clear PO'); }
                    }} style={{ background: 'white', border: '1px solid #ef9a9a', borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '6px 8px', cursor: 'pointer', color: '#999', fontSize: '0.85rem' }}
                      title={`Remove ${po} from parts`}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      </div>


      {/* Tab Navigation */}
      <div id="wo-tabs" style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0', marginTop: 20, marginBottom: 0 }}>
        {[
          { key: 'parts', label: '📦 Parts', count: order.parts?.length || 0 },
          { key: 'documents', label: '📄 Documents', count: (order.documents?.filter(d => d.documentType !== 'purchase_order' && d.documentType !== 'outside_processing_po').length || 0) || undefined },
          { key: 'materials', label: '📋 Materials' },
          ...(((order.vendorIssues || []).filter(i => i.status !== 'resolved').length > 0) ? [{ key: 'vendor_issues', label: '⚠ Vendor Issues', count: (order.vendorIssues || []).filter(i => i.status !== 'resolved').length, urgent: true }] : []),
          { key: 'summary', label: '📊 Summary' },
          { key: 'shipping', label: '🚚 Outbound', count: (order.pickupHistory || []).length || undefined }
        ].map(tab => (
          <button key={tab.key} onClick={(e) => { e.preventDefault(); setWoTab(tab.key); setTimeout(() => document.getElementById('wo-tabs')?.scrollIntoView({ behavior: 'instant', block: 'start' }), 0); }}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: woTab === tab.key ? (tab.urgent ? '#c62828' : '#1976d2') : (tab.urgent ? '#ffebee' : 'transparent'),
              color: woTab === tab.key ? 'white' : (tab.urgent ? '#c62828' : '#555'),
              fontWeight: woTab === tab.key ? 700 : (tab.urgent ? 700 : 500),
              fontSize: '0.95rem', borderRadius: '8px 8px 0 0',
              transition: 'all 0.15s'
            }}>
            {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {/* ===== PARTS TAB ===== */}
      {woTab === 'parts' && (
      <>
      {/* Parts Section */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><Package size={20} style={{ marginRight: 8 }} />Parts ({order.parts?.length || 0})</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {!order.estimateNumber && (
              <button className="btn btn-sm" onClick={() => setShowLinkEstimateModal(true)} style={{ background: '#7b1fa2', color: 'white' }}>
                <Link2 size={16} /> Link Estimate
              </button>
            )}
            {order.estimateNumber && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', color: '#7b1fa2', fontWeight: 500 }}>
                <Link2 size={14} /> {order.estimateNumber}
                <button onClick={handleUnlinkEstimate} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#d32f2f' }} title="Unlink estimate">
                  <Unlink size={14} />
                </button>
              </span>
            )}
            {getOrderableParts().length > 0 && (
              <button className="btn btn-sm" onClick={openOrderModal} style={{ background: '#ff9800', color: 'white' }}>
                <ShoppingCart size={16} /> Order Material
              </button>
            )}
            {hasOrderableServices() && (
              <button className="btn btn-sm" onClick={async () => {
                const groups = getServiceOrderableGroups();
                setServiceModalSelected(new Set(Object.keys(groups)));
                try {
                  const poRes = await getNextPONumber();
                  setServicesStartingPONumber(poRes.data.data.nextNumber.toString());
                } catch {
                  setServicesStartingPONumber('');
                }
                setShowServicesModal(true);
              }} style={{ background: '#00897B', color: 'white' }}>
                🏭 Order Services
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={openAddPartModal}><Plus size={16} />Add Part</button>
            {order.parts?.length > 1 && (
              <button className="btn btn-sm" onClick={() => {
                const sorted = [...(order.parts || [])].sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0));
                // Group: regular parts only (services follow their parent)
                const regular = sorted.filter(p => !['fab_service', 'shop_rate'].includes(p.partType) || !(p._linkedPartId || (p.formData || {})._linkedPartId));
                setReorderParts(regular);
                setReorderMode(true);
              }} style={{ background: '#546e7a', color: 'white', border: 'none' }}>
                ↕️ Arrange
              </button>
            )}
          </div>
        </div>
        {/* Progress Bar */}
        {order.parts?.length > 0 && (() => {
          const totalParts = order.parts.length;
          const completedParts = order.parts.filter(p => p.status === 'completed').length;
          const inProgressParts = order.parts.filter(p => p.status === 'in_progress').length;
          const pct = Math.round((completedParts / totalParts) * 100);
          const isShippedOrArchived = ['shipped', 'archived'].includes(order.status);
          const displayPct = isShippedOrArchived ? 100 : pct;
          const displayCompleted = isShippedOrArchived ? totalParts : completedParts;
          return (
            <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.85rem', color: '#555' }}>
                  {displayCompleted} of {totalParts} part{totalParts !== 1 ? 's' : ''} complete
                  {inProgressParts > 0 && !isShippedOrArchived && <span style={{ color: '#0288d1', marginLeft: 8 }}>({inProgressParts} in progress)</span>}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: displayPct === 100 ? '#2e7d32' : displayPct > 0 ? '#1565c0' : '#999' }}>
                  {displayPct}%
                </span>
              </div>
              <div style={{ height: 8, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${displayPct}%`,
                  background: displayPct === 100 ? '#4caf50' : '#1976d2',
                  borderRadius: 4,
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          );
        })()}
        {hasNoParts ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <Package size={48} color="#9c27b0" />
            <p style={{ marginTop: 12, color: '#9c27b0', fontWeight: 500 }}>Awaiting Instructions</p>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>Add parts when the client calls with rolling/bending instructions, or link an existing estimate</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={openAddPartModal}><Plus size={16} />Add First Part</button>
              {!order.estimateNumber && (
                <button className="btn" onClick={() => setShowLinkEstimateModal(true)} style={{ background: '#7b1fa2', color: 'white' }}>
                  <Link2 size={16} /> Link Estimate
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            {(() => {
              // Group parts: regular parts first, then linked services right after their parent
              const sortedParts = [...order.parts].sort((a, b) => a.partNumber - b.partNumber);
              const regularParts = sortedParts.filter(p => !['fab_service', 'shop_rate'].includes(p.partType) || !(p._linkedPartId || (p.formData || {})._linkedPartId));
              const serviceParts = sortedParts.filter(p => ['fab_service', 'shop_rate'].includes(p.partType) && (p._linkedPartId || (p.formData || {})._linkedPartId));
              const grouped = [];
              const usedServiceIds = new Set();
              regularParts.forEach(rp => {
                grouped.push(rp);
                serviceParts.forEach(sp => {
                  const linkedId = sp._linkedPartId || (sp.formData || {})._linkedPartId;
                  if (String(linkedId) === String(rp.id) && !usedServiceIds.has(sp.id)) {
                    grouped.push(sp);
                    usedServiceIds.add(sp.id);
                  }
                });
              });
              serviceParts.forEach(sp => { if (!usedServiceIds.has(sp.id)) grouped.push(sp); });
              return grouped;
            })().map(part => {
              // Transport allocations removed in Commit 4 — order-level OP transports no longer exist
              const isLinkedService = ['fab_service', 'shop_rate'].includes(part.partType) && (part._linkedPartId || (part.formData || {})._linkedPartId);
              const linkedParent = isLinkedService ? order.parts.find(p => String(p.id) === String(part._linkedPartId || (part.formData || {})._linkedPartId)) : null;
              const partQty = parseInt(part.quantity) || 1;
              const transportMatPerPart = 0;
              const transportLabPerPart = 0;
              // Compute display values that include transport allocation AND outside processing cost
              const baseLaborPerPart = parseFloat(part.laborTotal) || 0;
              const baseMaterialPerPart = (() => {
                const matCost = parseFloat(part.materialTotal) || 0;
                const matMarkupRaw = parseFloat(part.materialMarkupPercent);
                const matMarkup = isNaN(matMarkupRaw) ? 20 : matMarkupRaw;
                const matEachRaw = matCost * (1 + matMarkup / 100);
                const rounding = part._materialRounding || (part.formData || {})._materialRounding;
                return roundUpMaterial(matEachRaw, rounding);
              })();
              // Bundle OP cost into the labor line (matches estimate page behavior)
              // part.laborTotal already contains OP markup (saved that way by form); we need to add the vendor cost
              const opCostPerPart = (part.outsideProcessing || []).reduce((sum, op) => {
                const cost = parseFloat(op.costPerPart) || 0;
                const expedite = parseFloat(op.expediteCost) || 0;
                return sum + cost + expedite;
              }, 0);
              const hiddenFromCustomer = !!((part.formData || {})._fsHiddenFromCustomer || part._fsHiddenFromCustomer);
              // Hidden-from-customer parts don't contribute to the customer-facing total
              const displayLabor = hiddenFromCustomer ? 0 : (baseLaborPerPart + opCostPerPart + transportLabPerPart);
              const displayMaterial = hiddenFromCustomer ? 0 : (baseMaterialPerPart + transportMatPerPart);
              const displayTotal = (displayLabor + displayMaterial) * partQty;
              return (
              <div key={part.id} style={{
                border: hiddenFromCustomer ? '2px solid #EF5350' : (isLinkedService ? '2px solid #ce93d8' : '1px solid #e0e0e0'),
                borderRadius: isLinkedService ? 4 : 8, padding: isLinkedService ? '12px 16px' : 16, marginBottom: isLinkedService ? 4 : 12,
                marginLeft: isLinkedService ? 32 : 0, marginTop: isLinkedService ? -4 : 0,
                background: hiddenFromCustomer ? '#FFEBEE' : (isLinkedService ? '#fce4ec' : (part.status === 'completed' ? '#f9fff9' : 'white')),
              }}>
                {hiddenFromCustomer && (
                  <div style={{ marginBottom: 10, padding: '6px 10px', background: '#C62828', color: 'white', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🔒 INTERNAL ONLY — HIDDEN FROM CUSTOMER (Rolling Assist / hidden cost)
                  </div>
                )}                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isLinkedService && <span style={{ color: '#7b1fa2', fontWeight: 700 }}>↳</span>}
                      <span style={{ fontWeight: 600, fontSize: isLinkedService ? '1rem' : '1.1rem' }}>#{part.partNumber}</span>
                      <span style={{ color: isLinkedService ? '#7b1fa2' : '#1976d2' }}>{PART_TYPES[part.partType]?.label || part.partType}</span>
                      {isLinkedService && linkedParent && (
                        <span style={{ fontSize: '0.8rem', color: '#9c27b0' }}>for Part #{linkedParent.partNumber}</span>
                      )}
                      <StatusBadge status={part.status} />
                      {part.materialOrdered && (
                        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const current = part.materialPurchaseOrderNumber || '';
                            const num = current.replace(/\D/g, '');
                            const newNum = prompt(`Edit PO number (currently ${current}):\nEnter new number:`, num);
                            if (newNum && newNum !== num) {
                              const poNum = newNum.replace(/\D/g, '');
                              if (poNum) {
                                updateWorkOrderPart(id, part.id, { materialPurchaseOrderNumber: `PO${poNum}` })
                                  .then(() => loadOrder())
                                  .catch(err => setError('Failed to update PO number'));
                              }
                            }
                          }}
                          title="Click to edit PO number">
                          ✓ {part.materialPurchaseOrderNumber}
                        </span>
                      )}
                      {/* Service PO badges — one per OP entry that has a poNumber stamped */}
                      {(part.outsideProcessing || []).filter(op => op.poNumber).map((op, opIdx) => (
                        <span key={`servpo-${opIdx}`} style={{ background: '#E0F2F1', color: '#00695C', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', border: '1px solid #80CBC4' }}
                          title={`Service PO sent to ${op.vendorName || 'vendor'}`}>
                          🏭 {op.poNumber}
                        </span>
                      ))}
                    </div>
                    {part.clientPartNumber && <div style={{ color: '#666', fontSize: '0.875rem' }}>Client Part#: {part.clientPartNumber}</div>}
                    {part.heatBreakdown && part.heatBreakdown.length > 0 ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                        {part.heatBreakdown.map((h, i) => (
                          <span key={i} style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 4, padding: '1px 8px', fontSize: '0.8rem', fontWeight: 600, color: '#795548' }}>
                            {h.heat}: {h.qty}pc
                          </span>
                        ))}
                      </div>
                    ) : part.heatNumber ? (
                      <div style={{ color: '#666', fontSize: '0.875rem' }}>Heat#: {part.heatNumber}</div>
                    ) : null}
                    {part.cutFileReference && <div style={{ color: '#1565c0', fontSize: '0.875rem' }}>📐 Cut File: {part.cutFileReference}</div>}
                  </div>
                  {/* Milestone progress — only for qty > 20 */}
                  {(() => {
                    const qty = parseInt(part.quantity) || 1;
                    if (qty <= 20 || part.status === 'completed') return null;
                    const progress = part.progressCount || 0;
                    const rawStep = Math.round(qty / 4 / 5) * 5;
                    const step = rawStep >= 5 ? rawStep : Math.round(qty / 4);
                    const milestones = [step, step * 2, step * 3];
                    const pct = Math.min(100, Math.round((progress / qty) * 100));
                    return (
                      <div style={{ marginBottom: 8 }}>
                        {progress > 0 && (
                          <div style={{ marginBottom: 5 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#666', marginBottom: 3 }}>
                              <span>Progress</span>
                              <span style={{ fontWeight: 600 }}>{progress} / {qty} pcs{part.progressLastUpdatedAt ? ` · ${new Date(part.progressLastUpdatedAt).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'})}` : ''}</span>
                            </div>
                            <div style={{ height: 5, background: '#e0e0e0', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: pct + '%', background: '#1976d2', borderRadius: 99, transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {milestones.map(ms => {
                            const reached = progress >= ms;
                            const isNext = !reached && (ms === milestones[0] || progress >= milestones[milestones.indexOf(ms) - 1]);
                            return (
                              <button key={ms} disabled={reached}
                                onClick={() => updateWorkOrderPart(id, part.id, { progressCount: ms }).then(() => loadOrder())}
                                style={{
                                  padding: '3px 9px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 600,
                                  cursor: reached ? 'default' : 'pointer',
                                  border: `1px solid ${reached ? '#a5d6a7' : isNext ? '#1976d2' : '#ccc'}`,
                                  background: reached ? '#e8f5e9' : isNext ? '#e3f2fd' : '#fff',
                                  color: reached ? '#2e7d32' : isNext ? '#1565c0' : '#bbb'
                                }}>
                                {reached ? '✓ ' : ''}{ms} pcs
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    );
                  })()}
                  <div className="actions-row">
                    {part.completedBy && part.status === 'completed' && (
                      <span style={{ fontSize: '0.75rem', color: '#388e3c', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                        Completed by {part.completedBy.replace(/\s*\(.*\)\s*$/, '')} on {part.completedAt ? new Date(part.completedAt).toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' ' + new Date(part.completedAt).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}) : ''}
                      </span>
                    )}
                    <select className="form-select" value={part.status} onChange={(e) => handlePartStatusChange(part.id, e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}>
                      <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                    </select>
                    <button className="btn btn-sm btn-outline" onClick={() => printPartLabel(part)} title="Print Label"><Tag size={14} /></button>
                    <button className="btn btn-sm btn-outline" onClick={() => openEditPartModal(part)}><Edit size={14} /></button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleDuplicatePart(part)} title="Duplicate part" style={{ color: '#546e7a' }}>📋</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeletePart(part.id)}><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Outside Processing Indicator */}
                {part.outsideProcessingVendorName && (
                  <div style={{ padding: '10px 12px', background: '#FFF3E0', borderRadius: 6, marginBottom: 12, border: '1px solid #FFE0B2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ background: '#E65100', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>🏭 OUT</span>
                          <strong style={{ color: '#E65100' }}>{part.outsideProcessingServiceType || 'Outside Processing'}</strong>
                          <span style={{ color: '#666' }}>@</span>
                          <span style={{ fontWeight: 600 }}>{part.outsideProcessingVendorName}</span>
                          {part.outsideProcessingPONumber && <span style={{ fontSize: '0.75rem', color: '#666' }}>• {part.outsideProcessingPONumber}</span>}
                          {part.outsideProcessingExpectedReturn && (
                            <span style={{ fontSize: '0.75rem', color: '#1565c0' }}>• Return by {new Date(part.outsideProcessingExpectedReturn).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' })}</span>
                          )}
                        </div>
                        {part.outsideProcessingStatus === 'returned' && part.outsideProcessingReturnedAt && (
                          <div style={{ fontSize: '0.75rem', color: '#2e7d32', marginTop: 4 }}>
                            ✅ Returned {new Date(part.outsideProcessingReturnedAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}
                          </div>
                        )}
                      </div>
                      {part.outsideProcessingStatus !== 'returned' && (
                        <button onClick={async () => {
                          try {
                            await updateOutsideProcessingStatus(id, part.id, 'returned');
                            await loadOrder();
                            showMessage('Part marked as returned');
                          } catch { setError('Failed to update'); }
                        }} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                          ✓ Mark Returned
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Material Source Info */}
                {(part.materialSource === 'we_order' || part.materialDescription) && (
                  <div style={{ 
                    background: part.materialOrdered ? '#e8f5e9' : part.materialSource === 'we_order' ? '#fff3e0' : '#e3f2fd', 
                    padding: 10, borderRadius: 6, marginBottom: 12 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ 
                          background: part.materialSource === 'we_order' ? '#ff9800' : part.materialSource === 'in_stock' ? '#4caf50' : '#2196f3',
                          color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', marginRight: 8
                        }}>
                          {part.materialSource === 'we_order' ? 'We Order' : part.materialSource === 'in_stock' ? 'In Stock' : 'Customer'}
                        </span>
                        {part.materialDescription && (
                          <strong style={{ color: part.materialOrdered ? '#2e7d32' : '#333' }}>📦 {part.materialDescription}</strong>
                        )}
                        {(part.vendor?.name || part.supplierName) && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#666' }}>from {part.vendor?.name || part.supplierName}</span>}
                        {part.vendorEstimateNumber && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#1565c0', fontWeight: 600 }}>Est# {part.vendorEstimateNumber}</span>}
                      </div>
                      {part.materialSource === 'we_order' && (
                        part.materialOrdered ? (
                          <span style={{ fontSize: '0.8rem', color: '#2e7d32', fontWeight: 600, cursor: 'pointer', borderBottom: '1px dashed #2e7d32' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = part.materialPurchaseOrderNumber || '';
                              const num = current.replace(/\D/g, '');
                              const newNum = prompt(`Edit PO number (currently ${current}):\nEnter new number:`, num);
                              if (newNum && newNum !== num) {
                                const poNum = newNum.replace(/\D/g, '');
                                if (poNum) {
                                  updateWorkOrderPart(id, part.id, { materialPurchaseOrderNumber: `PO${poNum}` })
                                    .then(() => loadOrder())
                                    .catch(err => setError('Failed to update PO number'));
                                }
                              }
                            }}
                            title="Click to edit PO number">
                            ✓ {part.materialPurchaseOrderNumber}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.8rem', color: '#e65100' }}>Needs ordering</span>
                            <span style={{ fontSize: '0.75rem', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const choice = window.confirm(
                                  'Material was received without a PO.\n\n' +
                                  'OK = Mark as received (material is here)\n' +
                                  'Cancel = Keep as needs ordering'
                                );
                                if (choice) {
                                  updateWorkOrderPart(id, part.id, { materialOrdered: true, materialPurchaseOrderNumber: 'NO-PO' })
                                    .then(() => { loadOrder(); })
                                    .catch(err => setError('Failed to update'));
                                }
                              }}>
                              Material received?
                            </span>
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.875rem', marginBottom: 8 }}>
                  {/* Line 1: Qty, Size, Grade — inline flowing format */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    {part.partType !== 'rush_service' && <span><strong>Qty:</strong> {part.quantity}</span>}
                    {part.sectionSize && <span style={{ color: '#555' }}>| <strong>Size:</strong> {part.partType === 'pipe_roll' && (part.formData || {})._schedule ? part.sectionSize.replace(' Pipe', ` Sch ${(part.formData || {})._schedule} Pipe`) : part.sectionSize}</span>}
                    {part.thickness && <span style={{ color: '#555' }}>| <strong>Thk:</strong> {part.thickness}"</span>}
                    {part.outerDiameter && <span style={{ color: '#555' }}>| <strong>OD:</strong> {part.outerDiameter}"</span>}
                    {part.wallThickness && part.wallThickness !== 'SOLID' && <span style={{ color: '#555' }}>| <strong>Wall:</strong> {part.wallThickness}</span>}
                    {part.wallThickness === 'SOLID' && <span style={{ color: '#e65100', fontWeight: 600 }}>| Solid Bar</span>}
                    {part.width && <span style={{ color: '#555' }}>| <strong>Width:</strong> {part.width}"</span>}
                    {part.length && <span style={{ color: '#555' }}>| <strong>Length:</strong> {part.length}</span>}
                    {part.material && <span style={{ color: '#555' }}>| <strong>Grade:</strong> {part.material}</span>}
                  </div>
                  {/* Line 2: Roll method — template / print / radius+diameter */}
                  {(part.formData || {})._rollToMethod === 'template' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, color: '#e65100', fontSize: '0.82rem', fontWeight: 600, marginBottom: 2 }}>
                      📐 Per Template / Sample
                      {part.rollType && <span>({part.partType === 'tee_bar' ? (part.rollType === 'easy_way' ? 'SO' : part.rollType === 'on_edge' ? 'SU' : 'SI') : (part.rollType === 'easy_way' ? 'EW' : part.rollType === 'on_edge' ? 'OE' : 'HW')})</span>}
                      {part.arcDegrees && <span>| Arc: {part.arcDegrees}°</span>}
                    </div>
                  )}
                  {(part.formData || {})._rollToMethod === 'print' && (() => {
                    const printFiles = (part.files || []).filter(f => f.mimeType === 'application/pdf' || f.originalName?.toLowerCase().endsWith('.pdf'));
                    const printName = printFiles.length > 0 ? printFiles.map(f => f.originalName).join(', ') : '(see attached)';
                    return <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, color: '#1565c0', fontSize: '0.82rem', fontWeight: 600, marginBottom: 2 }}>
                        📄 Roll per print: {printName}
                        {part.rollType && <span>({part.partType === 'tee_bar' ? (part.rollType === 'easy_way' ? 'SO' : part.rollType === 'on_edge' ? 'SU' : 'SI') : (part.rollType === 'easy_way' ? 'EW' : part.rollType === 'on_edge' ? 'OE' : 'HW')})</span>}
                        {part.arcDegrees && <span>| Arc: {part.arcDegrees}°</span>}
                      </div>
                      {!(part.files || []).some(f => f.mimeType === 'application/pdf' || f.originalName?.toLowerCase().endsWith('.pdf')) && (
                        <div style={{ color: '#c62828', fontSize: '0.8rem', fontWeight: 600, marginBottom: 2 }}>⚠️ Roll instruction PDF required — upload below</div>
                      )}
                    </>;
                  })()}
                  {!(part.formData || {})._rollToMethod && (part.diameter || part.radius) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, color: '#1565c0', fontSize: '0.82rem', marginBottom: 2 }}>
                      🔄 {part.diameter || part.radius}" {(() => {
                        const mp = (part.formData || {})._rollMeasurePoint || part._rollMeasurePoint || 'inside';
                        const isRad = !!part.radius && !part.diameter;
                        if (mp === 'inside') return isRad ? 'ISR' : 'ID';
                        if (mp === 'outside') return isRad ? 'OSR' : 'OD';
                        return isRad ? 'CLR' : 'CLD';
                      })()}
                      {part.rollType && <span>({part.partType === 'tee_bar' ? (part.rollType === 'easy_way' ? 'SO' : part.rollType === 'on_edge' ? 'SU' : 'SI') : (part.rollType === 'easy_way' ? 'EW' : part.rollType === 'on_edge' ? 'OE' : 'HW')})</span>}
                      {part.arcDegrees && <span>| Arc: {part.arcDegrees}°</span>}
                      {((part.formData || {})._legOrientation || part._legOrientation) && <span>| {(part.formData || {})._legOrientation || part._legOrientation}" leg {part.rollType === 'easy_way' ? 'out' : part.rollType === 'on_edge' ? 'edge' : 'in'}</span>}
                      {((part.formData || {})._sideOrientation || part._sideOrientation) && <span>| {(part.formData || {})._sideOrientation || part._sideOrientation}" side {part.rollType === 'easy_way' ? 'out' : part.rollType === 'on_edge' ? 'edge' : 'in'}</span>}
                    </div>
                  )}
                  {/* Chord/rise lines for the roll radius — lines before "Developed" in the description */}
                  {(() => {
                    const desc = (part.formData || {})._rollingDescription || '';
                    const lines = desc.split('\n');
                    const devIdx = lines.findIndex(l => l.includes('Developed'));
                    const rollLines = lines
                      .slice(0, devIdx >= 0 ? devIdx : lines.length)
                      .filter(l => l.includes('Rise:') || l.includes('Complete Ring') || l.includes('Cone:') || l.includes('Sheet Size:'));
                    return rollLines.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#6a1b9a', marginTop: 2 }}>
                        {rollLines.map((line, i) => <div key={i}>📐 {line.trim()}</div>)}
                      </div>
                    );
                  })()}
                  {/* Complete rings */}
                  {(part.formData || {})._completeRings && (part.formData || {})._ringsNeeded && (
                    <div style={{ color: '#2e7d32', fontWeight: 600, fontSize: '0.82rem', marginTop: 2 }}>⭕ {(part.formData || {})._ringsNeeded} complete ring(s) required</div>
                  )}
                  {/* Pitch info (with developed diameter) */}
                  {((part.formData || {})._pitchEnabled || part._pitchEnabled) && (
                    <div style={{ fontSize: '0.8rem', color: '#e65100', marginTop: 2 }}>
                      🌀 Pitch: {((part.formData || {})._pitchDirection || part._pitchDirection) === 'clockwise' ? 'CW' : 'CCW'}
                      {((part.formData || {})._pitchMethod || part._pitchMethod) === 'runrise' && ((part.formData || {})._pitchRise || part._pitchRise) && ` | Run: ${(part.formData || {})._pitchRun || part._pitchRun}" / Rise: ${(part.formData || {})._pitchRise || part._pitchRise}"`}
                      {((part.formData || {})._pitchMethod || part._pitchMethod) === 'degree' && ((part.formData || {})._pitchAngle || part._pitchAngle) && ` | Angle: ${(part.formData || {})._pitchAngle || part._pitchAngle}°`}
                      {((part.formData || {})._pitchMethod || part._pitchMethod) === 'space' && ((part.formData || {})._pitchSpaceValue || part._pitchSpaceValue) && ` | ${((part.formData || {})._pitchSpaceType || part._pitchSpaceType) === 'center' ? 'C-C' : 'Between'}: ${(part.formData || {})._pitchSpaceValue || part._pitchSpaceValue}"`}
                      {parseFloat((part.formData || {})._pitchDevelopedDia || part._pitchDevelopedDia) > 0 && <span style={{ color: '#2e7d32', fontWeight: 600 }}> | Dev Ø: {parseFloat((part.formData || {})._pitchDevelopedDia || part._pitchDevelopedDia).toFixed(4)}"</span>}
                    </div>
                  )}
                  {/* Chord/rise lines for the developed radius — lines from "Developed" onwards in the description */}
                  {(() => {
                    const desc = (part.formData || {})._rollingDescription || '';
                    const lines = desc.split('\n');
                    const devIdx = lines.findIndex(l => l.includes('Developed'));
                    if (devIdx < 0) return null;
                    const devLines = lines
                      .slice(devIdx)
                      .filter(l => l.includes('Rise:') || l.includes('Complete Ring') || l.includes('Cone:') || l.includes('Sheet Size:'));
                    return devLines.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#6a1b9a', marginTop: 2 }}>
                        {devLines.map((line, i) => <div key={i}>📐 {line.trim()}</div>)}
                      </div>
                    );
                  })()}
                  {/* Orientation diagram for angle/channel rolls */}
                  {(part.partType === 'angle_roll' || part.partType === 'channel_roll') && (part.formData || {})._orientationOption && (
                    <div style={{ marginTop: 8, maxWidth: 250 }}>
                      <img 
                        src={`/images/angle-orientation/${part.partType === 'channel_roll' ? 'Channel' : ''}${part.rollType === 'easy_way' ? 'EWOD' : 'HWID'}Op${(part.formData || {})._orientationOption}.png`}
                        alt={`${part.rollType === 'easy_way' ? 'EW-OD' : 'HW-ID'} Option ${(part.formData || {})._orientationOption}`}
                        style={{ width: '100%', borderRadius: 6, border: '1px solid #ddd' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center', marginTop: 2 }}>
                        {part.rollType === 'easy_way' ? 'EW-OD' : 'HW-ID'} Option {(part.formData || {})._orientationOption}
                      </div>
                    </div>
                  )}
                  {/* Cone type + segments */}
                  {part.partType === 'cone_roll' && (
                    <div style={{ fontSize: '0.8rem', color: '#4a148c', marginTop: 4 }}>
                      🔺 {(part.formData || {})._coneType === 'eccentric' ? `Eccentric${(part.formData || {})._coneEccentricAngle ? ` = ${(part.formData || {})._coneEccentricAngle}°` : ''}` : 'Concentric'}
                      {(parseInt((part.formData || {})._coneRadialSegments) || 1) > 1 && ` | ${(part.formData || {})._coneRadialSegments} @ ${(360 / (parseInt((part.formData || {})._coneRadialSegments) || 1)).toFixed(0)}°`}
                    </div>
                  )}
                  {part.partType === 'cone_roll' && part.cutFileReference && (
                    <div style={{ fontSize: '0.8rem', color: '#1565c0', marginTop: 2 }}>Layout Filename: {part.cutFileReference}</div>
                  )}
                </div>
                {/* Rush Service Display */}
                {part.partType === 'rush_service' && (() => {
                  const fd = part.formData || {};
                  const totals = calculateTotals();
                  return (
                    <div style={{ padding: 12, background: '#fff8e1', borderRadius: 8, border: '2px solid #ffcc80' }}>
                      {fd._expediteEnabled && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#e65100', fontWeight: 600 }}>
                          <span>🚨 {totals.expediteLabel}</span>
                          <span>{formatCurrency(totals.expediteAmount)}</span>
                        </div>
                      )}
                      {fd._emergencyEnabled && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#c62828', fontWeight: 600 }}>
                          <span>🚨 {totals.emergencyLabel}</span>
                          <span>{formatCurrency(totals.emergencyAmount)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {part.specialInstructions && <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4, fontSize: '0.875rem' }}><strong>Instructions:</strong> {part.specialInstructions}</div>}
                
                {/* Pricing Summary — Material and Labor lines include allocated transport (bundled, hidden from customer view) */}
                {hiddenFromCustomer ? (
                  // Hidden part — show internal cost only, customer-facing total is $0
                  (() => {
                    const internalLabor = baseLaborPerPart + opCostPerPart;
                    const internalMaterial = baseMaterialPerPart;
                    const internalTotal = (internalLabor + internalMaterial) * partQty;
                    return internalTotal > 0 ? (
                      <div style={{ marginTop: 8, padding: 8, background: '#FFCDD2', borderRadius: 4, fontSize: '0.85rem', display: 'flex', gap: 16, flexWrap: 'wrap', border: '1px dashed #C62828' }}>
                        <span style={{ color: '#C62828' }}>🔒 <strong>Internal cost:</strong> ${internalTotal.toFixed(2)} ({partQty} × ${(internalLabor + internalMaterial).toFixed(2)})</span>
                        <span style={{ color: '#666' }}>Customer pays: <strong>$0.00</strong></span>
                      </div>
                    ) : null;
                  })()
                ) : (part.partTotal || part.laborTotal || part.materialTotal) && (
                  <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12, marginTop: 8 }}>
                    {part.materialDescription && !['fab_service', 'shop_rate'].includes(part.partType) && (
                      <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                        📦 {part.materialDescription}
                        {part.materialSource && (
                          <div style={{ marginTop: 4, fontSize: '0.8rem', color: '#2e7d32', fontWeight: 600 }}>
                            {part.materialSource === 'we_order' || part.materialSource === 'in_stock'
                              ? 'Material supplied by: Carolina Rolling Company'
                              : `Material supplied by: ${order.clientName || 'Customer'}`}
                          </div>
                        )}
                      </div>
                    )}
                    {displayMaterial > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
                        <span>Material</span>
                        <strong>${displayMaterial.toFixed(2)}</strong>
                      </div>
                    )}
                    {displayLabor > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
                        <span>{part.partType === 'fab_service' ? 'Service' : part.partType === 'shop_rate' ? 'Shop Rate' : part.partType === 'flat_stock' ? 'Handling' : 'Rolling'}</span>
                        <strong>${displayLabor.toFixed(2)}</strong>
                      </div>
                    )}
                    {part.setupCharge > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
                        <span>Setup</span>
                        <strong>${parseFloat(part.setupCharge).toFixed(2)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #ddd', marginTop: 4, fontWeight: 600 }}>
                      <span>Unit Price</span>
                      <span style={{ color: '#1976d2' }}>${(displayLabor + displayMaterial).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '1.05rem', borderTop: '1px solid #ddd' }}>
                      <strong>Line Total ({partQty} × ${(displayLabor + displayMaterial).toFixed(2)})</strong>
                      <strong style={{ color: '#2e7d32' }}>${displayTotal.toFixed(2)}</strong>
                    </div>
                  </div>
                )}
                
                {/* DXF Cut File Section — plate_roll, shaped_plate, flat_stock, cone_roll, press_brake */}
                {['plate_roll', 'shaped_plate', 'flat_stock', 'cone_roll', 'press_brake'].includes(part.partType) && (() => {
                  const dxfFile = (part.files || []).find(f => f.fileType === 'cut_file' || (f.originalName || '').match(/\.dxf$/i));
                  const hasCutPerPrint = part._cutPerPrint || (part.formData || {})._cutPerPrint;
                  return (
                    <div style={{ marginTop: 12, padding: 10, background: '#EDE7F6', borderRadius: 8, border: '1.5px solid #B39DDB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: dxfFile ? 8 : 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#4527a0' }}>✂️ DXF Cut File</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: hasCutPerPrint ? '#4527a0' : '#999' }}>
                            <input type="checkbox" checked={!!hasCutPerPrint}
                              onChange={async (e) => {
                                try {
                                  await updateWorkOrderPart(id, part.id, { _cutPerPrint: e.target.checked });
                                  await loadOrder();
                                } catch {}
                              }}
                              style={{ width: 14, height: 14 }} />
                            ✂️ Cut Per Print
                          </label>
                          <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'white', border: '1px solid #7E57C2', borderRadius: 5, color: '#4527a0', fontSize: '0.8rem', fontWeight: 600 }}>
                            📎 {dxfFile ? 'Replace' : 'Upload DXF'}
                            <input type="file" accept=".dxf,.DXF" hidden onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (dxfFile) {
                                try { await deletePartFile(id, part.id, dxfFile.id); } catch {}
                              }
                              try {
                                await uploadPartFiles(id, part.id, [file]);
                                await updateWorkOrderPart(id, part.id, { cutFileReference: file.name });
                                await loadOrder();
                                showMessage(`Uploaded ${file.name}`);
                              } catch { setError('Failed to upload DXF'); }
                              e.target.value = '';
                            }} />
                          </label>
                        </div>
                      </div>
                      {dxfFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'white', borderRadius: 6, border: '1px solid #D1C4E9' }}>
                          <span style={{ fontSize: '1rem' }}>📐</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: '#4527a0', fontSize: '0.9rem' }}>{dxfFile.originalName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#888' }}>
                              {(() => {
                                const d = dxfFile.updatedAt || dxfFile.createdAt;
                                if (!d) return '';
                                const dt = new Date(d);
                                return 'Uploaded: ' + dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                              })()}
                            </div>
                          </div>
                          <button onClick={() => handleViewFile(part.id, dxfFile.id, dxfFile.url)}
                            style={{ background: '#4527a0', color: 'white', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                            <Eye size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />View
                          </button>
                          <button onClick={() => handleDeleteFile(part.id, dxfFile.id)}
                            style={{ background: 'none', border: '1px solid #c62828', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#c62828', fontSize: '0.75rem' }}>
                            <X size={12} style={{ verticalAlign: 'middle' }} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ color: '#9575CD', fontSize: '0.8rem', textAlign: 'center', padding: 4 }}>
                          No DXF uploaded — upload a cut file to send with vendor RFQs
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Part Files */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Files ({part.files?.length || 0})</span>
                    <button className="btn btn-sm btn-outline" onClick={() => fileInputRefs.current[part.id]?.click()} disabled={uploadingFiles === part.id}>
                      <Upload size={12} />{uploadingFiles === part.id ? 'Uploading...' : 'Upload'}
                    </button>
                    <input type="file" multiple accept=".pdf,.stp,.step,.dxf,.dwg,.png,.jpg,.jpeg,.gif,.doc,.docx" ref={el => fileInputRefs.current[part.id] = el} style={{ display: 'none' }} onChange={(e) => handleFileUpload(part.id, Array.from(e.target.files))} />
                  </div>
                  {part.files?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {part.files.map(file => {
                        const isStep = file.fileType === 'step_file' || file.originalName?.match(/\.(step|stp)$/i);
                        const isDxf = file.originalName?.match(/\.(dxf|dwg)$/i);
                        const chipBg = isStep ? '#f3e5f5' : isDxf ? '#fff8e1' : '#f5f5f5';
                        const chipBorder = isStep ? '1px solid #ce93d8' : isDxf ? '1px solid #ffd54f' : 'none';
                        const chipColor = isStep ? '#7b1fa2' : isDxf ? '#f57f17' : 'inherit';
                        const chipFontWeight = (isStep || isDxf) ? 600 : 400;
                        return (
                        <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: chipBg, padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem', border: chipBorder }}>
                          {isStep && <span title="STEP/3D File">🧊</span>}
                          {isDxf && <span title="DXF/DWG File">📐</span>}
                          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: chipColor, fontWeight: chipFontWeight }}>{file.originalName}</span>
                          <button onClick={() => handleViewFile(part.id, file.id, file.url)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Eye size={12} /></button>
                          <button onClick={() => handleDeleteFile(part.id, file.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#d32f2f' }}><X size={12} /></button>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ); })}
          </div>
        )}
      </div>

      {/* Pricing Section */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><FileText size={20} style={{ marginRight: 8 }} />Pricing</h3>
        </div>
        <div style={{ padding: 16 }}>
          {/* Parts Pricing Table */}
          {order.parts?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #ddd' }}>#</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Description</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Qty</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Labor</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Material</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Setup</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Other</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = [...order.parts].sort((a, b) => a.partNumber - b.partNumber).filter(p => p.partType !== 'rush_service');
                  const regular = sorted.filter(p => !['fab_service', 'shop_rate'].includes(p.partType) || !(p._linkedPartId || (p.formData || {})._linkedPartId));
                  const services = sorted.filter(p => ['fab_service', 'shop_rate'].includes(p.partType) && (p._linkedPartId || (p.formData || {})._linkedPartId));
                  const grouped = [];
                  const used = new Set();
                  regular.forEach(rp => {
                    grouped.push(rp);
                    services.forEach(sp => {
                      const lid = sp._linkedPartId || (sp.formData || {})._linkedPartId;
                      if (String(lid) === String(rp.id) && !used.has(sp.id)) { grouped.push(sp); used.add(sp.id); }
                    });
                  });
                  services.forEach(sp => { if (!used.has(sp.id)) grouped.push(sp); });
                  return grouped;
                })().map(part => {
                  const isLinkedService = ['fab_service', 'shop_rate'].includes(part.partType) && (part._linkedPartId || (part.formData || {})._linkedPartId);
                  const isEa = ['plate_roll', 'shaped_plate', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'].includes(part.partType);
                  const woTotals = calculateTotals();
                  const lr = (woTotals.minInfo.minimumApplies && woTotals.minInfo.totalLabor > 0 && isEa) ? woTotals.minInfo.adjustedLabor / woTotals.minInfo.totalLabor : 1;
                  const partQty = parseInt(part.quantity) || 1;
                  // OP vendor cost from JSONB (Fab Service parts that are subbed)
                  // part.laborTotal already contains the OP markup (profit); the vendor cost is tracked
                  // separately in outsideProcessing[].costPerPart. Include it in the Labor column so
                  // Labor + Material + Setup + Other = Total actually reconciles.
                  const opCostPerPart = (part.outsideProcessing || []).reduce((sum, op) => {
                    const c = parseFloat(op.costPerPart) || 0;
                    const e = parseFloat(op.expediteCost) || 0;
                    return sum + c + e;
                  }, 0);
                  const hiddenFromCustomer = isHiddenFromCustomer(part);
                  // Base labor per piece (markup already baked in when OP enabled)
                  const rawLaborEach = parseFloat(part.laborTotal) || 0;
                  // Hidden parts contribute $0 to the customer-facing table
                  const adjLabor = hiddenFromCustomer
                    ? 0
                    : (rawLaborEach * lr + opCostPerPart);
                  const adjMaterial = hiddenFromCustomer ? 0 : (parseFloat(part.materialTotal) || 0);
                  const laborDelta = hiddenFromCustomer ? 0 : ((rawLaborEach * lr - rawLaborEach) * partQty);
                  const rawPartTotal = parseFloat(part.partTotal) || parseFloat((part.formData || {}).partTotal) || 0;
                  const adjPartTotal = hiddenFromCustomer ? 0 : (isEa ? rawPartTotal + laborDelta : rawPartTotal);
                  return (
                  <tr key={part.id} style={{ borderBottom: '1px solid #eee', background: hiddenFromCustomer ? '#FFEBEE' : (isLinkedService ? '#fce4ec' : 'transparent') }}>
                    <td style={{ padding: 8 }}>{isLinkedService ? '' : part.partNumber}</td>
                    <td style={{ padding: 8, paddingLeft: isLinkedService ? 24 : 8 }}>
                      {isLinkedService && <span style={{ color: '#7b1fa2', marginRight: 4 }}>↳</span>}
                      {hiddenFromCustomer && <span style={{ color: '#C62828', marginRight: 4, fontSize: '0.75rem', fontWeight: 700 }}>🔒</span>}
                      <span style={{ color: hiddenFromCustomer ? '#C62828' : (isLinkedService ? '#7b1fa2' : 'inherit') }}>{PART_TYPES[part.partType]?.label || part.partType}</span>
                      {hiddenFromCustomer && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#C62828', fontStyle: 'italic' }}>(hidden — internal cost only)</span>}
                      {part.materialDescription && <div style={{ fontSize: '0.8rem', color: '#666' }}>{part.materialDescription}</div>}
                    </td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{part.quantity}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(adjLabor)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(adjMaterial)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(hiddenFromCustomer ? 0 : part.setupCharge)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(hiddenFromCustomer ? 0 : part.otherCharges)}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(adjPartTotal)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 300 }}>
              {/* Show labor/material breakdown when minimum applies */}
              {calculateTotals().minInfo.minimumApplies && (
                <div style={{ padding: '4px 0 8px', borderBottom: '1px solid #ff9800', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', padding: '2px 0' }}>
                    <span>Total Material</span><span>{formatCurrency(calculateTotals().minInfo.totalMaterial)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', padding: '2px 0' }}>
                    <span>Total Labor <s style={{ color: '#999' }}>{formatCurrency(calculateTotals().minInfo.totalLabor)}</s></span>
                    <span style={{ color: '#e65100', fontWeight: 600 }}>{formatCurrency(calculateTotals().minInfo.adjustedLabor)} (min)</span>
                  </div>
                </div>
              )}
              {calculateTotals().expediteAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #ffcc80', color: '#e65100', fontSize: '0.85rem' }}>
                  <span>🚨 {calculateTotals().expediteLabel}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(calculateTotals().expediteAmount)}</span>
                </div>
              )}
              {calculateTotals().emergencyAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #ffcc80', color: '#c62828', fontSize: '0.85rem' }}>
                  <span>🚨 {calculateTotals().emergencyLabel}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(calculateTotals().emergencyAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <span>Parts Subtotal:</span>
                <span>{formatCurrency(calculateTotals().partsSubtotal)}</span>
              </div>
              
              {isEditing ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ flex: 1 }}>
                    <input 
                      className="form-input" 
                      placeholder="Trucking description"
                      value={editData.truckingDescription}
                      onChange={(e) => setEditData({ ...editData, truckingDescription: e.target.value })}
                      style={{ marginBottom: 4, fontSize: '0.85rem' }}
                    />
                  </div>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-input" 
                    value={editData.truckingCost}
                    onChange={(e) => setEditData({ ...editData, truckingCost: e.target.value })}
                    style={{ width: 100, textAlign: 'right', marginLeft: 8 }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <span>{order.truckingDescription || 'Trucking'}:</span>
                  <span>{formatCurrency(order.truckingCost)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <span>Subtotal:</span>
                <span>{formatCurrency(calculateTotals().subtotal)}</span>
              </div>

              {isEditing ? (
                <div style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: editData.taxExempt ? 6 : 0 }}>
                    <input type="checkbox" checked={editData.taxExempt} onChange={(e) => setEditData({ ...editData, taxExempt: e.target.checked })} />
                    <span style={{ fontWeight: 600, color: editData.taxExempt ? '#c62828' : undefined }}>Tax Exempt</span>
                  </label>
                  {editData.taxExempt ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
                      <input className="form-input" placeholder="Reason (e.g. Resale)" value={editData.taxExemptReason} onChange={(e) => setEditData({ ...editData, taxExemptReason: e.target.value })} style={{ flex: 1, fontSize: '0.85rem' }} />
                      <input className="form-input" placeholder="Cert #" value={editData.taxExemptCertNumber} onChange={(e) => setEditData({ ...editData, taxExemptCertNumber: e.target.value })} style={{ width: 120, fontSize: '0.85rem' }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span>Tax Rate:</span>
                      <input type="number" step="0.0001" className="form-input" value={editData.taxRate} onChange={(e) => setEditData({ ...editData, taxRate: e.target.value })} style={{ width: 80, textAlign: 'right' }} />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={editData.taxExempt || false}
                        onChange={async (e) => {
                          const newExempt = e.target.checked;
                          const updates = { taxExempt: newExempt };
                          if (!newExempt) { updates.taxExemptReason = ''; updates.taxExemptCertNumber = ''; }
                          setEditData(prev => ({ ...prev, ...updates }));
                          try { await updateWorkOrder(id, updates); await loadOrder(); showMessage(newExempt ? 'Marked tax exempt' : 'Tax exemption removed'); } catch(err) { console.error('Tax save error:', err); }
                        }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: editData.taxExempt ? '#c62828' : '#666' }}>Tax Exempt</span>
                    </label>
                    {!editData.taxExempt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="number" step="0.01" className="form-input"
                          value={editData.taxRate || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, taxRate: e.target.value }))}
                          onBlur={async () => { try { await updateWorkOrder(id, { taxRate: editData.taxRate }); showMessage('Tax rate updated'); } catch {} }}
                          style={{ width: 70, textAlign: 'right', fontSize: '0.85rem', padding: '2px 6px' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>%</span>
                      </div>
                    )}
                  </div>
                  {editData.taxExempt && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input className="form-input" placeholder="Reason" value={editData.taxExemptReason || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, taxExemptReason: e.target.value }))}
                        onBlur={async () => { try { await updateWorkOrder(id, { taxExemptReason: editData.taxExemptReason }); } catch {} }}
                        style={{ flex: 1, fontSize: '0.8rem', padding: '3px 6px' }} />
                      <input className="form-input" placeholder="Cert #" value={editData.taxExemptCertNumber || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, taxExemptCertNumber: e.target.value }))}
                        onBlur={async () => { try { await updateWorkOrder(id, { taxExemptCertNumber: editData.taxExemptCertNumber }); } catch {} }}
                        style={{ width: 100, fontSize: '0.8rem', padding: '3px 6px' }} />
                    </div>
                  )}
                  {!editData.taxExempt && calculateTotals().taxAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#555', marginTop: 2 }}>
                      <span>Tax:</span>
                      <span>{formatCurrency(calculateTotals().taxAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: '1.1rem', background: '#e3f2fd', margin: '8px -8px -8px', padding: '12px 8px', borderRadius: '0 0 8px 8px' }}>
                <span>Grand Total:</span>
                <span>{formatCurrency(calculateTotals().grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Minimum Charge Info */}
          {calculateTotals().minInfo.minimumApplies && (
            <div style={{ marginTop: 12, padding: 12, background: '#fff3e0', border: '1px solid #ff9800', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#e65100', marginBottom: 8, fontSize: '0.85rem' }}>⚠️ Minimum Charge Applied</div>
              <div style={{ fontSize: '0.8rem', color: '#bf360c', marginBottom: 4 }}>
                Total labor across all parts: {formatCurrency(calculateTotals().minInfo.totalLabor)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#bf360c', marginBottom: 4 }}>
                Minimum charge ({calculateTotals().minInfo.highestMinRule?.label}): {formatCurrency(calculateTotals().minInfo.highestMinimum)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#bf360c', marginBottom: 8 }}>
                Labor adjusted up by {formatCurrency(calculateTotals().minInfo.laborDifference)}
              </div>
              <button
                className="btn btn-sm"
                style={{ background: '#ff9800', color: '#fff', border: 'none', fontSize: '0.75rem' }}
                onClick={async () => {
                  setEditData({ ...editData, minimumOverride: true });
                  try { await updateWorkOrder(id, { minimumOverride: true }); showMessage('Minimum override applied'); } catch {}
                }}
              >
                Override Minimum
              </button>
            </div>
          )}

          {!calculateTotals().minInfo.minimumApplies && calculateTotals().minInfo.highestMinimum > 0 && calculateTotals().minInfo.totalLabor > 0 && !editData.minimumOverride && (
            <div style={{ marginTop: 12, padding: 8, background: '#e8f5e9', border: '1px solid #66bb6a', borderRadius: 8, fontSize: '0.8rem', color: '#2e7d32' }}>
              ✅ Total labor {formatCurrency(calculateTotals().minInfo.totalLabor)} meets minimum {formatCurrency(calculateTotals().minInfo.highestMinimum)}
            </div>
          )}

          {editData.minimumOverride && (
            <div style={{ marginTop: 12, padding: 12, background: '#fce4ec', border: '1px solid #e91e63', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c2185b' }}>🔓 Minimum Override Active</span>
                <button className="btn btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  onClick={async () => {
                    setEditData({ ...editData, minimumOverride: false, minimumOverrideReason: '' });
                    try { await updateWorkOrder(id, { minimumOverride: false, minimumOverrideReason: '' }); showMessage('Override removed'); } catch {}
                  }}>
                  Remove
                </button>
              </div>
              {isEditing && (
                <input type="text" className="form-input" placeholder="Override reason..."
                  value={editData.minimumOverrideReason}
                  onChange={(e) => setEditData({ ...editData, minimumOverrideReason: e.target.value })}
                  style={{ fontSize: '0.8rem', padding: '4px 8px', marginTop: 6 }} />
              )}
              {!isEditing && editData.minimumOverrideReason && (
                <div style={{ fontSize: '0.8rem', color: '#c2185b', marginTop: 4 }}>{editData.minimumOverrideReason}</div>
              )}
            </div>
          )}

          {/* Minimum Rules Status */}
          {(order?.parts || []).length > 0 && (
            <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#999', padding: '4px 8px' }}>
              Min rules: {laborMinimums.length} | Labor total: {formatCurrency(calculateTotals().minInfo.totalLabor)} | Highest min: {formatCurrency(calculateTotals().minInfo.highestMinimum)}
              {calculateTotals().minInfo.highestMinRule ? ` (${calculateTotals().minInfo.highestMinRule.label})` : ' (no match)'}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* ===== DOCUMENTS TAB ===== */}
      {woTab === 'documents' && (
        <div style={{ marginTop: 0, minHeight: '70vh' }}>
          {/* Order Documents */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3 className="card-title"><File size={20} style={{ marginRight: 8 }} />Documents ({order.documents?.filter(d => d.documentType !== 'purchase_order' && d.documentType !== 'outside_processing_po' && d.documentType !== 'mtr').length || 0})</h3>
              <div>
                <button className="btn btn-sm btn-outline" onClick={() => docInputRef.current?.click()} disabled={uploadingDocs}>
                  <Upload size={14} />{uploadingDocs ? 'Uploading...' : 'Upload'}
                </button>
                <input type="file" multiple accept=".pdf,.doc,.docx,image/*" ref={docInputRef} style={{ display: 'none' }} 
                  onChange={(e) => handleDocumentUpload(Array.from(e.target.files))} />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12 }}>Customer POs, supplier quotes, drawings, COCs, etc.</p>
            {order.documents?.filter(d => d.documentType !== 'purchase_order' && d.documentType !== 'outside_processing_po' && d.documentType !== 'mtr').length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {order.documents.filter(d => d.documentType !== 'purchase_order' && d.documentType !== 'outside_processing_po' && d.documentType !== 'mtr').map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: doc.portalVisible ? '#e8f5e9' : '#f5f5f5', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', border: doc.portalVisible ? '1px solid #a5d6a7' : '1px solid #eee' }}>
                    <File size={16} color="#1976d2" />
                    <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.originalName}</span>
                    <span style={{ fontSize: '0.7rem', color: '#999' }}>
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }) : ''}
                    </span>
                    {doc.documentType === 'coc' && <span style={{ background: '#6a1b9a', color: 'white', padding: '1px 6px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 700 }}>COC</span>}
                    <button onClick={() => handleViewDocument(doc.id)} style={{ background: '#1976d2', color: 'white', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                      <Eye size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />View
                    </button>
                    <button onClick={async () => {
                      try { await toggleDocumentPortal(id, doc.id, !doc.portalVisible); await loadOrder(); } catch {}
                    }} title={doc.portalVisible ? 'Visible on client portal' : 'Hidden from client portal'}
                      style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', padding: '3px 6px', fontSize: '0.75rem', color: doc.portalVisible ? '#2e7d32' : '#bbb' }}>
                      {doc.portalVisible ? '🌐 Portal' : '🔒'}
                    </button>
                    <button onClick={() => handleDeleteDocument(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d32f2f' }}><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fafafa', padding: 20, borderRadius: 8, textAlign: 'center', color: '#999' }}>No documents uploaded yet</div>
            )}
          </div>

          {/* Vendor Portal File Sharing — per-part files with share toggles */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3 className="card-title" style={{ color: '#E65100' }}>
                🏭 Vendor Portal Sharing
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12 }}>
              Share part files (drawings, DXF, STEP) with outside processing vendors via the vendor portal.
              Toggle the button next to each file to make it visible.
            </p>
            {(order.parts || []).filter(p => p.files && p.files.length > 0).length === 0 ? (
              <div style={{ background: '#fafafa', padding: 20, borderRadius: 8, textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
                No parts with attached files yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(order.parts || []).filter(p => p.files && p.files.length > 0).map(part => (
                  <div key={part.id} style={{ background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #e0e0e0' }}>
                      <strong style={{ fontSize: '0.9rem' }}>Part #{part.partNumber}</strong>
                      {part.clientPartNumber && (
                        <span style={{ fontSize: '0.8rem', color: '#1976d2' }}>
                          🏷️ {part.clientPartNumber}
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#666' }}>
                        {(part.outsideProcessing || []).length > 0
                          ? <span style={{ color: '#E65100' }}>🏭 {(part.outsideProcessing || []).map(o => o.vendorName).filter(Boolean).join(', ')}</span>
                          : <span style={{ color: '#888' }}>In-house</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {part.files.map(file => {
                        const fname = (file.originalName || file.filename || '').toLowerCase();
                        const isStep = file.fileType === 'step_file' || fname.match(/\.(step|stp)$/i);
                        const isDxf = fname.match(/\.(dxf|dwg)$/i);
                        const isPdf = fname.match(/\.pdf$/i);
                        const chipBg = isStep ? '#f3e5f5' : isDxf ? '#fff8e1' : isPdf ? '#e3f2fd' : '#f5f5f5';
                        const chipColor = isStep ? '#7b1fa2' : isDxf ? '#f57f17' : isPdf ? '#1565c0' : '#555';
                        const isShared = file.vendorPortalVisible === true;
                        return (
                          <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: chipBg, borderRadius: 4, fontSize: '0.8rem' }}>
                            <span style={{ color: chipColor, fontWeight: 600, marginRight: 4 }}>
                              {isStep ? '🧊' : isDxf ? '📐' : isPdf ? '📄' : '📎'}
                            </span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: chipColor }}>
                              {file.originalName || file.filename}
                            </span>
                            <button
                              onClick={async () => {
                                try {
                                  await toggleVendorShare(id, part.id, file.id, !isShared);
                                  showMessage(isShared ? 'File unshared from vendor portal' : 'File shared with vendor portal');
                                  await loadOrder();
                                } catch (err) {
                                  setError('Failed to toggle vendor share: ' + (err.response?.data?.error?.message || err.message));
                                }
                              }}
                              style={{
                                background: isShared ? '#2e7d32' : 'white',
                                color: isShared ? 'white' : '#666',
                                border: isShared ? '1px solid #2e7d32' : '1px solid #ccc',
                                padding: '4px 10px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                fontWeight: 600
                              }}
                              title={isShared ? 'Click to hide from vendor portal' : 'Click to share with vendor portal'}>
                              {isShared ? '✓ Shared with Vendor' : '🏭 Share with Vendor'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MTR Section */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ color: '#6a1b9a' }}><FileText size={20} style={{ marginRight: 8 }} />Material Test Reports ({order.documents?.filter(d => d.documentType === 'mtr').length || 0})</h3>
              <div>
                <button className="btn btn-sm" onClick={() => mtrInputRef.current?.click()} disabled={uploadingMtrs}
                  style={{ background: '#6a1b9a', color: 'white', border: 'none' }}>
                  <Upload size={14} />{uploadingMtrs ? 'Uploading...' : 'Upload MTR'}
                </button>
                <input type="file" multiple accept=".pdf" ref={mtrInputRef} style={{ display: 'none' }} 
                  onChange={(e) => { handleMtrUpload(Array.from(e.target.files)); e.target.value = ''; }} />
              </div>
            </div>
            {order.documents?.filter(d => d.documentType === 'mtr').length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {order.documents.filter(d => d.documentType === 'mtr').map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f3e5f5', padding: '10px 14px', borderRadius: 8, border: '1px solid #ce93d8', fontSize: '0.85rem' }}>
                    <FileText size={18} color="#6a1b9a" />
                    <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.originalName}</span>
                    <span style={{ fontSize: '0.7rem', color: '#999' }}>
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }) : ''}
                    </span>
                    <button onClick={() => handleViewDocument(doc.id)} 
                      style={{ background: '#6a1b9a', color: 'white', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                      <Eye size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />View
                    </button>
                    <button onClick={async () => {
                      try {
                        const response = await downloadWorkOrderDocument(id, doc.id);
                        const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = doc.originalName || 'MTR.pdf';
                        document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
                      } catch { setError('Failed to download'); }
                    }} style={{ background: '#4527a0', color: 'white', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                      ⬇ Download
                    </button>
                    <button onClick={() => handleDeleteDocument(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d32f2f' }}><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fafafa', padding: 20, borderRadius: 8, textAlign: 'center', color: '#999' }}>No MTRs uploaded yet</div>
            )}
          </div>
        </div>
      )}

      {/* ===== OUTBOUND SHIPPING TAB ===== */}
      {woTab === 'shipping' && (
        <div style={{ marginTop: 0, minHeight: '70vh' }}>
          {/* Remaining Balance Overview */}
          {(() => {
            const summary = getPickupSummary();
            const totalOrdered = summary.reduce((s, p) => s + p.totalQty, 0);
            const totalShipped = summary.reduce((s, p) => s + p.picked, 0);
            const totalRemaining = summary.reduce((s, p) => s + p.remaining, 0);
            return (
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="card-title" style={{ margin: 0 }}>📊 Shipping Overview</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {totalRemaining > 0 && !(order.isVoided || order.status === 'void') && (
                      <button className="btn" onClick={() => {
                        const items = {};
                        order.parts?.forEach(p => { items[p.id] = { qty: 0 }; });
                        setPickupData({ pickedUpBy: '', type: 'partial', items, _fromShipPartial: true });
                        setShowPickupModal(true);
                      }} style={{ background: '#e65100', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Truck size={16} /> Ship Partial
                      </button>
                    )}
                    {totalRemaining > 0 && order.status === 'stored' && !(order.isVoided || order.status === 'void') && (
                      <button className="btn btn-success" onClick={() => handleCODCheck('pickup')}>
                        <Check size={16} /> Ship All Remaining
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ background: '#f5f5f5', borderRadius: 8, overflow: 'hidden', height: 24, marginBottom: 16, position: 'relative' }}>
                  <div style={{ width: totalOrdered > 0 ? `${(totalShipped / totalOrdered) * 100}%` : '0%', background: totalRemaining === 0 ? '#4caf50' : '#ff9800', height: '100%', borderRadius: 8, transition: 'width 0.3s' }} />
                  <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.8rem', fontWeight: 700, color: '#333' }}>
                    {totalShipped} of {totalOrdered} shipped ({totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0}%)
                  </span>
                </div>

                {/* Per-part breakdown */}
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ textAlign: 'left', padding: '8px', color: '#555' }}>Part</th>
                      <th style={{ textAlign: 'left', padding: '8px', color: '#555' }}>Description</th>
                      <th style={{ textAlign: 'center', padding: '8px', color: '#555' }}>Ordered</th>
                      <th style={{ textAlign: 'center', padding: '8px', color: '#2e7d32' }}>Shipped</th>
                      <th style={{ textAlign: 'center', padding: '8px', color: '#e65100' }}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.filter(p => !['fab_service', 'shop_rate', 'rush_service'].includes(p.partType)).map(p => {
                      const fd = p.formData && typeof p.formData === 'object' ? p.formData : {};
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>#{p.partNumber} {p.clientPartNumber && <span style={{ color: '#1976d2', fontWeight: 400 }}>{p.clientPartNumber}</span>}</td>
                          <td style={{ padding: '8px', color: '#666', fontSize: '0.8rem' }}>{(fd._materialDescription || p.materialDescription || PART_TYPES[p.partType]?.label || '').replace(/^\d+pc:\s*/i, '')}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{p.totalQty}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: '#2e7d32' }}>{p.picked}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: p.remaining > 0 ? '#e65100' : '#4caf50' }}>
                            {p.remaining > 0 ? p.remaining : '✅'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Shipment History */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>📋 Shipment History ({(order.pickupHistory || []).length})</h3>
            {(order.pickupHistory || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
                <Truck size={40} style={{ marginBottom: 8, opacity: 0.3 }} />
                <div>No shipments recorded yet</div>
                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Use "Ship Partial" to start shipping pieces as they're ready</div>
              </div>
            ) : (
              (order.pickupHistory || []).map((entry, idx) => {
                const entryDate = new Date(entry.date);
                const totalItems = (entry.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
                return (
                  <div key={idx} style={{ 
                    marginBottom: 12, borderRadius: 8, overflow: 'hidden',
                    border: `1px solid ${entry.type === 'full' ? '#a5d6a7' : '#ffe082'}`
                  }}>
                    {/* Entry header */}
                    <div style={{ 
                      padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: entry.type === 'full' ? '#e8f5e9' : '#fff8e1'
                    }}>
                      <div>
                        <strong style={{ color: entry.type === 'full' ? '#2e7d32' : '#e65100', fontSize: '0.95rem' }}>
                          {entry.type === 'full' ? '📦 Full Shipment' : `📦 Partial Shipment #${idx + 1}`}
                        </strong>
                        <span style={{ color: '#666', marginLeft: 8, fontSize: '0.85rem' }}>
                          — {totalItems} item{totalItems !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>
                            {entryDate.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' })} {entryDate.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>by {entry.pickedUpBy || 'unknown'}</div>
                        </div>
                        <button onClick={async () => {
                          try {
                            const response = await getPickupReceipt(id, idx);
                            const blob = new Blob([response.data], { type: 'application/pdf' });
                            const url = window.URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          } catch { setError('Failed to generate receipt'); }
                        }} title="Print pickup receipt" style={{ background: 'none', border: '1px solid #1976d2', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#1976d2', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Printer size={12} /> Print
                        </button>
                        <button onClick={async () => {
                          if (!window.confirm(`Delete this shipment record? Quantities will be restored.`)) return;
                          try { await deletePickupEntry(id, idx); await loadOrder(); showMessage('Shipment deleted'); } catch { setError('Failed'); }
                        }} title="Delete shipment" style={{ background: 'none', border: '1px solid #c62828', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', color: '#c62828' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Items table */}
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                          <th style={{ textAlign: 'center', padding: '6px 8px', color: '#555', width: 50 }}>Qty</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555' }}>Part #</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555' }}>Description</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px', color: '#555', width: 50 }}>Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(entry.items || []).map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                              #{item.partNumber}
                              {item.clientPartNumber && <span style={{ color: '#1976d2', fontWeight: 400, marginLeft: 4 }}>{item.clientPartNumber}</span>}
                            </td>
                            <td style={{ padding: '6px 8px', color: '#666' }}>
                              {(item.description || PART_TYPES[item.partType]?.label || '—').replace(/^\d+pc:\s*/i, '')}
                              {item.rollingDescription && <div style={{ fontSize: '0.75rem', color: '#999' }}>{item.rollingDescription}</div>}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <button onClick={async () => {
                                const newQty = prompt(`Edit quantity for Part #${item.partNumber}${item.clientPartNumber ? ' (' + item.clientPartNumber + ')' : ''}:`, item.quantity);
                                if (newQty === null) return;
                                const qty = parseInt(newQty);
                                if (isNaN(qty) || qty < 0) { setError('Invalid quantity'); return; }
                                try {
                                  const updatedItems = [...entry.items];
                                  if (qty === 0) updatedItems.splice(i, 1);
                                  else updatedItems[i] = { ...updatedItems[i], quantity: qty };
                                  if (updatedItems.length === 0) await deletePickupEntry(id, idx);
                                  else await updatePickupEntry(id, idx, { items: updatedItems });
                                  await loadOrder();
                                  showMessage(qty === 0 ? 'Item removed' : 'Quantity updated');
                                } catch { setError('Failed to update'); }
                              }} style={{ background: 'none', border: '1px solid #1976d2', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: '#1976d2', fontSize: '0.75rem' }}>
                                ✏️ Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===== MATERIALS TAB ===== */}
      {woTab === 'materials' && (
        <div className="card" style={{ marginTop: 0, minHeight: '70vh' }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>📋 Bill of Materials</h3>
          {(() => {
            const allParts = order.parts || [];
            const materialParts = allParts.filter(p => !['fab_service', 'shop_rate', 'rush_service'].includes(p.partType));
            if (materialParts.length === 0) return <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>No parts added yet</p>;

            const bySource = { customer_supplied: [], we_order: [], in_stock: [] };
            materialParts.forEach(p => {
              const src = p.materialSource || 'customer_supplied';
              if (!bySource[src]) bySource[src] = [];
              bySource[src].push(p);
            });

            const byVendor = {};
            bySource.we_order.forEach(p => {
              const vKey = p.supplierName || 'Unassigned Vendor';
              if (!byVendor[vKey]) byVendor[vKey] = { vendorId: p.vendorId, parts: [] };
              byVendor[vKey].parts.push(p);
            });

            const renderPart = (p) => {
              const fd = p.formData && typeof p.formData === 'object' ? p.formData : {};
              const desc = fd._materialDescription || p.materialDescription || PART_TYPES[p.partType]?.label || '';
              return (
                <div key={p.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Part #{p.partNumber}</span>
                    <span style={{ color: '#555', marginLeft: 8, fontSize: '0.85rem' }}>({p.quantity || 1}pc) {desc}</span>
                    {p.materialReceived && <span style={{ marginLeft: 8, color: '#2e7d32', fontSize: '0.8rem' }}>✅ Received</span>}
                    {p.materialOrdered && !p.materialReceived && <span style={{ marginLeft: 8, color: '#ff9800', fontSize: '0.8rem' }}>📦 Ordered — {p.materialPurchaseOrderNumber}</span>}
                    {!p.materialOrdered && !p.materialReceived && p.materialSource === 'we_order' && <span style={{ marginLeft: 8, color: '#c62828', fontSize: '0.8rem' }}>⚠ Not ordered</span>}
                    {p.cutFileReference && <span style={{ marginLeft: 8, color: '#1565c0', fontSize: '0.8rem' }}>📐 {p.cutFileReference}</span>}
                  </div>
                  <span style={{ fontWeight: 600, color: '#E65100' }}>${(parseFloat(p.materialTotal) || 0).toFixed(2)}</span>
                </div>
              );
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {bySource.customer_supplied.length > 0 && (
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', background: '#f5f5f5', fontWeight: 700, fontSize: '0.95rem', borderBottom: '1px solid #e0e0e0' }}>
                      👤 Client Supplied ({bySource.customer_supplied.length})
                    </div>
                    {bySource.customer_supplied.map(renderPart)}
                  </div>
                )}

                {bySource.in_stock.length > 0 && (
                  <div style={{ border: '1px solid #c8e6c9', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', background: '#e8f5e9', fontWeight: 700, fontSize: '0.95rem', borderBottom: '1px solid #c8e6c9' }}>
                      🏭 In Stock ({bySource.in_stock.length})
                    </div>
                    {bySource.in_stock.map(renderPart)}
                  </div>
                )}

                {Object.entries(byVendor).map(([vendorName, { parts: vParts }]) => (
                  <div key={vendorName} style={{ border: '1px solid #CE93D8', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', background: '#F3E5F5', fontWeight: 700, fontSize: '0.95rem', borderBottom: '1px solid #CE93D8' }}>
                      🏢 {vendorName} ({vParts.length})
                    </div>
                    {vParts.map(renderPart)}
                    <div style={{ padding: '8px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', fontWeight: 700, fontSize: '0.9rem', color: '#E65100' }}>
                      Vendor Total: ${vParts.reduce((s, p) => s + (parseFloat(p.materialTotal) || 0), 0).toFixed(2)}
                    </div>
                  </div>
                ))}

                {allParts.some(p => p.outsideProcessingVendorName) && (
                  <div style={{ border: '1px solid #FFE0B2', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', background: '#FFF3E0', fontWeight: 700, fontSize: '0.95rem', borderBottom: '1px solid #FFE0B2' }}>
                      🏭 Outside Processing
                    </div>
                    {allParts.filter(p => p.outsideProcessingVendorName).map(p => (
                      <div key={p.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Part #{p.partNumber}</span>
                          <span style={{ color: '#E65100', marginLeft: 8, fontSize: '0.85rem' }}>{p.outsideProcessingVendorName}</span>
                          <span style={{ color: '#888', marginLeft: 8, fontSize: '0.8rem' }}>{p.outsideProcessingDescription}</span>
                          {p.outsideProcessingPONumber && <span style={{ marginLeft: 8, color: '#2e7d32', fontSize: '0.8rem' }}>✅ {p.outsideProcessingPONumber}</span>}
                        </div>
                        <span style={{ fontWeight: 600, color: '#E65100' }}>${((parseFloat(p.outsideProcessingCost) || 0) + (parseFloat(p.outsideProcessingTransportCost) || 0)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ===== VENDOR ISSUES TAB ===== */}
      {woTab === 'vendor_issues' && (
        <div className="card" style={{ marginTop: 0, minHeight: '70vh' }}>
          <h3 className="card-title" style={{ marginBottom: 16, color: '#c62828' }}>⚠ Vendor Issue Reports</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>
            Issues reported by vendors through the vendor portal. Review each one and mark as resolved with notes.
          </p>
          {(!order.vendorIssues || order.vendorIssues.length === 0) ? (
            <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 8, textAlign: 'center', color: '#999' }}>
              No vendor issues reported on this work order.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(order.vendorIssues || []).sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt)).map(issue => {
                const isResolved = issue.status === 'resolved';
                return (
                  <div key={issue.id} style={{
                    padding: 16,
                    background: isResolved ? '#f1f8e9' : '#ffebee',
                    border: isResolved ? '1px solid #c5e1a5' : '2px solid #ef9a9a',
                    borderRadius: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ color: isResolved ? '#2e7d32' : '#c62828', fontSize: '1rem' }}>
                            {isResolved ? '✓ Resolved' : '⚠ Open'}
                          </strong>
                          {issue.poNumber && (
                            <span style={{ background: '#E65100', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                              {issue.poNumber}
                            </span>
                          )}
                          {issue.workOrderPart && (
                            <span style={{ background: '#1976d2', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                              Part #{issue.workOrderPart.partNumber}
                              {issue.workOrderPart.clientPartNumber ? ` (${issue.workOrderPart.clientPartNumber})` : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 4 }}>
                          <strong>{issue.vendorName}</strong>
                          {issue.reportedBy && <span> — reported by {issue.reportedBy}</span>}
                          <span style={{ color: '#999', marginLeft: 8 }}>
                            {new Date(issue.reportedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'white', padding: 12, borderRadius: 4, marginBottom: 8, whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                      {issue.description}
                    </div>

                    {issue.photoUrl && (
                      <div style={{ marginBottom: 8 }}>
                        <a href={issue.photoUrl} target="_blank" rel="noopener noreferrer">
                          <img src={issue.photoUrl} alt="Issue photo"
                            style={{ maxWidth: 400, maxHeight: 300, borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer' }} />
                        </a>
                      </div>
                    )}

                    {isResolved ? (
                      <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 4, marginTop: 8 }}>
                        <div style={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 700, marginBottom: 4 }}>
                          RESOLVED by {issue.resolvedBy || 'Admin'} — {new Date(issue.resolvedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
                        </div>
                        <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{issue.resolutionNotes}</div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const notes = window.prompt(`Resolve this issue reported by ${issue.vendorName}:\n\nEnter resolution notes (required):`);
                          if (!notes || !notes.trim()) return;
                          (async () => {
                            try {
                              await resolveVendorIssue(id, issue.id, notes.trim());
                              showMessage('Issue marked as resolved');
                              await loadOrder();
                            } catch (err) {
                              setError('Failed to resolve: ' + (err.response?.data?.error?.message || err.message));
                            }
                          })();
                        }}
                        style={{
                          background: '#2e7d32', color: 'white', border: 'none',
                          padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
                          fontWeight: 600, fontSize: '0.85rem'
                        }}>
                        ✓ Mark as Resolved
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== SUMMARY TAB ===== */}
      {woTab === 'summary' && (
        <div className="card" style={{ marginTop: 0, minHeight: '70vh' }}>
          <h3 className="card-title" style={{ marginBottom: 20 }}>📊 Job Cost Summary</h3>
          {(() => {
            const allParts = order.parts || [];
            const materialParts = allParts.filter(p => !['fab_service', 'shop_rate', 'rush_service'].includes(p.partType));

            let totalMaterialCost = 0, totalMaterialBilled = 0, totalLaborInHouse = 0;
            let totalOutsideCost = 0, totalOutsideBilled = 0;
            let totalTransportCost = 0, totalTransportBilled = 0;

            materialParts.forEach(p => {
              const qty = parseInt(p.quantity) || 1;
              const matCost = parseFloat(p.materialTotal) || 0;
              const matMarkup = parseFloat(p.materialMarkupPercent) || 0;
              const matBilled = Math.round(matCost * (1 + matMarkup / 100) * 100) / 100;
              totalMaterialCost += matCost * qty;
              totalMaterialBilled += matBilled * qty;

              const ops = p.outsideProcessing || [];
              const opEnabled = ops.length > 0;
              if (!opEnabled) {
                const baseLabor = (() => {
                  const stored = parseFloat((p.formData || {})._baseLaborTotal);
                  if (!isNaN(stored)) return stored;
                  const stored2 = parseFloat(p._baseLaborTotal);
                  if (!isNaN(stored2)) return stored2;
                  return parseFloat(p.laborTotal) || 0;
                })();
                totalLaborInHouse += baseLabor * qty;
              }

              // Multi-operation outside processing (vendor work only)
              ops.forEach(op => {
                const opCostPerPart = parseFloat(op.costPerPart) || 0;
                const opExpedite = parseFloat(op.expediteCost) || 0;
                const opMarkup = parseFloat(op.markup) || 0;
                const opCostBilled = opCostPerPart * (1 + opMarkup / 100);
                totalOutsideCost += (opCostPerPart + opExpedite) * qty;
                totalOutsideBilled += (opCostBilled + opExpedite) * qty;
              });
            });

            // Fab Service / Shop Rate parts: include OP vendor cost in Our Costs
            // (the customer-facing total is already in totalServicesCost via partTotal,
            //  so we ONLY add to the cost side, not the billed side, to avoid double-count)
            let totalServicesCost = 0;
            allParts.filter(p => ['fab_service', 'shop_rate'].includes(p.partType)).forEach(p => {
              const qty = parseInt(p.quantity) || 1;
              const fd = p.formData || {};
              const isHidden = !!(fd._fsHiddenFromCustomer || p._fsHiddenFromCustomer);
              // Customer-facing part total — visible parts only
              if (!isHidden) {
                totalServicesCost += parseFloat(p.partTotal) || 0;
              }
              // OP vendor cost (we pay this regardless of whether customer sees the line)
              const fsOps = p.outsideProcessing || [];
              fsOps.forEach(op => {
                const opCostPerPart = parseFloat(op.costPerPart) || 0;
                const opExpedite = parseFloat(op.expediteCost) || 0;
                totalOutsideCost += (opCostPerPart + opExpedite) * qty;
                // NOTE: not adding to totalOutsideBilled because that would double-count
                // with totalServicesCost (which already includes OP billed amount via partTotal).
                // For hidden parts, the billed amount is $0 — vendor cost comes out of profit.
              });
            });

            const trucking = parseFloat(order.truckingCost) || 0;
            const totalExpenses = totalMaterialCost + totalOutsideCost + totalTransportCost + trucking;
            const totals = calculateTotals();
            const totalRevenue = totals.grandTotal;
            const grossProfit = totalRevenue - totalExpenses;
            const margin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
            const totalMarkupProfit = (totalMaterialBilled - totalMaterialCost) + (totalOutsideBilled - totalOutsideCost) + (totalTransportBilled - totalTransportCost);

            const row = (label, amount, opts = {}) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: opts.size || '0.9rem', color: opts.color || '#333', fontWeight: opts.bold ? 700 : 400, borderTop: opts.border ? '2px solid #e0e0e0' : 'none', marginTop: opts.border ? 8 : 0, paddingTop: opts.border ? 12 : 6 }}>
                <span>{label}</span>
                <span>{typeof amount === 'string' ? amount : formatCurrency(amount)}</span>
              </div>
            );

            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                  <div style={{ padding: 16, background: '#FFF3E0', borderRadius: 10, border: '1px solid #FFE0B2' }}>
                    <h4 style={{ margin: '0 0 12px', color: '#E65100', fontSize: '1rem' }}>💰 Our Costs</h4>
                    {row('Material (our cost)', totalMaterialCost)}
                    {totalOutsideCost > 0 && row('Outside Processing', totalOutsideCost)}
                    {totalTransportCost > 0 && row('Transport (outside)', totalTransportCost)}
                    {trucking > 0 && row('Trucking to Client', trucking)}
                    {row('Total Expenses', totalExpenses, { bold: true, border: true, color: '#c62828' })}
                  </div>
                  <div style={{ padding: 16, background: '#E8F5E9', borderRadius: 10, border: '1px solid #C8E6C9' }}>
                    <h4 style={{ margin: '0 0 12px', color: '#2e7d32', fontSize: '1rem' }}>💵 Client Pays</h4>
                    {row('Material (with markup)', totalMaterialBilled)}
                    {row('In-House Labor', totalLaborInHouse)}
                    {totalOutsideBilled > 0 && row('Outside Processing (marked up)', totalOutsideBilled)}
                    {totalTransportBilled > 0 && row('Transport (marked up)', totalTransportBilled)}
                    {totalServicesCost > 0 && row('Fab Services / Shop Rate', totalServicesCost)}
                    {trucking > 0 && row('Trucking', trucking)}
                    {totals.discountAmt > 0 && row('Discount', -totals.discountAmt, { color: '#c62828' })}
                    {totals.taxAmount > 0 && row('Tax', totals.taxAmount, { color: '#888' })}
                    {row('Grand Total', totals.grandTotal, { bold: true, border: true, color: '#2e7d32' })}
                  </div>
                </div>

                <div style={{ padding: 20, background: margin >= 30 ? '#E8F5E9' : margin >= 15 ? '#FFFDE7' : '#FFEBEE', borderRadius: 10, border: `2px solid ${margin >= 30 ? '#66BB6A' : margin >= 15 ? '#FFF176' : '#EF5350'}`, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: 4 }}>Estimated Margin</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: margin >= 30 ? '#2e7d32' : margin >= 15 ? '#F57F17' : '#c62828' }}>{margin}%</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
                    <div><div style={{ fontSize: '0.75rem', color: '#888' }}>Markup Profit</div><div style={{ fontWeight: 700, color: '#2e7d32' }}>{formatCurrency(totalMarkupProfit)}</div></div>
                    <div><div style={{ fontSize: '0.75rem', color: '#888' }}>Labor Revenue</div><div style={{ fontWeight: 700, color: '#1565c0' }}>{formatCurrency(totalLaborInHouse + totalServicesCost)}</div></div>
                    <div><div style={{ fontSize: '0.75rem', color: '#888' }}>Gross Profit</div><div style={{ fontWeight: 700, color: grossProfit >= 0 ? '#2e7d32' : '#c62828' }}>{formatCurrency(grossProfit)}</div></div>
                  </div>
                </div>

                {/* Internal Costs — hidden-from-customer parts (Rolling Assist etc.) */}
                {(() => {
                  const hiddenParts = allParts.filter(p => isHiddenFromCustomer(p));
                  if (hiddenParts.length === 0) return null;
                  let totalHiddenCost = 0;
                  const rows = hiddenParts.map(p => {
                    const fd = p.formData || {};
                    const qty = parseInt(p.quantity) || 1;
                    const baseLabor = parseFloat(p._baseLaborTotal) || parseFloat(fd._baseLaborTotal) || 0;
                    const matCost = parseFloat(p.materialTotal) || 0;
                    let opCostLot = 0;
                    (p.outsideProcessing || []).forEach(op => {
                      const c = parseFloat(op.costPerPart) || 0;
                      const e = parseFloat(op.expediteCost) || 0;
                      opCostLot += (c + e) * qty;
                    });
                    const partInternalCost = (baseLabor + matCost) * qty + opCostLot;
                    totalHiddenCost += partInternalCost;
                    const vendor = (p.outsideProcessing || []).map(op => op.vendorName).filter(Boolean).join(', ');
                    const desc = fd._materialDescription || p.materialDescription || PART_TYPES[p.partType]?.label || p.partType;
                    return { p, qty, vendor, desc, partInternalCost };
                  });
                  return (
                    <div style={{ marginTop: 24, padding: 16, background: '#FFEBEE', borderRadius: 10, border: '2px solid #EF5350' }}>
                      <h4 style={{ margin: '0 0 4px', color: '#c62828', fontSize: '1rem' }}>🔒 Internal Costs (Hidden from Customer)</h4>
                      <p style={{ fontSize: '0.75rem', color: '#666', margin: '0 0 12px' }}>
                        Parts marked as hidden don't appear on the customer-facing estimate or PDF. Their cost reduces your profit margin.
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#FFCDD2' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left' }}>#</th>
                            <th style={{ padding: '6px 10px', textAlign: 'left' }}>Part</th>
                            <th style={{ padding: '6px 10px', textAlign: 'left' }}>Vendor</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right' }}>Qty</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right' }}>Internal Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(r => (
                            <tr key={r.p.id} style={{ borderBottom: '1px solid #FFCDD2' }}>
                              <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.p.partNumber}</td>
                              <td style={{ padding: '6px 10px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.desc}</td>
                              <td style={{ padding: '6px 10px', color: '#c62828' }}>{r.vendor || '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right' }}>{r.qty}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#c62828' }}>{formatCurrency(r.partInternalCost)}</td>
                            </tr>
                          ))}
                          <tr style={{ background: '#FFCDD2', fontWeight: 700 }}>
                            <td colSpan={4} style={{ padding: '8px 10px', color: '#c62828' }}>Total Internal Cost (reduces your profit)</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#c62828' }}>{formatCurrency(totalHiddenCost)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {allParts.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h4 style={{ marginBottom: 12, fontSize: '0.95rem' }}>Per-Part Breakdown</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f5f5f5' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>#</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Part</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Qty</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Material</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Labor</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Outside</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #ddd', fontWeight: 700 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allParts.sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0)).map(p => {
                            const fd = p.formData && typeof p.formData === 'object' ? p.formData : {};
                            const qty = parseInt(p.quantity) || 1;
                            const mat = parseFloat(p.materialTotal) || 0;
                            const matMk = parseFloat(p.materialMarkupPercent) || 0;
                            const matBilled = Math.round(mat * (1 + matMk / 100) * 100) / 100;
                            const labor = parseFloat(p.laborTotal) || 0;
                            // Read outside processing from JSONB array (new architecture)
                            const ops = p.outsideProcessing || [];
                            let opBilledLot = 0;
                            ops.forEach(op => {
                              const c = parseFloat(op.costPerPart) || 0;
                              const e = parseFloat(op.expediteCost) || 0;
                              const m = parseFloat(op.markup) || 0;
                              opBilledLot += ((c * (1 + m / 100)) + e) * qty;
                            });
                            const total = parseFloat(p.partTotal) || 0;
                            const desc = fd._materialDescription || p.materialDescription || PART_TYPES[p.partType]?.label || p.partType;
                            return (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.partNumber}</td>
                                <td style={{ padding: '8px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{qty}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{matBilled > 0 ? formatCurrency(matBilled * qty) : '—'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{labor > 0 ? formatCurrency(labor * qty) : '—'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{opBilledLot > 0 ? formatCurrency(opBilledLot) : '—'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(total)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Part Type Picker Modal */}
      {showPartTypePicker && (
        <div className="modal-overlay" onClick={() => setShowPartTypePicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <h3>Select Part Type</h3>
              <button className="btn btn-icon" onClick={() => setShowPartTypePicker(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {Object.entries(PART_TYPES).map(([key, { label, icon, desc }]) => (
                  <div
                    key={key}
                    onClick={() => handleSelectPartType(key)}
                    style={{
                      padding: '12px 8px', borderRadius: 10, border: '2px solid #e0e0e0', cursor: 'pointer',
                      transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      textAlign: 'center', gap: 4
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1976d2'; e.currentTarget.style.background = '#e3f2fd'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'white'; }}
                  >
                    <span style={{ fontSize: '1.6rem' }}>{icon}</span>
                    <strong style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>{label}</strong>
                    <span style={{ fontSize: '0.7rem', color: '#888', lineHeight: 1.2 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Part Modal */}
      {showPartModal && (
        <div className="modal-overlay">
          <div className="modal modal-flex" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>
                {editingPart ? 'Edit Part' : 'Add Part'} — {PART_TYPES[selectedPartType]?.icon} {PART_TYPES[selectedPartType]?.label || selectedPartType}
              </h3>
              <button className="btn btn-icon" onClick={() => setShowPartModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">

              {/* Validation errors */}
              {partFormError && partFormError.length > 0 && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  {partFormError.map((w, i) => <div key={i}>⚠️ {w}</div>)}
                </div>
              )}

              {/* Common fields for types that have their own form */}
              {!['plate_roll', 'shaped_plate', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'cone_roll', 'tee_bar', 'press_brake', 'fab_service', 'shop_rate', 'rush_service'].includes(selectedPartType) && (
              <div className="grid grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Client Part Number</label>
                  <input type="text" className="form-input" value={partData.clientPartNumber || ''} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Heat Number</label>
                  <HeatNumberInput partData={partData} setPartData={setPartData} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Cut File Reference <span style={{ fontWeight: 400, color: '#999' }}>(DXF/STEP filename for vendor)</span></label>
                  <input type="text" className="form-input" value={partData.cutFileReference || ''} onChange={(e) => setPartData({ ...partData, cutFileReference: e.target.value })} placeholder="e.g. Part2_cutout.dxf" />
                </div>
              </div>
              )}

              {/* Type-specific form */}
              {selectedPartType === 'flat_stock' ? (
                <div className="grid grid-2">
                  <FlatStockForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'plate_roll' ? (
                <div className="grid grid-2">
                  <PlateRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'shaped_plate' ? (
                <div className="grid grid-2">
                  <ShapedPlateForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'angle_roll' ? (
                <div className="grid grid-2">
                  <AngleRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'pipe_roll' ? (
                <div className="grid grid-2">
                  <PipeRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'tube_roll' ? (
                <div className="grid grid-2">
                  <SquareTubeRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'flat_bar' ? (
                <div className="grid grid-2">
                  <FlatBarRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'channel_roll' ? (
                <div className="grid grid-2">
                  <ChannelRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'beam_roll' ? (
                <div className="grid grid-2">
                  <BeamRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'tee_bar' ? (
                <div className="grid grid-2">
                  <TeeBarRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'press_brake' ? (
                <div className="grid grid-2">
                  <PressBrakeForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'cone_roll' ? (
                <div className="grid grid-2">
                  <ConeRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'fab_service' ? (
                <div className="grid grid-2">
                  <FabServiceForm partData={partData} setPartData={setPartData} estimateParts={order?.parts || []} showMessage={showMessage} setError={setError} />
                </div>
              ) : selectedPartType === 'shop_rate' ? (
                <div className="grid grid-2">
                  <ShopRateForm partData={partData} setPartData={setPartData} />
                </div>
              ) : selectedPartType === 'rush_service' ? (
                <div className="grid grid-2">
                  <RushServiceForm partData={partData} setPartData={setPartData} />
                </div>
              ) : (
                /* Generic form for 'other' part type */
                <div className="grid grid-2">
                  <div className="form-group"><label className="form-label">Quantity *</label><input type="number" className="form-input" value={partData.quantity} onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} onFocus={(e) => e.target.select()} min="1" /></div>
                  {PART_TYPES[selectedPartType]?.fields.includes('material') && <div className="form-group"><label className="form-label">Material</label><input className="form-input" value={partData.material || ''} onChange={(e) => setPartData({ ...partData, material: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('thickness') && <div className="form-group"><label className="form-label">Thickness</label><input className="form-input" value={partData.thickness || ''} onChange={(e) => setPartData({ ...partData, thickness: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('width') && <div className="form-group"><label className="form-label">Width</label><input className="form-input" value={partData.width || ''} onChange={(e) => setPartData({ ...partData, width: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('length') && <div className="form-group"><label className="form-label">Length</label><input className="form-input" value={partData.length || ''} onChange={(e) => setPartData({ ...partData, length: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('sectionSize') && <div className="form-group"><label className="form-label">Section Size</label><input className="form-input" value={partData.sectionSize || ''} onChange={(e) => setPartData({ ...partData, sectionSize: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('outerDiameter') && <div className="form-group"><label className="form-label">Outer Diameter</label><input className="form-input" value={partData.outerDiameter || ''} onChange={(e) => setPartData({ ...partData, outerDiameter: e.target.value })} /></div>}
                  {PART_TYPES[selectedPartType]?.fields.includes('wallThickness') && <div className="form-group"><label className="form-label">Wall Thickness</label><input className="form-input" value={partData.wallThickness || ''} onChange={(e) => setPartData({ ...partData, wallThickness: e.target.value })} /></div>}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Special Instructions</label><textarea className="form-textarea" value={partData.specialInstructions || ''} onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} /></div>
                </div>
              )}

              {/* Cut File Reference — always visible for all part types */}
              <div style={{ marginTop: 12, padding: '12px 0', borderTop: '1px solid #eee' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">📐 Cut File Reference <span style={{ fontWeight: 400, color: '#999' }}>(DXF/STEP filename to send to vendor)</span></label>
                  <input type="text" className="form-input" value={partData.cutFileReference || ''} onChange={(e) => setPartData({ ...partData, cutFileReference: e.target.value })} placeholder="e.g. Part2_cutout.dxf — will appear on purchase order" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPartModal(false)}>Cancel</button>
              {!editingPart && (
                <button className="btn btn-outline" onClick={() => handleSavePart(true)} disabled={saving || !selectedPartType}
                  style={{ borderColor: '#1976d2', color: '#1976d2' }}>
                  {saving ? 'Saving...' : 'Save & Add Another'}
                </button>
              )}
              <button className="btn btn-primary" onClick={() => handleSavePart(false)} disabled={saving || !selectedPartType}>{saving ? 'Saving...' : editingPart ? 'Update Part' : 'Add Part'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup Modal */}
      {showPickupModal && (
        <div className="modal-overlay" onClick={() => { setShowPickupModal(false); setPickupData({ pickedUpBy: '', type: null, items: {} }); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Truck size={22} /> Record Pickup</h3>
              <button className="btn btn-icon" onClick={() => { setShowPickupModal(false); setPickupData({ pickedUpBy: '', type: null, items: {} }); }}><X size={20} /></button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Step 1: Picked Up By */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Picked Up By</label>
                <input className="form-input" value={pickupData.pickedUpBy} 
                  onChange={(e) => setPickupData(prev => ({ ...prev, pickedUpBy: e.target.value }))} 
                  placeholder="Name of person picking up" />
              </div>

              {/* Step 2: Full or Partial */}
              {!pickupData.type && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn" onClick={() => setPickupData(prev => ({ ...prev, type: 'full' }))}
                    style={{ flex: 1, padding: 20, background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 8, cursor: 'pointer', textAlign: 'center' }}>
                    <Package size={28} style={{ color: '#2e7d32', marginBottom: 6 }} /><br />
                    <strong style={{ fontSize: '1rem' }}>Full Pickup</strong><br />
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>All items picked up</span>
                  </button>
                  <button className="btn" onClick={() => {
                    const items = {};
                    order.parts?.forEach(p => { items[p.id] = { qty: 0 }; });
                    setPickupData(prev => ({ ...prev, type: 'partial', items }));
                  }}
                    style={{ flex: 1, padding: 20, background: '#fff3e0', border: '2px solid #ff9800', borderRadius: 8, cursor: 'pointer', textAlign: 'center' }}>
                    <FileText size={28} style={{ color: '#e65100', marginBottom: 6 }} /><br />
                    <strong style={{ fontSize: '1rem' }}>Partial Pickup</strong><br />
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Select specific items</span>
                  </button>
                </div>
              )}

              {/* Full Pickup Confirmation */}
              {pickupData.type === 'full' && (() => {
                const summary = getPickupSummary();
                const remaining = summary.filter(p => p.remaining > 0);
                const allAlreadyPicked = remaining.length === 0;
                return (
                <div>
                  {allAlreadyPicked ? (
                    <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>
                      <strong style={{ color: '#666' }}>All items have already been picked up.</strong>
                    </div>
                  ) : (
                    <div style={{ background: '#e8f5e9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                      <strong style={{ color: '#2e7d32' }}>Pick Up Remaining — {remaining.length} item{remaining.length > 1 ? 's' : ''}</strong>
                      <div style={{ marginTop: 8 }}>
                        {remaining.map(p => (
                          <div key={p.id} style={{ fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid #c8e6c9', display: 'flex', justifyContent: 'space-between' }}>
                            <span><strong>#{p.partNumber}</strong> {PART_TYPES[p.partType]?.label || p.partType}</span>
                            <span style={{ fontWeight: 600 }}>
                              {p.remaining} of {p.totalQty}
                              {p.picked > 0 && <span style={{ color: '#888', fontWeight: 400, marginLeft: 6 }}>({p.picked} already shipped)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={() => setPickupData(prev => ({ ...prev, type: null }))}>Back</button>
                    <button className="btn btn-success" onClick={handlePickup} disabled={saving || allAlreadyPicked}>
                      <Check size={18} /> {saving ? 'Processing...' : 'Confirm Pickup'}
                    </button>
                  </div>
                </div>
                );
              })()}

              {/* Partial Pickup Selection */}
              {pickupData.type === 'partial' && (
                <div>
                  <div style={{ background: '#fff3e0', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
                    Enter the quantity being shipped for each part. Linked services auto-follow their parent.
                  </div>
                  
                  {(() => {
                    const summary = getPickupSummary();
                    // Build linked services map: parentId -> [child parts]
                    const linkedMap = {};
                    summary.forEach(p => {
                      const fd = p.formData && typeof p.formData === 'object' ? p.formData : {};
                      const linkedTo = fd._linkedPartId || p._linkedPartId;
                      if (linkedTo && ['fab_service', 'shop_rate'].includes(p.partType)) {
                        if (!linkedMap[linkedTo]) linkedMap[linkedTo] = [];
                        linkedMap[linkedTo].push(p);
                      }
                    });
                    const linkedChildIds = new Set(Object.values(linkedMap).flat().map(c => c.id));

                    return summary.filter(p => !linkedChildIds.has(p.id)).map(p => {
                      const item = pickupData.items[p.id] || { qty: 0 };
                      const maxQty = p.remaining;
                      const fd = p.formData && typeof p.formData === 'object' ? p.formData : {};
                      const desc = fd._materialDescription || p.materialDescription || PART_TYPES[p.partType]?.label || p.partType;
                      const linkedChildren = linkedMap[p.id] || [];
                      return (
                        <div key={p.id}>
                          <div style={{ 
                            padding: 12, marginBottom: linkedChildren.length > 0 ? 0 : 6, borderRadius: linkedChildren.length > 0 ? '8px 8px 0 0' : 8, 
                            border: (parseInt(item.qty) || 0) > 0 ? '2px solid #ff9800' : '1px solid #eee',
                            borderBottom: linkedChildren.length > 0 ? 'none' : undefined,
                            background: maxQty === 0 ? '#f5f5f5' : (parseInt(item.qty) || 0) > 0 ? '#fff8e1' : 'white',
                            opacity: maxQty === 0 ? 0.5 : 1,
                            display: 'flex', alignItems: 'center', gap: 12
                          }}>
                            <div style={{ minWidth: 65 }}>
                              <input type="number" min="0" max={maxQty} disabled={maxQty === 0}
                                value={item.qty || ''}
                                onChange={(e) => {
                                  let val = parseInt(e.target.value) || 0;
                                  if (val > maxQty) val = maxQty;
                                  if (val < 0) val = 0;
                                  // Auto-set linked services to same qty
                                  const updates = { [p.id]: { qty: val } };
                                  linkedChildren.forEach(child => {
                                    const childMax = child.remaining;
                                    updates[child.id] = { qty: Math.min(val, childMax) };
                                  });
                                  setPickupData(prev => ({ ...prev, items: { ...prev.items, ...updates } }));
                                }}
                                onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                placeholder="0"
                                style={{ width: 60, padding: '6px 4px', textAlign: 'center', border: '2px solid #ddd', borderRadius: 6, fontWeight: 700, fontSize: '1rem' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div><strong>#{p.partNumber}</strong> {p.clientPartNumber && <span style={{ color: '#1976d2' }}>{p.clientPartNumber}</span>}</div>
                              <div style={{ fontSize: '0.8rem', color: '#555' }}>{desc}</div>
                              <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                Total: {p.totalQty} | Shipped: {p.picked} | <strong style={{ color: maxQty > 0 ? '#e65100' : '#999' }}>Remaining: {maxQty}</strong>
                              </div>
                            </div>
                          </div>
                          {/* Linked services shown indented */}
                          {linkedChildren.map(child => {
                            const childItem = pickupData.items[child.id] || { qty: 0 };
                            const childFd = child.formData && typeof child.formData === 'object' ? child.formData : {};
                            return (
                              <div key={child.id} style={{
                                padding: '8px 12px 8px 40px', marginBottom: 6,
                                borderRadius: '0 0 8px 8px',
                                border: (parseInt(item.qty) || 0) > 0 ? '2px solid #ff9800' : '1px solid #eee',
                                borderTop: '1px dashed #ddd',
                                background: (parseInt(childItem.qty) || 0) > 0 ? '#f5f5f5' : '#fafafa',
                                display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem'
                              }}>
                                <span style={{ color: '#9e9e9e' }}>↳</span>
                                <span style={{ fontWeight: 600, color: '#666' }}>#{child.partNumber}</span>
                                <span style={{ color: '#888' }}>{PART_TYPES[child.partType]?.label || child.partType}</span>
                                {childFd._serviceType && <span style={{ color: '#888' }}>— {childFd._serviceType}</span>}
                                <span style={{ marginLeft: 'auto', fontWeight: 700, color: (parseInt(childItem.qty) || 0) > 0 ? '#e65100' : '#999' }}>
                                  {parseInt(childItem.qty) || 0}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: '#999' }}>auto</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                  
                  {(() => {
                    const summary = getPickupSummary();
                    const totalShipping = summary.reduce((s, p) => s + (parseInt(pickupData.items[p.id]?.qty) || 0), 0);
                    return (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: totalShipping > 0 ? '#e65100' : '#999' }}>
                          {totalShipping > 0 ? `📦 Shipping ${totalShipping} item${totalShipping > 1 ? 's' : ''}` : 'Enter quantities to ship'}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {pickupData._fromShipPartial ? null : <button className="btn btn-secondary" onClick={() => setPickupData(prev => ({ ...prev, type: null }))}>Back</button>}
                          <button className="btn" onClick={handlePickup} disabled={saving || totalShipping === 0}
                            style={{ background: totalShipping > 0 ? '#ff9800' : '#ccc', color: 'white', border: 'none' }}>
                            <Check size={18} /> {saving ? 'Processing...' : 'Record Partial Pickup'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Arrange Parts Modal */}
      {reorderMode && (
        <div className="modal-overlay" onClick={() => setReorderMode(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>↕️ Arrange Parts</h3>
              <button className="btn btn-icon" onClick={() => setReorderMode(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 12 }}>
                Drag parts into the order you want. Linked services follow their parent.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {reorderParts.map((part, idx) => {
                  const fd = part.formData && typeof part.formData === 'object' ? part.formData : {};
                  const desc = fd._materialDescription || part.materialDescription || PART_TYPES[part.partType]?.label || part.partType;
                  const linkedServices = (order.parts || []).filter(sp => {
                    const lid = sp._linkedPartId || (sp.formData || {})._linkedPartId;
                    return lid && String(lid) === String(part.id) && ['fab_service', 'shop_rate'].includes(sp.partType);
                  });
                  return (
                    <div key={part.id}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        background: '#fff', border: '2px solid #e0e0e0', borderRadius: 8, marginBottom: 4,
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button onClick={() => {
                            if (idx === 0) return;
                            const arr = [...reorderParts];
                            [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
                            setReorderParts(arr);
                          }} disabled={idx === 0}
                            style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: idx === 0 ? 'default' : 'pointer', padding: '4px 8px', color: idx === 0 ? '#ddd' : '#333', fontSize: '1rem', lineHeight: 1 }}>
                            ▲
                          </button>
                          <button onClick={() => {
                            if (idx === reorderParts.length - 1) return;
                            const arr = [...reorderParts];
                            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                            setReorderParts(arr);
                          }} disabled={idx === reorderParts.length - 1}
                            style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: idx === reorderParts.length - 1 ? 'default' : 'pointer', padding: '4px 8px', color: idx === reorderParts.length - 1 ? '#ddd' : '#333', fontSize: '1rem', lineHeight: 1 }}>
                            ▼
                          </button>
                        </div>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1976d2', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>
                            {PART_TYPES[part.partType]?.icon} {PART_TYPES[part.partType]?.label || part.partType}
                            {part.clientPartNumber && <span style={{ color: '#1976d2', marginLeft: 6 }}>{part.clientPartNumber}</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {desc.replace(/^\d+pc:\s*/i, '')}
                          </div>
                        </div>
                      </div>
                      {linkedServices.map(sp => (
                        <div key={sp.id} style={{ marginLeft: 56, padding: '4px 12px', fontSize: '0.8rem', color: '#7b1fa2', background: '#f3e5f5', borderRadius: 4, marginBottom: 4, marginTop: -2 }}>
                          ↳ {PART_TYPES[sp.partType]?.label} {(sp.formData || {})._serviceType ? `— ${(sp.formData || {})._serviceType}` : ''}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => setReorderMode(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={async () => {
                  try {
                    // Build full order: reorderParts + their linked services interleaved
                    const fullOrder = [];
                    reorderParts.forEach(rp => {
                      fullOrder.push(rp.id);
                      (order.parts || []).forEach(sp => {
                        const lid = sp._linkedPartId || (sp.formData || {})._linkedPartId;
                        if (lid && String(lid) === String(rp.id) && ['fab_service', 'shop_rate'].includes(sp.partType)) {
                          fullOrder.push(sp.id);
                        }
                      });
                    });
                    // Add any orphan parts not in fullOrder
                    (order.parts || []).forEach(p => { if (!fullOrder.includes(p.id)) fullOrder.push(p.id); });
                    await reorderWorkOrderParts(id, fullOrder);
                    await loadOrder();
                    setReorderMode(false);
                    showMessage('Parts rearranged');
                  } catch { setError('Failed to rearrange parts'); }
                }}>
                  <Check size={16} /> Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Order Services Modal */}
      {showServicesModal && (() => {
        const groups = getServiceOrderableGroups();
        const groupKeys = Object.keys(groups);
        const selectedTotal = groupKeys
          .filter(k => serviceModalSelected.has(k))
          .reduce((sum, k) => sum + groups[k].totalCost, 0);
        const selectedCount = serviceModalSelected.size;
        return (
          <div className="modal-overlay" onClick={() => !serviceModalSubmitting && setShowServicesModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
              <div className="modal-header" style={{ background: '#E0F2F1', borderBottom: '2px solid #00897B' }}>
                <h3 style={{ color: '#00695C', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🏭 Order Services from Outside Vendors
                </h3>
                <button className="btn btn-icon" onClick={() => !serviceModalSubmitting && setShowServicesModal(false)}><X size={20} /></button>
              </div>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: 0, marginBottom: 16 }}>
                  Generates one PO per vendor for Fab Service parts that have a vendor and cost set but no PO yet.
                  Hidden parts (Rolling Assist) are marked with 🔒 and won't appear on customer-facing documents.
                </p>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Starting PO Number *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: '#00695C' }}>PO</span>
                    <input
                      type="number"
                      className="form-input"
                      value={servicesStartingPONumber}
                      onChange={(e) => setServicesStartingPONumber(e.target.value)}
                      placeholder="7765"
                      style={{ maxWidth: 150 }}
                    />
                  </div>
                  {serviceModalSelected.size > 1 && servicesStartingPONumber && (
                    <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                      Will create: {Array.from(serviceModalSelected).map((_, i) => `PO${parseInt(servicesStartingPONumber) + i}`).join(', ')}
                    </p>
                  )}
                </div>

                {groupKeys.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                    No service operations available to PO. Make sure Fab Service parts have a vendor and cost set.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {groupKeys.map(vendorId => {
                      const group = groups[vendorId];
                      const isSelected = serviceModalSelected.has(vendorId);
                      return (
                        <div key={vendorId} style={{
                          border: '2px solid ' + (isSelected ? '#00897B' : '#e0e0e0'),
                          borderRadius: 8,
                          background: isSelected ? '#E0F2F1' : '#fafafa',
                          padding: 12
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(serviceModalSelected);
                                if (e.target.checked) next.add(vendorId);
                                else next.delete(vendorId);
                                setServiceModalSelected(next);
                              }}
                              style={{ width: 18, height: 18 }}
                            />
                            <strong style={{ flex: 1, fontSize: '1rem', color: '#00695C' }}>
                              {group.vendorName}
                              {group.hasHidden && (
                                <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#C62828', fontWeight: 700, padding: '2px 6px', background: '#FFEBEE', borderRadius: 3, border: '1px solid #EF5350' }}>
                                  🔒 HIDDEN
                                </span>
                              )}
                            </strong>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#00695C' }}>
                              ${group.totalCost.toFixed(2)}
                            </span>
                          </label>
                          <div style={{ paddingLeft: 28, fontSize: '0.8rem', color: '#555' }}>
                            {group.parts.map((gp, idx) => {
                              const cost = parseFloat(gp.op.costPerPart) || 0;
                              const desc = (gp.part.formData && gp.part.formData._materialDescription) || gp.part.materialDescription || gp.op.serviceType || 'Service';
                              return (
                                <div key={idx} style={{ padding: '2px 0' }}>
                                  • Part #{gp.part.partNumber} — {desc} × {gp.qty} @ ${cost.toFixed(2)}/ea = ${gp.lineCost.toFixed(2)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedCount > 0 && (
                  <div style={{ padding: 12, background: '#E0F2F1', borderRadius: 6, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#00695C' }}>
                      {selectedCount} vendor{selectedCount === 1 ? '' : 's'} selected
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: '#00695C' }}>${selectedTotal.toFixed(2)}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => setShowServicesModal(false)} disabled={serviceModalSubmitting}>
                    Cancel
                  </button>
                  <button
                    className="btn"
                    style={{ background: '#00897B', color: 'white' }}
                    disabled={serviceModalSubmitting || selectedCount === 0}
                    onClick={async () => {
                      if (selectedCount === 0) return;
                      if (!servicesStartingPONumber || parseInt(servicesStartingPONumber) <= 0) {
                        setError('Please enter a valid starting PO number');
                        return;
                      }
                      setServiceModalSubmitting(true);
                      try {
                        const vendorIds = Array.from(serviceModalSelected);
                        const res = await createServicePOsAuto(id, vendorIds, servicesStartingPONumber);
                        const data = res.data?.data || {};
                        const created = data.created || [];
                        const errors = data.errors || [];
                        if (errors.length > 0) {
                          setError(`Created ${created.length} PO(s), ${errors.length} failed: ${errors.map(e => e.vendorName + ': ' + e.error).join('; ')}`);
                        } else {
                          showMessage(res.data?.message || `Created ${created.length} service PO(s)`);
                        }
                        setShowServicesModal(false);
                        setServiceModalSelected(new Set());
                        setServicesStartingPONumber('');
                        await loadOrder();
                      } catch (err) {
                        setError('Failed to create service POs: ' + (err.response?.data?.error?.message || err.message));
                      } finally {
                        setServiceModalSubmitting(false);
                      }
                    }}
                  >
                    {serviceModalSubmitting ? '⏳ Creating POs...' : `🏭 Create ${selectedCount} PO${selectedCount === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Order Material Modal */}
      {showOrderModal && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={24} />
                Order Material
              </h3>
              <button className="btn btn-icon" onClick={() => setShowOrderModal(false)}><X size={20} /></button>
            </div>
            
            <div style={{ padding: 20 }}>
              <div style={{ background: '#e3f2fd', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <strong>DR-{order.drNumber}</strong> • {order.clientName}
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Starting PO Number *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1976d2' }}>PO</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={orderPONumber}
                    onChange={(e) => setOrderPONumber(e.target.value)}
                    placeholder="7765" 
                    style={{ maxWidth: 150 }} 
                  />
                </div>
                {Object.keys(getSupplierGroups()).length > 1 && (
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                    Will create: {Object.keys(getSupplierGroups()).map((s, i) => `PO${parseInt(orderPONumber) + i}`).join(', ')}
                  </p>
                )}
              </div>

              <h4 style={{ marginBottom: 12 }}>Select Materials to Order:</h4>
              {Object.entries(getSupplierGroups()).map(([supplier, supplierParts], idx) => (
                <div key={supplier} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12, marginBottom: 12, background: '#f9f9f9' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#e65100' }}>🏭 {supplier}</div>
                  {supplierParts.map(part => (
                    <label key={part.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 8, cursor: 'pointer', background: 'white', borderRadius: 4, marginBottom: 4 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedPartIds.includes(part.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPartIds([...selectedPartIds, part.id]);
                          else setSelectedPartIds(selectedPartIds.filter(pid => pid !== part.id));
                        }}
                        style={{ marginTop: 4 }} 
                      />
                      <div style={{ flex: 1 }}>
                        <div><strong>Part #{part.partNumber}:</strong> {part.materialDescription || part.partType}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Qty: {(part.formData || {})?._stockLengthsNeeded || part.quantity}{(part.formData || {})?._stockLengthsNeeded ? ` lengths (${part.quantity} rings)` : ''}</div>
                      </div>
                    </label>
                  ))}
                  <div style={{ background: '#e3f2fd', borderRadius: 4, padding: 8, marginTop: 8 }}>
                    <strong style={{ color: '#1976d2' }}>PO{parseInt(orderPONumber) + idx}</strong>
                    <span style={{ marginLeft: 12, fontSize: '0.8rem', color: '#388e3c' }}>→ Creates Inbound + Purchase Order</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>Cancel</button>
              <button 
                className="btn" 
                style={{ background: '#ff9800', color: 'white' }}
                onClick={handleOrderMaterial}
                disabled={ordering || !orderPONumber || selectedPartIds.length === 0}
              >
                <ShoppingCart size={16} />
                {ordering ? 'Creating...' : `Create ${Object.keys(getSupplierGroups()).length} PO(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Estimate Modal */}
      {showLinkEstimateModal && (
        <div className="modal-overlay" onClick={() => setShowLinkEstimateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link2 size={24} />
                Link Estimate to Work Order
              </h3>
              <button className="btn-close" onClick={() => setShowLinkEstimateModal(false)}><X size={20} /></button>
            </div>
            
            <div style={{ padding: 20 }}>
              <p style={{ color: '#666', marginBottom: 16, fontSize: '0.9rem' }}>
                Search for an estimate to link. All parts, pricing, and client info will be copied to this work order.
              </p>
              
              <input
                className="form-input"
                placeholder="Search by client name, estimate number, or description..."
                value={estimateSearchQuery}
                onChange={(e) => handleSearchEstimates(e.target.value)}
                autoFocus
                style={{ marginBottom: 16 }}
              />

              {searchingEstimates && (
                <p style={{ color: '#666', textAlign: 'center', padding: 20 }}>Searching...</p>
              )}

              {!searchingEstimates && estimateSearchQuery.length >= 2 && estimateSearchResults.length === 0 && (
                <p style={{ color: '#999', textAlign: 'center', padding: 20 }}>No matching estimates found</p>
              )}

              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {estimateSearchResults.map(est => (
                  <div key={est.id} style={{ 
                    border: '1px solid #e0e0e0', borderRadius: 8, padding: 14, marginBottom: 8,
                    cursor: 'pointer', transition: 'background 0.2s',
                    ':hover': { background: '#f5f5f5' }
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f3e5f5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    onClick={() => handleLinkEstimate(est.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#7b1fa2' }}>{est.estimateNumber}</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 500, marginTop: 2 }}>{est.clientName}</div>
                        {est.contactName && (
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>Contact: {est.contactName}</div>
                        )}
                        {est.projectDescription && (
                          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 2 }}>{est.projectDescription}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#2e7d32' }}>
                          {est.grandTotal ? `$${parseFloat(est.grandTotal).toFixed(2)}` : '-'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{est.partCount} part(s)</div>
                        <div style={{ fontSize: '0.8rem', color: '#999' }}>{new Date(est.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {linkingEstimate && (
                <div style={{ textAlign: 'center', padding: 20, color: '#7b1fa2' }}>
                  Linking estimate and copying parts...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link Shipment Modal */}
      {showLinkShipmentModal && (
        <div className="modal-overlay" onClick={() => setShowLinkShipmentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '90vw', maxWidth: 650, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={18} /> Link Unlinked Shipment
              </h3>
              <button className="modal-close" onClick={() => setShowLinkShipmentModal(false)}>&times;</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Filter by client name, job number, or QR code..."
                  value={shipmentSearchQuery}
                  onChange={(e) => setShipmentSearchQuery(e.target.value)}
                  autoFocus
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 8 }}>
                {filteredUnlinkedShipments.length} unlinked shipment{filteredUnlinkedShipments.length !== 1 ? 's' : ''} waiting for instructions
              </div>
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {filteredUnlinkedShipments.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>No unlinked shipments found</div>
                )}
                {filteredUnlinkedShipments.map(s => (
                  <div
                    key={s.id}
                    onClick={() => !shipmentLinking && handleLinkShipment(s.id)}
                    style={{
                      padding: '12px 14px', borderBottom: '1px solid #eee', cursor: shipmentLinking ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      transition: 'background 0.15s', borderRadius: 6,
                      background: (s.clientName || '').toLowerCase() === (order?.clientName || '').toLowerCase() ? '#f0f7ff' : 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = (s.clientName || '').toLowerCase() === (order?.clientName || '').toLowerCase() ? '#f0f7ff' : 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#333' }}>{s.clientName}</span>
                        {(s.clientName || '').toLowerCase() === (order?.clientName || '').toLowerCase() && (
                          <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 700, background: '#e8f5e9', color: '#2e7d32' }}>
                            SAME CLIENT
                          </span>
                        )}
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#888' }}>{s.qrCode}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>
                        {s.quantity && <span>{s.quantity}pc</span>}
                        {s.jobNumber && <span> · Job: {s.jobNumber}</span>}
                        {s.clientPurchaseOrderNumber && <span> · PO: {s.clientPurchaseOrderNumber}</span>}
                        {s.location && <span> · 📍 {s.location}</span>}
                        {s.receivedAt && <span> · {new Date(s.receivedAt).toLocaleDateString()}</span>}
                      </div>
                      {s.description && (
                        <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.description}
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ padding: '4px 10px', background: '#1565c0', color: '#fff', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 }}>
                        Link
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COD Payment Confirmation Dialog */}
      {codConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setCodConfirmOpen(false); setCodShowOverride(false); }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 0, maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#c62828', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 4 }}>💰</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: 1 }}>COD — PAYMENT REQUIRED</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>{order?.clientName}</div>
            </div>

            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, textAlign: 'center', color: '#333' }}>
                Has this job been paid for?
              </p>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button className="btn" onClick={() => {
                  setCodConfirmOpen(false);
                  setCodShowOverride(false);
                  setPaymentForm({ date: new Date().toISOString().split('T')[0], method: '', reference: '' });
                  setPaymentDialogOpen(true);
                }} style={{ flex: 1, background: '#388E3C', color: 'white', border: 'none', padding: '14px', fontSize: '1rem', fontWeight: 700, borderRadius: 8 }}>
                  ✅ Yes — Record Payment
                </button>
                <button className="btn" onClick={() => {
                  setCodShowOverride(true);
                }} style={{ flex: 1, background: '#c62828', color: 'white', border: 'none', padding: '14px', fontSize: '1rem', fontWeight: 700, borderRadius: 8 }}>
                  ❌ No — Not Paid
                </button>
              </div>

              {codShowOverride && (
                <div style={{ background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 8, padding: 16, marginTop: 8 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#E65100', marginBottom: 8 }}>
                    ⚠️ This order has NOT been paid. Enter override password to proceed anyway:
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="password" className="form-input" placeholder="Override password" style={{ flex: 1 }}
                      value={codOverrideInput} onChange={e => setCodOverrideInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && codOverrideInput) {
                          if (codOverridePassword && codOverrideInput === codOverridePassword) {
                            setCodConfirmOpen(false); setCodShowOverride(false);
                            if (codAction === 'checklist') printPickupChecklist();
                            else if (codAction === 'pickup') setShowPickupModal(true);
                          } else { setError('Incorrect override password'); }
                        }
                      }} />
                    <button className="btn" onClick={() => {
                      if (codOverridePassword && codOverrideInput === codOverridePassword) {
                        setCodConfirmOpen(false); setCodShowOverride(false);
                        if (codAction === 'checklist') printPickupChecklist();
                        else if (codAction === 'pickup') setShowPickupModal(true);
                      } else { setError('Incorrect override password'); }
                    }} style={{ background: '#E65100', color: 'white', border: 'none', fontWeight: 600 }}>
                      Override
                    </button>
                  </div>
                  {!codOverridePassword && (
                    <p style={{ fontSize: '0.75rem', color: '#c62828', marginTop: 8 }}>
                      No override password set. Go to Admin → Users & Logs → System to configure one.
                    </p>
                  )}
                </div>
              )}

              <button onClick={() => { setCodConfirmOpen(false); setCodShowOverride(false); }} 
                style={{ width: '100%', marginTop: 12, padding: '10px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: '0.9rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Recording Dialog */}
      {paymentDialogOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setPaymentDialogOpen(false); setCodAction(null); }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 0, maxWidth: 460, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#388E3C', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 4 }}>💳</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: 1 }}>RECORD PAYMENT</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>{order?.clientName} — {order?.drNumber ? 'DR-' + order.drNumber : order?.orderNumber}</div>
            </div>

            <div style={{ padding: '24px' }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Payment Date</label>
                <input type="date" className="form-input" value={paymentForm.date}
                  onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Payment Method *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {['Check', 'Cash', 'Wire Transfer', 'Credit Card', 'ACH', 'Zelle'].map(method => (
                    <button key={method} onClick={() => setPaymentForm({ ...paymentForm, method })}
                      style={{
                        padding: '12px 8px', border: paymentForm.method === method ? '2px solid #388E3C' : '2px solid #ddd',
                        background: paymentForm.method === method ? '#E8F5E9' : 'white', borderRadius: 8, cursor: 'pointer',
                        fontWeight: paymentForm.method === method ? 700 : 400, fontSize: '0.9rem',
                        color: paymentForm.method === method ? '#2E7D32' : '#333'
                      }}>
                      {method === 'Check' && '📝 '}{method === 'Cash' && '💵 '}{method === 'Wire Transfer' && '🏦 '}
                      {method === 'Credit Card' && '💳 '}{method === 'ACH' && '🔄 '}{method === 'Zelle' && '⚡ '}
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  {paymentForm.method === 'Check' ? 'Check Number' : paymentForm.method === 'Wire Transfer' ? 'Wire Reference' : paymentForm.method === 'ACH' ? 'ACH Transaction ID' : paymentForm.method === 'Credit Card' ? 'Last 4 Digits / Auth Code' : 'Transaction ID / Reference'}
                </label>
                <input type="text" className="form-input" 
                  placeholder={paymentForm.method === 'Check' ? 'e.g. 4521' : paymentForm.method === 'Cash' ? 'Optional — receipt number' : 'e.g. TXN-12345'}
                  value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" onClick={handleRecordPayment} disabled={!paymentForm.method}
                  style={{ flex: 1, background: paymentForm.method ? '#388E3C' : '#ccc', color: 'white', border: 'none', padding: '14px', fontSize: '1rem', fontWeight: 700, borderRadius: 8 }}>
                  ✅ Confirm Payment
                </button>
                <button onClick={() => { setPaymentDialogOpen(false); setCodAction(null); }}
                  style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: '0.9rem' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* COC Modal */}
      {showCocModal && (
        <div className="modal-overlay"><div className="modal" style={{ maxWidth: 500 }}>
          <div className="modal-header">
            <h3 className="modal-title">📜 Certificate of Conformance</h3>
            <button className="modal-close" onClick={() => setShowCocModal(false)}>&times;</button>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 12, background: '#f3e5f5', borderRadius: 8, fontSize: '0.9rem' }}>
              <strong>DR-{order.drNumber}</strong> — {order.clientName}
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                {(order.parts || []).filter(p => !['fab_service','shop_rate','rush_service'].includes(p.partType)).length} part(s) will be included
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Certified By</label>
              <input className="form-input" value={cocCertifiedBy} onChange={e => setCocCertifiedBy(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={cocDate} onChange={e => setCocDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Attach Weld Procedure (WPS) <span style={{ fontWeight: 400, color: '#999' }}>— optional</span></label>
              <select className="form-select" value={cocWpsId} onChange={e => setCocWpsId(e.target.value)}
                onFocus={async () => {
                  if (cocWpsList.length === 0) {
                    try { const r = await getWeldProcedures(); setCocWpsList(r.data.data || []); } catch {}
                  }
                }}>
                <option value="">None — COC only</option>
                {cocWpsList.map(w => (
                  <option key={w.id} value={w.id}>{w.wpsNumber} — {w.name} ({w.process})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowCocModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={cocGenerating}
              onClick={async () => {
                try {
                  setCocGenerating(true);
                  const response = await generateCOC(order.id, {
                    wpsId: cocWpsId || null,
                    certifiedBy: cocCertifiedBy,
                    certDate: cocDate
                  });
                  const blob = new Blob([response.data], { type: 'application/pdf' });
                  const url = window.URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  setShowCocModal(false);
                  showMessage('COC generated & saved to documents');
                  await loadOrder();
                } catch (err) {
                  setError('Failed to generate COC');
                } finally { setCocGenerating(false); }
              }}
              style={{ background: '#6A1B9A' }}>
              {cocGenerating ? '⏳ Generating...' : '📜 Generate COC'}
            </button>
          </div>
        </div></div>
      )}

      {/* Delete Override Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header" style={{ background: '#b71c1c' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>🔒 Work Order Deletion Restricted</h3>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: 14, marginBottom: 18, fontSize: '0.9rem' }}>
                <strong>⚠️ This work order has a DR number.</strong>
                <div style={{ marginTop: 6, color: '#555' }}>
                  Deleting or voiding work orders affects financial records.
                  Contact your admin to void this work order, or enter an
                  override passcode to permanently delete it.
                </div>
              </div>
              <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: 12, fontSize: '0.85rem', color: '#b71c1c', fontWeight: 600, textAlign: 'center' }}>
                Contact admin to void this work order
              </div>
            </div>
            <div className="modal-footer" style={{ gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1 }}>
                Confirm — Do Not Delete
              </button>
              <button
                className="btn"
                onClick={handleDeleteOverride}
                style={{ flex: 1, background: '#b71c1c', color: 'white' }}>
                🔑 Input Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrderDetailsPage;
