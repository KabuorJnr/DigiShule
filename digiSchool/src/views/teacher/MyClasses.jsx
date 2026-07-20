import { useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import { Printer, Users, Award } from 'lucide-react';
import Modal from '../../components/Modal';
import PrintHeader from '../../components/PrintHeader';

export default function MyClasses() {
  const { store, teacherName, assignedClass, loadedStudents } = useOutletContext();

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [behaviorModalOpen, setBehaviorModalOpen] = useState(false);
  const [behaviorForm, setBehaviorForm] = useState({ student: '', type: 'Merit', points: 5, notes: '' });

  const handleLogBehavior = () => {
    if (!behaviorForm.student) return store.notify('Please select a student', 'warning');
    store.notify(`Logged ${behaviorForm.type} (${behaviorForm.points} pts) for ${behaviorForm.student}.`, 'success');
    setBehaviorModalOpen(false);
    setBehaviorForm({ student: '', type: 'Merit', points: 5, notes: '' });
  };

  const handleExportAttendanceSummary = async () => {
    store.notify('Downloading Class Attendance Summary PDF...', 'info');
    const { exportTablePDF } = await import('../../utils/exporters');
    const head = ['Student Name', 'Present', 'Absent', 'Late', 'Attendance %'];
    const body = loadedStudents.filter(s => s.class === assignedClass).map(s => [s.name, '-', '-', '-', '-']);
    exportTablePDF({ school: store.settings, title: `Attendance Summary - ${assignedClass}`, subtitle: 'Term 2', head, body, filename: `attendance_summary_${assignedClass}.pdf` });
  };

  const handleExportAttendanceReport = async () => {
    store.notify('Downloading Students Attendance Report CSV...', 'info');
    const { downloadCSV } = await import('../../utils/exporters');
    const rows = [['Student Name', 'Date', 'Status', 'Remarks'], ...loadedStudents.filter(s => s.class === assignedClass).map(s => [s.name, new Date().toISOString().slice(0, 10), '-', ''])];
    downloadCSV(`attendance_report_${assignedClass}.csv`, rows);
  };

  if (!assignedClass) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
        <Users size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
        <div>You are not currently assigned as a Class Teacher.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: '#ecfdf5', border: '1px solid #ccfbf1', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#065f46', fontWeight: 700, fontSize: 16 }}>
            <Users size={18} /> Class Teacher: {assignedClass}
          </div>
          <div style={{ color: '#065f46', opacity: 0.8, fontSize: 13, marginTop: 4 }}>
            You are assigned to manage {assignedClass}.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" style={{ background: '#065f46', borderColor: '#065f46', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setBehaviorModalOpen(true)}>
            <Award size={16} /> Log Behavior
          </button>
          <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setPrintModalOpen(true)}>
            <Printer size={16} /> Print Class List
          </button>
          <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleExportAttendanceSummary}>
            <Printer size={16} /> Summary (PDF)
          </button>
          <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleExportAttendanceReport}>
            <Printer size={16} /> Report (CSV)
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <h3 style={{ margin: '0 0 16px' }}>Students in {assignedClass}</h3>
        <table className="table">
          <thead><tr><th>#</th><th>Adm No.</th><th>Student Name</th><th>Gender</th></tr></thead>
          <tbody>
            {loadedStudents.filter(s => s.class === assignedClass).map((s, idx) => (
              <tr key={s.id}>
                <td>{idx + 1}</td>
                <td>{s.adm}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.gender || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {printModalOpen && (
        <div className="modal-overlay" onMouseDown={() => setPrintModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>{assignedClass} â€” Class List</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} style={{ marginRight: 6 }}/> Print PDF</button>
                <button className="btn btn-icon btn-sm" onClick={() => setPrintModalOpen(false)}>âœ•</button>
              </div>
            </div>
            <div className="print-area" style={{ padding: 24, background: '#fff' }}>
              <PrintHeader settings={store.settings} />
              <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #000', paddingBottom: 16 }}>
                <h2 style={{ margin: '0 0 4px 0', color: '#475569' }}>Official Class List â€” {assignedClass}</h2>
                <div className="muted" style={{ fontSize: 13 }}>Class Teacher: {teacherName}</div>
              </div>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: 8, textAlign: 'left' }}>#</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: 8, textAlign: 'left' }}>Adm No.</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: 8, textAlign: 'left' }}>Student Name</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: 8, textAlign: 'left' }}>Gender</th>
                  </tr>
                </thead>
                <tbody>
                  {loadedStudents.filter(s => s.class === assignedClass).map((s, idx) => (
                    <tr key={s.id}>
                      <td style={{ borderBottom: '1px solid #e2e8f0', padding: 8 }}>{idx + 1}</td>
                      <td style={{ borderBottom: '1px solid #e2e8f0', padding: 8 }}>{s.adm}</td>
                      <td style={{ borderBottom: '1px solid #e2e8f0', padding: 8, fontWeight: 600 }}>{s.name}</td>
                      <td style={{ borderBottom: '1px solid #e2e8f0', padding: 8 }}>{s.gender || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {behaviorModalOpen && (
        <Modal title="Log Student Behavior" onClose={() => setBehaviorModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setBehaviorModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleLogBehavior}>Save Record</button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Student</label>
              <select className="select" value={behaviorForm.student} onChange={e => setBehaviorForm(f => ({ ...f, student: e.target.value }))}>
                <option value="">Select student...</option>
                {loadedStudents.filter(s => !assignedClass || s.class === assignedClass).map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.adm})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-2">
              <div><label className="field-label">Type</label><select className="select" value={behaviorForm.type} onChange={e => setBehaviorForm(f => ({ ...f, type: e.target.value }))}><option value="Merit">Merit (Positive)</option><option value="Demerit">Demerit (Negative)</option></select></div>
              <div><label className="field-label">Points</label><input type="number" className="input" value={behaviorForm.points} onChange={e => setBehaviorForm(f => ({ ...f, points: Number(e.target.value) }))} /></div>
            </div>
            <div><label className="field-label">Notes/Reason</label><textarea className="input" rows={3} value={behaviorForm.notes} onChange={e => setBehaviorForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}



