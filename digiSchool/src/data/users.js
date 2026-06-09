// Seeded user accounts + role configuration (the app's in-session "users db").
// NOTE: passwords are stored here in plain text only because this is a
// frontend-only demo artifact with no backend. Do NOT use this pattern with a
// real database — use Supabase auth (auth.users) + RLS instead.

// Role definitions: label, portal subtitle, accent color, allowed nav items,
// and the landing view for each role.
export const ROLES = {
  principal: {
    label: 'Principal',
    portal: 'Principal Portal',
    accent: '#1E3A5F',
    home: 'overview',
    nav: [
      { id: 'overview', icon: '🏠', label: 'Overview' },
      { id: 'timetable', icon: '📅', label: 'Timetable Management' },
      { id: 'exams', icon: '📝', label: 'Exam Schedules' },
      { id: 'gradebook', icon: '📊', label: 'Gradebook Review' },
      { id: 'library', icon: '📚', label: 'Library' },
      { id: 'finance', icon: '💰', label: 'Finance' },
      { id: 'admissions', icon: '🧾', label: 'Admissions' },
      { id: 'staff', icon: '👥', label: 'Staff Attendance' },
      { id: 'facilities', icon: '🏛️', label: 'Facilities' },
      { id: 'clinic', icon: '🏥', label: 'Clinic' },
      { id: 'settings', icon: '⚙️', label: 'School Settings' },
    ],
  },
  deputy_academic: {
    label: 'Deputy Academics',
    portal: 'Academics Portal',
    accent: '#2563EB',
    home: 'overview',
    nav: [
      { id: 'overview', icon: '🏠', label: 'Overview' },
      { id: 'timetable', icon: '📅', label: 'Timetable Management' },
      { id: 'exams', icon: '📝', label: 'Exam Schedules' },
      { id: 'gradebook', icon: '📊', label: 'Gradebook Review' },
    ],
  },
  deputy_admin: {
    label: 'Deputy Admin',
    portal: 'Administration Portal',
    accent: '#0F766E',
    home: 'overview',
    nav: [
      { id: 'overview', icon: '🏠', label: 'Overview' },
      { id: 'staff', icon: '👥', label: 'Staff Attendance' },
      { id: 'facilities', icon: '🏛️', label: 'Facilities' },
      { id: 'finance', icon: '💰', label: 'Finance' },
      { id: 'settings', icon: '⚙️', label: 'School Settings' },
    ],
  },
  finance: {
    label: 'Finance',
    portal: 'Finance Portal',
    accent: '#047857',
    home: 'finance',
    nav: [
      { id: 'finance', icon: '💰', label: 'Fee Collection' },
    ],
  },
  registrar: {
    label: 'Registrar',
    portal: 'Admissions Office',
    accent: '#7C3AED',
    home: 'admissions',
    nav: [
      { id: 'admissions', icon: '🧾', label: 'Admissions & Registry' },
    ],
  },
  librarian: {
    label: 'Librarian',
    portal: 'Library Desk',
    accent: '#B45309',
    home: 'library',
    nav: [
      { id: 'library', icon: '📚', label: 'Library' },
    ],
  },
  teacher: {
    label: 'Teacher',
    portal: 'Teacher Portal',
    accent: '#0369A1',
    home: 'teacher',
    nav: [
      { id: 'teacher', icon: '🧑‍🏫', label: 'My Classes' },
      { id: 'timetable', icon: '📅', label: 'My Timetable' },
    ],
  },
  student: {
    label: 'Student',
    portal: 'Student Portal',
    accent: '#1D4ED8',
    home: 'student',
    nav: [
      { id: 'student', icon: '🎓', label: 'My Dashboard' },
    ],
  },
  parent: {
    label: 'Parent',
    portal: 'Parent Portal',
    accent: '#BE185D',
    home: 'parent',
    nav: [
      { id: 'parent', icon: '👪', label: 'My Child' },
    ],
  },
  nurse: {
    label: 'Nurse',
    portal: 'Health & Nursing',
    accent: '#DC2626',
    home: 'clinic',
    nav: [
      { id: 'clinic', icon: '🏥', label: 'Clinic' },
    ],
  },
};

// The seeded accounts. `username` is case-insensitive on login.
// `link` ties portal users to a seeded record (teacher id / student id).
export const USERS = [
  { username: 'Principal', password: 'Zulu@254', role: 'principal', name: 'Dr. Jane Kamau', dept: 'Principal' },
  { username: 'Deputyacademic', password: '7777', role: 'deputy_academic', name: 'Mr. Peter Mwangi', dept: 'Deputy Academics' },
  { username: 'Deputyadmin', password: '7777', role: 'deputy_admin', name: 'Mrs. Lucy Wambui', dept: 'Deputy Admin' },
  { username: 'FINANCE', password: '7777', role: 'finance', name: 'Mr. Daniel Kerubo', dept: 'Finance' },
  { username: 'Registrar', password: '7777', role: 'registrar', name: 'Ms. Agnes Chebet', dept: 'Admissions Office' },
  { username: 'Librarian', password: '7777', role: 'librarian', name: 'Mr. Joseph Njoroge', dept: 'Library' },
  { username: 'LIBRARIAN', password: '7777', role: 'librarian', name: 'Ms. Ruth Atieno', dept: 'Library' },
  { username: 'NURSE001', password: '7777', role: 'nurse', name: 'Sr. Mary Wairimu', dept: 'Nursing' },
  { username: 'STF5169', password: '7777', role: 'teacher', name: 'Mr. Omondi', dept: 'Mathematics', link: 't1' },
  { username: 'STU2640494', password: '7777', role: 'student', name: 'Student', dept: 'Form 1A', link: '1A-1' },
  { username: 'PAR90215', password: '7777', role: 'parent', name: 'Parent / Guardian', dept: 'Parent', link: '1A-1' },
];

export function authenticate(username, password) {
  if (!username || !password) return null;
  const u = USERS.find(
    (x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password
  );
  return u || null;
}
