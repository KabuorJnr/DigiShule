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
};

export default function DevPreview() {
  const [role, setRole] = useState('parent');
  return (
    <div>
      <div style={{ position: 'fixed', top: 6, left: '50%', transform: 'translateX(-50%)', zIndex: 99999, display: 'flex', gap: 4, background: '#111', padding: 4, borderRadius: 8 }}>
        {Object.keys(ROLE_USERS).map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 0, cursor: 'pointer', background: r === role ? '#1E5FE0' : '#333', color: '#fff' }}>{r}</button>
        ))}
      </div>
      <MobileShell key={role} store={MOCK_STORE} user={ROLE_USERS[role]} onLogout={() => {}} onChangePassword={() => {}} loading={false} />
    </div>
  );
}
