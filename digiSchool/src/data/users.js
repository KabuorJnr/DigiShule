// Seeded user accounts + role configuration (the app's in-session "users db").
// NOTE: passwords are stored here in plain text only because this is a
// frontend-only demo artifact with no backend. Do NOT use this pattern with a
// real database — use Supabase auth (auth.users) + RLS instead.

export const ROLES = {
  principal: {
    label: 'Principal',
    portal: 'Principal Portal',
    accent: '#000000',
    home: 'overview',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'overview', icon: 'home', label: 'Dashboard', view: 'overview' }
        ]
      },
      {
        section: 'MANAGEMENT',
        items: [
          {
            id: 'deputy_offices', icon: 'facilities', label: 'Deputy Offices',
            sub: [
              { id: 'deputy_academic', label: 'Deputy Academics', action: 'visit_academics' },
              { id: 'deputy_admin', label: 'Deputy Administration', action: 'visit_admin' },
              { id: 'registrar', label: 'Registrar Office', view: 'registrar' }
            ]
          },
          {
            id: 'staff_management', icon: 'users', label: 'Staff Management',
            sub: [
              { id: 'teaching_staff', label: 'Staff Attendance', view: 'staff' },
              { id: 'leave_management', label: 'Leave Management', view: 'staff' }
            ]
          },
          {
            id: 'student_management', icon: 'student', label: 'Student Management',
            sub: [
              { id: 'admissions', label: 'Admissions', view: 'admissions' },
              { id: 'boarding', label: 'Class Rolls', view: 'admissions' }
            ]
          },
          {
            id: 'academic', icon: 'library', label: 'Academic',
            sub: [
              { id: 'timetable', label: 'Timetable', view: 'timetable' },
              { id: 'examinations', label: 'Examinations', view: 'exams' },
              { id: 'gradebook', label: 'Gradebook', view: 'gradebook' }
            ]
          },
          {
            id: 'finance_mgmt', icon: 'finance', label: 'Finance',
            sub: [
              { id: 'accounts', label: 'Accounts Office', view: 'finance' },
              { id: 'fee_structures', label: 'Fee Structures', view: 'finance' }
            ]
          }
        ]
      },
      {
        section: 'SUPPORT OFFICES',
        items: [
          { id: 'clinic', icon: 'clinic', label: 'Health Center', view: 'clinic' },
          { id: 'library', icon: 'library', label: 'Library', view: 'library' },
          { id: 'facilities', icon: 'facilities', label: 'Facilities', view: 'facilities' }
        ]
      },
      {
        section: 'COMMUNICATIONS',
        items: [
          { id: 'notices', icon: 'bell', label: 'Notices & Announcements', view: 'notices' },
          { id: 'school_calendar', icon: 'calendar', label: 'School Calendar', view: 'school_calendar' }
        ]
      },
      {
        section: 'QUICK ACTIONS',
        items: [
          { id: 'new_admission', icon: 'plus', label: 'New Admission', view: 'admissions' },
          { id: 'create_exam', icon: 'plus', label: 'Create Exam', view: 'create_exam' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'settings', icon: 'settings', label: 'System Settings', view: 'settings' },
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  deputy_academic: {
    label: 'Deputy Academics',
    portal: 'Academics Portal',
    accent: '#000000',
    home: 'academics_dashboard',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'acad_dash', icon: 'home', label: 'Dashboard', view: 'academics_dashboard' },
          { id: 'timetable', icon: 'calendar', label: 'Timetable', view: 'timetable' },
          { id: 'exams', icon: 'exam', label: 'Exam Schedules', view: 'exams' },
          { id: 'create_exam', icon: 'plus', label: 'Create Exam', view: 'create_exam' },
          { id: 'gradebook', icon: 'dashboard', label: 'Gradebook', view: 'gradebook' },
          { id: 'staff', icon: 'users', label: 'Staff', view: 'staff' }
        ]
      },
      {
        section: 'COMMUNICATIONS',
        items: [
          { id: 'notices', icon: 'bell', label: 'Notices', view: 'notices' },
          { id: 'school_calendar', icon: 'calendar', label: 'Calendar', view: 'school_calendar' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'settings', icon: 'settings', label: 'Settings', view: 'settings' },
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  deputy_admin: {
    label: 'Deputy Admin',
    portal: 'Administration Portal',
    accent: '#000000',
    home: 'admin_dashboard',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'admin_dash', icon: 'home', label: 'Dashboard', view: 'admin_dashboard' },
          { id: 'staff', icon: 'users', label: 'Staff Attendance', view: 'staff' },
          { id: 'admissions', icon: 'student', label: 'Student Registry', view: 'admissions' },
          { id: 'facilities', icon: 'facilities', label: 'Facilities', view: 'facilities' },
          { id: 'finance', icon: 'finance', label: 'Finance', view: 'finance' },
          { id: 'clinic', icon: 'clinic', label: 'Health Center', view: 'clinic' },
          { id: 'library', icon: 'library', label: 'Library', view: 'library' }
        ]
      },
      {
        section: 'COMMUNICATIONS',
        items: [
          { id: 'notices', icon: 'bell', label: 'Notices', view: 'notices' },
          { id: 'school_calendar', icon: 'calendar', label: 'Calendar', view: 'school_calendar' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'settings', icon: 'settings', label: 'Settings', view: 'settings' },
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  finance: {
    label: 'Finance Officer',
    portal: 'Finance Portal',
    accent: '#000000',
    home: 'finance_dashboard',
    nav: [
      {
        section: 'INVOICES & BILLING',
        items: [
          { id: 'all_invoices', icon: 'file', label: 'All Invoices', view: 'finance_dashboard', tab: 'invoices' },
          { id: 'generate_invoice', icon: 'plus', label: 'Generate Invoice', view: 'finance_dashboard', tab: 'invoices', action: 'generate_invoice' },
          { id: 'bulk_invoicing', icon: 'folder', label: 'Bulk Invoicing', view: 'finance_dashboard', tab: 'invoices', action: 'bulk_invoice' },
          { id: 'overdue_invoices', icon: 'warning', label: 'Overdue Invoices', view: 'finance_dashboard', tab: 'invoices', filter: 'overdue' }
        ]
      },
      {
        section: 'PAYMENTS',
        items: [
          { id: 'all_payments', icon: 'payment', label: 'All Payments', view: 'finance_dashboard', tab: 'payments' },
          { id: 'record_payments', icon: 'finance', label: 'Record Payments', view: 'finance_dashboard', tab: 'payments', action: 'record_payment' },
          { id: 'pending_payments', icon: 'clock', label: 'Pending Payments', view: 'finance_dashboard', tab: 'payments', filter: 'pending' },
          { id: 'reconciliation', icon: 'chart', label: 'Reconciliation', view: 'finance_dashboard', tab: 'payments', action: 'reconcile' }
        ]
      },
      {
        section: 'FEE STRUCTURE',
        items: [
          { id: 'fee_statements', icon: 'clipboard', label: 'Fee Statements & Print', view: 'finance_dashboard', tab: 'fee_structure' }
        ]
      },
      {
        section: 'EXPENSE MANAGEMENT',
        items: [
          { id: 'all_expenses', icon: 'finance', label: 'All Expenses', view: 'finance_dashboard', tab: 'expenses' },
          { id: 'record_expense', icon: 'pen', label: 'Record Expense', view: 'finance_dashboard', tab: 'expenses', action: 'record_expense' },
          { id: 'expense_categories', icon: 'list', label: 'Categories', view: 'finance_dashboard', tab: 'expenses', action: 'categories' }
        ]
      },
      {
        section: 'REPORTS & ANALYSIS',
        items: [
          { id: 'fee_report', icon: 'dashboard', label: 'Fee Report', view: 'finance_dashboard', tab: 'reports' },
          { id: 'expense_report', icon: 'analytics', label: 'Expense Report', view: 'finance_dashboard', tab: 'reports' },
          { id: 'cash_flow', icon: 'analytics', label: 'Cash Flow', view: 'finance_dashboard', tab: 'reports' },
          { id: 'student_statements', icon: 'clipboard', label: 'Student Statements', view: 'finance_dashboard', tab: 'reports' },
          { id: 'downloads', icon: 'download', label: 'Downloads', view: 'finance_dashboard', tab: 'reports', action: 'downloads' }
        ]
      },
      {
        section: 'SYSTEM',
        items: [
          { id: 'notifications', icon: 'bell', label: 'Notifications', view: 'finance_dashboard', action: 'notif' },
          { id: 'settings', icon: 'settings', label: 'Finance Settings', view: 'settings' },
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  registrar: {
    label: 'Registrar',
    portal: 'Registrar Office',
    accent: '#000000',
    home: 'registrar',
    nav: [
      {
        section: 'REGISTRY',
        items: [
          { id: 'registrar', icon: 'exam', label: 'Student Register', view: 'registrar' },
          { id: 'admissions', icon: 'student', label: 'Admissions (Old)', view: 'admissions' }
        ]
      },
      {
        section: 'COMMUNICATIONS',
        items: [
          { id: 'notices', icon: 'bell', label: 'Notices & Memos', view: 'notices' },
          { id: 'school_calendar', icon: 'calendar', label: 'School Calendar', view: 'school_calendar' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  librarian: {
    label: 'Librarian',
    portal: 'Library Desk',
    accent: '#000000',
    home: 'library',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'library', icon: 'library', label: 'Library', view: 'library' },
          { id: 'notices', icon: 'bell', label: 'Notices', view: 'notices' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  teacher: {
    label: 'Teacher',
    portal: 'Teacher Portal',
    accent: '#000000',
    home: 'teacher',
    nav: [
      {
        section: 'TEACHING',
        items: [
          { id: 'teacher', icon: 'home', label: 'My Dashboard', view: 'teacher' },
          { id: 'timetable', icon: 'calendar', label: 'My Timetable', view: 'timetable' },
          { id: 'exams', icon: 'book', label: 'Exam Schedules', view: 'exams' },
          { id: 'teacher_resources', icon: 'folder', label: 'Assignments & Materials', view: 'teacher_resources' }
        ]
      },
      {
        section: 'GRADEBOOK',
        items: [
          { id: 'result_entry', icon: 'pen', label: 'Result Entry', view: 'gradebook', tab: 'entry' },
          { id: 'result_analysis', icon: 'analytics', label: 'Result Analysis', view: 'gradebook', tab: 'analysis' },
          { id: 'result_overview', icon: 'dashboard', label: 'Overview', view: 'gradebook', tab: 'overview' }
        ]
      },
      {
        section: 'COMMUNICATIONS',
        items: [
          { id: 'notices', icon: 'bell', label: 'Notices', view: 'notices' },
          { id: 'school_calendar', icon: 'calendar', label: 'School Calendar', view: 'school_calendar' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  student: {
    label: 'Student',
    portal: 'Student Portal',
    accent: '#000000',
    home: 'student',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'student', icon: 'student', label: 'My Portal', view: 'student' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  parent: {
    label: 'Parent',
    portal: 'Parent Portal',
    accent: '#000000',
    home: 'parent',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'parent', icon: 'users', label: 'My Child', view: 'parent' },
          { id: 'notices', icon: 'bell', label: 'Notices & Messages', view: 'notices' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  nurse: {
    label: 'Nurse',
    portal: 'Health & Nursing',
    accent: '#000000',
    home: 'clinic',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'clinic', icon: 'clinic', label: 'Clinic', view: 'clinic' },
          { id: 'notices', icon: 'bell', label: 'Notices', view: 'notices' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },
};

// The seeded accounts. `username` is case-insensitive on login.
export const USERS = [
  { username: 'Principal', password: 'Zulu@254', role: 'principal', name: 'Dr. Jane Kamau', dept: 'Principal' },
  { username: 'Deputyacademic', password: '7777', role: 'deputy_academic', name: 'Mr. Peter Mwangi', dept: 'Deputy Academics' },
  { username: 'Deputyadmin', password: '7777', role: 'deputy_admin', name: 'Mrs. Lucy Wambui', dept: 'Deputy Admin' },
  { username: 'FINANCE', password: '7777', role: 'finance', name: 'Mr. Daniel Kerubo', dept: 'Finance' },
  { username: 'Registrar', password: '7777', role: 'registrar', name: 'Ms. Agnes Chebet', dept: 'Admissions Office' },
  { username: 'Librarian', password: '7777', role: 'librarian', name: 'Mr. Joseph Njoroge', dept: 'Library' },
  { username: 'NURSE001', password: '7777', role: 'nurse', name: 'Sr. Mary Wairimu', dept: 'Nursing' },
  { username: 'STF5169', password: '7777', role: 'teacher', name: 'Mr. Omondi', dept: 'Mathematics', link: 't1' },
  { username: 'STU2640494', password: '7777', role: 'student', name: 'Student', dept: 'Grade 7A', link: 'Grade 7A-1' },
  { username: 'PAR90215', password: '7777', role: 'parent', name: 'Parent / Guardian', dept: 'Parent', link: 'Grade 7A-1' },
];

export function authenticate(username, password) {
  if (!username || !password) return null;
  const u = USERS.find(
    (x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password
  );
  if (u) return u;
  
  if (password === '7777') {
    const un = username.trim().toUpperCase();
    if (un.startsWith('STU')) {
      const adm = un.substring(3);
      return { username, password, role: 'student', name: 'Student ' + adm, dept: 'Student', link: adm };
    }
    if (un.startsWith('PAR')) {
      const adm = un.substring(3);
      return { username, password, role: 'parent', name: 'Parent of ' + adm, dept: 'Parent', link: adm };
    }
  }
  
  return null;
}
