import { useState, useEffect } from 'react';
import { PageHeader, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { saveFile, listFiles, deleteFile, openFilePDF, downloadFilePDF } from '../lib/fileStore';
import { SUBJECTS, CLASSES } from '../data/seed';
import { Upload, Eye, Download, Trash2, FileText, BookOpen } from 'lucide-react';

const TABS = [
  { id: 'assignments', label: 'Assignments', icon: FileText },
  { id: 'materials', label: 'Study Materials', icon: BookOpen },
];

export default function TeacherResources({ store, user }) {
  const { notify } = store;
  const [tab, setTab] = useState('assignments');
  const [files, setFiles] = useState([]);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    subject: SUBJECTS[0], targetClass: 'All Classes', title: '', description: '',
    dueDate: '', file: null, fileName: '',
  });
  const [subFilter, setSubFilter] = useState('All');

  const refreshFiles = () => setFiles(listFiles(tab));

  useEffect(() => { refreshFiles(); }, [tab]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { notify('Only PDF files are supported', 'warning'); return; }
    if (file.size > 5 * 1024 * 1024) { notify('File must be under 5MB', 'warning'); return; }
    setForm(f => ({ ...f, file, fileName: file.name }));
  };

  const handleUpload = () => {
    if (!form.title.trim()) { notify('Title is required', 'warning'); return; }
    if (!form.file) { notify('Please select a PDF file', 'warning'); return; }
    if (tab === 'assignments' && !form.dueDate) { notify('Due date is required for assignments', 'warning'); return; }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const id = `file_${Date.now()}`;
      saveFile({
        id, name: form.fileName, base64: String(e.target.result),
        type: tab, subject: form.subject, targetClass: form.targetClass,
        description: form.description, dueDate: form.dueDate,
        uploadedBy: user?.name || 'Teacher',
      });
      refreshFiles();
      setUploadModal(false);
      setForm({ subject: SUBJECTS[0], targetClass: 'All Classes', title: '', description: '', dueDate: '', file: null, fileName: '' });
      setUploading(false);
      notify(`${tab === 'assignments' ? 'Assignment' : 'Material'} uploaded successfully`, 'success', 'Resources');
    };
    reader.readAsDataURL(form.file);
  };

  const handleDelete = (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    deleteFile(id);
    refreshFiles();
    notify('File deleted', 'info');
  };

  const filtered = files.filter(f => subFilter === 'All' || f.subject === subFilter);
  const title = tab === 'assignments' ? 'Upload Assignment' : 'Upload Study Material';

  return (
    <div>
      <PageHeader
        title="Teaching Resources"
        subtitle="Upload assignments and study materials for students"
        actions={
          <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setUploadModal(true)}>
            <Upload size={16} /> {title}
          </button>
        }
      />

      {/* Tab Nav */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)} style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
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
        <span className="muted" style={{ fontSize: 13 }}>{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* File List */}
      {filtered.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 48 }}>
          <Upload size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, color: '#475569' }}>No files uploaded yet</div>
          <p className="muted" style={{ fontSize: 13, margin: '4px 0 16px' }}>
            Upload {tab === 'assignments' ? 'assignments' : 'study materials'} as PDFs for students to access.
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
              {filtered.map(f => (
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{f.description || f.name}</div>
                    <div className="muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FileText size={11} /> {f.name}
                    </div>
                  </td>
                  <td><Badge color="blue">{f.subject}</Badge></td>
                  <td className="muted">{f.targetClass}</td>
                  {tab === 'assignments' && <td style={{ color: new Date(f.dueDate) < new Date() ? '#D13438' : '#107C10', fontWeight: 600, fontSize: 12 }}>{f.dueDate || '—'}</td>}
                  <td className="muted">{f.uploadedBy}</td>
                  <td className="muted">{f.uploadedAt?.slice(0, 10)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm" style={{ gap: 4 }} title="View PDF" onClick={() => openFilePDF(f.id)}><Eye size={13} /></button>
                      <button className="btn btn-sm" style={{ gap: 4 }} title="Download" onClick={() => downloadFilePDF(f.id)}><Download size={13} /></button>
                      <button className="btn btn-sm" style={{ gap: 4, color: '#D13438' }} title="Delete" onClick={() => handleDelete(f.id, f.description || f.name)}><Trash2 size={13} /></button>
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
        <Modal title={title} onClose={() => setUploadModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setUploadModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={uploading} onClick={handleUpload}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Title *</label>
              <input className="input" placeholder={tab === 'assignments' ? 'e.g. Quadratic Equations Holiday Assignment' : 'e.g. Cell Biology Notes'} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Description</label>
              <textarea className="input" rows={3} placeholder="Brief description of content..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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
                  {CLASSES.map(c => <option key={c} value={`Form ${c}`}>Form {c}</option>)}
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
              <label className="field-label">PDF File *</label>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <div style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: 24, textAlign: 'center', background: '#f8fafc', transition: 'border-color 0.2s' }}>
                  {form.fileName ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <FileText size={20} color="#0078D4" />
                      <span style={{ fontWeight: 600, color: '#0078D4' }}>{form.fileName}</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 600, color: '#475569' }}>Click to select a PDF</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>PDF only · Max 5MB</div>
                    </>
                  )}
                </div>
                <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
