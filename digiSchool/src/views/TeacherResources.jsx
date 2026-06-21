import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { saveFile, listFiles, deleteFile, openFilePDF, downloadFilePDF } from '../lib/fileStore';
import { SUBJECTS, CLASSES } from '../data/seed';
import { Upload, Eye, Download, Trash2, FileText, BookOpen, Loader } from 'lucide-react';

const TABS = [
  { id: 'assignments', label: 'Assignments', icon: FileText },
  { id: 'materials', label: 'Study Materials', icon: BookOpen },
];

export default function TeacherResources({ store, user }) {
  const { notify } = store;
  const [tab, setTab] = useState('assignments');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState(null); // tracks which file is loading
  const [form, setForm] = useState({
    subject: SUBJECTS[0], targetClass: 'All Classes', title: '', description: '',
    dueDate: '', file: null, fileName: '',
  });
  const [subFilter, setSubFilter] = useState('All');

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFiles(tab, subFilter === 'All' ? null : subFilter);
      setFiles(data);
    } catch (e) {
      notify(`Failed to load files: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, subFilter, notify]);

  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { notify('Only PDF files are supported', 'warning'); return; }
    if (file.size > 20 * 1024 * 1024) { notify('File must be under 20MB', 'warning'); return; }
    setForm(f => ({ ...f, file, fileName: file.name }));
  };

  const handleUpload = async () => {
    if (!form.title.trim()) { notify('Title is required', 'warning'); return; }
    if (!form.file) { notify('Please select a PDF file', 'warning'); return; }
    if (tab === 'assignments' && !form.dueDate) { notify('Due date is required for assignments', 'warning'); return; }

    setUploading(true);
    try {
      const id = `file_${Date.now()}`;
      await saveFile({
        id,
        file: form.file,
        type: tab,
        subject: form.subject,
        targetClass: form.targetClass,
        description: form.title,
        dueDate: form.dueDate,
        uploadedBy: user?.name || 'Teacher',
      });
      await refreshFiles();
      setUploadModal(false);
      setForm({ subject: SUBJECTS[0], targetClass: 'All Classes', title: '', description: '', dueDate: '', file: null, fileName: '' });
      notify(`${tab === 'assignments' ? 'Assignment' : 'Material'} uploaded successfully`, 'success', 'Resources');
    } catch (e) {
      notify(`Upload failed: ${e.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, storagePath, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteFile(id, storagePath);
      setFiles(prev => prev.filter(f => f.id !== id));
      notify('File deleted', 'info');
    } catch (e) {
      notify(`Delete failed: ${e.message}`, 'error');
    }
  };

  const handleOpen = async (f) => {
    setActionId(f.id + '_open');
    try { await openFilePDF(f.storage_path); }
    catch (e) { notify(`Cannot open file: ${e.message}`, 'error'); }
    finally { setActionId(null); }
  };

  const handleDownload = async (f) => {
    setActionId(f.id + '_dl');
    try { await downloadFilePDF(f.storage_path, f.name); }
    catch (e) { notify(`Cannot download: ${e.message}`, 'error'); }
    finally { setActionId(null); }
  };

  const upTitle = tab === 'assignments' ? 'Upload Assignment' : 'Upload Study Material';

  return (
    <div>
      <PageHeader
        title="Teaching Resources"
        subtitle="Upload and manage assignments and study materials for students"
        actions={
          <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setUploadModal(true)}>
            <Upload size={16} /> {upTitle}
          </button>
        }
      />

      {/* Tab Nav */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => { setTab(t.id); setSubFilter('All'); }} style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <select className="select" style={{ width: 180 }} value={subFilter} onChange={e => setSubFilter(e.target.value)}>
          <option value="All">All Subjects</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 13 }}>{loading ? 'Loading…' : `${files.length} file${files.length !== 1 ? 's' : ''} on cloud`}</span>
      </div>

      {/* File List */}
      {loading ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 48 }}>
          <Loader size={32} color="#0078D4" style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <div className="muted">Loading files from Supabase…</div>
        </div>
      ) : files.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 48 }}>
          <Upload size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, color: '#475569' }}>No files uploaded yet</div>
          <p className="muted" style={{ fontSize: 13, margin: '4px 0 16px' }}>
            Upload {tab === 'assignments' ? 'assignments' : 'study materials'} as PDFs. Files are stored securely on Supabase Cloud Storage.
          </p>
          <button className="btn btn-primary" onClick={() => setUploadModal(true)}><Upload size={15} /> Upload Now</button>
        </div>
      ) : (
        <div className="card card-pad">
          <table className="table">
            <thead>
              <tr>
                <th>Title / File</th>
                <th>Subject</th>
                <th>Class</th>
                {tab === 'assignments' && <th>Due Date</th>}
                <th>Uploaded By</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{f.description || f.name}</div>
                    <div className="muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FileText size={11} /> {f.name}
                    </div>
                  </td>
                  <td><Badge color="blue">{f.subject}</Badge></td>
                  <td className="muted">{f.target_class}</td>
                  {tab === 'assignments' && (
                    <td style={{ color: f.due_date && new Date(f.due_date) < new Date() ? '#D13438' : '#107C10', fontWeight: 600, fontSize: 12 }}>
                      {f.due_date || '—'}
                    </td>
                  )}
                  <td className="muted">{f.uploaded_by}</td>
                  <td className="muted">{f.uploaded_at?.slice(0, 10)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm" title="View PDF" disabled={!!actionId} onClick={() => handleOpen(f)}>
                        {actionId === f.id + '_open' ? <Loader size={13} /> : <Eye size={13} />}
                      </button>
                      <button className="btn btn-sm" title="Download" disabled={!!actionId} onClick={() => handleDownload(f)}>
                        {actionId === f.id + '_dl' ? <Loader size={13} /> : <Download size={13} />}
                      </button>
                      <button className="btn btn-sm" title="Delete" style={{ color: '#D13438' }} onClick={() => handleDelete(f.id, f.storage_path, f.description || f.name)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <Modal title={upTitle} onClose={() => !uploading && setUploadModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={uploading} onClick={() => setUploadModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={uploading} onClick={handleUpload} style={{ gap: 6 }}>
              {uploading ? <><Loader size={14} /> Uploading to Supabase…</> : <><Upload size={14} /> Upload</>}
            </button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Title *</label>
              <input className="input" placeholder={tab === 'assignments' ? 'e.g. Quadratic Equations Holiday Assignment' : 'e.g. Cell Biology Notes'} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Description (optional)</label>
              <textarea className="input" rows={2} placeholder="Additional notes for students..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Subject</label>
                <select className="select" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Target Class</label>
                <select className="select" value={form.targetClass} onChange={e => setForm(f => ({ ...f, targetClass: e.target.value }))}>
                  <option value="All Classes">All Classes</option>
                  {CLASSES.map(c => <option key={c} value={`Grade ${c}`}>Grade {c}</option>)}
                </select>
              </div>
            </div>
            {tab === 'assignments' && (
              <div>
                <label className="field-label">Due Date *</label>
                <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="field-label">PDF File * <span className="muted">(max 20 MB)</span></label>
              <label style={{ display: 'block', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                <div style={{ border: `2px dashed ${form.fileName ? '#0078D4' : 'var(--border)'}`, borderRadius: 8, padding: 24, textAlign: 'center', background: form.fileName ? '#e8f0fe' : '#f8fafc', transition: 'all 0.2s' }}>
                  {form.fileName ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <FileText size={20} color="#0078D4" />
                      <span style={{ fontWeight: 600, color: '#0078D4' }}>{form.fileName}</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 600, color: '#475569' }}>Click to select a PDF</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Files are uploaded directly to Supabase Cloud Storage</div>
                    </>
                  )}
                </div>
                <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={uploading} onChange={handleFileSelect} />
              </label>
            </div>
            {uploading && (
              <div style={{ background: '#e8f0fe', borderRadius: 6, padding: 10, fontSize: 13, color: '#0078D4', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Loader size={14} /> Uploading to Supabase Storage — please wait…
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
