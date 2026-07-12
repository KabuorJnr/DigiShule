// Seeded user accounts + role configuration (the app's in-session "users db").
// NOTE: passwords are stored here in plain text only because this is a
// frontend-only demo artifact with no backend. Do NOT use this pattern with a
// real database — use Supabase auth (auth.users) + RLS instead.

export const ROLES = {
  parent: {
    label: 'Parent',
    portal: 'Parent Portal',
    accent: '#0284c7',
    home: 'parent',
    nav: [
      {
        section: 'CHILD OVERVIEW',
        items: [
          { id: 'dashboard', icon: 'home', label: 'Dashboard', view: 'parent' },
          { id: 'academics', icon: 'library', label: 'Academics & Reports', view: 'student', tab: 'academics' },
          { id: 'attendance', icon: 'clipboard', label: 'Attendance', view: 'parent', tab: 'attendance' },
          { id: 'finance', icon: 'finance', label: 'Fees & Payments', view: 'student', tab: 'finance' }
        ]
      },
      {
        section: 'COMMUNICATIONS',
        items: [
          { id: 'contact_teacher', icon: 'pen', label: 'Contact Teacher', view: 'parent', tab: 'contact' },
          { id: 'notices', icon: 'bell', label: 'Notices & Alerts', view: 'notices' },
          { id: 'school_calendar', icon: 'calendar', label: 'School Calendar', view: 'school_calendar' }
        ]
      },
      {
        section: 'RECORDS',
        items: [
          { id: 'health', icon: 'clinic', label: 'Health Records', view: 'parent', tab: 'health' },
          { id: 'disciplinary', icon: 'warning', label: 'Disciplinary', view: 'parent', tab: 'disciplinary' }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { id: 'profile', icon: 'user', label: 'My Profile', view: 'my_profile' },
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ]
  },

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
              { id: 'leave_management', label: 'Leave Management', view: 'staff' },
              { id: 'teacher_mgmt_p', label: 'Teaching Staff', view: 'teacher_management' },
              { id: 'assign_subjects_p', label: 'Assign to Class', view: 'teacher_management', tab: 'assign' }
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
              { id: 'schemes', label: 'Schemes of Work', view: 'scheme_of_work' },
              { id: 'lessons', label: 'Lesson Plans', view: 'lesson_plans' },
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
          { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', view: 'academics_dashboard' },
          { id: 'timetable', icon: 'calendar', label: 'Timetable', view: 'timetable' },
          { id: 'exams', icon: 'exam', label: 'Exam Schedules', view: 'exams' },
          { id: 'gradebook', icon: 'dashboard', label: 'Gradebook', view: 'gradebook' },
          { id: 'registrar', icon: 'users', label: 'Class Lists', view: 'registrar' },
          { id: 'staff', icon: 'users', label: 'Staff', view: 'staff' }
        ]
      },
      {
        section: 'TEACHER MANAGEMENT',
        items: [
          { id: 'teacher_mgmt', icon: 'users', label: 'Teaching Staff', view: 'teacher_management' },
          { id: 'assign_subjects', icon: 'clipboard', label: 'Assign to Class', view: 'teacher_management', tab: 'assign' },
          { id: 'qualifications', icon: 'exam', label: 'Qualifications', view: 'teacher_management', tab: 'qualifications' }
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
          { id: 'profile', icon: 'user', label: 'My Profile', view: 'my_profile' },
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
        section: 'TEACHER MANAGEMENT',
        items: [
          { id: 'teacher_mgmt', icon: 'users', label: 'Teaching Staff', view: 'teacher_management' },
          { id: 'assign_subjects', icon: 'clipboard', label: 'Assign to Class', view: 'teacher_management', tab: 'assign' },
          { id: 'qualifications', icon: 'exam', label: 'Qualifications', view: 'teacher_management', tab: 'qualifications' }
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
          { id: 'profile', icon: 'user', label: 'My Profile', view: 'my_profile' },
          { id: 'logout', icon: 'logout', label: 'Log Out', action: 'logout' }
        ]
      }
    ],
  },

  finance: {
    label: 'Finance Officer',
    portal: 'Finance Portal',
    accent: '#000000',
    home: 'finance',
    nav: [
      {
        section: 'CORE',
        items: [
          { id: 'finance', icon: 'finance', label: 'Finance & Fees', view: 'finance' },
          { id: 'notices', icon: 'bell', label: 'Notices', view: 'notices' }
        ]
      },
      {
        section: 'INVOICES & BILLING',
        items: [
          { id: 'all_invoices', icon: 'file', label: 'All Invoices', view: 'finance', tab: 'invoices' },
          { id: 'generate_invoice', icon: 'plus', label: 'Generate Invoice', view: 'finance', tab: 'invoices', action: 'generate_invoice' },
          { id: 'bulk_invoicing', icon: 'folder', label: 'Bulk Invoicing', view: 'finance', tab: 'invoices', action: 'bulk_invoice' },
          { id: 'overdue_invoices', icon: 'warning', label: 'Overdue Invoices', view: 'finance', tab: 'invoices', filter: 'overdue' }
        ]
      },
      {
        section: 'PAYMENTS',
        items: [
          { id: 'all_payments', icon: 'payment', label: 'All Payments', view: 'finance', tab: 'payments' },
          { id: 'record_payments', icon: 'finance', label: 'Record Payments', view: 'finance', tab: 'payments', action: 'record_payment' },
          { id: 'pending_payments', icon: 'clock', label: 'Pending Payments', view: 'finance', tab: 'payments', filter: 'pending' },
          { id: 'reconciliation', icon: 'chart', label: 'Reconciliation', view: 'finance', tab: 'payments', action: 'reconcile' }
        ]
      },
      {
        section: 'FEE STRUCTURE',
        items: [
          { id: 'fee_statements', icon: 'clipboard', label: 'Fee Statements & Print', view: 'finance', tab: 'fee_structure' }
        ]
      },
      {
        section: 'EXPENSE MANAGEMENT',
        items: [
          { id: 'all_expenses', icon: 'finance', label: 'All Expenses', view: 'finance', tab: 'expenses' },
          { id: 'record_expense', icon: 'pen', label: 'Record Expense', view: 'finance', tab: 'expenses', action: 'record_expense' },
          { id: 'expense_categories', icon: 'list', label: 'Categories', view: 'finance', tab: 'expenses', action: 'categories' }
        ]
      },
      {
        section: 'REPORTS & ANALYSIS',
        items: [
          { id: 'fee_report', icon: 'dashboard', label: 'Fee Report', view: 'finance', tab: 'reports' },
          { id: 'expense_report', icon: 'analytics', label: 'Expense Report', view: 'finance', tab: 'reports' },
          { id: 'cash_flow', icon: 'analytics', label: 'Cash Flow', view: 'finance', tab: 'reports' },
          { id: 'student_statements', icon: 'clipboard', label: 'Student Statements', view: 'finance', tab: 'reports' },
          { id: 'downloads', icon: 'download', label: 'Downloads', view: 'finance', tab: 'reports', action: 'downloads' }
        ]
      },
      {
        section: 'SYSTEM',
        items: [
          { id: 'notifications', icon: 'bell', label: 'Notifications', view: 'finance', action: 'notif' },
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
          { id: 'schemes', icon: 'folder', label: 'Schemes of Work', view: 'scheme_of_work' },
          { id: 'lessons', icon: 'file', label: 'Lesson Plans', view: 'lesson_plans' },
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



  clinic: {
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

