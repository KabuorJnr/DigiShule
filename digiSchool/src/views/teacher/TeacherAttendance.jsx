import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react';
import { upsertRow, fetchTable } from '../../lib/api';

export default function TeacherAttendance() {
  const { store, assignedClass, loadedStudents } = useOutletContext();
  const [selectedClass, setSelectedClass] = useState(assignedClass || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Local state to track today's selected attendance statuses (adm -> status)
  const [attendanceState, setAttendanceState] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // We can derive all available classes from loadedStudents or store
  const availableClasses = useMemo(() => {
    const classes = [...new Set(loadedStudents.map(s => s.class))].filter(Boolean);
    return classes.sort();
  }, [loadedStudents]);

  // Set default class if not assigned but classes are available
  useEffect(() => {
    if (!selectedClass && availableClasses.length > 0) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  const studentsInClass = useMemo(() => {
    return loadedStudents.filter(s => s.class === selectedClass);
  }, [loadedStudents, selectedClass]);

  // When class or date changes, we should try to fetch existing attendance for that date to pre-fill
  useEffect(() => {
    let active = true;
    if (!selectedClass) return;
    
    setLoadingHistory(true);
    fetchTable('studentAttendance').then(rows => {
      if (!active) return;
      const todays = (rows || []).filter(r => r.date === date && r.class === selectedClass);
      
      const newState = {};
      todays.forEach(record => {
        newState[record.adm] = record.status;
      });
      setAttendanceState(newState);
      setLoadingHistory(false);
    }).catch(() => {
      if (active) setLoadingHistory(false);
    });
    return () => { active = false; };
  }, [selectedClass, date]);

  const handleMark = (adm, status) => {
    setAttendanceState(prev => ({ ...prev, [adm]: status }));
  };

  const markAll = (status) => {
    const newState = { ...attendanceState };
    studentsInClass.forEach(s => {
      newState[s.adm] = status;
    });
    setAttendanceState(newState);
  };

  const handleSave = async () => {
    if (studentsInClass.length === 0) return store.notify('No students to mark.', 'warning');
    
    setSaving(true);
    try {
      const recordsToUpsert = studentsInClass.map(student => {
        const status = attendanceState[student.adm] || 'Present'; // Default to present if unmarked but saved
        return {
          id: `att_${student.adm}_${date}`,
          date,
          student_id: student.id,
          adm: student.adm,
          class: selectedClass,
          status,
          recorded_by: store.currentUser?.name || 'Teacher'
        };
      });

      // Upsert sequentially or Promise.all. 
      // api.js doesn't have upsertMany natively, so we loop:
      await Promise.all(recordsToUpsert.map(rec => upsertRow('student_attendance', rec)));

      store.notify('Attendance saved successfully!', 'success');
    } catch (e) {
      store.notify(`Failed to save attendance: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Daily Attendance</h2>
          <p className="muted" style={{ margin: 0 }}>Mark student attendance for your classes</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field-group">
            <label className="field-label">Date</label>
            <div className="input-with-icon">
              <Calendar size={16} />
              <input 
                type="date" 
                className="input" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Class</label>
            <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            {selectedClass} Students ({studentsInClass.length})
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => markAll('Present')} style={{ color: '#047857', borderColor: '#047857' }}>Mark All Present</button>
            <button className="btn btn-sm" onClick={() => markAll('Absent')} style={{ color: '#EF4444', borderColor: '#EF4444' }}>Mark All Absent</button>
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading existing records...</div>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Adm</th>
                  <th>Student Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {studentsInClass.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 30 }}>
                      No students found in {selectedClass}
                    </td>
                  </tr>
                ) : (
                  studentsInClass.map(s => {
                    const status = attendanceState[s.adm];
                    return (
                      <tr key={s.id}>
                        <td className="muted">{s.adm}</td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button 
                              className={`btn btn-sm ${status === 'Present' ? 'btn-primary' : ''}`}
                              style={status === 'Present' ? { background: '#047857', borderColor: '#047857', color: '#fff' } : {}}
                              onClick={() => handleMark(s.adm, 'Present')}
                            >
                              <CheckCircle2 size={14} /> Present
                            </button>
                            <button 
                              className={`btn btn-sm ${status === 'Absent' ? 'btn-primary' : ''}`}
                              style={status === 'Absent' ? { background: '#EF4444', borderColor: '#EF4444', color: '#fff' } : {}}
                              onClick={() => handleMark(s.adm, 'Absent')}
                            >
                              <XCircle size={14} /> Absent
                            </button>
                            <button 
                              className={`btn btn-sm ${status === 'Late' ? 'btn-primary' : ''}`}
                              style={status === 'Late' ? { background: '#F59E0B', borderColor: '#F59E0B', color: '#fff' } : {}}
                              onClick={() => handleMark(s.adm, 'Late')}
                            >
                              <Clock size={14} /> Late
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button 
            className="btn btn-primary" 
            style={{ minWidth: 120 }} 
            onClick={handleSave}
            disabled={saving || studentsInClass.length === 0}
          >
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}



