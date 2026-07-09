import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader, KpiCard } from '../components/widgets';
import { Search, GraduationCap, Users, UserCheck } from 'lucide-react';

export default function ClassTeachers(props) {
  const context = useOutletContext() || {};
  const store = props.store || context.store;
  const user = props.user || context.user;
  
  const { teachers = [], updateTeacher, settings = {}, notify } = store || {};
  const [searchTerm, setSearchTerm] = useState('');

  const classes = useMemo(() => {
    const raw = Array.isArray(settings.classes) ? settings.classes : [];
    return raw.map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean);
  }, [settings.classes]);

  const assignedCount = classes.filter(cls => teachers.some(t => t.assignedClass === cls)).length;

  const handleAssign = (cls, teacherId) => {
    // Unassign this class from any current teacher
    const currentTeacher = teachers.find(t => t.assignedClass === cls);
    if (currentTeacher && currentTeacher.id !== teacherId) {
      updateTeacher(currentTeacher.id, { assignedClass: null });
    }
    
    if (teacherId) {
      const newTeacher = teachers.find(t => t.id === teacherId);
      if (newTeacher.assignedClass && newTeacher.assignedClass !== cls) {
        if (!confirm(`${newTeacher.name} is already assigned to ${newTeacher.assignedClass}. Reassign to ${cls}?`)) return;
      }
      updateTeacher(teacherId, { assignedClass: cls });
      notify(`${newTeacher.name} assigned as Class Teacher for ${cls}`, 'success');
    } else {
      notify(`Removed Class Teacher for ${cls}`, 'info');
    }
  };

  const filteredClasses = classes.filter(cls => cls.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <PageHeader title="Class Teachers" subtitle="Assign class teachers for the academic year" />

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <KpiCard iconComponent={<GraduationCap size={20} />} label="Total Classes" value={classes.length} />
        <KpiCard iconComponent={<UserCheck size={20} />} label="Assigned" value={assignedCount} accent="#107C10" />
        <KpiCard iconComponent={<Users size={20} />} label="Unassigned" value={classes.length - assignedCount} accent={assignedCount === classes.length ? '#107C10' : '#D13438'} />
      </div>

      <div className="card card-pad" style={{ marginBottom: 24, paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Search size={18} color="#64748b" />
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Class</th>
                <th>Assigned Teacher</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>No classes found.</td></tr>
              ) : (
                filteredClasses.map(cls => {
                  const assigned = teachers.find(t => t.assignedClass === cls);
                  return (
                    <tr key={cls}>
                      <td style={{ fontWeight: 600 }}>{cls}</td>
                      <td>
                        <select 
                          className="select" 
                          value={assigned?.id || ''} 
                          onChange={(e) => handleAssign(cls, e.target.value)}
                          style={{ maxWidth: 280 }}
                        >
                          <option value="">-- Unassigned --</option>
                          {teachers.filter(t => t.status !== 'Inactive').map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
                          ))}
                        </select>
                      </td>
                      <td className="muted">{assigned?.department || '-'}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                          background: assigned ? '#dcfce7' : '#fee2e2',
                          color: assigned ? '#166534' : '#991b1b'
                        }}>
                          {assigned ? 'Assigned' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
