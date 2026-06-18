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
  name: 'EduOne School System',
  motto: 'Knowledge is Power',
  address: 'P.O. Box 1234-00100, Westlands, Nairobi',
  phone: '+254 701402265',
  email: 'info@westlands-sec.ac.ke',
  principal: 'Denford Musvosvi',
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

export const CLASS_PERFORMANCE_DATA = [
  { name: 'Form 1', average: 58.4, passRate: 72.0 },
  { name: 'Form 2', average: 62.1, passRate: 78.5 },
  { name: 'Form 3', average: 66.8, passRate: 88.5 },
  { name: 'Form 4', average: 51.2, passRate: 42.0 },
];

export const TOP_SUBJECTS_DATA = [
  { name: 'Mathematics', score: 68.3, fill: '#2563EB' },
  { name: 'Physics', score: 64.5, fill: '#10B981' },
  { name: 'Chemistry', score: 64.4, fill: '#F59E0B' },
];

export const CLASS_PERFORMANCE_SUMMARY = [
  { id: 'f3', class: 'Form 3', students: 28, streams: 3, avg: 66.8, passRate: 88.5, marks: 78, perf: 'good' },
  { id: 'f2', class: 'Form 2', students: 32, streams: 3, avg: 62.1, passRate: 78.5, marks: 84, perf: 'good' },
  { id: 'f1', class: 'Form 1', students: 35, streams: 3, avg: 58.4, passRate: 72.0, marks: 91, perf: 'average' },
  { id: 'f4', class: 'Form 4', students: 25, streams: 2, avg: 51.2, passRate: 42.0, marks: 45, perf: 'poor' },
];

export const LEAVE_REQUESTS = [
  { id: 'lr1', staff: 'Ms. Achieng', dept: 'Sciences', type: 'Sick', start: '2026-06-10', end: '2026-06-12', days: 3, reason: 'Medical appointment and recovery', status: 'Approved', approvedBy: 'Dr. Jane Kamau', date: '2026-06-09' },
  { id: 'lr2', staff: 'Ms. Otieno', dept: 'Humanities', type: 'Annual', start: '2026-06-14', end: '2026-06-20', days: 5, reason: 'Family vacation', status: 'Approved', approvedBy: 'Mrs. Lucy Wambui', date: '2026-06-11' },
  { id: 'lr3', staff: 'Mr. Kipchoge', dept: 'Languages', type: 'Personal', start: '2026-06-18', end: '2026-06-19', days: 2, reason: 'Personal matters to attend to', status: 'Pending', approvedBy: null, date: '2026-06-15' },
  { id: 'lr4', staff: 'Mr. Kamau', dept: 'Humanities', type: 'Emergency', start: '2026-06-17', end: '2026-06-17', days: 1, reason: 'Family emergency', status: 'Pending', approvedBy: null, date: '2026-06-16' },
  { id: 'lr5', staff: 'Ms. Wanjiku', dept: 'Languages', type: 'Sick', start: '2026-05-28', end: '2026-05-29', days: 2, reason: 'Flu symptoms', status: 'Rejected', approvedBy: 'Dr. Jane Kamau', date: '2026-05-27' },
];


export const NOTICES = [
  { id: 'n1', title: 'End of Term Exams Schedule Released', body: 'The end-of-term examination timetable has been published. All students should prepare accordingly. Exams begin on June 21st, 2026. Please check the exam schedules module for your specific timetable.', postedBy: 'Mr. Peter Mwangi', role: 'Deputy Academics', date: '2026-06-10', audience: ['all'] },
  { id: 'n2', title: 'School Fees Deadline Reminder', body: 'This is a reminder that all outstanding school fees for Term 2 must be cleared by June 20th, 2026. Students with outstanding balances will not be allowed to sit for exams. Please contact the finance office for any queries.', postedBy: 'Mr. Daniel Kerubo', role: 'Finance', date: '2026-06-09', audience: ['students', 'parents'] },
  { id: 'n3', title: 'PTA Meeting Notice', body: 'A Parents-Teachers Association meeting is scheduled for June 18th, 2026 at 10:00 AM in the Main Hall. All parents and guardians are encouraged to attend. Agenda includes academic performance review and infrastructure development.', postedBy: 'Mrs. Lucy Wambui', role: 'Deputy Admin', date: '2026-06-08', audience: ['parents', 'teachers'] },
  { id: 'n4', title: 'Holiday Assignment Guidelines', body: 'All teachers are required to submit holiday assignments for their respective subjects by June 19th. Assignments should cover topics taught during the term and be appropriate for the level of students.', postedBy: 'Mr. Peter Mwangi', role: 'Deputy Academics', date: '2026-06-07', audience: ['teachers'] },
  { id: 'n5', title: 'Sports Day Announcement', body: 'The annual inter-class sports day will be held on July 4th, 2026 at the school sports field. Students should register for events through their class teachers. Categories include athletics, football, and volleyball.', postedBy: 'Mrs. Lucy Wambui', role: 'Deputy Admin', date: '2026-06-06', audience: ['all'] },
  { id: 'n6', title: 'Library Roof Repair Update', body: 'The library will remain closed until June 15th due to ongoing roof repairs. Students can access reading materials from the temporary reading room in Block C. We apologize for the inconvenience.', postedBy: 'Mrs. Lucy Wambui', role: 'Deputy Admin', date: '2026-06-05', audience: ['all'] },
];

export const ASSIGNMENTS_LIST = [
  { id: 'a1', subject: 'Mathematics', teacher: 'Mr. Omondi', title: 'Holiday Revision — Quadratic Equations', description: 'Complete Exercise 12A and 12B from the textbook. Show all working. Also attempt the 5 challenge problems on the worksheet provided.', dueDate: '2026-07-20', class: '1A', status: 'Active', datePosted: '2026-06-10' },
  { id: 'a2', subject: 'English', teacher: 'Ms. Wanjiku', title: 'Essay Writing — "My Role Model"', description: 'Write a 500-word essay on "My Role Model". Use proper paragraph structure, introduction, body, and conclusion. Pay attention to grammar and punctuation.', dueDate: '2026-07-18', class: '1A', status: 'Active', datePosted: '2026-06-09' },
  { id: 'a3', subject: 'Biology', teacher: 'Ms. Achieng', title: 'Cell Biology Diagrams', description: 'Draw and label the following diagrams: Animal cell, Plant cell, and Bacterial cell. Use A4 paper. Include at least 10 labels per diagram.', dueDate: '2026-07-22', class: '1A', status: 'Active', datePosted: '2026-06-08' },
  { id: 'a4', subject: 'Chemistry', teacher: 'Mr. Muthoni', title: 'Periodic Table — Groups I-IV', description: 'Study the properties of elements in Groups I to IV. Answer questions 1-20 in the revision booklet. Prepare for a test on this topic next term.', dueDate: '2026-07-15', class: '1A', status: 'Active', datePosted: '2026-06-07' },
  { id: 'a5', subject: 'History', teacher: 'Mr. Kamau', title: 'Research Project — East African Trade', description: 'Research and write a 2-page report on the East African coastal trade in the 19th century. Include at least 3 references.', dueDate: '2026-07-25', class: '1A', status: 'Active', datePosted: '2026-06-06' },
  { id: 'a6', subject: 'Kiswahili', teacher: 'Mr. Kipchoge', title: 'Insha — Siku Yangu Bora', description: 'Andika insha kuhusu "Siku Yangu Bora Shuleni" kwa maneno yasiyopungua 400. Tumia lugha safi na sahihi.', dueDate: '2026-07-19', class: '1A', status: 'Active', datePosted: '2026-06-05' },
];

export const STUDENT_ATTENDANCE_LOG = (() => {
  const log = [];
  const statuses = ['Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Late', 'Absent'];
  for (let i = 0; i < 60; i++) {
    const d = new Date(2026, 3, 14); // Start from April 14
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // Skip weekends
    log.push({
      id: `att-s-${i}`,
      date: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      status: statuses[Math.floor(Math.random() * statuses.length)],
    });
  }
  return log;
})();

export const STUDY_MATERIALS = [
  { id: 'sm1', subject: 'Mathematics', title: 'Form 1 — Algebra Notes', type: 'PDF', size: '2.4 MB', uploadedBy: 'Mr. Omondi', date: '2026-05-20' },
  { id: 'sm2', subject: 'Mathematics', title: 'Quadratic Equations Worksheet', type: 'PDF', size: '1.1 MB', uploadedBy: 'Mr. Omondi', date: '2026-06-01' },
  { id: 'sm3', subject: 'English', title: 'A Doll\'s House — Study Guide', type: 'PDF', size: '3.8 MB', uploadedBy: 'Ms. Wanjiku', date: '2026-05-15' },
  { id: 'sm4', subject: 'English', title: 'Essay Writing Tips & Examples', type: 'PDF', size: '1.5 MB', uploadedBy: 'Ms. Wanjiku', date: '2026-06-05' },
  { id: 'sm5', subject: 'Biology', title: 'Cell Biology — Illustrated Notes', type: 'PDF', size: '5.2 MB', uploadedBy: 'Ms. Achieng', date: '2026-05-18' },
  { id: 'sm6', subject: 'Chemistry', title: 'Periodic Table Reference Sheet', type: 'PDF', size: '0.8 MB', uploadedBy: 'Mr. Muthoni', date: '2026-05-22' },
  { id: 'sm7', subject: 'Physics', title: 'Force & Motion — Summary Notes', type: 'PDF', size: '2.1 MB', uploadedBy: 'Ms. Njeri', date: '2026-05-25' },
  { id: 'sm8', subject: 'History', title: 'East African History — Timeline', type: 'PDF', size: '1.9 MB', uploadedBy: 'Mr. Kamau', date: '2026-05-28' },
  { id: 'sm9', subject: 'Kiswahili', title: 'Sarufi — Muhtasari', type: 'PDF', size: '1.3 MB', uploadedBy: 'Mr. Kipchoge', date: '2026-06-02' },
  { id: 'sm10', subject: 'Geography', title: 'Map Reading Skills Guide', type: 'PDF', size: '4.0 MB', uploadedBy: 'Ms. Otieno', date: '2026-05-30' },
];

export const REVISION_DOWNLOADS = [
  { id: 'rd1', subject: 'Mathematics', title: 'KCSE 2024 Mathematics Paper 1', year: '2024', type: 'Past Paper', size: '1.2 MB' },
  { id: 'rd2', subject: 'Mathematics', title: 'KCSE 2024 Mathematics Paper 2', year: '2024', type: 'Past Paper', size: '1.4 MB' },
  { id: 'rd3', subject: 'English', title: 'KCSE 2024 English Paper 1 & 2', year: '2024', type: 'Past Paper', size: '2.1 MB' },
  { id: 'rd4', subject: 'Biology', title: 'KCSE 2024 Biology Paper 1, 2 & 3', year: '2024', type: 'Past Paper', size: '3.5 MB' },
  { id: 'rd5', subject: 'Chemistry', title: 'KCSE 2024 Chemistry Paper 1, 2 & 3', year: '2024', type: 'Past Paper', size: '3.2 MB' },
  { id: 'rd6', subject: 'Physics', title: 'KCSE 2024 Physics Paper 1, 2 & 3', year: '2024', type: 'Past Paper', size: '2.8 MB' },
  { id: 'rd7', subject: 'Mathematics', title: 'Form 1 End-Term Revision Booklet', year: '2026', type: 'Revision', size: '1.8 MB' },
  { id: 'rd8', subject: 'English', title: 'Comprehension Practice Set', year: '2026', type: 'Revision', size: '0.9 MB' },
  { id: 'rd9', subject: 'History', title: 'KCSE 2024 History Paper 1 & 2', year: '2024', type: 'Past Paper', size: '2.0 MB' },
  { id: 'rd10', subject: 'Kiswahili', title: 'KCSE 2024 Kiswahili Paper 1, 2 & 3', year: '2024', type: 'Past Paper', size: '2.5 MB' },
];

export const STUDENT_FEE_ACCOUNT = {
  totalBilled: 49500,
  totalPaid: 36135,
  outstanding: 13365,
  dueDate: '2026-06-20',
  payments: [
    { id: 'fp1', date: '2026-04-15', method: 'M-Pesa', ref: 'QGA3KT42', amount: 15000, status: 'Confirmed' },
    { id: 'fp2', date: '2026-05-02', method: 'Bank Transfer', ref: 'EQB-66891', amount: 12000, status: 'Confirmed' },
    { id: 'fp3', date: '2026-05-20', method: 'M-Pesa', ref: 'QGC7NM19', amount: 5135, status: 'Confirmed' },
    { id: 'fp4', date: '2026-06-08', method: 'M-Pesa', ref: 'QGH4TX91', amount: 4000, status: 'Confirmed' },
  ],
  structure: [
    { item: 'Tuition Fee', amount: 25000 },
    { item: 'Boarding Fee', amount: 15000 },
    { item: 'Activity Fee', amount: 3000 },
    { item: 'Lab & Materials', amount: 2500 },
    { item: 'Exam Fee', amount: 2000 },
    { item: 'Development Levy', amount: 2000 },
  ],
};

export { ASSESSMENTS };
