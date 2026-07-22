import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader, KpiCard } from '../components/widgets';
import { Search, GraduationCap, Users, UserCheck } from 'lucide-react';
import { expandClassesWithStreams } from '../data/seed';

export default function ClassTeachers(props) {
  const context = useOutletContext() || {};
  const store = props.store || context.store;
  const user = props.user || context.user;
  
  const { teachers = [], updateTeacher, settings = {}, notify } = store || {};
  const [searchTerm, setSearchTerm] = useState('');

  const getTeacherClasses = (t) => {
    if (!t || !t.assignedClass) return [];
    if (Array.isArray(t.assignedClass)) return t.assignedClass;
    return String(t.assignedClass).split(',').map(s => s.trim()).filter(Boolean);
  };

  const classes = useMemo(() => {
    return expandClassesWithStreams(settings.classes || []);
  }, [settings.classes]);

  const assignedCount = classes.filter(cls => teachers.some(t => getTeacherClasses(t).includes(cls))).length;

  const handleAssign = (cls, teacherId) => {
    // 1. Remove this class `cls` from any teacher currently assigned
    teachers.forEach(t => {
      const currentList = getTeacherClasses(t);
      if (currentList.includes(cls) && t.id !== teacherId) {
        const updatedList = currentList.filter(c => c !== cls);
        updateTeacher(t.id, { assignedClass: updatedList.length ? updatedList.join(', ') : null });
      }
    });

    // 2. Add `cls` to selected teacher's assigned classes list
    if (teacherId) {
      const newTeacher = teachers.find(t => t.id === teacherId);
      if (newTeacher) {
        const currentList = getTeacherClasses(newTeacher);
        if (!currentList.includes(cls)) {
          const updatedList = [...currentList, cls];
          updateTeacher(teacherId, { assignedClass: updatedList.join(', ') });
        }
        notify(`${newTeacher.name} assigned as Class Teacher for ${cls}`, 'success');
      }
    } else {
      notify(`Removed Class Teacher for ${cls}`, 'info');
    }
  };

  const filteredClasses = classes.filter(cls => cls.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <PageHeader title="Class Teachers" subtitle="Assign class teachers for the academic year (teachers can lead multiple classes)" />

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
                  const assigned = teachers.find(t => getTeacherClasses(t).includes(cls));
                  return (
                    <tr key={cls}>
                      <td style={{ fontWeight: 600 }}>{cls}</td>
                      <td>
                        <select 
                          className="select" 
                          value={assigned?.id || ''} 
                          onChange={(e) => handleAssign(cls, e.target.value)}
                          style={{ maxWidth: 320 }}
                        >
                          <option value="">-- Unassigned --</option>
                          {teachers.filter(t => t.status !== 'Inactive').map(t => {
                            const tClasses = getTeacherClasses(t);
                            const classLabel = tClasses.length > 0 ? ` [Leads: ${tClasses.join(', ')}]` : '';
                            return (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.subject || 'General'}){classLabel}
                              </option>
                            );
                          })}
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



