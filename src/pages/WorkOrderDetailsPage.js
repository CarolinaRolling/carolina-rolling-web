import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Save, X, Trash2, Plus, Package, FileText, User, 
  Calendar, Printer, Check, Upload, Eye, Tag, Truck, MapPin, Clock, File, ShoppingCart, Download, Link2, Unlink
} from 'lucide-react';
import PlateRollForm from '../components/PlateRollForm';
import AngleRollForm from '../components/AngleRollForm';
import PipeRollForm from '../components/PipeRollForm';
import SquareTubeRollForm from '../components/SquareTubeRollForm';
import FlatBarRollForm from '../components/FlatBarRollForm';
import ChannelRollForm from '../components/ChannelRollForm';
import BeamRollForm from '../components/BeamRollForm';
import ConeRollForm from '../components/ConeRollForm';
import TeeBarRollForm from '../components/TeeBarRollForm';
import PressBrakeForm from '../components/PressBrakeForm';
import { 
  getWorkOrderById, updateWorkOrder, deleteWorkOrder,
  addWorkOrderPart, updateWorkOrderPart, deleteWorkOrderPart,
  uploadPartFiles, getPartFileSignedUrl, deletePartFile,
  uploadWorkOrderDocuments, getWorkOrderDocumentSignedUrl, deleteWorkOrderDocument,
  getShipmentByWorkOrderId, getNextPONumber, orderWorkOrderMaterial,
  searchVendors, searchLinkableEstimates, linkEstimateToWorkOrder, unlinkEstimateFromWorkOrder,
  searchClients, getSettings, getUnlinkedShipments, linkShipmentToWorkOrder, duplicateWorkOrderToEstimate
} from '../services/api';

const PART_TYPES = {
  plate_roll: { label: 'Plate Roll', icon: '🔩', desc: 'Flat plate rolling with arc calculator', fields: ['material', 'thickness', 'width', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  cone_roll: { label: 'Cone Layout', icon: '🔺', desc: 'Cone segment design with AutoCAD export', fields: ['material', 'thickness', 'width', 'length'] },
  angle_roll: { label: 'Angle Roll', icon: '📐', desc: 'Angle iron rolling', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  flat_bar: { label: 'Flat Bar', icon: '▬', desc: 'Flat bar bending', fields: ['material', 'thickness', 'width', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  pipe_roll: { label: 'Pipes/Tubes/Round', icon: '🔧', desc: 'Pipe, tube, and solid round bar bending', fields: ['material', 'outerDiameter', 'wallThickness', 'length', 'radius', 'diameter', 'arcDegrees'] },
  tube_roll: { label: 'Square & Rect Tubing', icon: '⬜', desc: 'Square and rectangular tube rolling', fields: ['material', 'sectionSize', 'thickness', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  channel_roll: { label: 'Channel', icon: '🔲', desc: 'C-channel rolling', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  beam_roll: { label: 'Beam', icon: '🏗️', desc: 'I-beam and H-beam rolling', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees', 'flangeOut'] },
  tee_bar: { label: 'Tee Bars', icon: '🇹', desc: 'Structural tee rolling', fields: ['material', 'sectionSize', 'length', 'rollType', 'radius', 'diameter', 'arcDegrees'] },
  press_brake: { label: 'Press Brake', icon: '⏏️', desc: 'Press brake forming from print', fields: ['material', 'thickness', 'width', 'length'] },
  flat_stock: { label: 'Flat Stock', icon: '📄', desc: 'Flat material cut to custom print', fields: ['material', 'thickness', 'width', 'length'] },
  fab_service: { label: 'Fabrication Service', icon: '🔥', desc: 'Welding, fitting, cut-to-fit services', fields: [] },
  shop_rate: { label: 'Shop Rate', icon: '⏱️', desc: 'Hourly rate — custom work', fields: [] },
  other: { label: 'Other', icon: '📦', desc: 'Custom or miscellaneous parts', fields: ['material', 'thickness', 'width', 'length', 'sectionSize', 'outerDiameter', 'wallThickness', 'rollType', 'radius', 'diameter', 'arcDegrees'] }
};

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)})${digits.slice(3)}`;
  return `(${digits.slice(0,3)})${digits.slice(3,6)}-${digits.slice(6)}`;
};

function WorkOrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showReceivingInfo, setShowReceivingInfo] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showPartModal, setShowPartModal] = useState(false);
  const [showPartTypePicker, setShowPartTypePicker] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partData, setPartData] = useState({});
  const [selectedPartType, setSelectedPartType] = useState('');
  const [partFormError, setPartFormError] = useState(null);  const [uploadingFiles, setUploadingFiles] = useState(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupData, setPickupData] = useState({ pickedUpBy: '' });
  const [showPrintMenu, setShowPrintMenu] = useState(false);
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
  const [defaultTaxRate, setDefaultTaxRate] = useState(9.75);
  const [showLinkShipmentModal, setShowLinkShipmentModal] = useState(false);
  const [unlinkedShipments, setUnlinkedShipments] = useState([]);
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState('');
  const [shipmentLinking, setShipmentLinking] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => { loadOrder(); loadLaborMinimums(); }, [id]);

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

  const loadOrder = async () => {
    try {
      setLoading(true);
      // Load admin default tax rate first
      const adminTaxRate = await loadDefaultTaxRate();
      const response = await getWorkOrderById(id);
      const data = response.data.data;
      setOrder(data);

      // Determine correct tax rate: WO stored > client-specific > admin default
      let effectiveTaxRate = adminTaxRate;
      if (data.taxRate) {
        effectiveTaxRate = parseFloat(data.taxRate);
      } else if (data.clientId) {
        // Try to get client-specific tax rate
        try {
          const clientRes = await searchClients(data.clientName || '');
          const clients = clientRes.data?.data || [];
          const client = clients.find(c => c.id === data.clientId);
          if (client?.customTaxRate) {
            effectiveTaxRate = parseFloat(client.customTaxRate) * 100;
          }
        } catch (e) { /* use admin default */ }
      }

      setEditData({
        clientId: data.clientId || null,
        clientName: data.clientName || '',
        clientPurchaseOrderNumber: data.clientPurchaseOrderNumber || '',
        jobNumber: data.jobNumber || '',
        contactName: data.contactName || '',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        storageLocation: data.storageLocation || '',
        notes: data.notes || '',
        receivedBy: data.receivedBy || '',
        requestedDueDate: data.requestedDueDate || '',
        promisedDate: data.promisedDate || '',
        // Pricing fields
        truckingDescription: data.truckingDescription || '',
        truckingCost: data.truckingCost || '',
        taxRate: effectiveTaxRate.toString(),
        // Minimum charge override
        minimumOverride: data.minimumOverride || false,
        minimumOverrideReason: data.minimumOverrideReason || '',
      });

      // Load linked shipment
      try {
        const shipmentResponse = await getShipmentByWorkOrderId(data.id);
        setShipment(shipmentResponse.data.data);
      } catch (shipErr) {
        setShipment(null);
      }
    } catch (err) {
      setError('Failed to load work order');
    } finally {
      setLoading(false);
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

  const getMinimumInfo = () => {
    let totalLabor = 0, totalMaterial = 0, highestMinimum = 0, highestMinRule = null;
    const EA_PRICED = ['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll'];
    const parts = order?.parts || [];

    parts.forEach(part => {
      if (!EA_PRICED.includes(part.partType)) return;
      const laborEach = parseFloat(part.laborTotal) || 0;
      const materialCost = parseFloat(part.materialTotal) || 0;
      const materialMarkup = parseFloat(part.materialMarkupPercent) || (part.formData?.materialMarkupPercent ? parseFloat(part.formData.materialMarkupPercent) : 0);
      const materialEach = materialCost * (1 + materialMarkup / 100);
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

  const handleDelete = async () => {
    if (!window.confirm('Delete this work order?')) return;
    try {
      await deleteWorkOrder(id);
      navigate('/inventory');
    } catch (err) {
      setError('Failed to delete');
    }
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
      const response = await getWorkOrderDocumentSignedUrl(id, documentId);
      window.open(response.data.data.url, '_blank');
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
    if (!window.confirm('Create a new estimate from this work order?\n\nAll part specs and labor will be copied. Material pricing will be cleared so you can get updated quotes.')) return;
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
      partType: type, clientPartNumber: '', heatNumber: '', quantity: 1,
      material: '', thickness: '', width: '', length: '',
      outerDiameter: '', wallThickness: '', rollType: '', radius: '', diameter: '',
      arcDegrees: '', sectionSize: '', flangeOut: false, specialInstructions: '',
      laborRate: '', laborHours: '', laborTotal: '', materialUnitCost: '', materialTotal: '',
      setupCharge: '', otherCharges: '', partTotal: '',
      materialSource: 'customer_supplied', vendorId: null, supplierName: '', materialDescription: '',
      weSupplyMaterial: false, materialMarkupPercent: 20, rollingCost: '',
      _rollValue: '', _rollMeasurePoint: 'inside', _rollMeasureType: 'diameter', _tangentLength: '',
      _materialOrigin: '', _rollingDescription: '', _materialDescription: '',
      _angleSize: '', _customAngleSize: '', _legOrientation: '',
      _lengthOption: '', _customLength: '',
      serviceDrilling: false, serviceDrillingCost: '', serviceDrillingVendor: '',
      serviceCutting: false, serviceCuttingCost: '', serviceCuttingVendor: '',
      serviceFitting: false, serviceFittingCost: '', serviceFittingVendor: '',
      serviceWelding: false, serviceWeldingCost: '', serviceWeldingVendor: '', serviceWeldingPercent: 100,
      otherServicesCost: '', otherServicesMarkupPercent: 15
    });
    setShowPartModal(true);
  };

  const openEditPartModal = (part) => {
    setEditingPart(part);
    setSelectedPartType(part.partType);
    setPartFormError(null);
    // Merge formData back into partData for editing
    const editData = { ...part, quantity: part.quantity || 1 };
    if (part.formData && typeof part.formData === 'object') {
      Object.assign(editData, part.formData);
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
      if (!partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
    }
    if (selectedPartType === 'flat_stock') {
      if (!partData.thickness) warnings.push('Thickness is required');
    }
    if (selectedPartType === 'angle_roll') {
      if (!partData._angleSize) warnings.push('Angle size is required');
      if (partData._angleSize === 'Custom' && !partData._customAngleSize) warnings.push('Custom angle size is required');
      if (!partData.thickness) warnings.push('Thickness is required');
      if (!partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
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
      if (!partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
    }
    if (selectedPartType === 'tube_roll') {
      if (!partData._tubeSize) warnings.push('Tube size is required');
      if (partData._tubeSize === 'Custom' && !partData._customTubeSize) warnings.push('Custom tube size is required');
      if (!partData.thickness) warnings.push('Wall thickness is required');
      if (!partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
      const tubeParts = (partData._tubeSize || '').split('x').map(Number);
      if (tubeParts.length === 2 && tubeParts[0] !== tubeParts[1] && !partData.rollType) {
        warnings.push('Roll Direction (Easy Way / Hard Way) is required');
      }
    }
    if (selectedPartType === 'flat_bar') {
      if (!partData._barSize) warnings.push('Flat bar size is required');
      if (partData._barSize === 'Custom' && !partData._customBarSize) warnings.push('Custom flat bar size is required');
      if (!partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
    }
    if (selectedPartType === 'channel_roll') {
      if (!partData._channelSize) warnings.push('Channel size is required');
      if (partData._channelSize === 'Custom' && !partData._customChannelSize) warnings.push('Custom channel size is required');
      if (!partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
    }
    if (selectedPartType === 'beam_roll') {
      if (!partData._beamSize) warnings.push('Beam size is required');
      if (partData._beamSize === 'Custom' && !partData._customBeamSize) warnings.push('Custom beam size is required');
      if (!partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
    }
    if (selectedPartType === 'tee_bar') {
      if (!partData._teeSize) warnings.push('Tee size is required');
      if (partData._teeSize === 'Custom' && !partData._customTeeSize) warnings.push('Custom tee size is required');
      if (!partData.rollType) warnings.push('Roll Direction is required');
      if (!partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value is required');
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
    if (!partData.quantity || parseInt(partData.quantity) < 1) warnings.push('Quantity must be at least 1');
    return warnings;
  };

  const handleSavePart = async () => {
    const warnings = validatePart();
    if (warnings.length > 0) { setPartFormError(warnings); return; }
    try {
      setSaving(true);
      setPartFormError(null);
      setError(null);
      
      // Build data matching estimate save flow
      const dataToSend = { partType: selectedPartType, ...partData, quantity: parseInt(partData.quantity) || 1 };
      
      // Sanitize ENUM fields - empty strings break Postgres ENUMs
      if (!dataToSend.rollType) dataToSend.rollType = null;
      if (!dataToSend.materialSource || !['we_order', 'customer_supplied'].includes(dataToSend.materialSource)) {
        dataToSend.materialSource = 'customer_supplied';
      }
      
      // Recalculate partTotal at save time for ea-priced parts
      const EA_PRICED = ['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll'];
      if (EA_PRICED.includes(selectedPartType)) {
        const qty = parseInt(dataToSend.quantity) || 1;
        const matCost = parseFloat(dataToSend.materialTotal) || 0;
        const matMarkup = parseFloat(dataToSend.materialMarkupPercent) || 0;
        const matEach = matCost * (1 + matMarkup / 100);
        const labEach = parseFloat(dataToSend.laborTotal) || 0;
        dataToSend.partTotal = ((matEach + labEach) * qty).toFixed(2);
      }
      
      console.log('Saving part data:', dataToSend);
      if (editingPart) {
        await updateWorkOrderPart(id, editingPart.id, dataToSend);
      } else {
        await addWorkOrderPart(id, dataToSend);
      }
      await loadOrder();
      setShowPartModal(false);
      setEditingPart(null);
      setPartData({});
      setPartFormError(null);
      showMessage(editingPart ? 'Part updated' : 'Part added');
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

  const handleViewFile = async (partId, fileId) => {
    try {
      const response = await getPartFileSignedUrl(id, partId, fileId);
      window.open(response.url, '_blank');
    } catch (err) {
      setError('Failed to open file');
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
      const response = await updateWorkOrder(id, { 
        status: 'picked_up', 
        pickedUpBy: pickupData.pickedUpBy, 
        pickedUpAt: new Date().toISOString() 
      });
      console.log('Pickup response:', response);
      await loadOrder();
      setShowPickupModal(false);
      showMessage('Marked as picked up');
    } catch (err) {
      console.error('Pickup error:', err.response?.data || err);
      setError(err.response?.data?.error?.message || 'Failed to update - check console for details');
    }
  };

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

    const partsHtml = order.parts?.sort((a, b) => a.partNumber - b.partNumber).map(p => {
      // Merge formData if present
      const part = { ...p };
      if (part.formData && typeof part.formData === 'object') Object.assign(part, part.formData);

      const pdfFiles = part.files?.filter(f => f.mimeType === 'application/pdf' || f.originalName?.toLowerCase().endsWith('.pdf')) || [];
      pdfFiles.forEach(f => allPdfUrls.push({ url: f.url, name: f.originalName, partNumber: part.partNumber }));

      // Build material line - prefer formData description (matches write-up format)
      const formMaterialDesc = part._materialDescription || part.materialDescription || '';
      let materialLine = '';
      if (formMaterialDesc) {
        // Use the pre-formatted description; ensure qty is shown
        const cleaned = formMaterialDesc.replace(/^\(\d+\)\s*/, '').replace(/^\d+pc:?\s*/, '');
        materialLine = `${part.quantity}pc: ${cleaned}`;
      } else {
        // Fallback: build from raw fields
        const materialParts = [];
        if (part.sectionSize) materialParts.push(part.sectionSize);
        if (part.thickness) materialParts.push(part.thickness);
        if (part.width) materialParts.push(`x ${part.width}"`);
        if (part.length) materialParts.push(`x ${part.length}`);
        if (part.outerDiameter) materialParts.push(`${part.outerDiameter}" OD`);
        if (part.wallThickness && part.wallThickness !== 'SOLID') materialParts.push(`x ${part.wallThickness} wall`);
        if (part.wallThickness === 'SOLID') materialParts.push('Solid');
        if (part.material) materialParts.push(part.material);
        const partTypeLabel = PART_TYPES[part.partType]?.label || part.partType || '';
        materialParts.push(partTypeLabel);
        materialLine = `${part.quantity}pc: ${materialParts.join(' ')}`;
      }

      // Build rolling description block from _rollingDescription (already formatted)
      const rollingDescFull = part._rollingDescription || '';
      let rollingBlock = '';
      const rollingLines = [];
      
      if (rollingDescFull) {
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
        rollingBlock = `
          <div style="background:#e8f5e9;padding:10px 12px;border-radius:4px;border-left:4px solid #2e7d32;margin-top:6px">
            <pre style="white-space:pre-wrap;margin:0;font-family:'Courier New',monospace;font-size:0.95rem;font-weight:bold;color:#1B5E20;line-height:1.5">${rollingLines.join('\n')}</pre>
          </div>
        `;
      }

      // Checkbox for shop copy (production)
      const checkboxHtml = !includePricing ? `<div style="position:absolute;top:12px;right:12px;width:22px;height:22px;border:2px solid #999;border-radius:3px;background:#fff"></div>` : '';

      // Build specs grid (for office copy only)
      const specs = [];
      if (part.material) specs.push(['Grade', part.material]);
      if (part.sectionSize) specs.push(['Size', part.sectionSize]);
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

      // Pricing row (only if includePricing)
      let pricingHtml = '';
      if (includePricing && (part.partTotal || part.laborTotal || part.materialTotal)) {
        const matCost = parseFloat(part.materialTotal) || 0;
        const matMarkup = parseFloat(part.materialMarkupPercent) || 0;
        const matEach = matCost * (1 + matMarkup / 100);
        const labEach = parseFloat(part.laborTotal) || 0;
        const unitPrice = matEach + labEach;
        const qty = parseInt(part.quantity) || 1;
        pricingHtml = `
          <div style="margin-top:8px;padding:8px 12px;background:#e3f2fd;border-radius:4px;display:flex;gap:20px;flex-wrap:wrap;font-size:0.85rem">
            ${matCost ? `<span>Material: ${formatCurrency(matCost)}${matMarkup > 0 ? ` + ${matMarkup}% = <strong>${formatCurrency(matEach)}</strong>` : ''}</span>` : ''}
            ${labEach ? `<span>Labor: ${formatCurrency(labEach)}</span>` : ''}
            <span style="font-weight:bold;color:#1565c0">Unit: ${formatCurrency(unitPrice)} × ${qty} = ${formatCurrency(unitPrice * qty)}</span>
          </div>
        `;
      }

      // Special instructions - skip if it duplicates rolling description
      const specialInstr = part.specialInstructions || '';
      const hasUniqueInstructions = specialInstr && specialInstr.trim() !== rollingDescFull.trim();

      return `
        <div style="border:2px solid #1976d2;padding:14px;margin-bottom:14px;border-radius:8px;page-break-inside:avoid;position:relative">
          ${checkboxHtml}
          <div style="font-size:1.2rem;font-weight:bold;color:#1976d2;margin-bottom:4px;padding-bottom:6px;border-bottom:2px solid #1976d2">
            Part #${part.partNumber} — ${PART_TYPES[part.partType]?.label || part.partType}
          </div>
          <div style="font-size:1rem;font-weight:700;margin:6px 0;color:#333">${materialLine}</div>
          ${part.clientPartNumber ? `<div style="margin-bottom:4px;font-size:0.9rem"><strong>Client Part#:</strong> ${part.clientPartNumber}</div>` : ''}
          ${part.heatNumber ? `<div style="margin-bottom:4px;font-size:0.9rem"><strong>Heat#:</strong> ${part.heatNumber}</div>` : ''}
          ${rollingBlock}
          ${specsHtml}
          ${includePricing && part.partType !== 'fab_service' ? `<div style="margin-bottom:6px;font-size:0.85rem;color:#555">📦 Material supplied by: <strong>${part.materialSource === 'customer_supplied' ? (order.clientName || 'Customer') : 'Carolina Rolling Company'}</strong></div>` : ''}
          ${part.materialSource === 'customer_supplied' ? '<div style="font-size:0.85rem;color:#666;margin:4px 0"><em>Customer Supplied Material</em></div>' : ''}
          ${hasUniqueInstructions ? `
            <div style="margin-top:6px;white-space:pre-wrap;font-size:0.95rem;font-weight:600;color:#333">${specialInstr}</div>
          ` : ''}
          ${part.partType === 'press_brake' && part._pressBrakeFileName ? `
            <div style="margin-top:6px;padding:6px 10px;background:#e3f2fd;border:1px solid #90caf9;border-radius:4px;font-size:0.9rem">
              🗂️ <strong>Brake File:</strong> ${part._pressBrakeFileName}
            </div>
          ` : ''}
          ${pdfFiles.length > 0 ? `
            <div style="margin-top:8px;padding:8px;background:#e8f5e9;border-radius:4px;font-size:0.85rem">
              📎 <strong>Attached Prints:</strong> ${pdfFiles.map(f => f.originalName).join(', ')}
              <div style="font-size:0.75em;color:#666;margin-top:2px">Prints will open separately for printing</div>
            </div>
          ` : ''}
          ${pricingHtml}
        </div>
      `;
    }).join('') || '<p style="color:#666">No parts added yet</p>';

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title} - ${order.drNumber ? 'DR-' + order.drNumber : order.orderNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 850px; margin: 0 auto; font-size: 14px; }
    h1 { color: #1976d2; border-bottom: 3px solid #1976d2; padding-bottom: 10px; margin-bottom: 16px; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .header-item { padding: 8px 10px; background: #f5f5f5; border-radius: 4px; font-size: 0.9rem; }
    .header-item strong { color: #333; display: block; font-size: 0.75rem; text-transform: uppercase; color: #888; margin-bottom: 2px; }
    @media print { body { padding: 10px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${includePricing ? '📋' : '🔧'} ${title}: ${order.drNumber ? 'DR-' + order.drNumber : order.orderNumber}</h1>
  
  <div class="header-grid">
    <div class="header-item"><strong>Client</strong>${order.clientName}</div>
    ${clientPO ? `<div class="header-item"><strong>Client PO#</strong>${clientPO}</div>` : '<div></div>'}
    ${order.promisedDate ? `<div class="header-item"><strong>Promised Date</strong>${new Date(order.promisedDate).toLocaleDateString()}</div>` : '<div></div>'}
    ${order.contactName ? `<div class="header-item"><strong>Contact</strong>${order.contactName}${order.contactPhone ? ' — ' + order.contactPhone : ''}</div>` : '<div></div>'}
    ${order.storageLocation ? `<div class="header-item"><strong>Storage</strong>${order.storageLocation}</div>` : '<div></div>'}
    <div class="header-item"><strong>Status</strong>${order.status?.replace(/_/g, ' ').toUpperCase()}</div>
  </div>

  ${order.notes ? `
    <div style="padding:10px;background:#e3f2fd;border-radius:4px;margin-bottom:16px;border-left:4px solid #1976d2">
      <strong>Notes:</strong> ${order.notes}
    </div>
  ` : ''}

  <h2 style="color:#1976d2;border-bottom:2px solid #1976d2;padding-bottom:6px;margin-top:24px">
    Parts (${order.parts?.length || 0})
  </h2>
  
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
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Parts Subtotal</span><strong>${formatCurrency(calculateTotals().partsSubtotal)}</strong></div>
      ${parseFloat(order.truckingCost) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Trucking</span><strong>${formatCurrency(order.truckingCost)}</strong></div>` : ''}
      ${parseFloat(order.taxAmount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Tax</span><strong>${formatCurrency(order.taxAmount)}</strong></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #1976d2;margin-top:4px;font-size:1.2rem">
        <strong>Grand Total</strong><strong style="color:#2e7d32">${formatCurrency(calculateTotals().grandTotal)}</strong>
      </div>
    </div>
  ` : ''}

  <div style="margin-top:30px;padding-top:16px;border-top:2px solid #ddd;color:#666;font-size:0.8em">
    ${title} — ${order.drNumber ? 'DR-' + order.drNumber : order.orderNumber} | Printed: ${new Date().toLocaleString()}
    ${!includePricing ? '<br/><em>Production Copy</em>' : ''}
  </div>
</body>
</html>`;

    return { html, allPdfUrls };
  };

  // Print Full Work Order (with pricing)
  const printFullWorkOrder = () => {
    const { html, allPdfUrls } = buildWorkOrderPrintHtml(true);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      // Open attached PDFs for separate printing
      if (allPdfUrls.length > 0) {
        setTimeout(() => {
          allPdfUrls.forEach(f => window.open(f.url, '_blank'));
        }, 1000);
      }
    }, 500);
    setShowPrintMenu(false);
  };

  // Print Production Copy (no pricing, for production floor)
  const printShopOrder = () => {
    const { html, allPdfUrls } = buildWorkOrderPrintHtml(false);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      // Open attached PDFs for separate printing
      if (allPdfUrls.length > 0) {
        setTimeout(() => {
          allPdfUrls.forEach(f => window.open(f.url, '_blank'));
        }, 1000);
      }
    }, 500);
    setShowPrintMenu(false);
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
      ${part.heatNumber ? `<div class="sm">Heat: ${part.heatNumber}</div>` : ''}
      <div class="sm">Qty: ${part.quantity}</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A';
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
    const EA_PRICED = ['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll'];
    
    let nonEaTotal = 0;
    let eaPricedTotal = 0;
    parts.forEach(p => {
      const total = parseFloat(p.partTotal) || 0;
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
    
    const trucking = parseFloat(editData.truckingCost) || parseFloat(order?.truckingCost) || 0;
    const subtotal = partsSubtotal + trucking;
    const taxRate = parseFloat(editData.taxRate) || parseFloat(order?.taxRate) || defaultTaxRate;
    const taxAmount = subtotal * (taxRate / 100);
    const grandTotal = subtotal + taxAmount;
    return { partsSubtotal, trucking, subtotal, taxRate, taxAmount, grandTotal, minInfo };
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
      pending: { background: '#e0e0e0', color: '#555' },
      // Legacy mappings
      draft: { background: '#e3f2fd', color: '#1565c0' },
      in_progress: { background: '#e1f5fe', color: '#0288d1' },
      completed: { background: '#e8f5e9', color: '#2e7d32' },
      picked_up: { background: '#f3e5f5', color: '#7b1fa2' },
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
      pending: 'Pending',
      draft: 'Received',
      in_progress: 'Processing',
      completed: 'Stored',
      picked_up: 'Shipped'
    };
    return <span className="status-badge" style={styles[status] || styles.received}>{labels[status] || status?.replace('_', ' ')}</span>;
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!order) return <div className="empty-state"><div className="empty-state-title">Not found</div><button className="btn btn-primary" onClick={() => navigate('/inventory')}>Back</button></div>;

  const hasNoParts = !order.parts || order.parts.length === 0;
  const clientPO = order.clientPurchaseOrderNumber || shipment?.clientPurchaseOrderNumber;

  return (
    <div>
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-icon btn-secondary" onClick={() => navigate('/inventory')}><ArrowLeft size={20} /></button>
          <div>
            {order.drNumber ? (
              <h1 className="detail-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'Courier New, monospace', background: '#e3f2fd', padding: '4px 12px', borderRadius: 6, color: '#1976d2' }}>
                  DR-{order.drNumber}
                </span>
              </h1>
            ) : (
              <h1 className="detail-title">{order.orderNumber}</h1>
            )}
            <div style={{ color: '#666', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>{order.clientName}</span>
              <StatusBadge status={hasNoParts ? 'pending' : order.status} />
              {hasNoParts && <span style={{ color: '#9c27b0', fontSize: '0.8rem' }}>(Awaiting Instructions)</span>}
            </div>
          </div>
        </div>
        <div className="actions-row">
          {order.status !== 'shipped' && order.status !== 'picked_up' && (
            <>
              <select className="form-select" value={order.status} onChange={(e) => handleStatusChange(e.target.value)} style={{ width: 'auto' }}>
                <option value="waiting_for_materials">Waiting for Materials</option>
                <option value="received">Received</option>
                <option value="processing">Processing</option>
                <option value="stored">Stored</option>
                <option value="shipped">Shipped</option>
              </select>
              {order.status === 'stored' && <button className="btn btn-success" onClick={() => setShowPickupModal(true)}><Check size={18} />Pickup/Ship</button>}
            </>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-primary" onClick={() => setShowPrintMenu(!showPrintMenu)}><Printer size={18} />Print</button>
            {showPrintMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, minWidth: 240 }}>
                <button onClick={printFullWorkOrder} style={{ display: 'block', width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 600 }}>
                  📋 Full Work Order<br/><span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#666' }}>With all pricing & totals</span>
                </button>
                <div style={{ borderTop: '1px solid #eee' }}></div>
                <button onClick={printShopOrder} style={{ display: 'block', width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 600 }}>
                  🔧 Production Copy<br/><span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#666' }}>No pricing — for production</span>
                </button>
                <div style={{ borderTop: '1px solid #eee' }}></div>
                <button onClick={() => { setShowPrintMenu(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', color: '#666', fontSize: '0.9rem' }}>Cancel</button>
              </div>
            )}
          </div>
          <button className="btn" onClick={handleReorder} disabled={reordering}
            style={{ background: '#7b1fa2', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: reordering ? 0.6 : 1 }}
            title="Create new estimate from this order (for repeat orders)"
          >
            <Package size={16} />{reordering ? 'Creating...' : 'Reorder'}
          </button>
          <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={18} /></button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Toggle for Receiving Info */}
      {shipment ? (
        <div style={{ marginBottom: 16 }}>
          <button 
            className={`btn ${showReceivingInfo ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowReceivingInfo(!showReceivingInfo)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Truck size={18} />
            {showReceivingInfo ? 'Hide Receiving Info' : 'Show Receiving Info'}
            {shipment.photos?.length > 0 && <span style={{ background: '#4caf50', color: 'white', borderRadius: 10, padding: '2px 6px', fontSize: '0.7rem' }}>{shipment.photos.length} 📷</span>}
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

      {/* Receiving Info Panel */}
      {showReceivingInfo && shipment && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #4caf50' }}>
          <div className="card-header">
            <h3 className="card-title"><Truck size={20} style={{ marginRight: 8 }} />Receiving Info</h3>
          </div>
          
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-item-label"><Clock size={14} /> Received</div>
              <div className="detail-item-value">{formatDateTime(shipment.receivedAt)}</div>
            </div>
            {shipment.receivedBy && (
              <div className="detail-item">
                <div className="detail-item-label"><User size={14} /> Received By</div>
                <div className="detail-item-value">{shipment.receivedBy}</div>
              </div>
            )}
            <div className="detail-item">
              <div className="detail-item-label">Quantity</div>
              <div className="detail-item-value">{shipment.quantity} piece{shipment.quantity !== 1 ? 's' : ''}</div>
            </div>
            {shipment.location && (
              <div className="detail-item">
                <div className="detail-item-label"><MapPin size={14} /> Storage Location</div>
                <div className="detail-item-value">{shipment.location}</div>
              </div>
            )}
          </div>

          {shipment.description && (
            <div style={{ marginTop: 16, padding: 16, background: '#e3f2fd', borderRadius: 8, borderLeft: '4px solid #1976d2' }}>
              <div style={{ fontWeight: 600, color: '#1565c0', marginBottom: 8 }}>Material Description</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{shipment.description}</div>
            </div>
          )}

          {shipment.notes && (
            <div style={{ marginTop: 16, padding: 16, background: '#fff3e0', borderRadius: 8, borderLeft: '4px solid #ff9800' }}>
              <div style={{ fontWeight: 600, color: '#e65100', marginBottom: 8 }}>Receiving Notes</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{shipment.notes}</div>
            </div>
          )}

          {/* Photos */}
          {shipment.photos && shipment.photos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>📷 Photos ({shipment.photos.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                {shipment.photos.map(photo => (
                  <div key={photo.id} style={{ 
                    aspectRatio: '1', 
                    borderRadius: 8, 
                    overflow: 'hidden', 
                    cursor: 'pointer',
                    border: '2px solid #ddd'
                  }} onClick={() => window.open(photo.url, '_blank')}>
                    <img 
                      src={photo.thumbnailUrl || photo.url} 
                      alt="Shipment" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
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
                          contactName: client.contactName || editData.contactName,
                          contactPhone: client.contactPhone || editData.contactPhone,
                          contactEmail: client.contactEmail || editData.contactEmail
                        };
                        // Apply client-specific tax rate if they have one
                        if (client.customTaxRate) {
                          updates.taxRate = (parseFloat(client.customTaxRate) * 100).toFixed(2);
                        } else {
                          updates.taxRate = defaultTaxRate.toString();
                        }
                        setEditData(updates);
                        setShowClientSuggestions(false);
                      }}>
                      <strong>{client.name}</strong>
                      {client.contactName && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{client.contactName}</span>}
                    </div>
                  ))}
                  {editData._clientSearch && editData._clientSearch.length >= 2 && !clientSuggestions.some(c => c.name.toLowerCase() === (editData._clientSearch || '').toLowerCase()) && (
                    <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600, borderTop: '2px solid #c8e6c9' }}
                      onMouseDown={async () => {
                        try {
                          const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/clients`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                            body: JSON.stringify({ name: editData._clientSearch })
                          });
                          const data = await res.json();
                          if (data.data) {
                            setEditData({ ...editData, clientId: data.data.id, clientName: data.data.name, _clientSearch: undefined });
                            showMessage(`Client "${data.data.name}" created`);
                          }
                        } catch (err) { setError('Failed to create client'); }
                        setShowClientSuggestions(false);
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
            <div className="form-group"><label className="form-label">Contact Name</label><input className="form-input" value={editData.contactName} onChange={(e) => setEditData({ ...editData, contactName: e.target.value })} placeholder="John Smith" /></div>
            <div className="form-group"><label className="form-label">Contact Phone</label><input className="form-input" value={formatPhone(editData.contactPhone || '')} onChange={(e) => setEditData({ ...editData, contactPhone: formatPhone(e.target.value) })} placeholder="(555) 123-4567" /></div>
            <div className="form-group"><label className="form-label">Contact Email</label><input type="email" className="form-input" value={editData.contactEmail} onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })} placeholder="john@example.com" /></div>
            <div className="form-group"><label className="form-label">Requested Due Date</label><input type="date" className="form-input" value={editData.requestedDueDate} onChange={(e) => setEditData({ ...editData, requestedDueDate: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Promised Date</label><input type="date" className="form-input" value={editData.promisedDate} onChange={(e) => setEditData({ ...editData, promisedDate: e.target.value })} /></div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Notes</label><textarea className="form-textarea" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} /></div>
          </div>
        ) : (
          <>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-item-label"><User size={14} /> Client</div><div className="detail-item-value">{order.clientName}</div></div>
              {clientPO && <div className="detail-item"><div className="detail-item-label"><FileText size={14} /> Client PO#</div><div className="detail-item-value" style={{ color: '#1976d2', fontWeight: 600 }}>{clientPO}</div></div>}
              {order.jobNumber && <div className="detail-item"><div className="detail-item-label">Job#</div><div className="detail-item-value">{order.jobNumber}</div></div>}
              {order.storageLocation && <div className="detail-item"><div className="detail-item-label"><MapPin size={14} /> Location</div><div className="detail-item-value">{order.storageLocation}</div></div>}
              {order.contactName && <div className="detail-item"><div className="detail-item-label">Contact Name</div><div className="detail-item-value">{order.contactName}</div></div>}
              {order.contactPhone && <div className="detail-item"><div className="detail-item-label">Contact Phone</div><div className="detail-item-value">{formatPhone(order.contactPhone)}</div></div>}
              {order.contactEmail && <div className="detail-item"><div className="detail-item-label">Contact Email</div><div className="detail-item-value">{order.contactEmail}</div></div>}
              {order.promisedDate && <div className="detail-item"><div className="detail-item-label"><Calendar size={14} /> Promised</div><div className="detail-item-value">{formatDate(order.promisedDate)}</div></div>}
              <div className="detail-item"><div className="detail-item-label"><Clock size={14} /> Created</div><div className="detail-item-value">{formatDate(order.createdAt)}</div></div>
            </div>
            {order.notes && <div style={{ marginTop: 16, padding: 12, background: '#f9f9f9', borderRadius: 8 }}><strong>Notes:</strong> {order.notes}</div>}
          </>
        )}

        {/* Purchase Orders Section */}
        {order.documents?.filter(d => d.documentType === 'purchase_order').length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#e65100' }}>
              <ShoppingCart size={18} /> Purchase Orders
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {order.documents.filter(d => d.documentType === 'purchase_order').map(doc => (
                <div key={doc.id} style={{ 
                  display: 'flex', alignItems: 'center', gap: 8, 
                  background: '#fff3e0', padding: '10px 14px', borderRadius: 8, 
                  fontSize: '0.9rem', border: '1px solid #ffcc80'
                }}>
                  <File size={18} color="#e65100" />
                  <span style={{ fontWeight: 500 }}>{doc.originalName}</span>
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
                    style={{ background: '#e65100', color: 'white', padding: '4px 10px' }}
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteDocument(doc.id)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d32f2f' }}
                    title="Delete"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order Documents Section */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <File size={18} /> Documents ({order.documents?.filter(d => d.documentType !== 'purchase_order').length || 0})
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => docInputRef.current?.click()} disabled={uploadingDocs}>
              <Upload size={14} />{uploadingDocs ? 'Uploading...' : 'Upload'}
            </button>
            <input type="file" multiple accept=".pdf,.doc,.docx,image/*" ref={docInputRef} style={{ display: 'none' }} 
              onChange={(e) => handleDocumentUpload(Array.from(e.target.files))} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12 }}>Upload customer POs, supplier quotes, drawings, etc.</p>
          {order.documents?.filter(d => d.documentType !== 'purchase_order').length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {order.documents.filter(d => d.documentType !== 'purchase_order').map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem' }}>
                  <File size={16} color="#1976d2" />
                  <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.originalName}</span>
                  <button onClick={() => handleViewDocument(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Eye size={14} /></button>
                  <button onClick={() => handleDeleteDocument(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d32f2f' }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
            <button className="btn btn-primary btn-sm" onClick={openAddPartModal}><Plus size={16} />Add Part</button>
          </div>
        </div>
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
            {order.parts.sort((a, b) => a.partNumber - b.partNumber).map(part => (
              <div key={part.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, marginBottom: 12, background: part.status === 'completed' ? '#f9fff9' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>#{part.partNumber}</span>
                      <span style={{ color: '#1976d2' }}>{PART_TYPES[part.partType]?.label || part.partType}</span>
                      <StatusBadge status={part.status} />
                      {part.materialOrdered && (
                        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem' }}>
                          ✓ {part.materialPurchaseOrderNumber}
                        </span>
                      )}
                    </div>
                    {part.clientPartNumber && <div style={{ color: '#666', fontSize: '0.875rem' }}>Client Part#: {part.clientPartNumber}</div>}
                    {part.heatNumber && <div style={{ color: '#666', fontSize: '0.875rem' }}>Heat#: {part.heatNumber}</div>}
                  </div>
                  <div className="actions-row">
                    <select className="form-select" value={part.status} onChange={(e) => handlePartStatusChange(part.id, e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}>
                      <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                    </select>
                    <button className="btn btn-sm btn-outline" onClick={() => printPartLabel(part)} title="Print Label"><Tag size={14} /></button>
                    <button className="btn btn-sm btn-outline" onClick={() => openEditPartModal(part)}><Edit size={14} /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeletePart(part.id)}><Trash2 size={14} /></button>
                  </div>
                </div>

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
                      </div>
                      {part.materialSource === 'we_order' && (
                        part.materialOrdered ? (
                          <span style={{ fontSize: '0.8rem', color: '#2e7d32', fontWeight: 600 }}>✓ {part.materialPurchaseOrderNumber}</span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#e65100' }}>Needs ordering</span>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, fontSize: '0.875rem' }}>
                  <div><strong>Qty:</strong> {part.quantity}</div>
                  {part.material && <div><strong>Material:</strong> {part.material}</div>}
                  {part.thickness && <div><strong>Thickness:</strong> {part.thickness}</div>}
                  {part.width && <div><strong>Width:</strong> {part.width}</div>}
                  {part.length && <div><strong>Length:</strong> {part.length}</div>}
                  {part.sectionSize && <div><strong>Section:</strong> {part.sectionSize}</div>}
                  {part.outerDiameter && <div><strong>OD:</strong> {part.outerDiameter}</div>}
                  {part.wallThickness && part.wallThickness !== 'SOLID' && <div><strong>Wall:</strong> {part.wallThickness}</div>}
                  {part.wallThickness === 'SOLID' && <div><strong style={{ color: '#e65100' }}>Solid Round Bar</strong></div>}
                  {part.rollType && <div><strong>Roll:</strong> {part.rollType === 'easy_way' ? 'Easy Way' : 'Hard Way'}</div>}
                  {part.radius && <div><strong>Radius:</strong> {part.radius}</div>}
                  {part.diameter && <div><strong>Diameter:</strong> {part.diameter}</div>}
                  {part.arcDegrees && <div><strong>Arc:</strong> {part.arcDegrees}°</div>}
                </div>
                {part.specialInstructions && <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4, fontSize: '0.875rem' }}><strong>Instructions:</strong> {part.specialInstructions}</div>}
                
                {/* Pricing Summary */}
                {(part.partTotal || part.laborTotal || part.materialTotal) && (
                  <div style={{ marginTop: 8, padding: 8, background: '#e3f2fd', borderRadius: 4, fontSize: '0.85rem', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {part.laborTotal && <span><strong>Labor:</strong> ${parseFloat(part.laborTotal).toFixed(2)}</span>}
                    {part.materialTotal && <span><strong>Material:</strong> ${parseFloat(part.materialTotal).toFixed(2)}</span>}
                    {part.setupCharge && <span><strong>Setup:</strong> ${parseFloat(part.setupCharge).toFixed(2)}</span>}
                    {part.partTotal && <span style={{ fontWeight: 600, color: '#1565c0' }}><strong>Total:</strong> ${parseFloat(part.partTotal).toFixed(2)}</span>}
                  </div>
                )}
                
                {/* Part Files */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Files ({part.files?.length || 0})</span>
                    <button className="btn btn-sm btn-outline" onClick={() => fileInputRefs.current[part.id]?.click()} disabled={uploadingFiles === part.id}>
                      <Upload size={12} />{uploadingFiles === part.id ? 'Uploading...' : 'Upload'}
                    </button>
                    <input type="file" multiple ref={el => fileInputRefs.current[part.id] = el} style={{ display: 'none' }} onChange={(e) => handleFileUpload(part.id, Array.from(e.target.files))} />
                  </div>
                  {part.files?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {part.files.map(file => (
                        <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                          <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.originalName}</span>
                          <button onClick={() => handleViewFile(part.id, file.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Eye size={12} /></button>
                          <button onClick={() => handleDeleteFile(part.id, file.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#d32f2f' }}><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
                {order.parts.sort((a, b) => a.partNumber - b.partNumber).map(part => (
                  <tr key={part.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{part.partNumber}</td>
                    <td style={{ padding: 8 }}>
                      {PART_TYPES[part.partType]?.label || part.partType}
                      {part.materialDescription && <div style={{ fontSize: '0.8rem', color: '#666' }}>{part.materialDescription}</div>}
                    </td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{part.quantity}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(part.laborTotal)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(part.materialTotal)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(part.setupCharge)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatCurrency(part.otherCharges)}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(part.partTotal)}</td>
                  </tr>
                ))}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <span>Tax Rate:</span>
                  <input 
                    type="number" 
                    step="0.0001"
                    className="form-input" 
                    value={editData.taxRate}
                    onChange={(e) => setEditData({ ...editData, taxRate: e.target.value })}
                    style={{ width: 80, textAlign: 'right' }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <span>Tax ({(parseFloat(order.taxRate) || defaultTaxRate).toFixed(2)}%):</span>
                  <span>{formatCurrency(calculateTotals().taxAmount)}</span>
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
              {isEditing && (
                <button
                  className="btn btn-sm"
                  style={{ background: '#ff9800', color: '#fff', border: 'none', fontSize: '0.75rem' }}
                  onClick={() => setEditData({ ...editData, minimumOverride: true })}
                >
                  Override Minimum
                </button>
              )}
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
                {isEditing && (
                  <button className="btn btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                    onClick={() => setEditData({ ...editData, minimumOverride: false, minimumOverrideReason: '' })}>
                    Remove
                  </button>
                )}
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

      {/* Part Type Picker Modal */}
      {showPartTypePicker && (
        <div className="modal-overlay" onClick={() => setShowPartTypePicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Select Part Type</h3>
              <button className="btn btn-icon" onClick={() => setShowPartTypePicker(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {Object.entries(PART_TYPES).map(([key, { label, icon, desc }]) => (
                  <div
                    key={key}
                    onClick={() => handleSelectPartType(key)}
                    style={{
                      padding: 16, borderRadius: 12, border: '2px solid #e0e0e0', cursor: 'pointer',
                      transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      textAlign: 'center', gap: 8
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1976d2'; e.currentTarget.style.background = '#e3f2fd'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'white'; }}
                  >
                    <span style={{ fontSize: '2rem' }}>{icon}</span>
                    <strong style={{ fontSize: '1rem' }}>{label}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Part Modal */}
      {showPartModal && (
        <div className="modal-overlay" onClick={() => setShowPartModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>
                {editingPart ? 'Edit Part' : 'Add Part'} — {PART_TYPES[selectedPartType]?.icon} {PART_TYPES[selectedPartType]?.label || selectedPartType}
              </h3>
              <button className="btn btn-icon" onClick={() => setShowPartModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

              {/* Validation errors */}
              {partFormError && partFormError.length > 0 && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  {partFormError.map((w, i) => <div key={i}>⚠️ {w}</div>)}
                </div>
              )}

              {/* Common fields for types that have their own form */}
              {!['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'cone_roll', 'tee_bar', 'press_brake'].includes(selectedPartType) && (
              <div className="grid grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Client Part Number</label>
                  <input type="text" className="form-input" value={partData.clientPartNumber || ''} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Heat Number</label>
                  <input type="text" className="form-input" value={partData.heatNumber || ''} onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} />
                </div>
              </div>
              )}

              {/* Type-specific form */}
              {(selectedPartType === 'plate_roll' || selectedPartType === 'flat_stock') ? (
                <div className="grid grid-2">
                  <PlateRollForm partData={partData} setPartData={setPartData} vendorSuggestions={vendorSuggestions} setVendorSuggestions={setVendorSuggestions} showVendorSuggestions={showVendorSuggestions} setShowVendorSuggestions={setShowVendorSuggestions} showMessage={showMessage} setError={setError} />
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
              ) : (
                /* Generic form for 'other' part type */
                <div className="grid grid-2">
                  <div className="form-group"><label className="form-label">Quantity *</label><input type="number" className="form-input" value={partData.quantity} onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} min="1" /></div>
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPartModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePart} disabled={saving || !selectedPartType}>{saving ? 'Saving...' : editingPart ? 'Update Part' : 'Add Part'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup Modal */}
      {showPickupModal && (
        <div className="modal-overlay" onClick={() => setShowPickupModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Pickup</h3><button className="btn btn-icon" onClick={() => setShowPickupModal(false)}><X size={20} /></button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Picked Up By</label><input className="form-input" value={pickupData.pickedUpBy} onChange={(e) => setPickupData({ pickedUpBy: e.target.value })} placeholder="Name of person picking up" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPickupModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handlePickup}><Check size={18} />Confirm Pickup</button>
            </div>
          </div>
        </div>
      )}

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
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Qty: {part.quantity}</div>
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
    </div>
  );
}

export default WorkOrderDetailsPage;
