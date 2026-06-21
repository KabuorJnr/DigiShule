// Seed data for the role-specific modules (Library, Finance, Admissions,
// Clinic, Staff, Facilities). Deterministic where it matters.

export const LIBRARY_BOOKS = [
  { id: 'b1', title: 'A Doll\'s House', author: 'Henrik Ibsen', isbn: '978-0486270623', category: 'Set Book', copies: 40, available: 28 },
  { id: 'b2', title: 'The River and the Source', author: 'Margaret Ogola', isbn: '978-9966466521', category: 'Set Book', copies: 50, available: 12 },
  { id: 'b3', title: 'Blossoms of the Savannah', author: 'Henry Ole Kulet', isbn: '978-9966254863', category: 'Set Book', copies: 50, available: 9 },
  { id: 'b4', title: 'KCSE Revision Mathematics', author: 'KLB', isbn: '978-9966259011', category: 'Revision', copies: 30, available: 21 },
  { id: 'b5', title: 'Secondary Chemistry Grade 10', author: 'KLB', isbn: '978-9966259028', category: 'Course', copies: 35, available: 30 },
  { id: 'b6', title: 'Comprehensive Biology', author: 'Longhorn', isbn: '978-9966493011', category: 'Course', copies: 35, available: 33 },
  { id: 'b7', title: 'Atlas of Kenya & The World', author: 'Macmillan', isbn: '978-9966493028', category: 'Reference', copies: 20, available: 18 },
  { id: 'b8', title: 'Fathers of Nations', author: 'Paul B. Vitta', isbn: '978-9914701234', category: 'Set Book', copies: 50, available: 5 },
];

export const LIBRARY_LOANS = [
  { id: 'l1', book: 'The River and the Source', student: 'Brian Mwangi', adm: '1A-001', borrowed: '2026-05-20', due: '2026-06-03', status: 'Overdue' },
  { id: 'l2', book: 'Blossoms of the Savannah', student: 'Faith Otieno', adm: '1A-006', borrowed: '2026-05-28', due: '2026-06-11', status: 'Borrowed' },
  { id: 'l3', book: 'Fathers of Nations', student: 'Kevin Kamau', adm: '2A-003', borrowed: '2026-05-15', due: '2026-05-29', status: 'Overdue' },
  { id: 'l4', book: 'KCSE Revision Mathematics', student: 'Mercy Wanjiru', adm: '4A-011', borrowed: '2026-06-01', due: '2026-06-15', status: 'Borrowed' },
  { id: 'l5', book: 'A Doll\'s House', student: 'Dennis Ochieng', adm: '3B-007', borrowed: '2026-06-04', due: '2026-06-18', status: 'Borrowed' },
];

export const FINANCE_PAYMENTS = [
  { id: 'p1', date: '2026-06-08', student: 'Brian Mwangi', adm: '1A-001', method: 'M-Pesa', ref: 'QGH4TX91', amount: 45000 },
  { id: 'p2', date: '2026-06-08', student: 'Joy Wanjiru', adm: '2A-014', method: 'Bank', ref: 'EQB-77120', amount: 38000 },
  { id: 'p3', date: '2026-06-07', student: 'Collins Ochieng', adm: '3A-009', method: 'M-Pesa', ref: 'QGF2MD58', amount: 50000 },
  { id: 'p4', date: '2026-06-07', student: 'Cynthia Njoroge', adm: '4B-002', method: 'Cheque', ref: 'CHQ-3391', amount: 28000 },
  { id: 'p5', date: '2026-06-06', student: 'Victor Achieng', adm: '1B-018', method: 'M-Pesa', ref: 'QGD9KL23', amount: 20000 },
  { id: 'p6', date: '2026-06-06', student: 'Esther Kipchoge', adm: '2B-005', method: 'Bank', ref: 'EQB-77004', amount: 42000 },
];

// Termly fee billing summary per Grade (KES).
export const FEE_SUMMARY = [
  { Grade: 'Grade 7', billed: 49500, students: 40, collected: 1663200, expected: 1980000 },
  { Grade: 'Grade 8', billed: 49500, students: 40, collected: 1504800, expected: 1980000 },
  { Grade: 'Grade 9', billed: 54000, students: 40, collected: 1404000, expected: 2160000 },
  { Grade: 'Grade 10', billed: 54000, students: 40, collected: 1252800, expected: 2160000 },
];

export const ADMISSIONS = [
  { id: 'ad1', name: 'Samuel Barasa', kcpe: 398, gender: 'M', Grade: 'Grade 7', date: '2026-06-02', status: 'Admitted' },
  { id: 'ad2', name: 'Diana Akinyi', kcpe: 412, gender: 'F', Grade: 'Grade 7', date: '2026-06-03', status: 'Admitted' },
  { id: 'ad3', name: 'Felix Mutua', kcpe: 365, gender: 'M', Grade: 'Grade 7', date: '2026-06-04', status: 'Pending' },
  { id: 'ad4', name: 'Nancy Chepkemoi', kcpe: 388, gender: 'F', Grade: 'Grade 7', date: '2026-06-05', status: 'Pending' },
  { id: 'ad5', name: 'Allan Simiyu', kcpe: 421, gender: 'M', Grade: 'Grade 7', date: '2026-06-06', status: 'Admitted' },
  { id: 'ad6', name: 'Purity Nyokabi', kcpe: 354, gender: 'F', Grade: 'Grade 7', date: '2026-06-07', status: 'Waitlisted' },
  { id: 'ad7', name: 'Ian Kiplagat', kcpe: 377, gender: 'M', Grade: 'Grade 8 (Transfer)', date: '2026-06-07', status: 'Pending' },
];

export const CLINIC_VISITS = [
  { id: 'c1', date: '2026-06-09', student: 'Mercy Wanjiru', adm: '4A-011', complaint: 'Headache & fever', treatment: 'Paracetamol, rest', outcome: 'Returned to class' },
  { id: 'c2', date: '2026-06-09', student: 'Dennis Ochieng', adm: '3B-007', complaint: 'Sprained ankle (games)', treatment: 'Cold compress, bandage', outcome: 'Referred to hospital' },
  { id: 'c3', date: '2026-06-08', student: 'Joy Wanjiru', adm: '2A-014', complaint: 'Stomach upset', treatment: 'ORS, observation', outcome: 'Sent home' },
  { id: 'c4', date: '2026-06-08', student: 'Victor Achieng', adm: '1B-018', complaint: 'Allergic rash', treatment: 'Antihistamine', outcome: 'Returned to class' },
  { id: 'c5', date: '2026-06-05', student: 'Beatrice Wairimu', adm: '1A-001', complaint: 'Routine asthma check', treatment: 'Inhaler refill', outcome: 'Returned to class' },
];

export const DISCIPLINARY_RECORDS = [
  { id: 'd1', date: '2026-05-28', student: 'Beatrice Wairimu', adm: '1A-001', class: '1A', category: 'Lateness', description: 'Late to morning assembly (3rd instance this term).', action: 'Verbal warning + guardian notified', severity: 'Low', status: 'Resolved' },
  { id: 'd2', date: '2026-06-04', student: 'Beatrice Wairimu', adm: '1A-001', class: '1A', category: 'Uniform', description: 'Incomplete uniform — missing school sweater.', action: 'Counselled by class teacher', severity: 'Low', status: 'Open' },
  { id: 'd3', date: '2026-06-02', student: 'Eric Omondi', adm: '1A-002', class: '1A', category: 'Misconduct', description: 'Noise-making during prep time.', action: 'Detention (1 day)', severity: 'Medium', status: 'Resolved' },
  { id: 'd4', date: '2026-06-06', student: 'Dennis Ochieng', adm: '3B-007', class: '3B', category: 'Absenteeism', description: 'Skipped afternoon classes without permission.', action: 'Guardian meeting scheduled', severity: 'High', status: 'Open' },
  { id: 'd5', date: '2026-05-30', student: 'Joy Wanjiru', adm: '2A-014', class: '2A', category: 'Property', description: 'Damaged a classroom desk.', action: 'Repair cost billed; warning issued', severity: 'Medium', status: 'Resolved' },
];

export const STAFF = [
  { id: 's1', name: 'Mr. Omondi', role: 'Teacher', dept: 'Mathematics', status: 'Present', checkIn: '07:12' },
  { id: 's2', name: 'Ms. Wanjiku', role: 'Teacher', dept: 'Languages', status: 'Present', checkIn: '07:05' },
  { id: 's3', name: 'Mr. Kipchoge', role: 'Teacher', dept: 'Languages', status: 'Present', checkIn: '07:20' },
  { id: 's4', name: 'Ms. Achieng', role: 'Teacher', dept: 'Sciences', status: 'On Leave', checkIn: '—' },
  { id: 's5', name: 'Mr. Muthoni', role: 'Teacher', dept: 'Sciences', status: 'Present', checkIn: '06:58' },
  { id: 's6', name: 'Ms. Njeri', role: 'Teacher', dept: 'Sciences', status: 'Absent', checkIn: '—' },
  { id: 's7', name: 'Mr. Kamau', role: 'Teacher', dept: 'Humanities', status: 'Present', checkIn: '07:31' },
  { id: 's8', name: 'Ms. Otieno', role: 'Teacher', dept: 'Humanities', status: 'On Leave', checkIn: '—' },
  { id: 's9', name: 'Mr. Joseph Njoroge', role: 'Librarian', dept: 'Library', status: 'Present', checkIn: '07:00' },
  { id: 's10', name: 'Sr. Mary Wairimu', role: 'Nurse', dept: 'Nursing', status: 'Present', checkIn: '06:50' },
  { id: 's11', name: 'Mr. Daniel Kerubo', role: 'Bursar', dept: 'Finance', status: 'Present', checkIn: '07:08' },
  { id: 's12', name: 'Ms. Agnes Chebet', role: 'Registrar', dept: 'Admissions', status: 'Present', checkIn: '07:15' },
];

export const FACILITIES = [
  { id: 'f1', name: 'Main Hall', type: 'Hall', capacity: 200, status: 'Operational', note: 'Used for exams & assemblies' },
  { id: 'f2', name: 'Science Lab Block', type: 'Laboratory', capacity: 80, status: 'Operational', note: '3 labs: Bio, Chem, Phys' },
  { id: 'f3', name: 'Library', type: 'Library', capacity: 60, status: 'Maintenance', note: 'Roof repair until 12 Jun' },
  { id: 'f4', name: 'Computer Lab', type: 'Laboratory', capacity: 45, status: 'Operational', note: '45 workstations' },
  { id: 'f5', name: 'Dining Hall', type: 'Hall', capacity: 400, status: 'Operational', note: '' },
  { id: 'f6', name: 'Boys Dormitory', type: 'Dormitory', capacity: 220, status: 'Operational', note: '' },
  { id: 'f7', name: 'Girls Dormitory', type: 'Dormitory', capacity: 220, status: 'Operational', note: '' },
  { id: 'f8', name: 'Sports Field', type: 'Outdoor', capacity: 0, status: 'Operational', note: 'Football + athletics track' },
];

export const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');
