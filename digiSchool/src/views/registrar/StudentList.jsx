import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { Search, Loader, Users, AlertTriangle, CheckCircle2, Edit2, FileText, Download, Mail, Printer } from 'lucide-react';
import { fetchStudents, upsertStudent, deleteStudent } from '../../lib/api';
import { sendParentPinEmail } from '../../utils/auth';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { exportReportCardsPDF, exportNemisCSV, exportTablePDF } from '../../utils/exporters';
import { SUBJECTS, expandClassesWithStreams, getDynamicClasses } from '../../data/seed';

export default function StudentList() {
  const { store } = useOutletContext();
  const { notify } = store;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [sendingPin, setSendingPin] = useState(null);

  // Modals state
  const [editModal, setEditModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Fetch Students with Pagination
  const { data, isLoading } = useQuery({
    queryKey: ['students', page, search, classFilter],
    queryFn: () => fetchStudents(page, 50, { search, class: classFilter === 'All' ? null : classFilter, activeOnly: true }),
    keepPreviousData: true,
  });

  const localStudents = data?.data || [];
  const totalStudents = data?.count || 0;

  const dynamicClasses = useMemo(() => {
    const saved = expandClassesWithStreams(store.settings?.classes || []);
    const dynamic = getDynamicClasses(localStudents);
    return [...new Set([...saved, ...dynamic])];
  }, [localStudents, store.settings]);

  const filtered = useMemo(() => {
    return localStudents.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated');
  }, [localStudents]);

  const byClass = useMemo(() => {
    const map = {};
    filtered.forEach(s => { (map[s.class] ||= []).push(s); });
    return map;
  }, [filtered]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (student) => upsertStudent(student),
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setEditModal(false);
      notify('Student record updated', 'success', 'Registrar');
    },
    onError: (e) => notify(`Save failed: ${e.message}`, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteStudent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['students']);
      setDeleteConfirmModal(false);
      setSelectedStudent(null);
      setDeleteReason('');
      notify(`Student permanently deleted from system`, 'success');
    },
    onError: (e) => notify(`Deletion failed: ${e.message}`, 'error')
  });

  const handleEdit = (student) => {
    setEditStudent({ ...student });
    setEditModal(true);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate(editStudent);
  };

  const handleDeregister = () => {
    if (!deleteReason.trim()) return notify('Please state the issue/reason for deletion', 'error');
    deleteMutation.mutate(selectedStudent.id);
  };

  // Exporters
  const exportNEMIS = () => {
    exportNemisCSV(filtered, 'NEMIS_Export_Term2.csv');
    notify('NEMIS file generated successfully', 'success');
  };

  const exportCSV = () => {
    const rows = [['Adm No.', 'Name', 'Class', 'Gender'], ...filtered.map(s => [s.adm, s.name, s.class, s.gender || '-'])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `student_register_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    notify('Register exported as CSV', 'success');
  };

  const exportContactsCSV = () => {
    const rows = [
      ['Adm No.', 'Student Name', 'Class', 'Guardian Name', 'Guardian Phone', 'Guardian Email'],
      ...filtered.map(s => [s.adm, s.name, s.class, s.guardianName || '-', s.guardianPhone || '-', s.guardianEmail || '-']),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `parent_contacts_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    notify('Contacts exported as CSV', 'success');
  };

  const handleSendPin = async (student) => {
    if (!student.guardianEmail) {
      return notify('No guardian email found for this student', 'warning');
    }
    setSendingPin(student.id);
    try {
      await sendParentPinEmail({
        email: student.guardianEmail,
        parentName: student.guardianName,
        studentName: student.name,
        admNumber: student.adm,
        parentPin: student.parent_pin,
        schoolName: store.settings?.name
      });
      notify(`PIN emailed to ${student.guardianEmail}`, 'success');
    } catch (e) {
      notify(e.message || 'Failed to send PIN', 'error');
    } finally {
      setSendingPin(null);
    }
  };

  const handlePrintClassListPDF = () => {
    if (filtered.length === 0) return notify('No students in current view', 'warning');
    const head = ['#', 'Adm No', 'Student Name', 'Gender', 'Class', 'Guardian Name', 'Phone'];
    const body = filtered.map((s, idx) => [
      idx + 1,
      s.adm || s.admission_no || '-',
      s.name || '-',
      s.gender || '-',
      s.class || '-',
      s.guardianName || s.guardian_name || '-',
      s.guardianPhone || s.guardian_phone || '-'
    ]);

    exportTablePDF({
      school: store.settings,
      title: `CLASS REGISTER / ROSTER - ${classFilter === 'All' ? 'ALL CLASSES' : classFilter.toUpperCase()}`,
      subtitle: `Total Students: ${filtered.length} | Date: ${new Date().toLocaleDateString()}`,
      head,
      body,
      filename: `class_list_${classFilter === 'All' ? 'school' : classFilter.replace(/\s+/g, '_')}.pdf`
    });
    notify(`Class List PDF generated for ${filtered.length} student(s)`, 'success');
  };

  const handleDownloadReportCards = () => {
    if (filtered.length === 0) return notify('No students in current view', 'warning');
    exportReportCardsPDF({
      school: store.settings,
      gradeBoundaries: store.gradeBoundaries,
      students: filtered,
      subjects: SUBJECTS,
      examTitle: 'Term 1 Opening Exam',
      termName: 'Term 1',
      filename: `report_cards_${classFilter === 'All' ? 'school' : classFilter}.pdf`
    });
    notify('Report Cards generated', 'success');
  };

  return (
    <>
      {/* Exporter Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ gap: 6 }} onClick={handlePrintClassListPDF}><Printer size={15} /> Printable Class List (PDF)</button>
        <button className="btn" style={{ gap: 6 }} onClick={exportCSV}><Download size={15} /> Student Roster (CSV)</button>
        <button className="btn" style={{ gap: 6 }} onClick={exportContactsCSV}><Download size={15} /> Parent Contacts</button>
        <button className="btn btn-outline" style={{ gap: 6, borderColor: '#0ea5e9', color: '#0ea5e9' }} onClick={exportNEMIS}><Download size={15} /> NEMIS Export</button>
        <button className="btn" style={{ gap: 6 }} onClick={handleDownloadReportCards}><FileText size={15} /> Batch Report Cards</button>
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="input" style={{ paddingLeft: 32, width: 220 }} placeholder="Search name or adm no…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 160 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="All">All Classes</option>
          {dynamicClasses.map(c => <option key={c} value={c}>Grade {c}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>{totalStudents} total student{totalStudents !== 1 ? 's' : ''}</span>
        {isLoading && <Loader size={14} className="spin" style={{ color: '#0078D4', alignSelf: 'center' }} />}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span style={{ fontSize: 13, alignSelf: 'center' }}>Page {page + 1}</span>
            <button className="btn" disabled={localStudents.length < 50} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </div>

      {Object.entries(byClass).length === 0 && !isLoading ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
          <Users size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
          <div className="muted">No students found</div>
        </div>
      ) : (
        Object.entries(byClass).sort(([a], [b]) => a.localeCompare(b)).map(([cls, list]) => (
          <div key={cls} className="card card-pad" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0078D4' }}>{cls}</div>
              <Badge color="gray">{list.length} students</Badge>
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Adm No.</th><th>Full Name</th><th>Gender</th><th>Parent PIN</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {list.map(s => (
                    <tr key={s.id}>
                      <td className="muted">{s.adm}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.gender || '-'}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#334155', fontWeight: 600, letterSpacing: 1 }}>
                          {s.parent_pin || 'Pending'}
                        </span>
                        <button 
                          onClick={() => handleSendPin(s)} 
                          disabled={sendingPin === s.id || !s.guardianEmail}
                          style={{ background: 'transparent', border: 'none', cursor: s.guardianEmail ? 'pointer' : 'not-allowed', marginLeft: 8, padding: 4, opacity: s.guardianEmail ? 1 : 0.3 }} 
                          title={s.guardianEmail ? `Email PIN to ${s.guardianEmail}` : 'No guardian email'}
                        >
                          {sendingPin === s.id ? <Loader size={14} className="spin" color="#047857" /> : <Mail size={14} color="#047857" />}
                        </button>
                      </td>
                      <td>
                        {s.flagged
                          ? <Badge color="red"><AlertTriangle size={11} style={{ marginRight: 3 }} />Flagged</Badge>
                          : <Badge color="green"><CheckCircle2 size={11} style={{ marginRight: 3 }} />Active</Badge>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => setSelectedStudent(s)}>
                            View Profile
                          </button>
                          <button className="btn btn-sm" style={{ gap: 4 }} onClick={() => handleEdit(s)}>
                            <Edit2 size={13} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Edit Modal */}
      {editModal && editStudent && (
        <Modal title="Edit Student Record" onClose={() => setEditModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setEditModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={updateMutation.isLoading} onClick={handleSaveEdit}>
              {updateMutation.isLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Full Name</label>
                <input className="input" value={editStudent.name} onChange={e => setEditStudent(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Adm No.</label>
                <input className="input" value={editStudent.adm} onChange={e => setEditStudent(s => ({ ...s, adm: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Class</label>
                <select className="select" value={editStudent.class || ''} onChange={e => setEditStudent(s => ({ ...s, class: e.target.value }))}>
                  <option value="" disabled>Select Class...</option>
                  {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Gender</label>
                <select className="select" value={editStudent.gender || 'Male'} onChange={e => setEditStudent(s => ({ ...s, gender: e.target.value }))}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">NEMIS UPI Number</label>
                <input className="input" value={editStudent.nemisUpi || ''} onChange={e => setEditStudent(s => ({ ...s, nemisUpi: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Birth Certificate No.</label>
                <input className="input" value={editStudent.birthCertNo || ''} onChange={e => setEditStudent(s => ({ ...s, birthCertNo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Nationality</label>
                <input className="input" value={editStudent.nationality || ''} onChange={e => setEditStudent(s => ({ ...s, nationality: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">County</label>
                <input className="input" value={editStudent.county || ''} onChange={e => setEditStudent(s => ({ ...s, county: e.target.value }))} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Selected Student Modal */}
      {selectedStudent && !deleteConfirmModal && (
        <Modal title="Student Profile" onClose={() => setSelectedStudent(null)} footer={
          <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'space-between' }}>
            <button 
              className="btn" 
              style={{ background: '#eef2ff', color: '#4f46e5', borderColor: '#c7d2fe', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }} 
              onClick={() => {
                store.navigate('student', { childId: selectedStudent.id });
              }}
            >
              Access Student Portal
            </button>
            <button className="btn" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => setDeleteConfirmModal(true)}>Delete Permanently...</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
                {selectedStudent.name[0]}
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{selectedStudent.name}</h3>
                <div className="muted">{selectedStudent.adm}  |  {selectedStudent.class}</div>
              </div>
            </div>
            <div className="grid grid-2">
              <div><label className="field-label">Gender</label><div className="font-semibold">{selectedStudent.gender || '-'}</div></div>
              <div><label className="field-label">Date of Birth</label><div className="font-semibold">{selectedStudent.dob || '-'}</div></div>
              <div><label className="field-label">Parent/Guardian</label><div className="font-semibold">{selectedStudent.guardianName || '-'}</div></div>
              <div><label className="field-label">Contact Phone</label><div className="font-semibold">{selectedStudent.guardianPhone || '-'}</div></div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <Modal title="Permanent Deletion" onClose={() => setDeleteConfirmModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setDeleteConfirmModal(false)}>Cancel</button>
            <button className="btn" style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }} disabled={deleteMutation.isLoading} onClick={handleDeregister}>
              {deleteMutation.isLoading ? 'Deleting…' : 'Confirm Deletion'}
            </button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 16, borderRadius: 8, fontSize: 13, display: 'flex', gap: 8 }}>
              <AlertTriangle size={16} />
              <div>
                <strong>Warning:</strong> You are about to permanently delete <strong>{selectedStudent?.name}</strong>.
                This will wipe all their academic history and accounts. For normal exits, please use the <strong>Transfers & Exits</strong> tab instead.
              </div>
            </div>
            <div>
              <label className="field-label">Reason for Permanent Deletion</label>
              <textarea className="input" rows={2} placeholder="e.g. Duplicate record, entered in error..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}



