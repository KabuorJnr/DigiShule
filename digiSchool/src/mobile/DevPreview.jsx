import { useState } from 'react';
import MobileShell from './MobileShell';
import { CBC_BOUNDARIES } from '../utils/grading';

// DEV-ONLY harness to inspect the mobile shell without signing in.
// Route: /m-dev  (gated by import.meta.env.DEV in App.jsx).
const MOCK_STUDENT = {
  id: 'stu1', adm: 'ADM001', name: 'Tony Stark', class: 'Grade 7 B',
  scores: {
    Mathematics: { a1: 3.2, a2: 3.4, a3: 3.6, a4: 3.5 },
    English: { a1: 2.8, a2: 3.0, a3: 3.1, a4: 3.2 },
    Kiswahili: { a1: 3.0, a2: 2.9, a3: 3.2, a4: 3.1 },
    'Integrated Science': { a1: 3.5, a2: 3.6, a3: 3.4, a4: 3.7 },
  },
};

const MOCK_STORE = {
  settings: { name: 'Nairobi Grace Academy', classes: [{ name: 'Grade 7' }, { name: 'Grade 8' }] },
  students: [MOCK_STUDENT, { id: 's2', adm: 'A2', name: 'Pepper Potts', class: 'Grade 8 A', scores: {} }],
  teachers: [{ id: 't1', name: 'David Kamau', subject: 'Mathematics', assignedClass: 'Grade 7 B' }],
  feeStructure: [{ 'Grade 7': 22000, 'Grade 8': 24000 }],
  gradeBoundaries: CBC_BOUNDARIES,
  timetables: {
    'Grade 7 B': {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      grid: [
        [{ subject: 'Mathematics', teacher: 'Mr. Kamau' }, { subject: 'English', teacher: 'Ms. A' }, {}, {}, {}],
        [{ subject: 'Kiswahili', teacher: 'Ms. N' }, {}, {}, {}, {}],
      ],
    },
  },
  notifications: [
    { id: 'n1', title: 'Fee balance due', body: 'KES 22,000 payable by 15 Sep', audience: ['all'], read: false, created_at: new Date().toISOString(), posted_by: 'Bursar' },
    { id: 'n2', title: 'Newsletter published', body: 'Term 2 highlights are out.', audience: ['parents'], read: true, created_at: new Date().toISOString() },
  ],
  setNotifications: () => {},
  notify: () => {},
  navigate: () => {},
};

const ROLE_USERS = {
  parent: { id: 'u_p', role: 'parent', name: 'Grace Wanjiru', linked_students: [MOCK_STUDENT] },
  student: { id: 'u_s', role: 'student', name: 'Tony Stark', student_id: 'stu1', linked_students: [MOCK_STUDENT] },
  teacher: { id: 'u_t', role: 'teacher', name: 'David Kamau', teacher_id: 't1' },
  principal: { id: 'u_a', role: 'principal', name: 'Dr. Susan Mwangi' },
  nurse: { id: 'u_n', role: 'clinic', name: 'Nurse Jane' },
};

// Direct jumps to screens the harness can't reach through normal nav (their
// class/assignment data is fetched from Supabase, which is empty without auth).
const JUMPS = [
  { label: 'T:marks', role: 'teacher', stack: [{ name: 'home' }, { name: 'teacher_marks', params: { label: 'Grade 7 B', className: 'Grade 7', subject: 'Mathematics' } }] },
  { label: 'T:attend', role: 'teacher', stack: [{ name: 'home' }, { name: 'teacher_attendance' }] },
  { label: 'P:approve', role: 'principal', stack: [{ name: 'home' }, { name: 'admin_approvals' }] },
  { label: 'P:students', role: 'principal', stack: [{ name: 'home' }, { name: 'admin_students' }] },
  { label: 'Par:msg', role: 'parent', stack: [{ name: 'home' }, { name: 'parent_messages' }] },
];

export default function DevPreview() {
  const [role, setRole] = useState('parent');
  const [jump, setJump] = useState(null); // {role, stack}

  const activeRole = jump ? jump.role : role;
  const key = jump ? `jump-${jump.label}` : `role-${role}`;
  const btn = (active) => ({ fontSize: 10, padding: '4px 7px', borderRadius: 6, border: 0, cursor: 'pointer', background: active ? '#1E5FE0' : '#333', color: '#fff' });

  return (
    <div>
      <div style={{ position: 'fixed', top: 4, left: '50%', transform: 'translateX(-50%)', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 3, background: '#111', padding: 3, borderRadius: 8 }}>
          {Object.keys(ROLE_USERS).map((r) => (
            <button key={r} onClick={() => { setRole(r); setJump(null); }} style={btn(!jump && r === role)}>{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 3, background: '#111', padding: 3, borderRadius: 8 }}>
          {JUMPS.map((j) => (
            <button key={j.label} onClick={() => setJump(j)} style={btn(jump?.label === j.label)}>{j.label}</button>
          ))}
        </div>
      </div>
      <MobileShell key={key} store={MOCK_STORE} user={ROLE_USERS[activeRole]} onLogout={() => {}} onChangePassword={() => {}} loading={false} initialStack={jump?.stack} />
    </div>
  );
}
