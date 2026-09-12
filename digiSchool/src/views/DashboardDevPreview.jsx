/**
 * DashboardDevPreview — dev-only harness at /dash-dev.
 *
 * Mounts the REAL role dashboards against a mock `store` so they can be
 * inspected without a signed-in session or a seeded database. This is the
 * counterpart to /m-dev (mobile shell) and /sneat-dev (design system).
 *
 * The mock deliberately exercises the awkward cases:
 *   · classes WITH and WITHOUT streams (Form 3/4 have none)
 *   · classes with and without a published timetable  → timetable coverage
 *   · classes with and without a class teacher         → teacher allocation
 *   · per-class mean targets set for some years/classes only → default fallback
 *
 * Dashboards that also read Supabase directly will simply get empty results
 * here (their fetches are all guarded), so what you see is driven by the mock
 * store — which is exactly the part we want to eyeball.
 *
 * Gated by import.meta.env.DEV in App.jsx; never ships to production.
 */

import { useMemo, useState } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';

import Overview from './Overview';
import DosDashboard from './DosDashboard';
import AcademicsDashboard from './AcademicsDashboard';
import AdminDashboard from './AdminDashboard';
import RegistrarDashboard from './registrar/RegistrarDashboard';
import FinanceDashboardTab from './finance/FinanceDashboardTab';

const CLASSES = [
  { name: 'Form 1', streams: 'East, West' },
  { name: 'Form 2', streams: 'East' },
  { name: 'Form 3' },
  { name: 'Form 4' },
];

const EXPANDED = ['Form 1 East', 'Form 1 West', 'Form 2 East', 'Form 3', 'Form 4'];

const SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Biology', 'Chemistry', 'Physics'];

/** Deterministic pseudo-random so the preview is stable between reloads. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildStudents() {
  const rand = rng(42);
  const out = [];
  let adm = 1000;
  EXPANDED.forEach((klass, ci) => {
    const n = 18 + Math.floor(rand() * 10);
    // Give each class a different ability centre so class means differ and
    // some classes land above their target while others fall short.
    const centre = [52, 47, 58, 61, 64][ci] ?? 55;
    for (let i = 0; i < n; i++) {
      adm += 1;
      const scores = {};
      SUBJECTS.forEach((sub) => {
        const v = Math.max(5, Math.min(98, Math.round(centre + (rand() - 0.5) * 26)));
        scores[sub] = { a1: v, a2: v, a3: v, a4: v, average: v, score: v };
      });
      out.push({
        id: `stu_${adm}`,
        adm: `ADM${adm}`,
        upi: i % 7 === 0 ? '' : `UPI${adm}`,          // some incomplete records
        birth_cert: i % 11 === 0 ? '' : `BC${adm}`,
        name: `Student ${adm}`,
        class: i % 23 === 0 ? '' : klass,             // a few unassigned
        gender: i % 2 === 0 ? 'Male' : 'Female',
        status: 'Active',
        scores,
        admission_date: `${new Date().getFullYear()}-02-${String((i % 27) + 1).padStart(2, '0')}`,
        boarding: i % 3 === 0,
      });
    }
  });
  return out;
}

function buildStore(notify) {
  const students = buildStudents();

  const teachers = [
    { id: 't1', name: 'A. Wanjiku', role: 'teacher', status: 'Active', dept: 'Sciences', subjects: ['Biology', 'Chemistry'], assignedClass: 'Form 1 East, Form 2 East' },
    { id: 't2', name: 'B. Otieno', role: 'teacher', status: 'Active', dept: 'Languages', subjects: ['English', 'Kiswahili'], assignedClass: 'Form 3' },
    { id: 't3', name: 'C. Kiptoo', role: 'teacher', status: 'Active', dept: 'Mathematics', subjects: ['Mathematics'], assignedClass: 'Form 4' },
    { id: 't4', name: 'D. Achieng', role: 'teacher', status: 'On Leave', dept: 'Sciences', subjects: ['Physics'], assignedClass: null },
    // NOTE: 'Form 1 West' has no class teacher on purpose → coverage < 100%.
  ];

  // Only three of five classes have a timetable → coverage 60%.
  const timetables = {
    'Form 1 East': { grid: [[{ type: 'lesson', teacher: 'A. Wanjiku', subject: 'Biology' }]] },
    'Form 2 East': { grid: [[{ type: 'lesson', teacher: 'A. Wanjiku', subject: 'Chemistry' }]] },
    'Form 4': { grid: [[{ type: 'lesson', teacher: 'C. Kiptoo', subject: 'Mathematics' }]] },
  };

  const year = String(new Date().getFullYear());

  return {
    schoolId: 'dev-school',
    settings: {
      id: 'dev-school',
      name: 'Dev Demo Secondary',
      principal: 'Jane Mwangi',
      currentTerm: 'Term 2',
      academicYear: year,
      classes: CLASSES,
      subjects: SUBJECTS,
      termFee: 25000,
      targets: {
        feeCollectionRate: 90,
        admissionTarget: 120,
        enrolmentCapacity: 200,
        defaultClassMean: 60,
        marksCompletion: 100,
        timetableCoverage: 100,
        classTeacherCoverage: 100,
        subjectAllocation: 100,
        attendanceRate: 95,
        staffAttendanceRate: 95,
        openActionsCeiling: 0,
        disciplineCeiling: 0,
        // Form 3 deliberately omitted → falls back to defaultClassMean.
        classMeans: { [year]: { 'Form 1': 50, 'Form 2': 55, 'Form 4': 70 } },
      },
    },
    students,
    teachers,
    timetables,
    examSchedules: [
      { id: 'e1', name: 'Term 2 Opener', date: '2026-05-02' },
      { id: 'e2', name: 'Term 2 Midterm', date: '2026-06-14' },
    ],
    gradeBoundaries: undefined,
    navigate: (v) => notify(`navigate → ${v}`, 'info', 'Dev harness'),
    notify,
    updateStudent: () => {},
    updateSettings: () => {},
  };
}

const ROLES = [
  { id: 'principal', label: 'Principal (Overview)' },
  { id: 'dos', label: 'Director of Studies' },
  { id: 'academics', label: 'Deputy Academic' },
  { id: 'admin', label: 'Deputy Administrator' },
  { id: 'registrar', label: 'Registrar' },
  { id: 'finance', label: 'Finance' },
];

/** Supplies outlet context for dashboards that read useOutletContext(). */
function OutletHost({ ctx }) {
  return <Outlet context={ctx} />;
}

export default function DashboardDevPreview() {
  const [role, setRole] = useState('principal');
  const [toast, setToast] = useState(null);

  const notify = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  };

  const store = useMemo(() => buildStore(notify), []);
  const user = { id: 'dev-user', name: 'Dev User', role, school_id: 'dev-school' };

  // Finance reads invoices/payments/expenses straight off the outlet context.
  const financeCtx = useMemo(() => {
    const invoices = store.students.map((s, i) => ({
      id: `inv_${i}`, student_id: s.id, amount: 25000,
      issue_date: `${new Date().getFullYear()}-05-01`,
    }));
    const payments = store.students
      .filter((_, i) => i % 3 !== 0)
      .map((s, i) => ({
        id: `pay_${i}`, student_id: s.id, amount: 12000 + (i % 4) * 3000,
        date: `${new Date().getFullYear()}-06-${String((i % 27) + 1).padStart(2, '0')}`,
        method: i % 2 ? 'M-Pesa' : 'Bank',
      }));
    const expenses = [
      { id: 'x1', category: 'Utilities', amount: 85000, status: 'Approved', date: '2026-06-03' },
      { id: 'x2', category: 'Teaching supplies', amount: 42000, status: 'Approved', date: '2026-06-11' },
      { id: 'x3', category: 'Maintenance', amount: 31000, status: 'Pending', date: '2026-06-18', requested_by: 'B. Otieno', description: 'Roof repair' },
    ];
    return { store, user, params: {}, invoices, payments, expenses, students: store.students };
  }, [store, user]);

  const registrarCtx = useMemo(() => ({ store, user, params: {} }), [store, user]);

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", minHeight: '100vh', background: '#F5F5F9' }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 16px', background: '#064E3B', color: '#fff', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <strong style={{ fontSize: 13, letterSpacing: 0.4 }}>DASHBOARD DEV HARNESS</strong>
        <span style={{ opacity: 0.7, fontSize: 12 }}>mock data · no login</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              style={{
                padding: '5px 11px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.25)',
                background: role === r.id ? '#fff' : 'transparent',
                color: role === r.id ? '#064E3B' : '#fff',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
          background: '#32475C', color: '#fff', padding: '9px 16px', borderRadius: 8,
          fontSize: 13, zIndex: 100, boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
        }}>
          {toast.msg}
        </div>
      )}

      <div className="content" style={{ padding: 24, maxWidth: 1320, margin: '0 auto' }}>
        {role === 'principal' && <Overview store={store} />}
        {role === 'dos' && <DosDashboard store={store} user={user} />}
        {role === 'academics' && <AcademicsDashboard store={store} user={user} />}
        {role === 'admin' && <AdminDashboard store={store} user={user} />}

        {/* These two read useOutletContext(), so give them a real outlet. */}
        {role === 'registrar' && (
          <Routes>
            <Route path="/*" element={<OutletHost ctx={registrarCtx} />}>
              <Route path="*" element={<RegistrarDashboard />} />
            </Route>
          </Routes>
        )}
        {role === 'finance' && (
          <Routes>
            <Route path="/*" element={<OutletHost ctx={financeCtx} />}>
              <Route path="*" element={<FinanceDashboardTab />} />
            </Route>
          </Routes>
        )}
      </div>
    </div>
  );
}
