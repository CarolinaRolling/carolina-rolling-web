import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, Database, Settings, FileText, Package, ClipboardList, DollarSign, AlertTriangle, Clock } from 'lucide-react';
import { getBackupInfo, downloadBackup, startRestoreJob, runBackgroundBackup, API_BASE_URL } from '../services/api';
import { shopToday } from '../utils/dates';

function BackupPage() {
  const [backupInfo, setBackupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // U6: the restore runs as a background job on the server; the page polls it and shows its report
  const [restoreJob, setRestoreJob] = useState(null);       // latest job status from the server
  const [restoreReport, setRestoreReport] = useState(null); // final report (or error) of the last restore
  const pollRef = useRef(null);
  const aliveRef = useRef(true);   // no polling / state updates after the page is left (review of round 15)
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  const [backupOptions, setBackupOptions] = useState({
    includeShipments: true,
    includeWorkOrders: true,
    includeEstimates: true,
    includeInbound: true,
    includeSettings: true,
    includeFiles: false,
  });

  const [restoreOptions, setRestoreOptions] = useState({
    clearExisting: false,
  });

  const [uploadedBackup, setUploadedBackup] = useState(null);
  const [bgBackupStarted, setBgBackupStarted] = useState(false);
  const bgEmail = '';   // the server sends the notice to the signed-in admin's own address (R3)

  useEffect(() => {
    loadBackupInfo();
    // pick up a restore that was still running when the page was left
    let saved = null, savedToken = null;
    try { saved = localStorage.getItem('restoreJobId'); savedToken = localStorage.getItem('restoreStatusToken'); } catch (_) { /* storage blocked */ }
    if (saved) { setRestoring(true); pollRestoreJob(saved, savedToken); }
    aliveRef.current = true;
    return () => { aliveRef.current = false; if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forgetJob = () => { try { localStorage.removeItem('restoreJobId'); localStorage.removeItem('restoreStatusToken'); } catch (_) { /* storage blocked */ } };

  // V28: the job is read with fetch, not the shared API client — a fresh-install restore replaces the
  // signed-in admin, and the client's 401 handler would jump to the login page and lose the report.
  // After a 401 the job is followed through the sign-in-free status route with the job's statusToken.
  const fetchRestoreJob = async (jobId, statusToken) => {
    let token = null;
    try { token = localStorage.getItem('token'); } catch (_) { /* storage blocked */ }
    const res = await fetch(`${API_BASE_URL}/backup/restore/${encodeURIComponent(jobId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.ok) return { job: (await res.json()).data, signedOut: false };
    if ((res.status === 401 || res.status === 403) && statusToken) {
      const pub = await fetch(`${API_BASE_URL}/backup-status/${encodeURIComponent(jobId)}?statusToken=${encodeURIComponent(statusToken)}`);
      if (pub.ok) return { job: (await pub.json()).data, signedOut: true };
      throw Object.assign(new Error(`HTTP ${pub.status}`), { status: pub.status });
    }
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  };
  const SIGNED_OUT_NOTE = 'The restore replaced the users — sign in with an admin from the backup to see the full report.';

  // Poll every 2 s until the job is done or failed (U6)
  const pollRestoreJob = async (jobId, statusToken) => {
    if (!aliveRef.current) return;
    try {
      const { job, signedOut } = await fetchRestoreJob(jobId, statusToken);
      if (!aliveRef.current) return;
      setRestoreJob(job);
      if (job.status === 'running') { pollRef.current = setTimeout(() => pollRestoreJob(jobId, statusToken), 2000); return; }
      // signed out: keep the job remembered, so after signing in as the backup's admin this page shows the full report
      if (!signedOut) forgetJob();
      setRestoring(false);
      if (job.status === 'done') {
        const r = job.result || {};
        setRestoreReport({ ok: true, ...r, signedOutNote: signedOut ? SIGNED_OUT_NOTE : null });
        if (!(r.warnings && r.warnings.length) && !signedOut) setSuccess(r.message || 'Backup restored successfully');
        setUploadedBackup(null);
        if (!signedOut) loadBackupInfo();   // would answer 401 and leave the page
      } else {
        setRestoreReport({ ok: false, message: job.error || 'Restore failed' });
        setError(job.error || 'Restore failed');
      }
    } catch (err) {
      if (err.status === 404) {
        forgetJob(); setRestoring(false);
        setError('The server no longer knows this restore (it was restarted, or the job expired). Check the data before restoring again.');
        return;
      }
      if (err.status === 401 || err.status === 403) {   // signed out and no status token (older server)
        setRestoring(false);
        setError(SIGNED_OUT_NOTE);
        return;
      }
      // a passing network error or a 503 while the dyno is busy: keep polling
      if (aliveRef.current) pollRef.current = setTimeout(() => pollRestoreJob(jobId, statusToken), 2000);
    }
  };

  const loadBackupInfo = async () => {
    try {
      setLoading(true);
      const response = await getBackupInfo();
      setBackupInfo(response.data.data);
    } catch (err) {
      setError('Failed to load backup info');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setDownloading(true);
      setError(null);

      const response = await downloadBackup(backupOptions);
      
      // Create blob from response
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${shopToday()}${backupOptions.includeFiles ? '-with-files' : ''}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess('Backup downloaded successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to download backup');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (!backup.data || !backup.version) {
          setError('Invalid backup file format');
          return;
        }
        setUploadedBackup(backup);
        setError(null);
      } catch (err) {
        setError('Failed to parse backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!uploadedBackup) return;
    if (!window.confirm('Are you sure you want to restore from this backup? This action cannot be undone.')) return;

    try {
      setRestoring(true);
      setError(null);
      setSuccess(null);
      setRestoreReport(null);
      setRestoreJob(null);

      const options = {
        restoreShipments: true,
        restoreWorkOrders: true,
        restoreEstimates: true,
        restoreInbound: true,
        restoreSettings: true,
        clearExisting: restoreOptions.clearExisting,
      };
      let res;
      try {
        res = await startRestoreJob({ backup: uploadedBackup, options });
      } catch (err) {
        // An older backup that lacks some sections: "Clear existing" would erase those records (V12) —
        // say so and let the admin decide
        if (err.response?.data?.error?.code !== 'MISSING_SECTIONS') throw err;
        if (!window.confirm(`${err.response.data.error.message}\n\nErase them and restore anyway?`)) { setRestoring(false); return; }
        res = await startRestoreJob({ backup: uploadedBackup, options: { ...options, allowMissingSections: true } });
      }
      const jobId = res.data?.jobId;
      if (!jobId) {   // an older server answers synchronously with the report itself
        setRestoring(false);
        setRestoreReport({ ok: true, ...res.data });
        if (!(res.data?.warnings && res.data.warnings.length)) setSuccess(res.data?.message || 'Backup restored');
        loadBackupInfo();
        return;
      }
      const statusToken = res.data?.statusToken || null;
      try {
        localStorage.setItem('restoreJobId', jobId);
        if (statusToken) localStorage.setItem('restoreStatusToken', statusToken); else localStorage.removeItem('restoreStatusToken');
      } catch (_) { /* storage blocked */ }
      pollRestoreJob(jobId, statusToken);
    } catch (err) {
      setRestoring(false);
      setError(err.response?.data?.error?.message || `Failed to start the restore${err.message ? ` (${err.message})` : ''}`);
    }
  };

  const handleBackgroundBackup = async () => {
    try {
      setBgBackupStarted(true);
      const res = await runBackgroundBackup({ includeFiles: false, email: bgEmail.trim() });
      setSuccess(res.data.message || 'Backup started — check your email when complete');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to start background backup');
      setBgBackupStarted(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <Database size={28} style={{ marginRight: 12 }} />
          Backup & Restore
        </h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Last backup status banner */}
      {backupInfo?.lastBackupStatus && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: backupInfo.lastBackupStatus.status === 'failed' ? '#ffebee' : '#e8f5e9',
          border: `1px solid ${backupInfo.lastBackupStatus.status === 'failed' ? '#ef9a9a' : '#a5d6a7'}`
        }}>
          <span style={{ fontSize: '1.3rem' }}>{backupInfo.lastBackupStatus.status === 'failed' ? '🚨' : '✅'}</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: backupInfo.lastBackupStatus.status === 'failed' ? '#c62828' : '#2e7d32' }}>
              {backupInfo.lastBackupStatus.status === 'failed' ? 'Last Backup Failed' : 'Last Backup Succeeded'}
            </strong>
            <div style={{ fontSize: '0.82rem', color: '#666', marginTop: 2 }}>
              {new Date(backupInfo.lastBackupStatus.timestamp).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} PT
              {backupInfo.lastBackupStatus.status === 'success' && backupInfo.lastBackupStatus.size && ` — ${(backupInfo.lastBackupStatus.size / 1024).toFixed(0)}KB`}
              {backupInfo.lastBackupStatus.status === 'failed' && backupInfo.lastBackupStatus.error && ` — ${backupInfo.lastBackupStatus.error}`}
            </div>
          </div>
          {backupInfo.lastBackupStatus.status === 'failed' && (
            <button className="btn btn-sm" style={{ background: '#c62828', color: 'white', whiteSpace: 'nowrap' }}
              onClick={() => document.getElementById('run-backup-now')?.click()}>
              Run Backup Now
            </button>
          )}
        </div>
      )}

      <div className="grid grid-2">
        {/* Create Backup */}
        <div className="card" style={{ border: '2px dashed #1976d2', background: '#f0f7ff' }}>
          <h3 className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={20} />
            Create Backup
          </h3>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Download a complete backup of all your data including shipments, work orders, estimates, settings, and files.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Select data to include:</label>

            <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, cursor: 'pointer', borderBottom: '1px solid #e0e0e0', background: backupOptions.includeShipments ? '#e3f2fd' : 'white' }}>
                <input type="checkbox" checked={backupOptions.includeShipments}
                  onChange={(e) => setBackupOptions({ ...backupOptions, includeShipments: e.target.checked })} />
                <Package size={18} />
                <div>
                  <strong>Shipments & Inventory</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{backupInfo?.counts?.shipments || 0} records</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, cursor: 'pointer', borderBottom: '1px solid #e0e0e0', background: backupOptions.includeWorkOrders ? '#e3f2fd' : 'white' }}>
                <input type="checkbox" checked={backupOptions.includeWorkOrders}
                  onChange={(e) => setBackupOptions({ ...backupOptions, includeWorkOrders: e.target.checked })} />
                <ClipboardList size={18} />
                <div>
                  <strong>Work Orders</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{backupInfo?.counts?.workOrders || 0} records</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, cursor: 'pointer', borderBottom: '1px solid #e0e0e0', background: backupOptions.includeEstimates ? '#e3f2fd' : 'white' }}>
                <input type="checkbox" checked={backupOptions.includeEstimates}
                  onChange={(e) => setBackupOptions({ ...backupOptions, includeEstimates: e.target.checked })} />
                <DollarSign size={18} />
                <div>
                  <strong>Estimates</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{backupInfo?.counts?.estimates || 0} records</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, cursor: 'pointer', borderBottom: '1px solid #e0e0e0', background: backupOptions.includeInbound ? '#e3f2fd' : 'white' }}>
                <input type="checkbox" checked={backupOptions.includeInbound}
                  onChange={(e) => setBackupOptions({ ...backupOptions, includeInbound: e.target.checked })} />
                <FileText size={18} />
                <div>
                  <strong>Inbound Orders</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{backupInfo?.counts?.inboundOrders || 0} records</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, cursor: 'pointer', background: backupOptions.includeSettings ? '#e3f2fd' : 'white' }}>
                <input type="checkbox" checked={backupOptions.includeSettings}
                  onChange={(e) => setBackupOptions({ ...backupOptions, includeSettings: e.target.checked })} />
                <Settings size={18} />
                <div>
                  <strong>Settings & Users</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{backupInfo?.counts?.settings || 0} settings, {backupInfo?.counts?.users || 0} users</div>
                </div>
              </label>
            </div>
          </div>

          {/* Files are not part of this backup (round 12, N21): a web request can't download them all
              before it times out, and newer files are on S3, where bucket versioning protects them. */}
          <div style={{ marginBottom: 16, padding: 12, border: '1px solid #90caf9', borderRadius: 8, background: '#e3f2fd', fontSize: '0.85rem', color: '#555' }}>
            This backup is the database. Drawings, PDFs and photos are protected separately by S3 bucket versioning.
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDownloadBackup} disabled={downloading}>
            <Download size={18} />
            {downloading ? (backupOptions.includeFiles ? 'Downloading files from Cloudinary...' : 'Preparing Download...') : (backupOptions.includeFiles ? 'Download Full Backup + Files' : 'Download Full Backup')}
          </button>
          <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 8, textAlign: 'center' }}>
            Backup file will be saved as: backup-{shopToday()}{backupOptions.includeFiles ? '-with-files' : ''}.json
          </p>
        </div>

        {/* Restore Backup */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={20} />
            Restore from Backup
          </h3>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Upload a previously downloaded backup file to restore your data.
          </p>

          <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileSelect} />

          {!uploadedBackup ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #ddd',
                borderRadius: 12,
                padding: 40,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#1976d2'; e.currentTarget.style.background = '#f0f7ff'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.background = 'white'; }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>📁</div>
              <p><strong>Click to select backup file</strong></p>
              <p style={{ fontSize: '0.8rem', color: '#666' }}>or drag and drop here</p>
            </div>
          ) : (
            <div style={{ background: '#e8f5e9', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong>Backup File Loaded</strong>
                <button className="btn btn-sm btn-secondary" onClick={() => setUploadedBackup(null)}>Remove</button>
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                <div><strong>Created:</strong> {new Date(uploadedBackup.createdAt).toLocaleString()}</div>
                <div><strong>Version:</strong> {uploadedBackup.version}</div>
                {uploadedBackup.counts && (
                  <div style={{ marginTop: 8 }}>
                    <strong>Contains:</strong>
                    <ul style={{ margin: '4px 0 0 20px', fontSize: '0.85rem' }}>
                      {uploadedBackup.counts.shipments > 0 && <li>{uploadedBackup.counts.shipments} shipments</li>}
                      {uploadedBackup.counts.workOrders > 0 && <li>{uploadedBackup.counts.workOrders} work orders</li>}
                      {uploadedBackup.counts.estimates > 0 && <li>{uploadedBackup.counts.estimates} estimates</li>}
                      {uploadedBackup.counts.inboundOrders > 0 && <li>{uploadedBackup.counts.inboundOrders} inbound orders</li>}
                      {uploadedBackup.counts.settings > 0 && <li>{uploadedBackup.counts.settings} settings</li>}
                      {uploadedBackup.counts._files && <li style={{ color: '#1565c0', fontWeight: 600 }}>{uploadedBackup.counts._files.downloaded} PDF/CAD files included{uploadedBackup.counts._files.failed > 0 && <span style={{ color: '#c62828' }}> ({uploadedBackup.counts._files.failed} failed)</span>}</li>}
                      {uploadedBackup.files && Object.keys(uploadedBackup.files).length > 0 && !uploadedBackup.counts._files && <li style={{ color: '#1565c0', fontWeight: 600 }}>{Object.keys(uploadedBackup.files).length} PDF/CAD files included</li>}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="alert" style={{ background: '#ffebee', border: '1px solid #ef9a9a', display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 16 }}>
            <AlertTriangle size={20} style={{ color: '#c62828', flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: '#c62828' }}>Warning</strong>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                Restoring from a backup will add data to your system. Enable "Clear existing data" to replace all current data.
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={restoreOptions.clearExisting}
              onChange={(e) => setRestoreOptions({ ...restoreOptions, clearExisting: e.target.checked })} />
            <span style={{ fontSize: '0.9rem' }}>Clear existing data before restore</span>
          </label>

          <button className="btn btn-warning" style={{ width: '100%', marginTop: 16 }} onClick={handleRestore}
            disabled={!uploadedBackup || restoring}>
            <Upload size={18} />
            {restoring ? 'Restoring...' : 'Restore Backup'}
          </button>

          {/* U6: live progress of the background restore */}
          {restoring && restoreJob && restoreJob.progress && (
            <div style={{ marginTop: 12, fontSize: '0.85rem', color: '#555' }}>
              <div>
                {restoreJob.progress.phase}{restoreJob.progress.table ? ` — ${restoreJob.progress.table} (${restoreJob.progress.tableDone || 0} of ${restoreJob.progress.tableTotal || 0})` : ''}
              </div>
              {restoreJob.progress.rowsTotal > 0 && (
                <div style={{ background: '#eee', borderRadius: 4, height: 8, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ background: '#1976d2', height: 8, width: `${Math.min(100, Math.round(100 * (restoreJob.progress.rowsDone || 0) / restoreJob.progress.rowsTotal))}%` }} />
                </div>
              )}
              <div style={{ marginTop: 4 }}>
                {(restoreJob.progress.rowsDone || 0).toLocaleString()} of {(restoreJob.progress.rowsTotal || 0).toLocaleString()} rows · started {new Date(restoreJob.startedAt).toLocaleTimeString()}
              </div>
            </div>
          )}

          {/* U6: the server's real report — never "restored successfully" when there are warnings */}
          {restoreReport && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, fontSize: '0.85rem',
              background: !restoreReport.ok ? '#ffebee' : (restoreReport.warnings && restoreReport.warnings.length ? '#fff8e1' : '#e8f5e9'),
              border: `1px solid ${!restoreReport.ok ? '#ef9a9a' : (restoreReport.warnings && restoreReport.warnings.length ? '#ffe082' : '#a5d6a7')}` }}>
              <strong>{restoreReport.ok ? (restoreReport.message || 'Restore finished') : 'Restore failed — nothing was changed'}</strong>
              {!restoreReport.ok && <div style={{ marginTop: 6 }}>{restoreReport.message}</div>}
              {restoreReport.signedOutNote && <div style={{ marginTop: 6, fontWeight: 600 }}>{restoreReport.signedOutNote}</div>}
              {restoreReport.warnings && restoreReport.warnings.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div><strong>Warnings</strong></div>
                  <ul style={{ margin: '4px 0 0 20px' }}>
                    {restoreReport.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {restoreReport.failed && Object.keys(restoreReport.failed).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div><strong>Rows not restored</strong></div>
                  <ul style={{ margin: '4px 0 0 20px' }}>
                    {Object.entries(restoreReport.failed).map(([t, n]) => <li key={t}>{t}: {n}</li>)}
                  </ul>
                </div>
              )}
              {restoreReport.results && Object.entries(restoreReport.results).some(([, r]) => r && r.errors && r.errors.length) && (
                <div style={{ marginTop: 8 }}>
                  <div><strong>Skipped rows (examples)</strong></div>
                  <ul style={{ margin: '4px 0 0 20px', wordBreak: 'break-word' }}>
                    {Object.entries(restoreReport.results).filter(([, r]) => r && r.errors && r.errors.length).flatMap(([t, r]) =>
                      r.errors.slice(0, 5).map((e, i) => <li key={`${t}-${i}`}>{t} {e}</li>))}
                  </ul>
                </div>
              )}
              {restoreReport.failedSamples && restoreReport.failedSamples.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div><strong>Failed rows (examples)</strong></div>
                  <ul style={{ margin: '4px 0 0 20px', wordBreak: 'break-word' }}>
                    {restoreReport.failedSamples.map((f, i) => <li key={i}>{f.table}{f.parent ? ` (of ${f.parent})` : ''}{f.id ? ` ${f.id}` : ''}: {f.error}</li>)}
                  </ul>
                </div>
              )}
              {restoreReport.integrity && restoreReport.integrity.errors && restoreReport.integrity.errors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div><strong>Integrity errors</strong></div>
                  <ul style={{ margin: '4px 0 0 20px' }}>
                    {restoreReport.integrity.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Data Summary */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          Current Data Summary
          {backupInfo?.storageProvider && (
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 12,
              background: backupInfo.storageProvider === 's3' ? '#e8f5e9' : '#fff3e0',
              color: backupInfo.storageProvider === 's3' ? '#2e7d32' : '#e65100',
              border: `1px solid ${backupInfo.storageProvider === 's3' ? '#a5d6a7' : '#ffcc80'}`
            }}>
              {backupInfo.storageProvider === 's3' ? '☁️ Amazon S3' : '📦 Cloudinary'}
            </span>
          )}
        </h3>
        <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div style={{ textAlign: 'center', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <Package size={32} color="#1976d2" />
            <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: 8 }}>{backupInfo?.counts?.shipments || 0}</div>
            <div style={{ color: '#666' }}>Shipments</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <ClipboardList size={32} color="#388e3c" />
            <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: 8 }}>{backupInfo?.counts?.workOrders || 0}</div>
            <div style={{ color: '#666' }}>Work Orders</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <DollarSign size={32} color="#f57c00" />
            <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: 8 }}>{backupInfo?.counts?.estimates || 0}</div>
            <div style={{ color: '#666' }}>Estimates</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <FileText size={32} color="#7b1fa2" />
            <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: 8 }}>{backupInfo?.counts?.inboundOrders || 0}</div>
            <div style={{ color: '#666' }}>Inbound Orders</div>
          </div>
        </div>
      </div>

      {/* Auto-Backup Schedule */}
      <div className="card" style={{ marginTop: 16, background: '#f0f7ff', border: '1px solid #bbdefb' }}>
        <h3 className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={20} />
          Scheduled Auto-Backup
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#333', marginBottom: 8 }}>
          Database backups run automatically <strong>every Saturday at 11 PM Pacific</strong> and are stored on Cloudinary. 2 months of weekly backups are kept. For a full backup with PDFs & CAD files, use the manual download above with "Include Files" checked.
        </p>
        
        {/* Run Now */}
        <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Run Cloud Backup Now</div>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 10 }}>
            Upload a database backup to Cloudinary now (same as the Saturday auto-backup).
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#666', flex: 1, minWidth: 200 }}>
              The notice goes to your own account's e-mail (or the shop's admin address) and has no download link — download from Backup History.
            </span>
            <button className="btn btn-primary" id="run-backup-now" onClick={handleBackgroundBackup}
              disabled={bgBackupStarted} style={{ whiteSpace: 'nowrap' }}>
              {bgBackupStarted ? '✅ Backup Running...' : '🚀 Run Cloud Backup Now'}
            </button>
          </div>
          {bgBackupStarted && (
            <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#2e7d32', fontWeight: 600 }}>
              Backup is running in the background. You can close this page — the email will arrive when it's done.
            </div>
          )}
        </div>

        {/* Backup History */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 12 }}>📋 Backup History</div>
          {(() => {
            // Merge history (has counts) with cloud backups (has URLs)
            const history = backupInfo?.backupHistory || [];
            const cloudMap = {};
            (backupInfo?.cloudBackups || []).forEach(b => { cloudMap[b.createdAt] = b; });
            
            // Also include cloud backups not in history
            const allBackups = [...history];
            (backupInfo?.cloudBackups || []).forEach(b => {
              if (!history.some(h => h.url === b.url)) {
                allBackups.push({ createdAt: b.createdAt, size: b.size, url: b.url });
              }
            });
            allBackups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const unique = allBackups.filter((b, i, arr) => i === 0 || b.url !== arr[i-1]?.url);

            if (unique.length === 0) {
              return <div style={{ color: '#888', fontSize: '0.9rem', padding: 16, textAlign: 'center' }}>No cloud backups yet. Run your first backup above.</div>;
            }

            return unique.map((b, i) => {
              const date = new Date(b.createdAt);
              const sizeKB = ((b.size || 0) / 1024).toFixed(0);
              const counts = b.counts || {};
              const totalRecords = Object.values(counts).reduce((s, c) => s + (c || 0), 0);
              const downloadUrl = b.url || cloudMap[b.createdAt]?.url;
              
              return (
                <div key={i} style={{
                  background: i === 0 ? '#e8f5e9' : 'white', border: `1px solid ${i === 0 ? '#66bb6a' : '#e0e0e0'}`,
                  borderRadius: 8, padding: '12px 16px', marginBottom: 8
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: counts && Object.keys(counts).length > 0 ? 8 : 0 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ color: '#888', marginLeft: 8, fontSize: '0.85rem' }}>
                        {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span style={{ color: '#555', marginLeft: 12, fontSize: '0.85rem' }}>
                        {sizeKB}KB
                      </span>
                      {b.duration && <span style={{ color: '#888', marginLeft: 8, fontSize: '0.8rem' }}>({b.duration})</span>}
                      {i === 0 && <span style={{ marginLeft: 8, background: '#2e7d32', color: 'white', padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600 }}>Latest</span>}
                    </div>
                    {downloadUrl && (
                      <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                        style={{ background: '#1976d2', color: 'white', padding: '6px 14px', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        ⬇ Download
                      </a>
                    )}
                  </div>
                  {counts && Object.keys(counts).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.8rem', color: '#666' }}>
                      {totalRecords > 0 && <span style={{ fontWeight: 600, color: '#333' }}>{totalRecords} records:</span>}
                      {counts.clients > 0 && <span>👤 {counts.clients} clients</span>}
                      {counts.workOrders > 0 && <span>📦 {counts.workOrders} WOs</span>}
                      {counts.estimates > 0 && <span>📋 {counts.estimates} estimates</span>}
                      {counts.shipments > 0 && <span>🚚 {counts.shipments} shipments</span>}
                      {counts.drNumbers > 0 && <span>DR: {counts.drNumbers}</span>}
                      {counts.poNumbers > 0 && <span>PO: {counts.poNumbers}</span>}
                      {counts.users > 0 && <span>👥 {counts.users} users</span>}
                      {counts.settings > 0 && <span>⚙️ {counts.settings} settings</span>}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

export default BackupPage;
