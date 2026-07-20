import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import { fetchTable, upsertRow } from '../lib/api';
import { expandClassesWithStreams, SUBJECTS, DEPARTMENTS, DEPT_COLORS } from '../data/seed';
import Modal from '../components/Modal';
import {
  Users, UserCheck, Building2, BookOpen, ClipboardList, BarChart3,
  GraduationCap, Search, Filter, RotateCcw, Zap, Eye, EyeOff,
  Calendar, CheckCircle2, AlertTriangle, Plus, Trash2, Info, X
} from 'lucide-react';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPER COMPONENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const AVATAR_COLORS = [
  '#047857', '#047857', '#F59E0B', '#EF4444', '#047857',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#047857'
];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function TeacherAvatar({ name, id, size = 40 }) {
  const initials = (name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color = AVATAR_COLORS[hashCode(id || name) % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, flexShrink: 0, letterSpacing: 0.5
    }}>
      {initials}
    </div>
  );
}

function WorkloadBadge({ periods, max = 40 }) {
  const p = periods || 0;
  const color = p < 20 ? '#047857' : p < 30 ? '#F59E0B' : '#EF4444';
  const bg = p < 20 ? '#dcfce7' : p < 30 ? '#fef3c7' : '#fee2e2';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
      background: bg, color
    }}>
      {p}/{max}
    </span>
  );
}

function QualificationBadge({ level, name }) {
  const isP = level === 'primary';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
      background: isP ? '#dbeafe' : '#dcfce7',
      color: isP ? '#064e3b' : '#166534', marginRight: 4, marginBottom: 4
    }}>
      {name}
    </span>
  );
}

function StatusPill({ status }) {
  const assigned = status === 'assigned';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
      background: assigned ? '#dcfce7' : '#f1f5f9',
      color: assigned ? '#166534' : '#475569'
    }}>
      {assigned ? '✓ Assigned' : 'â—‹ Unassigned'}
    </span>
  );
}

function InfoCallout({ children, onDismiss }) {
  return (
    <div style={{
      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
      padding: '14px 16px', marginBottom: 20, fontSize: 13, color: '#1e40af',
      display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.6
    }}>
      <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#047857', padding: 0 }}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function QuickAction({ icon, label, subtitle, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '16px 12px', background: disabled ? '#f1f5f9' : '#fff',
        border: '1px solid #e2e8f0', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', flex: 1, minWidth: 120, textAlign: 'center',
        opacity: disabled ? 0.5 : 1
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = '#047857'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
    >
      <div style={{ color: '#047857' }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{label}</div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{subtitle}</div>
    </button>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEFAULT SUBJECTS (seeded on first load if table is empty)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const DEFAULT_SUBJECTS = [
  { code: 'MAT', name: 'Mathematics', is_core: true, department: 'Mathematics', periods_per_week: 5 },
  { code: 'ENG', name: 'English', is_core: true, department: 'Languages', periods_per_week: 5 },
  { code: 'KIS', name: 'Kiswahili', is_core: true, department: 'Languages', periods_per_week: 5 },
  { code: 'BIO', name: 'Biology', is_core: true, department: 'Sciences', periods_per_week: 5 },
  { code: 'CHE', name: 'Chemistry', is_core: true, department: 'Sciences', periods_per_week: 5 },
  { code: 'PHY', name: 'Physics', is_core: true, department: 'Sciences', periods_per_week: 5 },
  { code: 'HIS', name: 'History', is_core: false, department: 'Humanities', periods_per_week: 4 },
  { code: 'GEO', name: 'Geography', is_core: false, department: 'Humanities', periods_per_week: 4 },
];

const DEFAULT_DEPARTMENTS = ['Mathematics', 'Languages', 'Sciences', 'Humanities'];

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function TeacherManagement({ store, user, params = {} }) {
  const { teachers = [], settings = {}, notify, navigate } = store;
  const activeTab = params.tab || 'directory';

  // Data state
  const [subjects, setSubjects] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Directory filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInfo, setShowInfo] = useState(true);

  // Assignment tab state
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [assignTerm, setAssignTerm] = useState('Term 2');
  const [assignYear, setAssignYear] = useState(2026);
  const [assignFilter, setAssignFilter] = useState('all'); // all | unassigned

  // Qualification tab state
  const [qualTeacher, setQualTeacher] = useState('');
  const [qualModal, setQualModal] = useState(false);

  // Classes/streams derived from settings
  const allClasses = useMemo(() => {
    const cls = settings.classes || [];
    return cls.map(c => ({
      name: c.name,
      streams: c.streams ? c.streams.split(',').map(s => s.trim()).filter(Boolean) : []
    }));
  }, [settings.classes]);

  const expandedClasses = useMemo(() => expandClassesWithStreams(settings.classes || []), [settings.classes]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subj, quals, assigns] = await Promise.allSettled([
        fetchTable('subjects'),
        fetchTable('teacherQualifications'),
        fetchTable('subjectAssignments')
      ]);

      let loadedSubjects = subj.status === 'fulfilled' ? (subj.value || []) : [];
      const loadedQuals = quals.status === 'fulfilled' ? (quals.value || []) : [];
      const loadedAssigns = assigns.status === 'fulfilled' ? (assigns.value || []) : [];

      // Sync subjects with settings.subjects
      const settingsSubjects = settings?.subjects || [];
      if (settingsSubjects.length > 0) {
        const syncedSubjects = [];
        for (const s of settingsSubjects) {
          let match = loadedSubjects.find(l => l.name.toLowerCase() === s.name.toLowerCase());
          if (!match) {
            match = { 
              id: `subj_${s.name.replace(/\s+/g, '_').toLowerCase()}`, 
              name: s.name, 
              department: s.dept, 
              code: s.name.substring(0,3).toUpperCase() 
            };
            try { await upsertRow('subjects', match); } catch(e) {}
          } else if (match.department !== s.dept) {
            match.department = s.dept;
            try { await upsertRow('subjects', match); } catch(e) {}
          }
          syncedSubjects.push(match);
        }
        loadedSubjects = syncedSubjects;
      } else if (loadedSubjects.length === 0) {
        try {
          for (const s of DEFAULT_SUBJECTS) {
            await upsertRow('subjects', { id: `subj_${s.code}`, ...s });
          }
        } catch (e) { 
          console.warn('Could not seed subjects in DB:', e.message); 
        }
        loadedSubjects = DEFAULT_SUBJECTS.map(s => ({ id: `subj_${s.code}`, ...s }));
      }

      setSubjects(loadedSubjects);
      setQualifications(loadedQuals);
      setAssignments(loadedAssigns);
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [settings?.subjects]);

  useEffect(() => { loadData(); }, [loadData]);

  // Computed: teacher workloads (periods/week)
  const teacherWorkloads = useMemo(() => {
    const map = {};
    assignments.filter(a => a.status === 'assigned' && a.teacher_id).forEach(a => {
      map[a.teacher_id] = (map[a.teacher_id] || 0) + (a.periods_per_week || 5);
    });
    return map;
  }, [assignments]);

  // Computed: teacher qualification map { teacherId: [{ subject_id, qualification_level, subjectName }] }
  const teacherQualMap = useMemo(() => {
    const map = {};
    qualifications.forEach(q => {
      if (!map[q.teacher_id]) map[q.teacher_id] = [];
      const subj = subjects.find(s => s.id === q.subject_id);
      map[q.teacher_id].push({ ...q, subjectName: subj?.name || q.subject_id });
    });
    return map;
  }, [qualifications, subjects]);

  // Computed: teacher assignment map { teacherId: [{ class_name, stream_name, subject_name, assigned_at }] }
  const teacherAssignMap = useMemo(() => {
    const map = {};
    assignments.filter(a => a.status === 'assigned' && a.teacher_id).forEach(a => {
      if (!map[a.teacher_id]) map[a.teacher_id] = [];
      const subj = subjects.find(s => s.id === a.subject_id);
      map[a.teacher_id].push({
        class_name: a.class_name,
        stream_name: a.stream_name,
        subject_name: subj?.name || a.subject_id,
        assigned_at: a.assigned_at
      });
    });
    return map;
  }, [assignments, subjects]);

  const activeTeachers = useMemo(() => teachers.filter(t => t.status !== 'Inactive'), [teachers]);

  // Departments
  const departments = useMemo(() => {
    const depts = new Set(activeTeachers.map(t => t.department).filter(Boolean));
    subjects.forEach(s => { if (s.department) depts.add(s.department); });
    return [...depts].sort();
  }, [activeTeachers, subjects]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DIRECTORY TAB
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const filteredTeachers = useMemo(() => {
    return activeTeachers.filter(t => {
      if (search) {
        const q = search.toLowerCase();
        if (!(t.name || '').toLowerCase().includes(q) &&
            !(t.emp_id || '').toLowerCase().includes(q) &&
            !(t.phone || '').toLowerCase().includes(q)) return false;
      }
      if (deptFilter && t.department !== deptFilter) return false;
      if (statusFilter === 'assigned' && !(teacherAssignMap[t.id]?.length > 0)) return false;
      if (statusFilter === 'unassigned' && (teacherAssignMap[t.id]?.length > 0)) return false;
      return true;
    });
  }, [activeTeachers, search, deptFilter, statusFilter, teacherAssignMap]);

  const dirStats = useMemo(() => ({
    total: activeTeachers.length,
    newThisYear: activeTeachers.filter(t => {
      const created = t.created_at || t.hire_date;
      return created && new Date(created).getFullYear() === new Date().getFullYear();
    }).length,
    withAssignments: activeTeachers.filter(t => teacherAssignMap[t.id]?.length > 0).length,
    departments: departments.length
  }), [activeTeachers, teacherAssignMap, departments]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ASSIGNMENT TAB
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const currentClassObj = allClasses.find(c => c.name === selectedClass);
  const streams = currentClassObj?.streams || [];

  // Auto-populate assignment rows when class/stream selected
  const currentAssignments = useMemo(() => {
    if (!selectedClass) return [];
    return assignments.filter(a =>
      a.class_name === selectedClass &&
      (a.stream_name || '') === (selectedStream || '') &&
      a.term === assignTerm &&
      a.year === assignYear
    );
  }, [assignments, selectedClass, selectedStream, assignTerm, assignYear]);

  // Ensure assignment rows exist for each subject in the selected class/stream
  const ensureAssignmentRows = useCallback(async () => {
    if (!selectedClass || subjects.length === 0) return;
    const existing = currentAssignments.map(a => a.subject_id);
    const missing = subjects.filter(s => !existing.includes(s.id));
    if (missing.length === 0) return;

    const newRows = missing.map(s => ({
      id: `sa_${selectedClass}_${selectedStream || 'main'}_${s.id}_${assignTerm}_${assignYear}`,
      class_name: selectedClass,
      stream_name: selectedStream || null,
      subject_id: s.id,
      teacher_id: null,
      term: assignTerm,
      year: assignYear,
      periods_per_week: s.periods_per_week || 5,
      status: 'unassigned',
      assigned_at: null
    }));

    try {
      await Promise.all(newRows.map(r => upsertRow('subjectAssignments', r)));
      setAssignments(prev => [...prev, ...newRows]);
    } catch (e) {
      notify(`Failed to create assignment slots: ${e.message}`, 'error');
    }
  }, [selectedClass, selectedStream, assignTerm, assignYear, subjects, currentAssignments, notify]);

  useEffect(() => {
    if (selectedClass) ensureAssignmentRows();
  }, [selectedClass, selectedStream, ensureAssignmentRows]);

  const assignedCount = currentAssignments.filter(a => a.status === 'assigned').length;
  const totalSubjects = currentAssignments.length;
  const assignPct = totalSubjects > 0 ? Math.round((assignedCount / totalSubjects) * 100) : 0;

  const displayAssignments = useMemo(() => {
    if (assignFilter === 'unassigned') return currentAssignments.filter(a => a.status !== 'assigned');
    return currentAssignments;
  }, [currentAssignments, assignFilter]);

  const handleAssignTeacher = async (assignmentId, teacherId) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    const updated = {
      ...assignment,
      teacher_id: teacherId || null,
      status: teacherId ? 'assigned' : 'unassigned',
      assigned_at: teacherId ? new Date().toISOString() : null
    };

    try {
      await upsertRow('subjectAssignments', updated);
      setAssignments(prev => prev.map(a => a.id === assignmentId ? updated : a));
      const subj = subjects.find(s => s.id === assignment.subject_id);
      if (teacherId) {
        const t = teachers.find(x => x.id === teacherId);
        notify(`${t?.name || 'Teacher'} assigned to ${subj?.name || 'subject'}`, 'success');
      } else {
        notify(`Unassigned teacher from ${subj?.name || 'subject'}`, 'info');
      }
    } catch (e) {
      notify(`Assignment failed: ${e.message}`, 'error');
    }
  };

  // Auto-assign algorithm
  const handleAutoAssign = async () => {
    const unassigned = currentAssignments.filter(a => a.status !== 'assigned');
    if (unassigned.length === 0) { notify('All subjects already assigned!', 'info'); return; }

    let assigned = 0;
    const workloads = { ...teacherWorkloads };

    for (const slot of unassigned) {
      // Find qualified teachers for this subject
      const qualifiedTeachers = qualifications
        .filter(q => q.subject_id === slot.subject_id)
        .map(q => {
          const teacher = activeTeachers.find(t => t.id === q.teacher_id);
          return teacher ? { ...teacher, qualLevel: q.qualification_level, load: workloads[teacher.id] || 0 } : null;
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.load !== b.load) return a.load - b.load; // lowest load first
          if (a.qualLevel === 'primary' && b.qualLevel !== 'primary') return -1; // prefer primary
          if (b.qualLevel === 'primary' && a.qualLevel !== 'primary') return 1;
          return 0;
        });

      if (qualifiedTeachers.length > 0) {
        const best = qualifiedTeachers[0];
        const updated = {
          ...slot,
          teacher_id: best.id,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        };
        try {
          await upsertRow('subjectAssignments', updated);
          setAssignments(prev => prev.map(a => a.id === slot.id ? updated : a));
          workloads[best.id] = (workloads[best.id] || 0) + (slot.periods_per_week || 5);
          assigned++;
        } catch (e) { console.warn('Auto-assign error:', e.message); }
      }
    }

    notify(`Auto-assigned ${assigned} of ${unassigned.length} subjects`, assigned > 0 ? 'success' : 'warning');
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // QUALIFICATIONS TAB
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const selectedTeacherQuals = qualTeacher ? (teacherQualMap[qualTeacher] || []) : [];

  const handleAddQualification = async (subjectId, level = 'qualified') => {
    if (!qualTeacher || !subjectId) return;
    const id = `qual_${qualTeacher}_${subjectId}`;
    const existing = qualifications.find(q => q.teacher_id === qualTeacher && q.subject_id === subjectId);
    if (existing) { notify('Qualification already exists', 'warning'); return; }

    const row = { id, teacher_id: qualTeacher, subject_id: subjectId, qualification_level: level };
    try {
      await upsertRow('teacherQualifications', row);
      setQualifications(prev => [...prev, row]);
      const subj = subjects.find(s => s.id === subjectId);
      const teacher = teachers.find(t => t.id === qualTeacher);
      notify(`${teacher?.name} qualified for ${subj?.name}`, 'success');
    } catch (e) {
      notify(`Failed: ${e.message}`, 'error');
    }
  };

  const handleRemoveQualification = async (qualId) => {
    try {
      const { supabase } = await import('../lib/supabaseClient');
      await supabase.from('teacher_subject_qualifications').delete().eq('id', qualId);
      setQualifications(prev => prev.filter(q => q.id !== qualId));
      notify('Qualification removed', 'info');
    } catch (e) {
      notify(`Failed: ${e.message}`, 'error');
    }
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }} className="muted">Loading teacher management data...</div>;
  }

  // â”€â”€ TAB NAVIGATION â”€â”€
  const tabs = [
    { key: 'directory', label: 'Teaching Staff', icon: <Users size={16} /> },
    { key: 'assign', label: 'Assign to Class', icon: <ClipboardList size={16} /> },
    { key: 'qualifications', label: 'Qualifications', icon: <GraduationCap size={16} /> }
  ];

  return (
    <div>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0078D4 100%)',
        color: '#fff', padding: '20px 24px', borderRadius: 10, marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Teacher Management</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            {user?.role === 'principal' ? 'Principal' : 'Deputy Academics'} | Staff allocation & subject assignments
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13, opacity: 0.9 }}>
          <span>ðŸ“… {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span>ðŸ“š Term 2, 2026</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => navigate('teacher_management', { tab: t.key === 'directory' ? undefined : t.key })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: 'none', fontSize: 14, fontWeight: 600,
              color: activeTab === t.key ? '#1e3a5f' : '#64748b',
              borderBottom: activeTab === t.key ? '2px solid #0078D4' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s'
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* DIRECTORY TAB */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === 'directory' && (
        <div>
          {/* Stats */}
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            <KpiCard iconComponent={<Users size={20} />} label="Total Teachers" value={dirStats.total} />
            <KpiCard iconComponent={<Plus size={20} />} label="New This Year" value={dirStats.newThisYear} accent="#047857" />
            <KpiCard iconComponent={<UserCheck size={20} />} label="With Assignments" value={dirStats.withAssignments} accent="#047857" />
            <KpiCard iconComponent={<Building2 size={20} />} label="Departments" value={dirStats.departments} accent="#047857" />
          </div>

          {/* Search & Filter */}
          <div className="card card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
              <Search size={16} color="#64748b" />
              <input className="input" style={{ flex: 1 }} placeholder="Search by name, staff code, phone..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="select" style={{ minWidth: 160 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="select" style={{ minWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <button className="btn btn-sm" onClick={() => { setSearch(''); setDeptFilter(''); setStatusFilter('all'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <RotateCcw size={14} /> Reset
            </button>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <QuickAction icon={<ClipboardList size={22} />} label="Assign to Class" subtitle="Teacher allocation"
              onClick={() => navigate('teacher_management', { tab: 'assign' })} />
            <QuickAction icon={<GraduationCap size={22} />} label="Manage Qualifications" subtitle="Qualification setup"
              onClick={() => navigate('teacher_management', { tab: 'qualifications' })} />
            <QuickAction icon={<BarChart3 size={22} />} label="Workload Analysis" subtitle="Load balancing"
              onClick={() => notify('Workload analysis coming soon', 'info')} />
            <QuickAction icon={<Users size={22} />} label="Class Teachers" subtitle="Leadership roles"
              onClick={() => navigate('class_teachers')} />
          </div>

          {/* Info */}
          {showInfo && (
            <InfoCallout onDismiss={() => setShowInfo(false)}>
              <strong>Tips:</strong> Green badges show qualified subjects | Blue badges show primary teaching subjects<br />
              Use "Assign to Class" to allocate teachers to specific classes and subjects<br />
              Monitor teacher workload using the badge in the top-right of each card<br />
              Class Teachers (Heads of Class/Stream) are assigned separately
            </InfoCallout>
          )}

          {/* Teacher Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
            {filteredTeachers.length === 0 ? (
              <div className="card card-pad muted" style={{ textAlign: 'center', padding: 40, gridColumn: '1 / -1' }}>
                No teachers found matching your filters.
              </div>
            ) : filteredTeachers.map(teacher => {
              const quals = teacherQualMap[teacher.id] || [];
              const assigns = teacherAssignMap[teacher.id] || [];
              const workload = teacherWorkloads[teacher.id] || 0;

              return (
                <div key={teacher.id} className="card card-pad" style={{ position: 'relative' }}>
                  {/* Workload badge */}
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <WorkloadBadge periods={workload} />
                  </div>

                  {/* Header */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <TeacherAvatar name={teacher.name} id={teacher.id} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a5f' }}>{teacher.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {teacher.emp_id || 'No ID'} · {teacher.phone || 'No phone'}
                      </div>
                      {teacher.department && (
                        <div style={{ fontSize: 11, color: '#047857', fontWeight: 600, marginTop: 2 }}>{teacher.department}</div>
                      )}
                    </div>
                  </div>

                  {/* Qualified Subjects */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Qualified Subjects:
                    </div>
                    {quals.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 500 }}>No subjects assigned</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {quals.map(q => <QualificationBadge key={q.id || q.subject_id} level={q.qualification_level} name={q.subjectName} />)}
                      </div>
                    )}
                  </div>

                  {/* Current Assignments */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Current Assignments:
                    </div>
                    {assigns.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 500 }}>No class assignments</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {assigns.slice(0, 3).map((a, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#334155' }}>
                            {a.class_name}{a.stream_name ? ` ${a.stream_name}` : ''} - {a.subject_name}
                          </div>
                        ))}
                        {assigns.length > 3 && <div style={{ fontSize: 11, color: '#94a3b8' }}>+{assigns.length - 3} more</div>}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12 }}>
                      <span>{assigns.length} classes</span>
                      <span>{quals.length} subjects</span>
                    </div>
                    <button className="btn btn-sm btn-primary" style={{ padding: '4px 14px', fontSize: 12 }}
                      onClick={() => navigate('teacher_management', { tab: 'assign' })}>
                      Assign
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* ASSIGN TAB */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === 'assign' && (
        <div>
          {/* Selectors */}
          <div className="card card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>CLASS</label>
              <select className="select" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStream(''); }}>
                <option value="">Select Class...</option>
                {allClasses.map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.streams.length || 1} stream{c.streams.length !== 1 ? 's' : ''})</option>
                ))}
              </select>
            </div>
            {streams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>STREAM</label>
                <select className="select" value={selectedStream} onChange={e => setSelectedStream(e.target.value)}>
                  <option value="">Select Stream</option>
                  {streams
                    .filter(s => !['select stream', 'all streams'].includes(s.toLowerCase()))
                    .map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>TERM</label>
              <select className="select" value={assignTerm} onChange={e => setAssignTerm(e.target.value)}>
                <option>Term 1</option><option>Term 2</option><option>Term 3</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 80 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>YEAR</label>
              <input className="input" type="number" value={assignYear} onChange={e => setAssignYear(Number(e.target.value))} style={{ width: 80 }} />
            </div>
            <button className="btn btn-sm" style={{ marginTop: 18 }} onClick={() => { setSelectedClass(''); setSelectedStream(''); }}>
              <RotateCcw size={14} /> Clear
            </button>
          </div>

          {!selectedClass ? (
            <div className="card card-pad muted" style={{ textAlign: 'center', padding: 60 }}>
              <ClipboardList size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Select a Class to Begin</div>
              <div style={{ fontSize: 13 }}>Choose a class and stream above to start assigning teachers to subjects</div>
            </div>
          ) : (
            <>
              {/* Summary Bar */}
              <div style={{
                background: 'linear-gradient(135deg, #0078D4 0%, #00b4d8 100%)',
                borderRadius: 10, padding: '16px 20px', marginBottom: 20, color: '#fff',
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16
              }}>
                <div><div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>GRADE</div><div style={{ fontSize: 18, fontWeight: 700 }}>{selectedClass}</div></div>
                <div><div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>STREAM</div><div style={{ fontSize: 18, fontWeight: 700 }}>{selectedStream || 'All'}</div></div>
                <div><div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>SUBJECTS</div><div style={{ fontSize: 18, fontWeight: 700 }}>{totalSubjects}</div></div>
                <div><div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>ASSIGNED</div><div style={{ fontSize: 18, fontWeight: 700 }}>{assignedCount}/{totalSubjects} - {assignPct}%</div></div>
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <QuickAction icon={<Zap size={22} />} label="Auto-Assign" subtitle="Best qualified" onClick={handleAutoAssign} />
                <QuickAction icon={<EyeOff size={22} />} label="Show Unassigned" subtitle="Filter view"
                  onClick={() => setAssignFilter('unassigned')} />
                <QuickAction icon={<Eye size={22} />} label="Show All" subtitle="Reset view"
                  onClick={() => setAssignFilter('all')} />
                <QuickAction icon={<Calendar size={22} />} label="Generate Timetable" subtitle="Next step"
                  onClick={() => navigate('timetable')} disabled={assignPct < 80} />
              </div>

              {/* Progress */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  <span>Assignment Progress</span>
                  <span>{assignedCount}/{totalSubjects} assigned</span>
                </div>
                <ProgressBar value={assignPct} color={assignPct === 100 ? '#047857' : '#047857'} />
              </div>

              {/* Subject Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                {displayAssignments.map(assignment => {
                  const subj = subjects.find(s => s.id === assignment.subject_id);
                  if (!subj) return null;

                  // Qualified teachers for this subject
                  const qualifiedForSubject = qualifications
                    .filter(q => q.subject_id === subj.id)
                    .map(q => {
                      const t = activeTeachers.find(x => x.id === q.teacher_id);
                      return t ? { ...t, qualLevel: q.qualification_level } : null;
                    })
                    .filter(Boolean);

                  return (
                    <div key={assignment.id} className="card card-pad" style={{
                      borderLeft: `4px solid ${assignment.status === 'assigned' ? '#047857' : '#94A3B8'}`
                    }}>
                      {/* Subject Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{subj.name}</span>
                            {subj.is_core && <Badge color="blue">Core</Badge>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#64748b' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{subj.code}</span>
                            <span>·</span>
                            <span>{assignment.periods_per_week || 5} periods/week</span>
                          </div>
                        </div>
                        <StatusPill status={assignment.status} />
                      </div>

                      {/* Teacher Dropdown */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>SELECT TEACHER:</label>
                        <select
                          className="select"
                          value={assignment.teacher_id || ''}
                          onChange={e => handleAssignTeacher(assignment.id, e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">- Select Teacher -</option>
                          {qualifiedForSubject.length > 0 ? (
                            qualifiedForSubject.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.emp_id || 'N/A'}) - {t.department || 'General'} | Workload: {teacherWorkloads[t.id] || 0}/40
                              </option>
                            ))
                          ) : (
                            activeTeachers.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.emp_id || 'N/A'}) | Workload: {teacherWorkloads[t.id] || 0}/40
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* Qualified teachers line */}
                      {qualifiedForSubject.length > 0 && (
                        <div style={{ fontSize: 11, color: '#047857', fontWeight: 500 }}>
                          ✓ Qualified: {qualifiedForSubject.slice(0, 3).map(t => t.name).join(', ')}
                          {qualifiedForSubject.length > 3 && ` +${qualifiedForSubject.length - 3} more`}
                        </div>
                      )}
                      {qualifiedForSubject.length === 0 && (
                        <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 500 }}>
                          âš  No qualified teachers - showing all teachers. Add qualifications first.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* QUALIFICATIONS TAB */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === 'qualifications' && (
        <div>
          <InfoCallout>
            <strong>Manage Teacher Qualifications:</strong> Select a teacher, then add the subjects they are qualified to teach.
            This controls which teachers appear in the dropdown when assigning subjects to classes.
          </InfoCallout>

          <div className="card card-pad" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ flex: 1, minWidth: 250 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>SELECT TEACHER</label>
                <select className="select" style={{ width: '100%' }} value={qualTeacher} onChange={e => setQualTeacher(e.target.value)}>
                  <option value="">Choose a teacher...</option>
                  {activeTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.emp_id || t.id}) - {t.department || 'General'}</option>
                  ))}
                </select>
              </div>
            </div>

            {qualTeacher && (
              <>
                {/* Current qualifications */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                    Current Qualifications - {teachers.find(t => t.id === qualTeacher)?.name}
                  </h3>
                  {selectedTeacherQuals.length === 0 ? (
                    <div className="muted" style={{ fontSize: 13, padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                      No qualifications assigned yet. Add subjects below.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selectedTeacherQuals.map(q => (
                        <div key={q.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 8,
                          background: q.qualification_level === 'primary' ? '#dbeafe' : '#dcfce7',
                          border: `1px solid ${q.qualification_level === 'primary' ? '#93c5fd' : '#86efac'}`
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: q.qualification_level === 'primary' ? '#064e3b' : '#166534' }}>
                            {q.subjectName}
                          </span>
                          <Badge color={q.qualification_level === 'primary' ? 'blue' : 'green'}>
                            {q.qualification_level}
                          </Badge>
                          <button onClick={() => handleRemoveQualification(q.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 0, display: 'flex' }}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add qualification */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add Subject Qualification</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {subjects.filter(s => !selectedTeacherQuals.some(q => q.subject_id === s.id)).map(subj => (
                      <div key={subj.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                        background: '#fafafa'
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{subj.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{subj.code} · {subj.department}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm" onClick={() => handleAddQualification(subj.id, 'qualified')}
                            style={{ padding: '3px 8px', fontSize: 11, background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
                            + Qualified
                          </button>
                          <button className="btn btn-sm" onClick={() => handleAddQualification(subj.id, 'primary')}
                            style={{ padding: '3px 8px', fontSize: 11, background: '#dbeafe', color: '#064e3b', border: '1px solid #93c5fd' }}>
                            + Primary
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {subjects.filter(s => !selectedTeacherQuals.some(q => q.subject_id === s.id)).length === 0 && (
                    <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 16 }}>
                      This teacher is qualified for all subjects!
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



