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
      {
        section: 'CORE',
        items: [
          { id: 'overview', icon: '🏠', label: 'Dashboard' }
        ]
      },
      {
        section: 'MANAGEMENT',
        items: [
          {
            id: 'deputy_offices', icon: '🏢', label: 'Deputy Offices',
            sub: [
              { id: 'deputy_academic', label: 'Deputy Academics', action: 'visit_academics' },
              { id: 'deputy_admin', label: 'Deputy Administration', view: 'overview' },
              { id: 'registrar', label: 'Registrar Office', view: 'admissions' }
            ]
          },
          {
            id: 'staff_management', icon: '👥', label: 'Staff Management',
            sub: [
              { id: 'teaching_staff', label: 'Teaching Staff', view: 'staff' },
              { id: 'performance', label: 'Performance', view: 'overview' }
            ]
          },
          {
            id: 'student_management', icon: '🎓', label: 'Student Management',
            sub: [
              { id: 'all_students', label: 'All Students', view: 'overview' },
              { id: 'admissions', label: 'Admissions', view: 'admissions' },
              { id: 'boarding', label: 'Boarding', view: 'overview' },
              { id: 'transfers', label: 'Transfers', view: 'overview' }
            ]
          },
          {
            id: 'academic', icon: '📚', label: 'Academic',
            sub: [
              { id: 'subjects', label: 'Subjects', view: 'overview' },
              { id: 'timetable', label: 'Timetable', view: 'timetable' },
              { id: 'examinations', label: 'Examinations', view: 'exams' }
            ]
          },
          {
            id: 'finance_mgmt', icon: '💰', label: 'Finance',
            sub: [
              { id: 'accounts', label: 'Accounts Office', view: 'finance' },
              { id: 'fin_reports', label: 'Financial Reports', view: 'finance' },
              { id: 'fee_structures', label: 'Fee Structures', view: 'finance' },
              { id: 'expenses', label: 'Expenses', view: 'finance' }
            ]
          },
          {
            id: 'reports', icon: '📈', label: 'Report Analytics',
            sub: [
              { id: 'acad_reports', label: 'Academic reports', view: 'overview' },
              { id: 'attendance_reports', label: 'Attendance', view: 'overview' },
              { id: 'behaviour', label: 'Behaviour', view: 'overview' },
              { id: 'audit', label: 'Audit logs', view: 'overview' }
            ]
          },
          { id: 'downloads', icon: '📥', label: 'Downloads', view: 'overview' }
        ]
      },
      {
        section: 'SUPPORT OFFICES',
        items: [
          { id: 'clinic', icon: '🏥', label: 'Visit Health Center', view: 'clinic' },
          { id: 'library', icon: '📚', label: 'Visit Library', view: 'library' }
        ]
      },
      {
        section: 'COMMUNICATIONS',
        items: [
          { id: 'notices', icon: '📢', label: 'Notices & Announcements', view: 'overview' },
          { id: 'parent_meetings', icon: '👪', label: 'Parent meetings', view: 'overview' }
        ]
      },
      {
        section: 'SYSTEM',
        items: [
          { id: 'notifications', icon: '🔔', label: 'Notifications', view: 'overview', action: 'notif' }
        ]
      },
      {
        section: 'QUICK ACTIONS',
        items: [
          { id: 'new_admission', icon: '➕', label: 'New Admission', view: 'admissions' },
          { id: 'create_exam', icon: '⊕', label: 'Create Exam', view: 'create_exam' },
          { id: 'schedule_meeting', icon: '🗓️', label: 'Schedule Meeting', view: 'overview' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'profile', icon: '👤', label: 'My profile', view: 'overview' },
          { id: 'settings', icon: '⚙️', label: 'System setting', view: 'settings' },
          { id: 'logout', icon: '🚪', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },
  deputy_academic: {
    label: 'Deputy Academics',
    portal: 'Academics Portal',
    accent: '#2563EB',
    home: 'academics_dashboard',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'overview', icon: '🏠', label: 'Overview', view: 'academics_dashboard' },
          { id: 'timetable', icon: '📅', label: 'Timetable Management', view: 'timetable' },
          { id: 'exams', icon: '📝', label: 'Exam Schedules', view: 'exams' },
          { id: 'create_exam', icon: '⊕', label: 'Create Exam', view: 'create_exam' },
          { id: 'gradebook', icon: '📊', label: 'Gradebook Review', view: 'gradebook' }
        ]
      }
    ],
  },
  deputy_admin: {
    label: 'Deputy Admin',
    portal: 'Administration Portal',
    accent: '#0F766E',
    home: 'overview',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'overview', icon: '🏠', label: 'Overview', view: 'overview' },
          { id: 'staff', icon: '👥', label: 'Staff Attendance', view: 'staff' },
          { id: 'facilities', icon: '🏛️', label: 'Facilities', view: 'facilities' },
          { id: 'finance', icon: '💰', label: 'Finance', view: 'finance' },
          { id: 'settings', icon: '⚙️', label: 'School Settings', view: 'settings' }
        ]
      }
    ],
  },
  finance: {
    label: 'Finance',
    portal: 'Finance Portal',
    accent: '#047857',
    home: 'finance',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'finance', icon: '💰', label: 'Fee Collection', view: 'finance' },
        ]
      }
    ],
  },
  registrar: {
    label: 'Registrar',
    portal: 'Admissions Office',
    accent: '#7C3AED',
    home: 'admissions',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'admissions', icon: '🧾', label: 'Admissions & Registry', view: 'admissions' },
        ]
      }
    ],
  },
  librarian: {
    label: 'Librarian',
    portal: 'Library Desk',
    accent: '#B45309',
    home: 'library',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'library', icon: '📚', label: 'Library', view: 'library' },
        ]
      }
    ],
  },
  teacher: {
    label: 'Teacher',
    portal: 'Teacher Portal',
    accent: '#0369A1',
    home: 'teacher',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'teacher', icon: '🧑‍🏫', label: 'My Classes', view: 'teacher' },
          { id: 'timetable', icon: '📅', label: 'My Timetable', view: 'timetable' },
        ]
      }
    ],
  },
  student: {
    label: 'Student',
    portal: 'Student Portal',
    accent: '#1D4ED8',
    home: 'student',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'student', icon: '🎓', label: 'My Dashboard', view: 'student' },
        ]
      }
    ],
  },
  parent: {
    label: 'Parent',
    portal: 'Parent Portal',
    accent: '#BE185D',
    home: 'Parent',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'parent', icon: '👪', label: 'My Child', view: 'parent' },
        ]
      }
    ],
  },
  nurse: {
    label: 'Nurse',
    portal: 'Health & Nursing',
    accent: '#DC2626',
    home: 'clinic',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'clinic', icon: '🏥', label: 'Clinic', view: 'clinic' },
        ]
      }
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
