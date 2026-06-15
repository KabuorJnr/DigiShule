// Deterministic seed data for the Principal Dashboard.

export const CLASSES = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'];

export const DEPARTMENTS = {
  Mathematics: 'Math',
  English: 'Languages',
  Kiswahili: 'Languages',
  Biology: 'Sciences',
  Chemistry: 'Sciences',
  Physics: 'Sciences',
  History: 'Humanities',
  Geography: 'Humanities',
};

export const SUBJECTS = Object.keys(DEPARTMENTS);

export const DEPT_COLORS = {
  Sciences: '#3B82F6',
  Humanities: '#10B981',
  Languages: '#8B5CF6',
  Math: '#F59E0B',
};

export const TEACHERS = [
  { id: 't1', name: 'Mr. Omondi', subject: 'Mathematics', department: 'Math', status: 'active' },
  { id: 't2', name: 'Ms. Wanjiku', subject: 'English', department: 'Languages', status: 'active' },
  { id: 't3', name: 'Mr. Kipchoge', subject: 'Kiswahili', department: 'Languages', status: 'active' },
  { id: 't4', name: 'Ms. Achieng', subject: 'Biology', department: 'Sciences', status: 'on leave' },
  { id: 't5', name: 'Mr. Muthoni', subject: 'Chemistry', department: 'Sciences', status: 'active' },
  { id: 't6', name: 'Ms. Njeri', subject: 'Physics', department: 'Sciences', status: 'active' },
  { id: 't7', name: 'Mr. Kamau', subject: 'History', department: 'Humanities', status: 'active' },
  { id: 't8', name: 'Ms. Otieno', subject: 'Geography', department: 'Humanities', status: 'on leave' },
];

const FIRST_NAMES = [
  'Brian', 'Faith', 'Kevin', 'Mercy', 'Dennis', 'Joy', 'Collins', 'Cynthia',
  'Victor', 'Esther', 'Samuel', 'Grace', 'Felix', 'Nancy', 'Allan', 'Lydia',
  'George', 'Ann', 'Peter', 'Caroline', 'Daniel', 'Sharon', 'Michael', 'Diana',
  'Joseph', 'Eunice', 'Ian', 'Purity', 'Eric', 'Winnie', 'Charles', 'Beatrice',
  'Anthony', 'Linet', 'Stephen', 'Maureen', 'Patrick', 'Janet', 'Vincent', 'Rose',
];

const LAST_NAMES = [
  'Mwangi', 'Otieno', 'Kamau', 'Wanjiru', 'Ochieng', 'Njoroge', 'Achieng', 'Kipchoge',
  'Mutua', 'Wafula', 'Cheruiyot', 'Nyambura', 'Odhiambo', 'Karanja', 'Chebet', 'Maina',
  'Owino', 'Kibet', 'Auma', 'Gitau', 'Onyango', 'Wambui', 'Kiplagat', 'Njeri',
  'Barasa', 'Mbugua', 'Atieno', 'Rotich', 'Were', 'Kariuki', 'Akinyi', 'Korir',
  'Omondi', 'Wairimu', 'Juma', 'Chepkemoi', 'Mutiso', 'Nyokabi', 'Simiyu', 'Adhiambo',
];

// small deterministic PRNG
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ASSESSMENTS = ['cat1', 'cat2', 'midterm', 'endterm'];

function makeStudent(cls, idx, rand) {
  const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
  const form = cls[0];
  const adm = `${form}${cls[1]}-${String(idx + 1).padStart(3, '0')}`;
  const scores = {};
  SUBJECTS.forEach((sub) => {
    const base = 35 + Math.floor(rand() * 60); // 35-95 baseline
    scores[sub] = {
      cat1: Math.max(0, Math.min(30, Math.round((base / 100) * 30 + (rand() * 6 - 3)))),
      cat2: Math.max(0, Math.min(30, Math.round((base / 100) * 30 + (rand() * 6 - 3)))),
      midterm: Math.max(0, Math.min(100, Math.round(base + (rand() * 16 - 8)))),
      endterm: Math.max(0, Math.min(100, Math.round(base + (rand() * 16 - 8)))),
    };
  });
  return {
    id: `${cls}-${idx + 1}`,
    name: `${fn} ${ln}`,
    adm,
    class: cls,
    gender: rand() > 0.5 ? 'M' : 'F',
    scores,
    flagged: false,
  };
}

export function buildStudents() {
  const list = [];
  CLASSES.forEach((cls, ci) => {
    const rand = mulberry32(1000 + ci * 97);
    for (let i = 0; i < 20; i++) {
      list.push(makeStudent(cls, i, rand));
    }
  });
  return list;
}

export function buildAttendanceTrend() {
  // 30 day trend of present / absent counts (out of 847)
  const rand = mulberry32(42);
  const total = 847;
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(2026, 5, 9);
    d.setDate(d.getDate() - i);
    const rate = 0.86 + rand() * 0.1; // 86-96%
    const present = Math.round(total * rate);
    days.push({
      date: d.toISOString().slice(5, 10),
      fullDate: d.toISOString().slice(0, 10),
      present,
      absent: total - present,
    });
  }
  return days;
}

export const ATTENDANCE_RECORDS = (() => {
  const rand = mulberry32(7);
  const recs = [];
  for (let i = 14; i >= 0; i--) {
    const d = new Date(2026, 5, 9);
    d.setDate(d.getDate() - i);
    const present = 760 + Math.floor(rand() * 70);
    recs.push({
      id: `att-${i}`,
      date: d.toISOString().slice(0, 10),
      present,
      absent: 847 - present,
      late: Math.floor(rand() * 20),
      rate: ((present / 847) * 100).toFixed(1),
    });
  }
  return recs.reverse();
})();

export const FEE_BY_CLASS = [
  { class: 'Form 1', collected: 84 },
  { class: 'Form 2', collected: 76 },
  { class: 'Form 3', collected: 65 },
  { class: 'Form 4', collected: 58 },
];

export const SEED_ALERTS = [
  { id: 'a1', icon: '👨‍🏫', message: '3 teachers absent today', time: '08:15 AM', type: 'warning' },
  { id: 'a2', icon: '📝', message: 'Form 4 Mock Exams in 5 days', time: 'Yesterday', type: 'info' },
  { id: 'a3', icon: '📚', message: '12 library books overdue', time: '2 days ago', type: 'warning' },
  { id: 'a4', icon: '🏥', message: '2 students referred to hospital this week', time: '3 days ago', type: 'danger' },
  { id: 'a5', icon: '💰', message: 'Payroll due in 3 days', time: '3 days ago', type: 'info' },
];

export const SEED_NOTIFICATIONS = [
  { id: 'n1', title: 'New admission approved', body: 'Form 1 admission for Brian Mwangi approved.', time: '10 min ago', read: false },
  { id: 'n2', title: 'Fee payment received', body: 'KES 45,000 received from Form 3A parent.', time: '32 min ago', read: false },
  { id: 'n3', title: 'Exam schedule published', body: 'End-Term timetable is now live.', time: '1 hour ago', read: false },
  { id: 'n4', title: 'Staff leave request', body: 'Ms. Achieng requested 3 days leave.', time: '2 hours ago', read: false },
  { id: 'n5', title: 'Library overdue alert', body: '17 books are overdue this week.', time: '4 hours ago', read: true },
  { id: 'n6', title: 'Disciplinary case logged', body: 'New case logged for Form 2B student.', time: 'Yesterday', read: true },
  { id: 'n7', title: 'Maintenance complete', body: 'Science lab projector repaired.', time: 'Yesterday', read: true },
  { id: 'n8', title: 'Board meeting reminder', body: 'BOM meeting scheduled for Friday 2 PM.', time: '2 days ago', read: true },
];

export const DEFAULT_SETTINGS = {
  name: 'Westlands Secondary School',
  motto: 'Knowledge is Power',
  address: 'P.O. Box 1234-00100, Westlands, Nairobi',
  phone: '+254 712 345 678',
  email: 'info@westlands-sec.ac.ke',
  principal: 'Dr. Jane Kamau',
  logo: null,
  currentTerm: 'Term 2',
  termStart: '2026-05-04',
  termEnd: '2026-08-07',
};

export const DEFAULT_GRADE_BOUNDARIES = [
  { grade: 'A', min: 80 },
  { grade: 'B', min: 60 },
  { grade: 'C', min: 40 },
  { grade: 'D', min: 20 },
  { grade: 'E', min: 0 },
];

export const DEFAULT_FEE_STRUCTURE = [
  { type: 'Tuition', f1: 25000, f2: 25000, f3: 28000, f4: 28000 },
  { type: 'Boarding', f1: 18000, f2: 18000, f3: 19000, f4: 19000 },
  { type: 'Activity', f1: 3000, f2: 3000, f3: 3000, f4: 3000 },
  { type: 'Library', f1: 1500, f2: 1500, f3: 1500, f4: 1500 },
  { type: 'Exam', f1: 2000, f2: 2000, f3: 2500, f4: 2500 },
];

export const DEFAULT_NOTIF_TOGGLES = {
  email: true,
  sms: false,
  attendance: true,
  fees: true,
  exams: true,
};

export const DEFAULT_VENUES = [
  { id: 'v1', name: 'Main Hall', capacity: 200, status: 'available' },
  { id: 'v2', name: 'Science Lab Block', capacity: 80, status: 'available' },
  { id: 'v3', name: 'Form 4 Classrooms', capacity: 120, status: 'available' },
  { id: 'v4', name: 'Library', capacity: 60, status: 'maintenance' },
];

export function buildExamSchedules() {
  const venues = ['Main Hall', 'Science Lab Block', 'Form 4 Classrooms'];
  const invigilators = TEACHERS.map((t) => t.name);
  const mk = (id, name, type, start, days, classes) => {
    const sessions = [];
    const subs = ['Mathematics', 'English', 'Kiswahili', 'Biology', 'Chemistry'];
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const date = d.toISOString().slice(0, 10);
      const startH = 8 + (i % 2) * 3;
      sessions.push({
        id: `${id}-s${i}`,
        date,
        classes: classes,
        subject: subs[i],
        start: `${String(startH).padStart(2, '0')}:00`,
        end: `${String(startH + 2).padStart(2, '0')}:00`,
        venue: venues[i % venues.length],
        invigilator: invigilators[i % invigilators.length],
        status: 'Upcoming',
      });
    }
    return { id, name, type, startDate: start, endDate: days, sessions };
  };
  return [
    mk('ex1', 'End-Term 2 Examinations', 'End-Term', '2026-06-21', '2026-06-25', 'Form 1-4'),
    mk('ex2', 'Form 4 Mock Examinations', 'Mock', '2026-06-14', '2026-06-18', 'Form 4'),
    mk('ex3', 'June CAT Series', 'CAT', '2026-06-10', '2026-06-12', 'Form 1-3'),
  ];
}

export const MONTHLY_REVENUE_TREND = [
  { month: 'Jan', revenue: 1200000 },
  { month: 'Feb', revenue: 1500000 },
  { month: 'Mar', revenue: 900000 },
  { month: 'Apr', revenue: 800000 },
  { month: 'May', revenue: 1600000 },
  { month: 'Jun', revenue: 1400000 },
];

export const CLASS_DISTRIBUTION = [
  { name: 'Form 1', value: 240 },
  { name: 'Form 2', value: 210 },
  { name: 'Form 3', value: 205 },
  { name: 'Form 4', value: 192 },
];

export const UPCOMING_EVENTS = [
  { id: 'e1', date: 'Jun 18', title: 'PTA Meeting', desc: 'Main Hall, 10:00 AM' },
  { id: 'e2', date: 'Jun 21', title: 'End-Term Exams Begin', desc: 'All Forms' },
  { id: 'e3', date: 'Jul 04', title: 'Inter-School Sports', desc: 'Sports Field' },
  { id: 'e4', date: 'Jul 15', title: 'BOM Review Meeting', desc: 'Board Room' },
];

export { ASSESSMENTS };
